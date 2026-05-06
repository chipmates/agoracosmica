/**
 * Image Loader V2 - R2-backed image loading
 *
 * Constructs deterministic URLs for pre-processed image variants stored on R2.
 * Format negotiation happens in the browser via <picture> + <source> elements.
 *
 * Dev: relative URLs proxied by Vite (/images/...)
 * Prod: absolute URLs to media.agoracosmica.org
 */

import manifest from '../data/image-manifest.json';

// Types for image metadata (same contract as before)
interface ImageMetadata {
  src: string;
  width: number;
  height: number;
  format?: string;
}

export interface ImageResult {
  avif?: ImageSrcSet;
  webp?: ImageSrcSet;
  png?: ImageSrcSet;
  primary: string | null;
  width: number | null;
  height: number | null;
}

interface ImageSrcSet {
  src: string;
  width: number;
  height: number;
  srcSet: string;
}

// Dev: relative URL (Vite proxy forwards to R2)
// Prod: absolute URL to R2 via CF Worker
const MEDIA_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org');

// Preset sizes (mirrors vite.config.mjs / process-images-for-r2.mjs)
const FIGURE_MAIN_WIDTHS = [600, 900, 1200, 1800, 2400] as const;
const FIGURE_MAIN_FORMATS = ['avif', 'webp', 'png'] as const;
const THUMBNAIL_WIDTHS = [160, 320, 480, 640] as const;
const THUMBNAIL_FORMATS = ['avif', 'webp', 'png'] as const;
const UI_WIDTHS = [240, 480, 720, 960, 1440] as const;
const UI_FORMATS = ['avif', 'webp', 'png'] as const;
const BG_WIDTHS = [768, 1080, 1440, 1920, 2400, 3840] as const;
const BG_FORMATS = ['avif', 'webp', 'jpg'] as const;
const ICON_WIDTHS = [64, 128, 256, 384, 512] as const;
const ICON_FORMATS = ['avif', 'webp', 'png'] as const;

// Typed manifest access (JSON arrays are number[], cast to tuples)
const manifestData = manifest as unknown as {
  figures: Record<string, { main?: [number, number]; thumbnail?: [number, number] }>;
  ui: Record<string, [number, number]>;
  backgrounds: Record<string, [number, number]>;
  icons: Record<string, [number, number]>;
};

/**
 * Build ImageMetadata array from R2 URL convention
 */
function buildMetadata(
  basePath: string,
  widths: readonly number[],
  formats: readonly string[],
  maxDims: [number, number],
): ImageMetadata[] {
  const [maxW, maxH] = maxDims;
  const ratio = maxH / maxW;

  const result: ImageMetadata[] = [];
  for (const format of formats) {
    for (const w of widths) {
      result.push({
        src: `${MEDIA_BASE}/${basePath}/${w}.${format}`,
        width: w,
        height: Math.round(w * ratio),
        format,
      });
    }
  }
  return result;
}

/**
 * Load a figure image (main or thumbnail)
 */
export const loadFigureImageV2 = async (
  figureName: string,
  type: 'thumbnail' | 'main' = 'main'
): Promise<ImageMetadata[] | null> => {
  const entry = manifestData.figures[figureName];
  if (!entry) {
    console.warn(`Figure image not found in manifest: ${figureName}`);
    return null;
  }

  const dims = type === 'thumbnail' ? entry.thumbnail : entry.main;
  if (!dims) {
    console.warn(`Figure image type not found: ${figureName} (${type})`);
    return null;
  }

  const basePath = `images/figures/${figureName}/${type}`;
  const widths = type === 'thumbnail' ? THUMBNAIL_WIDTHS : FIGURE_MAIN_WIDTHS;
  const formats = type === 'thumbnail' ? THUMBNAIL_FORMATS : FIGURE_MAIN_FORMATS;

  return buildMetadata(basePath, widths, formats, dims);
};

/**
 * Load a UI image
 */
