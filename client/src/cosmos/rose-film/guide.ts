/**
 * cosmos/rose-film/guide — the figure of light that stands beside the seeker.
 *
 * She is not drawn: her body is a fine grain of light, with brighter lights
 * in it, inside a standing figure with one arm raised to the rose.
 * Coordinates are those of the foreground drawing (feet at the origin, y up
 * is negative).
 */

type Point = [number, number];

function ellipse(cx: number, cy: number, rx: number, ry: number, n = 16): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

// A limb: a line with its half width at every point.
function limb(line: Point[], half: number[]): Point[] {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    left.push([line[i][0] - (dy / l) * half[i], line[i][1] + (dx / l) * half[i]]);
    right.push([line[i][0] + (dy / l) * half[i], line[i][1] - (dx / l) * half[i]]);
  }
  return [...left, ...right.reverse()];
}

const WAIST = -58;
const HEM = -1;

// Her outline, part by part, with how bright each part is.
const PARTS: { shape: Point[]; weight: number }[] = [
  { shape: ellipse(1, -79.6, 2.9, 3.7), weight: 1 },
  // Her hair, gathered at the nape.
  { shape: [[-1.6, -82.2], [-2.9, -79], [-3.1, -75], [-2.2, -72.2], [0.4, -72.4], [0.2, -76.5]], weight: 0.7 },
  { shape: [[-0.5, -76.4], [2.2, -76.4], [2.6, -72.2], [-1.2, -72.2]], weight: 0.8 },
  { shape: [[-5, -71], [-2, -72.6], [3.2, -72.8], [5.6, -71.2], [4.6, -64], [3.6, WAIST], [-3.2, WAIST], [-4.4, -64]], weight: 0.9 },
  { shape: [[-3.2, WAIST], [3.6, WAIST], [4.8, -44], [6.6, -26], [8.4, -10], [9.4, HEM], [-11.6, HEM], [-9.2, -10], [-6.6, -26], [-4.6, -44]], weight: 0 },
  // One arm raised to the rose, the other at her side.
  { shape: limb([[4.6, -70.6], [10.4, -76], [14.6, -85.4], [16.2, -90.2]], [1.5, 1.25, 0.8, 0.5]), weight: 0.85 },
  { shape: limb([[-4.6, -70.4], [-6, -62], [-5.4, -53.5]], [1.4, 1.1, 0.7]), weight: 0.75 },
];

/** Her outline as closed paths, for the soft glow drawn behind her lights. */
export const GUIDE_OUTLINE: string[] = PARTS.map(
  ({ shape }) => `M${shape.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L')} Z`
);

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
 * light is at the head and the heart, least at the hem: she has no hem.
 */
export function guideLights(count: number, rnd: () => number): Float32Array {
  const out = new Float32Array(count * 4);
  let k = 0;
  let tries = 0;
  while (k < count && tries++ < count * 400) {
    const x = -13 + 31 * rnd();
    const y = -92 + 92 * rnd();
    let weight = -1;
    for (const part of PARTS) {
      if (inPolygon(x, y, part.shape)) weight = Math.max(weight, part.weight);
    }
    if (weight < 0) {
      // A few loose lights drift just outside her, mostly about her head and hand.
      if (rnd() > 0.006 * Math.max(0, (y - HEM) / -90)) continue;
      weight = 0.25;
    } else if (weight === 0) {
      // The gown stays whole and only dissolves just above the ground.
      const high = (y - HEM) / (WAIST - HEM);
      if (rnd() > 0.3 + 0.7 * Math.min(1, high / 0.3)) continue;
      weight = 0.4 + 0.45 * high;
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
