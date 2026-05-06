// BloomTransformationCard.tsx - Contemplative close-up of a star's level-up transformation
// Shows the real platform star at large scale morphing between bloom levels.
// Stays visible until the user taps to dismiss.

import React, { useEffect, useState, useRef, FC } from 'react';
import './css/BloomTransformationCard.css';
// Import real Star.css so we get the actual platform star visuals
import './css/Star.css';

export type MasteryVariant = 'gold-ring' | 'four-rings' | 'light-burst';

interface BloomTransformationCardProps {
  fromLevel: number;       // 0-4
  toLevel: number;         // 0-4 (must be > fromLevel)
  seedTitle: string;       // e.g. "The Stoic Path"
  figureName: string;      // e.g. "Marcus Aurelius"
  onClose?: () => void;
  soundUrl?: string;       // URL to bloom sound file
  soundEnabled?: boolean;
  reducedMotion?: boolean;
  speedMultiplier?: number; // 1 = normal, 0.5 = slow, 2 = fast
  masteryVariant?: MasteryVariant; // Which L4 mastery effect to use
  /** When true and toLevel === 4, render the first-mastery community reward
   *  block: "+1 voting power · You're now a Voice". Set by WisdomMapModal
   *  via hasAnyWitnessedMastery() when the user reaches their very first L4. */
  isFirstMastery?: boolean;
}

// First-mastery reward copy. Hardcoded EN/DE matches the existing pattern
// in this file (HEADERS, REFLECTIONS) — file is not yet hooked into i18n.
const FIRST_MASTERY_COPY = {
  en: {
    rewardLabel: 'Community Voting Power',
    rewardValue: '+1',
    tierTitle: "You're now a Voice",
    tierDesc: 'Your voice in the agora is growing.',
  },
  de: {
    rewardLabel: 'Community-Stimmkraft',
    rewardValue: '+1',
    tierTitle: 'Du bist jetzt eine Stimme',
    tierDesc: 'Deine Stimme in der Agora wächst.',
  },
};

// Headers for each target level
const HEADERS: Record<number, { en: string; de: string }> = {
  1: { en: 'First Light', de: 'Erstes Licht' },
  2: { en: 'Deepening', de: 'Vertiefung' },
  3: { en: 'Expanding', de: 'Erweiterung' },
  4: { en: 'Fully Bloomed', de: 'Voll erblüht' },
};

// Reflection lines per transition
const REFLECTIONS: Record<string, { en: string; de: string }> = {
  '0-1': { en: 'A teaching heard for the first time.', de: 'Eine Lehre, zum ersten Mal gehört.' },
  '1-2': { en: 'Deepened through conversation.', de: 'Vertieft im Gespräch.' },
  '2-3': { en: 'Seen through new eyes.', de: 'Mit neuen Augen gesehen.' },
  '3-4': { en: 'Tested and understood. This teaching is yours.', de: 'Geprüft und verstanden. Diese Lehre gehört dir.' },
};

// For multi-level jumps, use the target level's reflection
const getReflection = (from: number, to: number) => {
  // Try exact match first
  const exact = REFLECTIONS[`${from}-${to}`];
  if (exact) return exact;
  // For jumps (e.g. 0→3), use the target level's single-step reflection
  const fallback = REFLECTIONS[`${to - 1}-${to}`];
  return fallback;
};

