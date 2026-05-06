/**
 * CouncilPlayerService - Loads council manifests and transforms them to PrismData
 * for playback through PrismPlayer.
 *
 * Council manifests contain segments with speaker info, text, audio filenames,
 * and durations. This service maps them to the PrismData shape that PrismPlayer
 * already knows how to render (figure crossfade, subtitles, progress, etc.).
 */

import { getMediaUrl, getMediaHeaders } from '../../utils/mediaConfig';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { canPlayWebm } from '../../utils/audioFormat';
import { councilWarn } from './logger';
import type {
  PrismData,
  PrismManifest,
  PrismSegmentWithOffset,
  PrismTimestamps,
} from '../prism/PrismService';

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

/** Shape of a segment in the council manifest JSON */
interface CouncilManifestSegment {
  id: number;
  speaker: string;       // figureId, e.g. "kahlo"
  speakerName: string;   // display name, e.g. "Echo of Frida Kahlo"
  text: string;
  filename: string;      // e.g. "segment-00-kahlo.mp3"
  url: string;           // e.g. "councils/the-forge-and-the-wound/en/segment-00-kahlo.mp3"
  duration: number;
}

/** Shape of the council manifest JSON produced by the council-generator */
interface CouncilManifest {
  councilId: string;
  language: string;
  segments: CouncilManifestSegment[];
  totalSegments: number;
  totalDuration: number;
  combined: string;      // e.g. "council-the-forge-and-the-wound-en.mp3"
  generated: string;
  source: string;
  model: string;
}

// --- Path construction ---

function buildCouncilManifestPath(councilId: string, lang: string, level: 1 | 2 = 1): string {
  return `councils/${councilId}/level-${level}/${lang}/manifest-${lang}.json`;
}

function buildCouncilCombinedAudioPath(councilId: string, lang: string, combinedFilename: string, level: 1 | 2 = 1): string {
  // Prefer WebM in production (smaller, same quality), MP3 fallback
  const ext = canPlayWebm() ? 'webm' : 'mp3';
  const baseName = combinedFilename.replace(/\.mp3$/, '');
  return `councils/${councilId}/level-${level}/${lang}/${baseName}.${ext}`;
}

function buildCouncilTimestampPath(councilId: string, lang: string, segmentIndex: number, speaker: string, level: 1 | 2 = 1): string {
  const paddedIndex = String(segmentIndex).padStart(2, '0');
  return `councils/${councilId}/level-${level}/${lang}/segment-${paddedIndex}-${speaker}.timestamps.json`;
}

// --- Service ---

class CouncilPlayerService {
  private manifestCache: Map<string, CouncilManifest> = new Map();
  private timestampCache: Map<string, PrismTimestamps> = new Map();

