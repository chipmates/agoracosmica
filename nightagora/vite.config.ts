import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { forgeWhoami } from './forge/vite-forge-whoami.mjs'
import { naAssets } from './forge/vite-na-assets.mjs'

export default defineConfig({
  server: { port: 5199 },
  plugins: [forgeWhoami(), naAssets()],
  build: {
    target: 'esnext',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html') } },
  },
})
