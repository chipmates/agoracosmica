// src/components/CosmicCouncil/CosmicCouncilLoader.tsx
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Sparkle, Star, Users } from '@phosphor-icons/react';
import ReactDOM from 'react-dom';
import '../ProcessingLoader.css'; // Reuse existing cosmic styles
import './CosmicCouncilLoader.css'; // Council-specific styles
import '../../styles/liquid-glass.css';
import useTranslation from '../../hooks/useTranslation';
import { useLiquidGlass } from '../../hooks/useLiquidGlass';
import type { CapacityState } from '../ProcessingLoader';

export type LoaderStage = 'generating' | 'streaming' | 'processing';

// Council phases are longer than single-turn pipeline phases, so thresholds are scaled up.
// Council users already expect the whole thing to take a while; what they don't expect
// is "longer than usual" — that's when we shift capacity signals.
const APPEAR_DELAY_MS = 250;
const HIGH_DEMAND_AT_S = 30;
const OPT_OUT_AT_S = 45;
const TAKING_LONGER_AT_S = 90;
const QUOTE_ROTATION_MS = 3500;

interface Participant {
  id?: string;
  name?: string;
}

interface CosmicCouncilLoaderProps {
  councilParticipants?: (string | Participant)[];
  question?: string;
  stage?: LoaderStage;
  onSwitchToText?: () => void;
}

