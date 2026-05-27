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

## Use Local Mode

**v1.1.0 ships a Local Mode toggle that runs the whole user-facing pipeline on your machine: LLM, voice synthesis, and transcription.** Settings → AI Model & Your Key → Local Mode → on.

The honest framing line, verbatim: *"With Local Mode and a local model, no conversation, voice, or text data leaves your machine. The same models we run on our servers run on yours."*

### What works

| Mode | Local Mode (full) | Notes |
|---|---|---|
| Free Talk (text chat) | ✅ EN + DE | Streams from your LLM |
| Wisdom | ✅ EN + DE | Same as Free Talk, longer context |
| Story | ✅ | Pre-rendered audio, LLM optional |
| Prism | ✅ EN + DE | |
| Summary | ✅ | Works on 7B+ instruction-tuned models |
| Custom Council | ⚠️ | Needs a model that follows strict `SPEAKER :: dialogue` format. Qwen2.5-32B / Llama-3.3-70B / Mistral-Large recommended. |
| Quest | ⚠️ | Needs tool-calling support; without it, dialogue works but `award_seed` won't fire. |
| Live voice (interrupt-driven) | ❌ | Still hosted in v1.1.0. Push-to-talk + read-aloud work. |

### Hardware

| Tier | Hardware | LLM | TTS EN | TTS DE | STT |
|---|---|---|---|---|---|
| Full (NVIDIA) | NVIDIA ≥ 8 GB VRAM + 16 GB RAM | LM Studio / Ollama / vLLM | Kokoro container | Qwen container | Whisper container |
| Full (Apple) | M-series Mac ≥ 16 GB unified RAM | LM Studio (MLX) | Kokoro container | Native MLX (setup script) | Whisper container |
| Reduced | M-series Mac < 16 GB, or no GPU | LM Studio (small CPU model) | Kokoro (CPU) | falls back to cloud | Whisper-base CPU |

VRAM math for the NVIDIA full tier: Qwen ~3.8 GB (capped) + Kokoro ~1.7 GB + Whisper ~2.2 GB + LLM (7B Q4) ~5 GB ≈ **13 GB total**.

### LM Studio walkthrough

1. Download LM Studio: <https://lmstudio.ai>.
2. Inside LM Studio, download a competent instruction-tuned model. Tested first-run choice: `qwen2.5-7b-instruct-q4_k_m` (~5 GB, multilingual, fast).
3. Open the *Local Server* tab. **Turn on the "Enable CORS" toggle.** Start the server on port 1234.
4. In the Agora Cosmica settings → Local Mode → paste `http://localhost:1234/v1` as the endpoint URL, type `qwen2.5-7b-instruct` (or whatever LM Studio shows) as the model name, click *Test connection* → green pill, then *Save*.

### Ollama walkthrough

1. Install Ollama: <https://ollama.com>.
2. Pull a model: `ollama pull llama3.1:8b` (or `qwen2.5:7b`).
3. Set `OLLAMA_ORIGINS=*` so the browser can reach the server. On macOS:
   ```bash
   launchctl setenv OLLAMA_ORIGINS "*"
   ```
   Then restart Ollama. On Linux: `OLLAMA_ORIGINS=* ollama serve`.
4. In Agora Cosmica settings → Local Mode → paste `http://localhost:11434/v1`, type `llama3.1:8b`, click *Test connection* → green pill, then *Save*.

### Audio + STT setup (Linux / Windows with NVIDIA)

The agoracosmica `docker-compose.yml` ships four services. By default it brings up the app + Kokoro EN + Whisper. To add Qwen3-TTS DE, use the `nvidia` profile:

```bash
docker compose --profile nvidia up -d
```

That starts:
- `agoracosmica`   on `:8080` — the app
- `tts-kokoro`     on `:8880` — English TTS (Kokoro, 82M, single-worker)
- `tts-qwen`       on `:8887` — German TTS (Qwen3-TTS-12Hz-0.6B-Base via faster-qwen3-tts)
- `stt-whisper`    on `:8000` — Whisper (faster-whisper-large-v3, auto device)

First boot of `tts-qwen` downloads the Qwen weights (~2 GB) and the 10 archetype voice references from R2 (~11 MB). Subsequent starts are warm.

### Audio + STT setup (Apple Silicon Mac)

vLLM is CUDA-only, so DE TTS on Apple Silicon runs natively via MLX rather than in docker. EN TTS + STT still run in docker.

```bash
# 1. Start the dockerised stack (app + Kokoro + Whisper)
docker compose up -d

# 2. Set up the native MLX Qwen TTS server (once)
bash scripts/setup-local-tts-apple.sh
```

The script creates a Python venv under `~/Library/AgoraLocalTTS`, installs the kapi2800/qwen3-tts-apple-silicon MLX port, writes a launchd plist so the server starts on login, and brings up an OpenAI-compatible endpoint at `http://localhost:8887/v1/audio/speech` — same shape as the docker container.

Uninstall:
```bash
launchctl unload ~/Library/LaunchAgents/org.agoracosmica.local-tts.plist
rm -rf ~/Library/AgoraLocalTTS ~/Library/LaunchAgents/org.agoracosmica.local-tts.plist
```

### CORS troubleshooting

If chat fails immediately and the browser console says "blocked by CORS policy", the local LLM server isn't allowing the browser to call it.

- **LM Studio**: open the Local Server tab, find the *Enable CORS* toggle, turn it on, restart the server.
- **Ollama**: set `OLLAMA_ORIGINS=*` (or a specific origin like `http://localhost:5173` for dev) and restart Ollama.
- **vLLM**: launch with `--allowed-origins '*'`.
- **llama.cpp**: usually requires a reverse proxy that adds the `Access-Control-Allow-Origin: *` header.

The audio + STT containers we ship don't need CORS configuration — they bind to localhost and run inside the same docker network as the app.

### Honest framing

Local Mode + a local LLM + no live voice = no conversation or voice data leaves your machine. With docker self-host too, the entire pipeline runs on your hardware. We don't claim "100% private" (the app's static assets still load from agoracosmica.org unless you also serve them locally), we don't claim "fully offline", and we don't claim "anonymous". The actual property is sharper: same models, same voices, running on your machine.

---

## Architecture notes

- **No database.** Chats, settings, completion progress, and voting power all live in IndexedDB inside your browser.
- **No server-side state.** The container is stateless: pull, run, restart, no migrations, no data dir to back up.
- **No accounts.** BYOK keys are stored client-side, encrypted with AES-256-GCM.
- **No telemetry.** Self-host disables every analytics, page-view, session, ad-attribution, and conversion beacon. The container talks to OpenRouter (your BYOK key, browser-direct) and the content CDN you configure. Nothing else.

---

## Questions?

Open a [GitHub Discussion](https://github.com/chipmates/agoracosmica/discussions) or file an issue. For security reports, see [SECURITY.md](../SECURITY.md).
