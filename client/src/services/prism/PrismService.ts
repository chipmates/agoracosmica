/**
 * PrismService.ts - Loads pre-generated prism content (manifests, timestamps, audio URLs)
 *
 * Prisms are multi-perspective philosophical dialogues: a host figure + 3 connected figures
 * discuss a wisdom seed topic. All content is pre-generated with audio and character-level timestamps.
 *
 * Pattern: follows StoryService (manifest fetch → URL construction → cache)
 * Audio strategy: combined WebM/Opus (primary) with MP3 fallback for smooth seeking
 */

import { getMediaUrl, getMediaHeaders } from '../../utils/mediaConfig';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { Language } from '../../types/global';

// --- Types ---

export interface PrismSegment {
  order: number;
  speaker: string;
  figureId: string;
  text: string;
  audio: string;
  duration: number;
}

export interface PrismManifest {
  figure: string;
  seed: number;
  seedTitle: string;
  host: string;
  lang: string;
  segments: PrismSegment[];
  combined: string;
  totalDuration: number;
}

export interface PrismTimestamps {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface PrismMetadata {
  figure: string;
  seedId: number;
  seedTitle: string;
  host: string;
  connections: PrismConnection[];
}

export interface PrismConnection {
  figure: string;
  type: 'foundation' | 'expansion' | 'tension';
  strength: number;
  relationship: string;
}

/** Computed segment with offset for combined audio playback */
export interface PrismSegmentWithOffset extends PrismSegment {
  startOffset: number;
  endOffset: number;
  segmentIndex: number;
}

export interface PrismData {
  manifest: PrismManifest;
  segments: PrismSegmentWithOffset[];
  audioUrl: string;
  totalDuration: number;
  lang: string;
}

// --- Path construction ---

/**
 * Build R2 path for prism files
 * Structure: prisms/{figure}/seed-{n}/{lang}/manifest.json
 *            prisms/{figure}/seed-{n}/audio/combined-raw-{lang}.webm  (primary)
 *            prisms/{figure}/seed-{n}/audio/combined-raw-{lang}.mp3   (fallback)
 *            prisms/{figure}/seed-{n}/audio/seg-{NN}-{figurename}-{lang}.timestamps.json
 */
function buildPrismManifestPath(figure: string, seed: number, lang: string): string {
  return `prisms/${figure}/seed-${seed}/${lang}/manifest.json`;
}

/**
 * Fetch JSON safely — checks content-type to avoid parsing Vite's HTML 404 in dev.
 */
async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const url = getMediaUrl(path);
  const headers = getMediaHeaders();

  try {
    const response = await fetchWithTimeout(url, { headers, signal, timeoutMs: 8_000 });
    const ct = response.headers.get('content-type') ?? '';
    if (response.ok && ct.includes('application/json')) {
      return await response.json();
    }
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
  }

  return null;
}

/** Detect WebM/Opus support (cached). Dev always uses MP3 (local assets). */
let _canPlayWebm: boolean | null = null;
function canPlayWebm(): boolean {
  if (_canPlayWebm === null) {
    if (import.meta.env.DEV) {
      _canPlayWebm = false; // Dev only has MP3 locally
    } else {
      try {
        const audio = document.createElement('audio');
        _canPlayWebm = audio.canPlayType('audio/webm; codecs=opus') !== '';
      } catch {
        _canPlayWebm = false;
      }
    }
  }
  return _canPlayWebm;
}

function buildPrismCombinedAudioPath(figure: string, seed: number, lang: string): string {
  const ext = canPlayWebm() ? 'webm' : 'mp3';
  return `prisms/${figure}/seed-${seed}/audio/combined-raw-${lang}.${ext}`;
}

function buildPrismTimestampPath(
  figure: string,
  seed: number,
  segmentIndex: number,
  figureId: string,
  lang: string
): string {
  const paddedIndex = String(segmentIndex).padStart(2, '0');
  return `prisms/${figure}/seed-${seed}/audio/seg-${paddedIndex}-${figureId}-${lang}.timestamps.json`;
}

// --- Service ---

class PrismService {
  private manifestCache: Map<string, PrismManifest> = new Map();
  private timestampCache: Map<string, PrismTimestamps> = new Map();
  private metadataCache: Map<string, PrismMetadata> = new Map();