const CosmicCouncilLoader: FC<CosmicCouncilLoaderProps> = ({
  councilParticipants = [],
  question = '',
  stage = 'generating',
  onSwitchToText,
}) => {
  const { t, tString, tNode } = useTranslation();
  const { glassClasses } = useLiquidGlass('audio');

  // Legacy quote pool — used when capacity is 'normal'. Keeps the original council tone.
  const NORMAL_QUOTES: Record<LoaderStage, string[]> = useMemo(
    () => ({
      generating: [
        tString('councilProcessing.assembling', 'assembling the philosophical council...'),
        tString('councilProcessing.inviting', 'inviting wisdom keepers to gather...'),
        tString('councilProcessing.preparing', 'preparing the cosmic chamber...'),
        tString('councilProcessing.initiating', 'initiating the sacred dialogue...'),
      ],
      streaming: [
        tString('councilProcessing.dialogueFlowing', 'dialogue flowing between minds...'),
        tString('councilProcessing.wisdomEmerging', 'wisdom emerging from debate...'),
        tString('councilProcessing.conversationUnfolding', 'conversation unfolding organically...'),
        tString('councilProcessing.insightsForming', 'insights forming through exchange...'),
      ],
      processing: [
        tString('councilProcessing.finalizing', 'finalizing philosophical positions...'),
        tString('councilProcessing.polishing', 'polishing the discourse...'),
        tString('councilProcessing.completing', 'completing the council session...'),
      ],
    }),
    [tString],
  );

  // High-demand quote pools per council stage. Council is already a long wait by nature,
  // so high-demand here means "even slower than usual" — quotes acknowledge that without
  // breaking the brand voice. Drop back into the legacy pool as fallback if keys missing.
  const highDemandPoolFor = (st: LoaderStage): string[] => {
    const letters = ['a', 'b', 'c'];
    const pool: string[] = [];
    for (const letter of letters) {
      const value = tString(`councilProcessing.highDemand.${st}.${letter}`, '');
      if (value) pool.push(value);
    }
    return pool.length > 0 ? pool : NORMAL_QUOTES[st];
  };

  const mountedAtRef = useRef<number>(Date.now());
  const [shouldShow, setShouldShow] = useState(false);
  const [derivedCapacity, setDerivedCapacity] = useState<CapacityState>('normal');
  const [showOptOut, setShowOptOut] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // 1. Delayed appearance.
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
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // 3. Quote rotation — picks pool based on current council stage + capacity.
  const capacityForQuotes: CapacityState =
    derivedCapacity === 'takingLonger' ? 'highDemand' : derivedCapacity;
  const activePool = useMemo(
    () =>
      capacityForQuotes === 'highDemand'
        ? highDemandPoolFor(stage)
        : NORMAL_QUOTES[stage] ?? NORMAL_QUOTES.generating,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage, capacityForQuotes, NORMAL_QUOTES, tString],
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

  // Format participant names for display
  const formatParticipants = (): string => {
    if (councilParticipants.length === 0) {
      return tString('councilProcessing.philosophers', 'the Philosophers');
    }
    const names = councilParticipants.map((participant) => {
      const name = typeof participant === 'string' ? participant : participant.name || participant.id || '';
      const cleanName = name.replace(/^echo of |^echo von |^echo de /i, '');
      const nameParts = cleanName.split(' ');
      const lastName = nameParts[nameParts.length - 1];

      if (cleanName.includes('leonardo da vinci')) return 'da Vinci';
      if (cleanName.includes('simone de beauvoir')) return 'Beauvoir';
      if (cleanName.includes('hildegard von bingen')) return 'Hildegard';
      if (cleanName.includes('martin luther king')) return 'King';
      if (cleanName.toLowerCase().includes('gautama')) return 'Buddha';

      return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    });

    if (names.length <= 3) return names.join(', ');
    return names.slice(0, 2).join(', ') + ` ${tString('councilProcessing.andOthers', '& others')}`;
  };

  const overlayClasses = `council-loader-overlay capacity-${derivedCapacity}`;

  return ReactDOM.createPortal(
    <div className={overlayClasses} role="status" aria-live="polite">
      <div className={`council-loader-background ${glassClasses}`} />

      <div className="cosmic-processing-content premium-card">
        <div className="cosmic-processing-icon-container">
          <div className="cosmic-processing-icon">
            <Users size={32} className="brain-icon" />
            <div className="spinning-circles">
              <div className="circle circle-1"></div>
              <div className="circle circle-2"></div>
              <div className="circle circle-3"></div>
              <div
                className="circle circle-4"
                style={{
                  width: '75px',
                  height: '75px',
                  animationDelay: '-1.5s',
                  opacity: 0.3,
                }}
              ></div>
            </div>
          </div>

          <div className="cosmic-sparkles">
            <Sparkle size={16} className="sparkle sparkle-1" />
            <Star size={12} className="sparkle sparkle-2" />
            <Sparkle size={14} className="sparkle sparkle-3" />
            <Brain
              size={10}
              className="sparkle sparkle-4"
              style={{
                position: 'absolute',
                top: '15%',
                right: '20%',
                animationDelay: '-2s',
              }}
            />
          </div>
        </div>

        <div className="cosmic-processing-text">
          <h3 className="cosmic-processing-title">{tNode('councilProcessing.title')}</h3>
          <div className="cosmic-processing-subtitle-container">
            <p className="cosmic-processing-subtitle cosmic-processing-figure">
              <span className="figure-name council-participants" title={formatParticipants()}>
                {formatParticipants()}
              </span>
            </p>
            <p className="cosmic-processing-quote">{quote}</p>

            {question && question.length > 0 && (
              <div className="council-question-preview">
                <p className="question-text">
                  "{question.length > 80 ? question.substring(0, 80) + '...' : question}"
                </p>
              </div>
            )}

            {derivedCapacity === 'takingLonger' && (
              <p className="cosmic-processing-note" aria-live="polite">
                {tString(
                  'councilProcessing.takingLonger',
                  'Takes longer today. Wait a moment, or read the dialogue now.',
                )}
              </p>
            )}

            <div className="cosmic-progress-bar">
              <div className="cosmic-progress-track">
                <div className="cosmic-progress-fill council-progress"></div>
              </div>
              <div className="progress-stage-indicator">
                {stage === 'generating' &&
                  tString('councilProcessing.stageGenerating', 'Generating Council')}
                {stage === 'streaming' &&
                  tString('councilProcessing.stageStreaming', 'Streaming Dialogue')}
                {stage === 'processing' &&
                  tString('councilProcessing.stageProcessing', 'Processing Wisdom')}
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
                {tString('councilProcessing.optOut', 'Read dialogue instead')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CosmicCouncilLoader;
