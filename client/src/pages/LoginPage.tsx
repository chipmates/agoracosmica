// src/pages/LoginPage.tsx
//
// Entry "Vorspann": a short, auto-playing, skippable cosmic cinematic. No card,
// no button. The wordmark breathes (brand beat), the ring ignites with the
// frameless Seeker at its core, two verse cards cross-fade, the figures fade
// one by one, and the core blooms into the Paradiso rose. A tap/click/Esc at
// any point skips straight to onComplete (the welcome step, where profile
// creation + consent now live). Returning users never see this page.

import { useState, useEffect, useRef, useCallback, FC, Suspense, lazy } from 'react';
import './LoginPage.css';
import CosmicBackground from '../components/CosmicBackground';
import LoginContainer from '../components/LoginContainer';
import CinematicCards from '../components/CinematicCards';
import MessagePopup from '../components/MessagePopup';
import LandscapeWarning from '../components/LandscapeWarning';

// Post-paint transition chunks. Both gate their visible work on a prop, so the
// shell renders immediately and these load in the background.
const ParadisoTransition = lazy(() => import('../components/animations/ParadisoTransition'));
const FigureController = lazy(() => import('../components/animations/CosmicLoginTransition/FigureController'));
import { useTranslation } from '../hooks/useTranslation';
import { mediaBaseUrl as MEDIA_BASE } from '../config/runtime';

// Music served from R2 (same track as the podcast + landing clips)
const backgroundMusic = `${MEDIA_BASE}/images/music/music.webm`;
// The hooded "Seeker" — the frameless protagonist at the ring's core
const userThumbnail = `${MEDIA_BASE}/images/figures/user/thumbnail/320.webp`;

// Cinematic timeline — distinct beats, each given room to breathe (skippable).
// All tunable: bump these to make the atmosphere linger.
const PORTAL_MS = 1200;        // the portal ring circles alone (card 1)
const SEEKER_MS = 3400;        // let the portal breathe a while before the Seeker (card 2)
const FIGURES_MS = 2600;       // then the figures begin to fade, one by one (card 3)
const FADE_MS = 4400;          // let them all fade before the rose appears
const FIGURE_START_MS = 200;   // first figure's fade delay
const FIGURE_STAGGER_MS = 460; // gap between figures (atmospheric, one by one)
const PARADISO_AUTO_MS = 4500; // rose bloom (a touch longer) before handing off

declare global {
  interface Window {
    loginFlashInProgress?: boolean;
  }
}

interface LoginPageProps {
  onComplete: () => void;
}

type PopupType = 'error' | 'info' | 'success' | '';

