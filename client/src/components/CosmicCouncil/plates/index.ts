/**
 * Plate registry for the council wall.
 *
 * Theme modules live beside this file as `<theme-id>.ts` and are collected by
 * a build-time glob, so a theme lands by dropping its file in. Nothing here
 * names a module: an absent theme is simply not in the glob result, and every
 * council without a plate keeps rendering its existing SVG artwork.
 *
 * A module may name its map anything as long as the values carry the shape
 * below, which keeps the contract to one line: id -> { square, wide, focal }.
 */

export interface CouncilPlate {
  square: string;
  wide: string;
  /** mask-position for the cover crop, holds the subject when the frame ratio shifts */
  focal: string;
}

const isPlate = (value: unknown): value is CouncilPlate => {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.square === 'string' && typeof p.wide === 'string' && typeof p.focal === 'string';
};

const modules = import.meta.glob(['./*.ts', '!./index.ts'], { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

const registry: Record<string, CouncilPlate> = {};

for (const mod of Object.values(modules)) {
  for (const exported of Object.values(mod ?? {})) {
    if (!exported || typeof exported !== 'object') continue;
    for (const [id, plate] of Object.entries(exported as Record<string, unknown>)) {
      if (isPlate(plate)) registry[id] = plate;
    }
  }
}

export const COUNCIL_PLATES: Record<string, CouncilPlate> = registry;

export const getCouncilPlate = (id: string): CouncilPlate | undefined => registry[id];
