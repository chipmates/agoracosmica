# Changelog

All notable changes to Agora Cosmica are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- **Council master prompts now load from the media CDN.** `services/council/generator.ts` fetches `council_advisory_master.json` and `council_debate_master.json` from `${mediaBaseUrl}/instructions/...` instead of a same-origin `/assets/instructions/...` path. Matches how figure-specific instructions already load. Removes the last authored-text leak from the self-host docker image.

### Added

- **Docker self-host.** `docker compose up` from the repo root brings up a working instance in five minutes: BYOK chat, all six modes, the full pre-recorded audio catalog, both languages. The image is BYOK-only (no free tier), runs no Cloudflare Workers, and hides live voice and the Community Governance panel cleanly. See [SELF-HOSTING.md](docs/SELF-HOSTING.md).
- **`VITE_SELF_HOST` build flag.** Self-host build path: required BYOK key gate on first run, free-tier UI hidden, LLM routing forced to BYOK, Turnstile skipped, live TTS/STT disabled (pre-recorded audio still works), analytics and ad-attribution beacons silenced, Community Governance panel hidden, copy variants for BYOK setup and voting power that drop the "free tier" framing. The hosted build at agoracosmica.org is unchanged.
- **Runtime configuration layer.** New `src/config/runtime.ts` reads `window.__AGORA_CONFIG__` (written by `/config.js` at container start) → `import.meta.env.VITE_*` → hardcoded default. One published image works for any operator with no rebuild.

### Changed

- **Dockerfile, .dockerignore, nginx.conf.** Multi-stage build (`node:20-alpine` builder → `nginxinc/nginx-unprivileged:1.27-alpine` runtime on port 8080), OCI labels, HEALTHCHECK against `/healthz`, server-scope security headers, `expires`-based cache control, optional `/media` location for same-origin content mirrors.

---

## [1.0.1] - 2026-05-20

Two weeks of polish, analytics groundwork, and the start of self-host plumbing.

### Added

**Marketing analytics**
- Passive page-arrival, entry-transition, and content-completion beacons.
- Started/completed split on the playback beacon.
- Marketing source and country attribution captured from URL params on all landing routes, persisted across sessions.
- /sp shortcut routes for Spotify campaign URLs.
- A/B Spotify shortlinks for Phase 4 attribution.

**Conversion tracking**
- Google Ads conversion forwarding from the llm-proxy worker, wrapped in waitUntil for reliable delivery.
- Profile Creation, Session-over-60s, and Council Engaged events wired into the public funnel.
- Council Engaged scoped to the Grants account via a typed event map.
- Conversion values read from wrangler secrets, not hardcoded.
- Agora Cosmica organization entity added to JSON-LD with sameAs links.

**Figure trailers and learn lines**
- Per-figure trailer audio player on figure detail pages.
- Golden learn line on figure cards, prerender, figure carousel, and wisdom gallery.
- New learn field in the public figure catalog.
- Figure choice carried from public pages into the app, including through the navbar CTA.

**Theme detail rebuild**
- Council hero with cast portraits, theme-accent question bar, and audio preview button.
- Sticky CTA deep-links into the featured debate.
- Per-debate rows are now clickable deep-links into their council.
- Theme catalog cards lead with the question.
- 16 council audio previews (8 EN, 8 DE) hosted on R2.

**Stats dashboard**
- Five-tab restructure with four Marketing sections and funnel charts.
- Conversion panels including Council Engaged.
- Content Consumption section in the Product tab.
- Batch query limit raised from 30 to 64.
- Per-row aggregation so duplicate labels merge.

**Self-host build mode (preview)**
- Build flag and deployment config for BYOK-only, no-Workers builds.
- Onboarding gated behind BYOK key setup.
- Free-tier UI, Community panel, and analytics beacons hidden in self-host builds.
- Turnstile skipped, LLM calls routed through BYOK only.
- Copy variants for BYOK and voting power.

### Changed

**Public pages**
- Figure detail page rebuilt around the editorial template.
- Theme detail page rebuilt; intro essays revised in EN and DE.
- /about and /contact pages revised.
- Public page title enlarged. Navigation now resets scroll to top.

**Login**
- Header restructured with intro copy.
- Attribution trimmed to fit the viewport.

