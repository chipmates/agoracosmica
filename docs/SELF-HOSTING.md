# Self-Hosting Agora Cosmica

Run Agora Cosmica on your own hardware in five minutes. Add local voice and a local LLM in two more steps if you want a fully on-device experience.

You get all six modes (Story, Wisdom, Prism, Quest, Free Talk, Council), all 30 figures, the full pre-recorded audio library, bilingual EN/DE, push-to-talk voice transcription, and BYOK chat via OpenRouter. The free tier and the Community Governance panel are hosted-only.

**Requirements:** Docker 24+ (Docker Desktop on Mac/Windows, or Docker Engine on Linux). No GPU needed for the default setup.

**How this guide is organised:** Local Mode has three independent toggles in Settings (LLM, TTS, STT). Step 1 brings up the docker stack. Step 2 wires the voice and transcription toggles (no extra hardware). Step 3 runs the LLM locally too (needs 27B-class hardware). Stop at whatever step satisfies you.

---

## 1. Quickstart

```bash
git clone https://github.com/chipmates/agoracosmica.git
cd agoracosmica
docker compose up -d
```

Open <http://localhost:8080>. On first run, paste your [OpenRouter](https://openrouter.ai/keys) API key when prompted. You're chatting.

**Verify the app is up:**
```bash
curl http://localhost:8080/healthz
```
Returns `OK` when healthy.

The default `docker compose up` brings up three containers: the app on port 8080, Kokoro (English TTS) on port 8880, and Whisper (transcription) on port 8000. The audio containers are running in the background, ready to use once Step 2 wires them up.

### Configuration

Copy `.env.example` to `.env` and edit if you need to override defaults:

| Variable | Default | What it does |
|---|---|---|
| `AGORA_HOST_PORT` | `8080` | Host-side port for the app. |
| `AGORA_MEDIA_BASE_URL` | `https://media.agoracosmica.org` | Content CDN for figure prompts, voice profiles, and pre-recorded audio. |

After editing `.env`, restart with `docker compose up -d`. The container rewrites `/config.js` from these env vars on every start, so no rebuild is needed.

---

## 2. Add local voice and transcription

The Kokoro and Whisper containers from Step 1 are already running on your machine. Wire them into the app:

1. Open <http://localhost:8080>.
2. Settings → AI Model → Local Mode.
3. Flip the **TTS** toggle. Click *Test*. You should see "Reachable" in green next to the field.
4. Flip the **STT** toggle. Same drill.
5. Click *Save*.

> **What changed:** microphone audio and the voice you hear now stay on your machine. Your chat text still goes to OpenRouter (or wherever the LLM is set) until Step 3.

### German voice synthesis (optional)

The default Kokoro container handles English. For German you need Qwen3-TTS, which is platform-specific.

**NVIDIA Linux / Windows:**
```bash
docker compose --profile nvidia up -d
```
Adds Qwen3-TTS on port 8887. First boot downloads ~2 GB of model weights from HuggingFace.