  /**
   * Load a prism: manifest + computed segment offsets + audio URL
   */
  async loadPrism(
    figure: string,
    seed: number,
    language: Language | string,
    options: { signal?: AbortSignal } = {}
  ): Promise<PrismData> {
    const { signal } = options;

    if (!figure || !seed || !language) {
      throw new Error('Missing required parameters for prism loading');
    }

    let lang = language.toLowerCase();
    if (!['en', 'de'].includes(lang)) {
      console.warn(`PrismService: Unsupported language ${lang}, falling back to English`);
      lang = 'en';
    }

    // Load manifest (with cache) — resolvedLang may differ if English fallback used
    const { manifest, resolvedLang } = await this.loadManifest(figure, seed, lang, signal);
    lang = resolvedLang;

    // Compute segment offsets for combined audio
    let currentOffset = 0;
    const segments: PrismSegmentWithOffset[] = manifest.segments.map((seg, index) => {
      const withOffset: PrismSegmentWithOffset = {
        ...seg,
        startOffset: currentOffset,
        endOffset: currentOffset + seg.duration,
        segmentIndex: index,
      };
      currentOffset += seg.duration;
      return withOffset;
    });

    // Construct combined audio URL
    const audioPath = buildPrismCombinedAudioPath(figure, seed, lang);
    const audioUrl = getMediaUrl(audioPath);

    return {
      manifest,
      segments,
      audioUrl,
      totalDuration: manifest.totalDuration,
      lang,
    };
  }

  /**
   * Load manifest JSON from R2 (with fallback to English)
   */
  async loadManifest(
    figure: string,
    seed: number,
    lang: string,
    signal?: AbortSignal
  ): Promise<{ manifest: PrismManifest; resolvedLang: string }> {
    const cacheKey = `${figure}::${seed}::${lang}`;
    if (this.manifestCache.has(cacheKey)) {
      return { manifest: this.manifestCache.get(cacheKey)!, resolvedLang: lang };
    }

    const path = buildPrismManifestPath(figure, seed, lang);
    let manifest = await fetchJson<PrismManifest>(path, signal);
    let resolvedLang = lang;

    // English fallback
    if (!manifest && lang !== 'en') {
      console.warn(`PrismService: Trying English fallback for ${figure} seed ${seed}`);
      const fallbackPath = buildPrismManifestPath(figure, seed, 'en');
      manifest = await fetchJson<PrismManifest>(fallbackPath, signal);
      resolvedLang = 'en';
    }

    if (!manifest) {
      throw new Error(`PrismService: No manifest found for ${figure} seed ${seed} (${lang})`);
    }

    this.manifestCache.set(cacheKey, manifest);
    return { manifest, resolvedLang };
  }

  /**
   * Load character-level timestamps for a specific segment
   */
  async loadSegmentTimestamps(
    figure: string,
    seed: number,
    segmentIndex: number,
    figureId: string,
    lang: string,
    signal?: AbortSignal
  ): Promise<PrismTimestamps | null> {
    const cacheKey = `${figure}::${seed}::${segmentIndex}::${lang}`;
    if (this.timestampCache.has(cacheKey)) {
      return this.timestampCache.get(cacheKey)!;
    }

    const path = buildPrismTimestampPath(figure, seed, segmentIndex, figureId, lang);
    const data = await fetchJson<PrismTimestamps>(path, signal);

    if (data?.characters && Array.isArray(data.characters)) {
      this.timestampCache.set(cacheKey, data);
      return data;
    }
    return null;
  }


  /**
   * Preload all timestamps for a prism (call after manifest is loaded)
   */
  async preloadTimestamps(
    figure: string,
    seed: number,
    segments: PrismSegment[],
    lang: string,
    signal?: AbortSignal
  ): Promise<void> {
    const promises = segments.map((seg, index) =>
      this.loadSegmentTimestamps(figure, seed, index, seg.figureId, lang, signal)
    );
    await Promise.allSettled(promises);
  }

  /**
   * Get a cached manifest without async loading (returns null if not cached)
   */
  getCachedManifest(figure: string, seed: number, lang: string): PrismManifest | null {
    const key = `${figure}::${seed}::${lang}`;
    return this.manifestCache.get(key) ?? null;
  }

  /**
   * Format manifest segments as context text for LLM injection
   */
  formatManifestAsContext(manifest: PrismManifest): string {
    return manifest.segments
      .map(seg => `${seg.speaker}: ${seg.text}`)
      .join('\n\n');
  }

  clearCache(): void {
    this.manifestCache.clear();
    this.timestampCache.clear();
    this.metadataCache.clear();
  }
}

const prismService = new PrismService();
export default prismService;
