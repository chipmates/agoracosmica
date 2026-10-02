// src/pages/LoginPage.tsx
//
// Entry "Vorspann": a short, auto-playing, skippable film. No card, no
// button. A river of light turns round and opens as the Paradiso rose, the
// verse lines rise over it, and it ends on the poem's last line. A
// tap/click/Esc at any point skips straight to onComplete (the welcome step,
// where profile creation + consent now live). Returning users never see this
// page.

import { useState, useEffect, useRef, useCallback, FC, Suspense, lazy } from 'react';
import './LoginPage.css';
import MessagePopup from '../components/MessagePopup';
import LandscapeWarning from '../components/LandscapeWarning';

// The film where WebGL2 runs, the CSS sequence everywhere else (and under
// reduced motion). Both load after the shell paints.
const RoseFilm = lazy(() => import('../components/animations/RoseFilm/RoseFilm'));
const CssCinematic = lazy(() => import('../components/animations/CssCinematic/CssCinematic'));
import { useTranslation } from '../hooks/useTranslation';
import { mediaBaseUrl as MEDIA_BASE } from '../config/runtime';
import { sendFunnelBeaconOnce, cinematicDwellBucket, CinematicOutcome } from '../utils/funnelBeacon';
import { doorArrivalLabel } from '../utils/public/entryIntent';
import { pickCosmosTier } from '../cosmos/tiers';

// Music served from R2 (same track as the podcast + landing clips). The mp3
// exists because Safari and iOS cannot decode Opus-in-WebM in an audio element.
const backgroundMusic = `${MEDIA_BASE}/images/music/music.webm`;
const backgroundMusicMp3 = `${MEDIA_BASE}/images/music/music.mp3`;

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
  const [isLandscape, setIsLandscape] = useState<boolean>(false);
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [popupMessage] = useState<string>('');
  const [popupType] = useState<PopupType>('');
  const [skipHintVisible, setSkipHintVisible] = useState<boolean>(false);
  const [announced, setAnnounced] = useState<boolean>(false);
  // 'still' = reduced motion or no WebGL2: the CSS sequence plays instead.
  const [tier, setTier] = useState(() => pickCosmosTier());

  const { tNode } = useTranslation();

  const audioRef = useRef<HTMLAudioElement>(null);
  const completingRef = useRef(false);
  // Dwell clock for the cinematic_end funnel bucket. Only the coarse bucket
  // index ever leaves the browser, never this raw timestamp.
  const cinematicStartRef = useRef<number>(performance.now());

  const prefersReducedMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Hand off to the welcome step. Guarded so the skip click, Esc, and the
  // Paradiso auto-complete timer can't fire onComplete more than once.
  // The outcome says HOW the cinematic ended: 'watched' (auto-complete ran
  // its course) or 'skipped' (Esc, background tap, skip overlay).
  const finishCinematic = useCallback((outcome: CinematicOutcome) => {
    if (completingRef.current) return;
    completingRef.current = true;
    // Funnel: cinematic finished. Outcome + coarse dwell bucket only.
    sendFunnelBeaconOnce('cinematic_end', {
      outcome,
      bucket: cinematicDwellBucket(performance.now() - cinematicStartRef.current),
      mode: doorArrivalLabel(),
    });
    // Fade the music out over the handoff so it is silent by the time the
    // welcome disclosure takes over (unmount alone would cut it mid-note).
    // Step-counted because iOS ignores volume writes: the pause on the last
    // step is the guaranteed stop everywhere.
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      const startVolume = audio.volume;
      let step = 0;
      const fade = setInterval(() => {
        const a = audioRef.current;
        step += 1;
        if (!a || step >= 10) {
          if (a) {
            a.pause();
            a.volume = startVolume;
          }
          clearInterval(fade);
          return;
        }
        a.volume = Math.max(0, startVolume * (1 - step / 10));
      }, 50);
    }
    window.loginFlashInProgress = true;
    setTimeout(() => onComplete(), 100);
  }, [onComplete]);

  // Warm the post-cinematic chunks while the cinematic plays. Without this the
  // HomePage bundle and the welcome modal only start downloading AFTER the
  // skip/handoff, which on slow connections shows a bare "Loading..." seam.
  useEffect(() => {
    import('./HomePage').catch(() => {});
    import('../components/WelcomeDisclosureModal').catch(() => {});
  }, []);

  // Funnel: the cinematic started. New visitors only (returners are restored
  // silently and never mount this page), so it is a clean new-visitor
  // denominator. One-shot per tab; also (re)arms the dwell clock.
  useEffect(() => {
    cinematicStartRef.current = performance.now();
    sendFunnelBeaconOnce('cinematic_start', { mode: doorArrivalLabel() });
  }, []);

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

    // Tell screen readers once the sequence is under way.
    const announceTimer = setTimeout(() => setAnnounced(true), 1200);

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
      clearTimeout(announceTimer);
      document.removeEventListener('pointerdown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('mousemove', handleFirstInteraction);
      window.removeEventListener('resize', handleOrientation);
    };
  }, []);

  // The skip affordance was invisible: a tap anywhere skips, but nothing said
  // so. Fade in a quiet hint after a moment, once it's clear this is a
  // sequence and not the app.
  useEffect(() => {
    if (prefersReducedMotion.current) return;
    const t = setTimeout(() => setSkipHintVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Esc skips the whole cinematic.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishCinematic('skipped');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [finishCinematic]);

  const closePopup = () => setShowPopup(false);

  // A tap/click anywhere skips straight to the welcome step.
  const handleBackgroundClick = () => {
    finishCinematic('skipped');
  };

  if (isLandscape) {
    return <LandscapeWarning />;
  }

  return (
    <div className="background" onClick={handleBackgroundClick}>
      <Suspense fallback={null}>
        {tier === 'still' ? (
          <CssCinematic
            onWatched={() => finishCinematic('watched')}
            onSkip={() => finishCinematic('skipped')}
          />
        ) : (
          <RoseFilm
            tier={tier}
            onEnd={() => finishCinematic('watched')}
            onFail={() => setTier('still')}
          />
        )}
      </Suspense>

      {/* No AI note over the cinematic: the welcome gate notice lands seconds
          later in the same first-run flow and carries the full disclosure
          (accepted-risk call 2026-07-02, lawyer question stays open). */}

      {/* Quiet skip hint, visual only (the SR live region below says the same) */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'var(--gold-base)',
          opacity: skipHintVisible ? 0.85 : 0,
          transition: 'opacity 1.2s ease',
          fontSize: '15px',
          letterSpacing: '0.04em',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 5
        }}
      >
        {tNode('entry.skipHint')}
      </div>

      <audio ref={audioRef} loop preload="none">
        <source src={backgroundMusic} type="audio/webm" />
        <source src={backgroundMusicMp3} type="audio/mpeg" />
        {tNode('audio.browserNotSupported')}
      </audio>

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite">
        {announced && tNode('entry.formReady')}
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
