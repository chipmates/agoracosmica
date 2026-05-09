import { getMediaUrl } from './mediaConfig';

/**
 * 🎉 Updated October 20, 2025 - BYOK Architecture Complete
 *
 * This now delegates to mediaConfig.ts which handles:
 * - Development: Local assets via Vite (no server needed!)
 * - Production: Cloudflare Worker with private R2 bucket
 * - Authentication: Simple token validation (no JWT needed)
 *
 * @param {string} key - The storage object key (e.g., 'councils/finding-meaning-purpose/en/manifest.json')
 * @returns {Promise<string>} - The media URL
 *
 * @deprecated Use getMediaUrl() from mediaConfig.ts directly for new code
 */
export const getSignedUrl = async (key: string): Promise<string> => {
  try {
    // Simply delegate to the unified media configuration system
    // This handles both local (dev) and remote (prod) assets automatically
    return getMediaUrl(key);
  } catch (error) {
    console.error('Error getting media URL:', error);
    throw new Error('Failed to get resource URL');
  }
};

/**
 * 🎉 Updated October 20, 2025 - BYOK Architecture Complete
 *
 * Get multiple media URLs in a single call
 * @param {string[]} keys - Array of storage object keys
 * @returns {Promise<Record<string, string>>} - Object mapping keys to their media URLs
 *
 * @deprecated Use getMediaUrl() from mediaConfig.ts directly for new code
 */
export const getBatchSignedUrls = async (keys: string[]): Promise<Record<string, string>> => {
  try {
    // Simply map each key to its media URL
    const urls: Record<string, string> = {};

    for (const key of keys) {
      urls[key] = getMediaUrl(key);
    }

    return urls;
  } catch (error) {
    console.error('Error getting batch media URLs:', error);
    throw new Error('Failed to get resource URLs');
  }
};