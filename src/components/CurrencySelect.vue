<script setup lang="ts">
import { allCurrencies, favorites, type Currency } from '../data/currencies'
import { currencyName } from '../format'
import { locale, t } from '../i18n'

defineProps<{ label: string }>()
const selected = defineModel<string>({ required: true })

/** "$ USD - US Dollar", with the name in the user's language. */
const optionLabel = (c: Currency) => `${c.symbol} ${c.code} - ${currencyName(c, locale.value)}`
</script>

<template>
  <label class="flex flex-col gap-1">
    <span class="text-sm font-medium">{{ label }}</span>
    <select
      v-model="selected"
      class="w-full rounded-lg border border-stone-400 bg-white px-3 py-3 text-base text-stone-900 focus:border-primary focus:outline-2 focus:outline-primary dark:border-stone-500 dark:bg-stone-800 dark:text-stone-100 dark:focus:border-primary-dark dark:focus:outline-primary-dark"
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
