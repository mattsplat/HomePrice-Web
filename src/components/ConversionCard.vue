<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { converter } from '../converter'
import { formatMoney } from '../format'
import { labelPosition, type Rect } from '../geometry'
import { locale, t } from '../i18n'

const props = defineProps<{ value: number; anchor: Rect; container: { width: number; height: number } }>()
defineEmits<{ select: [] }>()

const { state, rate } = converter

// Measured so the card can sit above its price, or below it when there's no room
const el = ref<HTMLElement>()
const size = ref({ width: 0, height: 0 })
const observer = new ResizeObserver(([entry]) => {
  const box = entry!.borderBoxSize[0]!
  size.value = { width: box.inlineSize, height: box.blockSize }
})
onMounted(() => observer.observe(el.value!))
onUnmounted(() => observer.disconnect())

const MARGIN = 12
const GAP = 6
const position = computed(() => labelPosition(props.anchor, size.value, props.container, MARGIN, GAP))
</script>

<template>
  <button
    ref="el"
    type="button"
    class="absolute top-0 left-0 rounded-xl border-[1.5px] border-primary bg-white px-3.5 py-2 text-left text-stone-900 shadow-lg dark:border-primary-dark dark:bg-stone-800 dark:text-stone-100"
    :style="{
      maxWidth: `${container.width - 2 * MARGIN}px`,
      translate: `${position.x}px ${position.y}px`,
      visibility: size.width ? 'visible' : 'hidden',
    }"
    @click="$emit('select')"
  >
    <span v-if="rate === null" class="block text-base font-medium">{{ t('scanner_loading_rate') }}</span>
    <span v-else class="flex items-baseline gap-1.5">
      <span class="text-2xl font-bold">{{ formatMoney(value * rate, state.to, locale) }}</span>
      <span class="text-sm font-bold text-primary dark:text-primary-dark">{{ state.to }}</span>
    </span>
    <span class="block text-sm text-stone-600 dark:text-stone-300">
      {{ formatMoney(value, state.from, locale) }} {{ state.from }}
    </span>
  </button>
</template>
