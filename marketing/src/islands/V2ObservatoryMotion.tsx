// Motion controller island for the landing-lab v2 "Observatory" hero.
//
// The hero paints fully static from server HTML: the gold core, the three
// concentric rings, and every figure "planet" sit at their resting positions
// with no JS. This island only ENHANCES, and only after idle, so it never
// blocks LCP:
//   1. flips on the orbit keyframes (the CSS keeps them off until .is-live)
//   2. parks the loop when the tab is hidden (battery + main-thread courtesy)
//   3. adds a tiny rAF-throttled pointer-parallax plane on desktop only
//
// Every motion path bails out under prefers-reduced-motion: reduce, so those
// users keep the static arrangement that the server already painted. There is
// no visual element here, it returns null and works purely through the DOM
// node it is mounted beside.

import { useEffect } from 'react';

interface Props {
  /** id of the .v2-observatory root this controller drives */
  targetId: string;
}

export default function V2ObservatoryMotion({ targetId }: Props) {
  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;

    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

    let parallaxRaf = 0;
    let pendingX = 0;
    let pendingY = 0;

    const applyParallax = () => {
      parallaxRaf = 0;
      root.style.setProperty('--v2-px', pendingX.toFixed(3));
      root.style.setProperty('--v2-py', pendingY.toFixed(3));
    };

    const onPointerMove = (event: PointerEvent) => {
      // map cursor to a -1..1 range around the hero center
      const rect = root.getBoundingClientRect();
      pendingX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pendingY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!parallaxRaf) parallaxRaf = requestAnimationFrame(applyParallax);
    };

    const onVisibility = () => {
      // pause the whole orbital system while the tab is in the background
      root.classList.toggle('is-hidden', document.hidden);
    };

    const enableMotion = () => {
      if (reduceQuery.matches) {
        root.classList.remove('is-live');
        root.style.removeProperty('--v2-px');
        root.style.removeProperty('--v2-py');
        return;
      }
      root.classList.add('is-live');
      document.addEventListener('visibilitychange', onVisibility);
      if (hoverQuery.matches) {
        root.addEventListener('pointermove', onPointerMove, { passive: true });
      }
    };

    const teardownMotion = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      root.removeEventListener('pointermove', onPointerMove);
      if (parallaxRaf) cancelAnimationFrame(parallaxRaf);
      parallaxRaf = 0;
    };

    enableMotion();

    // react live if the user toggles their reduced-motion preference
    const onReduceChange = () => {
      teardownMotion();
      enableMotion();
    };
    reduceQuery.addEventListener('change', onReduceChange);

    return () => {
      reduceQuery.removeEventListener('change', onReduceChange);
      teardownMotion();
      root.classList.remove('is-live', 'is-hidden');
    };
  }, [targetId]);

  return null;
}
