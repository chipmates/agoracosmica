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
});
