import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  server: { port: 5199 },
  build: {
    target: 'esnext',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html') } },
  },
})
