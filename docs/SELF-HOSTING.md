# Self-Hosting Guide

This guide covers running your own instance of Agora Cosmica.

---

## Quick Start (Frontend Only)

The simplest setup: run the web app locally with the free tier or your own OpenRouter key.

```bash
git clone https://github.com/chipmates/agoracosmica.git
cd agoracosmica/client
pnpm install
pnpm setup:assets    # download content (~30 MB) from media.agoracosmica.org
pnpm dev
```

Open [localhost:5173](http://localhost:5173). The app works immediately with the free tier (30 messages/day). For unlimited conversations, add your [OpenRouter](https://openrouter.ai) API key in Settings.

**Requirements:** Node.js 20+, pnpm 8+

### About `setup:assets`

The repository ships the application code (AGPL-3.0). Content (wisdom teachings, factchecks, voice profiles, instructions, figure descriptions) is licensed separately and not bundled in the repo. The setup script fetches it from the production CDN at `media.agoracosmica.org`.

If you want to host an instance with your own content, override the source:

```bash
AGORACOSMICA_CDN=https://your-cdn.example.com pnpm setup:assets
```

The script expects the same URL layout as the upstream CDN: `seeds/{en,de}/`, `figure-translations/{en,de}/`, `factchecks/{en,de}/`, `voice-profiles/{en,de}/`, `instructions/<figure>/`. See [CONTENT-LICENSE.md](../CONTENT-LICENSE.md) for licensing.

---

## Production Build

```bash
cd client
pnpm build
```

The `build/` directory contains static files that can be served by any web server (nginx, Caddy, Cloudflare Pages, Vercel, Netlify, etc.).

### Example: nginx

```nginx
server {
    listen 80;
    server_name your-domain.org;
    root /var/www/agoracosmica/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Full Stack (With Audio)

For a complete self-hosted setup including text-to-speech and speech-to-text, you need:

### 1. Frontend (Cloudflare Pages or any static hosting)

```bash
cd client
pnpm build
# Deploy build/ to your hosting provider
```

### 2. LLM Proxy Worker (`workers/llm-proxy/`)

Handles rate limiting, content safety screening, and routing to either OpenRouter (BYOK) or Nebius (free tier).

```bash
cd workers/llm-proxy
pnpm install
# Configure wrangler.toml with your KV namespaces and secrets
npx wrangler deploy
```

**Required secrets:**
- `NEBIUS_API_KEY` (for free tier)
- `TURNSTILE_SECRET_KEY` (for bot protection)
- `JWT_SECRET` (for session tokens)

### 3. Audio Proxy Worker (`workers/audio-proxy/`)

Routes TTS/STT requests to your GPU servers with failover support and edge auth.

```bash
cd workers/audio-proxy
pnpm install
# Configure wrangler.toml
npx wrangler deploy
```

**Required secrets:**
- `X_ORIGIN_VERIFY` (Worker-stamped header for origin auth, see SECURITY-ARCHITECTURE.md)
- `AUDIO_API_KEY` (bearer for GPU server)

### 4. Pre-recorded Media (Cloudflare R2 + custom domain)

Stories, councils, prism dialogues, and forewords are served as static audio from an R2 bucket. No worker needed — point a custom domain at the R2 bucket.

```bash
# 1. Create an R2 bucket
npx wrangler r2 bucket create agora-cosmica
# 2. In the Cloudflare dashboard: R2 → your bucket → Settings → connect custom domain
# 3. Upload pre-recorded audio (stories, councils, prisms) to matching paths
```

### 5. (Optional) Community + Stats Workers

If you want the in-app voting / co-sign panel and the internal analytics dashboard:

- `workers/community/` — anonymous voting-power tally (deploy if you run a multi-user instance)
- `workers/stats/` — operator-only dashboard (gate behind Cloudflare Access)

### 6. TTS/STT Server (GPU Required)

The audio servers run Kokoro TTS and Faster-Whisper STT. You need a machine with an NVIDIA GPU (RTX 4090 or better recommended, 24GB+ VRAM).

We use Hetzner GEX130 servers (RTX 6000 Ada, 48GB VRAM) located in Germany. Any NVIDIA GPU server will work.

**Stack:**
- Kokoro TTS (20 voices, WebM/Opus output)
- Faster-Whisper STT (large-v3 model)
- nginx reverse proxy with TLS
- Bearer token authentication

Detailed audio server setup documentation is planned for post-v1.

---

## Environment Variables

The frontend uses no server-side environment variables. All configuration happens client-side:

| Setting | Where | Description |
|---------|-------|-------------|
| OpenRouter API Key | App Settings | User's own key, encrypted with AES-256-GCM, stored in IndexedDB |
| Language | App Settings | EN or DE |
| Audio Endpoints | Built-in | Configured at build time |

---

## Architecture Notes

- **No database required.** All user data is stored client-side in IndexedDB.
- **No server-side state.** The Cloudflare Workers are stateless proxies.
- **No user accounts.** There is no authentication system. BYOK keys are stored locally.
- **Media is static.** All pre-recorded audio lives in R2 and is served via CDN.

This means self-hosting is primarily about deploying static files and configuring the proxy workers. The heaviest infrastructure component is the GPU server for live audio.

---

## Cost Estimates

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Cloudflare Pages | Free | Static hosting |
| Cloudflare Workers | Free (100K req/day) | Proxy layer |
| Cloudflare R2 | ~$1-5 | Media storage (~10GB at $0.015/GB plus operations) |
| GPU Server | $200-600 | Depends on provider and GPU |
| Nebius API | Usage-based | Only if offering free tier |

A minimal self-hosted setup (frontend + BYOK, no free tier, no audio) costs $0/month.

---

## Questions?

Open a [GitHub Discussion](https://github.com/chipmates/agoracosmica/discussions) or read the [Security architecture](SECURITY-ARCHITECTURE.md) and [README architecture overview](../README.md#architecture) for technical detail.
