# Changelog

All notable changes to Agora Cosmica are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Population-level entry funnel counters.** Five new anonymous events (CTA click, intro started, intro finished or skipped with a coarse dwell bucket, consent screen shown, first message sent) light up the dark zone between a page view and a first conversation. Same privacy class as the existing counters: keyless aggregate rows, no join key between steps, timing only as a bucket index, one-shot per tab via sessionStorage. Disclosed in [docs/MEASUREMENT.md](docs/MEASUREMENT.md); the stats dashboard funnel shows the new stages as they receive data.
- **Why Echoes?** The strongest question about the project, putting words in the mouths of real people who cannot consent, now has a public answer in three tiers: a homepage FAQ entry with a longer unfold, a full essay at `/echoes` (German at `/de/echoes`), and a repo mirror in [docs/WHY-ECHOES.md](docs/WHY-ECHOES.md) linked from the README. The Echo note on figure and theme pages and the in-app Echo explainer in Settings link to the essay. The essay's history sections fold on the page so the question and the design answer lead.

- **Keyboard, screen-reader, and no-JavaScript improvements across the landing pages.** A skip-to-content link on every page, a sane heading outline and valid FAQ markup on the homepage, localized language-switcher labels, a keyboard-operable mobile menu, and no-JS fallbacks: the app shell now points back to the open library in both languages and the audio preview buttons carry direct MP3 links.

### Changed

- **Helper popups follow the dialog keyboard contract.** Focus moves in on open, Tab stays inside, Escape closes, and focus returns to the trigger. Before this, the Echo explainer could be opened but not read by keyboard.
- **Public docs and in-app copy aligned with what the code does.** Rate limiting is described as eventually consistent rather than atomic, the BYOK wording everywhere is stored-on-device and sent only to OpenRouter, the settings privacy text names the anonymous en/de label in the aggregate counters, the jailbreak pattern count matches across docs, and the catalog tables say 55 questions rather than 55 themes.
- **German landing copy reads like German.** A native-reader sweep replaced word-for-word transfers from the English source across the homepage, FAQ, About page, theme intros, and figure descriptions. No facts, names, or numbers changed.
- Small avatars (related figures, theme voices, council casts) now request images at their real rendered size, saving roughly 100 KB and more per page on phones.
- **The "What is an Echo?" explainer no longer auto-opens over the figure gallery.** It interrupted the first figure choice and repeated the AI notice every new visitor already confirms in the welcome dialog. It now opens on demand from a button under the gallery and keeps a permanent home in Settings, where it links the full essay.
- **Privacy wording brought back in line with the code.** The consent prompt names the withdrawal path and links the privacy policy directly, the policies describe rate limiting exactly as implemented (the plain IP lives only in a short-lived one-hour key and never enters analytics), withdrawal instructions point at the Settings section by its real name, and the homepage structured data uses the current trust wording. Policy dates unified.
- **Dismissing the consent prompt now also clears the stored click ID.** With no consent surface left in the session, there is nothing the ID could be kept for.
- Cookie policy now lists every ad-related storage key (`agc_paid`, `agc_ad_prompt_dismissed`, `agc_conv_fired_*`) and explains the withdrawal control.

### Fixed

- **The app no longer crashes on a storage-blocked browser.** Five load-bearing paths (the login handoff, the home-page init, the mode selector, the wisdom-map and the sidebar) read storage without a guard, so a browser with localStorage or sessionStorage disabled dropped the whole app to the error screen. Each read now degrades to a sensible default.
- **German podcast links go to the German show.** The site footer hardcoded the English Spotify, YouTube, and Apple Podcasts links on every page; it now picks the show by language.
- The English privacy policy is now listed in the sitemap, the homepages advertise their RSS feed for podcast-directory discovery, and the /echoes essay carries Article structured data to match the theme pages.
- A consent recorded under an older consent version now counts as undecided, so a future change of consent scope re-prompts instead of silently relying on the old record. The same version rule now also guards the grant check itself.
- A seed the user picked is restored again when returning to a figure (a string-versus-number id mismatch silently reset the choice).
- Clear-all-history now removes prism transcripts and legacy-format history it used to leave behind, and a reset of help hints stays reset across reloads.
- The language switcher on the English privacy policy lands on the German policy instead of a 404.

---

## [1.1.3] - 2026-06-08

### Added

