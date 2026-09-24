import { reactive } from 'vue'
import type { DetectedPrice } from './priceAnalyzer'

export type ScanMode = 'auto' | 'manual'

interface TimedPrice extends DetectedPrice {
  seenAt: number
}

/**
 * The scanner's detections and selection, ported from the Android ConverterController.
 * Detections from the previous frame are kept one extra frame so a single OCR miss doesn't
 * flicker; anything older is dropped. Nothing changes while a price is selected.
 */
export function createScanner(clock: () => number = Date.now) {
  const state = reactive({
    mode: 'manual' as ScanMode,
    detected: new Map<string, TimedPrice>(),
    selectedId: null as string | null,
  })
  // When the previous frame's detections arrived; anything older than that is stale
  let previousFrameAt = 0

  function update(prices: DetectedPrice[]) {
    const now = clock()
    if (state.selectedId === null) {
      const next = new Map([...state.detected].filter(([, p]) => p.seenAt >= previousFrameAt))
      for (const p of prices) next.set(p.id, { ...p, seenAt: now })
      state.detected = next
    }
    previousFrameAt = now
  }

  /** Drops detections not seen for 2 s, in case frames stop arriving. */
  function expire() {
    if (state.selectedId !== null) return
    const threshold = clock() - 2000
    const kept = [...state.detected].filter(([, p]) => p.seenAt > threshold)
    if (kept.length !== state.detected.size) state.detected = new Map(kept)
  }

  function select(id: string) {
    state.selectedId = id
  }

  /** Clears the selection and starts collecting fresh detections. */
  function resume() {
    state.selectedId = null
    state.detected = new Map()
  }

  function setMode(mode: ScanMode) {
    // Each mode keeps different candidates (Auto: largest per tag), so start fresh
    state.mode = mode
    resume()
  }

  return { state, update, expire, select, resume, setMode }
}
