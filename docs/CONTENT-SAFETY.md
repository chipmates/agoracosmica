# Content Safety

Agora Cosmica implements multi-layer content safety to protect users, comply with German and EU law, and ensure philosophical dialogues remain constructive.

---

## Safety Layers

The platform uses eight defense layers, from client-side detection to server-side screening and response validation.

| Layer | Location | Purpose |
|-------|----------|---------|
| 1. **Client-side screening** | Browser | Pre-send detection of harmful patterns |
| 2. **PII detection** | Browser | Warns users before sending personal information |
| 3. **Server-side screening** | CF Worker | Blocks requests matching safety patterns |
| 4. **Jailbreak detection** | CF Worker | Detects prompt injection and role-play escapes |
| 5. **System prompt constraints** | CF Worker | Figures refuse harmful topics in-character |
| 6. **Response validation** | CF Worker | Filters harmful patterns from LLM output |
| 7. **Output stream scanning** | CF Worker | Real-time scanning of streamed responses |
| 8. **Compliance logging** | CF Worker | All safety events logged for review |

---

## Content Screening

### Categories

The screening system covers these categories with around 85 regex patterns (39 client-side, 48 server-side) in English, German, Spanish, and French:

| Category | Examples | Response |
|----------|----------|----------|
| **Self-harm** | Direct phrases, method descriptions, crisis language | Crisis resources displayed |
| **Harm to others** | Violence, threats, attack methods | Policy block |
| **Child exploitation (CSAM)** | Any related content | Immediate block + log |
| **Terrorism and weapons** | Bomb-making, mass violence | Policy block |
| **Hate speech (§130 StGB)** | Holocaust denial, antisemitism, anti-immigrant incitement | Policy block |
| **Violence glorification (§131 StGB)** | Crime instructions, glorification of violence | Policy block |
| **Sexual content (§184 StGB)** | Explicit sexual content | Policy block |

### Crisis Resources

When self-harm patterns are detected, the platform displays helpline information instead of blocking:

- **Germany:** Telefonseelsorge (0800 111 0 111 / 0800 111 0 222)
- **United States:** 988 Suicide and Crisis Lifeline
- **Other countries:** [befrienders.org](https://www.befrienders.org/) lists local helplines worldwide

The goal is help, not punishment. Users in distress see resources, not error messages.

---

## Jailbreak Detection

The system detects common prompt injection and jailbreak techniques:

| Technique | Detection |
|-----------|-----------|
| **Direct override** | "Ignore previous instructions," "forget your rules" |
| **Role-play escape** | "DAN mode," "developer mode," "GODMODE" |
| **Token injection** | ChatML tokens (`<\|im_start\|>`, `[INST]`), XML injection |
| **System prompt extraction** | "Show your instructions," "what is your system prompt" |
| **Unicode obfuscation** | Homoglyph substitution, zero-width characters |
| **L33tspeak variants** | Patterns from known public jailbreak prompt collections (BASI, L1B3RT4S, and similar) |

Detected jailbreak attempts are logged and blocked with a neutral response.

---

## PII Detection

Before sending a message, the client scans for personally identifiable information:

| PII Type | Detection | Action |
|----------|-----------|--------|
| Email addresses | Regex pattern | Warning displayed |
| Phone numbers | International format detection | Warning displayed |
| Credit card numbers | Pattern match (4-group format) | Warning displayed |

PII detection is advisory, not blocking. Users can choose to send the message after seeing the warning. The goal is awareness, not restriction.

---

## Figure Safety

Each figure has a risk assessment and tailored guardrails built into their instruction set:

### Instruction-Level Protections

- **No medical, legal, or financial advice.** Figures redirect to professionals.
- **Historical boundary awareness.** Figures acknowledge what they cannot know beyond their era.
- **No-harm policy.** Figures refuse to discuss methods of violence or self-harm.
- **Philosophical framing.** Difficult topics (suffering, death, despair) are addressed through the figure's philosophical lens, not as personal guidance.

### Council Safety Classifications

| Level | Description | User Experience |
|-------|-------------|-----------------|
| **Moderate** | General philosophical discussion | Standard playback |
| **Sensitive** | Topics that may resonate personally | Brief content note |
| **Deep** | Grief, pain, existential crisis | Disclaimer before playback |

---

## Compliance Logging

All safety events are logged server-side for review and legal compliance.

| Field | Description |
|-------|-------------|
| **Category** | Which screening rule triggered |
| **Timestamp** | When the event occurred |
| **IP hash** | One-way hash, not raw IP |
| **Event type** | Block, warning, crisis resource shown |
| **Retention** | 90 days (Cloudflare KV TTL) |

Logs do **not** contain message content, user identifiers, or conversation context. Only the category and metadata are recorded.

---

## German Law Compliance

### §130 StGB (Volksverhetzung / Hate Speech)

Server-side and client-side patterns detect Holocaust denial, antisemitic content, and incitement against protected groups.

### §131 StGB (Gewaltdarstellung / Violence Glorification)

Detection of crime instructions, glorification of violence, and "recipe" format instructions for harmful acts.

### §184 StGB (Jugendgefährdende Inhalte / Youth-Endangering Content)

Explicit sexual content is detected and blocked.

### JMStV (Jugendmedienschutz-Staatsvertrag)

- `age-de.xml` declaration (rated age **16+**)
- Content screening active for all users
- Figure risk assessment per character
- Jugendschutzbeauftragter (Youth Protection Officer) appointed: Rechtsanwalt Jan Müller, IT-Recht Kanzlei. Contact details on the [Impressum page](https://agoracosmica.org/impressum#jugendschutz) (`jugendschutzbeauftragter@it-recht-kanzlei.de`)

---

## Report and Appeals

Users can report concerning content via the **"Inhalt melden"** (Report Content) button in conversation views. Reports are logged for review and routed to `agoracosmica@chipmates.ai`.

If you believe content was blocked or filtered in error, contact `support@chipmates.ai` with the request context. We will respond within 5 business days.

---

For the underlying technical security architecture (rate limits, edge auth, encryption), see [SECURITY-ARCHITECTURE.md](SECURITY-ARCHITECTURE.md).

For vulnerability reporting, see [SECURITY.md](../SECURITY.md).

---

**[← Back to README](../README.md)**
