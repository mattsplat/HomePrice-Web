import { computed, reactive } from 'vue'

export const RATES_URL = 'https://open.er-api.com/v6/latest/USD'
const STORAGE_KEY = 'homeprice.rates'

interface SavedRates {
  rates: Record<string, number>
  updatedAt: string | null
}

/** Rate(A → B) from USD-based rates: rates[B] / rates[A]. */
export function crossRate(from: string, to: string, rates: Record<string, number>): number | null {
  if (from === to) return 1
  const a = rates[from]
  const b = rates[to]
  if (!a || b === undefined) return null
  return b / a
}

/** "1,5" and "1.5" both mean one and a half; anything else that isn't a number is null. */
export function parseAmount(input: string): number | null {
  const normalized = input.trim().replace(',', '.')
  if (!/^\d*\.?\d+$|^\d+\.$/.test(normalized)) return null
  return Number(normalized)
}

function loadSaved(storage: Storage | undefined): SavedRates {
  try {
    const saved = storage?.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as SavedRates
  } catch {
    // Unreadable or blocked storage: start without a cache
  }
  return { rates: {}, updatedAt: null }
}

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/**
 * The converter's state. Rates are always fetched with USD as the base and kept (also in
 * localStorage, so the installed app works offline); a pair change shows the cached
 * cross-rate at once and refreshes in the background. A failed refresh is silent when a
 * cache exists.
 */
export function createConverter(fetchFn: typeof fetch = (...args) => fetch(...args), storage = defaultStorage()) {
  const saved = loadSaved(storage)
  const state = reactive({
    from: 'USD',
    to: 'EUR',
    amountInput: '1',
    rates: saved.rates,
    updatedAt: saved.updatedAt,
    loading: false,
    error: false,
  })

  const rate = computed(() => crossRate(state.from, state.to, state.rates))
  const reverseRate = computed(() => (rate.value ? 1 / rate.value : null))
  const amount = computed(() => parseAmount(state.amountInput))
  const converted = computed(() =>
    amount.value !== null && rate.value !== null ? amount.value * rate.value : null,
  )

  async function refresh() {
    state.loading = rate.value === null
    state.error = false
    try {
      const response = await fetchFn(RATES_URL)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = (await response.json()) as { rates?: Record<string, number>; time_last_update_utc?: string }
      if (!body.rates) throw new Error('No rates in response')
      state.rates = { USD: 1, ...body.rates }
      state.updatedAt = body.time_last_update_utc ?? null
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify({ rates: state.rates, updatedAt: state.updatedAt }))
      } catch {
        // Quota or blocked storage: the in-memory cache still works
      }
    } catch {
      state.error = Object.keys(state.rates).length === 0
    } finally {
      state.loading = false
    }
  }

  function swap() {
    ;[state.from, state.to] = [state.to, state.from]
  }

  return { state, rate, reverseRate, converted, refresh, swap }
}

export const converter = createConverter()
