import { describe, expect, it } from 'vitest'
import { createConverter, crossRate, parseAmount } from './converter'

const ok = (body: unknown) => (async () => new Response(JSON.stringify(body))) as typeof fetch
const failing = (async () => new Response('', { status: 503 })) as typeof fetch

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
}

const response = { time_last_update_utc: 'Wed, 23 Sep 2026 00:02:31 +0000', rates: { EUR: 0.9, CAD: 1.35 } }

describe('crossRate', () => {
  it('works out any pair from USD-based rates', () => {
    expect(crossRate('EUR', 'CAD', { USD: 1, EUR: 0.9, CAD: 1.35 })).toBeCloseTo(1.5)
    expect(crossRate('JPY', 'JPY', {})).toBe(1)
    expect(crossRate('EUR', 'XXX', { EUR: 0.9 })).toBeNull()
  })
})

describe('parseAmount', () => {
  it('accepts a dot or comma decimal', () => {
    expect(parseAmount('12.5')).toBe(12.5)
    expect(parseAmount('12,5')).toBe(12.5)
    expect(parseAmount('.5')).toBe(0.5)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })
})

describe('createConverter', () => {
  it('converts once rates load, adding USD = 1', async () => {
    const c = createConverter(ok(response), memoryStorage())
    await c.refresh()
    expect(c.state.rates.USD).toBe(1)
    expect(c.rate.value).toBe(0.9)
    c.state.amountInput = '10'
    expect(c.converted.value).toBeCloseTo(9)
    expect(c.state.updatedAt).toBe(response.time_last_update_utc)
  })

  it('shows an error only when no rates have ever loaded', async () => {
    const empty = createConverter(failing, memoryStorage())
    await empty.refresh()
    expect(empty.state.error).toBe(true)

    const storage = memoryStorage()
    await createConverter(ok(response), storage).refresh()
    const cached = createConverter(failing, storage)
    await cached.refresh()
    expect(cached.state.error).toBe(false)
    expect(cached.rate.value).toBe(0.9)
  })

  it('uses cached rates at once when the pair changes', async () => {
    const c = createConverter(ok(response), memoryStorage())
    await c.refresh()
    c.state.to = 'CAD'
    expect(c.rate.value).toBeCloseTo(1.35)
    c.swap()
    expect(c.state.from).toBe('CAD')
    expect(c.rate.value).toBeCloseTo(1 / 1.35)
  })
})
