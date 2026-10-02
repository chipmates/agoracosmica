/**
 * RoseFilmGround — the two who stand before the rose (after Doré's plate for
 * Paradiso XXXI). He is there from the first frame, a dark figure looking up.
 * She arrives as a light and stays as a figure of light: the film draws her
 * out of many small lights (cosmos/rose-film/guide.ts), and this drawing only
 * lays a soft glow behind them. The ridge they stand on is drawn by the film itself.
 */
import { FC } from 'react';
import { GUIDE_OUTLINE } from '../../../cosmos/rose-film/guide';

// Feet at the origin, heads near y = -90. He is seen from behind, in a short
// cape over a long robe, his head back to look up at the rose.
const DANTE_BODY =
  'M-11.6,0.4 C-10.6,-10 -9.2,-24 -8.4,-36 C-8.2,-41 -8.4,-45 -8.8,-47.4 L-10.6,-48.4 ' +
  'C-11.2,-55 -10.6,-62 -9,-67 C-8,-70 -6.4,-72 -4.4,-73 L-2.2,-74.2 L-2,-77.2 L3.4,-77 L3.8,-74 ' +
  'C6.6,-73 8.6,-70.6 9.6,-67 C11,-62 11.6,-55 11.2,-48.6 L9.2,-47.6 C9,-44 9.2,-40 9.6,-36 ' +
  'C10.4,-24 11.6,-10 12.4,0.2 C8.4,1.2 4.4,-0.2 0.4,0.8 C-3.6,1.4 -7.8,0.2 -11.6,0.4 Z';
// His profile, lifted: brow, nose and chin towards the rose.
const DANTE_HEAD =
  'M-2.2,-76.6 C-5.2,-78.6 -6.2,-83 -4.6,-86.6 C-3,-90.2 1.4,-91.6 4.6,-89.8 C6.2,-88.9 7.2,-87.6 7.6,-86.4 ' +
  'L9.9,-86.9 L8.7,-84.9 C9,-84.2 8.8,-83.4 8.2,-83 C8.4,-82 7.8,-81 6.8,-80.6 C5.6,-79 4.4,-77.8 3.6,-76.8 Z';
// The cap's cloth covers his nape and lies on his shoulders, close to the head.
const DANTE_FLAP = 'M-4,-87 C-6.2,-85 -6.8,-81 -6.6,-78 C-6.6,-76 -7.2,-74 -8.4,-72 C-6,-72.8 -3.8,-73.6 -2,-74 L-1.4,-78 Z';
// The head is a little smaller than drawn: it turns about the neck.
const DANTE_HEAD_FIT = 'translate(0.7 -77) scale(0.88) translate(-0.7 77)';

const RoseFilmGround: FC = () => (
  <div className="rose-film-ground">
    <svg viewBox="0 0 120 116" focusable="false">
      <defs>
        {/* The rose's light comes from above and to the right. */}
        <linearGradient id="rfg-fall" gradientUnits="userSpaceOnUse" x1="12" y1="-92" x2="-6" y2="-6">
          <stop offset="0" className="rfg-fall-near" />
          <stop offset="0.5" className="rfg-fall-mid" />
          <stop offset="1" className="rfg-fall-far" />
        </linearGradient>
        {/* Her light reaches him from the side. */}
        <linearGradient id="rfg-side" gradientUnits="userSpaceOnUse" x1="18" y1="-60" x2="-6" y2="-60">
          <stop offset="0" className="rfg-side-near" />
          <stop offset="1" className="rfg-side-far" />
        </linearGradient>
        <linearGradient id="rfg-light" gradientUnits="userSpaceOnUse" x1="0" y1="-92" x2="0" y2="-6">
          <stop offset="0" className="rfg-light-top" />
          <stop offset="0.5" className="rfg-light-mid" />
          <stop offset="1" className="rfg-light-foot" />
        </linearGradient>
        <radialGradient id="rfg-halo" gradientUnits="userSpaceOnUse" cx="1" cy="-79.6" r="12">
          <stop offset="0" className="rfg-halo-near" />
          <stop offset="1" className="rfg-halo-far" />
        </radialGradient>
        <radialGradient id="rfg-pool" gradientUnits="objectBoundingBox" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" className="rfg-pool-near" />
          <stop offset="1" className="rfg-pool-far" />
        </radialGradient>
        <g id="rfg-dante-shape">
          <path d={DANTE_BODY} />
          <path d={DANTE_FLAP} transform={DANTE_HEAD_FIT} />
          <path d={DANTE_HEAD} transform={DANTE_HEAD_FIT} />
        </g>
        <clipPath id="rfg-dante">
          <path d={DANTE_BODY} />
          <path d={DANTE_FLAP} transform={DANTE_HEAD_FIT} />
          <path d={DANTE_HEAD} transform={DANTE_HEAD_FIT} />
        </clipPath>
        <clipPath id="rfg-beatrice">
          {GUIDE_OUTLINE.map((d) => (
            <path key={d} d={d} />
          ))}
        </clipPath>
        <filter id="rfg-soft" x="-20%" y="-10%" width="140%" height="120%">
          <feGaussianBlur stdDeviation="0.3" />
        </filter>
        <filter id="rfg-turn" x="-30%" y="-20%" width="160%" height="140%">
          <feGaussianBlur stdDeviation="0.45" />
        </filter>
        {/* Light only where his form turns towards it: the shape less its own shadow. */}
        <mask id="rfg-from-rose" maskUnits="userSpaceOnUse" x="-30" y="-100" width="70" height="110">
          <use href="#rfg-dante-shape" className="rfg-mask-on" />
          <use href="#rfg-dante-shape" className="rfg-mask-off" transform="translate(-0.8 0.7)" filter="url(#rfg-turn)" />
        </mask>
        <mask id="rfg-from-her" maskUnits="userSpaceOnUse" x="-30" y="-100" width="70" height="110">
          <use href="#rfg-dante-shape" className="rfg-mask-on" />
          <use href="#rfg-dante-shape" className="rfg-mask-off" transform="translate(-1.2 0.1)" filter="url(#rfg-turn)" />
        </mask>
        <filter id="rfg-glow" x="-150%" y="-40%" width="400%" height="180%">
          <feGaussianBlur stdDeviation="4.6" result="wide" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.3" result="near" />
          <feMerge>
            <feMergeNode in="wide" />
            <feMergeNode in="near" />
          </feMerge>
        </filter>
      </defs>

      {/* Her light lies on the ground around her feet. */}
      <ellipse className="rfg-her" cx="78" cy="113" rx="28" ry="3.2" fill="url(#rfg-pool)" />

      <g className="rfg-him" transform="translate(42 113)">
        <use href="#rfg-dante-shape" className="rfg-dark" filter="url(#rfg-soft)" />
        <g clipPath="url(#rfg-dante)">
          <rect x="-30" y="-100" width="70" height="110" fill="url(#rfg-fall)" mask="url(#rfg-from-rose)" className="rfg-lit" />
          <rect x="-30" y="-100" width="70" height="110" fill="url(#rfg-side)" mask="url(#rfg-from-her)" className="rfg-her" />
        </g>
      </g>

      <g className="rfg-her" transform="translate(78 112)">
        <circle cx="1" cy="-79.6" r="12" fill="url(#rfg-halo)" />
        <g filter="url(#rfg-glow)" className="rfg-her-body">
          <g clipPath="url(#rfg-beatrice)">
            <rect x="-20" y="-94" width="46" height="98" fill="url(#rfg-light)" />
          </g>
        </g>
      </g>
    </svg>
  </div>
);

export default RoseFilmGround;
