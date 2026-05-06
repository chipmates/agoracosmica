# EU Compliance

Agora Cosmica complies with European data protection, AI transparency, and youth protection regulations. The platform is operated by ChipMates gemeinnützige GmbH, a registered German nonprofit.

---

## GDPR (General Data Protection Regulation)

### Data Controller

**ChipMates gemeinnützige GmbH** (gemeinnützige GmbH)
Germany

### Lawful Basis

Legitimate interest (Art. 6(1)(f) GDPR) for providing philosophical dialogue services.

### Data Minimization

| Principle | Implementation |
|-----------|---------------|
| **No registration** | No email, no password, no personal data collected |
| **No tracking** | No analytics cookies, no behavior tracking |
| **Local storage** | Conversations in IndexedDB on user's device |
| **Minimal logging** | Safety events only (category + timestamp + IP hash), 90-day retention |
| **No profiling** | No user profiles built, no recommendations based on behavior |

### Data Subject Rights

| Right | Implementation |
|-------|---------------|
| **Access** | All user data is local (IndexedDB), user has full access |
| **Deletion** | "Clear History" deletes all local data immediately |
| **Portability** | All local data is plain JSON in IndexedDB and exportable via browser DevTools today. An in-app one-click export is on the post-launch roadmap. |
| **Objection** | No processing to object to (data stays on device) |

### Sub-Processors

| Provider | Service | Location | DPA |
|----------|---------|----------|-----|
| Cloudflare | Pages, Workers, R2, KV | EU edge (R2 in Western Europe) | DPA via Cloudflare dashboard |
| Nebius | LLM inference (free tier) | Finland (EU) | Zero Data Retention enabled |
| Hetzner | GPU servers (TTS/STT) | Germany (Falkenstein, Nürnberg) | German company, GDPR-native |
| OpenRouter | LLM inference (BYOK) | US-based router. User picks downstream provider, can select ZDR-capable EU providers. | User's direct relationship |

### Cookie Policy

**No tracking cookies.** Cloudflare sets strictly-necessary cookies (`__cf_bm`, `cf_clearance`, `__cflb`) for bot detection and load balancing. These are exempt from consent under ePrivacy Directive Article 5(3) and §25(2) TDDDG.

All other client-side storage uses IndexedDB and localStorage, both technically necessary for app functionality and not cookies under the ePrivacy framework. No analytics, no marketing, no tracking.

---

## EU AI Act

### Classification

Agora Cosmica is a **general-purpose AI system interface** (not high-risk). It does not perform biometric analysis, emotion recognition, or automated decision-making.

### Art. 50 Compliance (Transparency)

| Requirement | Implementation |
|-------------|---------------|
| **AI disclosure** | Consent modal clearly states content is AI-generated |
| **Naming convention** | All figures prefixed with "Echo of" to signal non-human origin |
| **HTTP headers** | `X-AI-Generated`, `X-AI-Model`, `X-AI-Provider` on all API responses |
| **Consent flow** | WelcomeDisclosureModal with explicit AI acknowledgment |
| **Timeline** | Compliant ahead of Aug 2026 enforcement deadline |

### Content Marking

Every AI-generated response includes machine-readable headers identifying:
- That the content is AI-generated
- Which model produced it
- Which provider processed the request

---

## German Youth Protection (Jugendschutz)

### JMStV (Jugendmedienschutz-Staatsvertrag)

| Requirement | Implementation |
|-------------|---------------|
| **Age rating** | `age-de.xml` declaration: rated **16+** |
| **Content screening** | ~85 patterns for §130/§131/§184 StGB content (39 client-side, 48 server-side) |
| **Jailbreak detection** | GODMODE, DAN, token injection, Unicode obfuscation |
| **Output scanning** | Real-time stream scanning for harmful content |
| **Figure risk assessment** | Per-figure safety metadata |
| **Report mechanism** | "Inhalt melden" button in conversations |
| **Compliance logging** | KV-based, 90-day retention |

### Consent and Age Verification

The WelcomeDisclosureModal requires:
- Age 16+ confirmation (Art. 8 GDPR / §16 DSGVO)
- Terms of Service acceptance
- AI-generated content acknowledgment

### Impressum (§5 TMG / §18 MStV)

The Impressum page includes all legally required information:
- Company details (ChipMates gemeinnützige GmbH)
- MStV disclosure (media state treaty)
- KI-Hinweis (AI disclosure)
- OS-Plattform link (EU online dispute resolution)
- Jugendschutzbeauftragter (Youth Protection Officer): Rechtsanwalt Jan Müller, IT-Recht Kanzlei. Appointed per §7 JMStV. Contact `jugendschutzbeauftragter@it-recht-kanzlei.de`

---

## Terms of Service

Available at `/nutzungsbedingungen` (German) and `/terms` (English).

Key provisions (13 sections):
- User owns their API key
- ChipMates not liable for LLM outputs
- Content policy (no hate speech, self-harm, illegal content)
- AI-generated content disclaimer
- Limitation of liability

---

## Privacy Policy (Datenschutzerklärung)

Available at `/datenschutz` (German) and `/privacy` (English).

Covers:
- KI-Chat data processing
- Audio processing (TTS/STT)
- Minderjährige (minors, Art. 8 DSGVO)
- Auftragsverarbeiter table (sub-processors)
- Technically necessary storage (§25 TDDDG)

---

## Data Residency

All data processing occurs within the European Union.

| Data Type | Location | Provider |
|-----------|----------|----------|
| Frontend | EU edge | Cloudflare Pages |
| Worker execution | Cloudflare EU edge network | Cloudflare Workers |
| Object storage | Western Europe | Cloudflare R2 |
| Audio processing | Germany (Falkenstein, Nürnberg) | Hetzner |
| LLM (free tier) | Finland | Nebius |
| Safety logs | EU edge | Cloudflare KV |
| User data | User's device | Browser (IndexedDB) |

No data is transferred outside the EU by ChipMates. BYOK users who choose a non-EU model via OpenRouter make that decision independently.

---

## Accessibility (BFSG / EAA)

The German Barrierefreiheitsstärkungsgesetz (BFSG, implementing the EU Accessibility Act) applies to consumer-facing digital services from June 2025. Agora Cosmica is built to WCAG 2.2 AA standards (see [ACCESSIBILITY.md](ACCESSIBILITY.md) for technical detail).

A formal **Barrierefreiheitserklärung** (Accessibility Statement) page is on the post-launch roadmap. Until that page is published, the technical claims in ACCESSIBILITY.md describe our current implementation.

---

## Digital Services Act (DSA)

Agora Cosmica is a small platform far below the VLOP threshold. We implement:

- **Notice and action**: "Inhalt melden" (Report Content) button in conversations, routed to `agoracosmica@chipmates.ai`
- **Terms and Conditions** clearly labeled and accessible
- **Statement of reasons** when content is blocked (the user sees why)

---

For the underlying technical security architecture, see [SECURITY-ARCHITECTURE.md](SECURITY-ARCHITECTURE.md). For vulnerability reporting, see [SECURITY.md](../SECURITY.md).

---

**[← Back to README](../README.md)**
