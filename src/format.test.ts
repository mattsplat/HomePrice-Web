// Mirrors the Android app's FormattingTest.kt
import { describe, expect, it } from 'vitest'
import { currencyName, formatMoney, formatUpdatedAt } from './format'

// Intl formats some locales with non-breaking spaces; compare with plain spaces
const plain = (text: string) => text.replace(/[  ]/g, ' ')

describe('formatMoney', () => {
  it("follows the user's language", () => {
    expect(formatMoney(12.634, 'CAD', 'en-US')).toBe('CA$12.63')
    expect(plain(formatMoney(12.634, 'EUR', 'de-DE'))).toBe('12,63 €')
    expect(plain(formatMoney(1299.5, 'EUR', 'fr-FR'))).toBe('1 299,50 €')
  })

  it("uses the currency's decimals, not the language's", () => {
    expect(formatMoney(1180, 'JPY', 'en-US')).toBe('¥1,180')
    // Japanese locale defaults to no decimals; Canadian dollars still need cents
    expect(formatMoney(12.634, 'CAD', 'ja-JP')).toBe('CA$12.63')
  })

  it('can ask for more decimals for exchange rates', () => {
    expect(formatMoney(1.40543, 'CAD', 'en-US', 4)).toBe('CA$1.4054')
  })

  it("falls back to the code when it isn't a valid ISO code", () => {
    expect(formatMoney(3.5, 'XX', 'en-US')).toBe('3.50 XX')
  })
})

describe('currencyName', () => {
  it('is translated, with the catalog name as fallback', () => {
    expect(currencyName({ code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' }, 'de-DE')).toBe('Kanadischer Dollar')
    expect(currencyName({ code: 'EUR', name: 'Euro', symbol: '€' }, 'fr-FR')).toBe('Euro')
    expect(currencyName({ code: 'XQQ', name: 'Made-up Money', symbol: '?' }, 'en-US')).toBe('Made-up Money')
  })
})

describe('formatUpdatedAt', () => {
  it('shows the update time in the local format', () => {
    expect(plain(formatUpdatedAt('Wed, 23 Sep 2026 00:02:31 +0000', 'de-DE', 'UTC'))).toBe('23.09.2026, 00:02')
    expect(formatUpdatedAt('not a date', 'en-US')).toBe('not a date')
  })
})
