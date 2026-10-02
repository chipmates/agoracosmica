/**
 * cosmos/rose-film/timeline — what the entry film shows at each second.
 *
 * The river of light flows, its length becomes round, the round opens as
 * the rose (Paradiso XXX 61-90). Every value here is a pure function of
 * film time, so the picture and the words can never drift apart.
 */

export const FILM_DURATION = 18;
export const SEAT_COUNT = 30;

/**
 * The ground, in shares of the frame: the height of the ridge where the two
 * stand, where they stand across the frame, and how tall they are.
 */
export const GROUND = {
  landscape: { top: 0.118, standX: 0.47, figure: 0.215 },
  portrait: { top: 0.104, standX: 0.47, figure: 0.182 },
} as const;

/** The foreground drawing's box is 120 wide and 116 high. In it, he stands at 42 and she at 78. */
export const FIGURE_BOX = { aspect: 120 / 116, danteX: 42 / 120, beatriceX: 78 / 120, chestY: 0.54 } as const;

/** The round of light before it opens: its radius in the picture's own measure. */
export const RING_RADIUS = 1.15;

export interface FilmLayout {
  aspect: number;
  portrait: boolean;
}

export interface FilmState {
  fade: number;
  bend: number;
  lift: number;
  riverRot: number;
  width: number;
  ringness: number;
  morph: number;
  bloom: number;
  tilt: number;
  body: number;
  rot: number;
  starRot: number;
  zoom: number;
  halfShort: number;
  centerY: number;
  bees: number;
  heart: number;
  heartSize: number;
  point: number;
  rays: number;
  flash: number;
  trail: number;
  centerX: number;
  groundTop: number;
  standX: number;
  /** 0..1: the light that comes down to stand beside him. */
  meet: number;
  /** 0..1: Beatrice, formed where that light lands. */
  beatrice: number;
  pour: number;
  shear: number;
  /** 0..1: how fast the body of light moves (it decides how finely a frame's time is drawn). */
  motion: number;
  /** Size of the grains of light: finer while they draw lines. */
  grain: number;
}

