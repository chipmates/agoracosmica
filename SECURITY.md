# Security Policy

We take the security of Agora Cosmica seriously. This document explains how to
report vulnerabilities, what we commit to in return, and what is in scope.

If you are a security researcher: thank you. We rely on people like you.

---

## Reporting a Vulnerability

**Please do not report security issues via public GitHub issues, discussions, or
social media.** Quiet first, public later.

**Preferred channels** (either works):

- **GitHub Security Advisory** (private, recommended): [open one here](https://github.com/chipmates/agoracosmica/security/advisories/new)
- **Email**: [security@chipmates.ai](mailto:security@chipmates.ai)

Include where possible: a description, reproduction steps, the affected URL or
file, and the impact you observed. Proof-of-concept code is welcome but optional.
Encrypted email is fine but not required for initial contact.

---

## Response Commitment

| Stage | Timeline |
|---|---|
| Acknowledgment of receipt | within **48 hours** |
| Initial severity assessment | within **7 days** |
| Fix shipped (Critical / High) | within **30 days** |
| Fix shipped (Medium / Low) | within **90 days** |
| Coordinated public disclosure | **90 days** from report, or sooner if a fix is live and you agree |

We are a small nonprofit team. If we are going to miss a window, we will tell
you why and propose a new one.

---

## Disclosure Timeline

A typical report flows like this:

```
Day 0       You report (GitHub Security Advisory or email)
Day 0–2     We acknowledge receipt and open a private tracking issue
Day 2–9     We reproduce, assess severity, and confirm scope
Day 9–39    We ship a fix to production (Critical / High)
Day 9–99    We ship a fix to production (Medium / Low)
Day ≤90     Coordinated public disclosure with credit
```

We may request an embargo extension for complex issues. We will never extend
silently or unilaterally.

---

## Safe Harbor

We support good-faith security research. We will not pursue legal action against
researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, or service degradation
- Only interact with accounts they own or have explicit permission to access
- Do not exfiltrate data beyond the minimum needed to demonstrate the issue
- Give us reasonable time to investigate and fix before public disclosure
- Do not exploit findings beyond demonstration

This policy is aligned with [disclose.io](https://disclose.io) Core Terms.

---

## Scope

### In scope

- Source code in this repository (AGPL-3.0, public)
- `agoracosmica.org` and subdomains
- API endpoints under `*.agoracosmica.org` (LLM proxy, audio proxy, media gateway)
- Self-hosted audio at `fsn1.agoracosmica.org` and `nbg1.agoracosmica.org`

### Out of scope

- **Third-party services.** Report to Cloudflare, Nebius, OpenRouter, or Hetzner directly.
- **Vulnerabilities in dependencies.** Report upstream. We will bump on disclosure.
- **Availability testing.** Do not perform any testing (DoS, DDoS, fuzzing at scale, brute-force) that may degrade service for other users.
- **Social engineering** of staff, partners, or users.
- **Physical attacks** on our infrastructure.
- **AI hallucination or factual errors** in responses. We treat these as content quality, not security.
- **Issues requiring browser compromise** (extensions, malware, MITM below TLS).

### Common false positives (not security issues)

To save you time, these are the recurring reports we close as informational:

- **Missing security headers on static asset endpoints** where another header (CSP, X-Content-Type-Options) already provides the relevant protection.
- **Email server configuration** (SPF, DKIM, DMARC) on transactional addresses that do not send mail.
- **`agoracosmica.org` resolving to a Cloudflare IP.** This is intentional. Origin IPs are protected.
- **Rate-limit window bypass via different identifiers.** Our rate limit is per-identity (UUID), and refreshing the identity is intended user behavior. The wallet-level global cap is the backstop.
- **`X-Powered-By` or framework fingerprinting.** Not considered a vulnerability on its own.
- **Self-XSS** that requires the user to paste attacker-supplied JavaScript into their own console.

---

## Threat Model

We design to protect against:

- **Confidentiality** of your data: BYOK API keys are encrypted at rest and never transit our servers. Conversations stay in your browser and are never stored on our servers (free-tier messages pass through our proxy over TLS to reach the AI provider, never logged or stored there)
- **Integrity** of LLM responses (output sanitization, prompt-injection screening)
- **Availability** of the free tier (rate limits, content safety pre-filtering)
- **Identifiability** of users (no PII collection, no IP tracking, hashed device identifiers only)

We explicitly do **not** defend against:

- Browser-level compromise (extensions reading IndexedDB)
- Device theft. Data lives on your device. That is the design.
- Network-level surveillance *below* TLS
- AI hallucination. We minimize via figure guardrails and fact-checks, but do not claim immunity.

---

## Recognition

We credit reporters in release notes and in the **Acknowledgments** section
below, unless you prefer to remain anonymous.

As a nonprofit, we do not currently offer a paid bug bounty. We can offer:

- Public credit (if you want it)
- A signed letter of acknowledgment for your portfolio
- A small thank-you (stickers, swag), which we are working on

---

## Security Posture

### What we do (technical summary)

- **At-rest encryption.** AES-256-GCM with PBKDF2-HMAC-SHA256 (600k iterations desktop, 100k mobile) for API keys in IndexedDB.
- **In-transit.** TLS-only, HSTS with `includeSubDomains`.
- **Browser hardening.** Strict CSP (no `unsafe-eval`, `frame-ancestors 'none'`, `object-src 'none'`), full security header set.
- **Authentication.** HMAC-SHA256 JWT with strict alg validation, **UUID-bound subjects** (per-client identity in localStorage), Turnstile-gated issuance.
- **BYOK isolation.** Your OpenRouter API key transits browser to OpenRouter directly. It never touches our servers.
- **Output safety.** DOMPurify sanitization on every LLM render path, with strict tag and attribute allowlists.
- **Prompt-injection defense.** Multi-layer screening pre-LLM-call (jailbreak detection, system-prompt-extraction patterns, harmful content).
- **Rate limiting.** **Per-identity (UUID-based) for the chat quota, KV-backed 24-hour windows**, plus a global wallet-level daily cap. Short-lived plain-IP keys (1-hour TTL) exist only as flood brakes on the anonymous beacon and conversion routes and never enter analytics.
- **Edge auth on origins.** Two-token defense (X-Origin-Verify Worker secret + X-Admin-Token) on FSN1+NBG1 nginx. Protects against direct-to-origin abuse with leaked bearers.
- **Data residency.** EU only. Nebius (Finland), Hetzner (Germany, Falkenstein and Nürnberg).
- **Zero Data Retention.** Verified by daily cron audits. No conversation, audio, or text is persisted server-side.
- **No per-request server logging.** Diagnostic windows are bounded and wiped after. Standing nginx access-log capture is disabled in production. Aligned with our aggregate-only, no-profiling posture: event counters carry no per-user dimension. The one named exception, the opt-in gclid forward for ad arrivals, never enters analytics; see [docs/MEASUREMENT.md](docs/MEASUREMENT.md).
- **Access control on staging.** All non-production URLs are gated by Cloudflare Access.

For the full architecture: [docs/SECURITY-ARCHITECTURE.md](docs/SECURITY-ARCHITECTURE.md).

### External validation

Independent third-party scanners. Run them any time:

- **[SecurityHeaders.com](https://securityheaders.com/?q=https%3A%2F%2Fagoracosmica.org&followRedirects=on)** · HTTP security headers (CSP, HSTS, etc.). Currently **A+**.
- **[SSL Labs](https://www.ssllabs.com/ssltest/analyze.html?d=agoracosmica.org)** · TLS configuration. Currently **A+**.
- **[Mozilla Observatory](https://observatory.mozilla.org/analyze/agoracosmica.org)** · web security scan.
- **[Hardenize](https://hardenize.com/report/agoracosmica.org)** · DNS, email, TLS depth audit.

### Audit transparency

This codebase is open source under AGPL-3.0. Anyone can audit it. We have not
yet commissioned an independent third-party security audit, and we plan to as
funding allows. Until then our public security posture relies on:

- The external configuration scans above
- Open code review by the community
- Internal review against OWASP ASVS L2 and OWASP LLM Top 10
- This coordinated-disclosure program

If you have conducted a security review of this codebase, we would gladly
publish your findings, with attribution if you wish.

---

## Supported Versions

| Version | Status |
|---|---|
| `main` | ✅ Active development, receives all security fixes |
| Tagged releases | ⚠️ For security patches, use `main`. Older tags are not separately maintained. |

Only the `main` branch of this repository is officially supported. If you are
running a fork or a tagged release, please rebase or update before reporting
issues you cannot reproduce on `main`.

---

## Acknowledgments

We thank the following researchers for responsibly disclosed reports:

*Be the first.*

---

## Versioning

This security policy applies to the current `main` branch. Older releases are
not separately maintained. Please test against `main`.
