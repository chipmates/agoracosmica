import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { forgeWhoami } from './forge/vite-forge-whoami.mjs'
import { naAssets } from './forge/vite-na-assets.mjs'

export default defineConfig({
  server: { port: 5199 },
  plugins: [forgeWhoami(), naAssets()],
  build: {
    target: 'esnext',
    /* THE TWO BENCHES ARE NOT PART OF THE MUSEUM. Both are dev and preview
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
      },
    },
  },
})
