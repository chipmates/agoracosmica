/**
 * WisdomGalleryModalV2 — the night gallery (design blessed 2026-07-23).
 *
 * The night gallery redesign:
 * portraits frameless on the void, the recede-into-night selection ritual, the
 * REAL about first-paragraph under the images, all three figures visible on
 * mobile (no swipe-hidden faces), Nietzsche gazing into the triptych on
 * desktop, See-all persisting beside Select.
 *
 * Mounted lazily from ModalsContainer under the name WisdomGalleryModal.
 */

import React, { useState, useEffect, useCallback, useRef, FC } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../hooks/useTranslation';
import { getHistoricalFigures, historicalFiguresBase } from '../api/figures';
import { loadFigureTranslation } from '../utils/figureTranslations';
import { useDomainStore } from '../stores/domainStore';
import OptimizedImage from './OptimizedImage';
import EchoExplainerHelp from './EchoExplainerHelp';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useFigureTrailer } from '../hooks/useFigureTrailer';
import { Play, Pause } from '@phosphor-icons/react';
import styles from './WisdomGalleryModalV2.module.css';

/** Trio picked from live demand + ad continuity (see V1 for the data note). */
const GALLERY_FIGURES = ['aurelius', 'kahlo', 'nietzsche'];

/** Outer figures gaze inward; Nietzsche looks right, so as the right column
 *  he flips on desktop (CSS handles the breakpoint). */
const FLIPPED: Record<string, boolean> = { nietzsche: true };

interface Figure {
  id: string;
  name: string;
  about: string;
  learn?: string;
}

interface WisdomGalleryModalV2Props {
  onSelectFigure: (figure: Figure) => void;
  onExploreAll: () => void;
  className?: string;
}

