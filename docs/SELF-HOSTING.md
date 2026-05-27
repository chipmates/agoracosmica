# Self-Hosting Guide

Run your own Agora Cosmica instance in five minutes with Docker.

## Quickstart

```bash
git clone https://github.com/chipmates/agoracosmica.git
cd agoracosmica
docker compose up -d
```

Open [localhost:8080](http://localhost:8080). On first run, paste your [OpenRouter](https://openrouter.ai/keys) API key into the prompt and you're chatting.

**Requirements:** Docker 24+ (Docker Desktop on Mac/Windows, or Docker Engine on Linux). No GPU needed for the default image.

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
| Live voice input (microphone to text) | Works via Local Mode (Whisper container) |
| Live voice output (text to speech) | Works via Local Mode (Kokoro + Qwen containers) |
| Free tier (30 messages a day) | N/A, BYOK only in self-host |
| Community Governance panel | Hidden, single-user instance |

Push-to-talk transcription, read-aloud, and the pre-rendered audio library all work via the Local Mode panel in v1.1.0. Live-interrupt voice (the production page's two-way streaming mode) stays hosted, since it relies on the multi-tenant GPU gateway.

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

The code is **[AGPL-3.0](../LICENSE)**. Fork freely, copyleft applies to network deployments. The content (stories, prism dialogues, council debates, factchecks, voice profiles, instruction prompts, images, audio) is **© ChipMates gemeinnützige GmbH** at launch, transitioning to **CC-BY 4.0 within 6 to 12 months**. See [CONTENT-LICENSE.md](../CONTENT-LICENSE.md) for the full terms.

**The self-host image deliberately ships no authored text content.** The build sets `VITE_SELF_HOST=true`, which makes `extract-public-data.mjs` emit empty values for every authored field (figure bios, learn lines, seed summaries, seed quotes, voice essences, key concepts, theme cross-refs). The build also skips the SEO prerender step, so no figure HTML pages with bios end up in the image. The SPA still type-checks because the catalog shape is preserved; the fields just hold empty strings.

What this means at runtime:

- **Identifiers ship.** Figure ids and names, seed ids and titles, the hardcoded short tradition labels. Enough for navigation.
- **Everything authored is runtime-fetched.** Pre-recorded audio (figure trailers, story narration, council previews), figure-specific instruction prompts, and council master prompts (advisory/debate templates) all load from `AGORA_MEDIA_BASE_URL` (default `https://media.agoracosmica.org`) when the app needs them. Your browser talks to the configured CDN. The docker image is not a copy of the content.

Default operation is exactly what the public app uses. The same R2 bucket, the same CDN. A self-host instance is content-equivalent to agoracosmica.org without holding a redistributable copy.

---

## Custom audio backend (advanced)

If you already operate a centralised audio backend that speaks the OpenAI-compatible `/v1/audio/speech` and `/v1/audio/transcriptions` endpoints (e.g. a shared GPU server for a household or a small team), set `AGORA_AUDIO_API_URL=https://your-audio.example.com` in `.env` and the hosted-style audio path takes over for every user of this instance.

For a single user on their own machine, prefer Local Mode (below) since it's simpler to operate.

---

## Use Local Mode

v1.1.0 ships a Local Mode panel that routes the LLM, voice synthesis, and transcription to your own machine. Each piece flips independently. Settings → AI Model → Local Mode.

### What this means for your privacy

When you flip on all three Local Mode toggles and point the LLM at your own machine, your conversation never leaves it. Anything you type, anything the figure says back, anything you speak into the mic, anything you hear from the TTS — all of it stays on your hardware.

The browser still fetches catalog content from our CDN at `media.agoracosmica.org` on demand: figure prompts, voice profiles, pre-recorded audio, factchecks. That's the same traffic any visitor to the public site generates. We're not hiding it. **The point is sharper: what you talk about with the figures stays yours.**

Self-host builds also disable every analytics, page, session, ad-attribution, and conversion beacon at build time. Verified in code (`isSelfHost` gates in `pageBeacon.ts`, `entryBeacon.ts`, `playbackBeacon.ts`, `gclidCapture.ts`).

One first-boot note: the audio containers download their model weights from HuggingFace the first time they start (Whisper ~1.5 GB, Kokoro ~300 MB, Qwen3-TTS ~2 GB). Any local LLM endpoint downloads its own model from its own source (LM Studio's catalog, Ollama's registry, etc.). After the one-time pull, runtime is fully local.

### Two ways to run Local Mode

You don't have to host everything. The three toggles (LLM, TTS, STT) are independent. Pick the audience that fits.

| | **Full local** | **BYOK LLM + local voice** |
|---|---|---|
| Profile | Privacy-maximalist, hardware-rich | Privacy-conscious pragmatist |
| Hardware floor | NVIDIA ≥ 8 GB VRAM, or M-series Mac ≥ 32 GB unified RAM | Any laptop, no GPU needed |
| LLM | Local (LM Studio / Ollama / vLLM / llama.cpp) | OpenRouter BYOK |
| Voice synthesis | Local Kokoro (EN) + Qwen3-TTS (DE) | Same |
| Transcription | Local Whisper | Same |
| Why this | "No data leaves my machine, period." | "Why send my voice to a server when I can run it locally?" |

Most self-hosters want the second tier. Voice and transcription are the parts the browser sends raw audio for, so running them locally is a meaningful privacy win even when the LLM stays on a cloud provider.

### What works in Local Mode

| Mode | Status | Notes |
|---|---|---|
| Free Talk (text) | EN + DE | Streams from your LLM. |
| Wisdom | EN + DE | Same as Free Talk, longer context. |
| Story | All | Pre-rendered audio, LLM optional. |
| Prism | EN + DE | |
| Summary | All | Works on 27B+ models. |
| Custom Council | Conditional | Needs a model that follows strict `SPEAKER :: dialogue` format. Qwen 3.6 27B Instruct holds it cleanly. |
| Quest | Conditional | Needs tool-calling support. Without it, dialogue works but `award_seed` won't fire. |
| Live voice (interrupt-driven) | Hosted | Still hosted in v1.1.0. Push-to-talk and read-aloud work locally. |

### Hardware recommendation (LLM tier)

We're direct about the floor because smaller models silently degrade the experience.

| RAM / VRAM | Recommended model | Mode coverage |
|---|---|---|
| 32 GB unified Mac, or 16+ GB VRAM | **Qwen 3.6 27B Instruct, Q4-Q5** | All modes including Custom Council and Quest tool-calling |
| 64 GB unified Mac, or 24+ GB VRAM | Qwen 3.6 27B Instruct, Q6-Q8 | Same as above with more headroom |
| Below 32 GB unified, or below 16 GB VRAM | None we'd recommend | Stay on the hosted experience. A 7B model breaks the "same models we run on our servers" contract. |

Audio + STT containers add ~5-6 GB across Kokoro, Whisper, and Qwen TTS (on CUDA). MLX TTS on Apple Silicon runs native (no container), uses ~5.7 GB peak.

**LLM context size: set to 32k.** Free Talk and Wisdom fit comfortably in 16k. Custom Council with 5+ figures hits ~14k for a 3-figure council, so 16k is too tight if you want six-figure councils. 32k is the safe default.

### LM Studio walkthrough

1. Download LM Studio: <https://lmstudio.ai>.
2. Inside LM Studio, download `Qwen3.6-27B-Instruct-Revised-GGUF` (or any other 27B-class instruction-tuned model).
3. Open the *Local Server* tab. **Turn on the "Enable CORS" toggle.** Set context length to 32k. Start the server on port 1234.
4. In Agora Cosmica: Settings → Local Mode → flip the **LLM** toggle. Paste `http://localhost:1234/v1` into the endpoint URL field, type `qwen3.6-27b-instruct` as the model name, click *Test* → green pill, then *Save*.

The TTS and STT toggles are independent. You can leave them off (hosted voice/transcription) or flip them on after starting the audio containers below.

### Ollama walkthrough

1. Install Ollama: <https://ollama.com>.
2. Pull a model: `ollama pull qwen2.5:32b-instruct-q4_K_M` (or any 27B-class equivalent).
3. Set `OLLAMA_ORIGINS=*` so the browser can reach the server. On macOS:
   ```bash
   launchctl setenv OLLAMA_ORIGINS "*"
   ```
   Then restart Ollama. On Linux: `OLLAMA_ORIGINS=* ollama serve`.
4. In Agora Cosmica: Settings → Local Mode → flip the **LLM** toggle. Paste `http://localhost:11434/v1`, type the model name, click *Test* → green pill, then *Save*.

### Audio + STT setup (Linux / Windows with NVIDIA)

The `docker-compose.yml` ships four services. By default it brings up the app, Kokoro (EN TTS), and Whisper. To add Qwen3-TTS DE, use the `nvidia` profile:

```bash
docker compose --profile nvidia up -d
```

That starts:
- `agoracosmica` on `:8080` — the app
- `tts-kokoro` on `:8880` — English TTS (Kokoro 82M, CPU image by default, single-worker)
- `tts-qwen` on `:8887` — German TTS (Qwen3-TTS 0.6B Base, CUDA-only)
- `stt-whisper` on `:8000` — Whisper (faster-whisper-large-v3-turbo, ~1.5 GB, ~5x faster than large-v3 on CPU)

First boot of `stt-whisper` downloads the turbo model (~1.5 GB) into the `whisper-cache` named volume. Subsequent starts skip the download. Same pattern on `tts-qwen` for the Qwen weights (~2 GB).

In Agora Cosmica: Settings → Local Mode → flip the **TTS** and **STT** toggles. Endpoint URLs default to `http://localhost:8880` / `http://localhost:8887` / `http://localhost:8000` if you leave the override fields empty.

### Audio + STT setup (Apple Silicon Mac)

vLLM and faster-qwen3-tts are CUDA-only, so DE TTS on Apple Silicon runs natively via MLX rather than in docker. EN TTS (Kokoro) and STT (Whisper) still run in docker because both have working CPU paths.

```bash
# 1. Bring up the docker stack (app + Kokoro + Whisper)
docker compose up -d

# 2. Set up the native MLX Qwen TTS server (one-time)
bash scripts/setup-local-tts-apple.sh
```

The script creates a Python venv under `~/Library/AgoraLocalTTS`, installs `mlx-audio`, downloads `mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit`, stages an OpenAI-compatible FastAPI wrapper at `mlx_server.py`, and writes a launchd plist so the server starts on login. End result: `http://localhost:8887/v1/audio/speech` matches the docker container's shape exactly.

**ffmpeg recommendation:** install `brew install ffmpeg` before running the setup script. It's used for MP3 transcoding when an iOS device on your LAN hits the DE TTS endpoint (iOS Safari plays MP3 via HTML5 audio reliably, WAV is flaky). Without ffmpeg the server still works for desktop browsers but iOS clients on the LAN fall back to hosted.

Real-time factor on M-series: 0.92x (faster than realtime). Peak memory 5.7 GB. Cold-first-synth 1.3s for a never-seen voice.

Uninstall:
```bash
launchctl unload ~/Library/LaunchAgents/org.agoracosmica.local-tts.plist
rm -rf ~/Library/AgoraLocalTTS ~/Library/LaunchAgents/org.agoracosmica.local-tts.plist
```

### LAN deployment (the homelab pattern)

If you have one box with NVIDIA or an M-series Mac running the full audio stack, every other device on the same LAN can point its Local Mode TTS+STT toggles at that box. iPad, laptop, phone, all of them get voice without sending audio to a server.

In each device's Settings → Local Mode → TTS endpoint URL, paste `http://your-homelab.local:8880` (Kokoro) and `http://your-homelab.local:8887` (Qwen). Same pattern for STT: `http://your-homelab.local:8000`.

CORS is already configured on the containers and on the MLX wrapper. If you tighten the allowlist for production use, edit `ALLOW_ORIGINS` (Whisper) or `CORS_ALLOW_ORIGINS` (Qwen + MLX) to your real origins.

A separate companion repo, [`chipmates/f5-server`](https://github.com/chipmates/f5-server), packages our production F5-TTS deployment as a standalone OpenAI-compatible service for operators who specifically want F5 (German overflow tier in our production, MIT-licensed code with bring-your-own-checkpoint). For LAN-deployed Apple Silicon homelabs the MLX path above is faster per request and what we recommend.

### CORS troubleshooting

If chat fails immediately and the browser console says "blocked by CORS policy", the local LLM server isn't allowing the browser to call it.

- **LM Studio**: open the Local Server tab, find the *Enable CORS* toggle, turn it on, restart the server.
- **Ollama**: set `OLLAMA_ORIGINS=*` (or a specific origin like `http://localhost:5173` for dev) and restart Ollama.
- **vLLM**: launch with `--allowed-origins '*'`.
- **llama.cpp**: usually needs a reverse proxy that adds the `Access-Control-Allow-Origin: *` header.

The audio + STT containers we ship have CORS enabled by default.

### Self-host licensing reality

If you're self-hosting for commercial use, the F5-TTS German fine-tuning is CC-BY-NC-4.0 (non-commercial only). Our production primary is Qwen3-TTS, which is fine commercially. F5 is the overflow tier and the only piece with the NC restriction. The audio output is in the same legal position as the weights. If your use is non-commercial (personal, research, nonprofit), the NC license doesn't restrict you.

Code in this repo is AGPL-3.0. The companion `chipmates/f5-server` repo is MIT. Content is © ChipMates gemeinnützige GmbH transitioning to CC-BY 4.0.

---

## Architecture notes

- **No database.** Chats, settings, completion progress, and voting power all live in IndexedDB inside your browser.
- **No server-side state.** The container is stateless: pull, run, restart, no migrations, no data dir to back up.
- **No accounts.** BYOK keys are stored client-side, encrypted with AES-256-GCM.
- **No telemetry of our own.** The self-host build disables every analytics, page, session, ad-attribution, and conversion beacon at build time. At runtime, your browser talks to: your chosen LLM endpoint (OpenRouter via BYOK, or your local LLM when Local Mode is on), any local audio containers you've started, and our content CDN (`media.agoracosmica.org`) for figure prompts and pre-recorded audio. The audio containers fetch their own model weights from HuggingFace on first start. After that, the audio path is fully local.

---

## Questions?

Open a [GitHub Discussion](https://github.com/chipmates/agoracosmica/discussions) or file an issue. For security reports, see [SECURITY.md](../SECURITY.md).
