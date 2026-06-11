# Security & Privacy Architecture

This document explains how Agora Cosmica protects users, what data flows where, and what we explicitly do not defend against. The client and Worker claims are verifiable against the AGPL-3.0 source code in this repository; server-side operational claims (GPU servers, edge configuration) are described together with how we verify them.

For vulnerability reporting and our disclosure policy, see [SECURITY.md](../SECURITY.md).

---

## Privacy principle

Your data stays on your device. We do not require accounts, do not track behavior across sessions, and do not store conversations on our servers.

This is enforced architecturally, not just stated:

- No user accounts, no email collection, no password
- No third-party analytics, no marketing cookies
- Conversation history stays in your browser (IndexedDB, encrypted at rest with AES-256-GCM). Messages are sent to the AI provider over TLS to generate replies, and we never store them
- BYOK API keys never transit our servers
- No per-request access logging of request or response content in production

---

## What we collect (and what we don't)

| Surface | What | Why |
|---------|------|-----|
| **Cloudflare strictly-necessary cookies** (`__cf_bm`, `cf_clearance`, `__cflb`) | Bot detection, load balancing | Required for the site to work. Exempt from cookie banner under ePrivacy Article 5(3). |
| **Per-identity rate-limit counters** (Cloudflare KV, 24h TTL) | Anonymous UUID from your browser | Free-tier quota enforcement |
| **Safety screening events** (Cloudflare KV, 90 days) | Anonymized event metadata only | Content safety and abuse review |
| **No third-party analytics** | (none) | We do not run Google Analytics, Plausible, or any third-party tracker. Our own anonymous aggregate counters are listed in MEASUREMENT.md |
| **No conversation storage** | (none) | Conversations stay in your browser's IndexedDB |
| **No PII** | (none) | We have no email, no name, no IP-tied identity |

---

## Subprocessors

Per GDPR Article 28 transparency, the user-data processors are:

| Subprocessor | Purpose | Jurisdiction |
|--------------|---------|--------------|
| **Cloudflare** | Edge hosting (Pages, Workers), object storage (R2) | EU edge, R2 in Western Europe |
| **Nebius** | Free-tier LLM inference (Qwen3-235B) | Finland (EU) |
| **Hetzner** | Self-hosted TTS and STT GPU servers | Germany (Falkenstein, Nürnberg) |
| **OpenRouter** | BYOK gateway (you choose the downstream provider) | US, ZDR-capable EU providers selectable |

Pre-recorded audio production uses third-party TTS vendors at content-creation time, never with user data.

---

## Data flow

