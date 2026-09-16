/// <reference types="vite/client" />

// Per-family content versions injected by vite.config (define); absent under vitest.
declare const __CONTENT_VERSIONS__: Record<string, string> | undefined;
