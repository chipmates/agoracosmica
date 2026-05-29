/**
 * CinematicCards — the parallel verse story for the entry "Vorspann".
 *
 * Sits above the ring and unfolds line by line across the whole sequence:
 * card 1 while the portal circles, card 2 as the Seeker arrives, card 3 while
 * the figures fade — holding until the rose takes over. Each line floats up and
 * glows gold, matching the Paradiso rose's Dante quote. The Dante line itself
 * lives in the rose, so this layer owns cards 1–3.
 *
 * `step` is driven by the page timeline so the words sync to the visuals.
 */
import { FC } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface CinematicCardsProps {
  active: boolean;
  step: number; // 0 = portal, 1 = Seeker, 2 = figures fading
}

const CARD_KEYS = ['entry.cinematic.card1', 'entry.cinematic.card2', 'entry.cinematic.card3'];

const CinematicCards: FC<CinematicCardsProps> = ({ active, step }) => {
  const { tString } = useTranslation();
  if (!active) return null;

  const text = tString(CARD_KEYS[step] || CARD_KEYS[0], '');

  return (
    <div className="cine-stage" aria-hidden="true">
      <style>{`
        .cine-stage {
          position: absolute;
          left: 50%;
          top: 13%;
          transform: translateX(-50%);
          width: min(90vw, 44rem);
          text-align: center;
          z-index: 6;
          pointer-events: none;
        }
        .cine-card {
          margin: 0;
          font-family: 'Libre Caslon Text', Georgia, serif;
          font-style: italic;
          font-weight: 400;
          font-size: clamp(1.1rem, 3.4vw, 1.7rem);
          line-height: 1.45;
          /* Golden + glow, matching the Paradiso rose quote */
          color: rgba(245, 210, 120, 0.92);
          text-shadow: 0 0 28px rgba(245, 210, 120, 0.4);
          /* Float up like the rose's quote */
          animation: cine-rise 1.6s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
        }
        @keyframes cine-rise {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cine-card { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
      {/* key remounts on step change so each new line floats up fresh */}
      <p className="cine-card" key={step}>{text}</p>
    </div>
  );
};

export default CinematicCards;
