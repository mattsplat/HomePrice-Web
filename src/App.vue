<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import ConverterScreen from './components/ConverterScreen.vue'
import ScannerScreen from './components/ScannerScreen.vue'
import { converter } from './converter'
import { language } from './i18n'

// The scanner lives at #scan, so the phone's back gesture returns to the converter
const hash = ref(location.hash)
const onHashChange = () => (hash.value = location.hash)
onMounted(() => window.addEventListener('hashchange', onHashChange))
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))

// Opened from the converter: going back pops that history entry. Opened from a link: replace it.
let openedInApp = false
function openScanner() {
  openedInApp = true
  location.hash = 'scan'
}
function closeScanner() {
  if (openedInApp) {
    history.back()
  } else {
    history.replaceState(null, '', location.pathname + location.search)
    hash.value = ''
  }
  openedInApp = false
}

// Both screens can change the pair; refresh rates whichever one did
onMounted(converter.refresh)
watch(() => [converter.state.from, converter.state.to], converter.refresh)
watchEffect(() => (document.documentElement.lang = language.value))
</script>

<template>
  <ScannerScreen v-if="hash === '#scan'" @close="closeScanner" />
  <ConverterScreen v-else @scan="openScanner" />
</template>
