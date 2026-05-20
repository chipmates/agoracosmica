# Self-Hosting Guide

Run your own Agora Cosmica instance in five minutes with Docker.

## Quickstart

```bash
git clone https://github.com/chipmates/agoracosmica.git
cd agoracosmica
docker compose up -d
```

Open [localhost:8080](http://localhost:8080). On first run, paste your [OpenRouter](https://openrouter.ai/keys) API key into the prompt and you're chatting.

**Requirements:** Docker 24+ (Docker Desktop on Mac/Windows, or Docker Engine on Linux). No GPU needed for the v1 image.

---

## What works out of the box

| Feature | Status |
|---|---|
| Six modes: Story, Wisdom, Prism, Quest, Free Talk, Council | Works |
| 30 historical figures, 360 wisdom teachings | Works |
| 360 narrative stories, 360 prism dialogues, 110 council debates | Works |
| Pre-recorded audio (figure trailers, story narration, council previews) | Works |
| BYOK chat via OpenRouter (browser to OpenRouter direct, no proxy) | Works |
| Bilingual English and German | Works |
| Live voice input (microphone to text) | Disabled, needs your own GPU server |
| Live voice output (text to speech) | Disabled, needs your own GPU server |
| Free tier (30 messages a day) | N/A, BYOK only in self-host |
| Community Governance panel | Hidden, single-user instance |

Live voice is the only meaningful gap. The microphone button and live-TTS controls hide cleanly when no audio backend is configured. Pre-recorded narration, council previews, and figure trailers all keep playing.

---

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

The defaults work out of the box. The settings you may want to change:

| Variable | Default | What it does |
|---|---|---|
| `AGORA_HOST_PORT` | `8080` | Host-side port. The container always listens on 8080 inside. |
| `AGORA_MEDIA_BASE_URL` | `https://media.agoracosmica.org` | Content CDN. The default points at ChipMates' open R2 bucket. |
| `AGORA_AUDIO_API_URL` | (empty) | Live audio backend. Leave empty unless you operate your own GPU TTS server. |

After editing `.env`, restart with `docker compose up -d`. The container rewrites `/config.js` from these env vars on every start, so no rebuild is needed.

### Same-origin content mirror

To serve content from your own box instead of the upstream CDN (offline-capable, single-origin), mirror the content tree into a local directory and mount it:

```yaml
# docker-compose.yml
services:
  app:
    # ...
    volumes:
      - ./media:/usr/share/nginx/html/media:ro
```

Then set `AGORA_MEDIA_BASE_URL=/media` in `.env` and populate `./media/` matching the upstream layout: `seeds/{en,de}/`, `figure-translations/{en,de}/`, `factchecks/{en,de}/`, `voice-profiles/{en,de}/`, `instructions/<figure>/`, plus `images/`, `stories/`, `trailers/`, etc.

### Custom content domain

If you point the app at a content domain that is not `*.agoracosmica.org`, update the Content-Security-Policy in `client/index.html` to allow your origin in `img-src`, `media-src`, and `connect-src`, then rebuild from source (see below). The default CSP already allows `*.agoracosmica.org`, so the upstream CDN works without changes.

---

## Build from source

The default `docker-compose.yml` pulls a prebuilt image from GHCR. To build locally instead, edit `docker-compose.yml` so the `image:` line is commented and the `build:` block is uncommented:

```yaml
services:
  app:
    # image: ghcr.io/chipmates/agoracosmica:latest
    build:
      context: ./client
      dockerfile: Dockerfile
```

Then:

```bash
docker compose up --build -d
```

First build takes 2 to 3 minutes (pnpm install, pnpm build, a one-time content fetch from the CDN into the build context).

---

## Content licensing

The code is **[AGPL-3.0](../LICENSE)** — fork freely, copyleft applies to network deployments. The content (stories, prism dialogues, council debates, factchecks, voice profiles, instruction prompts, images, audio) is **© ChipMates gemeinnützige GmbH** at launch, transitioning to **CC-BY 4.0 within 6 to 12 months**. See [CONTENT-LICENSE.md](../CONTENT-LICENSE.md) for the full terms.

**The self-host image deliberately ships no authored text content.** The build sets `VITE_SELF_HOST=true`, which makes `extract-public-data.mjs` emit empty values for every authored field (figure bios, learn lines, seed summaries, seed quotes, voice essences, key concepts, theme cross-refs). The build also skips the SEO prerender step, so no figure HTML pages with bios end up in the image. The SPA still type-checks because the catalog shape is preserved; the fields just hold empty strings.

What this means at runtime:

- **Identifiers ship** — figure ids and names, seed ids and titles, the hardcoded short tradition labels. Enough for navigation.
- **Everything authored is runtime-fetched** — pre-recorded audio (figure trailers, story narration, council previews), figure-specific instruction prompts, and council master prompts (advisory/debate templates) all load from `AGORA_MEDIA_BASE_URL` (default `https://media.agoracosmica.org`) when the app needs them. Your browser talks to the configured CDN; the docker image is not a copy of the content.

Default operation is exactly what the public app uses — the same R2 bucket, the same CDN — so a self-host instance is content-equivalent to agoracosmica.org without holding a redistributable copy.

---

## Live voice (post-v1)

Live text-to-speech and speech-to-text need a GPU. The v1 self-host image ships without them on purpose: the GPU server stack is non-trivial (Kokoro TTS, F5-TTS, Qwen3-TTS, Faster-Whisper, nginx reverse proxy with TLS, bearer auth, failover routing) and is a separate post-v1 effort.

If you already operate an audio backend that speaks the OpenAI-compatible `/v1/audio/speech` and `/v1/audio/transcriptions` endpoints, set `AGORA_AUDIO_API_URL=https://your-audio.example.com` in `.env` and live voice unhides itself.

---

## Architecture notes

- **No database.** Chats, settings, completion progress, and voting power all live in IndexedDB inside your browser.
- **No server-side state.** The container is stateless: pull, run, restart, no migrations, no data dir to back up.
- **No accounts.** BYOK keys are stored client-side, encrypted with AES-256-GCM.
- **No telemetry.** Self-host disables every analytics, page-view, session, ad-attribution, and conversion beacon. The container talks to OpenRouter (your BYOK key, browser-direct) and the content CDN you configure. Nothing else.

---

## Questions?

Open a [GitHub Discussion](https://github.com/chipmates/agoracosmica/discussions) or file an issue. For security reports, see [SECURITY.md](../SECURITY.md).
