// Mirrors the scanner parts of the Android app's ConverterControllerTest.kt
import { describe, expect, it } from 'vitest'
import { detectedPrice } from './priceAnalyzer'
import { createScanner } from './scanner'

describe('createScanner', () => {
  let now = 1000
  const make = () => createScanner(() => now)
  const price = detectedPrice(3.79, { left: 100, top: 100, right: 200, bottom: 150 })
  const otherPrice = detectedPrice(6, { left: 100, top: 300, right: 300, bottom: 400 })
  const ids = (s: ReturnType<typeof make>) => [...s.state.detected.keys()]

  it('freezes detections when a price is selected', () => {
    const s = make()
    s.update([price])
    s.select(price.id)
    s.update([otherPrice])
    expect(s.state.selectedId).toBe(price.id)
    expect(ids(s)).toEqual([price.id])
  })

  it('clears the selection on resume and accepts new detections', () => {
    const s = make()
    s.update([price])
    s.select(price.id)
    s.resume()
    s.update([otherPrice])
    expect(s.state.selectedId).toBeNull()
    expect(ids(s)).toEqual([otherPrice.id])
  })

  it('clears the selection when switching mode', () => {
    const s = make()
    s.update([price])
    s.select(price.id)
    s.setMode('auto')
    s.update([otherPrice])
    expect(s.state.mode).toBe('auto')
    expect(s.state.selectedId).toBeNull()
    expect(ids(s)).toEqual([otherPrice.id])
  })

  it('keeps a detection missing from one frame, but not from two', () => {
    const s = make()
    s.update([price, otherPrice])
    now += 300
    s.update([otherPrice])
    expect(ids(s).sort()).toEqual([price.id, otherPrice.id].sort())
    now += 300
    s.update([otherPrice])
    expect(ids(s)).toEqual([otherPrice.id])
  })

  it('expires detections after 2 s without frames', () => {
    const s = make()
    s.update([price])
    now += 2001
    s.expire()
    expect(ids(s)).toEqual([])
  })
})
