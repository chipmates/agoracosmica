import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  // Load .env files so proxy config can access VITE_AUDIO_API_URL, AUDIO_API_KEY,
  // and AUDIO_ADMIN_TOKEN (edge-auth bypass header — required since 2026-05-02
  // audio hardening, since dev requests don't transit the CF Worker that stamps
  // X-Origin-Verify in production).
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'AUDIO_']);

  // Build the audio-proxy header set once — both Bearer auth (gateway-level)
  // and X-Admin-Token (nginx edge-auth) are server-side only and never reach
  // the client bundle.
  const audioProxyHeaders = {};
  if (env.AUDIO_API_KEY) {
    audioProxyHeaders['Authorization'] = `Bearer ${env.AUDIO_API_KEY}`;
  }
  if (env.AUDIO_ADMIN_TOKEN) {
    audioProxyHeaders['X-Admin-Token'] = env.AUDIO_ADMIN_TOKEN;
  }

  // One-line startup summary so it's obvious whether the token loaded.
  console.log(
    `[vite/audio-proxy] target=${env.VITE_AUDIO_API_URL || 'http://localhost:8800'} ` +
    `bearer=${env.AUDIO_API_KEY ? 'set' : 'MISSING'} ` +
    `adminToken=${env.AUDIO_ADMIN_TOKEN ? `set(${env.AUDIO_ADMIN_TOKEN.length}ch)` : 'MISSING'}`
  );
  if (!env.AUDIO_ADMIN_TOKEN) {
    console.warn(
      '⚠️  AUDIO_ADMIN_TOKEN not set in client/.env.development.local — ' +
      '/v1/audio/* requests will be rejected by nginx edge-auth (500/401). ' +
      'Add AUDIO_ADMIN_TOKEN=<token> to fix.'
    );
  }

  return ({
  plugins: [
    basicSsl(),  // Enable HTTPS for mobile Safari mic access
    react(),
    // Images are pre-processed and served from R2 (see scripts/process-images-for-r2.mjs)
    // vite-imagetools removed — no build-time image processing needed
  ],
  server: {
    port: 5173,
    // Proxy audio API to self-hosted GEX130 (avoids mixed-content + COEP issues)
    proxy: {
      '/v1/audio': {
        target: env.VITE_AUDIO_API_URL || 'http://localhost:8800',
        changeOrigin: true,
        secure: false,
        // Auth headers added server-side (never in client bundle)
        headers: Object.keys(audioProxyHeaders).length > 0 ? audioProxyHeaders : undefined,
        // Verify the proxy is actually attaching the auth headers and surface
        // upstream status — the `headers` option above silently no-ops if the
        // proxy receives the request before it's been initialised, and an
        // empty-body 500 from upstream is otherwise indistinguishable from a
        // proxy connection failure.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const hasBearer = !!proxyReq.getHeader('authorization');
            const hasAdmin = !!proxyReq.getHeader('x-admin-token');
            console.log(
              `[vite/audio-proxy] → ${req.method} ${req.url} ` +
              `bearer=${hasBearer ? 'yes' : 'NO'} adminToken=${hasAdmin ? 'yes' : 'NO'}`
            );
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            if (proxyRes.statusCode >= 400) {
              console.warn(
                `[vite/audio-proxy] ← ${proxyRes.statusCode} ${req.method} ${req.url} ` +
                `(content-type=${proxyRes.headers['content-type'] || 'none'})`
              );
              // Capture the response body for debugging — proxy will still
              // forward the original to the client; we just tee it to stderr.
              const chunks = [];
              proxyRes.on('data', (c) => chunks.push(c));
              proxyRes.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                const preview = body.length > 500 ? body.slice(0, 500) + '…' : body;
                console.warn(`[vite/audio-proxy]   body: ${preview}`);
              });
            }
          });
          proxy.on('error', (err, req) => {
            console.error(
              `[vite/audio-proxy] ✗ ${req.method} ${req.url} — ${err.message}`
            );
          });
        },
      },
      // Free-tier LLM proxy (CF Worker) — dev routes
      '/v1/session': {
        target: env.VITE_FREE_TIER_API_URL || 'http://localhost:8788',
        changeOrigin: true,
        secure: false
      },
      '/v1/chat': {
        target: env.VITE_FREE_TIER_API_URL || 'http://localhost:8788',
        changeOrigin: true,
        secure: false
      },
      '/v1/quota': {
        target: env.VITE_FREE_TIER_API_URL || 'http://localhost:8788',
        changeOrigin: true,
        secure: false
      },
      // Custom council endpoint (CF Worker)
      '/v1/council': {
        target: env.VITE_FREE_TIER_API_URL || 'http://localhost:8788',
        changeOrigin: true,
        secure: false
      },
      // Summary endpoint (CF Worker)
      '/v1/summary': {
        target: env.VITE_FREE_TIER_API_URL || 'http://localhost:8788',
        changeOrigin: true,
        secure: false
      },
      // Conversion tracking endpoint (CF Worker)
      '/api/conversions': {
        target: env.VITE_FREE_TIER_API_URL || 'http://localhost:8788',
        changeOrigin: true,
        secure: false
      },
      // R2 content proxy (all content types served from media.agoracosmica.org)
      '/images': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      },
      '/seeds': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      },
      '/instructions': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      },
      '/factchecks': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      },
      '/voice-profiles': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      },
      '/figure-translations': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      },
      '/councils': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      },
      '/stories': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      },
      '/prisms': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      },
      '/initial-messages': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      },
      '/trailers': {
        target: env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
        changeOrigin: true,
        secure: true
      }
    },

    // DEV-ONLY headers (relaxed for Vite HMR)
    // Production security headers configured in Cloudflare (see SECURITY-FIXES.md)
    headers: {
      // COOP/COEP headers for Kokoro TTS and Moonshine STT WASM
      // Required for SharedArrayBuffer in both dev and production
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin'

      // Note: CSP intentionally relaxed in dev to allow Vite HMR inline scripts
      // Strict CSP with 'unsafe-inline' prohibition enforced in production via Cloudflare
    }
  },
  resolve: {
    alias: {
      '@': path.resolve('./src')
      // Removed: Node.js polyfills (path-browserify, os-browserify, buffer, process)
      // These were only needed for local Kokoro TTS (kokoro-js dependency)
      // Cloud audio (DeepInfra) doesn't need Node.js polyfills
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(mode),
    __FF_SESSION_ZUSTAND__: JSON.stringify(env.VITE_FF_SESSION_ZUSTAND ?? 'false'),
    __FF_CONVERSATION_ZUSTAND__: JSON.stringify(env.VITE_FF_CONVERSATION_ZUSTAND ?? 'false'),
    __FF_COUNCIL_ZUSTAND__: JSON.stringify(env.VITE_FF_COUNCIL_ZUSTAND ?? 'false'),
    __FF_UI_ZUSTAND__: JSON.stringify(env.VITE_FF_UI_ZUSTAND ?? 'false'),
    __FF_IDB_STORAGE__: JSON.stringify(env.VITE_FF_IDB_STORAGE ?? 'false'),
  },
  css: {
    modules: {
      localsConvention: 'camelCase'
    }
  },
  build: {
    outDir: 'build',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {}
  },
  // Strip debug-noise console calls from production bundles only.
  // Keeps console.warn / console.error so legitimate runtime errors still
  // surface in users' devtools. Dev server keeps everything.
  esbuild: command === 'build'
    ? { pure: ['console.log', 'console.debug', 'console.info'] }
    : {}
})
})
