<script setup lang="ts">
import type { Worker } from 'tesseract.js'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { converter } from '../converter'
import { aimBoxRect, inflate, type Rect } from '../geometry'
import { locale, t } from '../i18n'
import { detectPrices, selectPrices, type OcrLine } from '../priceAnalyzer'
import { createScanner, type ScanMode } from '../scanner'
import ConversionCard from './ConversionCard.vue'
import CurrencySelect from './CurrencySelect.vue'

defineEmits<{ close: [] }>()

// Grow each box so small numbers are still easy to tap
const TAP_PADDING_PX = 12

const { state: rates, swap } = converter
const scanner = createScanner()
const { state } = scanner

const view = ref<HTMLElement>()
const video = ref<HTMLVideoElement>()
const size = ref({ width: 0, height: 0 })
const aimBox = computed(() => aimBoxRect(size.value.width, size.value.height))
const cameraFailed = ref(false)

const isAuto = computed(() => state.mode === 'auto')
const selected = computed(() => (state.selectedId ? state.detected.get(state.selectedId) : undefined))
// A paused Auto frame keeps just the price the user tapped
const highlighted = computed(() => (isAuto.value && selected.value ? [selected.value] : [...state.detected.values()]))
const cards = computed(() => (isAuto.value ? highlighted.value : selected.value ? [selected.value] : []))

const hint = computed(() => {
  if (isAuto.value) return t(selected.value ? 'scanner_hint_auto_paused' : 'scanner_hint_auto')
  return t(selected.value ? 'scanner_hint_manual_selected' : 'scanner_hint_manual')
})

const modes: { mode: ScanMode; label: () => string }[] = [
  { mode: 'auto', label: () => t('scanner_mode_auto') },
  { mode: 'manual', label: () => t('scanner_mode_manual') },
]

/** Everything outside the aim box, for the dimmed scrim (even-odd fill leaves the box clear). */
const scrimPath = computed(() => {
  const { width: w, height: h } = size.value
  const b = aimBox.value
  const r = 16
  return (
    `M0 0H${w}V${h}H0Z ` +
    `M${b.left + r} ${b.top}H${b.right - r}A${r} ${r} 0 0 1 ${b.right} ${b.top + r}` +
    `V${b.bottom - r}A${r} ${r} 0 0 1 ${b.right - r} ${b.bottom}H${b.left + r}` +
    `A${r} ${r} 0 0 1 ${b.left} ${b.bottom - r}V${b.top + r}A${r} ${r} 0 0 1 ${b.left + r} ${b.top}Z`
  )
})

const priceLabel = (value: number) =>
  t('scanner_price_description', new Intl.NumberFormat(locale.value, { minimumFractionDigits: 2 }).format(value))

const boxStyle = (r: Rect) => ({
  left: `${r.left}px`,
  top: `${r.top}px`,
  width: `${r.right - r.left}px`,
  height: `${r.bottom - r.top}px`,
})

function onHighlightClick(id: string) {
  if (!isAuto.value) scanner.select(id)
}

// Tapping a card pauses on it; tapping the paused card again resumes
function onCardClick(id: string) {
  if (id === state.selectedId) scanner.resume()
  else scanner.select(id)
}

// Pausing the video shows a still of the frame the user tapped, so highlights stay aligned
watch(
  () => state.selectedId,
  (id) => (id === null ? video.value?.play() : video.value?.pause()),
)

// --- Camera and OCR ---

let stream: MediaStream | undefined
let worker: Worker | undefined
let stopped = false
const resizeObserver = new ResizeObserver(([entry]) => {
  size.value = { width: entry!.contentRect.width, height: entry!.contentRect.height }
})
const expireTimer = setInterval(scanner.expire, 500)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Where the video's pixels land on screen. The video fills the view with object-fit: cover,
 * so it's scaled up to cover and centered, cropping the overflow.
 */
