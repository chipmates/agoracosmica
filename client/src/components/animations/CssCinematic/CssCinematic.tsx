/**
 * CssCinematic — the entry sequence without WebGL: verse lines on the
 * night, the figures fade one by one, the CSS rose blooms.
 *
 * Shown where the film cannot run (no WebGL2, a lost context) and, with
 * every wait at zero, under reduced motion.
 */
import { FC, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import CosmicBackground from '../../CosmicBackground';
import CinematicCards from '../../CinematicCards';
import { useTranslation } from '../../../hooks/useTranslation';

const ParadisoTransition = lazy(() => import('../ParadisoTransition'));
const FigureController = lazy(() => import('../CosmicLoginTransition/FigureController'));

// Cinematic timeline — distinct beats, each given room to breathe (skippable).
const PORTAL_MS = 1200;        // the night breathes alone before the first question (card 1)
const QUESTION2_MS = 2400;     // "Who am I?" holds, then the outward question rises (card 2)
const SEEKER_MS = 2800;        // reading room for card 2 before the reply (card 3)
const FIGURES_MS = 2600;       // then the figures begin to fade, one by one (card 4)
const FADE_MS = 4400;          // let them all fade before the rose appears
const FIGURE_START_MS = 200;   // first figure's fade delay
const FIGURE_STAGGER_MS = 460; // gap between figures (atmospheric, one by one)
const PARADISO_AUTO_MS = 7500; // rose bloom + real reading room for the Dante line

interface CssCinematicProps {
  onWatched: () => void;
  onSkip: () => void;
}

const CssCinematic: FC<CssCinematicProps> = ({ onWatched, onSkip }) => {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [secondQuestion, setSecondQuestion] = useState(false);
  const [seekerVisible, setSeekerVisible] = useState(false);
  const [figuresFading, setFiguresFading] = useState(false);
  const [roseBegun, setRoseBegun] = useState(false);
  const [showSkipOverlay, setShowSkipOverlay] = useState(false);
  const [figuresActive, setFiguresActive] = useState(false);
  const [figureIndices, setFigureIndices] = useState<number[]>([]);
  const [portalAnimActive, setPortalAnimActive] = useState(false);

  const { tString } = useTranslation();

  const reducedMotion = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const wait = (ms: number) => (reducedMotion.current ? 0 : ms);

  // Begin the rose climax. Reduced motion skips the rose and hands off, which
  // counts as watched, not as a user skip.
  const beginRose = useCallback(() => {
    if (roseBegun) return;
    setRoseBegun(true);
    if (reducedMotion.current) {
      onWatched();
      return;
    }
    setShowSkipOverlay(true);
  }, [roseBegun, onWatched]);

  useEffect(() => {
    const t = setTimeout(() => setIsFormVisible(true), wait(PORTAL_MS));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Beat 2: the outward question rises after the inner one has held.
  useEffect(() => {
    if (!isFormVisible || secondQuestion || roseBegun) return;
    const t = setTimeout(() => setSecondQuestion(true), wait(QUESTION2_MS));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFormVisible, secondQuestion, roseBegun]);

  // Beat 3: the reply after the pair.
  useEffect(() => {
    if (!secondQuestion || seekerVisible || roseBegun) return;
    const t = setTimeout(() => setSeekerVisible(true), wait(SEEKER_MS));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondQuestion, seekerVisible, roseBegun]);

  // Beat 4: the figures begin to fade, one by one.
  useEffect(() => {
    if (!seekerVisible || figuresFading || roseBegun) return;
    const t = setTimeout(() => setFiguresFading(true), wait(FIGURES_MS));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekerVisible, figuresFading, roseBegun]);

  // Activate the figure fade, then bloom the rose once they have all gone.
  useEffect(() => {
    if (!figuresFading || roseBegun) return;
    const figures = document.querySelectorAll<HTMLElement>('.historical-figure');
    setFigureIndices(Array.from(figures).map((_, i) => i));
    setFiguresActive(true);
    const t = setTimeout(() => beginRose(), wait(FADE_MS));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figuresFading, roseBegun, beginRose]);

  // Final beat: the rose blooms.
  useEffect(() => {
    if (!roseBegun) return;
    const t = setTimeout(() => setPortalAnimActive(true), wait(200));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roseBegun]);

  return (
    <>
      {/* Cosmic background — hide meteors once the rose takes over */}
      <CosmicBackground hideMeteors={roseBegun} />

      {/* The verse story IS the scene (the Dante line lives in the rose) */}
      <CinematicCards
        active={!roseBegun && isFormVisible}
        step={figuresFading ? 3 : seekerVisible ? 2 : secondQuestion ? 1 : 0}
      />

      {/* Figure fade-out + Celestial Rose */}
      <Suspense fallback={null}>
        <FigureController
          active={figuresActive}
          figureIndices={figureIndices}
          startMs={FIGURE_START_MS}
          staggerMs={FIGURE_STAGGER_MS}
        />
        <ParadisoTransition
          isActive={portalAnimActive}
          variant={1}
          onAnimationComplete={onWatched}
          autoCompleteMs={PARADISO_AUTO_MS}
        />
      </Suspense>

      {/* Full-screen skip target during the rose phase */}
      {roseBegun && showSkipOverlay && (
        <div
          className="skip-animation-overlay"
          onClick={onSkip}
          role="button"
          tabIndex={0}
          aria-label={tString('entry.skipHint', 'Skip animation')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onSkip();
          }}
        />
      )}
    </>
  );
};

export default CssCinematic;
