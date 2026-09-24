// Mirrors the Android app's PriceAnalyzerTest.kt
import { describe, expect, it } from 'vitest'
import type { Rect } from './geometry'
import { detectPrices, detectedPrice, extractPrices, hasHiddenDecimalBeforeCents, selectPrices } from './priceAnalyzer'

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom })

describe('extractPrices', () => {
  it('detects a price without a currency symbol', () => {
    expect(extractPrices('12.99')).toEqual([12.99])
    expect(extractPrices('Price 450')).toEqual([450])
  })

  it('still detects a price with a symbol before or after', () => {
    expect(extractPrices('¥5, 000')).toEqual([5000])
    expect(extractPrices('12.99 €')).toEqual([12.99])
    expect(extractPrices('$3,50')).toEqual([3.5])
  })

  it('ignores barcode and SKU numbers', () => {
    expect(extractPrices('0001111091046')).toEqual([])
    expect(extractPrices('4901234567894')).toEqual([])
  })

  it('ignores sizes and unit prices', () => {
    expect(extractPrices('10 OZ')).toEqual([])
    expect(extractPrices('37.9¢ PER OUNCE')).toEqual([])
    expect(extractPrices('2.0L')).toEqual([])
    expect(extractPrices('500 ml')).toEqual([])
  })

  it('ignores dates', () => {
    expect(extractPrices('11-26-24')).toEqual([])
    expect(extractPrices('11/26/2024')).toEqual([])
  })

  it('ignores lone digits unless marked with a symbol', () => {
    expect(extractPrices('2 1')).toEqual([])
    expect(extractPrices('$5')).toEqual([5])
  })

  it('keeps real prices from a US sale tag', () => {
    expect(extractPrices('KRO LEAFY ROMAINE 37.9¢ PERÖUNCE 3.79')).toEqual([3.79])
    expect(extractPrices('2/6.00')).toEqual([6])
    expect(extractPrices('3.00 each')).toEqual([3])
  })

  it('keeps both yen prices from a Japanese tag', () => {
    expect(extractPrices('498 (538)')).toEqual([498, 538])
  })

  it('treats a space before two digits as a missed decimal point', () => {
    expect(extractPrices('2 99')).toEqual([2.99])
    expect(extractPrices('14 95€')).toEqual([14.95])
  })

  it('still treats a space before three digits as a thousands separator', () => {
    expect(extractPrices('5 000')).toEqual([5000])
  })
})

describe('hasHiddenDecimalBeforeCents', () => {
  const digit = (left: number, h = 80) => rect(left, 80 - h, left + 40, 80)

  it('detects a wide gap before the cents', () => {
    // "2 . 9 9" with the dot missing: 40px digits, 8px normal gaps, 30px gap where the dot was
    expect(hasHiddenDecimalBeforeCents([digit(0), digit(70), digit(118)])).toBe(true)
  })

  it('detects superscript cents', () => {
    expect(hasHiddenDecimalBeforeCents([digit(0), digit(48, 40), digit(96, 40)])).toBe(true)
  })

  it('finds nothing in evenly spaced digits', () => {
    expect(hasHiddenDecimalBeforeCents([digit(0), digit(48), digit(96)])).toBe(false)
  })
})

describe('detectPrices', () => {
  it('restores a dropped decimal point and boxes just the number', () => {
    const digits = [rect(100, 0, 140, 80), rect(170, 0, 210, 80), rect(218, 0, 258, 80)]
    const line = {
      bounds: rect(0, 0, 400, 80),
      words: [
        { text: 'NOW', bounds: rect(0, 0, 90, 80), symbols: [] },
        { text: '299', bounds: rect(100, 0, 258, 80), symbols: digits },
      ],
    }
    expect(detectPrices([line])).toEqual([detectedPrice(2.99, rect(100, 0, 258, 80))])
  })
})

describe('selectPrices', () => {
  const aimBox = rect(0, 0, 1000, 500)
  const tag = rect(100, 100, 400, 300)
  const headline = detectedPrice(8.99, rect(200, 200, 320, 260)) // tall, inside the tag
  const barcodeDigits = detectedPrice(62017, rect(150, 120, 210, 135)) // short, inside the tag
  const outsideTag = detectedPrice(100, rect(600, 100, 660, 140)) // e.g. "100 TABLETS" on the box
  const outsideAimBox = detectedPrice(11.99, rect(200, 700, 300, 760))
  const all = [headline, barcodeDigits, outsideTag, outsideAimBox]

  it('only counts prices inside detected tags when tags are found', () => {
    expect(selectPrices(all, aimBox, [tag], false)).toEqual([headline, barcodeDigits])
  })

  it('falls back to the aim box when no tags are found', () => {
    expect(selectPrices(all, aimBox, [], false)).toEqual([headline, barcodeDigits, outsideTag])
  })

  it('keeps just the headline price with largest per tag', () => {
    expect(selectPrices(all, aimBox, [tag], true)).toEqual([headline])
  })
})
