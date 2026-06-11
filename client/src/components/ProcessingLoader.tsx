// src/components/ProcessingLoader.tsx
import { useEffect, useMemo, useRef, useState, FC } from 'react';
import { Brain, Sparkle, Star } from '@phosphor-icons/react';
import ReactDOM from 'react-dom';
import './ProcessingLoader.css';
import '../styles/liquid-glass.css';
import { useTranslation } from '../hooks/useTranslation';
import { useLiquidGlass } from '../hooks/useLiquidGlass';

export type ProcessingStage = 'preparing' | 'hearing' | 'contemplating' | 'shaping';
export type CapacityState = 'normal' | 'highDemand' | 'takingLonger';

const APPEAR_DELAY_MS = 250;
const HIGH_DEMAND_AT_S = 8;
const OPT_OUT_AT_S = 10;
const TAKING_LONGER_AT_S = 25;
const QUOTE_ROTATION_MS = 4000;

interface ProcessingLoaderProps {
  figureName: string;
  /** Which pipeline phase the request is in. Omit for legacy quote pool (backwards compat). */
  stage?: ProcessingStage;
  /** If provided, a "read text instead" button appears after OPT_OUT_AT_S. */
  onSwitchToText?: () => void;
}

/** Format the figure's display name — last name with a few known exceptions. */
function formatFigureName(figureName: string): string {
  const full = figureName?.replace(/^Echo of |^Echo von |^Echo de /i, '') ?? '';
  if (full.includes('Leonardo da Vinci')) return 'da Vinci';
  if (full.includes('Simone de Beauvoir')) return 'Beauvoir';
  if (full.includes('Hildegard von Bingen')) return 'Hildegard';
  if (full.includes('Martin Luther King')) return 'King';
  if (full.includes('Marc Aurel')) return 'Marc Aurel';
  const parts = full.split(' ');
  return parts[parts.length - 1] ?? full;
}

