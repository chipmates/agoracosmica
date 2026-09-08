# Security and privacy architecture

This document is for a reader who wants to check what Agora Cosmica does with data before trusting it: which data exists, where each request goes, who processes it, and what the design does not protect. The client and worker claims are verifiable against the AGPL-3.0 source in this repository. The server-side ones (speech servers, edge configuration) are described together with how we verify them.

For vulnerability reporting and the disclosure policy, see [SECURITY.md](../SECURITY.md).

---

## Privacy principle

Your data stays on your device. There are no accounts, no behavioral tracking across sessions, and no conversations on our servers.

The parts of that the code enforces:

- No user accounts, no email collection, no password
- No third-party analytics, no marketing cookies
- Conversation history stays in your browser (IndexedDB, encrypted at rest with AES-256-GCM). Messages travel to the inference provider over TLS to generate a reply, and are stored nowhere along the way
- A bring-your-own API key never transits our servers
- No per-request access logging of request or response content in production

---

## What we collect

| Surface | What | Why |
|---|---|---|
| **Cloudflare strictly-necessary cookies** (`__cf_bm`, `cf_clearance`, `__cflb`) | Bot detection, load balancing | Required for the site to work. Exempt from a cookie banner under ePrivacy Article 5(3). |
| **Per-identity rate-limit counters** (Cloudflare KV, 24h TTL) | An anonymous UUID your browser generates | Free-tier quota enforcement |
| **Per-address rate-limit counters** (Cloudflare KV, 24h for the daily chat ceiling, 1h for session mints) | A salted one-way hash of the address, never the address | Bounds what identity rotation from one machine can buy |
| **Safety screening events** (Cloudflare KV, 90 days) | Event metadata and a salted address hash | Content safety and abuse review |
| **Aggregate event counters** (Cloudflare Analytics Engine, 90 days) | Keyless rows: endpoint, figure, language, country, coarse device class, status, timing bucket | Knowing whether the service works and where it breaks. Every counter is listed in [MEASUREMENT.md](MEASUREMENT.md) |

That table is the whole list. Conversation content, names, email addresses and third-party trackers have no row because none of them is collected.

---

## Subprocessors

Per GDPR Article 28 transparency, the processors that can touch user data are:

| Subprocessor | Purpose | Jurisdiction |
|---|---|---|
| **Cloudflare** | Edge hosting (Pages, Workers), object storage (R2), the bot check (Turnstile), aggregate counters (Analytics Engine) | EU edge, R2 in Western Europe |
| **Nebius** | Free-tier inference: DeepSeek V4 Pro as the primary model, Qwen3-235B as the fallback | United Kingdom (EU adequacy decision) for the primary, Finland for the fallback |
| **Hetzner** | Our own GPU servers for live speech: Qwen3-TTS for English and German, Kokoro selectable for English, faster-whisper for speech-to-text | Germany (Falkenstein, Nürnberg) |
| **OpenRouter** | Gateway for your own key, on that route only | US company. The route is pinned to one model and asks for zero data retention by default |

The recorded catalog is rendered by a third-party speech vendor before release, never with user data, so nothing a visitor does reaches it.

---

## Data flow

