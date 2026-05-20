// Runtime configuration overrides for self-hosted deploys.
//
// In Docker, docker-entrypoint.sh rewrites this file at container start
// from the AGORA_MEDIA_BASE_URL and AGORA_AUDIO_API_URL env vars. In dev
// and on agoracosmica.org, this file ships with empty defaults so the
// build-time VITE_* env vars take over via the fallback chain in
// src/config/runtime.ts.
window.__AGORA_CONFIG__ = {
  mediaBaseUrl: '',
  audioApiUrl: ''
};
