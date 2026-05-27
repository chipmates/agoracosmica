# What we measure (and why)

We don't track users. We do count aggregate events. That's how we know if the service is working, where it breaks, and whether our nonprofit outreach actually reaches anyone.

One exception we name upfront: visitors who arrive via a Google ad bring a per-click identifier (`gclid`), which we forward to Google for conversion matching. It lives only for the tab's lifetime, is never combined with our analytics, and the full mechanics are detailed below.

This document lists exactly what gets counted, why, and what never does.

## What we count

Per anonymous request, written to Cloudflare Analytics Engine:

| Counter | Example values | Why |
|---|---|---|
| Endpoint | `chat`, `council`, `summary`, `session`, `speech`, `transcriptions`, `playback`, `page`, `entry` | See which features are used |
| Path | Sanitized landing path on `page` and `entry` events (`/`, `/de/`, `/figures/<slug>`, ...) | Distinguish home arrivals from deep-link arrivals |
| Figure | `aurelius`, `kahlo`, `rumi`, ... | See which figures resonate |
| Mode | `story`, `wisdom`, `prism`, `quest`, `freetalk`, `council` | See which chapters land |
| Language | `en` or `de` | See bilingual reach |
| HTTP status | `200`, `429`, `502`, ... | Detect outages and rate-limit pressure |
| Country | 2-letter ISO code from Cloudflare edge (`DE`, `US`, `XX` for unknown) | Demonstrate geographic reach to grant funders |
| Playback event | `started` (audio first play) or `completed` (content marked finished, gamification star awarded) | Distinguish click-and-bail from real consumption (completion-rate funnel) |
| Content type | `story`, `teaching`, `prism`, `council`, `foreword` (closed allowlist; only set on playback events) | Know which content type was started/completed |
| Duration (ms) | Latency of the request | Find slow paths, fix them |

## What we don't count, ever

- **No IP retention.** Cloudflare derives a 2-letter country code at the edge from the request IP; we read and store only the code. The IP itself is used transiently in worker memory for rate-limiting and Turnstile bot-detection, never persisted to disk, never written to analytics.
- **No user IDs in analytics.** The free-tier `clientId` is a UUID stored in your browser's localStorage (the server hands one out on first session if none exists). It is used server-side for short-lived rate-limit accounting (24-hour KV TTL) and never written to analytics rows, never combined with figure/mode/country/source/any other dimension.
- **No cookies, no fingerprints, no localStorage exfiltration.** Cloudflare sets strictly-necessary bot-detection cookies (`__cf_bm`, `cf_clearance`) at the edge. These are exempt under ePrivacy Article 5(3). We add nothing of our own.
- **No message content, no prompts, no transcriptions.**
- **No cross-session linking.** There is no per-event user dimension. The same person counted twice = two anonymous rows with no key to join them.
- **No third-party trackers.** No Google Analytics, no Meta Pixel, no Mixpanel, no Hotjar, no session replay.

## Why this is honest, not a loophole

Aggregate counters of the form `chat events from Germany, last 24h: 47` cannot be reassembled into individual visits. There is no key by which to join across rows.

This sits below the personal-data threshold of DSGVO Art. 4 per Erwägungsgrund 26 (anonymous information). TDDDG §25 doesn't apply to the measurement itself: no information is read from or written to your device as part of the counting. Browser localStorage that the app uses for its own functionality (clientId for rate limiting, language preference, BYOK key encryption) is technically necessary and exempt under §25(2).

The same legal model is used by [Plausible](https://plausible.io/data-policy) and [Umami](https://umami.is), privacy-friendly analytics without consent banners, by design.

## You can audit this

All analytics writes are in:
- [`workers/llm-proxy/src/utils/analytics.ts`](../workers/llm-proxy/src/utils/analytics.ts): chat, council, summary, session, rate-limit events
- [`workers/audio-proxy/src/index.ts`](../workers/audio-proxy/src/index.ts): speech (TTS), transcriptions (STT) events

Country values come from `request.cf.country` (a 2-letter ISO code), never from a stored IP.

Separately, Google Ads click tracking captures a gclid URL parameter (when a visitor arrives via a Google ad) in sessionStorage and relays it server-side only when the visitor creates a profile, so the ad can be matched to a conversion. The gclid is a Google-issued click identifier, not a user identifier, and lives only for the lifetime of the tab. See [`client/src/utils/public/gclidCapture.ts`](../client/src/utils/public/gclidCapture.ts) and [`workers/llm-proxy/src/routes/conversions.ts`](../workers/llm-proxy/src/routes/conversions.ts).

Your privacy posture is what the code does, not what we promise.

## Where the data lives, who sees it

- **Storage:** Cloudflare Analytics Engine, 90-day retention by default
- **Access:** internal operator dashboard at `stats.agoracosmica.org`, gated by Cloudflare Access (only the team can read)
- **Sharing:** never shared with third parties, never sold, never given to advertisers

## Related

- [Privacy policy (DE, primary)](https://agoracosmica.org/datenschutz)
- [Compliance docs](COMPLIANCE.md)
- [Security architecture](SECURITY-ARCHITECTURE.md)
