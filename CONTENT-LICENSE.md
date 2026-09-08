# Content License

Agora Cosmica ships under two licenses: one for the source code, one for the
content written and recorded for it. This file covers the content half. The code
is [AGPL-3.0](LICENSE).

## Status

| Component | License | Effective |
|---|---|---|
| **Source code** | [AGPL-3.0](LICENSE) | Now |
| **Content** | © ChipMates gemeinnützige GmbH | Now |
| **Content (transition target)** | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Planned within 6 to 12 months of public launch |

Public launch was v1.0.0 in May 2026, which is the date that window counts from.

Until the CC-BY transition completes, content may not be redistributed without
explicit permission. After the transition, content will be free to share and
adapt under the attribution conditions below.

---

## What "content" covers

Most of it ships in English and German. The "Files" column counts each language
version as a separate licensed deliverable.

| Work | Unique works | Languages | Files |
|---|---:|---|---:|
| Story chapters (12 per figure, 30 figures) | 360 | EN + DE | **720** |
| Forewords (one per figure) | 30 | EN + DE | **60** |
| Council debates (55 questions, two depth levels each) | 110 | EN + DE | **220** |
| Prism dialogues (12 per figure) | 360 | EN + DE | **720** |
| Wisdom teachings (12 per figure) | 360 | EN + DE | **720** |
| Factchecks (one per figure) | 30 | EN + DE | **60** |
| Voice profiles (one per figure) | 30 | EN + DE | **60** |
| Opening messages (one per figure for Free Talk, one per teaching for Wisdom and Quest) | 750 | EN + DE | **1,500** |
| Figure instruction prompts (three per figure) | 90 | language-agnostic | **90** |
| Figure portraits and interface artwork | 30 portraits, plus interface art | language-agnostic | **30+** |

The story chapters, prism dialogues, council debates and opening messages also
exist as narrated audio, each track with a character-level timestamp file. The
audio carries the same license as the text it speaks.

---

## Where content lives in this repo

Two storage locations, both under the same content license:

1. **Fetched from the CDN at setup time.** The bulk of the content (stories,
   prism dialogues, council debates, wisdom teachings, factchecks, voice
   profiles, figure instruction prompts) is gitignored under
   `client/src/assets/`. After `pnpm install`, run `pnpm setup:assets` to pull it
   from `https://media.agoracosmica.org`. This keeps the public source tree small
   and the split between content and code obvious.

2. **Bundled into the LLM proxy worker.** `workers/llm-proxy/src/prompts/instructions.ts`
   is an auto-generated file holding all 90 figure instruction prompts, built by
   `workers/llm-proxy/scripts/bundle-prompts.ts`. The worker needs them at
   request time to serve completions, so they ship inline. Same content, same
   license.

Build-time intermediates are gitignored too. `client/scripts/extract-public-data.mjs`
derives lighter summaries (`src/data/public/seeds/`, `stories/`,
`themeSeedCrossRef.ts`, `figuresCatalog.ts`) from the content on every
`pnpm build`. They feed the prerendered pages and are not tracked separately.

All of the above is © ChipMates during the © phase and becomes CC-BY 4.0 at the
transition.

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

## Why CC-BY 4.0

**The mission comes first.** ChipMates exists to make philosophical wisdom
accessible. Open licensing is the fullest expression of that mission.

**NonCommercial blocks the wrong people.** An NC restriction lands hardest on
small creators and educators: the teacher who charges for a philosophy course,
the newsletter that carries an ad, the developer of a small paid app. Those are
exactly the people we want spreading this material.

**We want a community.** Open content invites people to contribute, translate,
and build with us. Open licensing is the foundation for that.

**The Stoic tradition.** Marcus Aurelius wrote the *Meditations* as private
notes to himself. They became one of humanity's most important texts because
they were freely shared. We honor that tradition.

---

## Third-party content

- Background music **"Adrift Among Infinite Stars"** by [Scott Buckley](https://www.scottbuckley.com.au/), licensed under CC-BY 4.0.
- The council and theme plates are public-domain artworks from museum
  collections. Each plate prints its own institution's record and the rights
  token that record asserts (a CC0 dedication, a Public Domain Mark, or a
  public-domain reproduction), from
  `client/src/components/CosmicCouncil/plates/credits.ts`.

---

## Legal entity

**ChipMates gemeinnützige GmbH** (Germany). Registered nonprofit (`gemeinnützig`).
Operator and rightsholder of Agora Cosmica content during the © phase.

For licensing questions or partnership inquiries:
[agoracosmica@chipmates.ai](mailto:agoracosmica@chipmates.ai).
