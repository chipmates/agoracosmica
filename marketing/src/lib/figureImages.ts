// Figure image URLs for marketing pages, revision-aware. The app's image
// manifest carries the active figure-set revision (main-<rev>/ and
// thumbnail-<rev>/ keyspaces on R2); building URLs through it keeps marketing
// in lockstep with the app when the revision flips.
import manifest from '@client/data/image-manifest.json';
import { MEDIA_URL } from './urls';

const rev = (manifest as { figuresRev?: string }).figuresRev;

export type FigureImageType = 'main' | 'thumbnail';

// Revision trees on R2 are webp-only (avif encoded larger on the night set).
export function figureImage(figureId: string, type: FigureImageType, size: number): string {
  const keyspace = rev ? `${type}-${rev}` : type;
  return `${MEDIA_URL}/images/figures/${figureId}/${keyspace}/${size}.webp`;
}

export function figureSrcset(figureId: string, type: FigureImageType, sizes: number[]): string {
  return sizes.map((s) => `${figureImage(figureId, type, s)} ${s}w`).join(', ');
}
