# Content License

Agora Cosmica ships under a **dual-license model**: the source code and the
content (stories, voices, instructions, factchecks, artwork) are licensed
separately.

## Status

| Component | License | Effective |
|---|---|---|
| **Source code** | [AGPL-3.0](LICENSE) | Now |
| **Content** | © ChipMates gemeinnützige GmbH | Now |
| **Content (transition target)** | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Planned within 6 to 12 months of public launch |

Until the CC-BY transition completes, content may not be redistributed without
explicit permission. After the transition, content will be free to share and
adapt under the attribution conditions below.

---

## What "content" covers

Most assets ship in both English and German. The "Files" column counts each
language version as a separate licensed deliverable.

| Asset | Unique works | Languages | Files |
|---|---:|---|---:|
| Curated stories (12 per figure × 30 figures) | 360 | EN + DE | **720** |
| Forewords (one per figure) | 30 | EN + DE | **60** |
| Council dialogues (110 across 55 themes, L1 + L2 depth) | 110 | EN + DE | **220** |
| Prism conversations (12 per figure × 30 figures) | 360 | EN + DE | **720** |
| Wisdom teachings (12 per figure × 30 figures) | 360 | EN + DE | **720** |
| Factchecks (one per figure) | 30 | EN + DE | **60** |
| Initial greeting messages (mode × figure × seed) | ~750 | EN + DE | **~1,500** |
| Figure instruction sets (3 modes × 30 figures) | 90 | language-agnostic | **90** |
| Voice profiles | 30 | shared metadata | **30** |
| Figure portraits and UI artwork | 30 portraits + assorted UI | language-agnostic | **30+** |

---

## Where content lives in this repo

Two storage locations, both under the same content license:

1. **Fetched from the CDN at setup time.** The bulk of content (stories, prism conversations, council dialogues, wisdom seeds, factchecks, voice profiles, figure instruction sets) is gitignored under `client/src/assets/`. After `pnpm install`, run `pnpm setup:assets` to pull it from `https://media.agoracosmica.org`. This keeps the public source tree small and the content/code split obvious.

2. **Bundled into the LLM proxy worker.** `workers/llm-proxy/src/prompts/instructions.ts` is an auto-generated single file containing all 90 figure instruction prompts (built by `workers/llm-proxy/scripts/bundle-prompts.ts`). The worker needs them at request time to serve LLM completions, so they ship inline rather than fetched. Same content, same license.

Build-time intermediates (gitignored): `client/scripts/extract-public-data.mjs` derives lighter summaries (`src/data/public/seeds/`, `stories/`, `themeSeedCrossRef.ts`, `figuresCatalog.ts`) from the curated content on every `pnpm build`. They feed the prerendered SEO pages and aren't tracked separately.

All of the above is © ChipMates during the © phase and becomes CC-BY 4.0 at the transition.

---

## What CC-BY 4.0 will allow

After the transition, anyone will be free to:

- **Share.** Copy and redistribute in any medium or format.
- **Adapt.** Remix, transform, and build upon for any purpose, including commercial.

Under one condition:

- **Attribution.** Credit "Agora Cosmica" with a link to agoracosmica.org.

Full license text: <https://creativecommons.org/licenses/by/4.0/>

### Attribution format

> **Agora Cosmica**, [agoracosmica.org](https://agoracosmica.org)

Concrete examples:

- "Content by Agora Cosmica (agoracosmica.org)"
- "Source: Agora Cosmica, agoracosmica.org"
- "Based on stories from Agora Cosmica, agoracosmica.org"

---

## Why CC-BY 4.0?

**The mission comes first.** ChipMates exists to make philosophical wisdom
accessible. Open licensing is the fullest expression of that mission.

**NonCommercial blocks the wrong people.** NC restrictions primarily stop small
creators, educators, and indie developers: the teacher who charges for a
philosophy course, the podcaster with ads, the indie app developer. These are
exactly the people we want spreading wisdom.

**We want a community, not an audience.** Open content invites people to
contribute, translate, remix, and build with us. Open licensing is the
foundation for that.

**The Stoic tradition.** Marcus Aurelius wrote the *Meditations* as private
notes. They became one of humanity's most important texts because they were
freely shared. We honor that tradition.

---

## Third-party content

- Background music **"Adrift Among Infinite Stars"** by [Scott Buckley](https://www.scottbuckley.com.au/), licensed under CC-BY 4.0.

---

## Legal entity

**ChipMates gemeinnützige GmbH** (Germany). Registered nonprofit (`gemeinnützig`).
Operator and rightsholder of Agora Cosmica content during the © phase.

For licensing questions or partnership inquiries:
[agoracosmica@chipmates.ai](mailto:agoracosmica@chipmates.ai).
