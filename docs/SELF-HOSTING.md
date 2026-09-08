# Self-hosting Agora Cosmica

This guide is for an operator running Agora Cosmica on their own hardware. [The README](../README.md) describes the product and what the six formats do.

One `docker compose up` gives you the whole app with your own OpenRouter key. From there, speech and transcription can move onto your machine, and the model itself after them, in any order. Stop at whatever point satisfies you.

A self-host instance carries all six formats (Story, Wisdom, Prism, Quest, Free Talk, Council), all 30 figures, the pre-recorded audio library in English and German, and push-to-talk transcription. The hosted free tier and the Community panel stay hosted-only. The self-host build is also analytics-silent, spelled out under [what leaves your machine](#what-leaves-your-machine).

**What you need:** Docker 24 or newer (Docker Desktop on macOS and Windows, Docker Engine on Linux). No GPU for the default stack. On Docker Desktop, give the VM at least 4 GB of memory under Settings, Resources, so the speech containers have room. Running the model on your own machine has a real hardware floor, stated where that step comes up.

---

## Start the stack

```bash
git clone https://github.com/chipmates/agoracosmica.git
cd agoracosmica
docker compose up -d
```

Open <http://localhost:8080>. On first run, paste an [OpenRouter](https://openrouter.ai/keys) API key when prompted. You're chatting.

**Verify the app is up:**
```bash
curl http://localhost:8080/healthz
```
Returns `ok` when healthy.

The default `docker compose up` starts three containers: the app on port 8080, Kokoro (English speech) on port 8880, and Whisper (transcription) on port 8000. The two speech containers pull about 1.8 GB of model weights on first boot (Whisper about 1.5 GB, Kokoro about 300 MB), so they take a few minutes to report healthy. The app answers the moment port 8080 does, so you can start chatting while they warm up.

Four images are published to `ghcr.io/chipmates` from the release tag: `agoracosmica` (the app), `agoracosmica-tts-kokoro` and `agoracosmica-stt-whisper`, all three built for `linux/amd64` and `linux/arm64`, plus `agoracosmica-tts-qwen-cuda`, which is CUDA-only and therefore `linux/amd64` only.

### Configuration

Copy `.env.example` to `.env` and edit if you need to override defaults:

| Variable | Default | What it does |
|---|---|---|
| `AGORA_HOST_PORT` | `8080` | Host-side port for the app. |
| `AGORA_MEDIA_BASE_URL` | `https://media.agoracosmica.org` | Content CDN for figure prompts, voice profiles, and pre-recorded audio. |
| `AGORA_TTS_KOKORO_PORT` | `8880` | Host-side port for Kokoro (English speech). |
| `AGORA_STT_PORT` | `8000` | Host-side port for Whisper (transcription). Change it if 8000 is already taken. |
| `AGORA_TTS_QWEN_PORT` | `8887` | Host-side port for Qwen3-TTS (German, `nvidia` profile). |
| `AGORA_AUDIO_API_URL` | (empty) | Optional centralized audio backend (see Operator notes). Empty keeps audio local. |

After editing `.env`, restart with `docker compose up -d`. The container rewrites `/config.js` from these env vars on every start, so no rebuild is needed.

### Stop, remove, update

```bash
docker compose down                            # stop and remove the containers
docker compose down -v                         # also drop the cached Whisper model
docker compose pull && docker compose up -d    # update to the latest published images
```

---

## Use Local Mode

Local Mode has three independent toggles in Settings: speech, transcription, and the model. The Kokoro and Whisper containers from the previous step are already running on your machine, so the first two are one click each:

1. Open <http://localhost:8080>.
2. Settings → Preferences → Local Mode.
3. Flip the **TTS** toggle. Click *Test*. You should see "Reachable" in green next to the field.
4. Flip the **STT** toggle. Same drill.
5. Click *Save*.

> **What changed:** microphone audio and the voice you hear now stay on your machine. Your chat text still goes to OpenRouter (or wherever the LLM is set) until the next step.

**English speech on a self-host instance is Kokoro, and only Kokoro.** The hosted site defaults English to Qwen3-TTS with Kokoro as the alternative, and the published image matrix has no English Qwen image. So with the TTS toggle on, the app pins English to Kokoro and freezes the engine choice in Settings. Ten Kokoro voices, five per gender. German runs the other way round: Qwen3-TTS is the only engine there, and the next section sets it up.

### German speech (optional)

For German you need Qwen3-TTS, and the path depends on your hardware.

**NVIDIA Linux / Windows:**
```bash
docker compose --profile nvidia up -d
```
Adds Qwen3-TTS on port 8887. First boot downloads about 2 GB of model weights from HuggingFace.

**Apple Silicon Mac:**
```bash
bash scripts/setup-local-tts-apple.sh
```
MLX has no Metal passthrough inside Docker, so this path runs natively. The script builds a Python venv under `~/Library/AgoraLocalTTS/`, installs `mlx-audio` with a FastAPI wrapper, downloads the `mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit` weights (about 1 GB, one time), and registers a launchd agent that serves port 8887 and restarts on login. First start also fetches ten archetype voices (about 5 MB). The server's default language is German, which is the language the app routes to it. Requirements: macOS 14 or newer on Apple Silicon, the Xcode command line tools, and Python 3.11 or newer. The script is idempotent, so re-running it updates the venv in place.

Either path exposes Qwen3-TTS at `localhost:8887`. The TTS toggle from above routes German turns to it automatically.

To uninstall the MLX server later:
```bash
launchctl unload ~/Library/LaunchAgents/org.agoracosmica.local-tts.plist
rm -rf ~/Library/AgoraLocalTTS ~/Library/LaunchAgents/org.agoracosmica.local-tts.plist
```

### Speed up transcription on Apple Silicon (recommended)

Docker on macOS runs in a Linux VM with no Metal passthrough, so the Whisper container falls back to CPU. Whisper's 30-second encoder window means a short utterance still takes about ten seconds there. Running Whisper natively via MLX brings a short utterance under a second. Same model, `large-v3-turbo`, same quality.

```bash
bash scripts/setup-local-stt-apple.sh
```

Installs `mlx-whisper` into `~/Library/AgoraLocalSTT/`, downloads about 1.5 GB of weights, registers a launchd agent, and stops the Docker Whisper container so nothing else is holding port 8000. The STT toggle keeps pointing at `localhost:8000` and now hits the MLX server.

**Requirement:** ffmpeg on PATH, which `mlx-whisper` shells out to for audio decoding. Install with `brew install ffmpeg` if you don't already have it.

To uninstall:
```bash
launchctl unload ~/Library/LaunchAgents/org.agoracosmica.local-stt.plist
rm -rf ~/Library/AgoraLocalSTT ~/Library/LaunchAgents/org.agoracosmica.local-stt.plist
```

### Verify

```bash
curl http://localhost:8880/v1/models    # Kokoro, English speech
curl http://localhost:8000/v1/models    # Whisper, transcription
curl http://localhost:8887/health       # Qwen3-TTS, German, if installed
```

All should return JSON.

---

## Run the model on your own machine

This is the heavy step. With the LLM toggle on, the conversation itself never reaches an external service, and that takes real hardware.

**The model we recommend:** [`Smoffyy/Qwen3.6-27B-Instruct-Revised-GGUF`](https://huggingface.co/Smoffyy/Qwen3.6-27B-Instruct-Revised-GGUF), **Q4_K_M** variant (about 16 GB). It's a compact 27B that runs on a single GPU. Our hosted free tier runs DeepSeek V4 Pro with Qwen3-235B as the fallback, and in our own tests this compact model comes out about even with the 235B on these conversations. It holds the custom-council `SPEAKER :: dialogue` format cleanly and supports tool calling, so the Quest format's `award_seed` still fires.

**Hardware floor:**
- 32 GB unified RAM on Apple Silicon, or
- 16 GB or more of VRAM on NVIDIA

Under that floor, leave the LLM toggle off. OpenRouter with your own key handles the chat fine, and the speech and transcription you set up above stay local either way.

### LM Studio (recommended)

1. Download [LM Studio](https://lmstudio.ai).
2. In the Discover tab, search `Smoffyy/Qwen3.6-27B-Instruct-Revised-GGUF`. Download the file with `Q4_K_M` in its name (about 16 GB).
3. Open the Local Server tab (left rail). Load the model. Set Context Length to **32768** (32k). **Toggle "Enable CORS" ON**.
4. Click *Start Server*. Logs should show `Running on port 1234`.
5. In Agora Cosmica: Settings → Preferences → Local Mode. Flip the **LLM** toggle.
6. Paste `http://localhost:1234/v1` as the endpoint URL. Type `qwen3.6-27b-instruct-revised` as the model name. Click *Test*. You should see "Reachable" in green next to the field. Click *Save*.

> **What changed:** anything you type and anything the figure says back stays on your machine.

**Verify:**
```bash
curl http://localhost:1234/v1/models
```
should list your loaded model.

### Ollama

1. Install [Ollama](https://ollama.com).
2. Pull the same model straight from HuggingFace (Ollama reads GGUF repos directly, no Modelfile needed):
   ```bash
   ollama pull hf.co/Smoffyy/Qwen3.6-27B-Instruct-Revised-GGUF:Q4_K_M
   ```
3. Enable CORS for browser access and raise the context window. Both are environment variables. Ollama defaults to a 4k (or smaller) context that truncates the figure prompts, so set 32k to match the LM Studio step above:
   - **macOS:** `launchctl setenv OLLAMA_ORIGINS "*"` and `launchctl setenv OLLAMA_CONTEXT_LENGTH 32768`, then restart Ollama.
   - **Linux:** start with `OLLAMA_ORIGINS=* OLLAMA_CONTEXT_LENGTH=32768 ollama serve`.
4. In Agora Cosmica: Settings → Preferences → Local Mode. Flip the **LLM** toggle. Paste `http://localhost:11434/v1` as the endpoint. Type the model name exactly as pulled (`hf.co/Smoffyy/Qwen3.6-27B-Instruct-Revised-GGUF:Q4_K_M`). Click *Test*, wait for "Reachable", then *Save*.

vLLM and llama.cpp work the same way, and so does any other OpenAI-compatible endpoint you run. The app only needs a base URL and a model name.

### What works on a local model

With the recommended 27B-class setup, one exception aside:
- Free Talk, Wisdom, Prism: stream cleanly in both languages.
- Story: pre-recorded audio, no model call needed.
- Summary: works on 27B-class models.
- Council: a 27B-class model holds the strict `SPEAKER :: dialogue` format.
- Quest: 27B-class models support tool calling, so the `award_seed` event still fires.

The live-interrupt voice conversation (two-way streaming) stays hosted in this release, since it runs through the multi-tenant GPU gateway. Push-to-talk and read-aloud both work locally once Local Mode is wired.

---

## What leaves your machine

With all three Local Mode toggles on and the model pointed at your own endpoint, your conversation never leaves it. Anything you type, anything the figure says back, anything you speak into the mic, and anything you hear from the TTS all stays on your hardware.

The browser still fetches catalog content from our CDN at `media.agoracosmica.org` on demand: figure prompts, voice profiles, pre-recorded audio, factchecks. That's the same traffic any visitor to the public site generates. We're not hiding it. **The point is sharper: what you talk about with the figures stays yours.** To serve the catalog from your own box, mirror the content tree into `./media`, uncomment the `volumes:` block under the `app` service in `docker-compose.yml`, and set `AGORA_MEDIA_BASE_URL=/media`.

A self-host build also compiles out every usage beacon at build time, the ad-attribution path with them, and it skips the bot-check. Checkable in code: the `isSelfHost` gates in `pageBeacon.ts`, `entryBeacon.ts`, `playbackBeacon.ts`, `funnelBeacon.ts`, `signupBeacon.ts` and `utils/public/gclidCapture.ts`.

**First-boot note:** the speech containers download model weights from HuggingFace the first time they start (Whisper about 1.5 GB, Kokoro about 300 MB, Qwen3-TTS about 2 GB). Any local model endpoint downloads its own weights from its own source. After the one-time pull, runtime is fully local.

---

## Troubleshooting

**Chat fails immediately with "blocked by CORS policy".** The local model server isn't allowing the browser to call it.

- **LM Studio:** open the Local Server tab, find the *Enable CORS* toggle, turn it on, restart the server.
- **Ollama:** set `OLLAMA_ORIGINS=*` (or the app's own origin, `http://localhost:8080` by default) and restart Ollama.
- **vLLM:** launch with `--allowed-origins '*'`.
- **llama.cpp:** usually needs a reverse proxy that adds the `Access-Control-Allow-Origin: *` header.

The speech and transcription containers ship with CORS enabled by default. The MLX wrapper on Apple Silicon also sets `CORS_ALLOW_ORIGINS=*` out of the box.

**The "Test" button shows "Unreachable".** Work down this list:
- Is the server actually running? (LM Studio: Local Server tab shows "Running". Ollama: `ollama list` plus check the daemon is up. Audio: `docker ps`.)
- Does the port match what's in the panel? (LM Studio defaults to 1234, Ollama to 11434, the audio containers to 8880 / 8000 / 8887.)
- Is CORS enabled? (See above.)
- Does the URL include `/v1` where required? LM Studio and Ollama want it, the audio containers don't.
- Is the endpoint on `localhost` or `127.0.0.1`? Any other host needs the policy change under Operator notes.

**The first transcription is slow.** Whisper lazy-loads the model on first request. The entrypoint pre-pulls the model on container start, so this should only happen if the cache volume gets cleared.

---

## Operator notes

**What the compose file exposes.** `docker-compose.yml` publishes every port without a host address (`"${AGORA_HOST_PORT:-8080}:8080"`, and the three speech ports the same way), so Docker binds them on all interfaces. From the moment the stack is up, any device that can route to the host reaches the app and the speech servers over plain HTTP, with no TLS and no authentication in front of them. To keep the stack on one machine, put an explicit address on the host side of each mapping (`127.0.0.1:8080:8080`) and restart.

**Reaching the stack from other devices.** One box running the full audio stack can serve every other device on the same network, and two things have to be true first.

- The shipped Content-Security-Policy in `client/index.html` allows `connect-src` only to the app's own origin, `openrouter.ai`, `*.agoracosmica.org`, and `http://localhost` / `http://127.0.0.1` on any port. A speech endpoint on another host, or on an `https` origin of your own, needs that policy widened and the image rebuilt from source.
- Browsers grant microphone access only in a secure context. `localhost` counts as one, a LAN address over plain HTTP does not, so push-to-talk needs TLS as soon as the app is served from anything other than localhost. That means your own reverse proxy with a certificate, in front of the app and in front of every speech port a browser will call.

Once both are true, each device points its Local Mode toggles at the shared box: the Kokoro port for English speech, the Qwen port for German, the Whisper port for transcription.

**Custom audio backend.** If you operate a centralized GPU audio server speaking the OpenAI-compatible `/v1/audio/speech` and `/v1/audio/transcriptions` endpoints (a household or small-team server, say), set `AGORA_AUDIO_API_URL=https://your-audio.example.com` in `.env`. The hosted-style audio path then takes over for every user of this instance.

**Custom content domain.** If you point the app at a content domain other than `*.agoracosmica.org`, update the Content-Security-Policy in `client/index.html` to allow your origin in `img-src`, `media-src`, and `connect-src`, then rebuild from source. The default policy already allows `*.agoracosmica.org`, so the upstream CDN works without changes.

**Build from source.** The default `docker-compose.yml` pulls a prebuilt image from GHCR. To build locally, comment the `image:` line and uncomment the `build:` block under the `app` service, then `docker compose up --build -d`. First build takes two to three minutes (pnpm install, pnpm build, a one-time content fetch from the CDN into the build context).

**A standalone speech server.** The companion repo [`chipmates/f5-server`](https://github.com/chipmates/f5-server) packages a speech server with an OpenAI-compatible API. Its code is MIT and the operator brings the model checkpoint. It sits outside this compose file and outside our production stack.

---

## Licensing

Code is **[AGPL-3.0](../LICENSE)**. Fork freely, copyleft applies to network deployments.

Content (stories, prism dialogues, council debates, factchecks, voice profiles, instruction prompts, images, audio) is **© ChipMates gemeinnützige GmbH** at launch, moving to **CC-BY 4.0** within 6 to 12 months of the May 2026 launch. See [CONTENT-LICENSE.md](../CONTENT-LICENSE.md) for the full terms.

The self-host image deliberately ships no authored text content. The build sets `VITE_SELF_HOST=true`, which makes `extract-public-data.mjs` emit empty values for every authored field (figure bios, learn lines, teaching summaries and quotes, voice essences, key concepts, theme cross-refs). Identifiers ship (figure ids and names, teaching ids and titles, the hardcoded short tradition labels). Everything authored is fetched at runtime from `AGORA_MEDIA_BASE_URL` when the app needs it. A self-host instance is content-equivalent to agoracosmica.org without holding a redistributable copy.

**For commercial self-host:** the app code is AGPL-3.0 and the content licence above governs the catalog. The speech and transcription models inside the published images come from upstream projects and carry their own licences. Check those before a commercial deployment.

---

## Architecture notes

All state lives in the browser. Chats, settings, completion progress and voting power sit in IndexedDB, and a BYOK key sits there too, encrypted with AES-256-GCM. The app container itself is stateless: pull, run, restart, with no migrations and no data directory to back up. What the instance sends outward is covered under [what leaves your machine](#what-leaves-your-machine).

---

## Questions?

Open a [GitHub Discussion](https://github.com/chipmates/agoracosmica/discussions) or file an issue. For security reports, see [SECURITY.md](../SECURITY.md).
