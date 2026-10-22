// src/components/ProcessingLoader.tsx
import { useEffect, useMemo, useRef, useState, FC } from 'react';
import { Brain, Sparkle, Star } from '@phosphor-icons/react';
import ReactDOM from 'react-dom';
import './ProcessingLoader.css';
import '../styles/liquid-glass.css';
import { useTranslation } from '../hooks/useTranslation';
import { useLiquidGlass } from '../hooks/useLiquidGlass';
import { useSecurityCheckState, useSecurityNoticeHost } from './SecurityCheckNotice';
import { useDomainStore } from '../stores/domainStore';
import { localModeFromRaw } from '../services/audio/config/serviceConfig';

export type ProcessingStage = 'preparing' | 'hearing' | 'contemplating' | 'shaping';
export type CapacityState = 'normal' | 'highDemand' | 'takingLonger';

const APPEAR_DELAY_MS = 250;
const HIGH_DEMAND_AT_S = 8;
const OPT_OUT_AT_S = 10;
const TAKING_LONGER_AT_S = 25;
const QUOTE_ROTATION_MS = 4000;

type WaitService = 'llm' | 'tts' | 'stt';
// The one service each stage waits on. 'hearing' lasts until the transcript is
// back, then the model has the wait; 'shaping' waits for the first voice. A card
// without a stage waits for the reply's text. In mixed Local Mode only a wait on
// the visitor's own service is theirs to hear about.
const STAGE_SERVICE: Record<ProcessingStage, WaitService> = {
  preparing: 'llm',
  hearing: 'stt',
  contemplating: 'llm',
  shaping: 'tts',
};

interface ProcessingLoaderProps {
  figureName: string;
  /** Which pipeline phase the request is in. Without one (a first load) the card waits on the reply's text. */
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
  if (full.includes('Mark Aurel')) return 'Mark Aurel';
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
    return pool.length > 0 ? pool : [tString('processing.normal.preparing.a', 'One moment.')];
  };

  // The busy lines speak of our servers. When part of the wait runs in Local
  // Mode (the visitor's own device or server), a long wait gets its own plain line.
  const savedRaw = useDomainStore((state) => state.serviceConfig.raw);
  const localWait = useMemo(() => {
    const lm = localModeFromRaw(savedRaw);
    const local: Record<WaitService, boolean> = { llm: lm.llmEnabled, tts: lm.ttsEnabled, stt: lm.sttEnabled };
    return local[STAGE_SERVICE[stage ?? 'contemplating']];
  }, [savedRaw, stage]);

  const mountedAtRef = useRef<number>(Date.now());
  const [shouldShow, setShouldShow] = useState(false);
  const [derivedCapacity, setDerivedCapacity] = useState<CapacityState>('normal');
  const [showOptOut, setShowOptOut] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  // Seeded from the module state: on a challenge re-render the escalation can
  // beat this component's mount, so the events alone would miss it. This card
  // shows the waiting line itself, so the page-level notice steps aside.
  const { waiting: securityWait, interactive: turnstileInteractive } = useSecurityCheckState();
  useSecurityNoticeHost();
  const securityCheck = securityWait || turnstileInteractive;
  // Time spent on the bot check is not time the server is busy, so the
  // capacity clock does not count it.
  const checkPausedMsRef = useRef(0);
  const checkSinceRef = useRef<number | null>(null);
  useEffect(() => {
    if (securityCheck && checkSinceRef.current === null) {
      checkSinceRef.current = Date.now();
    } else if (!securityCheck && checkSinceRef.current !== null) {
      checkPausedMsRef.current += Date.now() - checkSinceRef.current;
      checkSinceRef.current = null;
    }
  }, [securityCheck]);

  // 1. Delayed appearance — kills flicker on fast responses (<250ms).
  useEffect(() => {
    const t = setTimeout(() => setShouldShow(true), APPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // 2. Capacity-state transitions driven by wait duration.
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      const checkMs = checkPausedMsRef.current + (checkSinceRef.current === null ? 0 : now - checkSinceRef.current);
      const waitSec = (now - mountedAtRef.current - checkMs) / 1000;
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
    () => {
      if (capacityForQuotes !== 'normal' && localWait) {
        return [tString('processing.localWait', 'Your Local Mode service is still working. One moment.')];
      }
      // A first load waits on the reply's text, as a request does once it is heard.
      return quotePoolFor(capacityForQuotes, stage ?? 'contemplating');
    },
    // quotePoolFor closes over tString.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage, capacityForQuotes, localWait, tString],
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
            {/* While the bot check runs, the capacity copy would blame a busy
                server for a wait the server has no part in. The box sits
                behind this overlay at the bottom, so the interactive copy has
                to point at it or the request dies waiting. */}
            {/* The name stands on its own line and each line is a whole
                sentence: "<name> ist <line>" does not hold in German. */}
            <p className="cosmic-processing-subtitle cosmic-processing-figure">
              <span className="figure-name" title={lastName}>
                {lastName}
              </span>
            </p>
            {turnstileInteractive ? (
              <p className="cosmic-processing-note cosmic-processing-security">
                {tString(
                  'processing.securityCheck',
                  'Quick security check. Tap the box at the bottom of the screen and your message continues.',
                )}
              </p>
            ) : securityWait ? (
              <p className="cosmic-processing-note cosmic-processing-security cosmic-processing-security--wait">
                {tString('processing.securityWait', 'One moment, a quick security check is running.')}
              </p>
            ) : (
              <p className="cosmic-processing-quote">{quote}</p>
            )}

            {/* Inside the card's own status region: a second live region
                would be read out on top of it. */}
            {derivedCapacity === 'takingLonger' && !securityCheck && (
              <p className="cosmic-processing-note">
                {localWait
                  ? tString(
                    'processing.localTakingLonger',
                    'Your Local Mode service is taking longer. Wait a moment for the voice, or read now and skip the wait.',
                  )
                  : tString(
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
