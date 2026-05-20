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
    };
  }
}

const runtimeOverrides: {
  mediaBaseUrl?: string;
  audioApiUrl?: string;
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
