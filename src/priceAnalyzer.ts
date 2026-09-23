// Port of the Android app's analyzer/PriceAnalyzer.kt. Keep the two in step.
import { center, contains, height, inflate, overlaps, union, width, type Rect } from './geometry'

export interface DetectedPrice {
  value: number
  bounds: Rect // In screen pixels
  id: string
}

/** Groups detections by value and approximate location, so the same price keeps its id across frames. */
export function detectedPrice(value: number, bounds: Rect): DetectedPrice {
  const c = center(bounds)
  return { value, bounds, id: `${value}_${Math.trunc(c.x / 50)}_${Math.trunc(c.y / 50)}` }
}

/** One recognized line of text, independent of the OCR engine. */
export interface OcrLine {
  bounds: Rect
  words: { text: string; bounds: Rect; symbols: Rect[] }[]
}

interface PriceMatch {
  value: number
  start: number
  end: number // Exclusive
}

// Matches any number, with or without a currency symbol next to it.
// e.g. "¥5, 000" captures "5, 000", "12.99 €" captures "12.99", "450" captures "450".
// A space before exactly two digits counts as a decimal point OCR missed: "2 99" captures "2 99".
const PRICE_REGEX = /(?<!\d)(\d{1,3}(?:[.,\s]+\d{3})*(?:[.,]\d{1,2}|\s\d{2}(?!\d))?|\d+)(?!\d)/g

// Dates like "11-26-24" or "11/26/2024" (same separator twice, so "2/6.00" is not a date)
const DATE_REGEX = /(?<!\d)\d{1,2}([-/])\d{1,2}\1\d{2,4}(?!\d)/g

// Units and unit prices right after the number: "10 OZ", "37.9¢", "2L", "500 ml", "PER OUNCE"
const UNIT_SUFFIX_REGEX = /^\s*(?:¢|c\b|oz\b|lbs?\b|kg\b|g\b|ml\b|l\b|per\b|%)/i

const CURRENCY_SYMBOLS = '¥$£€₹₽₩'

// UPC/JAN/SKU codes are long runs of digits with no separators
const MIN_CODE_DIGITS = 7

// Tag boxes can be a little tight around the edge digits
const TAG_MARGIN_PX = 16

/** Returns candidate prices with bounds covering just the number's words. */
export function detectPrices(lines: OcrLine[]): DetectedPrice[] {
  return lines.flatMap((line) => {
    // Rebuild the line from its words so restored decimal points keep each word's position in sync
    let start = 0
    const words = line.words.map((word) => {
      const text = restoreDecimalPoint(word.text, word.symbols)
      const w = { text, start, end: start + text.length, bounds: word.bounds }
      start += text.length + 1
      return w
    })
    const lineText = words.map((w) => w.text).join(' ')

    return findPriceCandidates(lineText).map((match) => {
      const boxes = words.filter((w) => w.start < match.end && w.end > match.start).map((w) => w.bounds)
      const bounds = boxes.length === 0 ? line.bounds : boxes.reduce(union)
      return detectedPrice(match.value, bounds)
    })
  })
}

/** Puts back a decimal point OCR dropped, e.g. a tiny dot on an e-ink tag read as "299" instead of "2.99". */
function restoreDecimalPoint(text: string, symbols: Rect[]): string {
  if (text.length < 3 || text.length > 4 || !/^\d+$/.test(text)) return text
  if (symbols.length !== text.length || !hasHiddenDecimalBeforeCents(symbols)) return text
  return `${text.slice(0, -2)}.${text.slice(-2)}`
}

