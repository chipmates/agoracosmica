# Contributing to Agora Cosmica

How to help with the code, the translations, the content and the accessibility of Agora Cosmica, and what a change needs before it can land. It picks up where the README's [Where to start](README.md#where-to-start) leaves off. Everyone taking part agrees to the [code of conduct](CODE_OF_CONDUCT.md).

## Where to start

Code is one way in. A factcheck correction with its source, a translation fix, a bug report with steps to reproduce and an accessibility finding are the others.

| You have | Where it goes |
|---|---|
| Time for a first task | The [good first issues](https://github.com/chipmates/agoracosmica/labels/good%20first%20issue): small and scoped, and we answer questions on them |
| A bug | [A new issue](https://github.com/chipmates/agoracosmica/issues/new/choose) with the bug report form |
| A factcheck error, a wrong date, a figure or a council question to propose | The content suggestion form in the [same picker](https://github.com/chipmates/agoracosmica/issues/new/choose), with the source |
| A feature idea | [Discussions](https://github.com/chipmates/agoracosmica/discussions) first, before anyone writes a PR |
| A security problem | [SECURITY.md](SECURITY.md), which has the private channel |
| A translation | [Translations](#translations) below |

Inside the app, a Community panel lists candidate topics (new languages and new figures among them) and already counts voting power from the teachings you complete. Voting itself opens later, so for now a suggestion travels as an issue or a discussion.

## Setup

Node.js 22 and pnpm 8.15.5, both pinned (`.nvmrc` and the `packageManager` field in `client/package.json`). The install step refuses npm and yarn.

```bash
git clone https://github.com/chipmates/agoracosmica.git
cd agoracosmica/client
pnpm install
pnpm setup:assets
pnpm dev
```

`setup:assets` fetches the content (teachings, figure descriptions, factchecks, voice profiles, instruction prompts) from the production CDN into gitignored folders. Content stays out of the repository under the [content licence](CONTENT-LICENSE.md). Running it again skips what is already there.

The app comes up at `https://localhost:5173`. The dev server uses a self-signed certificate so the microphone works in mobile Safari (your browser will warn about it), and `/` redirects to `/app`.

With nothing else running you get the whole interface and the whole recorded catalog: stories, prisms, councils, factchecks and images come from the production CDN through the Vite proxy. The two live paths sit behind proxies with nothing on the other end. Chat goes to `localhost:8788` and speech to `localhost:8800`, and both fail until something listens there.

Live chat, shortest path: your own OpenRouter key in Settings. Those requests go from the browser to OpenRouter directly and touch no worker. To work on the free tier itself, run the proxy worker beside the app:

```bash
cd workers/llm-proxy
pnpm install
cp .dev.vars.example .dev.vars   # needs a Nebius API key
pnpm dev                          # wrangler dev on port 8788
```

The bot check is skipped for loopback while `TURNSTILE_SECRET_KEY` stays empty in `.dev.vars`.

Live speech: `VITE_AUDIO_API_URL` in `client/.env` is where the speech route goes. `client/.env.example` shows the production gateway, which answers a local dev server (its rate limits apply). Local Mode in Settings is the other way. It points chat, voice and transcription at servers on your own machine, the ones the [self-hosting guide](docs/SELF-HOSTING.md) describes.

## Before a PR

Run what CI runs ([ci.yml](.github/workflows/ci.yml)), from `client/`:

```bash
pnpm exec tsc --noEmit   # type check
pnpm lint                # errors block, warnings pass
pnpm test:unit           # the unit tests, one run (pnpm test is the same in watch mode)
pnpm build               # the full production build, marketing site included
```

Each worker under `workers/` has its own `pnpm install` and `pnpm typecheck`, and llm-proxy and audio-proxy have `pnpm test`. CI runs those for every worker on every pull request. If a check fails and the reason is not obvious, open a Discussion and we look at it with you.

## Code standards

TypeScript strict, functional React with hooks, `tsc --noEmit` at zero errors. Colors come from the custom properties in `client/src/index.css` (hex codes stay out of component CSS), transparency through `color-mix()`, and every interactive element is at least 44 px on a side (WCAG 2.2 AA). pnpm only: `package-lock.json` and `yarn.lock` stay out of the repository.

## Translations

The interface is English and German, and the strings live in `client/src/assets/translations/`. `ui-en.json` and `ui-de.json` are the app. The same folder holds a few more English and German pairs: the public pages (`public-en.json`, `public-de.json`), the helpers and onboarding. Edit the value, keep the key, check it in the running app, and change both languages of a pair in the same PR. A string that exists in one file and is missing from the other is a bug.

The teachings, figure descriptions, factchecks and stories are content and live outside the repository. A wording error there is an issue with the content suggestion form and the source, and we fix it upstream. A new language is a bigger step: open a Discussion. The Community panel lists languages among its topics, and voting on them opens later.

## Pull requests

One concern per PR. The checks above green. A UI change is tried on a phone-sized viewport and keeps keyboard access, screen reader labels and the 44 px targets. UI text changes carry both languages. The [PR template](.github/PULL_REQUEST_TEMPLATE.md) has the checklist.

Commit messages: an imperative subject under 72 characters (`Fix`, `Add`, `Drop`), and a body that says why the change is there. The diff already shows what.

## The Community panel

It sits inside the app, open to everyone who uses it, and shows the candidate topics, your own voting power and tier, and an aggregate snapshot of the community. Voting power comes from completing the four chapters of a teaching: one point when you complete your first, one more for every figure you complete in full. Voting itself opens later. The counts pass through a small worker in `workers/community/` with two endpoints, one that registers a device's voting power and one that reads the snapshot. Device ids and addresses are hashed before they are stored.
