// The councils that have a produced 50 second preview clip on R2, and the
// figures each clip puts in the room (speaking, or addressed by name in it).
// Remove this file when stripping marketing pages from a fork.
//
// The catalog cast is regenerated from the produced debate scripts, so recasting
// a council leaves its older clip naming people the card no longer shows. A clip
// is therefore only offered while every figure in it is still in that council's
// cast: a recast retires its clip instead of playing it under the wrong faces.
// Re-render the clip and the entry comes back on its own.

import { councilCatalog } from '../councilCatalog';

const PREVIEW_CAST: Record<string, readonly string[]> = {
  'alone-in-the-room-full-of-people': ['dickinson', 'rumi', 'nietzsche'],
  'four-freedoms': ['mandela', 'aurelius', 'tubman', 'beauvoir'],
  'laughing-at-the-abyss': ['angelou', 'shakespeare', 'nietzsche', 'aurelius'],
  'the-calling-that-wont-shut-up': ['lovelace', 'goethe', 'gandhi', 'campbell'],
  'the-mind-that-wont-be-quiet': ['woolf', 'aurelius', 'gautama'],
  'the-problem-of-evil': ['nietzsche', 'eckhart', 'gautama', 'campbell'],
  'the-story-you-keep-telling': ['angelou', 'campbell', 'jung'],
  'what-does-your-anger-want': ['angelou', 'king', 'nietzsche'],
};

const AVAILABLE = new Set(
  Object.entries(PREVIEW_CAST)
    .filter(([councilId, clipCast]) => {
      const council = councilCatalog.find(c => c.id === councilId);
      if (!council) return false;
      const shipped = new Set([
        council.moderator.id,
        ...council.participants.map(p => p.id),
      ]);
      return clipCast.every(figureId => shipped.has(figureId));
    })
    .map(([councilId]) => councilId)
);

/** True when this council has a clip whose voices still match its shipped cast. */
export const hasCouncilPreview = (councilId: string): boolean => AVAILABLE.has(councilId);

/** Every council currently safe to offer a preview for. */
export const councilPreviewIds: readonly string[] = [...AVAILABLE];

/** The clip's own cast, for the guard test. Empty when no clip was produced. */
export const councilPreviewCast = (councilId: string): readonly string[] =>
  PREVIEW_CAST[councilId] ?? [];

/** Every council a clip was produced for, matching or not. */
export const producedPreviewIds: readonly string[] = Object.keys(PREVIEW_CAST);