const WisdomGalleryModalV2: FC<WisdomGalleryModalV2Props> = ({
  onSelectFigure,
  onExploreAll,
  className = '',
}) => {
  const { t, tString, tNode, language } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const trailer = useFigureTrailer();
  const markAsVisited = useDomainStore((state) => state.markAsVisited);

  const [figures, setFigures] = useState<Figure[]>([]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [showEchoHelp, setShowEchoHelp] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );

  /* Figures build with async translation warm-up — same pattern as V1:
     instant paint from cache, rebuild once the real about/learn text lands. */
  useEffect(() => {
    let cancelled = false;

    const buildFigures = () => {
      const allFigures = getHistoricalFigures(language);
      const galleryFigures = GALLERY_FIGURES.map((figureId) => {
        const baseFigure = allFigures.find((f) => f.id === figureId);
        if (!baseFigure) {
          console.error(`Gallery figure not found: ${figureId}`);
          return { id: figureId, name: `Missing: ${figureId}`, about: '' };
        }
        return { ...baseFigure, id: figureId };
      });
      if (!cancelled) setFigures(galleryFigures);
    };

    buildFigures();
    Promise.all(
      GALLERY_FIGURES.map((figureId) => {
        const base = historicalFiguresBase.find((f) => f.id === figureId);
        return base ? loadFigureTranslation(base.baseNameEn, language) : Promise.resolve();
      })
    )
      .then(() => buildFigures())
      .catch(() => { /* placeholders stay shown */ });

    return () => { cancelled = true; };
  }, [language]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useBodyScrollLock(true);

  /* A different figure's story begins: stop any playing intro. */
  useEffect(() => {
    trailer.stop();
  }, [chosenId, trailer.stop]);

  /* Focus management + trap (no close — the visitor commits, as in V1). */
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && chosenId) {
        event.preventDefault();
        setChosenId(null);
        return;
      }
      if (event.key === 'Tab') {
        const container = modalRef.current;
        if (!container) return;
        const focusable = container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) { event.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [chosenId]);

  const toggleChosen = useCallback((id: string) => {
    setChosenId((prev) => (prev === id ? null : id));
  }, []);

  const handleSelect = useCallback(() => {
    const figure = figures.find((f) => f.id === chosenId);
    if (!figure) return;
    markAsVisited(figure.id);
    onSelectFigure(figure);
  }, [figures, chosenId, markAsVisited, onSelectFigure]);

  const handleExploreAll = useCallback(() => {
    markAsVisited();
    onExploreAll();
  }, [markAsVisited, onExploreAll]);

  const chosen = figures.find((f) => f.id === chosenId) ?? null;
  /* the essence = the REAL first about-paragraph, never a shortened stand-in */
  const essence = chosen?.about ? chosen.about.split('\n\n')[0] : '';

  if (figures.length === 0) return null;

  return createPortal(
    <div
      ref={modalRef}
      className={`${styles.modal} ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label={String(t('firstTime.title'))}
      tabIndex={-1}
    >
      <header className={styles.header}>
        {/* the blueprint's gold "Echo": both EN and DE titles carry the word */}
        <h1 className={styles.title}>
          {tString('firstTime.title', 'Choose Your First Echo')
            .split(/(Echo)/)
            .map((part, i) =>
              part === 'Echo'
                ? <em key={i} className={styles.titleAccent}>Echo</em>
                : <React.Fragment key={i}>{part}</React.Fragment>
            )}
        </h1>
        <div className={styles.rule} />
      </header>

      <main
        className={styles.gallery}
        role="radiogroup"
        aria-label={String(t('firstTime.title'))}
      >
        {figures.map((figure) => {
          const isChosen = chosenId === figure.id;
          const isDim = chosenId !== null && !isChosen;
          const trailerStatus = trailer.activeId === figure.id ? trailer.status : 'idle';
          const engaged = trailerStatus === 'loading' || trailerStatus === 'playing';

          return (
            <div
              key={figure.id}
              className={`${styles.fig} ${isChosen ? styles.chosen : ''} ${isDim ? styles.dim : ''} ${FLIPPED[figure.id] ? styles.flipped : ''}`}
            >
              <button
                type="button"
                className={styles.portrait}
                role="radio"
                aria-checked={isChosen}
                aria-label={String(t('firstTime.selectWithName', { name: figure.name }))}
                onClick={() => toggleChosen(figure.id)}
              >
                <OptimizedImage
                  src={figure.id}
                  type="ui"
                  purpose={isMobile ? 'thumbnail' : 'main'}
                  priority={true}
                  className={styles.portraitImage}
                  alt={figure.name}
                />
              </button>
              <div className={styles.meta}>
                <div className={styles.name}>{figure.name}</div>
                {figure.learn && <div className={styles.learn}>{figure.learn}</div>}
                <button
                  type="button"
                  className={`${styles.pill} ${engaged ? styles.pillOn : ''}`}
                  onClick={(e) => { e.stopPropagation(); trailer.toggle(figure.id, language); }}
                  aria-label={`${engaged ? tString('figures.trailerPause', 'Pause') : tString('figures.trailerPlay', 'Play intro')} — ${figure.name}`}
                >
                  {engaged ? <Pause size={13} weight="fill" /> : <Play size={13} weight="fill" />}
                  <span>
                    {engaged
                      ? tString('figures.trailerPause', 'Pause')
                      : tString('figures.trailerPlay', 'Play intro')}
                  </span>
                </button>
              </div>
              {/* mobile: the essence opens directly under the chosen row —
                  in view where the tap happened, never below the fold.
                  German is the worst case (~30% longer); the accordion
                  grows with the text instead of clipping it. */}
              {isMobile && isChosen && essence && (
                <div className={`${styles.mobileEssence} ${styles.essenceOn}`} aria-live="polite">
                  <p>{essence}</p>
                </div>
              )}
            </div>
          );
        })}
      </main>

      {!isMobile && (
        <div className={`${styles.essence} ${essence ? styles.essenceOn : ''}`} aria-live="polite">
          <p>{essence}</p>
        </div>
      )}

      <footer className={styles.footer}>
        {chosen && (
          <button type="button" className={styles.btnPrimary} onClick={handleSelect}>
            {tNode('figures.select')}
          </button>
        )}
        {/* See-all persists beside Select: reading one Echo's story should
            never close the door to the other 27 (deliberate change vs V1). */}
        <button type="button" className={styles.btnGhost} onClick={handleExploreAll}>
          {tNode('firstTime.exploreAll')}
        </button>
        <button type="button" className={styles.btnText} onClick={() => setShowEchoHelp(true)}>
          {tNode('helpers.echoExplainer.title')}
        </button>
      </footer>

      {showEchoHelp && <EchoExplainerHelp onDismiss={() => setShowEchoHelp(false)} />}
    </div>,
    document.body
  );
};

export default WisdomGalleryModalV2;
