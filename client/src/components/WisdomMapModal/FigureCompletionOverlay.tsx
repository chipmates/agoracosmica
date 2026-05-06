// FigureCompletionOverlay.tsx - Tier 3: Figure Completion celebration
// Slow Illumination: stars light up one by one over 3s synced to choir sound,
// then CompletionCelebration card fades in on top.

import React, { useEffect, useState, useCallback, FC } from 'react';
import CompletionCelebration from './CompletionCelebration';
import './css/FigureCompletionOverlay.css';
import type { CommunityTier } from '../CommunityGovernance/computeVotingPower';

interface FigureCompletionOverlayProps {
  constellationPattern: number[][];   // Array of [x, y] coordinate pairs
  figureName: string;
  constellationName: string;
  totalSeeds: number;
  soundUrl?: string;
  soundEnabled?: boolean;
  onClose: () => void;
  /** Total voting power including this just-completed figure */
  votingPowerTotal?: number;
  /** If set, the user just crossed into this tier with this completion */
  newlyUnlockedTier?: Exclude<CommunityTier, 'listener'>;
  /** Optional callback to open the Community modal from the celebration card */
  onOpenCommunity?: () => void;
}

const FigureCompletionOverlay: FC<FigureCompletionOverlayProps> = ({
  constellationPattern,
  figureName,
  constellationName,
  totalSeeds,
  soundUrl = '/assets/sounds/bloom-choir.webm',
  soundEnabled = true,
  onClose,
  votingPowerTotal,
  newlyUnlockedTier,
  onOpenCommunity,
}) => {
  const [phase, setPhase] = useState<'illumination' | 'card'>('illumination');
  const [litStars, setLitStars] = useState<Set<number>>(new Set());
  const [linesGlow, setLinesGlow] = useState(false);
  const [showName, setShowName] = useState(false);
  const [visible, setVisible] = useState(false);

  // Generate sequential line connections (pattern[i] → pattern[i+1])
  // Matches the real constellation line logic in ZodiacConstellation.ts
  const lineConnections: [number, number][] = [];
  for (let i = 0; i < constellationPattern.length - 1; i++) {
    lineConnections.push([i, i + 1]);
  }

  const playSound = useCallback(() => {
    if (!soundEnabled || !soundUrl) return;
    try {
      const audio = new Audio(soundUrl);
      audio.volume = 0.4;
      audio.play().catch(() => {});
    } catch { /* ignore */ }
  }, [soundEnabled, soundUrl]);

  useEffect(() => {
    const timers: number[] = [];
    const t = (fn: () => void, delay: number) => {
      timers.push(window.setTimeout(fn, delay));
    };

    // Fade in overlay
    requestAnimationFrame(() => setVisible(true));

    // Build illumination order: outside edges inward
    // Sort stars by distance from center, farthest first
    const center = constellationPattern.reduce(
      (acc, [x, y]) => [acc[0] + x / constellationPattern.length, acc[1] + y / constellationPattern.length],
      [0, 0]
    );
    const ordered = constellationPattern
      .map(([x, y], i) => ({
        index: i,
        dist: Math.sqrt((x - center[0]) ** 2 + (y - center[1]) ** 2),
      }))
      .sort((a, b) => b.dist - a.dist)
      .map(s => s.index);

    // Play sound at start of illumination
    t(() => playSound(), 200);

    // Light up stars one by one over ~2.8s
    const stagger = Math.min(230, 2800 / Math.max(ordered.length, 1));
    ordered.forEach((starIdx, i) => {
      t(() => {
        setLitStars(prev => new Set([...prev, starIdx]));
      }, 300 + i * stagger);
    });

    // Lines glow after most stars are lit
    t(() => setLinesGlow(true), 300 + ordered.length * stagger * 0.7);

    // Show figure name
    t(() => setShowName(true), 300 + ordered.length * stagger * 0.85);

    // Transition to card phase
    t(() => setPhase('card'), 300 + ordered.length * stagger + 800);

    return () => timers.forEach(id => clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`figure-completion-overlay ${visible ? 'visible' : ''}`}>
      {phase === 'illumination' && (
        <div className="figure-completion-constellation">
          {/* SVG lines */}
          <svg className="figure-completion-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {lineConnections.map(([a, b], i) => {
              const bothLit = litStars.has(a) && litStars.has(b);
              return (
                <line
                  key={i}
                  className={`figure-completion-line ${bothLit ? 'lit' : ''} ${linesGlow ? 'glow' : ''}`}
                  x1={constellationPattern[a]?.[0] ?? 0}
                  y1={constellationPattern[a]?.[1] ?? 0}
                  x2={constellationPattern[b]?.[0] ?? 0}
                  y2={constellationPattern[b]?.[1] ?? 0}
                />
              );
            })}
          </svg>

          {/* Stars */}
          {constellationPattern.map(([px, py], i) => (
            <div
              key={i}
              className="figure-completion-star-pos"
              style={{ left: `${px}%`, top: `${py}%` }}
            >
              <div
                className={`star gathered bloom-level bloom-level-4 ${litStars.has(i) ? 'figure-star-lit' : 'figure-star-dim'}`}
                style={{ animationPlayState: 'running' }}
              />
            </div>
          ))}

          {/* Figure name */}
          <div className={`figure-completion-name ${showName ? 'visible' : ''}`}>
            {figureName}
          </div>
        </div>
      )}

      {phase === 'card' && (
        <CompletionCelebration
          constellationName={constellationName}
          totalSeeds={totalSeeds}
          onClose={onClose}
          votingPowerTotal={votingPowerTotal}
          newlyUnlockedTier={newlyUnlockedTier}
          onOpenCommunity={onOpenCommunity}
        />
      )}
    </div>
  );
};

export default FigureCompletionOverlay;
