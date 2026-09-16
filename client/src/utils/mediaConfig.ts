import { fetchWithTimeout } from './fetchWithTimeout';
import { mediaBaseUrl } from '../config/runtime';

/**
 * Media Configuration for Asset Delivery
 *
 * Hybrid approach:
 * - Development: Local assets served by Vite (all files must exist locally)
 * - Production: Cloudflare Worker serving from private R2 bucket
 *
 * This ensures:
 * - Zero server dependency for development
 * - Fast local development (no network latency)
 * - Secure production (private R2 + Worker with simple token validation)
 * - No JWT tokens needed (BYOK architecture)
 */

interface MediaConfig {
  baseUrl: string;
  useWorker: boolean;
  useLocalAssets: boolean;
}

const MEDIA_CONFIGS: Record<string, MediaConfig> = {
  development: {
    baseUrl: '/src/assets',
    useWorker: false,
    useLocalAssets: true
  },
  production: {
    baseUrl: mediaBaseUrl,
    useWorker: true,
    useLocalAssets: false
  }
};

/**
 * Get current media configuration based on environment
 */
function getMediaConfig(): MediaConfig {
  const isDev = import.meta.env.DEV;
  return isDev ? MEDIA_CONFIGS.development : MEDIA_CONFIGS.production;
}

// R2 serves content with a one-year immutable cache header, so a browser only
// refetches a sheet or a chapter after a content ship when the URL changes.
// The build hashes each content family on disk (vite.config) and the version
// rides the query string; families without a version keep the bare URL.
const CONTENT_VERSIONS: Record<string, string> =
  typeof __CONTENT_VERSIONS__ === 'object' && __CONTENT_VERSIONS__ ? __CONTENT_VERSIONS__ : {};

/**
 * Append the content version of the file's family (the first path segment,
 * e.g. 'factchecks' or 'stories') to a media URL.
 */
export function withContentVersion(
  url: string,
  filePath: string,
  versions: Record<string, string> = CONTENT_VERSIONS
): string {
  const version = versions[filePath.split('/')[0]];
  if (!version) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${version}`;
}

/**
 * Get full URL for a media file
 *
 * @param filePath - Path to file (e.g., 'stories/einstein/einstein_1_en.webm')
 * @returns Full URL based on environment
 *
 * @example
 * // Development (local assets)
 * getMediaUrl('stories/einstein/en/einstein_1_en.webm')
 * // → '/src/assets/stories/einstein/en/einstein_1_en.webm'
 *
 * // Production (Cloudflare Worker + R2)
 * getMediaUrl('stories/einstein/en/einstein_1_en.webm')
 * // → 'https://media.agoracosmica.org/stories/einstein/en/einstein_1_en.webm'
 */
export function getMediaUrl(filePath: string): string {
  // Reject path traversal and null bytes
  if (filePath.includes('..') || filePath.includes('\0')) {
    throw new Error('Invalid media path');
  }

  const config = getMediaConfig();

  if (config.useLocalAssets) {
    // Development: Local assets served by Vite
    return `${config.baseUrl}/${filePath}`;
  } else {
    // Production: Cloudflare Worker with R2 backend
    return withContentVersion(`${config.baseUrl}/${filePath}`, filePath);
  }
}

/**
 * URL for content whose local layout differs from the R2 one (fact sheets,
 * seeds, figure translations): the bare media base in development, where the
 * Vite proxy serves it, and the versioned R2 URL in production.
 */
export function getContentUrl(filePath: string): string {
  if (filePath.includes('..') || filePath.includes('\0')) {
    throw new Error('Invalid media path');
  }
  const url = `${mediaBaseUrl}/${filePath}`;
  return import.meta.env.DEV ? url : withContentVersion(url, filePath);
}


/**
 * Get authentication headers for media requests
 *
 * - Development: No auth needed (local files)
 * - Production: Simple token for Cloudflare Worker validation
 *
 * BYOK Architecture: Worker accepts any non-empty token for BYOK users
 * (see cloudflare-worker/src/index.ts:93-96)
 *
 * @returns Headers object with Authorization (production only)
 */
export function getMediaHeaders(): HeadersInit {
  const config = getMediaConfig();

  // Local assets don't need authentication
  if (config.useLocalAssets) {
    return {};
  }

  // Production: Send simple token for Worker validation
  // Worker validates presence only (not JWT signature) for BYOK architecture
  return {
    'Authorization': 'Bearer byok-user'
  };
}

/**
 * Fetch media file with authentication
 *
 * @param filePath - Path to file
 * @returns Response from media server
 *
 * @example
 * const blob = await fetchMedia('stories/einstein/einstein_1_en.webm');
 * const videoUrl = URL.createObjectURL(blob);
 */
export async function fetchMedia(filePath: string): Promise<Response> {
  const url = getMediaUrl(filePath);
  const headers = getMediaHeaders();

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeoutMs: 15_000,
  });

  if (!response.ok) {
    const error = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `Failed to fetch media (${response.status}): ${error}\n` +
      `File: ${filePath}\n` +
      `URL: ${url}`
    );
  }

  return response;
}

/**
 * Get media configuration info for debugging
 */
export function getMediaInfo() {
  const config = getMediaConfig();
  return {
    environment: import.meta.env.DEV ? 'development' : 'production',
    baseUrl: config.baseUrl,
    useWorker: config.useWorker,
    authType: config.useLocalAssets ? 'none' : 'byok-token'
  };
}