  /**
   * Load a council and transform it to PrismData for PrismPlayer
   */
  async loadCouncil(
    councilId: string,
    language: string,
    options: { signal?: AbortSignal; level?: 1 | 2 } = {}
  ): Promise<PrismData> {
    const { signal, level = 1 } = options;

    if (!councilId || !language) {
      throw new Error('Missing required parameters for council loading');
    }

    let lang = language.toLowerCase();
    if (!['en', 'de'].includes(lang)) {
      councilWarn(`CouncilPlayerService: Unsupported language ${lang}, falling back to English`);
      lang = 'en';
    }

    // Load council manifest (may fall back to English)
    const councilManifest = await this.loadManifest(councilId, lang, level, signal);

    // Use the manifest's actual language (in case of English fallback)
    lang = councilManifest.language?.toLowerCase() || lang;

    // Validate required fields
    if (!councilManifest.totalDuration || !councilManifest.combined) {
      throw new Error(`CouncilPlayerService: Manifest for ${councilId} missing totalDuration or combined audio`);
    }

    // Map council segments → PrismSegmentWithOffset
    let currentOffset = 0;
    const segments: PrismSegmentWithOffset[] = councilManifest.segments.map((seg, index) => {
      const withOffset: PrismSegmentWithOffset = {
        order: seg.id,
        speaker: seg.speakerName,
        figureId: seg.speaker,
        text: seg.text,
        audio: seg.filename,
        duration: seg.duration,
        startOffset: currentOffset,
        endOffset: currentOffset + seg.duration,
        segmentIndex: index,
      };
      currentOffset += seg.duration;
      return withOffset;
    });

    // Build PrismManifest facade
    // Use the first segment's speaker as the "host" figure
    const moderator = councilManifest.segments[0];
    const manifest: PrismManifest = {
      figure: moderator?.speaker ?? '',
      seed: 0,
      seedTitle: councilId,
      host: moderator?.speakerName ?? '',
      lang,
      segments: segments.map(seg => ({
        order: seg.order,
        speaker: seg.speaker,
        figureId: seg.figureId,
        text: seg.text,
        audio: seg.audio,
        duration: seg.duration,
      })),
      combined: councilManifest.combined,
      totalDuration: councilManifest.totalDuration,
    };

    // Construct combined audio URL
    const audioPath = buildCouncilCombinedAudioPath(councilId, lang, councilManifest.combined, level);
    const audioUrl = getMediaUrl(audioPath);

    return {
      manifest,
      segments,
      audioUrl,
      totalDuration: councilManifest.totalDuration,
      lang,
    };
  }

  /**
   * Load council manifest JSON (with English fallback)
   */
  async loadManifest(
    councilId: string,
    lang: string,
    level: 1 | 2 = 1,
    signal?: AbortSignal
  ): Promise<CouncilManifest> {
    const cacheKey = `council::${councilId}::${level}::${lang}`;
    if (this.manifestCache.has(cacheKey)) {
      return this.manifestCache.get(cacheKey)!;
    }

    const path = buildCouncilManifestPath(councilId, lang, level);
    let manifest = await fetchJson<CouncilManifest>(path, signal);

    // English fallback
    if (!manifest && lang !== 'en') {
      councilWarn(`CouncilPlayerService: Trying English fallback for ${councilId}`);
      const fallbackPath = buildCouncilManifestPath(councilId, 'en', level);
      manifest = await fetchJson<CouncilManifest>(fallbackPath, signal);
    }

    if (!manifest) {
      throw new Error(`CouncilPlayerService: No manifest found for council ${councilId} (${lang})`);
    }

    this.manifestCache.set(cacheKey, manifest);
    return manifest;
  }

  /**
   * Load character-level timestamps for a specific council segment
   */
  async loadSegmentTimestamps(
    councilId: string,
    lang: string,
    segmentIndex: number,
    speaker: string,
    level: 1 | 2 = 1,
    signal?: AbortSignal
  ): Promise<PrismTimestamps | null> {
    const cacheKey = `council::${councilId}::${level}::${segmentIndex}::${lang}`;
    if (this.timestampCache.has(cacheKey)) {
      return this.timestampCache.get(cacheKey)!;
    }

    const path = buildCouncilTimestampPath(councilId, lang, segmentIndex, speaker, level);
    const data = await fetchJson<PrismTimestamps>(path, signal);

    if (data?.characters && Array.isArray(data.characters)) {
      this.timestampCache.set(cacheKey, data);
      return data;
    }
    return null;
  }

  /**
   * Preload all timestamps for a council (call after manifest is loaded)
   */
  async preloadTimestamps(
    councilId: string,
    lang: string,
    segments: PrismSegmentWithOffset[],
    level: 1 | 2 = 1,
    signal?: AbortSignal
  ): Promise<void> {
    const promises = segments.map((seg) =>
      this.loadSegmentTimestamps(councilId, lang, seg.segmentIndex, seg.figureId, level, signal)
    );
    await Promise.allSettled(promises);
  }

  clearCache(): void {
    this.manifestCache.clear();
    this.timestampCache.clear();
  }
}

const councilPlayerService = new CouncilPlayerService();
export default councilPlayerService;
