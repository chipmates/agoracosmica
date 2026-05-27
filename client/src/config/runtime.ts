// Runtime configuration for deployment URLs.
//
// One built image works for any operator by reading deployment URLs at
// container start instead of bake-time. The fallback chain is:
//   window.__AGORA_CONFIG__  (written by /config.js at runtime)
//   → import.meta.env.VITE_* (baked at build time, used by agoracosmica.org)
//   → hardcoded default
//
// In dev mode the helpers return '' so Vite's proxy serves local assets
// and the local backend, matching how the existing read sites behaved
// before this layer was introduced.

declare global {
  interface Window {
    __AGORA_CONFIG__?: {
      mediaBaseUrl?: string;
      audioApiUrl?: string;
      localTtsKokoroUrl?: string;
      localTtsQwenUrl?: string;
      localSttUrl?: string;
    };
  }
}

const runtimeOverrides: {
  mediaBaseUrl?: string;
  audioApiUrl?: string;
  localTtsKokoroUrl?: string;
  localTtsQwenUrl?: string;
  localSttUrl?: string;
} = (typeof window !== 'undefined' && window.__AGORA_CONFIG__) || {};

const DEFAULT_MEDIA_BASE_URL = 'https://media.agoracosmica.org';

export const mediaBaseUrl: string = import.meta.env.DEV
  ? ''
  : runtimeOverrides.mediaBaseUrl ||
    import.meta.env.VITE_MEDIA_BASE_URL ||
    DEFAULT_MEDIA_BASE_URL;

export const audioApiUrl: string = import.meta.env.DEV
  ? ''
  : runtimeOverrides.audioApiUrl ||
    import.meta.env.VITE_AUDIO_API_URL ||
    '';

/**
 * Local Mode endpoint defaults (Phase B–D). The container at `app` reaches the
 * audio services via the docker compose network using these hostnames; a
 * browser pointed at the same containers from the host machine talks to
 * `localhost` instead. Both paths work because the docker compose maps each
 * service's port to the same host port.
 *
 * For browser-direct use (the dominant Local Mode case — user runs the
 * containers and the app speaks to them from the browser), the defaults
 * resolve to `localhost`. Operators can override at runtime via /config.js.
 */
const DEFAULT_LOCAL_TTS_KOKORO_URL = 'http://localhost:8880';
const DEFAULT_LOCAL_TTS_QWEN_URL = 'http://localhost:8887';
const DEFAULT_LOCAL_STT_URL = 'http://localhost:8000';

export const localTtsKokoroUrl: string =
  runtimeOverrides.localTtsKokoroUrl ||
  import.meta.env.VITE_LOCAL_TTS_KOKORO_URL ||
  DEFAULT_LOCAL_TTS_KOKORO_URL;

export const localTtsQwenUrl: string =
  runtimeOverrides.localTtsQwenUrl ||
  import.meta.env.VITE_LOCAL_TTS_QWEN_URL ||
  DEFAULT_LOCAL_TTS_QWEN_URL;

export const localSttUrl: string =
  runtimeOverrides.localSttUrl ||
  import.meta.env.VITE_LOCAL_STT_URL ||
  DEFAULT_LOCAL_STT_URL;
