// Global type declarations for Agora Cosmica

interface SeedsCache {
  [figureId: string]: {
    [language: string]: any[];
  };
}

declare global {
  interface Window {
    seedsCache?: SeedsCache;
  }
}

export {};