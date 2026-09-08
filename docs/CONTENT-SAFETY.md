# Content safety

How a message is screened on its way to a model and back, what each layer looks for, and what a visitor sees when a layer fires. Written for anyone who has to judge the platform before letting people use it, and for contributors who touch the screening code. The self-harm tiers have their own page, [CRISIS-PROTOCOL.md](CRISIS-PROTOCOL.md), in plain words.

Two files hold almost all of it: [`client/src/utils/contentSafety.ts`](../client/src/utils/contentSafety.ts) in the browser and [`workers/llm-proxy/src/utils/contentScreen.ts`](../workers/llm-proxy/src/utils/contentScreen.ts) at the edge.

---

## The layers

| Layer | Where | What it does |
|---|---|---|
| 1. Input screen | Browser | Matches the pattern lists before a message is sent |
| 2. Personal data warning | Browser | Warns before an email address, a phone number, a card number or an IBAN is sent |
| 3. Input screen | Worker | The same lists again, independently, plus invisible-character checks |
| 4. Jailbreak patterns | Both | Part of the same policy list: instruction overrides, role-play escapes, token injection, prompt extraction |
| 5. Prompt constraints | Worker | A safety preamble plus each figure's own rules, ahead of every reply |
| 6. Crisis rules | Worker | Three rules forced into the prompt for the turn when the screen flags distress |
| 7. Output scan | Worker | The streamed reply is read as it arrives and cut off on an absolute violation |
| 8. Compliance log | Worker | Category, timestamp and metadata for every safety event, 90 days |

The browser layer saves a round trip and shapes what the visitor sees. The worker layer is the one that counts, since a self-hosted or modified client cannot be trusted to run it.

---

## What the screening covers

The two sides carry the same lists, in English, German, Spanish and French: 70 pattern checks in the browser, and 74 at the edge, where four more reject invisible characters, mathematical alphanumerics, unicode tag characters and control-character floods. Self-harm is screened in three tiers, which is what lets a question about the Stoics through while a first-person statement stops the turn.

| Category | Examples | Response |
|---|---|---|
| **Self-harm, first person** | The visitor about their own safety, now | Conversation stops, crisis resources shown |
| **Self-harm, soft distress** | "I can't do this anymore" and its kin | Answered, crisis rules forced into the prompt, helpline banner |
| **Self-harm, topical** | Suicide as a subject: history, philosophy, a figure's life | Answered, helpline line under the reply |
| **Harm to others** | Violence, threats, attack methods | Policy block |
| **Child exploitation** | Any related content | Immediate block and log |
| **Terrorism and weapons** | Bomb-making, mass violence | Policy block |
| **Hate speech (§130 StGB)** | Holocaust denial, antisemitism, incitement against a group | Policy block |
| **Violence glorification (§131 StGB)** | Crime instructions, glorification of violence | Policy block |
| **Sexual content (§184 StGB)** | Explicit sexual content | Policy block |

A policy block returns a plain sentence and an invitation to ask something else. It names no category, so the screen gives nothing away to somebody probing it.

### Crisis resources

A first-person statement about the visitor's own safety stops the conversation and shows helplines. Soft distress and the subject as a topic are answered with helplines attached.

