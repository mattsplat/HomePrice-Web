import { computed, ref } from 'vue'
import { strings } from './strings'

export type Language = keyof typeof strings
export type StringKey = keyof (typeof strings)['en']

export const languages: { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh-CN', name: '简体中文' },
]

const STORAGE_KEY = 'homeprice.language'

function load(): Language | 'system' {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in strings) return saved as Language
  } catch {
    // Storage blocked (private mode etc.): follow the system
  }
  return 'system'
}

/** The per-app language choice: 'system' follows the browser. */
export const languageSetting = ref<Language | 'system'>(load())

export function setLanguage(value: Language | 'system') {
  languageSetting.value = value
  try {
    if (value === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Not saved; the choice still applies until reload
  }
}

/** The first browser language we have translations for, e.g. "de-AT" → de, "zh-Hans" → zh-CN. */
export function matchLanguage(browserLanguages: readonly string[]): Language {
  for (const tag of browserLanguages) {
    const primary = tag.toLowerCase().split('-')[0]
    const match = languages.find((l) => l.code.toLowerCase().split('-')[0] === primary)
    if (match) return match.code
  }
  return 'en'
}

function browserLanguages(): readonly string[] {
  return typeof navigator === 'undefined' ? [] : navigator.languages
}

export const language = computed<Language>(() =>
  languageSetting.value === 'system' ? matchLanguage(browserLanguages()) : languageSetting.value,
)

/**
 * The locale for numbers and dates. Following the system keeps the browser's full locale
 * (en-GB writes dates differently from en-US); a chosen language uses that language.
 */
export const locale = computed<string>(() =>
  languageSetting.value === 'system' ? (browserLanguages()[0] ?? 'en') : languageSetting.value,
)

export function t(key: StringKey, ...args: string[]): string {
  const text: string = strings[language.value][key]
  return text.replace(/\{(\d)\}/g, (_, n) => args[Number(n)] ?? '')
}