const ProcessingLoader: FC<ProcessingLoaderProps> = ({
  figureName,
  stage,
  onSwitchToText,
}) => {
  const { tNode, tString } = useTranslation();
  const { glassClasses } = useLiquidGlass('audio');

  // Legacy quote pool — used when no stage is provided (keeps backwards compat with any caller
  // that hasn't migrated to the stage-aware API yet).
  const LEGACY_QUOTES = useMemo(
    () => [
      tString('processing.contemplating', 'Contemplating...'),
      tString('processing.crafting', 'Crafting response...'),
      tString('processing.considering', 'Considering...'),
      tString('processing.exploring', 'Exploring...'),
      tString('processing.reflecting', 'Reflecting...'),
      tString('processing.connecting', 'Connecting ideas...'),
    ],
    [tString],
  );

  // Stage+capacity-aware quote pools. Keys structured as processing.<capacity>.<stage>.<letter>.
  const quotePoolFor = (cap: CapacityState, st: ProcessingStage): string[] => {
    const prefix = cap === 'normal' ? 'processing.normal' : 'processing.highDemand';
    const pool: string[] = [];
    // Try letters a..j; include whatever is defined. tString returns the fallback if missing,
    // so we stop when the fallback would be the sentinel.
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    for (const letter of letters) {
      const key = `${prefix}.${st}.${letter}`;
      const value = tString(key, '');
      if (value) pool.push(value);
    }
    return pool.length > 0 ? pool : LEGACY_QUOTES;
  };

  const mountedAtRef = useRef<number>(Date.now());
  const [shouldShow, setShouldShow] = useState(false);
  const [derivedCapacity, setDerivedCapacity] = useState<CapacityState>('normal');
  const [showOptOut, setShowOptOut] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // 1. Delayed appearance — kills flicker on fast responses (<250ms).
  useEffect(() => {
    const t = setTimeout(() => setShouldShow(true), APPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // 2. Capacity-state transitions driven by wait duration.
  useEffect(() => {
    const tick = setInterval(() => {
      const waitSec = (Date.now() - mountedAtRef.current) / 1000;
      if (waitSec >= TAKING_LONGER_AT_S) setDerivedCapacity('takingLonger');
      else if (waitSec >= HIGH_DEMAND_AT_S) setDerivedCapacity('highDemand');
      else setDerivedCapacity('normal');
      if (waitSec >= OPT_OUT_AT_S) setShowOptOut(true);
    }, 500);
    return () => clearInterval(tick);
  }, []);

  // 3. Quote rotation — one pool at a time (based on current stage + capacity).
  // Changing the pool resets the rotation so a transition into a new pool starts from quote 0.
  const capacityForQuotes: CapacityState =
    derivedCapacity === 'takingLonger' ? 'highDemand' : derivedCapacity;
  const activePool = useMemo(
    () => (stage ? quotePoolFor(capacityForQuotes, stage) : LEGACY_QUOTES),
    // quotePoolFor closes over tString; LEGACY_QUOTES already memoized on tString.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage, capacityForQuotes, tString, LEGACY_QUOTES],
  );

  useEffect(() => {
    setQuoteIndex(0);
    if (activePool.length <= 1) return;
    const rotator = setInterval(() => {
      setQuoteIndex((idx) => (idx + 1) % activePool.length);
    }, QUOTE_ROTATION_MS);
    return () => clearInterval(rotator);
  }, [activePool]);

  if (!shouldShow) return null;

  const quote = activePool[quoteIndex] ?? activePool[0] ?? '';
  const lastName = formatFigureName(figureName);

  // When stage is provided we use the new standalone-sentence pattern (no "ist/is" prefix).
  // When stage is absent (legacy path), keep the old "<Name> is <quote>" rendering.
  const isStageAware = Boolean(stage);

  const overlayClasses = `cosmic-processing-overlay capacity-${derivedCapacity}`;

  return ReactDOM.createPortal(
    <div className={overlayClasses} role="status" aria-live="polite">
      <div className={`processing-loader-background ${glassClasses}`} />

      <div className="cosmic-processing-content premium-card">
        <div className="cosmic-processing-icon-container">
          <div className="cosmic-processing-icon">
            <Brain size={28} className="brain-icon" />
            <div className="spinning-circles">
              <div className="circle circle-1"></div>
              <div className="circle circle-2"></div>
              <div className="circle circle-3"></div>
            </div>
          </div>
          <div className="cosmic-sparkles">
            <Sparkle size={16} className="sparkle sparkle-1" />
            <Star size={12} className="sparkle sparkle-2" />
            <Sparkle size={14} className="sparkle sparkle-3" />
          </div>
        </div>

        <div className="cosmic-processing-text">
          <h3 className="cosmic-processing-title">{tNode('processing.title')}</h3>
          <div className="cosmic-processing-subtitle-container">
            {isStageAware ? (
              <>
                <p className="cosmic-processing-subtitle cosmic-processing-figure">
                  <span className="figure-name" title={lastName}>
                    {lastName}
                  </span>
                </p>
                <p className="cosmic-processing-quote">{quote}</p>
              </>
            ) : (
              <p className="cosmic-processing-subtitle">
                <span className="figure-name" title={lastName}>
                  {lastName}
                </span>
                <span>
                  {tNode('processing.is')} {quote}
                </span>
              </p>
            )}

            {derivedCapacity === 'takingLonger' && (
              <p className="cosmic-processing-note" aria-live="polite">
                {tString(
                  'processing.takingLonger',
                  'Takes a bit longer today, the voice is on its way.',
                )}
              </p>
            )}

            <div className="cosmic-progress-bar">
              <div className="cosmic-progress-track">
                <div className="cosmic-progress-fill"></div>
              </div>
            </div>

            {showOptOut && onSwitchToText && (
              <button
                type="button"
                className={`cosmic-processing-opt-out${
                  derivedCapacity === 'takingLonger' ? ' prominent' : ''
                }`}
                onClick={onSwitchToText}
              >
                {tString('processing.optOut', 'Read text instead')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ProcessingLoader;
