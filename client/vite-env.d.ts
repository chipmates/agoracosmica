/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEDIA_BASE_URL?: string // Media CDN base URL (optional, defaults to https://media.agoracosmica.org)
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}