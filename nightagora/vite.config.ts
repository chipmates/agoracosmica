import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { forgeWhoami } from './forge/vite-forge-whoami.mjs'
import { naAssets } from './forge/vite-na-assets.mjs'

export default defineConfig({
  server: { port: 5199 },
  plugins: [forgeWhoami(), naAssets()],
  build: {
    target: 'esnext',
    /* THE SWATCH ROUTE IS NOT PART OF THE MUSEUM. It is dev and preview only:
       vite's dev server serves any page at the root, and a build carries it
       only when a rig asks, so the bundle a visitor downloads never holds
       the library's own inspection page. */
    rollupOptions: {
      input:
        process.env['NA_SWATCHES'] === '1'
          ? {
              main: resolve(__dirname, 'index.html'),
              swatches: resolve(__dirname, 'swatches.html'),
            }
          : { main: resolve(__dirname, 'index.html') },
    },
  },
})
