import { describe, it, expect } from 'vitest';
import { councilCatalog } from '../../data/councilCatalog';
import {
  hasCouncilPreview,
  councilPreviewIds,
  councilPreviewCast,
  producedPreviewIds,
} from '../../data/public/councilPreviews';

const shippedCast = (councilId: string): Set<string> => {
  const council = councilCatalog.find(c => c.id === councilId);
  return new Set(
    council ? [council.moderator.id, ...council.participants.map(p => p.id)] : []
  );
};

describe('council previews', () => {
  it('names a real council for every produced clip', () => {
    for (const id of producedPreviewIds) {
      expect(councilCatalog.some(c => c.id === id), `${id} is in the catalog`).toBe(true);
      expect(councilPreviewCast(id).length).toBeGreaterThan(1);
    }
  });

  it('offers a clip only while its voices are still in the cast', () => {
    for (const id of councilPreviewIds) {
      const cast = shippedCast(id);
      for (const figureId of councilPreviewCast(id)) {
        expect(cast.has(figureId), `${id} clip voices ${figureId}, cast does not`).toBe(true);
      }
    }
  });

  it('withholds a clip whose cast the catalog has moved on from', () => {
    const recast = producedPreviewIds.filter(id => {
      const cast = shippedCast(id);
      return councilPreviewCast(id).some(figureId => !cast.has(figureId));
    });
    for (const id of recast) {
      expect(hasCouncilPreview(id), `${id} needs a re-rendered clip`).toBe(false);
    }
  });
});