- **Landing-page ad-measurement consent.** Visitors who arrive from one of our free nonprofit (Ad Grants) ads see a small, non-blocking consent prompt on the page, default off, with an equally easy decline. Declining or dismissing leaves the full library open and sends nothing.
- **Paid-campaign split.** Visitors from paid ads (a `?p=1` link suffix) never have their click ID captured or forwarded and are not asked for consent. Paid runs on clicks only.

### Changed

- Re-added the `start_exploring` conversion, now gated on the on-page opt-in (it fires when a consenting grant visitor accepts the prompt or clicks a Start Exploring link), not on the bare click ID as before.
- Ad-measurement consent moved from the checkbox in the welcome dialog to the non-blocking on-page prompt, which is now the single place the question is asked.

---

## [1.1.2] - 2026-05-30

Privacy claims brought fully in line with the code. Google Ads conversion tracking now happens only after the visitor opts in, the trust wording is precise, conversation history is encrypted at rest, and the public docs and legal pages say exactly what the code does.

### Added

- **Google-ad-only consent for conversion tracking.** Visitors who arrive from a Google ad see one optional checkbox in the welcome dialog. Nothing reaches Google until they tick it. Everyone else sees no change, and there is no site-wide banner. Settings has a control to withdraw the consent at any time, and the conversion upload now carries a Consent Mode v2 signal.
- **Conversation history is encrypted at rest** in IndexedDB with AES-256-GCM, the same device-key scheme already used for the bring-your-own API key. Existing histories migrate on first launch.
- **AI crawlers explicitly welcomed** in robots.txt. Our claims are meant to be read and verified, by people and by AI assistants.

### Changed