The diagram in [the README](../README.md#what-the-code-does-with-your-data) shows the whole shape. The privacy-relevant boundaries:

- **Browser to Cloudflare Workers**: TLS only. A worker sees the request and holds no per-request log of it.
- **Workers to inference**: free-tier chat is forwarded to Nebius without being persisted. Requests on your own key never pass through a worker: the browser calls OpenRouter directly (see the key path below).
- **Workers to R2**: internal Cloudflare network. The audio worker reads recorded audio out of the bucket, and the browser fetches the rest from the media host.
- **Workers to the speech servers**: TLS with two-token edge auth (see edge protections).
- **Your own key**: browser to OpenRouter directly. Our servers never see it.

---

## Cryptographic primitives

| Use | Algorithm | Detail |
|---|---|---|
| **API-key encryption at rest** | AES-256-GCM under a device key | The device key is a non-extractable CryptoKey in IndexedDB. The browser will not hand its bytes back to any script, so a copied database yields ciphertext and nothing that opens it. Records written before September 2026 migrate on first load |
| **History and profile encryption at rest** | AES-256-GCM, key derived with PBKDF2-HMAC-SHA256 | 600,000 iterations, a fresh salt and IV per record, derived from a device secret held in the same browser database. That secret is readable by script on this origin, which is the difference to the key path above |
| **Session tokens** | HMAC-SHA256 JWT | Strict `alg` validation, a UUID subject rather than an address, ten-minute lifetime |
| **Transit** | TLS 1.3 | HSTS with `includeSubDomains` |

If a primitive needs replacing, the migration path is the one the API key already took: write the new form, re-derive on the next visit, drop the legacy read path after a transition window.

---

## The key you bring

When you paste an OpenRouter key:

1. **Validation**: a format check, then one round trip to the provider's model list to see whether the key works.
2. **Encryption**: AES-256-GCM under the non-extractable device key.
3. **Storage**: the encrypted record sits in IndexedDB, and in no other store.
4. **Transit**: browser to OpenRouter directly. Our servers are never on the path.

What we never see: the key, the conversations, the usage.

[THREAT-MODEL.md](THREAT-MODEL.md) takes this apart in detail, including the attacks a non-extractable key does not stop.

---

## Free-tier authentication

Visitors without a key of their own go through our LLM worker:

| Layer | Protection |
|---|---|
| **Cloudflare Turnstile** | A bot check, usually invisible, verified server-side before a token is issued |
| **JWT** | HMAC-SHA256, subject is the browser's UUID, ten-minute lifetime |
| **Rate limiting** | Per identity and per hashed address, KV check-and-increment. KV is eventually consistent, so heavy concurrency can let a request or two past the line, which the code comment in `rateLimit.ts` spells out |
| **Global daily cap** | 15,000 chat requests a day across everyone. The backstop against credential abuse |
| **Spend governor** | A daily inference budget counted from real provider token usage. Above the cap the day finishes on the unmetered fallback model |
| **Content screening** | Safety analysis before the call reaches a model. See [CONTENT-SAFETY.md](CONTENT-SAFETY.md) |
| **Request validation** | At most 100 messages per request and 4,000 characters per message, and the reply is capped at 1,500 output tokens |
| **Server-side prompt assembly** | System prompts are assembled from bundled instructions, never injected from client input |

The quota is keyed to identity so that everyone behind one carrier address keeps their own counter. The per-address ceiling beside it, 300 chat requests a day, is what bounds identity rotation from a single machine.

---

## Edge protections

### Worker layer

- **Cloudflare Workers** terminate TLS, validate tokens, screen content, rate-limit, and proxy.
- **Origin addresses stay hidden** behind Cloudflare. Probing the apex resolves to a Cloudflare edge address.

### Origin layer (speech servers)

- **Two-token edge auth** on the Hetzner nginx: a request must carry both `X-Origin-Verify` (a worker-stamped secret, set per environment) and `X-Admin-Token` (operator only). Anything missing either header is rejected with 401.
- **Plaintext port 8800 is closed.** All traffic is TLS on 443, or TLS inside the worker.
- Together this holds even if a worker bearer token leaks.

### Internal services

- **Cloudflare Access** gates the stats worker endpoints (`/api/query`, `/api/query-batch`). Only authenticated operators can read aggregates.

---

## Data storage

### Client (your browser)

| Data | Encrypted | Your control |
|---|---|---|
| API key | AES-256-GCM under the device key | Delete from settings |
| Conversation history | AES-256-GCM, PBKDF2-derived key | Clear from settings |
| Local profile | AES-256-GCM, PBKDF2-derived key | Cleared with the profile |
| Teaching progress | No | Reset available |
| Voice and language preferences | No | Settings |

### On the server (Cloudflare KV)

| Data | TTL | Purpose |
|---|---|---|
| Rate-limit counters, per identity and per hashed address | 24h, and 1h for the session-mint counter | Quota enforcement |
| Beacon and conversion flood brakes | 1h | Stops a flood on the anonymous counter routes. The only place a plain address appears, and it never reaches analytics |
| Safety screening events | 90 days | Anonymized content moderation review |
| Ad conversion events (event name, optional figure id, timestamp) | 90 days | The operator readout. The click id is never in this record |
| Audio server health snapshot | 2 min | Failover routing, refreshed at most every 15 seconds |

### Recorded content (Cloudflare R2)

Stories, council dialogues, prism dialogues, forewords and figure portraits live in R2 (Western Europe). The browser fetches them from the media host with long cache headers, and the audio worker streams one figure's chapters out of the same bucket when someone downloads them as an archive. No user data in R2.

---

## Zero data retention

A daily cron audit (`zdr-audit.sh` on the GPU servers) verifies that no conversation, audio, or text is kept past its serving window. Recent runs are logged to `/opt/agora/logs/zdr-audit.log`.

---

## Threat model

### What we defend against

| Threat | Mitigation |
|---|---|
| **Jailbreak attempts** | Regex screening in two places: 70 patterns in the browser, the same set plus four for unicode obfuscation at the edge. See [CONTENT-SAFETY.md](CONTENT-SAFETY.md) |
| **Prompt injection** | Server-side prompt assembly, sanitized user input |
| **API key theft** | AES-256-GCM under a non-extractable device key, stored only on the device, sent only to OpenRouter |
| **Rate-limit abuse** | KV check-and-increment, counters per identity and per hashed address, a global daily cap |
| **Direct-to-origin abuse** | Two-token edge auth on the Hetzner nginx |
| **Stats worker exposure** | Cloudflare Access gates `/api/query*` |
| **Content manipulation** | A closed list of 30 figures, a closed list of chapters, a response length cap |
| **Denial of service** | Cloudflare in front of every surface |
| **Data exfiltration** | No personal data collected to exfiltrate |

### What we do not defend against

- **Browser compromise**: a malicious extension reading IndexedDB, malware, interception below TLS. A device-level threat.
- **Device theft.** The data lives on your device. That is the design.
- **Someone sharing their own API key.** That is the key holder's call.
- **Hallucination.** Figure guardrails and factchecks reduce it. Immunity is not something we claim.

---

## Audit posture

The codebase is open source under AGPL-3.0, so anyone can audit it. We have not commissioned an independent third-party security audit and plan to as funding allows.

Until then the posture rests on four things: the [external configuration scans](../SECURITY.md#external-validation) anyone can run against the live site, internal review against OWASP ASVS L2 and the OWASP LLM Top 10, open code review by anyone reading the repository, and the coordinated-disclosure program in [SECURITY.md](../SECURITY.md).

---

## Responsible disclosure

Found a vulnerability? [SECURITY.md](../SECURITY.md) has the policy: a GitHub Security Advisory or an email to `security@chipmates.ai`, acknowledgment within 48 hours, safe harbor for good-faith research.

---

[Back to the README](../README.md)
