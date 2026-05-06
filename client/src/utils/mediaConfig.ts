import { fetchWithTimeout } from './fetchWithTimeout';

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
    baseUrl: import.meta.env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org',
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
    return `${config.baseUrl}/${filePath}`;
  }
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
 * Get signed URL for media (backward compatibility)
 *
 * This maintains the existing getSignedUrl() API
 * but routes through the new system
 *
 * @param key - File path (e.g., 'stories/einstein/en/einstein_1_en.webm')
 * @returns URL string
 *
 * @deprecated Use getMediaUrl() directly for new code
 */
export async function getSignedUrl(key: string): Promise<string> {
  // BYOK Architecture: No signed URLs needed
  // Worker validates simple token on every request (see getMediaHeaders)
  return getMediaUrl(key);
}

/**
 * Check if media gateway is healthy
 * Useful for debugging and monitoring
 */
export async function checkMediaHealth(): Promise<boolean> {
  try {
    const config = getMediaConfig();

    // Try to fetch a known test file or just check connectivity
    const healthUrl = config.useWorker
      ? `${config.baseUrl}/health`
      : `${config.baseUrl}/health`;

    const response = await fetchWithTimeout(healthUrl, {
      method: 'HEAD',
      headers: getMediaHeaders(),
      timeoutMs: 5_000,
    });

    return response.ok;
  } catch (error) {
    console.error('Media gateway health check failed:', error);
    return false;
  }
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
