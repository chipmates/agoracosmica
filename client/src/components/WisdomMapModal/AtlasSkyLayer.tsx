// AtlasSkyLayer.tsx - React bridge to the Celestial Atlas living sky.
//
// PRESENTATIONAL ONLY: two Canvas 2D layers (deep parallax field behind the
// engraved plate, gold fx above it) plus the hush overlay. The engine loads
// via dynamic import() so the eager bundle carries nothing.
//
// Lifecycle: init on mount (modal open), full disposal on unmount (modal
// close). The render loop pauses when the map container is marked
// data-visibility="hidden" (set by WisdomMapModal on document.hidden).
// Any init failure calls onFallback so the modal swaps back to the flat map.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { TIER_BUDGETS } from '../../cosmos/tiers';
import type { SkyScene, AtlasSky } from '../../cosmos/wisdom-sky/types';

export interface AtlasSkyLayerHandle {
  /** Bloom illumination on one seed star (flourish, gathering gold dust, hush). */
  nova(seedId: string): void;
  /** The engraver finishes the plate (figure completion). */
  ignite(): void;
}

interface AtlasSkyLayerProps {
  tier: 'desktop' | 'mobile';
  scene: SkyScene | null;
  /** The world layer the engine moves during glides and drag-to-peek. */
  worldRef: React.RefObject<HTMLDivElement>;
  /** First frame rendered: the modal crossfades the sky in. */
  onReady: () => void;
  /** Init failed: the modal falls back to the flat map. */
  onFallback: () => void;
}

const AtlasSkyLayer = forwardRef<AtlasSkyLayerHandle, AtlasSkyLayerProps>(
  ({ tier, scene, worldRef, onReady, onFallback }, ref) => {
    const fieldRef = useRef<HTMLCanvasElement>(null);
    const fxRef = useRef<HTMLCanvasElement>(null);
    const hushRef = useRef<HTMLDivElement>(null);
    const skyRef = useRef<AtlasSky | null>(null);
    const sceneRef = useRef<SkyScene | null>(scene);
    const [ready, setReady] = useState(false);

    // Keep latest callbacks without re-initializing the scene
    const onReadyRef = useRef(onReady);
    const onFallbackRef = useRef(onFallback);
    onReadyRef.current = onReady;
    onFallbackRef.current = onFallback;
    sceneRef.current = scene;

    // Init + dispose: one engine lifecycle per modal open
    useEffect(() => {
      let cancelled = false;

      import('../../cosmos/wisdom-sky/createAtlasSky')
        .then(({ createAtlasSky }) => {
          const field = fieldRef.current;
          const fxCanvas = fxRef.current;
          const hush = hushRef.current;
          const world = worldRef.current;
          const container = field?.closest('.map-container') as HTMLElement | null;
          if (cancelled || !field || !fxCanvas || !hush || !world || !container) {
            if (!cancelled) onFallbackRef.current();
            return;
          }
          try {
            const budget = TIER_BUDGETS[tier];
            const sky = createAtlasSky(field, fxCanvas, {
              starBudget: budget.stars,
              dprCap: budget.dprCap,
              worldEl: world,
              hushEl: hush,
              dragSurface: container,
              onFirstFrame: () => {
                setReady(true);
                onReadyRef.current();
              },
            });
            skyRef.current = sky;
            // Apply the freshest scene snapshot that arrived while loading
            if (sceneRef.current) sky.setScene(sceneRef.current);
            // Respect an already-hidden tab or container at init time
            const hiddenNow =
              document.hidden ||
              container.getAttribute('data-visibility') === 'hidden';
            if (hiddenNow) sky.setPaused(true);
          } catch {
            onFallbackRef.current();
          }
        })
        .catch(() => {
          if (!cancelled) onFallbackRef.current();
        });

      return () => {
        cancelled = true;
        skyRef.current?.dispose();
        skyRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Push declarative scene snapshots into the sky
    useEffect(() => {
      if (scene && skyRef.current) {
        skyRef.current.setScene(scene);
      }
    }, [scene]);

    // Pause the render loop with the map container's data-visibility attribute
    // (WisdomMapModal already flips it on document.hidden)
    useEffect(() => {
      const canvas = fieldRef.current;
      if (!canvas) return;
      const container = canvas.closest('.map-container');
      if (!container) return;

      const applyVisibility = (): void => {
        const hidden =
          container.getAttribute('data-visibility') === 'hidden' || document.hidden;
        skyRef.current?.setPaused(hidden);
      };

      const observer = new MutationObserver(applyVisibility);
      observer.observe(container, {
        attributes: true,
        attributeFilter: ['data-visibility'],
      });
      document.addEventListener('visibilitychange', applyVisibility);
      applyVisibility();

      return () => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', applyVisibility);
      };
    }, []);

    useImperativeHandle(ref, () => ({
      nova: (seedId: string) => skyRef.current?.nova(seedId),
      ignite: () => skyRef.current?.ignite(),
    }));

    return (
      <>
        <canvas
          ref={fieldRef}
          className={`atlas-field ${ready ? 'ready' : ''}`}
          aria-hidden="true"
        />
        <canvas ref={fxRef} className="atlas-fx" aria-hidden="true" />
        <div ref={hushRef} className="atlas-hush" aria-hidden="true" />
      </>
    );
  }
);

AtlasSkyLayer.displayName = 'AtlasSkyLayer';

export default AtlasSkyLayer;
