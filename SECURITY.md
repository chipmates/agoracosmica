# Security policy

This page is for anyone who finds a flaw in Agora Cosmica. It says where to send it, what happens next, what is in scope, and which reports we already know about. If you came instead to check the product's claims against the code, [the security architecture](docs/SECURITY-ARCHITECTURE.md) has the data flows and subprocessors, and [the threat model](docs/THREAT-MODEL.md) has the browser side in detail.

If you are a security researcher: thank you. We rely on people like you.

---

## Reporting a vulnerability

Please do not report security issues through public GitHub issues, discussions, or social media. Quiet first, public later.

Either channel works:

- **GitHub Security Advisory**, the private channel we prefer: [open one here](https://github.com/chipmates/agoracosmica/security/advisories/new)
- **Email**: [security@chipmates.ai](mailto:security@chipmates.ai)

Include what you have: a description, reproduction steps, the affected URL or file, and the impact you observed. Proof-of-concept code is welcome and optional. Encrypted email is fine and not required for first contact.

---

## Response commitment

| Stage | Timeline |
|---|---|
| Acknowledgment of receipt | within 48 hours |
| Initial severity assessment | within 7 days |
| Fix shipped (critical or high) | within 30 days |
| Fix shipped (medium or low) | within 90 days |
| Coordinated public disclosure | 90 days from the report, or sooner if a fix is live and you agree |

We are a small nonprofit team. If we are going to miss a window, we say why and propose a new one.

A report usually runs like this:

```
Day 0         You report (GitHub Security Advisory or email)
Day 0 to 2    We acknowledge receipt and open a private tracking issue
Day 2 to 9    We reproduce, assess severity, and confirm scope
Day 9 to 39   We ship a fix to production (critical or high)
Day 9 to 99   We ship a fix to production (medium or low)
By day 90     Coordinated public disclosure, with credit
```

We may ask for an embargo extension on a complex issue. We will never extend one silently or on our own.

---

## Safe harbor

We support good-faith security research and will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and service degradation
- Only interact with accounts they own or have explicit permission to access
- Take no more data than a demonstration of the issue needs
- Give us reasonable time to investigate and fix before public disclosure
- Stop at demonstration

This policy follows the [disclose.io](https://disclose.io) core terms.

---

## Scope

### In scope

- The source code in this repository (AGPL-3.0)
- `agoracosmica.org` and its subdomains
- The API endpoints under `*.agoracosmica.org`: the LLM proxy, the audio proxy, the media gateway
- The speech servers at `fsn1.agoracosmica.org` and `nbg1.agoracosmica.org`

### Out of scope

- **Third-party services.** Report to Cloudflare, Nebius, OpenRouter, or Hetzner directly.
- **Vulnerabilities in dependencies.** Report upstream. We bump on disclosure.
- **Availability testing.** No DoS, DDoS, fuzzing at scale, or brute force. It degrades the service for everyone else on it.
- **Social engineering** of the team, of partners, or of users.
- **Physical attacks** on infrastructure.
- **Hallucination and factual errors** in a figure's answers. We treat those as content quality. A normal issue is the right place for them.
- **Findings that need a compromised browser** (extensions, malware, interception below TLS).

### Reports we close as informational

To save you time, these are the recurring ones:

- **Missing security headers on static asset endpoints**, where another header already provides the protection that matters there.
- **Email configuration (SPF, DKIM, DMARC)** on addresses that send no mail.
- **`agoracosmica.org` resolving to a Cloudflare address.** That is intentional. Origin addresses stay behind it.
- **Resetting the daily quota by rotating an identifier.** The chat quota is keyed to a UUID the browser holds, so clearing it does start a fresh counter. Two ceilings sit behind that: a daily cap per hashed address, and an hourly cap on how fast one address can mint sessions. A global daily cap is the backstop.
- **`X-Powered-By` or framework fingerprinting** on its own.
- **Self-XSS** that needs someone to paste attacker-supplied JavaScript into their own console.

---

## What we defend

- **Confidentiality of your data.** A bring-your-own-key API key is encrypted at rest in your browser and travels only to OpenRouter. Conversations stay in your browser. Free-tier messages pass through our proxy over TLS on their way to the inference provider, and are neither logged nor stored there.
- **Integrity of model output.** Output is sanitized on every render path, and the response stream is scanned as it passes through.
- **Availability of the free tier.** Rate limits per identity, per address and across everyone, content screening before a message reaches a model, and a daily inference budget behind the whole thing.
- **Identifiability.** No accounts, no email, no name. The free-tier identity is a UUID your own browser generates, and addresses are hashed with a salt before anything is written down.

## What we do not defend against

- Browser-level compromise, such as an extension reading IndexedDB
- Device theft. The data lives on your device. That is the design.
- Network surveillance below TLS
- Hallucination. Figure guardrails and factchecks reduce it. We do not claim immunity.

[The threat model](docs/THREAT-MODEL.md) works the first of those through in detail, including what a non-extractable key does and does not buy.

---

## Recognition

We credit reporters in release notes and in the acknowledgments below, unless you would rather stay anonymous.

As a nonprofit we run no paid bug bounty. What we can offer is public credit if you want it, a signed letter of acknowledgment for your portfolio, and a small thank-you in the post.

---

## Security posture

A summary. [The security architecture](docs/SECURITY-ARCHITECTURE.md) has the full version, and all of it is checkable against the code in this repository.

- **At-rest encryption.** The API key is encrypted with AES-256-GCM under a device key the browser marks non-extractable, so a script on the page can use it and cannot read it out. Conversation history and the local profile are encrypted with AES-256-GCM under a key derived with PBKDF2-HMAC-SHA256 (600,000 iterations) from a device secret in the same database.
- **In transit.** TLS only, HSTS with `includeSubDomains`.
- **Browser hardening.** A strict Content Security Policy (no `unsafe-eval`, no blanket `unsafe-inline` for scripts, `frame-ancestors` and `object-src` set to `none`) and the full response header set.
- **Authentication.** HMAC-SHA256 JWT with strict `alg` validation. The subject is a UUID the browser generates, which keeps people behind one shared address in separate quotas, and the token is issued only after a Cloudflare Turnstile check and lives ten minutes.
- **Key isolation.** A bring-your-own OpenRouter key goes from the browser to OpenRouter directly. Our workers are not on that path.
- **Output safety.** DOMPurify on every path that renders model output, with strict tag and attribute allowlists.
- **Prompt-injection defense.** Layered screening before the call reaches a model: jailbreak patterns, system-prompt extraction, unicode obfuscation, harmful content.
- **Rate limiting.** 30 messages a day per identity, 300 chat requests a day per hashed address, and 15,000 a day across everyone, all in KV counters on a 24-hour window. Session mints are capped at 120 per address per hour. Short-lived plain-address keys (one-hour TTL) exist only as flood brakes on the anonymous beacon and conversion routes, and never enter analytics.
- **Spend governor.** Free-tier inference runs under a daily budget counted from real provider token usage. Above the cap the worker serves the unmetered fallback model for the rest of the day, so a spent budget shows up as a change of model.
- **Edge auth on the origins.** The two speech servers require both an `X-Origin-Verify` secret stamped by the worker and an operator token, so a leaked bearer alone does not reach the origin.
- **Data residency.** Cloudflare at the edge, Cloudflare R2 in Western Europe for recorded audio, Hetzner in Germany (Falkenstein and Nürnberg) for live speech, Nebius for free-tier inference: the primary model in the United Kingdom under the EU adequacy decision, the fallback in Finland.
- **Zero data retention.** A daily cron audit on the speech servers verifies that no conversation, audio, or text is kept past its serving window.
- **No per-request server logging.** Diagnostic windows are bounded and wiped afterwards, and standing nginx access-log capture is off in production. Event counters carry no per-user dimension. The one named exception, the opt-in forward of a Google ad click id, never enters our own counters. [What we measure](docs/MEASUREMENT.md) lists every one of them.
- **Access control on staging.** Every non-production URL sits behind Cloudflare Access.

### External validation

Independent third-party scanners. Run them any time:

- **[SecurityHeaders.com](https://securityheaders.com/?q=https%3A%2F%2Fagoracosmica.org&followRedirects=on)**, the HTTP security header set. A+ as of September 2026.
- **[SSL Labs](https://www.ssllabs.com/ssltest/analyze.html?d=agoracosmica.org)**, the TLS configuration.
- **[MDN Observatory](https://developer.mozilla.org/en-US/observatory/analyze?host=agoracosmica.org)**, a general web security scan.
- **[Hardenize](https://hardenize.com/report/agoracosmica.org)**, DNS, email and TLS in depth.

### Audit transparency

This codebase is open source under AGPL-3.0, so anyone can audit it. We have not commissioned an independent third-party security audit and plan to as funding allows. Until then the public posture rests on the configuration scans above, open code review by anyone reading the repository, internal review against OWASP ASVS L2 and the OWASP LLM Top 10, and this coordinated-disclosure program.

If you have run a security review of this codebase, we will publish your findings, with attribution if you want it.

---

## Supported versions

| Version | Security fixes |
|---|---|
| `main` | Yes. Every fix lands here first |
| 1.3.0, the current release | Yes, through the next release |
| 1.2.x and older tags | No. Update before reporting |

Only `main` is officially supported. If you run a fork or an older tag, please rebase or update before reporting something you cannot reproduce on `main`.

---

## Acknowledgments

We thank the following researchers for responsibly disclosed reports:

*Be the first.*