- **Trust badge reworded** from "No User Tracking" to "No tracking cookies, no profiling", which is provable for every visitor (Cloudflare's strictly necessary __cf_bm is the only cookie, and we build no behavioral profile).
- **Privacy framing leads with "your conversations stay in your browser, we never store them"** instead of an unqualified "encrypted" claim, since messages are sent to the AI provider over TLS to generate replies.
- **README, MEASUREMENT, the security docs, and the legal pages** now match the code: the gclid is described as personal data on a consent basis, the click ID is kept out of our analytics, and what reaches Google is listed precisely.

### Removed

- **The diagnostic Google Sheet mirror for conversions**, which was the only place a full click ID was retained without expiry. Conversions still reach Google Ads directly.
- **The "Start Exploring" conversion**, the shallowest signal, which fired on the landing page before consent could be asked.

### Fixed

- The gclid click-ID fragment is no longer written into Cloudflare Analytics Engine.
- The privacy policy no longer calls the gclid "anonymous" or "no personal data", and no longer over-states what is forwarded to Google.

---

## [1.1.1] - 2026-05-27

Local Mode lands. Run the LLM, voice synthesis, and transcription on your own machine, each piece flipping independently. Plus the marketing site migration to Astro for sub-second first paint, plus two companion OSS repos that package the voice servers as standalone projects.

(Version note: v1.1.0 was reserved during the initial tag attempt and could not be reused after rollback. v1.1.1 is the actual launch.)

### Added

- **Local Mode panel with per-service toggles for LLM, TTS, and STT.** Each runs independently, so a BYOK-LLM user can still route voice through local containers. Settings → AI Model → Local Mode. The LLM toggle routes to any OpenAI-compatible endpoint (LM Studio, Ollama, vLLM, llama.cpp). The TTS toggle routes to local Kokoro (EN) and Qwen3-TTS (DE). The STT toggle routes to local Whisper. With all three on plus a local LLM, your conversation stays on your machine.
- **Docker sibling containers for Local Mode audio.** `tts-kokoro` (English TTS, ~3.3 GB CPU image), `stt-whisper` (Whisper transcription, ~600 MB image plus model cache), `tts-qwen-cuda` (German TTS, NVIDIA-only, behind the `nvidia` compose profile). Single `docker compose up -d` brings up app + Kokoro + Whisper.
- **Apple Silicon native Qwen3-TTS via MLX.** `scripts/setup-local-tts-apple.sh` installs a FastAPI wrapper around `mlx-audio` that runs the production-equivalent Qwen3-TTS model natively on M-series Macs. Real-time factor 0.92x, peak memory 5.7 GB, voice-clones all 10 production archetype voices. Cold first-synth 1.3s with pre-cached transcripts. Launchd plist starts the server on login.
- **Apple Silicon native Whisper STT via MLX.** `scripts/setup-local-stt-apple.sh` installs a FastAPI wrapper around `mlx-whisper` that runs the same large-v3-turbo model natively on Metal. Short utterances (under 5s) transcribe in ~0.5 seconds vs ~10 seconds on the Docker CPU path. Same model, same quality, ~20× faster on Apple Silicon. The script stops the Docker Whisper container so port 8000 stays consistent and the Local Mode STT toggle keeps working without reconfiguration. Requires ffmpeg on PATH (`brew install ffmpeg`).
- **10 German archetype voices with friendly cosmic names** (Lyra, Astra, Vega, Andromeda, Ceres, Solaris, Umbra, Phoenix, Hyperion, Corvus). Same model as production, voice references hosted on R2 with precomputed speaker embeddings and pre-cached transcripts.
- **Configurable LLM endpoint with reachability probe.** When the LLM toggle is on, conversations route to the configured `baseURL` instead of OpenRouter. The `Test` button does a `/models` reachability check with a 5-second timeout and lists detected models. The `custom-openai` provider kind suppresses OpenRouter-specific request fields (HTTP-Referer, X-Title, the `provider` envelope, the Qwen3-235B-tuned `presence_penalty`) so smaller local models aren't destabilised.
- **Marketing pages migrated to Astro for sub-second first paint.** Figure and theme detail pages, catalogs, about, and contact ship as prerendered static HTML from the sibling `marketing/` Astro project. The hero, journey overview, ideas, and CTA paint within a few hundred milliseconds instead of waiting for the React bundle. React islands handle only the trailer audio button and council preview audio. Catalog and about/contact pages ship zero React JS. The React SPA at `/` and `/de/` continues to handle login plus the post-login app.
- **Legal pages (Impressum, Datenschutzerklärung, Cookie-Richtlinie, Nutzungsbedingungen) now ship as static Astro HTML** with correct canonical URLs, `og:locale=de_DE`, and DE-only language tagging. Replaces orphan prerendered HTML left behind when the old `prerender.mjs` step was removed during the Astro migration. A new `noHreflang` prop on `BaseHead` emits a bare canonical without the `/de/` prefix for pages with no English equivalent.
- **HomePage is now `React.lazy()` so the eager bundle on unauthenticated `/` drops from 374 KB gzipped to 187 KB gzipped.** Visitors landing on the login page no longer download the audio engine, council suite, modals, and post-login app shell until they actually authenticate.
- **Voice essences on R2.** The 10 archetype reference WAVs plus precomputed speaker embeddings move to `media.agoracosmica.org/voices/<slug>/...`. The local Qwen TTS container fetches them at startup and caches them. Same content/code separation as the council masters that landed in v1.0.1.
- **Council master prompts load from the media CDN.** `services/council/generator.ts` fetches `council_advisory_master.json` and `council_debate_master.json` from `${mediaBaseUrl}/instructions/...` instead of a same-origin path. Removes the last authored-text leak from the self-host docker image.
- **Voice technology credits on `/about`.** New section names the upstream projects we use (Qwen3-TTS, F5-TTS by SWivid et al., the hvoss-techfak German fine-tuning, Kokoro by hexgrad, faster-whisper via Speaches) with their licenses.
- **MP3 transcoding in the MLX TTS server.** iOS Safari plays MP3 reliably via HTML5 audio while WAV from blob URLs is flaky. The MLX server now transcodes via ffmpeg on request, with a clear 503 if ffmpeg isn't on PATH. Unblocks LAN-deployed Apple Silicon homelabs serving iOS clients.
- **Companion OSS repo.** [`chipmates/f5-server`](https://github.com/chipmates/f5-server) packages our production F5-TTS deployment as a standalone OpenAI-compatible service (MIT code, bring-your-own-checkpoint).

### Changed

- **Whisper STT default switches to `deepdml/faster-whisper-large-v3-turbo-ct2`.** ~1.5 GB vs large-v3's 3 GB, ~5x faster on CPU, sub-1% WER cost on standard benchmarks. Makes the BYOK-LLM-plus-local-voice tier viable on laptops without a GPU. CUDA users can override via `WHISPER__MODEL=Systran/faster-whisper-large-v3`.
- **Kokoro EN TTS default switches to the CPU image.** `kokoro-fastapi-cpu` at ~3.3 GB instead of `kokoro-fastapi-gpu` at 13.6 GB. The GPU variant fell back to CPU at runtime on Apple Silicon anyway because Docker on macOS has no Metal passthrough. NVIDIA users opt back into the GPU variant via a downstream Dockerfile override.
- **Whisper STT pre-pulls the configured model at container start.** New `entrypoint.sh` downloads `$WHISPER__MODEL` into the HF cache before the server boots, so the first transcription doesn't 404 with "model not installed". A named docker volume (`whisper-cache`) keeps the download across `docker compose down/up`.
- **Client build chain also builds the sibling Astro project.** `pnpm build` in `client/` runs Vite, then installs and builds `marketing/`, then merges `marketing/dist/` into `client/build/`. CF Pages still deploys from the same `client/build/` output.
- **Hero image preload on figure pages uses responsive `imagesrcset`** so mobile devices fetch the correct 640px thumbnail instead of the desktop 1200px portrait.
- **`<think>...</think>` blocks stripped from every LLM response, not just council parser output.** Streaming filter and non-streaming summary share a util (`utils/thinkingTagStripper.ts`). Thinking-capable models (Qwen3, DeepSeek-R1 distills, QwQ) no longer leak scratchpad into the visible chat or summary.
- **`docker-publish.yml` becomes a matrix workflow** that builds four images on every `v*` tag (app, Kokoro, Whisper, Qwen). Each image gets SBOM, provenance, and a Trivy scan.
- **Sitemap `lastmod` sourced per-URL from `git log`** of the relevant content files instead of a single build-date stamp, so crawlers can prioritize re-crawl of pages that actually changed.
- **Trailing-slash canonical redirects extended** to `/datenschutz/`, `/cookie-policy/`, and `/nutzungsbedingungen/`, matching the convention already in place for `/figures/` and `/themes/`.

### Fixed

- **Story mode no longer breaks on strict chat templates.** `mergeConsecutiveSameRole()` in `llmService.ts` joins consecutive same-role messages with `\n\n` before sending. Strict templates (Qwen 3.6 Smoffyy revised, most production-grade) require user/assistant alternation. Lenient templates (OpenRouter, OpenAI proxy) tolerated the multi-assistant pattern but local LLMs would error out. Generic normalization, no provider branching.
- **SSE parser tolerates non-stream JSON error payloads.** Streaming responses that come back as a single JSON error envelope (no `choices` array) no longer crash with `TypeError: Cannot read properties of undefined`. Explicit `data.error` check plus optional chaining on the choices access.
- **Whisper Dockerfile base image tag corrected** from the non-existent `:latest` to `:latest-cpu`. The previous tag caused `docker build` to fail with "manifest unknown" on every host.
- **Whisper compute type changed from `int8_float16` to `int8`.** The former is CUDA-only and crashed at first transcription on CPU and Apple Silicon. No performance regression for the single-user case.
- **CORS headers on the Whisper container** (`ALLOW_ORIGINS` env var, default `["*"]`). Browser-direct calls from the Local Mode panel or LAN-deployment patterns no longer get blocked.
- **CORS headers on the Qwen TTS container** (`CORS_ALLOW_ORIGINS` env var, default `*`). Mirrors the Whisper fix.
- **MLX server runs all inference on a dedicated single-worker thread.** mlx-audio uses per-thread stream/device contexts, so FastAPI's default sync-handler thread pool yielded `RuntimeError: There is no Stream(gpu, 0) in current thread.` Fixed with a `ThreadPoolExecutor(max_workers=1)` that owns the model and handles every synth call.
- **Sitemap no longer emits orphan hreflang pairs for German-only legal pages.** Cookie Policy and Nutzungsbedingungen previously appeared with `en` / `de` / `x-default` annotations pointing to non-existent `/de/cookie-policy/` and `/de/nutzungsbedingungen/` URLs. Now grouped with Impressum and Datenschutz as DE-only legal paths.

### Security

- **CSP `connect-src` and `media-src` allow `http://localhost:*` and `http://127.0.0.1:*`.** Browsers treat localhost as a secure context so the HTTP-on-HTTPS-page mixed-content case doesn't apply. Lets the app reach a local LLM and audio stack without weakening the rest of the CSP.
- **Local Mode keeps your conversation on your machine.** With all three toggles on and the LLM pointed at your own endpoint, anything you type, say, or hear stays on your hardware. The browser still fetches catalog content (figure prompts, voice profiles, pre-recorded audio) from `media.agoracosmica.org` on demand, same as visiting the public site. No analytics, no audio gateway, no LLM proxy.

### Removed

- **`client/scripts/prerender.mjs` and `client/src/{components,pages,routes}/public/` directories.** Replaced by the Astro project under `marketing/`. The React app no longer renders the public marketing surface.

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
- No tracking cookies, no third-party analytics, no per-request server logs.
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
