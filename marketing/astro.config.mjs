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

export default defineConfig({
  site: 'https://agoracosmica.org',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  // Auto-generates SHA-256 hashes for every inline <script> Astro emits
  // (the astro:visible/astro:idle bootstrap blocks and the island runtime)
  // and injects them into a per-page <meta http-equiv="Content-Security-Policy">.
  // This block is the source of truth for the script hashes: the same list in
  // client/public/_headers is derived from it, and both policies AND-enforce,
  // so a hash present in one and missing from the other kills the script in
  // every browser while dev keeps working. Regenerate the derived list with
  // `node scripts/check-csp.mjs --write` from client/; the plain run of that
  // script is a build gate that fails on any inline script the merged policy
  // would block.
  security: {
    csp: {
      // Astro adds a hash per inline <style> it emits, and a hash in the list
      // makes the browser ignore 'unsafe-inline'. So this directive is strict
      // in practice: an inline style has to be hashed or it is blocked, which
      // is why validate-seo.mjs rejects style="" attributes in built HTML.
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'"],
      },
      // Astro only auto-hashes its own emitted scripts, not authored is:inline
      // ones. The homepage pre-paint marker (AgoraHero) must run before first
      // paint, so it stays inline and its hash is added here by hand. If the
      // script text changes, recompute it here:
      //   echo -n '<script text>' | openssl dgst -sha256 -binary | base64
      // then rebuild and run check-csp.mjs --write to carry it to _headers.
      scriptDirective: {
        hashes: ['sha256-i/ofomzmMjJLegES6OLDsJfA4wJAI3UQ8UCNyC3zlcY='],
      },
    },
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  // Sitemap is hand-written by client/scripts/generate-sitemap.mjs
  // (build/sitemap.xml), the single authoritative sitemap robots.txt points
  // to. @astrojs/sitemap removed to avoid a second, conflicting
  // sitemap-index/sitemap-0 pair that would emit / and /de/ with the wrong
  // priority and no x-default hreflang once the homepages exist.
  integrations: [
    react({
      // Static prerender only, so streaming buys nothing. It also bakes NUL
      // bytes into the HTML: react-dom 18's stream renderer flushes its full
      // 2048-byte view, zero padding included, whenever a multibyte character
      // straddles the view boundary (renderToString has no byte views).
      experimentalDisableStreaming: true,
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
        '/prisms': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
        '/seeds': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
        '/instructions': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
        '/voice-profiles': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
        '/councils': { target: 'https://media.agoracosmica.org', changeOrigin: true, secure: true },
      },
    },
  },
});
