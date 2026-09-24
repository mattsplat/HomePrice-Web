# HomePrice (web)

PWA version of the HomePrice Android app: a currency converter and a camera price tag scanner (Tesseract.js OCR).
The feature spec lives in the Android repo (`docs/feature-spec.md`).

Stack: Vue 3, TypeScript, Vite, Tailwind CSS, vite-plugin-pwa, Vitest.

```sh
npm install
npm run dev      # dev server
npm test         # unit tests
npm run build    # type-check and build to dist/
```

`src/data/currencies.ts` and `src/i18n/strings.ts` are generated from the Android app's
`CurrencyCatalog.kt` and `res/values*/strings.xml`; keep them in step with it.
