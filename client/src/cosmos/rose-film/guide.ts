/**
 * cosmos/rose-film/guide — the one who comes to stand beside the seeker.
 *
 * She arrives as a light. Where it lands it unfolds into many small lights
 * that fill her shape, and as they dim she stands there, cloaked and veiled,
 * seen from behind like him. Coordinates are those of the foreground drawing
 * (feet at the origin, y up is negative).
 */

type Point = [number, number];

// Her outline, from the hem up her left side, over the veiled head, down her right.
// The veil falls from her head onto her shoulders, so no neck shows.
const OUTLINE: Point[] = [
  [-9.6, 0.4], [-9, -10], [-8.2, -24], [-7.5, -38], [-7.4, -48], [-7.9, -56], [-8.2, -61.5],
  [-7.8, -65.4], [-6.8, -68.4], [-5.6, -70.8], [-5, -73.6], [-4.9, -77], [-4.6, -80.4],
  [-3.4, -83.4], [-1.2, -85.2], [1.2, -85.5], [3.3, -84.2], [4.6, -81.6], [5, -78.2],
  [4.9, -74.6], [5.6, -71.4], [6.9, -68.8], [7.9, -65.6], [8.3, -61.5], [8, -56], [7.5, -48],
  [7.7, -38], [8.5, -24], [9.5, -10], [10.3, 0.2], [6.8, 0.9], [3.4, 0], [0.2, 0.6],
  [-3.1, 1.1], [-6.5, 0.3],
];

const HEM = 0;
const CROWN = -85;

// A closed, rounded curve through the outline's points.
function roundedPath(points: Point[]): string {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n];
  let d = `M${at(0)[0].toFixed(2)},${at(0)[1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

/** Her outline as one closed path, for the foreground drawing. */
export const GUIDE_OUTLINE: string = roundedPath(OUTLINE);

function inPolygon(x: number, y: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Her lights: x, y, seed, weight for each. A positive weight is a light, a
 * negative one a grain of her body; its size says how bright it is. Most
 * light is at the head and the shoulders, least at the hem.
 */
export function guideLights(count: number, rnd: () => number): Float32Array {
  const out = new Float32Array(count * 4);
  let k = 0;
  let tries = 0;
  while (k < count && tries++ < count * 400) {
    const x = -11 + 23 * rnd();
    const y = CROWN - 2 + (HEM - CROWN + 3) * rnd();
    const high = Math.min(1, Math.max(0, (y - HEM) / (CROWN - HEM)));
    let weight: number;
    if (inPolygon(x, y, OUTLINE)) {
      weight = 0.35 + 0.6 * high;
    } else {
      // A few loose lights drift just outside her, mostly about her head.
      if (rnd() > 0.01 * high) continue;
      weight = 0.25;
    }
    const light = rnd() < 0.1;
    out[k * 4] = x;
    out[k * 4 + 1] = y;
    out[k * 4 + 2] = rnd();
    out[k * 4 + 3] = light ? weight * (0.45 + 0.55 * rnd()) : -weight * (0.6 + 0.4 * rnd());
    k++;
  }
  return out;
}
