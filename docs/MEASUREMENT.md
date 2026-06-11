# What we measure (and why)

We don't track users. We do count aggregate events. That's how we know if the service is working, where it breaks, and whether our nonprofit outreach actually reaches anyone.

One exception we name upfront: visitors who arrive via one of our free nonprofit (Google Ad Grants) ads carry a per-click identifier (`gclid`) in the URL. If such a visitor opts in, we forward that `gclid` to Google Ads when they reach a conversion step, so the ad can be matched to a conversion. The opt-in is a non-blocking prompt shown once on the landing page (dismissing it clears the stored gclid and means no ask again that session), default off and revocable in Settings under "Legal". Nothing is sent without it, and visitors from paid ads are never captured or forwarded at all. On the browser the gclid lives in sessionStorage (tab-scoped) and is never written into our own analytics counters. The full mechanics, including exactly what reaches Google, are below.

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
| Signup | `signup` (fires once when a visitor creates a profile) | Count new profiles, so the funnel has an endpoint |
| Funnel step | `cta_click`, `cinematic_start`, `cinematic_end`, `welcome_shown`, `first_turn`, `figure_selected`, `mode_selected`, `first_reply` | See where new visitors drop off between landing and a first answered conversation, and which figures and modes get picked |
| Intro outcome | `watched` or `skipped` (only on `cinematic_end`) | Learn whether the intro animation gets watched to the end or skipped |
| Dwell bucket | `0` (0 to 5s), `1` (5 to 15s), `2` (15 to 30s), `3` (over 30s), only on `cinematic_end` | See how long the intro holds attention. Only the bucket index is stored, the raw milliseconds never leave the browser |
| Reply outcome | `200` (a first reply arrived) or `error` (the first chat turn failed), only on `first_reply` | Know whether people who send a first message actually get an answer |
| Reply-time bucket | `0` (under 2s), `1` (2 to 5s), `2` (5 to 10s), `3` (10 to 30s), `4` (over 30s), only on `first_reply` | See how long the first answer takes to start. Only the bucket index is stored, the raw milliseconds never leave the browser |
| Conversion event | `start_exploring`, `profile_created`, `mode_selected`, `council_engaged` (fire only for grant-ad visitors who opted in to ad measurement; `start_exploring` is the earliest signal, sent when they accept the on-page consent prompt) | Measure whether Google ad spend reaches real engagement |

The conversion rows are written with the event name, an optional figure id, and a timestamp. The gclid is never part of this analytics write. It goes only to Google Ads, as described below.

The funnel steps are keyless aggregate counts like everything else here. There is no join key between funnel steps: a question like "did the person who saw the intro also chat" is answered by comparing two totals, never by following an individual. Most steps fire at most once per browser tab, deduped by a flag in tab-scoped sessionStorage that is never transmitted, and `first_reply` is one of them. Two steps are plain volume counters instead: `figure_selected` and `mode_selected` count every occurrence, so picking three figures writes three rows. They measure how often something gets picked, not whether it happened, and they keep the same anonymous row shape as every other step. `first_turn`, `figure_selected` and `mode_selected` may carry a figure id and a mode (the same content labels chat events already carry), and `cta_click` carries the sanitized page path. No funnel row ever contains a client id, a gclid, an IP, or a raw duration.

## What we don't count, ever

- **No IP retention in analytics.** Cloudflare derives a 2-letter country code at the edge from the request IP, and the analytics rows store only that code, never the IP. Two operational paths touch the IP outside analytics, and neither feeds the counters: our abuse-protection log stores a salted, one-way SHA-256 hash of the IP (not the IP, and not reversible to it) for 90 days to investigate safety incidents, and the beacon and conversion rate limiters (page views, entries, playback, signup, funnel steps, conversions) hold the plain IP in a short-lived key for up to one hour to stop floods. The IP is never written to the analytics dataset and never joined to any event.
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
- [`workers/llm-proxy/src/utils/analytics.ts`](../workers/llm-proxy/src/utils/analytics.ts): chat, council, summary, session, playback, page, entry, signup, funnel-step, rate-limit events
- [`workers/audio-proxy/src/index.ts`](../workers/audio-proxy/src/index.ts): speech (TTS), transcriptions (STT) events

Country values come from `request.cf.country` (a 2-letter ISO code), never from a stored IP.

Separately, Google Ads click tracking captures a `gclid` URL parameter (only when a visitor arrives via one of our free nonprofit Google Ad Grants ads, never for paid-ad arrivals, which are dropped on arrival) in sessionStorage. The opt-in is requested by a non-blocking prompt on the page, default off, recorded in localStorage (`agc_ad_consent`) and revocable in Settings. If the visitor opts in to ad measurement, our worker relays it to the Google Ads Conversion API when they reach a conversion step. What reaches Google is the `gclid`, a conversion action (mapped from the event, such as `profile_created`), a timestamp, a value, a currency, and an order id (the `gclid` plus the event, which Google uses to de-duplicate). No figure, no country, no message content, no profile, no client id. The `gclid` is a Google-issued click identifier that, in Google's hands, can be linked to a person, so we treat it as personal data. On the browser it lives in sessionStorage (tab-scoped), and it is never written into our analytics dataset. See [`client/src/utils/public/gclidCapture.ts`](../client/src/utils/public/gclidCapture.ts), the on-page consent prompt at [`marketing/src/islands/AdConsentPrompt.tsx`](../marketing/src/islands/AdConsentPrompt.tsx), and [`workers/llm-proxy/src/routes/conversions.ts`](../workers/llm-proxy/src/routes/conversions.ts).

Your privacy posture is what the code does, not what we promise.

## Where the data lives, who sees it

- **Storage:** Cloudflare Analytics Engine, 90-day retention by default
- **Access:** internal operator dashboard at `stats.agoracosmica.org`, gated by Cloudflare Access (only the team can read)
- **Sharing:** the measurement data in this document is never shared with third parties, never sold, and never given to advertisers. The one thing that does leave, only with the visitor's opt-in, is the Google click ID (`gclid`) described above, which we forward to Google Ads for conversion matching. It is not part of the analytics data covered here.

## Related

- [Privacy policy (DE, primary)](https://agoracosmica.org/datenschutz)
- [Compliance docs](COMPLIANCE.md)
- [Security architecture](SECURITY-ARCHITECTURE.md)