const BloomTransformationCard: FC<BloomTransformationCardProps> = ({
  fromLevel,
  toLevel,
  seedTitle,
  figureName,
  onClose,
  soundUrl,
  soundEnabled = false,
  reducedMotion = false,
  speedMultiplier = 1,
  masteryVariant = 'light-burst',
  isFirstMastery = false,
}) => {
  const lang = (
    (typeof window !== 'undefined' && window.localStorage?.getItem('selectedLanguage')) || 'en'
  ) as 'en' | 'de';
  const firstMasteryCopy = FIRST_MASTERY_COPY[lang] ?? FIRST_MASTERY_COPY.en;
  const [phase, setPhase] = useState<'entering' | 'showing' | 'transforming' | 'reflecting'>('entering');
  const [starLevel, setStarLevel] = useState(fromLevel);
  const [blooming, setBlooming] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);
  const [lightBurstActive, setLightBurstActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<number[]>([]);

  const isMastery = toLevel === 4;
  const isHatch = fromLevel === 0;

  // Timing: egg gets shown longer, mastery transform is slower
  const showDuration = isHatch ? 2000 : 1200;  // How long to show the "before" state
  const animDuration = isMastery ? 3000 : (isHatch ? 3000 : 2000);

  const addTimer = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay / speedMultiplier);
    timersRef.current.push(id);
  };

  const playSound = () => {
    if (!soundEnabled || !soundUrl) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(soundUrl);
        audioRef.current.volume = 0.4;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch { /* ignore */ }
  };

  useEffect(() => {
    setPhase('entering');

    // Show the "before" state (egg stays visible longer)
    addTimer(() => {
      setPhase('showing');
    }, 500);

    // Transform
    addTimer(() => {
      setPhase('transforming');
      setStarLevel(toLevel);
      setBlooming(true);
      if (isMastery) {
        if (masteryVariant === 'light-burst') {
          setLightBurstActive(true);
        } else {
          setPulseActive(true);
        }
      }
      playSound();
    }, 500 + showDuration);

    // Settle: animation done, text fades in. No auto-dismiss.
    addTimer(() => {
      setBlooming(false);
      setPulseActive(false);
      setLightBurstActive(false);
      setPhase('reflecting');
    }, 500 + showDuration + animDuration);

    return () => {
      timersRef.current.forEach(id => clearTimeout(id));
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    // Only dismiss after transformation is done
    if (phase === 'reflecting' && onClose) {
      onClose();
    }
  };

  const header = HEADERS[toLevel];
  const reflection = getReflection(fromLevel, toLevel);
  const isVisible = phase !== 'entering';
  const showText = phase === 'reflecting';

  // Build star class using real platform classes
  const getStarClasses = () => {
    const classes = ['star'];

    // L0 = ungathered egg (.star:not(.gathered) in Star.css)
    // L1+ = gathered with bloom level
    if (starLevel > 0) {
      classes.push('gathered', 'bloom-level', `bloom-level-${starLevel}`);
    }

    if (blooming) {
      // Mastery takes precedence (even if starting from egg)
      if (isMastery) classes.push('bloom-transform-mastery');
      else if (isHatch) classes.push('bloom-transform-hatch');
      else classes.push('bloom-transform-grow');
    }

    return classes.join(' ');
  };

  return (
    <div
      className={`bloom-card-overlay ${isVisible ? 'visible' : ''} ${reducedMotion ? 'reduced-motion' : ''} ${isMastery ? 'mastery' : ''}`}
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bloom-card-title"
      tabIndex={-1}
    >
      <div
        className={`bloom-card ${isVisible ? 'visible' : ''}`}
        onClick={handleDismiss}
      >
        {/* Decorative accent line */}
        <div className="bloom-card-accent" />

        {/* Star stage */}
        <div className={`bloom-card-stage ${isMastery && (pulseActive || lightBurstActive) ? 'mastery-dimmed' : ''} ${lightBurstActive ? 'light-burst-active' : ''}`}>
          <div
            className={getStarClasses()}
            style={blooming ? {
              animationDuration: `${animDuration / speedMultiplier}ms`,
              animationPlayState: 'running',
            } : {
              animationPlayState: 'running',
            }}
          />

          {/* Variant 1: Gold ring */}
          {isMastery && masteryVariant === 'gold-ring' && (
            <div
              className={`bloom-card-pulse-ring gold ${pulseActive ? 'active' : ''}`}
              style={pulseActive ? { animationDuration: `${2000 / speedMultiplier}ms` } : undefined}
            />
          )}

          {/* Variant 2: Four sequential rings */}
          {isMastery && masteryVariant === 'four-rings' && pulseActive && (
            <>
              <div className="bloom-card-pulse-ring story active" style={{ animationDuration: `${2000 / speedMultiplier}ms`, animationDelay: '0ms' }} />
              <div className="bloom-card-pulse-ring wisdom active" style={{ animationDuration: `${2000 / speedMultiplier}ms`, animationDelay: `${200 / speedMultiplier}ms` }} />
              <div className="bloom-card-pulse-ring prism active" style={{ animationDuration: `${2000 / speedMultiplier}ms`, animationDelay: `${400 / speedMultiplier}ms` }} />
              <div className="bloom-card-pulse-ring quest active" style={{ animationDuration: `${2000 / speedMultiplier}ms`, animationDelay: `${600 / speedMultiplier}ms` }} />
            </>
          )}

          {/* Variant 3: Light burst (no ring, handled via CSS on .light-burst-active) */}
        </div>

        {/* Header */}
        {header && (
          <div className={`bloom-card-header ${showText ? 'visible' : ''}`}>
            {header.en}
          </div>
        )}

        {/* Seed title */}
        <h3
          id="bloom-card-title"
          className={`bloom-card-seed-title ${showText ? 'visible' : ''}`}
        >
          {seedTitle}
        </h3>

        {/* Figure name */}
        <p className={`bloom-card-figure ${showText ? 'visible' : ''}`}>
          with {figureName}
        </p>

        {/* Reflection line */}
        {reflection && (
          <p className={`bloom-card-reflection ${showText ? 'visible' : ''}`}>
            {reflection.en}
          </p>
        )}

        {/* First-mastery community reward — fires only on the user's very first
            Level-4 seed, the moment they earn their first +1 voting power and
            cross from Listener to Voice. Detection happens in WisdomMapModal
            via hasAnyWitnessedMastery(). */}
        {isFirstMastery && isMastery && (
          <div
            className={`bloom-card-first-mastery ${showText ? 'visible' : ''}`}
          >
            <div className="bloom-card-first-mastery-divider" />
            <div className="bloom-card-first-mastery-reward">
              <svg
                className="bloom-card-first-mastery-icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 2L14.5 9H22L16 13.5L18 21L12 16.5L6 21L8 13.5L2 9H9.5L12 2Z"
                  fill="currentColor"
                />
              </svg>
              <span className="bloom-card-first-mastery-reward-label">
                {firstMasteryCopy.rewardLabel}
              </span>
              <span className="bloom-card-first-mastery-reward-value">
                {firstMasteryCopy.rewardValue}
              </span>
            </div>
            <div className="bloom-card-first-mastery-tier">
              <div className="bloom-card-first-mastery-tier-title">
                {firstMasteryCopy.tierTitle}
              </div>
              <div className="bloom-card-first-mastery-tier-desc">
                {firstMasteryCopy.tierDesc}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BloomTransformationCard;
