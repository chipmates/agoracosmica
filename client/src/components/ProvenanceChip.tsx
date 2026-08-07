// src/components/ProvenanceChip.tsx
// Where a carried question's answer came from. The chip rides the reply that
// answered it, the door stays available for the rest of the conversation. Both
// open the same story chapter, and both only exist when the question really has
// an anchor teaching.
import { FC, useCallback } from 'react';
import { ArrowRight, Headphones } from '@phosphor-icons/react';
import { useTranslation } from '../hooks/useTranslation';
import { useDomainStore } from '../stores';
import { sendFunnelBeacon } from '../utils/funnelBeacon';
import './ProvenanceChip.css';

type ProvenanceSource = 'provenance_chip' | 'chapter_door';

interface ProvenanceProps {
  /** Chapter of the story, 1 to 12. Seed ids map to chapters one to one. */
  chapter: number;
}

/**
 * Open that chapter through the rail the wisdom map already uses: select the
 * seed, then story mode.
 */
function useOpenChapter(chapter: number, source: ProvenanceSource): () => void {
  return useCallback(() => {
    const state = useDomainStore.getState();
    const figureId = state.figures.selectedId;
    sendFunnelBeacon('nav_open', { figureId: figureId || undefined, mode: source });
    if (!figureId) return;
    const seed = (state.seeds.byFigure[figureId] || []).find(
      (s) => String(s.id) === String(chapter)
    );
    if (seed && typeof window !== 'undefined' && window.handleSeedSelect) {
      window.handleSeedSelect(seed, 'introduction');
    }
  }, [chapter, source]);
}

export const ProvenanceChip: FC<ProvenanceProps> = ({ chapter }) => {
  const { tString } = useTranslation();
  const open = useOpenChapter(chapter, 'provenance_chip');
  const label = tString('chat.provenance.chip', 'From chapter {n} of the story')
    .replace('{n}', String(chapter));

  return (
    <button type="button" className="provenance-chip" onClick={open} aria-label={label}>
      <span className="provenance-chip-text">{label}</span>
      <ArrowRight size={14} weight="bold" aria-hidden="true" />
    </button>
  );
};

export const ChapterDoor: FC<ProvenanceProps> = ({ chapter }) => {
  const { tString } = useTranslation();
  const open = useOpenChapter(chapter, 'chapter_door');
  const label = tString('chat.provenance.door', 'Hear chapter {n} of the story')
    .replace('{n}', String(chapter));

  return (
    <button type="button" className="chapter-door" onClick={open} aria-label={label}>
      <Headphones size={18} weight="regular" aria-hidden="true" />
      <span className="chapter-door-text">{label}</span>
    </button>
  );
};