**Apple Silicon Mac:**
```bash
bash scripts/setup-local-tts-apple.sh
```
Installs `mlx-audio` into `~/Library/AgoraLocalTTS/`, downloads ~600 MB of weights, registers a launchd plist that starts on login. Native Metal, no docker (Metal doesn't pass through Docker on Mac).

Either path exposes Qwen3-TTS at `localhost:8887`. The TTS toggle from above routes to it automatically for German turns.

To uninstall the MLX server later:
```bash
launchctl unload ~/Library/LaunchAgents/org.agoracosmica.local-tts.plist
rm -rf ~/Library/AgoraLocalTTS ~/Library/LaunchAgents/org.agoracosmica.local-tts.plist
```

### Verify

```bash
curl http://localhost:8880/v1/models    # Kokoro EN
curl http://localhost:8000/v1/models    # Whisper STT
curl http://localhost:8887/health       # Qwen3-TTS DE (if installed)
```

All should return JSON.

---

## 3. Add a local LLM (optional)

This is the heavy step. Running the LLM locally means the conversation itself never reaches any external service, but it needs real hardware.

**The model we recommend:** [`Smoffyy/Qwen3.6-27B-Instruct-Revised-GGUF`](https://huggingface.co/Smoffyy/Qwen3.6-27B-Instruct-Revised-GGUF), **Q4_K_M** variant (~16 GB). It's the same model class we run on our servers. Holds the Custom Council `SPEAKER :: dialogue` format cleanly and supports tool calling so Quest mode's `award_seed` still fires.

**Hardware floor:**
- 32 GB unified RAM on Apple Silicon, or
- 16 GB+ VRAM on NVIDIA

Below that floor, leave the LLM toggle off. OpenRouter via BYOK handles the chat fine, and the voice + transcription you set up in Step 2 stay local either way.

### LM Studio (recommended)

1. Download [LM Studio](https://lmstudio.ai).
2. In the Discover tab, search `Smoffyy/Qwen3.6-27B-Instruct-Revised-GGUF`. Download the file with `Q4_K_M` in its name (~16 GB).
3. Open the Local Server tab (left rail). Load the model. Set Context Length to **32768** (32k). **Toggle "Enable CORS" ON**.
4. Click *Start Server*. Logs should show `Running on port 1234`.
5. In Agora Cosmica: Settings → Local Mode. Flip the **LLM** toggle.
6. Paste `http://localhost:1234/v1` as the endpoint URL. Type `qwen3.6-27b-instruct` as the model name. Click *Test*. You should see "Reachable" in green next to the field. Click *Save*.

> **What changed:** anything you type and anything the figure says back stays on your machine.

**Verify:**
```bash
curl http://localhost:1234/v1/models
```
should list your loaded model.

### Ollama

1. Install [Ollama](https://ollama.com).
2. Pull a 27B-class model:
   ```bash
   ollama pull qwen2.5:32b-instruct-q4_K_M
   ```
3. Enable CORS for browser access:
   - **macOS:** `launchctl setenv OLLAMA_ORIGINS "*"`, then restart Ollama.
   - **Linux:** start with `OLLAMA_ORIGINS=* ollama serve`.
4. In Agora Cosmica: Settings → Local Mode. Flip the **LLM** toggle. Paste `http://localhost:11434/v1` as the endpoint. Type the model name (`qwen2.5:32b-instruct`). Click *Test* → "Reachable" → *Save*.

### What works with a local LLM

All six modes work with the recommended Qwen 3.6 27B Q4_K_M setup:
- Free Talk, Wisdom, Prism: stream cleanly in both languages.
- Story: pre-rendered audio, no LLM call needed.
- Summary: works on 27B-class models.
- Custom Council: Qwen 3.6 holds the strict `SPEAKER :: dialogue` format.
- Quest: Qwen 3.6 supports tool calling, so the `award_seed` event still fires.

The live-interrupt voice mode (two-way streaming) stays hosted in v1.1.0 since it relies on the multi-tenant GPU gateway. Push-to-talk and read-aloud both work locally via Step 2.

---

## 4. What this means for your privacy

When you flip on all three Local Mode toggles and point the LLM at your own machine, your conversation never leaves it. Anything you type, anything the figure says back, anything you speak into the mic, and anything you hear from the TTS all stays on your hardware.

The browser still fetches catalog content from our CDN at `media.agoracosmica.org` on demand: figure prompts, voice profiles, pre-recorded audio, factchecks. That's the same traffic any visitor to the public site generates. We're not hiding it. **The point is sharper: what you talk about with the figures stays yours.**

Self-host builds also disable every analytics, page, session, ad-attribution, and conversion beacon at build time. Verified in code (`isSelfHost` gates in `pageBeacon.ts`, `entryBeacon.ts`, `playbackBeacon.ts`, `gclidCapture.ts`).

**First-boot note:** the audio containers download model weights from HuggingFace the first time they start (Whisper ~1.5 GB, Kokoro ~300 MB, Qwen3-TTS ~2 GB). Any local LLM endpoint downloads its own model from its own source (LM Studio's catalog, Ollama's registry, etc.). After the one-time pull, runtime is fully local.

---

## 5. Troubleshooting

**Chat fails immediately with "blocked by CORS policy".** The local LLM server isn't allowing the browser to call it.

- **LM Studio:** open the Local Server tab, find the *Enable CORS* toggle, turn it on, restart the server.
- **Ollama:** set `OLLAMA_ORIGINS=*` (or a specific origin like `http://localhost:5173` for dev) and restart Ollama.
- **vLLM:** launch with `--allowed-origins '*'`.
- **llama.cpp:** usually needs a reverse proxy that adds the `Access-Control-Allow-Origin: *` header.

The audio and STT containers ship with CORS enabled by default. The MLX wrapper on Apple Silicon also sets `CORS_ALLOW_ORIGINS=*` out of the box.

**The "Test" button shows "Unreachable".** Work down this list:
- Is the server actually running? (LM Studio: Local Server tab shows "Running". Ollama: `ollama list` plus check the daemon is up. Audio: `docker ps`.)
- Does the port match what's in the panel? (LM Studio defaults to 1234, Ollama to 11434, the audio containers to 8880 / 8000 / 8887.)
- Is CORS enabled? (See above.)
- Does the URL include `/v1` where required? LM Studio and Ollama want it, the audio containers don't.

**The first transcription is slow.** Whisper lazy-loads the model on first request. The entrypoint pre-pulls the model on container start, so this should only happen if the cache volume gets cleared.

---

## 6. Power users

**Custom audio backend.** If you operate a centralised GPU audio server speaking the OpenAI-compatible `/v1/audio/speech` and `/v1/audio/transcriptions` endpoints (e.g. a household or small team server), set `AGORA_AUDIO_API_URL=https://your-audio.example.com` in `.env`. The hosted-style audio path takes over for every user of this instance.

**Custom content domain.** If you point the app at a content domain other than `*.agoracosmica.org`, update the Content-Security-Policy in `client/index.html` to allow your origin in `img-src`, `media-src`, and `connect-src`, then rebuild from source. The default CSP already allows `*.agoracosmica.org`, so the upstream CDN works without changes.

**Build from source.** The default `docker-compose.yml` pulls a prebuilt image from GHCR. To build locally instead, comment the `image:` line and uncomment the `build:` block under the `app` service, then `docker compose up --build -d`. First build takes two to three minutes (pnpm install, pnpm build, a one-time content fetch from the CDN into the build context).

**LAN deployment.** If you have one box (NVIDIA workstation or M-series Mac) running the full audio stack, every other device on the same LAN can point its Local Mode toggles at that box. In each device's Settings → Local Mode, paste `http://your-homelab.local:8880` (Kokoro), `http://your-homelab.local:8887` (Qwen), and `http://your-homelab.local:8000` (Whisper). CORS is already configured. The companion repo [`chipmates/f5-server`](https://github.com/chipmates/f5-server) packages our production F5-TTS deployment for operators who specifically want F5.

---

## 7. Licensing

Code is **[AGPL-3.0](../LICENSE)**. Fork freely, copyleft applies to network deployments.

Content (stories, prism dialogues, council debates, factchecks, voice profiles, instruction prompts, images, audio) is **© ChipMates gemeinnützige GmbH** at launch, transitioning to **CC-BY 4.0** within 6 to 12 months. See [CONTENT-LICENSE.md](../CONTENT-LICENSE.md) for the full terms.

The self-host image deliberately ships no authored text content. The build sets `VITE_SELF_HOST=true`, which makes `extract-public-data.mjs` emit empty values for every authored field (figure bios, learn lines, seed summaries, seed quotes, voice essences, key concepts, theme cross-refs). Identifiers ship (figure ids and names, seed ids and titles, the hardcoded short tradition labels). Everything authored is runtime-fetched from `AGORA_MEDIA_BASE_URL` when the app needs it. A self-host instance is content-equivalent to agoracosmica.org without holding a redistributable copy.

**For commercial self-host:** the F5-TTS German fine-tuning is CC-BY-NC-4.0 (non-commercial only). Our production primary is Qwen3-TTS, which is fine commercially. F5 is the overflow tier and the only piece with the NC restriction. If your use is non-commercial (personal, research, nonprofit), the NC license doesn't restrict you.

---

## Architecture notes

- **No database.** Chats, settings, completion progress, and voting power all live in IndexedDB inside the browser.
- **No server-side state.** The app container is stateless. Pull, run, restart, no migrations, no data dir to back up.
- **No accounts.** BYOK keys are stored client-side, encrypted with AES-256-GCM.
- **No telemetry of our own.** See Section 4 for the full network-traffic picture.

---

## Questions?

Open a [GitHub Discussion](https://github.com/chipmates/agoracosmica/discussions) or file an issue. For security reports, see [SECURITY.md](../SECURITY.md).
