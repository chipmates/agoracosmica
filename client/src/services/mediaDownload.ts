// src/services/mediaDownload.ts
//
// Offline copies of the Echo story audio: single episodes (fetched to a blob
// so the file name survives) and whole-figure archives (a plain navigation,
// because the worker sets Content-Disposition itself).
//
// Episode files are served from R2 without Content-Disposition, so a
// cross-origin <a download> is ignored by every browser. The blob path is the
// only way to control the saved name.

import { getMediaUrl } from '../utils/mediaConfig';
import { audioApiUrl } from '../config/runtime';

/** Downloads are always mp3: universally playable off-app, unlike webm/Opus. */
const DOWNLOAD_AUDIO_EXT = 'mp3';

export type StoryAssetExt = 'mp3' | 'txt';

function storyAssetPath(figureId: string, seedId: string | number, language: string, ext: string): string {
  return `stories/${figureId}/${language}/${figureId}_${seedId}_${language}.${ext}`;
}

/** URL of an episode's downloadable audio (always mp3). */
export function getEpisodeAudioUrl(figureId: string, seedId: string | number, language: string): string {
  return getMediaUrl(storyAssetPath(figureId, seedId, language, DOWNLOAD_AUDIO_EXT));
}

/** URL of an episode's transcript. */
export function getEpisodeTranscriptUrl(figureId: string, seedId: string | number, language: string): string {
  return getMediaUrl(storyAssetPath(figureId, seedId, language, 'txt'));
}

/** Whole-figure archive route on the audio worker. */
export function getStoryArchiveUrl(figureId: string, language: string): string {
  return `${audioApiUrl}/v1/audio/story-archive/${figureId}/${language}`;
}

// ============================================
// File names
// ============================================

/**
 * Strip everything a file system rejects, plus the characters that break
 * quoting in shells and archives. Collapses the leftovers so names never end
 * up with double spaces or a trailing dot.
 */
export function sanitizeFilenamePart(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 90)
    .trim();
}

interface EpisodeFilenameParams {
  /** Localized "Echo of X" / "Echo von X" line. */
  echoName: string;
  seedId: string | number;
  title: string;
  language: string;
  ext: StoryAssetExt;
}

/**
 * `Agora Cosmica - Echo von Laozi - 03 - Der Weg (DE).mp3`
 *
 * The Echo disclosure stays in the name: the file travels without the app
 * around it, so the name is the only place the AI origin can be read.
 */
export function buildEpisodeFilename({ echoName, seedId, title, language, ext }: EpisodeFilenameParams): string {
  const number = String(Number(seedId) || 0).padStart(2, '0');
  const tag = language.toUpperCase();
  const parts = [
    'Agora Cosmica',
    sanitizeFilenamePart(echoName),
    number,
    sanitizeFilenamePart(title),
  ].filter(Boolean);
  return `${parts.join(' - ')} (${tag}).${ext}`;
}

// ============================================
// Size probing
// ============================================

const sizeCache = new Map<string, number | null>();
const sizeInFlight = new Map<string, Promise<number | null>>();

/**
 * Byte size of a remote file, or null when the host does not answer a HEAD.
 * Cached forever: the story files are immutable behind a 1-year edge cache.
 */
export function probeContentLength(url: string): Promise<number | null> {
  const cached = sizeCache.get(url);
  if (cached !== undefined) return Promise.resolve(cached);

  const pending = sizeInFlight.get(url);
  if (pending) return pending;

  // No custom headers: keeps it a simple request, so no preflight round trip.
  const request = fetch(url, { method: 'HEAD' })
    .then(response => {
      if (!response.ok) return null;
      const header = response.headers.get('content-length');
      const bytes = header ? Number(header) : NaN;
      return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
    })
    .catch(() => null)
    .then(result => {
      sizeCache.set(url, result);
      sizeInFlight.delete(url);
      return result;
    });

  sizeInFlight.set(url, request);
  return request;
}

export interface ArchiveProbe {
  available: boolean;
  bytes: number | null;
}

/**
 * Availability + size of a figure's archive. The route may not be deployed,
 * in which case the caller hides the affordance instead of offering a dead
 * button.
 */
export async function probeStoryArchive(figureId: string, language: string): Promise<ArchiveProbe> {
  try {
    const response = await fetch(getStoryArchiveUrl(figureId, language), { method: 'HEAD' });
    if (!response.ok) return { available: false, bytes: null };
    // An unconfigured audio host makes this path relative, and the SPA host
    // answers every unknown path with index.html. HTML is never the archive.
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) return { available: false, bytes: null };
    const header = response.headers.get('content-length');
    const bytes = header ? Number(header) : NaN;
    return { available: true, bytes: Number.isFinite(bytes) && bytes > 0 ? bytes : null };
  } catch {
    return { available: false, bytes: null };
  }
}

/** Rounded, human size. Whole megabytes past 10 MB, one decimal below. */
export function formatFileSize(bytes: number, language: string): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    const kb = Math.max(1, Math.round(bytes / 1024));
    return `${new Intl.NumberFormat(language).format(kb)} KB`;
  }
  const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(rounded)} MB`;
}

// ============================================
// Fetch to disk
// ============================================

interface FetchToBlobOptions {
  signal?: AbortSignal;
  /** 0-100 while the total size is known, null while it is not. */
  onProgress?: (percent: number | null) => void;
}

/**
 * Stream a file into a blob, reporting determinate progress from
 * Content-Length. Falls back to an indeterminate read when the header is
 * missing or the body is not streamable.
 */
export async function fetchToBlob(url: string, options: FetchToBlobOptions = {}): Promise<Blob> {
  const { signal, onProgress } = options;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }
  // A missing file behind an SPA fallback answers 200 with HTML. Saving that
  // as media hands the user a broken file, so treat it as a failure.
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new Error('Download failed: unexpected content type');
  }

  const header = response.headers.get('content-length');
  const total = header ? Number(header) : NaN;
  const hasTotal = Number.isFinite(total) && total > 0;

  if (!response.body) {
    onProgress?.(null);
    return await response.blob();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  onProgress?.(hasTotal ? 0 : null);

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress?.(hasTotal ? Math.min(99, Math.round((received / total) * 100)) : null);
    }
  }

  onProgress?.(hasTotal ? 100 : null);
  return new Blob(chunks as BlobPart[], {
    type: response.headers.get('content-type') || 'application/octet-stream',
  });
}

/** Hand a blob to the browser's downloader under the given name. */
export function saveBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke late: Safari reads the object URL after the click returns.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
