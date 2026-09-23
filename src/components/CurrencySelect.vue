<script setup lang="ts">
import { allCurrencies, favorites, type Currency } from '../data/currencies'
import { currencyName } from '../format'
import { locale, t } from '../i18n'

// compact: shows just the code, with the full native picker opening on tap (scanner top bar)
defineProps<{ label: string; compact?: boolean }>()
const selected = defineModel<string>({ required: true })

/** "$ USD - US Dollar", with the name in the user's language. */
const optionLabel = (c: Currency) => `${c.symbol} ${c.code} - ${currencyName(c, locale.value)}`
</script>

<template>
  <label
    :class="
      compact ? 'relative inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-stone-500/15' : 'flex flex-col gap-1'
    "
  >
    <template v-if="compact">
      <span class="text-lg font-bold">{{ selected }}</span>
      <svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z" /></svg>
    </template>
    <span v-else class="text-sm font-medium">{{ label }}</span>
    <select
      v-model="selected"
      :aria-label="compact ? label : undefined"
      :class="
        compact
          ? 'absolute inset-0 cursor-pointer opacity-0'
          : 'w-full rounded-lg border border-stone-400 bg-white px-3 py-3 text-base text-stone-900 focus:border-primary focus:outline-2 focus:outline-primary dark:border-stone-500 dark:bg-stone-800 dark:text-stone-100 dark:focus:border-primary-dark dark:focus:outline-primary-dark'
      "
    >
      <optgroup :label="t('currency_favorites')">
        <option v-for="c in favorites" :key="c.code" :value="c.code">{{ optionLabel(c) }}</option>
      </optgroup>
      <optgroup :label="t('currency_all')">
        <option v-for="c in allCurrencies" :key="c.code" :value="c.code">{{ optionLabel(c) }}</option>
      </optgroup>
    </select>
  </label>
</template>
