import type { Currency } from './data/currencies'

function currencyDigits(code: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
    .maximumFractionDigits ?? 2
}

/**
 * Formats money the way the user's language writes it: "CA$12.63" in English, "12,63 €"
 * in German. Uses the currency's own decimals ("¥1,180", and cents for CAD even in
 * Japanese) unless [decimals] is given, e.g. for exchange rates.
 */
export function formatMoney(value: number, currencyCode: string, locale: string, decimals?: number): string {
  try {
    const digits = decimals ?? currencyDigits(currencyCode)
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value)
  } catch {
    // Not a valid ISO code
    const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${number.format(value)} ${currencyCode}`
  }
}

/** The currency's name in the user's language, falling back to the catalog's English name. */
export function currencyName(currency: Currency, locale: string): string {
  let name: string | undefined
  try {
    name = new Intl.DisplayNames([locale], { type: 'currency', fallback: 'none' }).of(currency.code)
  } catch {
    name = undefined
  }
  if (!name || name === currency.code) return currency.name
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
}

/** Turns the API's "Wed, 23 Sep 2026 00:02:31 +0000" into a local date and time, or returns it unchanged. */
export function formatUpdatedAt(rfc1123: string, locale: string, timeZone?: string): string {
  const time = Date.parse(rfc1123)
  if (Number.isNaN(time)) return rfc1123
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(time)
}
