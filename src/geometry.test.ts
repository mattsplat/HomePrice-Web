// Mirrors the Android app's AimBoxTest.kt and ConversionLabelTest.kt
import { describe, expect, it } from 'vitest'
import { aimBoxRect, center, contains, height, labelPosition, width } from './geometry'

describe('aimBoxRect', () => {
  it('is centered and wider than tall on a portrait screen', () => {
    const box = aimBoxRect(1000, 2000)
    expect(center(box)).toEqual({ x: 500, y: 1000 })
    expect(width(box)).toBeCloseTo(850)
    expect(height(box)).toBeCloseTo(467.5)
  })

  it('caps the height on a landscape screen', () => {
    const box = aimBoxRect(2000, 1000)
    expect(height(box)).toBeCloseTo(400)
    expect(box.top >= 0 && box.bottom <= 1000).toBe(true)
  })

  it('leaves numbers near the screen edges outside', () => {
    const box = aimBoxRect(1000, 2000)
    expect(contains(box, { x: 500, y: 1000 })).toBe(true)
    expect(contains(box, { x: 500, y: 200 })).toBe(false)
    expect(contains(box, { x: 20, y: 1000 })).toBe(false)
  })
})

describe('labelPosition', () => {
  const screen = { width: 1000, height: 2000 }
  const label = { width: 300, height: 120 }
  const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom })

  it('sits centered above the price', () => {
    expect(labelPosition(rect(400, 900, 600, 960), label, screen, 30, 10)).toEqual({ x: 350, y: 770 })
  })

  it('drops below the price when there is no room above', () => {
    expect(labelPosition(rect(400, 50, 600, 110), label, screen, 30, 10)).toEqual({ x: 350, y: 120 })
  })

  it('is pushed back on screen near the edges', () => {
    expect(labelPosition(rect(900, 900, 990, 960), label, screen, 30, 10).x).toBe(670)
    expect(labelPosition(rect(0, 900, 60, 960), label, screen, 30, 10).x).toBe(30)
  })
})
