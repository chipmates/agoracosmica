// @ts-check
// Astro config for the public marketing pages (figure pages, theme pages,
// about, contact, catalog, legal). Static output, React islands for the few
// interactive bits (trailer audio, sticky CTA, council audio preview). The
// React SPA at / and /de/ is a separate build (../client) — neither side
// touches the other's source tree.
//
// Trailing-slash convention matches CF Pages: /foo redirects 308 → /foo/.
// build.format: 'directory' emits /foo/index.html so the URL hit is a single
// hop. Mirrors the prerender.mjs convention this project replaces.

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://agoracosmica.org',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    react(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', de: 'de' },
      },
    }),
  ],
  // Dev-only proxy. publicMediaUrl returns relative paths in dev (assuming
  // the host bundler proxies /images, /trailers, etc. to media.agoracosmica.org).
  // Astro's dev server doesn't know about that arrangement, so without these
  // rules figure portraits and trailer audio 404 against localhost:4321.
  //
  // /fonts/* needs to forward to the production site (client's CF Pages
  // deploy) because the font files live in client/public/fonts and aren't
  // copied into marketing/. In production both worlds share a build output.
  vite: {
    server: {
      proxy: {
        '/fonts': { target: 'https://agoracosmica.org', changeOrigin: true, secure: true },
        '/images': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
        '/trailers': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
        '/stories': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
        '/seeds': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
        '/instructions': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
        '/voice-profiles': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
        '/councils': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
      },
    },
  },
});
