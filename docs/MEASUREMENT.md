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
| Device type | `mobile`, `desktop`, or `tablet`, a coarse class derived server-side from the User-Agent (never the User-Agent string itself, far too coarse to identify a device) | See whether the mobile experience works as well as desktop, so we fix it if not |
| Playback event | `started` (audio first play), `progress_25`, `progress_50`, `progress_75` (the playhead passed a quarter of the track), `completed` (a track heard to its end, or content marked finished and the gamification star awarded) or `ended` (a track that stopped short) | Distinguish click-and-bail from real consumption (completion-rate funnel), and see where in a track people stop |
| Content type | `story`, `teaching`, `prism`, `council`, `foreword` (closed allowlist; only set on playback events) | Know which content type was started/completed |
| Chapter | `1` to `12`, the chapter of a figure's story the track belongs to, only on story playback events | Rank listening by chapter, not only by figure, so we can tell which chapters hold people and rewrite the ones that don't |
| Listened bucket | `0` (under 15s), `1` (15 to 59s), `2` (1 to 3 min), `3` (3 to 10 min), `4` (10 to 30 min), `5` (30 min or more), only on `completed` and `ended` | See how much of a track actually got heard. The seconds are counted in the browser and never leave it, only the bucket index is stored |
| Duration (ms) | Latency of the request | Find slow paths, fix them |
| Signup | `signup` (fires once when a visitor creates a profile) | Count new profiles, so the funnel has an endpoint |
| Funnel step | `cta_click`, `cinematic_start`, `cinematic_end`, `welcome_shown`, `first_turn`, `figure_selected`, `mode_selected`, `first_reply`, `handoff_shown`, `handoff_taken`, `council_open`, `first_reply_failed`, `chat_depth`, `engaged`, `paid_arrival`, `turnstile_started`, `turnstile_interactive`, `turnstile_solved`, `turnstile_failed`, `turnstile_abandoned`, `turnstile_token_aged`, `ad_consent_shown`, `ad_consent_accepted`, `ad_consent_declined`, `ad_consent_dismissed` | See where new visitors drop off between landing and a first answered conversation, which figures and modes get picked, whether the listen-to-talk handoff card gets taken, how often the council catalog gets opened, how many visits do something rather than only arrive, how many arrive from a paid ad, how often the bot check runs, asks for a tap and gets one, why a first message sometimes gets no answer, how deep conversations go, and how ad visitors answer the consent question |
| Engagement arm | `typed`, `listened` or `both`, only on `engaged` | Tell the two halves of the product apart, listening and talking, and see how often one visit does both |
| Landing flag | `landing` on a pageview that opened the visit, empty on the rest, only on `page` events | Separate real arrivals from clicks deeper into the same site, so bounce rate is measured against the right number |
| Intro outcome | `watched` or `skipped` (only on `cinematic_end`) | Learn whether the intro animation gets watched to the end or skipped |
| Dwell bucket | `0` (0 to 5s), `1` (5 to 15s), `2` (15 to 30s), `3` (over 30s), only on `cinematic_end` | See how long the intro holds attention. Only the bucket index is stored, the raw milliseconds never leave the browser |
| Reply outcome | `200` (a first reply arrived) or `error` (the first chat turn failed), only on `first_reply` | Know whether people who send a first message actually get an answer |
| Reply-time bucket | `0` (under 2s), `1` (2 to 5s), `2` (5 to 10s), `3` (10 to 30s), `4` (over 30s), only on `first_reply` | See how long the first answer takes to start. Only the bucket index is stored, the raw milliseconds never leave the browser |
| Failure reason | `turnstile`, `quota`, `upstream` or `abort`, only on `first_reply_failed` | Tell apart the four ways a typed message can end without an answer, which is the failure we most need to see |
| Depth bucket | `0` (1 turn), `1` (2 to 3), `2` (4 to 9), `3` (10 or more), only on `chat_depth` | See whether conversations go anywhere. Only the bucket index is stored, never the turn count and never a chat id |
| Chat kind | `greeting` (the figure's opening line, which nobody typed), `turn` (a message someone typed) or `prefilled`, only on chat events | Separate the machine half of the conversation count from the human half |
| In-house marker | a single constant, set by hand in one browser we test from | Subtract our own testing from the numbers. It is the same value on every marked row, never an identifier, and never set for a visitor |
| Time-to-answer bucket | `0` (under 1s), `1` (1 to 3s), `2` (3 to 10s), `3` (over 10s), only on `ad_consent_accepted`, `ad_consent_declined` and `ad_consent_dismissed` | Tell a reflex tap on the consent card apart from a read-then-decide, so we know whether the question is being read at all. Only the bucket index is stored, the raw milliseconds never leave the browser |
| Conversion event | `start_exploring`, `profile_created`, `listened`, `dialogue_started`, `conversation_deepened`, `council_engaged` (all of these fire only for grant-ad visitors who opted in to ad measurement, and `start_exploring` is the earliest one, sent when they accept the on-page consent prompt) | Measure whether Google ad spend reaches real engagement |

The conversion rows are written with the event name, an optional figure id, and a timestamp. The gclid is never part of this analytics write. It goes only to Google Ads, as described below.

Three of those events count engagement rather than arrival:

- **Listened** (`listened`): someone played 30 seconds of audio. It counts audio that actually ran, not time spent on the page.
- **Dialogue Started** (`dialogue_started`): someone sent a first message to a figure, so a conversation really began.
- **Conversation Deepened** (`conversation_deepened`): someone sent a third message in the same conversation, past the point of a quick look.

`mode_selected` used to be on this list and is gone. Picking a chapter said nothing about whether anyone stayed, so we no longer count it as a conversion. It remains a funnel step, which is the anonymous counter described below.

The funnel steps are keyless aggregate counts like everything else here. There is no join key between funnel steps: a question like "did the person who saw the intro also chat" is answered by comparing two totals, never by following an individual. Most steps fire at most once per browser tab, deduped by a flag in tab-scoped sessionStorage that is never transmitted, and `first_reply` is one of them. Some steps are plain volume counters instead: `figure_selected`, `mode_selected`, `handoff_shown`, `handoff_taken`, `council_open`, `chat_depth` and the `turnstile_*` steps count every occurrence, so picking three figures writes three rows. They measure how often something gets picked, not whether it happened, and they keep the same anonymous row shape as every other step. `first_turn`, `figure_selected`, `mode_selected`, `handoff_shown` and `handoff_taken` may carry a figure id and a mode (the same content labels chat events already carry, e.g. `story` or `council` on the handoff pair), and `cta_click` plus the four `ad_consent_*` steps carry the sanitized page path. `cta_click` also carries a door name in that same mode slot (for example `council_play` or `lib_prism`), which says which button on the page was pressed. It is a fixed vocabulary of page positions, never anything about the visitor. No funnel row ever contains a client id, a gclid, an IP, or a raw duration.

`engaged` says a visit did something rather than only arriving. It fires at most twice per browser tab. Once when the first of the two things happens, with `typed` or `listened` in the arm slot, and once more if the other one follows, with `both`. Typed means a first message was sent. Listened means two minutes of a story or a teaching were actually heard, or a track passed its first quarter, whichever comes first. Those seconds are counted in the browser's memory while the tab is open, are never written to storage, and never leave as a number. This is not the `listened` conversion described above, which is a Google Ads signal and only exists for grant visitors who opted in. `engaged` is a plain anonymous counter like every other funnel step, and `both` says one visit did two things, nothing more.

The playback events count the same listening from the content side. A track reports that it started, that the playhead passed each quarter, and once that it either finished or stopped short. Only that last event carries the listened bucket, and it is a bucket of time actually heard: the clock runs while the audio is actually playing, screen on or off, and stops when the audio stops. It is kept in the tab's memory, it is never stored, and only the bucket index is sent. Nothing ties one track's rows to another's. A story track also says which chapter it is, the same number the chapter carries on the figure's page, so we can see which of the twelve chapters people stay with. That is a label on the content, never on the listener, and it is the only place a chapter number appears.

`paid_arrival` counts a click from one of our paid ads, which arrive with a `p=1` parameter in the URL. The row holds the step name, the interface language, and the country and device class every row here carries. No path, no figure, no click ID. Paid arrivals never have their click ID captured or forwarded at all, and this counter changes none of that. It exists so paid reach can be read as a number without any of it being attached to a person.

The `landing` flag on a page event says the pageview opened the visit. It is set when the browser reports no referrer, or a referrer from another site, which is a property of that page load and nothing else. Nothing is stored to work it out and nothing is carried from one page load to the next. It lets a real arrival be told apart from a click deeper into the same site, which is what a bounce rate needs in order to mean anything.

`return_visit` counts the homepage forward for returning visitors: a browser that already holds the local consent record gets sent straight into the app instead of reading the marketing homepage again. It fires at most once per tab and the row carries only the step name, the interface language, and the country and device class every row here carries. The recognition itself never leaves the browser: the page reads a local flag and navigates. Adding `?stay=1` to the homepage URL keeps the homepage and stops the forward for that tab.

The `turnstile_*` steps count the bot check that guards free-tier messages. Most of the time it runs invisibly, but it can escalate to a checkbox someone has to tick, and then the message waits on that tap. `turnstile_started` counts every time the check runs at all, which is the denominator that says whether escalation is rare or routine. `turnstile_interactive` counts how often the checkbox is asked for, `turnstile_solved` how often it gets ticked, `turnstile_abandoned` how often the page went away with the check still running (with `interactive` or `pending` in the outcome slot, so a checkbox nobody answered is distinguishable from a widget that never appeared), and `turnstile_failed` how often the check ends without a token, with `error`, `timeout` or `expired` in that same outcome slot. `turnstile_token_aged` is deliberately not one of the failures: a token expires a few minutes after a check has already succeeded, which costs nobody a message, and counting it as a failure made the real failures unreadable. They are plain totals: the step name, the outcome, the interface language, and the country and device class every row here carries. No figure, no path, no click ID, and no key that ties a failed check back to a visit. We count them to know whether the check is quietly eating messages, which is a thing we can only fix if we can see it.

`first_reply_failed` is the same kind of counter for the worst failure we have: someone typed a message and never got an answer. It fires at most once per tab, next to `first_reply` rather than instead of it, and carries one of four reasons in the outcome slot (`turnstile`, `quota`, `upstream`, `abort`). `chat_depth` fires once when a chat is left behind and carries only a bucket (1 turn, 2 to 3, 4 to 9, 10 or more). The turn count is kept in memory while the chat is open, is never written to storage, and never leaves the browser except as that bucket. Neither row carries a chat id, so there is nothing to follow from one chat to the next.

One browser we test from is marked by hand, and its rows carry a single constant that lets us subtract our own testing from the weekly numbers. It is the same string on every marked row, it does not vary, it identifies nothing, and no visitor ever has it set. Without it a handful of internal test sessions can be a sizeable share of a small weekly total and make us read the numbers wrong.

The four `ad_consent_*` steps count the consent question itself: how often it appeared, and how often the answer was yes, no, or ignored. They are plain totals, one per step per tab. The row holds the step name, the sanitized page path the question appeared on, the interface language, the country and device class every row here carries, and on the three answer steps a coarse time-to-answer bucket. Nothing else. No click ID, no figure, and no key that ties a yes or a no back to a visit, the same as everywhere else on this page. The path and the language are in there because the question does not land the same way on a figure page as on the homepage, or in German as in English, and that is what we need to know to write it better. `ad_consent_shown` only counts once the card has been at least half in view for a full second, so the answers get compared against questions someone could actually see.

The time-to-answer bucket is measured in the browser from the moment the card came into view to the moment the button or the X was pressed, and only the bucket index (under 1s, 1 to 3s, 3 to 10s, over 10s) is sent. The raw duration never leaves the browser and no timestamp is stored. It exists to tell one thing apart: a reflex tap that closes the card without reading it, and an answer someone actually thought about. If most answers land under a second, the card is being swatted rather than read, and the fix is the card, not the counting. `ad_consent_shown` carries no bucket, because there is nothing to time yet.

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
