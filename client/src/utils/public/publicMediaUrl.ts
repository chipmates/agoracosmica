// Simplified image URL builder for public pages - no auth headers
// Remove this file when stripping marketing pages from a fork

// In dev, use relative paths (Vite proxy handles /stories, /images)
// In production, use the R2 CDN URL
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
const MEDIA_BASE = isDev ? '' : 'https://media.agoracosmica.org';

export type ImageType = 'main' | 'thumbnail';
export type ImageFormat = 'avif' | 'webp' | 'png';

const SIZES: Record<ImageType, number[]> = {
  main: [600, 900, 1200, 1800, 2400],
  thumbnail: [160, 320, 480, 640],
};

export function getPublicImageUrl(
  figureId: string,
  type: ImageType,
  size: number,
  format: ImageFormat = 'webp'
): string {
  return `${MEDIA_BASE}/images/figures/${figureId}/${type}/${size}.${format}`;
}

export function getPublicImageSrcSet(
  figureId: string,
  type: ImageType,
  format: ImageFormat
): string {
  return SIZES[type]
    .map(w => `${getPublicImageUrl(figureId, type, w, format)} ${w}w`)
    .join(', ');
}

export function getPublicAudioUrl(
  figureId: string,
  lang: string,
  segment: number = 1
): string {
  return `${MEDIA_BASE}/stories/${figureId}/${lang}/${figureId}_${segment}_${lang}.webm`;
}

export type TrailerFormat = 'webm' | 'mp3';

export function getPublicTrailerUrl(
  figureId: string,
  lang: string,
  format: TrailerFormat = 'webm'
): string {
  return `${MEDIA_BASE}/trailers/figures/${figureId}/${lang}/${figureId}_trailer_${lang}.${format}`;
}

export function getAvailableSizes(type: ImageType): number[] {
  return SIZES[type];
}