export const loadUIImageV2 = async (imageName: string): Promise<ImageMetadata[] | null> => {
  const dims = manifestData.ui[imageName];
  if (!dims) {
    console.warn(`UI image not found in manifest: ${imageName}`);
    return null;
  }
  return buildMetadata(`images/ui/${imageName}`, UI_WIDTHS, UI_FORMATS, dims);
};

/**
 * Load an icon image
 */
const ICON_MAP: Record<string, string> = {
  settings: 'settings',
  paths: 'paths',
  library: 'library',
  council: 'council',
};

export const loadIconImageV2 = async (iconName: string): Promise<ImageMetadata[] | null> => {
  const canonicalName = ICON_MAP[iconName];
  if (!canonicalName) {
    console.warn(`Icon not found in mapping: ${iconName}`);
    return null;
  }

  const dims = manifestData.icons[canonicalName];
  if (!dims) {
    console.warn(`Icon image not found in manifest: ${canonicalName}`);
    return null;
  }

  return buildMetadata(`images/icons/${canonicalName}`, ICON_WIDTHS, ICON_FORMATS, dims);
};

/**
 * Load a background image
 */
export const loadBackgroundImageV2 = async (backgroundName: string): Promise<ImageMetadata[] | null> => {
  // Normalize: strip '-original' suffix if present
  const name = backgroundName.replace(/-original$/, '');
  const dims = manifestData.backgrounds[name];
  if (!dims) {
    console.warn(`Background image not found in manifest: ${name}`);
    return null;
  }
  return buildMetadata(`images/backgrounds/${name}`, BG_WIDTHS, BG_FORMATS, dims);
};

/**
 * Get the best image URL from metadata based on size requirements.
 * Unchanged from previous version - works with any ImageMetadata[] source.
 */
export const getBestImageFromMetadata = (
  imageData: ImageMetadata[] | null,
  targetSize: number,
  preferredFormat: 'avif' | 'webp' | 'png' = 'webp'
): ImageResult | null => {
  if (!imageData || !Array.isArray(imageData)) {
    return null;
  }

  // Group by format
  const byFormat: Record<string, ImageMetadata[]> = imageData.reduce((acc: Record<string, ImageMetadata[]>, img) => {
    const format = img.format || 'png';
    if (!acc[format]) acc[format] = [];
    acc[format].push(img);
    return acc;
  }, {});

  // Sort each format by width
  Object.keys(byFormat).forEach(format => {
    byFormat[format].sort((a, b) => a.width - b.width);
  });

  // Find best match for target size in each format
  const result: Partial<ImageResult> = {};

  (['avif', 'webp', 'png'] as const).forEach(format => {
    if (byFormat[format]) {
      const match = byFormat[format].find(img => img.width >= targetSize) ||
                    byFormat[format][byFormat[format].length - 1];

      if (match) {
        result[format] = {
          src: match.src,
          width: match.width,
          height: match.height,
          srcSet: byFormat[format].map(img => `${img.src} ${img.width}w`).join(', ')
        };
      }
    }
  });

  // Get primary source (preferred format or fallback)
  const primary = result[preferredFormat] || result.webp || result.png || result.avif;

  return {
    ...result,
    primary: primary?.src || null,
    width: primary?.width || null,
    height: primary?.height || null
  } as ImageResult;
};

/**
 * Debug function to show available images (DEV only)
 */
export const debugImagePathsV2 = (): void => {
  if (!import.meta.env.DEV) return;

  console.log('=== R2 Image Loader V2 ===');
  console.log('Figures:', Object.keys(manifestData.figures).length);
  console.log('UI:', Object.keys(manifestData.ui).length);
  console.log('Backgrounds:', Object.keys(manifestData.backgrounds).length);
  console.log('Icons:', Object.keys(manifestData.icons).length);
  console.log('Media base:', MEDIA_BASE || '(relative, via Vite proxy)');
};
