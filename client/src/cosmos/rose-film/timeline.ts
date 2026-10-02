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
 * The ground, in shares of the frame: the height of the rock where the two
 * stand, where they stand across the frame, and how tall they are.
 */
export const GROUND = {
  landscape: { top: 0.118, standX: 0.5, figure: 0.165 },
  portrait: { top: 0.104, standX: 0.5, figure: 0.132 },
} as const;

/** The foreground drawing's box is 120 wide and 116 high. In it, he stands at 49 and she at 70. */
export const FIGURE_BOX = { aspect: 120 / 116, danteX: 49 / 120, beatriceX: 70 / 120, chestY: 0.54 } as const;

/** The round of light: its radius in the picture's own measure. It stays as the rose's great ring. */
export const RING_RADIUS = 1.15;

/**
 * The rose, seen from where the two stand (after Doré's plate for Paradiso
 * XXXI): a sun at its heart, tiers of the blessed inside the round, a wreath
 * of wings outside it. Radii in the picture's own measure.
 */
export const ROSE = {
  /** The tiers inside the round, from the sun outwards. Each is wider than the one before. */
  tiers: [0.2, 0.26, 0.335, 0.43, 0.55, 0.7, 0.89],
  /** The loose rows of the wreath outside the round. */
  wreath: [1.4, 1.66],
  /** Where the thirty take their seats: a crown just outside the round. */
  seat: 1.285,
  /** Past this radius the rose has given way to the night. */
  rim: 1.9,
} as const;

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
  body: number;
  rot: number;
  starRot: number;
  zoom: number;
  halfShort: number;
  centerY: number;
  heart: number;
  point: number;
  /** 0..1: the sun at the heart of the rose, and how far its rays reach. */
  sun: number;
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
  card3: [5.7, 8.3],
  card4: [8.9, 11.4],
  verse: [12.0, 17.7],
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
const omega = (t: number) => 0.09 + 0.17 * smooth(2.4, 6.0, t) - 0.2 * smooth(6.8, 11.5, t);
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

const MORPH_START = 6.3;
const MORPH_END = 9.8;

export function filmState(t: number, layout: FilmLayout): FilmState {
  const p = layout.portrait;
  const bend = smoother(2.6, 6.4, t);
  // The rose comes forward as it forms, until it fills the frame above the two.
  const approach = smooth(7.2, 12.2, t);
  const tableau = smoother(8.2, 12.0, t);
  const zoomOpen = p ? 1.31 : 2.77;
  const zoomTableau = p ? 1.12 : 1.52;
  return {
    fade: smooth(0, 0.35, t),
    bend,
    lift: (1 - bend) * 0.5,
    riverRot: p ? -1.0 : -0.3,
    width: mix(0.21, 0.125, bend),
    ringness: smooth(5.2, 6.8, t),
    morph: lin(MORPH_START, MORPH_END, t),
    // The tiers fill on this clock: from the round inwards, then the wreath outside it.
    bloom: Math.min(1.3, Math.max(0, (t - MORPH_START) / (MORPH_END - MORPH_START))),
    body: smooth(6.2, 7.8, t),
    rot: lookup(ROT_TABLE, t),
    starRot: lookup(STAR_TABLE, t),
    zoom: mix(mix(zoomOpen, 1, smoother(2.2, 6.8, t)), zoomTableau, approach),
    // The ring takes the same share of the frame's height on a phone and on a tablet held upright.
    halfShort: p ? Math.max(1.7, 3.13 * layout.aspect) : 3.8,
    // The round stands high above the seeker, then the rose settles around the frame's middle.
    centerY: p ? mix(0.24, -0.005, tableau) : mix(0.32, -0.105, tableau),
    centerX: 0,
    heart: 0.1 + 0.5 * smooth(6, 7.6, t) + 0.4 * smooth(7.6, 11.5, t),
    // The first point of light stands until the sun takes its place.
    point: 1 - smooth(8.6, 9.8, t),
    sun: smooth(8.6, 10.9, t),
    rays: (p ? 0.22 : 0.3) * smooth(8.5, 12.5, t),
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

// The thirty: each light kindles on the horizon, waits, then rises to its seat.
export const KINDLE_START = 5.4;
const KINDLE_SPREAD = 1.2;
const RISE_START = 8.8;
const RISE_STAGGER = 1.6;
export const RISE_TRAVEL = 2.0;
// One more light comes down from the rose to stand beside the seeker.
export const MEET_START = 10.8;
export const MEET_TRAVEL = 1.9;

export interface SeatParams {
  /** Its seat on the crown around the round: the angle and the radius, before the rose's turning. */
  angle: number;
  radius: number;
  seed: number;
  /** Film seconds: when its light kindles on the horizon, and when it leaves for the rose. */
  kindle: number;
  lift: number;
  /** Where it waits, across the frame (0..1). */
  startX: number;
}

/** A seat's place in the picture's world at time t: the crown turns with the rose. */
export function seatWorld(seat: Pick<SeatParams, 'angle' | 'radius'>, t: number): [number, number] {
  const a = seat.angle - lookup(ROT_TABLE, t);
  return [seat.radius * Math.cos(a), seat.radius * Math.sin(a)];
}

/**
 * Where the thirty sit and when each sets out. They go in the order given
 * (the earliest life first) and take their seats all around the crown. Each
 * starts below its own seat, so the rising lines fan out and do not cross.
 */
export const SEATS: readonly SeatParams[] = (() => {
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const seats = Array.from({ length: SEAT_COUNT }, (_, i) => {
    const rank = i / (SEAT_COUNT - 1);
    return {
      angle: (i * GOLDEN) % (2 * Math.PI),
      radius: ROSE.seat + 0.035 * ((i % 3) - 1),
      seed: (i * 0.6180339887) % 1,
      kindle: KINDLE_START + rank * KINDLE_SPREAD,
      lift: RISE_START + rank * RISE_STAGGER,
      startX: 0,
    };
  });
  seats
    .map((seat, i) => ({ i, x: seatWorld(seat, seat.lift + RISE_TRAVEL)[0] }))
    .sort((a, b) => a.x - b.x)
    .forEach(({ i }, slot) => {
      seats[i].startX = 0.05 + (0.9 * (slot + 0.5)) / SEAT_COUNT;
    });
  return seats;
})();

export function seatParams(i: number): SeatParams {
  return SEATS[i];
}