The system architecture is shown in the [README diagram](../README.md#architecture). The privacy-relevant boundaries:

- **Browser ↔ Cloudflare Workers**: TLS only. Workers see the request but hold no per-request log.
- **Workers ↔ LLM backends**: Workers forward chat requests to Nebius (free tier) or to OpenRouter (BYOK, with the user's own key) without persisting them.
- **Workers ↔ R2**: Internal Cloudflare network. Workers issue range-requests to stream pre-recorded audio.
- **Workers ↔ Hetzner**: TLS with two-token edge auth (see § Edge protections).
- **BYOK key path**: The user's OpenRouter API key transits browser → OpenRouter **directly**. Our servers never see it.

---

## Cryptographic primitives

| Use | Algorithm | Detail |
|-----|-----------|--------|
| **API-key encryption at rest** | AES-256-GCM | 96-bit random nonce, GCM authentication tag prevents tampering |
| **Key derivation** | PBKDF2-HMAC-SHA256 | 600,000 iterations on desktop, 100,000 on mobile (battery trade-off) |
| **Session tokens** | HMAC-SHA256 JWT | Strict `alg` validation, UUID-bound subject (not IP-bound), 30-min TTL |
| **Transit** | TLS 1.3 | HSTS with `includeSubDomains` |

If a primitive needs replacing, the migration path is: bump versions, re-derive client-side on next visit, drop legacy support after a transition window.

---

## BYOK security

When a user provides their own OpenRouter API key:

1. **Validation**: format check, then a probe call that lists available models
2. **Encryption**: AES-256-GCM with a device-derived key
3. **Storage**: IndexedDB only. Never localStorage, never cookies.
4. **Transit**: browser → OpenRouter directly. Our servers are never on the path.

What we never see: the key, the conversations, the usage patterns.

---

## Free-tier authentication

Users without an API key use the free tier through our LLM Worker:

| Layer | Protection |
|-------|-----------|
| **Cloudflare Turnstile** | Invisible bot challenge before JWT issuance |
| **JWT** | HMAC-SHA256, **per-identity (UUID-bound, not IP-bound)**, 30-min TTL |
| **Rate limiting** | **Per-identity** (UUID), Cloudflare KV check-and-increment (eventually consistent; worst case lets a couple of extra requests through under heavy concurrency, see the code comment in `rateLimit.ts`) |
| **Global wallet cap** | 15,000 messages daily across all identities. Backstop against credential abuse. |
| **Content screening** | Pre-LLM safety analysis. See [CONTENT-SAFETY.md](CONTENT-SAFETY.md). |
| **Response validation** | Length cap (2,000 tokens), forbidden-pattern matching |
| **Server-side prompt assembly** | System prompts assembled from bundled instructions, never injected from client input |

Per-identity rate limiting (rather than per-IP) is the post-2026-05-02 design. It avoids penalizing CGNAT-shared addresses while preserving free-tier quota fairness.

---

## Edge protections

### Worker layer

- **Cloudflare Workers** terminate TLS, validate JWTs, screen content, rate-limit, and proxy.
- **Origin IPs are hidden** behind Cloudflare. Probing the apex resolves to a Cloudflare edge IP.

### Origin layer (audio servers)

- **Two-token edge auth** on Hetzner nginx: requests must carry **`X-Origin-Verify`** (Worker-stamped secret, set per environment) AND **`X-Admin-Token`** (operator-only). Direct-to-origin requests missing either header are rejected with 401.
- **Plaintext port 8800 is closed.** All traffic is TLS via 443 or TLS-inside-Worker.
- This protects against direct-origin abuse even if a Worker bearer token leaks.

### Internal services

- **Cloudflare Access** policy gates the stats Worker endpoints (`/api/query`, `/api/query-batch`). Only authenticated operators can read aggregates.

---

## Data storage

### Client (your browser)

| Data | Encrypted | User control |
|------|-----------|--------------|
| BYOK API keys | AES-256-GCM | Delete from settings |
| Conversation history | AES-256-GCM | Clear from settings |
| Teaching collection progress | No | Reset available |
| Voice and language preferences | No | Settings |

### Server (Cloudflare KV)

| Data | TTL | Purpose |
|------|-----|---------|
| Rate-limit counters | 24h | Per-identity throttling |
| Safety screening events | 90 days | Anonymized content moderation review |
| Audio server health cache | 5 min | Failover routing |

### Pre-recorded content (Cloudflare R2)

Stories, council dialogues, prism dialogues, forewords, and figure portraits live in R2 (Western Europe) and are served through the media Worker with cache headers. No user data in R2.

---

## Zero Data Retention

A daily cron audit (`zdr-audit.sh` on the GPU servers) verifies that no conversation, audio, or text is persisted server-side beyond its serving window. Recent runs are logged to `/opt/agora/logs/zdr-audit.log`.

---

## Threat model

### What we defend against

| Threat | Mitigation |
|--------|-----------|
| **Jailbreak attempts** | Multi-layer regex screening (~85 patterns, client + server), see [CONTENT-SAFETY.md](CONTENT-SAFETY.md) |
| **Prompt injection** | Server-side prompt assembly, sanitized user input |
| **API key theft** | AES-256-GCM client-side encryption, key stored only on the device and sent only to OpenRouter directly |
| **Rate-limit abuse** | KV check-and-increment, per-identity counters, global wallet cap |
| **Direct-to-origin abuse** | Two-token edge auth on Hetzner nginx |
| **Stats-Worker exposure** | Cloudflare Access policy gates `/api/query*` |
| **Content manipulation** | Figure whitelist (30), chapter whitelist, response length cap |
| **DDoS** | Cloudflare protection in front of every surface |
| **Data exfiltration** | No PII collected to exfiltrate |

### What we do not defend against

- **Browser compromise** (malicious extensions reading IndexedDB, malware, MITM below TLS). Device-level threat.
- **Device theft.** Data lives on your device. That is the design.
- **User sharing their own API key.** User responsibility.
- **AI hallucination.** Minimized through figure guardrails and factchecks, never claimed as eliminated.

---

## Audit posture

The codebase is open source under AGPL-3.0. Anyone can audit it. We have not yet commissioned an independent third-party security audit, and we plan to as funding allows.

Until then, public security posture rests on:

- **External configuration scans**: see [SECURITY.md § External validation](../SECURITY.md#external-validation) for live links to SecurityHeaders, SSL Labs, Mozilla Observatory, and Hardenize.
- **Internal review** against OWASP ASVS L2 and OWASP LLM Top 10.
- **Open code review** by anyone reading the repository.
- **Coordinated disclosure** via [SECURITY.md](../SECURITY.md).

---

## Responsible disclosure

Found a vulnerability? See [SECURITY.md](../SECURITY.md) for the full policy: GitHub Security Advisory or email `security@chipmates.ai`, 48-hour acknowledgment, safe-harbor for good-faith research.

---

[← Back to README](../README.md)
