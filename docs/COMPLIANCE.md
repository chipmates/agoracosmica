# Compliance

What Agora Cosmica does to meet European data protection, AI transparency and German youth protection law, with the file or the page that carries each measure. Written for a lawyer, a data protection officer, or a school deciding whether a class can use the platform. The technical detail is in [SECURITY-ARCHITECTURE.md](SECURITY-ARCHITECTURE.md), every counter we write is listed in [MEASUREMENT.md](MEASUREMENT.md), and the safety screening is described in [CONTENT-SAFETY.md](CONTENT-SAFETY.md).

The platform is operated by ChipMates gemeinnützige GmbH, a registered German nonprofit.

---

## GDPR

### Controller

ChipMates gemeinnützige GmbH, Germany. The full operator details are on the [Impressum page](https://agoracosmica.org/impressum).

### Lawful basis

Legitimate interest under Art. 6(1)(f) GDPR, for providing a philosophical dialogue service.

### Data minimization

| Principle | How it works |
|---|---|
| **No registration** | No email, no password, no account data. The one personal-data exception is the opt-in Google ad click id, see [MEASUREMENT.md](MEASUREMENT.md) |
| **No tracking cookies** | No analytics cookies, no behavioral tracking |
| **On the device** | Conversations, the local profile and any API key stay in the browser's IndexedDB |
| **Minimal logging** | Safety events only: category, timestamp, hashed address, figure, format and language. 90-day retention |
| **No profiling** | No user profile is built, and nothing is recommended from past behavior |

### Data subject rights

| Right | How it is served |
|---|---|
| **Access** | Everything a visitor writes stays on their own device, so they hold it already |
| **Erasure** | "Clear history" removes a conversation. Settings carries a clear-all that wipes the local stores |
| **Portability** | We hold no copy to hand over. On the device, history, profile and API key are encrypted under a device key, so a raw IndexedDB dump is not readable elsewhere. An in-app export is not built |
| **Objection** | A free-tier message goes to an inference provider to be answered. A visitor who does not want that can bring their own key or run the app locally, which takes our proxy out of the path |

### Sub-processors

| Provider | Service | Location | DPA |
|---|---|---|---|
| Cloudflare | Pages, Workers, R2, KV | EU edge (R2 in Western Europe) | DPA via Cloudflare dashboard |
| Nebius | LLM inference (free tier) | United Kingdom (primary model) and Finland (EU, fallback model) | Zero data retention enabled in both regions |
| Hetzner | GPU servers (speech synthesis and transcription) | Germany (Falkenstein, Nürnberg) | German company, GDPR-native |
| OpenRouter | LLM inference (your own key) | US-based router. The visitor picks the downstream provider and can select a provider with zero data retention in the EU | The visitor's own relationship |

### Cookies

**No tracking cookies.** Cloudflare sets strictly necessary bot-detection cookies (`__cf_bm`, `cf_clearance`) at the edge. These are exempt from consent under ePrivacy Directive Article 5(3) and §25(2) TDDDG.

All other client-side storage is IndexedDB and localStorage, technically necessary for the app to run and not cookies under the ePrivacy framework. There are no third-party analytics and no marketing trackers. Aggregate, anonymous event counters are written server side to operate the service and to measure nonprofit reach. [MEASUREMENT.md](MEASUREMENT.md) lists every one of them, including the opt-in ad-click measurement for visitors who arrive from a Google ad.

---

## EU AI Act

### Classification

Agora Cosmica is a general-purpose AI system interface, not a high-risk system. It performs no biometric analysis, no emotion recognition and no automated decision about a person.

### Art. 50 transparency

| Requirement | How it works |
|---|---|
| **AI disclosure** | The welcome screen states that responses are AI generated, before the first conversation |
| **Naming** | Figures are named "Echo of ..." in the app, an interpretation rather than the person |
| **HTTP headers** | `X-AI-Generated`, `X-AI-Model` and `X-AI-Provider` on API responses, set in [`workers/llm-proxy/src/index.ts`](../workers/llm-proxy/src/index.ts) |
| **Consent flow** | WelcomeDisclosureModal carries the AI acknowledgment. ArrivalChoice carries the opt-in for ad-click measurement, and only visitors arriving from a Google ad ever see it |
| **In place since** | Before the August 2026 transparency deadline |

### Content marking

Every response from the free tier carries machine-readable headers naming three things: that the content is AI generated, which model produced it, and which provider processed the request. The model named in the header is the one that actually answered, primary or fallback.

---

## German youth protection (Jugendschutz)

### JMStV

| Requirement | How it works |
|---|---|
| **Age rating** | An `age-de.xml` declaration at the site root, default age 16 |
| **Content screening** | 70 pattern checks in the browser and 74 at the edge, covering the §130, §131 and §184 StGB categories, self-harm in tiers, and jailbreak attempts. See [CONTENT-SAFETY.md](CONTENT-SAFETY.md) |
| **Jailbreak detection** | Instruction overrides, role-play escapes, special-token injection, prompt extraction, unicode obfuscation |
| **Output scanning** | Streamed replies are scanned as they arrive and cut off on a §4 JMStV violation |
| **Council content tiers** | Each of the 55 council questions carries a tier. 18 are marked sensitive and 9 deep, and the detail sheet says so before playback |
| **Report route** | A report button on every reply opens an email to `agoracosmica@chipmates.ai` with the passage quoted |
| **Compliance log** | Safety events in Cloudflare KV, 90-day TTL |

### Consent and age

The welcome screen asks for three confirmations before the first conversation: that the visitor is 16 or older (Art. 8 GDPR), that they accept the terms, and that they understand responses are AI generated.

### Impressum (§5 DDG / §18 MStV)

The [Impressum page](https://agoracosmica.org/impressum) carries the operator details, the person responsible under §18 (2) MStV, the AI note, a consumer dispute resolution section, and the youth protection officer appointed under §7 JMStV with a direct email address.

---

## Terms of service

German at `/nutzungsbedingungen`, English at `/terms`, thirteen sections each. The AI notice in §2 is the part a reviewer usually wants: the chat is operated entirely by an AI system, the figures are simulations and not authentic reproductions of what those people said, generated content can be factually wrong, and the service is not professional advice of any kind. The rest covers scope, the age requirement, rules of use, intellectual property, data protection, protection of minors, liability, blocking, content moderation and reporting, applicable law, and contact.

## Privacy policy

German at `/datenschutz`, English at `/privacy`. It covers the chat processing, speech synthesis and transcription, minors under Art. 8 GDPR, the processor table, and technically necessary storage under §25 (2) TDDDG.

---

## Data residency

| Data | Location | Provider |
|---|---|---|
| Frontend | EU edge | Cloudflare Pages |
| Worker execution | Cloudflare EU edge network | Cloudflare Workers |
| Object storage | Western Europe | Cloudflare R2 |
| Speech synthesis and transcription | Germany (Falkenstein, Nürnberg) | Hetzner |
| LLM, free tier | United Kingdom or Finland, depending on which model answers | Nebius |
| Safety logs | EU edge | Cloudflare KV |
| Visitor data | The visitor's own device | Browser (IndexedDB) |

The one transfer outside the EEA that ChipMates makes is free-tier inference on the primary model, which Nebius serves from the United Kingdom under the European Commission's adequacy decision for the UK, renewed in December 2025. The fallback model runs in Finland. Everything else stays in the EEA. A visitor who brings their own key and picks a non-EU provider through OpenRouter makes that decision themselves.

---

## Accessibility (BFSG and EAA)

The German Barrierefreiheitsstärkungsgesetz, which implements the EU Accessibility Act, applies to consumer-facing digital services from June 2025. The interface is built to WCAG 2.2 AA as a target, and [ACCESSIBILITY.md](ACCESSIBILITY.md) says which practices are in the code and which checks run by hand.

A formal Barrierefreiheitserklärung page is not published. Until it is, ACCESSIBILITY.md is the honest description of where the interface stands, and accessibility problems can be reported to `agoracosmica@chipmates.ai`.

---

## Digital Services Act

Agora Cosmica is a small platform, far below the very large online platform threshold. Three things are in place:

- **Notice and action.** A report button on every reply opens an email to `agoracosmica@chipmates.ai` with the reported passage, the figure and the time.
- **Terms.** Clearly labeled, linked from the welcome screen and the footer, in German and English.
- **A route back.** A blocked request gets a plain message and an invitation to ask something else. A visitor who thinks a block was wrong can write to the same address, and [CONTENT-SAFETY.md](CONTENT-SAFETY.md) says what triggers a block in the first place.

---

For the underlying technical security architecture, see [SECURITY-ARCHITECTURE.md](SECURITY-ARCHITECTURE.md). For vulnerability reporting, see [SECURITY.md](../SECURITY.md).

---

**[← Back to README](../README.md)**