const LoginPage: FC<LoginPageProps> = ({ onComplete }) => {
  const [isFormVisible, setIsFormVisible] = useState<boolean>(false);
  const [seekerVisible, setSeekerVisible] = useState<boolean>(false);
  const [figuresFading, setFiguresFading] = useState<boolean>(false);
  const [isLandscape, setIsLandscape] = useState<boolean>(false);
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [popupMessage] = useState<string>('');
  const [popupType] = useState<PopupType>('');
  const [loginSuccessful, setLoginSuccessful] = useState<boolean>(false);
  const [showSkipOverlay, setShowSkipOverlay] = useState<boolean>(false);
  // Paradiso rose + figure fade orchestration
  const [figuresActive, setFiguresActive] = useState(false);
  const [figureIndices, setFigureIndices] = useState<number[]>([]);
  const [portalAnimActive, setPortalAnimActive] = useState(false);

  const { tNode } = useTranslation();

  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const completingRef = useRef(false);

  const prefersReducedMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Hand off to the welcome step. Guarded so the skip click, Esc, and the
  // Paradiso auto-complete timer can't fire onComplete more than once.
  const finishCinematic = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    window.loginFlashInProgress = true;
    setShowSkipOverlay(false);
    setTimeout(() => onComplete(), 100);
  }, [onComplete]);

  // Begin the rose climax (figures fade + Paradiso). Auto-triggered by the
  // timeline — no click needed. Reduced motion skips straight to the handoff.
  const beginRose = useCallback(() => {
    if (loginSuccessful) return;
    if (prefersReducedMotion.current) {
      setLoginSuccessful(true);
      finishCinematic();
      return;
    }
    setShowSkipOverlay(true);
    setLoginSuccessful(true);
  }, [loginSuccessful, finishCinematic]);

  // Mount: play the music, set the reveal timer, watch orientation.
  useEffect(() => {
    const audio = audioRef.current;

    const playAudio = () => {
      audio?.play().catch(() => {
        // Autoplay blocked — starts on first interaction (listener below).
      });
    };
    if (audio) {
      audio.volume = 0.5;
      playAudio();
    }
    const handleFirstInteraction = () => {
      playAudio();
      document.removeEventListener('pointerdown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('mousemove', handleFirstInteraction);
    };
    document.addEventListener('pointerdown', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    document.addEventListener('mousemove', handleFirstInteraction);

    // Ignite the portal ring first (the Seeker comes a beat later).
    timerRef.current = setTimeout(
      () => setIsFormVisible(true),
      prefersReducedMotion.current ? 0 : PORTAL_MS
    );

    const handleOrientation = () => {
      setIsLandscape(
        window.innerWidth > window.innerHeight &&
        window.innerWidth < 768 &&
        window.innerHeight < 500
      );
    };
    window.addEventListener('resize', handleOrientation);
    handleOrientation();

    return () => {
      audio?.pause();
      if (audio) audio.currentTime = 0;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('pointerdown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('mousemove', handleFirstInteraction);
      window.removeEventListener('resize', handleOrientation);
    };
  }, []);

  // Beat 2: the Seeker materializes once the portal has circled alone.
  useEffect(() => {
    if (!isFormVisible || seekerVisible || loginSuccessful) return;
    const t = setTimeout(() => setSeekerVisible(true), prefersReducedMotion.current ? 0 : SEEKER_MS);
    return () => clearTimeout(t);
  }, [isFormVisible, seekerVisible, loginSuccessful]);

  // Beat 3: the figures begin to fade, one by one.
  useEffect(() => {
    if (!seekerVisible || figuresFading || loginSuccessful) return;
    const t = setTimeout(() => setFiguresFading(true), prefersReducedMotion.current ? 0 : FIGURES_MS);
    return () => clearTimeout(t);
  }, [seekerVisible, figuresFading, loginSuccessful]);

  // Activate the figure fade, then bloom the rose once they have all gone.
  useEffect(() => {
    if (!figuresFading || loginSuccessful) return;
    const figures = document.querySelectorAll<HTMLElement>('.historical-figure');
    setFigureIndices(Array.from(figures).map((_, i) => i));
    setFiguresActive(true);
    const t = setTimeout(() => beginRose(), prefersReducedMotion.current ? 0 : FADE_MS);
    return () => clearTimeout(t);
  }, [figuresFading, loginSuccessful, beginRose]);

  // Beat 4: the rose blooms (the portal + Seeker have handed off).
  useEffect(() => {
    if (!loginSuccessful) return;
    const t = setTimeout(() => setPortalAnimActive(true), prefersReducedMotion.current ? 0 : 200);
    return () => clearTimeout(t);
  }, [loginSuccessful]);

  // Esc skips the whole cinematic.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishCinematic();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [finishCinematic]);

  const closePopup = () => setShowPopup(false);

  // A tap/click anywhere skips straight to the welcome step.
  const handleBackgroundClick = () => {
    finishCinematic();
  };

  if (isLandscape) {
    return <LandscapeWarning />;
  }

  return (
    <div className="background" onClick={handleBackgroundClick}>
      {/* Cosmic background — hide meteors once the rose takes over */}
      <CosmicBackground hideMeteors={loginSuccessful} />

      {/* Portal + frameless Seeker portrait at its core (no card box) */}
      <LoginContainer
        ref={portalRef}
        isFormVisible={!loginSuccessful && isFormVisible}
        loginSuccessful={loginSuccessful}
        handlePortalClick={() => {}}
      >
        <div className={`cinematic-seeker ${seekerVisible ? 'is-visible' : ''}`} aria-hidden="true">
          <img src={userThumbnail} alt="" />
        </div>
      </LoginContainer>

      {/* Parallel verse story above the ring (the Dante line lives in the rose) */}
      <CinematicCards
        active={!loginSuccessful && isFormVisible}
        step={figuresFading ? 2 : seekerVisible ? 1 : 0}
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
          onAnimationComplete={finishCinematic}
          autoCompleteMs={PARADISO_AUTO_MS}
        />
      </Suspense>

      {/* Full-screen skip target during the rose phase */}
      {loginSuccessful && showSkipOverlay && (
        <div
          className="skip-animation-overlay"
          onClick={finishCinematic}
          role="button"
          tabIndex={0}
          aria-label="Skip animation"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
              finishCinematic();
            }
          }}
        />
      )}

      <audio ref={audioRef} loop preload="none">
        <source src={backgroundMusic} type="audio/webm" />
        {tNode('audio.browserNotSupported')}
      </audio>

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite">
        {isFormVisible && tNode('entry.formReady')}
      </div>

      <MessagePopup
        showPopup={showPopup}
        popupMessage={popupMessage}
        popupType={popupType}
        closePopup={closePopup}
      />
    </div>
  );
};

export default LoginPage;