/** When each line of words is on screen, in film seconds. */
export const CUES = {
  card1: [0.8, 2.8],
  card2: [3.4, 5.1],
  card3: [5.7, 9.0],
  card4: [9.6, 12.0],
  verse: [12.6, 17.7],
} as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lin = (a: number, b: number, x: number) => clamp01((x - a) / (b - a));
const smooth = (a: number, b: number, x: number) => {
  const t = lin(a, b, x);
  return t * t * (3 - 2 * t);
};
const smoother = (a: number, b: number, x: number) => {
  const t = lin(a, b, x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// The turning: slow while the river flows, quick as it closes, calm in the rose.
const omega = (t: number) => 0.09 + 0.17 * smooth(2.4, 6.0, t) - 0.19 * smooth(6.8, 11.5, t);
const ROT_STEP = 1 / 60;
const ROT_TABLE = (() => {
  const n = Math.ceil((FILM_DURATION + 1) / ROT_STEP) + 1;
  const table = new Float32Array(n);
  for (let i = 1; i < n; i++) table[i] = table[i - 1] + omega((i - 0.5) * ROT_STEP) * ROT_STEP;
  return table;
})();
// The far sky turns a little with the river and stands still before the rose forms.
const STAR_TABLE = (() => {
  const table = new Float32Array(ROT_TABLE.length);
  for (let i = 1; i < table.length; i++) {
    const x = (i - 0.5) * ROT_STEP;
    table[i] = table[i - 1] + 0.35 * omega(x) * (1 - smooth(4, 7, x)) * ROT_STEP;
  }
  return table;
})();
function lookup(table: Float32Array, t: number): number {
  const x = Math.max(0, Math.min(FILM_DURATION + 1, t)) / ROT_STEP;
  const i = Math.floor(x);
  const f = x - i;
  return mix(table[i], table[Math.min(table.length - 1, i + 1)], f);
}

export function filmState(t: number, layout: FilmLayout): FilmState {
  const p = layout.portrait;
  const bend = smoother(2.6, 6.4, t);
  // The rose comes forward as it forms, and takes its place above the two
  // once the names below it have gone.
  const approach = smooth(8.6, 12.9, t);
  const tableau = smoother(10.8, 13.3, t);
  const rot = lookup(ROT_TABLE, t);
  const zoomOpen = p ? 1.31 : 2.77;
  const zoomTableau = p ? 1.74 : 2.3;
  return {
    fade: smooth(0, 0.35, t),
    bend,
    lift: (1 - bend) * 0.5,
    riverRot: p ? -1.0 : -0.3,
    width: mix(0.21, 0.125, bend),
    ringness: smooth(5.2, 6.8, t),
    morph: lin(MORPH_START, MORPH_END, t),
    // The petals open on the same clock, a little behind their light.
    bloom: Math.min(1.3, Math.max(0, (t - MORPH_START) / (MORPH_END - MORPH_START))),
    tilt: tiltAt(t),
    body: smooth(6.6, 8.4, t),
    rot,
    starRot: lookup(STAR_TABLE, t),
    zoom: mix(mix(zoomOpen, 1, smoother(2.2, 6.8, t)), zoomTableau, approach),
    // The ring takes the same share of the frame's height on a phone and on a tablet held upright.
    halfShort: p ? Math.max(1.7, 3.13 * layout.aspect) : 3.8,
    // The round stands high, clear of the names above the seeker's head.
    centerY: p ? mix(0.24, 0.09, tableau) : mix(0.32, 0.165, tableau),
    centerX: 0,
    bees: smooth(12.2, 14.2, t),
    heart: 0.1 + 0.5 * smooth(6, 7.6, t) + 0.4 * smooth(7.6, 11.5, t),
    heartSize: mix(0.1, 0.26, smooth(6, 7.8, t)),
    point: 1 - smooth(6.2, 7.8, t),
    rays: (p ? 0.3 : 0.5) * smooth(8.5, 12.5, t),
    flash: smooth(17.1, FILM_DURATION, t),
    // Lines behind moving light: long while the river bends, short as it gathers, gone in the rose.
    trail: mix(mix(mix(0.035, 0.11, smooth(2.6, 4.6, t)), 0.045, smooth(6.2, 7.6, t)), 0.012, smooth(8.2, 9.4, t)),
    groundTop: p ? GROUND.portrait.top : GROUND.landscape.top,
    standX: p ? GROUND.portrait.standX : GROUND.landscape.standX,
    meet: lin(MEET_START, MEET_START + MEET_TRAVEL, t),
    beatrice: smooth(MEET_START + MEET_TRAVEL - 0.35, MEET_START + MEET_TRAVEL + 1.1, t),
    pour: mix(p ? -0.5 : -0.74, 1.4, smooth(-0.3, 2.5, t)),
    shear: -0.05 * Math.pow(Math.max(0, 6.8 - t), 1.3),
    motion: 1 - smooth(9.0, 10.0, t),
    grain: 1 - 0.5 * smooth(3.4, 5.4, t) * (1 - smooth(9.4, 11, t)),
  };
}

const MORPH_START = 6.3;
const MORPH_END = 10.3;
const TILT_MAX = 0.62;
const tiltAt = (t: number) => TILT_MAX * smoother(7.0, 11.8, t);

// The thirty: each light kindles on the horizon with its name, waits, then rises to its seat.
export const KINDLE_START = 5.2;
const KINDLE_SPREAD = 1.2;
const RISE_START = 9.5;
const RISE_STAGGER = 1.5;
export const RISE_TRAVEL = 2.0;
// One more light comes down from the rose to stand beside the seeker.
export const MEET_START = 11.3;
export const MEET_TRAVEL = 1.9;

/** The open rose's surface, as the shaders draw it at full bloom. */
export function rosePoint(theta: number, x1: number): [number, number, number] {
  const tn = (theta + 2 * Math.PI) / (17 * Math.PI);
  const u0 = 1 - (((3.6 * theta) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / Math.PI;
  // No two petals alike: each has its own length, lean and tip (as in the shaders).
  const k = Math.floor((3.6 * theta) / (2 * Math.PI));
  const own = 1 - u0 * u0;
  // The outermost petals are a little shorter, so the rose keeps a round outline.
  const len = mix(1, 0.2, Math.pow(clamp01(tn), 0.6)) * mix(0.72, 1, smooth(0.02, 0.1, tn)) * (1 + 0.17 * Math.sin(k * 2.4 + 0.7) * own);
  const phi = mix(1.02, 0.46, tn) + 0.36 * x1 * x1 * x1 + 0.1 * Math.sin(k * 4.1 + 2.0) * own;
  const u = u0 + 0.14 * Math.sin(k * 3.3 + 1.1) * own;
  const a = 1.25 * u * u - 0.25;
  const X = 1 - 0.5 * a * a;
  const b = 1.27689 * x1 - 1;
  const y = 1.2 * x1 * x1 * b * b * Math.sin(phi);
  const r = len * X * (x1 * Math.sin(phi) + y * Math.cos(phi));
  const z = len * X * (x1 * Math.cos(phi) - y * Math.sin(phi));
  return [r * Math.sin(theta), r * Math.cos(theta), z - 0.3];
}

/** A point of the rose in the picture's world, turned and leaned as at time t. */
export function roseWorld(theta: number, x1: number, t: number): [number, number, number] {
  const [x, y, z] = rosePoint(theta, x1);
  const rot = lookup(ROT_TABLE, t);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const sx = x * c + y * s;
  const sy = -x * s + y * c;
  const tilt = tiltAt(t);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  return [sx, sy * ct + z * st, -sy * st + z * ct];
}

export interface SeatParams {
  theta: number;
  x1: number;
  seed: number;
  /** Film seconds: when its light kindles on the horizon, and when it leaves for the rose. */
  kindle: number;
  lift: number;
  /** Where it waits, across the frame (0..1), before the words' layout places it. */
  startX: number;
}

/**
 * Where the thirty sit on the rose and when each sets out. They go in the
 * order given (the earliest life first) and take the tiers from the heart
 * outwards. Each starts below its own seat, so the rising lines fan out and
 * do not cross.
 */
export const SEATS: readonly SeatParams[] = (() => {
  const x1 = 0.985;
  const seats = Array.from({ length: SEAT_COUNT }, (_, i) => {
    const rank = i / (SEAT_COUNT - 1);
    const lift = RISE_START + rank * RISE_STAGGER;
    return {
      theta: 7.4 * Math.PI - 8.7 * Math.PI * ((i + 0.5) / SEAT_COUNT),
      x1,
      seed: (i * 0.6180339887) % 1,
      kindle: KINDLE_START + rank * KINDLE_SPREAD,
      lift,
      startX: 0,
    };
  });
  const byArrival = seats
    .map((seat, i) => ({ i, x: roseWorld(seat.theta, x1, seat.lift + RISE_TRAVEL)[0] }))
    .sort((a, b) => a.x - b.x);
  byArrival.forEach(({ i }, slot) => {
    seats[i].startX = 0.06 + (0.88 * (slot + 0.5)) / SEAT_COUNT;
  });
  return seats;
})();

/** When the light in a given place of the leaving order sets out (0 leaves first). */
export function riseTime(slot: number): number {
  return RISE_START + (slot / (SEAT_COUNT - 1)) * RISE_STAGGER;
}

export function seatParams(i: number): SeatParams {
  return SEATS[i];
}
