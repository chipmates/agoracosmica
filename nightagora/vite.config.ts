import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { forgeWhoami } from './forge/vite-forge-whoami.mjs'
import { naAssets } from './forge/vite-na-assets.mjs'
import { naWingPages } from './forge/vite-na-wing-pages.mjs'
import { LOBBY_TEXT } from './src/content/lobby'
import { readSettings } from './src/wings/way-out'

export default defineConfig({
  server: { port: 5199 },
  plugins: [
    forgeWhoami(),
    naAssets(),
    naWingPages({
      read: readSettings,
      words: { name: LOBBY_TEXT.name.en, line: LOBBY_TEXT.tagline, inside: LOBBY_TEXT.titleInside },
    }),
  ],
  build: {
    target: 'esnext',
    /* THE THREE BENCHES ARE NOT PART OF THE MUSEUM. All are dev and preview
       only: vite's dev server serves any page at the root, and a build
       carries one only when a rig asks, so the bundle a visitor downloads
       never holds the libraries' own inspection pages. */
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...(process.env['NA_SWATCHES'] === '1'
          ? { swatches: resolve(__dirname, 'swatches.html') }
          : {}),
        ...(process.env['NA_MODELS'] === '1'
          ? { models: resolve(__dirname, 'models.html') }
          : {}),
        ...(process.env['NA_PARTS'] === '1'
          ? { parts: resolve(__dirname, 'parts.html') }
          : {}),
      },
    },
  },
})