/** Looks at the digit boxes of a number for signs that the last two digits are cents. */
export function hasHiddenDecimalBeforeCents(digitBoxes: Rect[]): boolean {
  if (digitBoxes.length < 3) return false
  const cents = digitBoxes.slice(-2)
  const units = digitBoxes.slice(0, -2)

  // Superscript cents are noticeably shorter than the main digits: "2⁹⁹"
  if (Math.max(...cents.map(height)) < Math.max(...units.map(height)) * 0.75) return true

  // A skipped dot leaves a wider gap before the cents than between the other digits
  const gaps = digitBoxes.slice(1).map((b, i) => b.left - digitBoxes[i]!.right)
  const centsGapIndex = gaps.length - 2
  const widestOtherGap = Math.max(0, ...gaps.filter((_, i) => i !== centsGapIndex))
  const digitWidth = digitBoxes.reduce((sum, b) => sum + width(b), 0) / digitBoxes.length
  return gaps[centsGapIndex]! > widestOtherGap + digitWidth * 0.3
}

/**
 * Keeps the prices the user is aiming at. When tags were detected in the aim box, only
 * prices inside those tags count; otherwise the aim box alone decides. With
 * [largestPerTag], keeps just the tallest number in each tag (or in the box, without
 * tags), which is usually the headline price.
 */
export function selectPrices(
  prices: DetectedPrice[],
  aimBox: Rect,
  tags: Rect[],
  largestPerTag: boolean,
): DetectedPrice[] {
  const inBox = prices.filter((p) => contains(aimBox, center(p.bounds)))
  const tagsInBox = tags.filter((t) => overlaps(t, aimBox)).map((t) => inflate(t, TAG_MARGIN_PX))
  const groups =
    tagsInBox.length === 0 ? [inBox] : tagsInBox.map((tag) => inBox.filter((p) => contains(tag, center(p.bounds))))

  const selected = largestPerTag
    ? groups.flatMap((g) => (g.length ? [g.reduce((a, b) => (height(b.bounds) > height(a.bounds) ? b : a))] : []))
    : groups.flat()
  return selected.filter((p, i) => selected.findIndex((q) => q.id === p.id) === i)
}

export function extractPrices(text: string): number[] {
  return findPriceCandidates(text).map((m) => m.value)
}

function findPriceCandidates(text: string): PriceMatch[] {
  const dateRanges = [...text.matchAll(DATE_REGEX)].map((m) => [m.index, m.index + m[0].length] as const)

  return [...text.matchAll(PRICE_REGEX)].flatMap((match) => {
    const raw = match[0]
    const start = match.index
    const end = start + raw.length
    const isDate = dateRanges.some(([s, e]) => start >= s && start < e)
    const isCode = raw.length >= MIN_CODE_DIGITS && /^\d+$/.test(raw)
    const hasUnit = UNIT_SUFFIX_REGEX.test(text.slice(end))
    // Lone digits like "2 pieces" or "1 pack" are noise unless a symbol marks them as money
    const before = text.slice(0, start).trimEnd()
    const isBareDigit = raw.length === 1 && !(before.length > 0 && CURRENCY_SYMBOLS.includes(before.at(-1)!))

    if (isDate || isCode || hasUnit || isBareDigit) return []
    const value = parsePrice(raw)
    return value === null ? [] : [{ value, start, end }]
  })
}

function parsePrice(raw: string): number | null {
  // A space before exactly two final digits was a missed decimal point: "2 99" -> "2.99"
  // Then remove all other spaces to normalize: "5, 000" -> "5,000"
  const s = raw.replace(/\s+(?=\d{2}$)/, '.').replace(/\s+/g, '')

  const lastSeparator = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'))
  let normalized: string
  if (lastSeparator === -1) {
    normalized = s
  } else if (s.length - lastSeparator - 1 === 3) {
    // Thousands separator: "5,000" or "5.000"
    normalized = s.replace(/[.,]/g, '')
  } else {
    // Decimal separator: "5.99" or "5,99"
    normalized = `${s.slice(0, lastSeparator).replace(/[.,]/g, '')}.${s.slice(lastSeparator + 1)}`
  }
  const value = Number(normalized)
  return normalized === '' || Number.isNaN(value) ? null : value
}
