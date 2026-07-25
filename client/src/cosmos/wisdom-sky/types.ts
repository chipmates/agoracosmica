/**
 * cosmos/wisdom-sky/types — the contract between the Wisdom Map's React layer
 * and the Celestial Atlas sky (Canvas 2D deep field + fx, "B's ink on A's sky").
 *
 * This file is imported EAGERLY (by AtlasSkyLayer inside the modal), so it
 * must never import anything heavy. The scene code lives in createAtlasSky.ts
 * behind a dynamic import().
 */

export type SkyRevelationStage =
  | 'void'
  | 'awakening'
  | 'emergence'
  | 'forming'
  | 'complete';

/** One wisdom seed, projected into the sky. Coordinates are container percent. */
export interface SkyStar {
  id: string;
  xPct: number;
  yPct: number;
  gathered: boolean;
  /** Prismatic bloom level 0-4. */
  level: number;
  /** The suggested "start here" seed. */
  isNext: boolean;
}

/** One constellation line segment in container pixel coordinates. */
export interface SkySegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** True when both endpoints are gathered stars: the segment carries gold ink. */
  lit: boolean;
}

/** Full declarative snapshot of what the sky should show. */
export interface SkyScene {
  /** Stable key per figure; a change triggers the camera glide. */
  figureKey: string;
  width: number;
  height: number;
  stars: SkyStar[];
  segments: SkySegment[];
  stage: SkyRevelationStage;
}

export interface AtlasSkyOptions {
  /** Background starfield point budget (from TIER_BUDGETS). */
  starBudget: number;
  /** Device pixel ratio cap (from TIER_BUDGETS). */
  dprCap: number;
  /**
   * The world layer (plate linework + DOM stars). The engine drives its
   * transform during glides and drag-to-peek so ink and sky move as one.
   */
  worldEl: HTMLElement;
  /** Edge-dimming hush overlay; the engine drives its opacity. */
  hushEl: HTMLElement;
  /** Pointer surface for drag-to-peek (the map container). */
  dragSurface: HTMLElement;
  /** First rendered frame: the React layer crossfades the canvas in. */
  onFirstFrame?: () => void;
}

/** Imperative handle returned by createAtlasSky. */
export interface AtlasSky {
  /** Push a new declarative snapshot. A figureKey change glides the camera. */
  setScene(scene: SkyScene): void;
  /** Resize the renderer to the container. */
  setSize(width: number, height: number): void;
  /** Bloom illumination on one star: flourish ring, gathered gold dust, hush. */
  nova(seedId: string): void;
  /** Figure completion: links re-ink gold, one gilding light pass, lasting glow. */
  ignite(): void;
  /** Pause or resume the render loop (hidden tab, hidden container). */
  setPaused(paused: boolean): void;
  /** Full teardown: loop, listeners, canvases. */
  dispose(): void;
}