function videoTransform(v: HTMLVideoElement) {
  const scale = Math.max(size.value.width / v.videoWidth, size.value.height / v.videoHeight)
  return {
    scale,
    offsetX: (size.value.width - v.videoWidth * scale) / 2,
    offsetY: (size.value.height - v.videoHeight * scale) / 2,
  }
}

const canvas = document.createElement('canvas')
const MAX_OCR_WIDTH = 720

/** Reads just the aim box (only numbers inside it count), returning lines in screen pixels. */
async function recognizeAimBox(v: HTMLVideoElement, w: Worker): Promise<OcrLine[]> {
  const { scale, offsetX, offsetY } = videoTransform(v)
  const box = aimBox.value
  const left = Math.max(0, Math.floor((box.left - offsetX) / scale))
  const top = Math.max(0, Math.floor((box.top - offsetY) / scale))
  const right = Math.min(v.videoWidth, Math.ceil((box.right - offsetX) / scale))
  const bottom = Math.min(v.videoHeight, Math.ceil((box.bottom - offsetY) / scale))
  // Tesseract misreads very large text (a tag filling the box has digits ~300 px tall), and
  // smaller images are faster, so shrink the crop
  const shrink = Math.min(1, MAX_OCR_WIDTH / (right - left))
  canvas.width = Math.round((right - left) * shrink)
  canvas.height = Math.round((bottom - top) * shrink)
  canvas.getContext('2d')!.drawImage(v, left, top, right - left, bottom - top, 0, 0, canvas.width, canvas.height)

  const { data } = await w.recognize(canvas, {}, { blocks: true })
  const toScreen = (b: { x0: number; y0: number; x1: number; y1: number }): Rect => ({
    left: (left + b.x0 / shrink) * scale + offsetX,
    top: (top + b.y0 / shrink) * scale + offsetY,
    right: (left + b.x1 / shrink) * scale + offsetX,
    bottom: (top + b.y1 / shrink) * scale + offsetY,
  })
  return (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) => ({
        bounds: toScreen(line.bbox),
        words: line.words.map((word) => ({
          text: word.text,
          bounds: toScreen(word.bbox),
          symbols: word.symbols.map((s) => toScreen(s.bbox)),
        })),
      })),
    ),
  )
}

/** Runs OCR at half the device's maximum rate: after each analysis, idles for as long as it took. */
async function scanLoop(v: HTMLVideoElement, w: Worker) {
  while (!stopped) {
    if (state.selectedId !== null || v.readyState < 2 || !size.value.width) {
      await sleep(200)
      continue
    }
    const startedAt = performance.now()
    const lines = await recognizeAimBox(v, w)
    if (stopped) return
    scanner.update(selectPrices(detectPrices(lines), aimBox.value, [], isAuto.value))
    await sleep(performance.now() - startedAt)
  }
}

onMounted(async () => {
  // Measure now too: ResizeObserver only reports on the next rendered frame
  const rect = view.value!.getBoundingClientRect()
  size.value = { width: rect.width, height: rect.height }
  resizeObserver.observe(view.value!)
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
  } catch {
    cameraFailed.value = true
    return
  }
  if (stopped) return stream.getTracks().forEach((track) => track.stop())
  video.value!.srcObject = stream
  await video.value!.play()

  try {
    // Loaded on demand, so the converter doesn't download the OCR engine. It's CommonJS,
    // so a dynamic import only has a default export.
    const { createWorker, PSM } = (await import('tesseract.js')).default
    worker = await createWorker('eng')
    // Sparse text finds scattered numbers on tags better than page layout (tested on docs/test-images)
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
  } catch (error) {
    console.error('Could not start text recognition', error)
    return
  }
  if (stopped) return worker.terminate()
  scanLoop(video.value!, worker)
})

onUnmounted(() => {
  stopped = true
  clearInterval(expireTimer)
  resizeObserver.disconnect()
  stream?.getTracks().forEach((track) => track.stop())
  worker?.terminate()
})
</script>

