// SSR-safe image component for public pages
// No useEffect, no window - deterministic from props
// Remove this file when stripping marketing pages from a fork

import {
  getPublicImageUrl,
  getPublicImageSrcSet,
  type ImageType,
} from '../../utils/public/publicMediaUrl';

interface StaticImageProps {
  figureId: string;
  type: ImageType;
  alt: string;
  className?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  width?: number;
  height?: number;
}

const DEFAULT_SIZES: Record<ImageType, string> = {
  main: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px',
  thumbnail: '(max-width: 640px) 50vw, 320px',
};

const DEFAULT_DIMENSIONS: Record<ImageType, { width: number; height: number }> = {
  main: { width: 600, height: 726 },
  thumbnail: { width: 320, height: 320 },
};

export default function StaticImage({
  figureId,
  type,
  alt,
  className,
  sizes,
  loading = 'lazy',
  width,
  height,
}: StaticImageProps) {
  const dims = DEFAULT_DIMENSIONS[type];
  const fallbackSize = type === 'main' ? 600 : 320;

  return (
    <picture>
      <source
        type="image/avif"
        srcSet={getPublicImageSrcSet(figureId, type, 'avif')}
        sizes={sizes || DEFAULT_SIZES[type]}
      />
      <source
        type="image/webp"
        srcSet={getPublicImageSrcSet(figureId, type, 'webp')}
        sizes={sizes || DEFAULT_SIZES[type]}
      />
      <img
        src={getPublicImageUrl(figureId, type, fallbackSize, 'png')}
        alt={alt}
        className={className}
        loading={loading}
        width={width || dims.width}
        height={height || dims.height}
        decoding="async"
      />
    </picture>
  );
}