**Polish**
- Menu trigger moved to top-left, long figure names shortened.
- Brand trust line sharpened to "No User Tracking" / "Kein Nutzer-Tracking".
- Custom councils render 5% slower for readability.
- Star Seeds vocabulary and DE mode labels translated.
- Favicon switched to a filled navy disc with gold ring. Mask-icon split off.

**Tooling and code health**
- noUnusedLocals + noUnusedParameters enforced in tsconfig.
- Dead branches, redundant guards, and unused locals removed across client/src.
- streamFilter TransformStream annotated as a CodeQL false positive.
- tsc type-clean: fetchPriority casing, PBKDF2 salt type.
- JWT auto-refresh removed from sessionManager.

### Fixed

- Silent foreword audio on iOS Safari.
- Public page scrolling on iOS Safari.
- Turnstile state stale after bfcache restore and after more than five minutes hidden.
- Turnstile container display reset before re-render.
- Favicon SVG corners filled with navy to stop white compositing.
- Playback and TTS counts filtered so cross-tab totals match.
- noscript hrefs aligned to the canonical trailing-slash form.
- Portrait top anchored so heads survive Chrome's lazy-load crop.
- Seed-name slot reserved when hidden in Freetalk.
- Council audio stops when the player is closed.
- New conversation bubble pushed per user message, with the user-merge branch dropped.
- Two factual errors in theme essays corrected.
- Overview tab index drift and voice metric framing.
- MiniPlayer imageKey fallback chain.
- Per-gender cap removed from custom council figures.
- Build chain fetches CDN content before extracting catalog entries (previously fell back to figure ids as display names on prerendered pages).

### Security

- console.log stripped from production builds.
- CodeQL findings addressed: dead branches, redundant guards, false-positive annotation.

---

## [1.0.0] - 2026-05-06

Initial public release. Live at 07:18 CEST (05:18 UTC).

### Added

**Content**
- 30 historical figures from 2,500 years of human thought, each with a researched voice and 12 wisdom teachings (360 total).
- 360 narrative stories, 360 prism dialogues, 110 multi-figure council debates, all bilingual EN + DE.
- 30 forewords, 30 factcheck sheets, 90 figure instruction sets, 30 voice profiles.

**Six ways to engage**
- Four educational chapters in pedagogical sequence: Story (receive), Wisdom (engage), Prism (connect), Quest (demonstrate).
- Free Talk for open-ended conversation.
- Council for multi-figure debate.

**Live AI conversation**
- BYOK via OpenRouter, encrypted locally with AES-256-GCM, never transits our servers.
- Free tier via Cloudflare Worker proxy to Nebius (Qwen3 235B). 30 messages a day per identity, no signup.
- Per-identity rate limiting (UUID-based, no IP tracking).
- Multi-layer prompt-injection screening, output sanitization with DOMPurify.

**Live audio**
- Self-hosted TTS and STT on 2× Hetzner GEX130 servers in Germany.
- Kokoro (EN), F5 and Qwen3-TTS (DE), Faster-Whisper large-v3 (STT).
- Two-token edge auth on the audio gateway.

**Pre-recorded media**
- 1,660 long-form audio files served from Cloudflare R2 with 1-year immutable edge cache.

**Web platform**
- React 18, TypeScript strict, Vite 7, Zustand, pnpm.
- 90 prerendered SEO pages.
- WCAG 2.2 AA. Lighthouse accessibility 100, SEO 100.
- 470 KB gzipped JS, 97 KB gzipped CSS.

**Privacy and security**
- No tracking cookies, no analytics, no per-request server logs.
- Strict CSP, HSTS with includeSubDomains.
- HMAC-SHA256 JWT with UUID-bound subjects.
- Zero-Data-Retention provider routing on by default for BYOK (configurable in settings).
- SecurityHeaders A+, SSL Labs A+ on four endpoints, Mozilla Observatory A+ (115/100, 10/10 tests), Hardenize clean.

**Compliance**
- GDPR, EU AI Act Article 50, German youth protection (JMStV), DDG §5 Impressum, DDG-conform Datenschutzerklärung listing all four data processors (Cloudflare, Nebius, OpenRouter, Hetzner).

---

[Unreleased]: https://github.com/chipmates/agoracosmica/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/chipmates/agoracosmica/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/chipmates/agoracosmica/releases/tag/v1.0.0