<template>
  <div ref="view" class="fixed inset-0 overflow-hidden bg-black select-none">
    <p v-if="cameraFailed" class="absolute inset-x-0 top-1/2 px-6 text-center text-lg text-white">
      {{ t('scanner_camera_permission') }}
    </p>
    <template v-else>
      <video ref="video" class="absolute inset-0 size-full object-cover" playsinline muted></video>

      <svg class="pointer-events-none absolute inset-0 size-full">
        <path :d="scrimPath" fill="rgb(0 0 0 / 0.5)" fill-rule="evenodd" />
        <rect
          :x="aimBox.left"
          :y="aimBox.top"
          :width="aimBox.right - aimBox.left"
          :height="aimBox.bottom - aimBox.top"
          rx="16"
          fill="none"
          stroke-width="3"
          class="stroke-primary-dark"
        />
      </svg>

      <button
        v-for="price in highlighted"
        :key="price.id"
        type="button"
        :aria-label="priceLabel(price.value)"
        class="absolute rounded-md border-2"
        :class="
          price.id === state.selectedId
            ? 'border-[3px] border-primary-dark bg-primary-dark/35'
            : 'border-sky-200 bg-sky-200/15'
        "
        :style="{ ...boxStyle(inflate(price.bounds, TAP_PADDING_PX)), pointerEvents: isAuto ? 'none' : 'auto' }"
        @click="onHighlightClick(price.id)"
      ></button>

      <ConversionCard
        v-for="price in cards"
        :key="price.id"
        :value="price.value"
        :anchor="inflate(price.bounds, TAP_PADDING_PX)"
        :container="size"
        @select="onCardClick(price.id)"
      />
    </template>

    <header
      class="absolute inset-x-0 top-0 flex flex-col items-center gap-1 bg-white/80 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 text-stone-900 backdrop-blur-sm dark:bg-stone-900/80 dark:text-stone-100"
    >
      <h1 class="text-base font-medium">{{ t('scanner_title') }}</h1>
      <div class="flex items-center gap-1 text-primary dark:text-primary-dark">
        <CurrencySelect v-model="rates.from" :label="t('converter_from')" compact />
        <button
          type="button"
          :aria-label="t('converter_swap')"
          :title="t('converter_swap')"
          class="rounded-full p-1.5 hover:bg-stone-500/15"
          @click="swap"
        >
          <!-- Material "swap_horiz" -->
          <svg viewBox="0 0 24 24" class="size-6" fill="currentColor" aria-hidden="true">
            <path d="M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" />
          </svg>
        </button>
        <CurrencySelect v-model="rates.to" :label="t('converter_to')" compact />
      </div>
      <div
        role="radiogroup"
        class="my-1 flex overflow-hidden rounded-full border border-stone-500 text-sm dark:border-stone-400"
      >
        <button
          v-for="m in modes"
          :key="m.mode"
          type="button"
          role="radio"
          :aria-checked="state.mode === m.mode"
          class="min-w-24 px-4 py-1.5"
          :class="state.mode === m.mode ? 'bg-primary/20 font-medium dark:bg-primary-dark/25' : ''"
          @click="scanner.setMode(m.mode)"
        >
          <span v-if="state.mode === m.mode" aria-hidden="true">✓ </span>{{ m.label() }}
        </button>
      </div>
      <p class="text-center text-sm text-stone-600 dark:text-stone-300">{{ hint }}</p>
    </header>

    <div class="absolute inset-x-0 bottom-0 flex justify-center gap-3 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <button
        v-if="state.selectedId !== null"
        type="button"
        class="rounded-full bg-sky-100 px-5 py-2.5 font-medium text-stone-900 shadow"
        @click="scanner.resume"
      >
        {{ t('scanner_scan_again') }}
      </button>
      <button
        type="button"
        class="rounded-full bg-primary px-5 py-2.5 font-medium text-white shadow dark:bg-primary-dark dark:text-stone-900"
        @click="$emit('close')"
      >
        {{ t('scanner_back') }}
      </button>
    </div>
  </div>
</template>
