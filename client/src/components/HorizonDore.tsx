/**
 * HorizonDore — Doré Paradiso XXXI composition.
 *
 * Two hooded figures on a rocky outcrop gazing up at the celestial portal.
 * Shape 2 (sharp crags) frozen as the production variant.
 */
import { FC } from 'react';
import './HorizonLandscape.css';
import OptimizedImage from './OptimizedImage';

/** Shape 2: Sharper crags — dramatic, Doré-like rocky cliff */
const OUTCROP_CLIP_PATH = `polygon(
  0% 100%,
  3% 80%,
  7% 65%,
  11% 58%,
  15% 62%,
  18% 52%,
  22% 48%,
  25% 50%,
  29% 42%,
  33% 38%,
  37% 40%,
  41% 34%,
  45% 31%,
  55% 31%,
  59% 34%,
  63% 40%,
  67% 38%,
  71% 42%,
  75% 50%,
  78% 48%,
  82% 52%,
  85% 62%,
  89% 58%,
  93% 65%,
  97% 80%,
  100% 100%
)`;

const HorizonDore: FC = () => {
  return (
    <div className="horizon-container" style={{ height: '28vh' }}>
      <style>{`
        /* Hide the central hooded figure from HistoricalFigures when Doré pair is shown */
        .background .figure-1 {
          display: none;
        }
        .dore-pair {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 4;
          pointer-events: none;
          overflow: visible;
        }
        .dore-pair-inner {
          position: absolute;
          left: 50%;
          bottom: 14.5vh;
          width: 24vh;
          height: 25vh;
          transform: translateX(-50%) scale(0.22);
          transform-origin: bottom center;
          display: flex;
          align-items: flex-end;
          gap: 0;
          pointer-events: none;
        }
        .dore-pair-inner .figure-image:last-child {
          margin-left: -4vh;
        }
        .dore-pair-inner .figure-image {
          flex: 0 0 14vh;
          height: 100%;
          display: block;
          filter: drop-shadow(0 0 8px color-mix(in srgb, var(--gold-subtle) 20%, transparent))
                  drop-shadow(0 0 4px color-mix(in srgb, var(--gold-subtle) 10%, transparent));
        }
        /* object-fit on <img>, not wrapper div (2025 best practice) */
        .dore-pair-inner .figure-image img {
          object-fit: contain;
          object-position: bottom center;
        }
        .dore-outcrop {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 25%;
          height: 24vh;
          background: linear-gradient(180deg,
            rgba(8, 12, 35, 0) 0%,
            rgba(8, 12, 35, 0.6) 30%,
            rgba(6, 8, 25, 0.95) 100%
          );
          z-index: 2;
        }
        /* Mobile: shorter mountains, proportionally adjusted */
        @media (max-width: 767px) {
          .dore-outcrop {
            width: 50%;
            height: 14dvh;
          }
          .dore-pair-inner {
            bottom: 9dvh;
            height: 18dvh;
            transform: translateX(-50%) scale(0.26);
          }
        }
      `}</style>

      <div className="horizon-glow"></div>
      <div className="mountains">
        <div className="mountain-layer-3"></div>
        <div className="mountain-layer-2"></div>
        <div className="mountain-layer-1"></div>

        <div
          className="dore-outcrop"
          style={{
            height: '24vh',
            clipPath: OUTCROP_CLIP_PATH,
          }}
        ></div>

        <div className="mountain-highlight"></div>
      </div>

      <div className="dore-pair">
        <div
          className="dore-pair-inner"
          style={{
            bottom: '14.5vh',
            height: '25vh',
            transform: 'translateX(-50%) scale(0.22)',
          }}
        >
          {/* The peak twins render at ~32px wide (scale 0.22). A ~70px sizes
              cap makes the browser fetch the 240w variant (~18-25KB) instead
              of the 1440w (~270-400KB) the generic full-width default selected. */}
          <OptimizedImage
            name="figure"
            height="calc(25vh)"
            alt=""
            className="figure-image"
            sizes="(max-width: 640px) 60px, 70px"
          />
          <OptimizedImage
            name="figure_2"
            height="calc(25vh)"
            alt=""
            className="figure-image"
            sizes="(max-width: 640px) 60px, 70px"
          />
        </div>
      </div>
    </div>
  );
};

export default HorizonDore;