- **Germany:** Telefonseelsorge (0800 111 0 111 / 0800 111 0 222), Kinder- und Jugendtelefon (116 111)
- **Austria:** Telefonseelsorge (142)
- **Switzerland:** Die Dargebotene Hand (143)
- **United States:** 988 Suicide and Crisis Lifeline
- **United Kingdom and Ireland:** Samaritans (116 123)
- **Everywhere else:** the [IASP directory](https://www.iasp.info/resources/Crisis_Centres/) lists crisis centres by country

The line for the visitor's country comes first. The worker sends a country code and nothing else. The list itself lives in the app, in `contentSafety.ts`, which is also where a correction to a number belongs.

A visitor in distress sees resources and a sentence saying they are welcome back. That is the point of the tiers.

---

## Jailbreak detection

| Technique | What is matched |
|---|---|
| **Direct override** | "Ignore previous instructions", "forget your rules" |
| **Role-play escape** | "DAN mode", "developer mode", "GODMODE" |
| **Token injection** | ChatML tokens (`<\|im_start\|>`, `[INST]`), XML injection |
| **Prompt extraction** | "Show your instructions", "what is your system prompt" |
| **Fake policy headers** | Text posing as a system or policy update inside the message |
| **Unicode obfuscation** | Homoglyphs, zero-width characters, mathematical alphanumerics |
| **Leetspeak variants** | Spellings from public jailbreak prompt collections |

A match is logged and answered with a neutral message.

---

## Personal data warning

Before a message is sent, the browser checks it for four patterns.

| Pattern | How it is matched | What happens |
|---|---|---|
| Email address | Standard address shape | Warning |
| Phone number | German formats: `+49`, `0049`, or a leading zero | Warning |
| Credit card number | Four groups of four digits | Warning |
| IBAN | German IBAN shape | Warning |

The warning is advisory. A visitor who means to send the message can send it. The aim is to catch the moment someone types their own phone number into a conversation with a philosopher without thinking about where it goes.

---

## Figure safety

Two things shape what a figure will answer: the safety preamble at the front of every prompt, and the figure's own instruction set. All 30 instruction sets carry the advice boundary and the crisis calibration below.

- **No medical, legal or financial advice.** Figures share perspective and redirect to professionals.
- **Crisis language stays reserved for crisis.** A rough week is answered as a rough week. The referral phrasing is for explicit self-harm, severe abuse or immediate danger.
- **Historical boundary.** Figures acknowledge what they cannot know beyond their own era.
- **No methods.** Figures refuse to describe methods of violence or self-harm.
- **Difficult subjects stay philosophical.** Suffering, death and despair are answered through the figure's own tradition, with the advice boundary above still in force.

### Council tiers

Each of the 55 council questions carries a tier in the catalog, and both depth levels of a question share it. 28 are standard, 18 sensitive and 9 deep. A sensitive council shows "Sensitive topic" on its detail sheet, a deep one shows "Contains difficult themes", both before playback starts.

---

## The compliance log

Every safety event is written server side, for review and for the JMStV record.

| Field | What it holds |
|---|---|
| **Type** | Input blocked, output blocked, or jailbreak attempt |
| **Severity** | P1 to P4, derived from the category |
| **Category** | Which screening rule matched |
| **Timestamp** | When it happened |
| **IP hash** | A salted one-way hash, never the address |
| **Figure, format, language** | Context for reading the log |
| **Retention** | 90 days, as a Cloudflare KV TTL |

The log holds no message content, no visitor identifier and no conversation context.

---

## German law

**§130 StGB (Volksverhetzung).** Patterns on both sides match Holocaust denial, antisemitic content and incitement against protected groups.

**§131 StGB (Gewaltdarstellung).** Crime instructions, glorification of violence, and recipe-style instructions for harmful acts.

**§184 StGB.** Explicit sexual content is blocked.

**§4 JMStV.** The absolute violations, a short and deliberately tight list, are also scanned in the outgoing stream, so a model that produces one is cut off mid-reply.

**JMStV in general.** The site carries an `age-de.xml` declaration rated 16 and up, screening runs for everyone, and a youth protection officer is appointed under §7 JMStV and named on the [Impressum page](https://agoracosmica.org/impressum#jugendschutz). See [COMPLIANCE.md](COMPLIANCE.md).

---

## Reporting and appeals

Every reply carries a report button. It opens an email to `agoracosmica@chipmates.ai` with the reported passage, the figure and the time, from the visitor's own mail program. Nothing about a report reaches our servers on its own.

If a message was blocked and should not have been, write to the same address with the sentence that was stopped. We answer within five business days and change the patterns when they are wrong.

---

For the technical security architecture (rate limits, edge auth, encryption), see [SECURITY-ARCHITECTURE.md](SECURITY-ARCHITECTURE.md).

For vulnerability reporting, see [SECURITY.md](../SECURITY.md).

---

**[← Back to README](../README.md)**
