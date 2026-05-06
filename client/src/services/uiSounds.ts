// uiSounds.ts - UI sound effects service for Prismatic Bloom
// Separate from the TTS audio pipeline (audioService.ts + audioQueueManager.ts).
// Uses plain HTMLAudioElement, not Web Audio API, to avoid conflicts.

type UISoundId = 'bloom-shimmer' | 'bloom-choir';

const SOUND_URLS: Record<UISoundId, { webm: string; wav: string }> = {
  'bloom-shimmer': {
    webm: '/assets/sounds/bloom-ethereal.webm',
    wav: '/assets/sounds/bloom-ethereal.wav',
  },
  'bloom-choir': {
    webm: '/assets/sounds/bloom-choir.webm',
    wav: '/assets/sounds/bloom-choir.wav',
  },
};

const PREF_KEY = 'bloom_soundEnabled';

// Cache audio elements for reuse
const audioCache: Partial<Record<UISoundId, HTMLAudioElement>> = {};

// Feature-detect WebM/Opus support (cached)
let webmSupported: boolean | null = null;
function canPlayWebm(): boolean {
  if (webmSupported !== null) return webmSupported;
  try {
    const audio = new Audio();
    webmSupported = audio.canPlayType('audio/webm; codecs=opus') !== '';
  } catch {
    webmSupported = false;
  }
  return webmSupported;
}

function getUrl(soundId: UISoundId): string {
  const urls = SOUND_URLS[soundId];
  return canPlayWebm() ? urls.webm : urls.wav;
}

function getOrCreateAudio(soundId: UISoundId): HTMLAudioElement {
  if (!audioCache[soundId]) {
    const audio = new Audio(getUrl(soundId));
    audio.preload = 'auto';
    audio.volume = 0.4;
    audioCache[soundId] = audio;
  }
  return audioCache[soundId]!;
}

export const uiSounds = {
  isEnabled(): boolean {
    try {
      return localStorage.getItem(PREF_KEY) !== 'false';
    } catch {
      return true;
    }
  },

  setEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(PREF_KEY, String(enabled));
    } catch { /* ignore */ }
  },

  preload(soundId: UISoundId): void {
    getOrCreateAudio(soundId);
  },

  async play(soundId: UISoundId, volume?: number): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      const audio = getOrCreateAudio(soundId);
      if (volume !== undefined) audio.volume = volume;
      audio.currentTime = 0;
      await audio.play();
    } catch {
      // Autoplay policy or other browser restriction, silently fail
    }
  },

  /** Get the URL for a sound (for components that manage their own audio) */
  getUrl(soundId: UISoundId): string {
    return getUrl(soundId);
  },
};

export default uiSounds;
