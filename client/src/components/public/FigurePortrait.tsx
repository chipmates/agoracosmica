// Art-directed hero portrait for the figure detail page.
// Desktop (>= 820px): the profile "main" image (portrait crop, ~1200x1452).
// Mobile: the square "thumbnail" crop (640x640). Each source is shown at its
// own native ratio (CSS sets the frame aspect per breakpoint), so neither is
// cropped. Mirrors StaticImage's avif/webp/png fallback chain.
// Remove this file when stripping marketing pages from a fork

import {
  getPublicImageUrl,
  getPublicImageSrcSet,
} from '../../utils/public/publicMediaUrl';

interface FigurePortraitProps {
  figureId: string;
  alt: string;
}

export default function FigurePortrait({ figureId, alt }: FigurePortraitProps) {
  return (
    <picture>
      {/* Desktop: the profile portrait */}
      <source
        media="(min-width: 820px)"
        type="image/avif"
        srcSet={getPublicImageSrcSet(figureId, 'main', 'avif')}
        sizes="384px"
      />
      <source
        media="(min-width: 820px)"
        type="image/webp"
        srcSet={getPublicImageSrcSet(figureId, 'main', 'webp')}
        sizes="384px"
      />
      {/* Mobile: the square crop */}
      <source
        type="image/avif"
        srcSet={getPublicImageSrcSet(figureId, 'thumbnail', 'avif')}
        sizes="(max-width: 480px) 62vw, 248px"
      />
      <source
        type="image/webp"
        srcSet={getPublicImageSrcSet(figureId, 'thumbnail', 'webp')}
        sizes="(max-width: 480px) 62vw, 248px"
      />
      <img
        src={getPublicImageUrl(figureId, 'thumbnail', 320, 'png')}
        alt={alt}
        loading="eager"
        decoding="async"
      />
    </picture>
  );
}
