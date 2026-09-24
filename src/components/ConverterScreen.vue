<script setup lang="ts">
import { computed } from 'vue'
import { converter } from '../converter'
import { findCurrency } from '../data/currencies'
import { formatMoney, formatUpdatedAt } from '../format'
import { languages, languageSetting, locale, setLanguage, t, type Language } from '../i18n'
import CurrencySelect from './CurrencySelect.vue'

defineEmits<{ scan: [] }>()

const { state, rate, reverseRate, converted, swap } = converter

const fromSymbol = computed(() => findCurrency(state.from)?.symbol)

/** "$1.00 USD = CA$1.4054 CAD", in the user's number format. */
const rateLine = (from: string, to: string, value: number) =>
  `${formatMoney(1, from, locale.value)} ${from} = ${formatMoney(value, to, locale.value, 4)} ${to}`
</script>

<template>
  <main
    class="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
  >
    <header class="flex items-center justify-between gap-2">
      <h1 class="text-3xl font-normal">HomePrice</h1>
      <select
        :value="languageSetting"
        aria-label="Language"
        class="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
        @change="setLanguage(($event.target as HTMLSelectElement).value as Language | 'system')"
      >
        <option value="system">🌐 Auto</option>
        <option v-for="l in languages" :key="l.code" :value="l.code">{{ l.name }}</option>
      </select>
    </header>

    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-3">
        <CurrencySelect v-model="state.from" :label="t('converter_from')" />
        <CurrencySelect v-model="state.to" :label="t('converter_to')" />
      </div>
      <button
        type="button"
        :aria-label="t('converter_swap')"
        :title="t('converter_swap')"
        class="mb-8 rounded-full p-2 text-primary hover:bg-stone-100 dark:text-primary-dark dark:hover:bg-stone-800"
        @click="swap"
      >
        <!-- Material "swap_vert" -->
        <svg viewBox="0 0 24 24" class="size-8" fill="currentColor" aria-hidden="true">
          <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3 5 6.99h3V14h2V6.99h3L9 3z" />
        </svg>
      </button>
    </div>

    <label class="flex flex-col gap-1">
      <span class="text-sm font-medium">{{ t('converter_amount') }}</span>
      <div
        class="flex items-center rounded-lg border border-stone-400 bg-white px-3 focus-within:border-primary focus-within:outline-2 focus-within:outline-primary dark:border-stone-500 dark:bg-stone-800 dark:focus-within:border-primary-dark dark:focus-within:outline-primary-dark"
      >
        <span v-if="fromSymbol" class="pr-2 text-stone-600 dark:text-stone-300">{{ fromSymbol }}</span>
        <input
          v-model="state.amountInput"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          class="w-full bg-transparent py-3 text-base outline-none"
        />
      </div>
    </label>

    <button
      type="button"
      class="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-white hover:brightness-110 dark:bg-primary-dark dark:text-stone-900"
      @click="$emit('scan')"
    >
      <!-- Material "photo_camera" -->
      <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
        <path
          d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"
        />
      </svg>
      {{ t('converter_scan') }}
    </button>

    <section
      class="flex flex-col gap-2 rounded-xl bg-stone-100 p-4 text-stone-700 dark:bg-stone-800/70 dark:text-stone-200"
      aria-live="polite"
    >
      <p v-if="state.loading">{{ t('converter_loading') }}</p>
      <p v-if="state.error" class="text-red-700 dark:text-red-400">{{ t('converter_error') }}</p>
      <template v-if="rate !== null && reverseRate !== null">
        <p>{{ rateLine(state.from, state.to, rate) }}</p>
        <p>{{ rateLine(state.to, state.from, reverseRate) }}</p>
      </template>
      <p v-if="converted !== null" class="text-4xl break-words text-stone-900 dark:text-stone-50">
        {{ formatMoney(converted, state.to, locale) }} {{ state.to }}
      </p>
      <p v-if="state.updatedAt && state.from !== state.to" class="text-xs">
        {{ t('converter_updated', formatUpdatedAt(state.updatedAt, locale)) }}
      </p>
    </section>

    <p class="text-sm text-stone-600 dark:text-stone-300">{{ t('converter_help') }}</p>
  </main>
</template>
