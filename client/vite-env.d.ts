/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEDIA_BASE_URL?: string // Media CDN base URL (optional, defaults to https://media.agoracosmica.org)
  readonly VITE_SELF_HOST?: string // "true" selects the Docker self-host build (see src/config/deployment.ts)
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}