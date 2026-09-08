# What we measure (and why)

This page lists every counter Agora Cosmica writes, what each one is for, and what none of them can be turned into. It is written for a reader checking the privacy claims against the code, so each part names the file where the counting happens.

None of it is keyed to a person. The rows are aggregate counts, which is how we know whether the service works, where it breaks, and whether our nonprofit outreach reaches anyone.

One exception, named up front. Visitors who arrive from one of our free nonprofit Google Ad Grants ads carry a per-click identifier (`gclid`) in the URL. If such a visitor opts in, the worker forwards that click id to Google Ads when they reach a conversion step, so the ad can be matched to a conversion. The opt-in is a non-blocking prompt shown once on the landing page, off by default and revocable in Settings under Legal. Dismissing it clears the stored click id and means no second ask that session. Nothing is sent without it, visitors from paid ads never have a click id captured at all, and the click id never enters our own counters. In the browser it lives in sessionStorage, which is tab-scoped. The full mechanics, including exactly what reaches Google, are below.

## What we count

Per anonymous request, written to Cloudflare Analytics Engine:

| Counter | Example values | Why |
|---|---|---|
| Endpoint | `chat`, `council`, `summary`, `session`, `speech`, `transcriptions`, `playback`, `page`, `entry` | See which features are used |
| Path | Sanitized landing path on `page` and `entry` events (`/`, `/de/`, `/figures/<slug>`, ...) | Distinguish home arrivals from deep-link arrivals |
| Figure | `aurelius`, `kahlo`, `rumi`, ... | See which figures resonate |
| Mode | `story`, `wisdom`, `prism`, `quest`, `freetalk`, `council` | See which chapters and formats land |
| Language | `en` or `de` | See bilingual reach |
| HTTP status | `200`, `429`, `502`, ... | Detect outages and rate-limit pressure |
| Country | 2-letter ISO code from Cloudflare edge (`DE`, `US`, `XX` for unknown) | Demonstrate geographic reach to grant funders |
| Device type | `mobile`, `desktop`, or `tablet`, a coarse class derived server-side from the User-Agent (never the User-Agent string itself, far too coarse to identify a device) | See whether the mobile experience works as well as desktop, so we fix it if not |
| Playback event | `started` (audio first play), `progress_25`, `progress_50`, `progress_75` (the playhead passed a quarter of the track), `completed` (a track heard to its end, or content marked finished and the gamification star awarded) or `ended` (a track that stopped short) | Distinguish click-and-bail from real consumption (completion-rate funnel), and see where in a track people stop |
| Content type | `story`, `teaching`, `prism`, `council`, `foreword` (a closed allowlist, only set on playback events) | Know which content type was started or completed |
| Chapter | `1` to `12`, the chapter of a figure's story the track belongs to, only on story playback events | Rank listening by chapter, not only by figure, so we can tell which chapters hold people and rewrite the ones that don't |
| Listened bucket | `0` (under 15s), `1` (15 to 59s), `2` (1 to 3 min), `3` (3 to 10 min), `4` (10 to 30 min), `5` (30 min or more), only on `completed` and `ended` | See how much of a track actually got heard. The seconds are counted in the browser and never leave it, only the bucket index is stored |
| Duration (ms) | Latency of the request | Find slow paths, fix them |
| Signup | `signup` (fires once when a visitor creates a profile) | Count new profiles, so the funnel has an endpoint |
| Funnel step | `cta_click`, `cinematic_start`, `cinematic_end`, `welcome_shown`, `return_visit`, `first_turn`, `first_turn_prefilled`, `figure_selected`, `mode_selected`, `first_reply`, `first_reply_failed`, `chat_depth`, `handoff_shown`, `handoff_taken`, `council_open`, `nav_open`, `engaged`, `paid_arrival`, `ask_listen_shown`, `ask_listen_sent`, `ask_listen_resumed`, `turnstile_started`, `turnstile_interactive`, `turnstile_solved`, `turnstile_failed`, `turnstile_abandoned`, `turnstile_token_aged`, `ad_consent_shown`, `ad_consent_accepted`, `ad_consent_declined`, `ad_consent_dismissed` | See where new visitors drop off between landing and a first answered conversation. Each step is described under the table |
| Engagement arm | `typed`, `listened` or `both`, only on `engaged` | Tell the two halves of the product apart, listening and talking, and see how often one visit does both |
| Landing flag | `landing` on a pageview that opened the visit, empty on the rest, only on `page` events | Separate real arrivals from clicks deeper into the same site, so bounce rate is measured against the right number |
| Intro outcome | `watched` or `skipped` (only on `cinematic_end`) | Learn whether the intro animation gets watched to the end or skipped |
| Dwell bucket | `0` (0 to 5s), `1` (5 to 15s), `2` (15 to 30s), `3` (over 30s), only on `cinematic_end` | See how long the intro holds attention. Only the bucket index is stored, the raw milliseconds never leave the browser |
| Reply outcome | `200` (a first reply arrived) or `error` (the first chat turn failed), only on `first_reply` | Know whether people who send a first message actually get an answer |
| Reply-time bucket | `0` (under 2s), `1` (2 to 5s), `2` (5 to 10s), `3` (10 to 30s), `4` (over 30s), only on `first_reply` | See how long the first answer takes to start. Only the bucket index is stored, the raw milliseconds never leave the browser |
| Failure reason | `turnstile`, `quota`, `upstream` or `abort`, only on `first_reply_failed` | Tell apart the four ways a typed message can end without an answer, which is the failure we most need to see |
| Depth bucket | `0` (1 turn), `1` (2 to 3), `2` (4 to 9), `3` (10 or more), only on `chat_depth` | See whether conversations go anywhere. Only the bucket index is stored, never the turn count and never a chat id |
| Chat kind | `greeting` (the figure's opening line, which nobody typed), `turn` (a message someone typed), `prefilled` (a question carried in from a public page) or `aside` (a question asked while a chapter was paused), only on chat events | Separate the machine half of the conversation count from the human half |
| In-house marker | a single constant, set by hand in one browser we test from | Subtract our own testing from the numbers. It is the same value on every marked row, never an identifier, and never set for a visitor |
| Time-to-answer bucket | `0` (under 1s), `1` (1 to 3s), `2` (3 to 10s), `3` (over 10s), only on `ad_consent_accepted`, `ad_consent_declined` and `ad_consent_dismissed` | Tell a reflex tap on the consent card apart from a read-then-decide, so we know whether the question is being read at all. Only the bucket index is stored, the raw milliseconds never leave the browser |
| Rate-limit event | the endpoint that was capped and the reason: `daily`, `global`, `ip_ceiling`, `council`, `summary`, `conversions` | See when a limit actually bites, so a quota that is too tight shows up as a number instead of as silence |
| Routing event | `soft_alert`, `hard_trip`, `fallback_error`, `fallback_latency`, with the endpoint and the model that answered | Know when the free tier moved to the fallback model and why. The row also carries the day's metered inference spend, a day total that belongs to the service and not to any visitor |
| Conversion event | `start_exploring`, `profile_created`, `listened`, `dialogue_started`, `conversation_deepened`, `council_engaged` (all of these fire only for grant-ad visitors who opted in to ad measurement, and `start_exploring` is the earliest one, sent when they accept the on-page consent prompt) | Measure whether Google ad spend reaches real engagement |

The conversion rows are written with the event name, an optional figure id, and a timestamp. The click id is never part of this analytics write. It goes only to Google Ads, as described below.

Three of those events fire on engagement:

- **Listened** (`listened`): someone played 30 seconds of audio. It counts audio that actually ran, not time spent on the page.
- **Dialogue Started** (`dialogue_started`): someone sent a first message to a figure, so a conversation really began.
- **Conversation Deepened** (`conversation_deepened`): someone sent a third message in the same conversation, past the point of a quick look.

`mode_selected` used to be on this list and is gone. Picking a chapter said nothing about whether anyone stayed, so it no longer counts as a conversion. It remains a funnel step, which is the anonymous counter described below.

### How the funnel steps behave

The funnel steps are keyless aggregate counts like everything else here. There is no join key between them: a question like "did the person who saw the intro also chat" is answered by comparing two totals, never by following an individual.

Most steps fire at most once per browser tab, deduped by a flag in tab-scoped sessionStorage that is never transmitted. `first_reply` is one of them. Some steps are plain volume counters: `figure_selected`, `mode_selected`, `handoff_shown`, `handoff_taken`, `council_open`, `nav_open`, `chat_depth`, the three `ask_listen_*` steps and the `turnstile_*` steps count every occurrence, so picking three figures writes three rows. They measure how often something gets picked, not whether it happened at all, and they keep the same anonymous row shape as every other step.

`first_turn`, `first_turn_prefilled`, `figure_selected`, `mode_selected`, `handoff_shown` and `handoff_taken` may carry a figure id and a content label (the same labels chat events already carry, for example `story` or `council` on the handoff pair). `first_turn_prefilled` is the send whose text came in from a public page, so the two first-send counters split one total and `first_turn` keeps its typed-only meaning. `cta_click` and the four `ad_consent_*` steps carry the sanitized page path, and `cta_click` also carries a door name in the label slot (`council_play` or `lib_prism`, for example), which says which button on the page was pressed. That is a fixed vocabulary of page positions and says nothing about the visitor. `nav_open` counts a way out of a conversation being taken, with the affordance name in the same slot (`carousel_exit` or `history_fresh`, for example), a fixed vocabulary of buttons. No funnel row ever contains a client id, a click id, an address, or a raw duration.

`engaged` marks a visit where something happened: a first message was typed, or a track was really listened to. It fires at most twice per browser tab. Once when the first of the two happens, with `typed` or `listened` in the arm slot, and once more if the other one follows, with `both`. Typed means a first message was sent. Listened means two minutes of a story or a teaching were actually heard, or a track passed its first quarter, whichever comes first. Those seconds are counted in the browser's memory while the tab is open, are never written to storage, and never leave as a number. This is a different thing from the `listened` conversion described above, which is a Google Ads signal and only exists for grant visitors who opted in. `engaged` is a plain anonymous counter like every other funnel step, and `both` says one visit did two things, nothing more.

The playback events count the same listening from the content side. A track reports that it started, that the playhead passed each quarter, and once that it either finished or stopped short. Only that last event carries the listened bucket, and it is a bucket of time actually heard: the clock runs while the audio is playing, screen on or off, and stops when the audio stops. It is kept in the tab's memory, it is never stored, and only the bucket index is sent. Nothing ties one track's rows to another's. A story track also says which chapter it is, the same number the chapter carries on the figure's page, so we can see which of the twelve chapters people stay with. That is a label on the content, never on the listener, and it is the only place a chapter number appears.

`paid_arrival` counts a click from one of our paid ads, which arrive with a `p=1` parameter in the URL. The row holds the step name, the interface language, and the country and device class every row here carries. No path, no figure, no click id. Paid arrivals never have their click id captured or forwarded at all, and this counter changes none of that. It exists so paid reach can be read as a number without any of it being attached to a person.

The `landing` flag on a page event says the pageview opened the visit. It is set when the browser reports no referrer, or a referrer from another site, which is a property of that page load and nothing else. Nothing is stored to work it out and nothing is carried from one page load to the next. It lets a real arrival be told apart from a click deeper into the same site, which is what a bounce rate needs in order to mean anything.

`return_visit` counts the homepage forward for returning visitors: a browser that already holds the local consent record goes straight into the app. It fires at most once per tab and the row carries only the step name, the interface language, and the country and device class every row here carries. The recognition itself never leaves the browser: the page reads a local flag and navigates. Adding `?stay=1` to the homepage URL keeps the homepage and stops the forward for that tab.

The `turnstile_*` steps count the bot check that guards free-tier messages. Most of the time it runs invisibly, but it can escalate to a checkbox someone has to tick, and then the message waits on that tap. `turnstile_started` counts every time the check runs at all, which is the denominator that says whether escalation is rare or routine. `turnstile_interactive` counts how often the checkbox is asked for, and `turnstile_solved` how often it gets ticked. `turnstile_abandoned` counts a page that went away with the check still running, carrying `interactive` or `pending` in the outcome slot, so a checkbox nobody answered is distinguishable from a widget that never appeared. `turnstile_failed` counts a check that ends without a token, with `error`, `timeout` or `expired` in that same slot. `turnstile_token_aged` is deliberately outside the failure family: a token expires a few minutes after a check has already succeeded, which costs nobody a message, and counting it as a failure made the real failures unreadable. They are plain totals: the step name, the outcome, the interface language, and the country and device class every row here carries. No figure, no path, no click id, and no key that ties a failed check back to a visit. We count them to know whether the check is quietly eating messages, which is a thing we can only fix if we can see it.

The three `ask_listen_*` steps count the ask that sits under a paused chapter. `ask_listen_shown` fires when the invitation appears (once per chapter play, so a pause for a sip is not counted twice), `ask_listen_sent` when a question goes out, and `ask_listen_resumed` when the chapter is picked up again after the answer. Each row carries the figure id and `story` in the content slot, the same labels every other step here carries, and nothing about the question itself.

`first_reply_failed` is the same kind of counter for the worst failure we have: someone typed a message and never got an answer. It fires at most once per tab, beside `first_reply` and not in its place, and carries one of four reasons in the outcome slot (`turnstile`, `quota`, `upstream`, `abort`). `chat_depth` fires once when a chat is left behind and carries only a bucket (1 turn, 2 to 3, 4 to 9, 10 or more). The turn count is kept in memory while the chat is open, is never written to storage, and never leaves the browser except as that bucket. Neither row carries a chat id, so there is nothing to follow from one chat to the next.

One browser we test from is marked by hand, and its rows carry a single constant that lets us subtract our own testing from the weekly numbers. It is the same string on every marked row, it does not vary, it identifies nothing, and no visitor ever has it set. Without it a handful of internal test sessions can be a sizeable share of a small weekly total and make us read the numbers wrong.

The four `ad_consent_*` steps count the consent question itself: how often it appeared, and how often the answer was yes, no, or ignored. They are plain totals, one per step per tab. The row holds the step name, the sanitized page path the question appeared on, the interface language, the country and device class every row here carries, and on the three answer steps a coarse time-to-answer bucket. Nothing else. No click id, no figure, and no key that ties a yes or a no back to a visit, the same as everywhere else on this page. The path and the language are in there because the question does not land the same way on a figure page as on the homepage, or in German as in English, and that is what we need to know to write it better. `ad_consent_shown` only counts once the card has been at least half in view for a full second, so the answers get compared against questions someone could actually see.

The time-to-answer bucket is measured in the browser from the moment the card came into view to the moment the button or the X was pressed, and only the bucket index (under 1s, 1 to 3s, 3 to 10s, over 10s) is sent. The raw duration never leaves the browser and no timestamp is stored. It exists to tell one thing apart: a reflex tap that closes the card without reading it, and an answer someone actually thought about. If most answers land under a second, the card is getting swatted, and the fix is the card, not the counting. `ad_consent_shown` carries no bucket, because there is nothing to time yet.

## What never gets counted

- **No IP retention in analytics.** Cloudflare derives a 2-letter country code at the edge from the request IP address, and the analytics rows store only that code. Two operational paths touch the address outside analytics, and neither feeds the counters: our abuse-protection log stores a salted, one-way SHA-256 hash of it (not the address, and not reversible to it) for 90 days to investigate safety incidents, and the beacon and conversion rate limiters (page views, entries, playback, signup, funnel steps, conversions) hold the plain address in a short-lived key for up to one hour to stop floods. The address is never written to the analytics dataset and never joined to any event.
- **No user IDs in analytics.** The free-tier `clientId` is a UUID stored in your browser's localStorage (the server hands one out on first session if none exists). It is used server-side for short-lived rate-limit accounting (24-hour KV TTL) and never written to analytics rows, never combined with figure, chapter, country, source, or any other dimension.
- **No cookies, no fingerprints, no localStorage exfiltration.** Cloudflare sets strictly-necessary bot-detection cookies (`__cf_bm`, `cf_clearance`) at the edge. These are exempt under ePrivacy Article 5(3). We add nothing of our own.
- **No message content, no prompts, no transcriptions.**
- **No cross-session linking.** There is no per-event user dimension. The same person counted twice is two anonymous rows with no key to join them.
- **No third-party trackers.** No Google Analytics, no Meta Pixel, no Mixpanel, no Hotjar, no session replay.

## Why aggregate counting stays anonymous

Aggregate counters of the form `chat events from Germany, last 24h: 47` cannot be reassembled into individual visits. There is no key by which to join across rows.

This sits below the personal-data threshold of GDPR Article 4, read with Recital 26 on anonymous information. The German TDDDG §25 does not apply to the measurement itself: no information is read from or written to your device as part of the counting. Browser localStorage that the app uses for its own functionality (the client id for rate limiting, the language preference, the key encryption) is technically necessary and exempt under §25(2).

The same legal model is used by [Plausible](https://plausible.io/data-policy) and [Umami](https://umami.is), privacy-friendly analytics without consent banners, by design.

## You can audit this

All analytics writes are in:

- [`workers/llm-proxy/src/utils/analytics.ts`](../workers/llm-proxy/src/utils/analytics.ts): chat, council, summary, session, playback, page, entry, signup, funnel-step, routing and rate-limit events
- [`workers/llm-proxy/src/routes/funnel.ts`](../workers/llm-proxy/src/routes/funnel.ts): the server-side allowlist of funnel steps, outcomes and buckets. A step that is not on that list writes no row
- [`workers/audio-proxy/src/index.ts`](../workers/audio-proxy/src/index.ts): speech (TTS) and transcription (STT) events

Country values come from `request.cf.country` (a 2-letter ISO code), never from a stored address.

Separately, Google Ads click tracking captures a `gclid` URL parameter in sessionStorage, only when a visitor arrives from one of our free nonprofit Google Ad Grants ads. Paid-ad arrivals are dropped on arrival. The opt-in is requested by a non-blocking prompt on the page, off by default, recorded in localStorage (`agc_ad_consent`) and revocable in Settings. If the visitor opts in to ad measurement, our worker relays the click id to the Google Ads conversion API when they reach a conversion step. What reaches Google is the `gclid`, a conversion action (mapped from the event, such as `profile_created`), a timestamp, a value, a currency, an order id (the `gclid` plus the event, which Google uses to de-duplicate), and a consent signal that grants ad measurement and denies ad personalization. No figure, no country, no message content, no profile, no client id. The `gclid` is a Google-issued click identifier that, in Google's hands, can be linked to a person, so we treat it as personal data. In the browser it lives in sessionStorage, which is tab-scoped, and it is never written into our analytics dataset. See [`client/src/utils/public/gclidCapture.ts`](../client/src/utils/public/gclidCapture.ts), the on-page consent prompt at [`marketing/src/islands/ArrivalChoice.tsx`](../marketing/src/islands/ArrivalChoice.tsx), and [`workers/llm-proxy/src/routes/conversions.ts`](../workers/llm-proxy/src/routes/conversions.ts).

Your privacy posture is what the code does, which is why every claim on this page names the file that carries it.

## Where the data lives, who sees it

- **Storage:** Cloudflare Analytics Engine, 90-day retention by default. Conversion events also sit in a KV record for 90 days (the event name, an optional figure id, a timestamp, and no click id) so the operator readout can show them.
- **Access:** an internal operator dashboard at `stats.agoracosmica.org`, gated by Cloudflare Access, so only the team can read it.
- **Sharing:** the measurement data in this document is never shared with third parties, never sold, and never given to advertisers. The one thing that does leave, only with the visitor's opt-in, is the Google click id described above, which we forward to Google Ads for conversion matching. It is not part of the analytics data covered here.

## Related

- [Privacy policy (DE, primary)](https://agoracosmica.org/datenschutz)
- [Compliance docs](COMPLIANCE.md)
- [Security architecture](SECURITY-ARCHITECTURE.md)
