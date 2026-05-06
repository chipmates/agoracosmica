# Changelog

All notable changes to Agora Cosmica are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

No changes yet. Post-launch development tracks here.

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

[Unreleased]: https://github.com/chipmates/agoracosmica/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/chipmates/agoracosmica/releases/tag/v1.0.0
