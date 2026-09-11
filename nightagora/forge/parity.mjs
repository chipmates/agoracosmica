// PARITY — does the stack's frame measure at least as well as the base's?
//
//   node forge/parity.mjs <folder> [--base cut] [--only <frame>] [--crops] [--json]
//
// The stack is infrastructure: its job is to make the art's own light,
// shadow, occlusion and edges true, not to restyle the art. So every line
// here is a comparison against `forge/shots/cut/`, the base the blind judge
// scored higher twice, and a line PASSES when this folder's frame is inside
// the tolerance or better. The regions are not invented: each one carries
// the sentence from `program/judge/stage-0.2/VERDICT.md` or
// `stage-0.2b/VERDICT.md` that named it.
//
// The four families the gate is built from:
//   darks         a patch mean within 3 levels of the base's, so no ambient
//                 term lifts the black the room falls into
//   three scales  the bowl's coarse, mid and fine energy within 15 percent
//                 of the base's, so no rim glare buries the veining
//   edge step     the plinth silhouette graded at least as well as the base's
//   noise         the sky's own grain with no lattice at any pitch
// plus the frame-specific rules the second verdict wrote as defects: the
// bays' recession, the transit's rays, the pane's room and its glow, and no
// new bright mote on a caption.
//
// Levels are the mean of the three channels, which is how the verdicts read
// them. No dependency: the PNG decoder is at the bottom of this file.
//
// HOW THE FOLDER IS SHOT, and it is not free choice: the base was made from
// eight named states, and a frame shot at another state is compared against
// a picture of something else. The wheel is the one that bites, because the
// base was shot on the ARTISTS constellation and that is index 3 in the
// content today; at the default index the title is a longer word standing
// inside the darkest-patch region, and four lines fail for a reason that has
// nothing to do with the stack. One run per viewport, hero tier:
//
//   STATES='[{"name":"transit","phase":"transit","opts":{}},
//            {"name":"held","phase":"held","opts":{}},
//            {"name":"descent","phase":"descent","opts":{}},
//            {"name":"agora","phase":"agora","opts":{}},
//            {"name":"wheel","phase":"wheel","opts":{"chapter":3}},
//            {"name":"pane","phase":"pane","opts":{"slug":"vinci"}},
//            {"name":"breath","phase":"breath","opts":{}},
//            {"name":"wing","phase":"wing","opts":{"slug":"vinci"}}]'
//   FORGE_VP=desktop FORGE_TIER=hero node forge/shot-agent.mjs <port> <dir> "$STATES"
//   FORGE_VP=mobile  FORGE_TIER=hero node forge/shot-agent.mjs <port> <dir> "$STATES"
//   then drop `-hero-` from every file name, which is what the base carries.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

const SHOTS = new URL('./shots/', import.meta.url).pathname
const args = process.argv.slice(2)
const folder = args.find((a) => !a.startsWith('--')) ?? 'stack-after-3'
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i < 0 ? d : (args[i + 1] ?? true)
}
const BASE = flag('base', 'cut')
const ONLY = flag('only')
const CROPS = args.includes('--crops')
const JSON_OUT = args.includes('--json')

/* ── the regions, with the sentence that named them ─────────────────────── */

const V2 = 'judge/stage-0.2/VERDICT.md'
const V2B = 'judge/stage-0.2b/VERDICT.md'

/** rect: [x, y, w, h] in the delivered frame's own pixels */
const REGIONS = {
  'mobile-agora': [
    /* The judge's own band, y 700 to 760, held to the AIR in it: a patch
       that reaches the bench top or the column base measures the trim's own
       key light, which is form and not a veil, and the sentence being
       tested is about the air. */
    {
      name: 'the air left of the bowl',
      rect: [180, 695, 120, 50],
      rule: 'darks',
      note: `${V2B}: "the air beside the bowl sits at 31 to 44 from y 700 to 760 where B sits at 7 to 20"`,
    },
    {
      name: 'the air right of the bowl',
      rect: [560, 695, 75, 50],
      rule: 'darks',
      note: `${V2B}: the same band, the other side of the flame`,
    },
    {
      name: 'the court at the left margin',
      rect: [40, 1420, 120, 150],
      rule: 'darks',
      note: `${V2B}: the floor the letterpress stands on, clear of every glyph`,
    },
    {
      name: "the bowl's three scales",
      rect: [290, 806, 200, 42],
      rule: 'scales',
      note: `${V2B}: "the bowl's veining is buried by the rim glare, measured coarse 4.75 / mid 1.15 / fine 1.18 on a local mean of 59.6" against the base's "coarse 2.09 / mid 1.09 / fine 0.95 on a mean of 49.8"`,
    },
    {
      name: 'the slab ring at 7x',
      rect: [130, 880, 170, 100],
      rule: 'edge',
      note: `${V2B}: "the plinth's curve against the floor steps in 2 to 3 px blocks with no intermediate value, and every slab edge does the same"`,
    },
  ],

  'desktop-agora': [
    {
      name: 'the bay-by-bay step',
      rect: [0, 0, 0, 0],
      bays: [
        [190, 190, 60, 80],
        [400, 200, 60, 80],
        [560, 210, 40, 70],
        [900, 210, 40, 70],
        [1030, 200, 60, 80],
        [1250, 190, 60, 80],
      ],
      rule: 'bays',
      note: `${V2B}: "the near bays and the far bays sit at similar values under one uniform haze, so the colonnade flattens instead of receding", against the base which "steps back bay by bay"`,
    },
    {
      name: 'the court left of the log pile',
      rect: [120, 700, 200, 90],
      rule: 'darks',
      note: `${V2B}: "the floor to the left of the bench, where the occlusion should be smooth, is a grainy dark field"`,
    },
    {
      name: 'the architrave band',
      rect: [560, 60, 380, 30],
      rule: 'darks',
      note: `${V2}: the band that holds 14 to 18 levels of gradient in both folders`,
    },
  ],

  'desktop-pane': [
    {
      name: 'the room behind the portrait',
      rect: [60, 60, 300, 820],
      rule: 'room',
      note: `${V2B}: "Three widely separated patches read 4.84, 5.09 and 5.87 mean with a standard deviation of 0.39 to 0.48" against A's "13.6 to 35.4 vertically with visible grain"`,
    },
    {
      name: "the room's tooth at the far corner",
      rect: [1180, 720, 280, 180],
      rule: 'grain',
      note: `${V2B}: the §D fail, "flat at mean 5.1 with a standard deviation of 0.4"`,
    },
    {
      name: 'the glow off the painting',
      rect: [0, 0, 0, 0],
      rule: 'glow',
      note: `${V2B}: "a halo more than 90 px wide, where B holds its falloff to about 20 px and takes it off the gold frame line rather than off the picture"`,
    },
  ],

  'mobile-pane': [
    {
      name: 'the room behind the portrait',
      rect: [500, 120, 240, 900],
      rule: 'room',
      note: `${V2B}: "Patches at 5.1, 5.1 and 5.2 with a standard deviation of 0.35 to 0.44" against A's "20.2, 23.3 and 21.2 with grain"`,
    },
    {
      name: "the room's tooth at the foot",
      rect: [80, 1420, 300, 200],
      rule: 'grain',
      note: `${V2B}: the same plane at the other end of the frame`,
    },
  ],

  'mobile-descent': [
    {
      name: 'the sky above the ring',
      rect: [60, 120, 660, 500],
      rule: 'noise',
      note: `${V2B}: "a repeating noise pattern at roughly a 4 px pitch" in A, "a visible diagonal weave at roughly an 8 px pitch" in B`,
    },
    {
      name: 'the void above the ring',
      rect: [60, 120, 660, 500],
      rule: 'darks',
      note: `${V2}: the §D plane, "mean 10.7 in A and 8.9 in B with a spread of 7 to 8 levels"`,
    },
  ],

  'desktop-descent': [
    {
      name: 'the sky above the ring',
      rect: [80, 60, 500, 340],
      rule: 'noise',
      note: `${V2B}: the same grain, on the wider frame`,
    },
  ],

  'desktop-transit': [
    {
      name: "the diamond's rays",
      centre: [755, 329],
      radius: 114,
      rule: 'rays',
      note: `${V2B}: "two starburst rays stop in mid-air over the lunar disc, which reads as a cut element rather than a made one"`,
    },
    {
      name: 'the blue the burst leaves in the sky',
      rect: [960, 110, 80, 80],
      rule: 'blue',
      note: `${V2B}: "the burst desaturates the sky to neutral, measured blue-minus-red of 3.1 at (1000, 150) where B holds 37.3"`,
    },
  ],

  'mobile-transit': [
    {
      name: "the diamond's rays",
      centre: [396, 586],
      radius: 203,
      rule: 'rays',
      note: `${V2B}: "cut the diamond's rays in mid-air"`,
    },
  ],

  'mobile-held': [
    {
      name: "the moon's disc interior",
      rect: [330, 500, 180, 180],
      rule: 'disc',
      note: `${V2B}: "the disc interior holds grain rather than clipping to pure black (mean 7.3 in A, 6.0 in B, with a standard deviation near 1.05 in each)"`,
    },
    {
      name: "the eclipse's ring at 36 angles",
      centre: [418, 587],
      radius: 203,
      rule: 'ring',
      note: `${V2B}: "Sampled at 36 angles three pixels outside the limb in mobile-held, A runs min 125, max 232, mean 197 and B runs min 184, max 231, mean 198"`,
    },
  ],

  'desktop-held': [
    {
      name: "the eclipse's ring at 36 angles",
      centre: [771, 329],
      radius: 114,
      rule: 'ring',
      note: `${V2}: the ring the whole overture rests on, sampled three pixels outside the limb`,
    },
  ],

  'mobile-wheel': [
    {
      name: 'the caption line',
      rect: [40, 1180, 700, 150],
      rule: 'caption',
      note: `${V2B}: "bright out-of-focus motes land on the P of EXPLORE and on LIFE and AND in the caption line"`,
    },
    {
      name: 'the sky above the names',
      rect: [80, 200, 620, 400],
      rule: 'noise',
      note: `${V2B}: the wheel's own sky, "13 to 21 with grain"`,
    },
  ],

  'desktop-wheel': [
    {
      name: 'the caption line',
      rect: [400, 780, 700, 120],
      rule: 'caption',
      note: `${V2B}: the same rule on the wider frame`,
    },
    {
      name: 'the sky left of the asterism',
      rect: [80, 120, 300, 300],
      rule: 'noise',
      note: `${V2B}: "the wheel sky in both (13 to 21 with grain)"`,
    },
  ],

  'desktop-wing': [
    {
      name: 'the sky behind the card',
      rect: [80, 80, 300, 300],
      rule: 'noise',
      note: `${V2B}: "the wing sky in both (a ramp of 10.5 to 11.6 with nebula and stars)"`,
    },
  ],
}

/* The two frames whose ground is the §D fix itself: the base's pane is flat
   black at 4 to 5 levels and the room the stack put behind the portrait is
   the one place this folder is REQUIRED to stand above it. So those two
   frames answer to the room rule and not to the darkest-patch rule. */
const NO_DARKEST = new Set(['desktop-pane', 'mobile-pane'])

/* every frame also answers for the darkest patch of the base's own frame,
   which is where an ambient term shows first and which no verdict had to
   name because it is the whole rule */
const FRAMES = [
  'desktop-transit', 'desktop-held', 'desktop-descent', 'desktop-agora',
  'desktop-wheel', 'desktop-pane', 'desktop-breath', 'desktop-wing',
  'mobile-transit', 'mobile-held', 'mobile-descent', 'mobile-agora',
  'mobile-wheel', 'mobile-pane', 'mobile-breath', 'mobile-wing',
]

/* the tolerances, in one place, each with the rule it serves */
const TOL = {
  /** levels: a dark patch may not move by more than this */
  darks: 3,
  /** the three scales, as a fraction of the base's */
  scales: 0.15,
  /** the edge test: the share of silhouette crossings that step hard */
  edge: 0.05,
  /** the sky's own autocorrelation off zero lag */
  noise: 0.1,
  /** a room needs this much vertical range and this much grain */
  roomRange: 12,
  roomGrain: 1.2,
  /** the halo off a painting, in pixels of the frame */
  glow: 30,
  /** new bright pixels allowed over a caption, as a share of the band */
  caption: 0.002,
}

/* ── the measures ───────────────────────────────────────────────────────── */

const rectOf = (img, [x, y, w, h]) => {
  const out = new Float64Array(w * h)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) out[j * w + i] = img.grey[(y + j) * img.width + (x + i)]
  return { data: out, w, h }
}

function stats(p) {
  let sum = 0
  for (const v of p.data) sum += v
  const mean = sum / p.data.length
  let acc = 0
  for (const v of p.data) acc += (v - mean) * (v - mean)
  return { mean, sd: Math.sqrt(acc / p.data.length) }
}

/* THE DARK OF A PATCH IS ITS FLOOR, NOT ITS AVERAGE. The verdicts read the
   darks as a range ("7 to 20", "31 to 44"), and an average moves when a
   made element crosses the patch (a ray, a star, an ember) where the floor
   does not. The twentieth percentile is what an ambient term lifts and a
   bright line does not. */
function darkOf(p) {
  const sorted = Array.from(p.data).sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * 0.2)]
}

/** a separable box blur, radius in pixels, on a patch */
function blur(p, r) {
  if (r <= 0) return p
  const { w, h } = p
  const tmp = new Float64Array(w * h)
  const out = new Float64Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let s = 0
      let n = 0
      for (let k = -r; k <= r; k++) {
        const x = i + k
        if (x < 0 || x >= w) continue
        s += p.data[j * w + x]
        n++
      }
      tmp[j * w + i] = s / n
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let s = 0
      let n = 0
      for (let k = -r; k <= r; k++) {
        const y = j + k
        if (y < 0 || y >= h) continue
        s += tmp[y * w + i]
        n++
      }
      out[j * w + i] = s / n
    }
  }
  return { data: out, w, h }
}

const sub = (a, b) => ({ data: a.data.map((v, i) => v - b.data[i]), w: a.w, h: a.h })

/** a star's core is not grain: hold the field to four sigma so one bright
    object cannot stand in for a pattern */
function clipOutliers(p) {
  const { sd } = stats(p)
  const cap = sd * 4
  return { data: p.data.map((v) => Math.max(-cap, Math.min(cap, v))), w: p.w, h: p.h }
}
const sdOf = (p) => stats(p).sd

/**
 * Three scales of one surface, measured ACROSS it and not through it.
 *
 * The scales are the ones the art names: the bowl's patina at 9 cm, its
 * hammer at 1.6 cm and the tooth under both, which at the phone's own bowl
 * are about 28, 5 and 2 pixels. The bands are therefore 12 to 37 px, 4 to
 * 12 px and under 4 px.
 *
 * The blur runs along the patch's WIDTH only. A patch cut from a bowl's
 * wall is two hundred pixels wide and forty tall, and a two-dimensional
 * blur wider than the patch is tall measures the patch's own edges instead
 * of the stone in it: read that way the same frame lost a third of its
 * coarse scale to arithmetic. The mottling is isotropic, so one direction
 * says what both would.
 */
function threeScales(p) {
  const b2 = blurX(p, 2)
  const b6 = blurX(p, 6)
  const b18 = blurX(p, 18)
  return {
    coarse: sdOf(sub(b6, b18)),
    mid: sdOf(sub(b2, b6)),
    fine: sdOf(sub(p, b2)),
    mean: stats(p).mean,
  }
}

/** a box blur along the rows only */
function blurX(p, r) {
  const { w, h } = p
  const out = new Float64Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let s = 0
      let n = 0
      for (let k = -r; k <= r; k++) {
        const x = i + k
        if (x < 0 || x >= w) continue
        s += p.data[j * w + x]
        n++
      }
      out[j * w + i] = s / n
    }
  }
  return { data: out, w, h }
}

/**
 * The edge test. Every row of the patch is walked for its strongest
 * horizontal transition; a crossing is HARD when the step happens with no
 * sample between a fifth and four fifths of the way across it, which is
 * exactly what a one-pixel stair looks like at 7x.
 */
function edgeStep(p) {
  let crossings = 0
  let hard = 0
  for (let j = 0; j < p.h; j++) {
    let best = 0
    let at = -1
    for (let i = 1; i < p.w - 1; i++) {
      const d = Math.abs(p.data[j * p.w + i + 1] - p.data[j * p.w + i - 1])
      if (d > best) {
        best = d
        at = i
      }
    }
    if (best < 8 || at < 2 || at > p.w - 3) continue
    crossings++
    const a = p.data[j * p.w + at - 2]
    const b = p.data[j * p.w + at + 2]
    const lo = Math.min(a, b)
    const span = Math.abs(b - a)
    let between = 0
    for (let k = -2; k <= 2; k++) {
      const t = (p.data[j * p.w + at + k] - lo) / (span || 1)
      if (t > 0.2 && t < 0.8) between++
    }
    if (between === 0) hard++
  }
  return { crossings, hard, share: crossings ? hard / crossings : 0 }
}

/**
 * The sky's own grain, with no lattice. The patch is high-passed (its own
 * broad blur removed, so a gradient cannot read as correlation) and then
 * autocorrelated over short lags. Unpatterned noise answers near zero
 * everywhere off the origin; a lattice answers with a peak at its pitch.
 */
function autocorr(p, maxLag = 16) {
  const hp = clipOutliers(sub(p, blur(p, 2)))
  let energy = 0
  for (const v of hp.data) energy += v * v
  if (energy < 1e-9) return { peak: 0, lag: [0, 0], energy: 0 }
  let peak = 0
  let lag = [0, 0]
  for (let dy = 0; dy <= maxLag; dy++) {
    for (let dx = -maxLag; dx <= maxLag; dx++) {
      /* A LATTICE REPEATS, so it answers POSITIVE at its own pitch. What
         sits at a lag of one or two pixels is the opposite: neighbouring
         pixels of unpatterned noise anti-correlate, and so does the print's
         own resolve. Both verdicts named a pitch (4 px and 8 px), so the
         search starts at three. */
      if (dx * dx + dy * dy < 9) continue
      if (dy === 0 && dx < 0) continue
      let s = 0
      let n = 0
      for (let j = 0; j + dy < hp.h; j += 2) {
        for (let i = Math.max(0, -dx); i < hp.w && i + dx < hp.w; i += 2) {
          s += hp.data[j * hp.w + i] * hp.data[(j + dy) * hp.w + i + dx]
          n++
        }
      }
      const r = n ? s / n / (energy / hp.data.length) : 0
      if (r > peak) {
        peak = r
        lag = [dx, dy]
      }
    }
  }
  return { peak, lag, energy: Math.sqrt(energy / hp.data.length) }
}

/** the darkest patch of a frame, found on the BASE so the region is the
    base's own choice and this folder cannot move the goalposts */
function darkestPatch(img, w, h) {
  let best = Infinity
  let at = [0, 0]
  for (let y = 0; y + h <= img.height; y += 40) {
    for (let x = 0; x + w <= img.width; x += 40) {
      const m = stats(rectOf(img, [x, y, w, h])).mean
      if (m < best) {
        best = m
        at = [x, y]
      }
    }
  }
  return { rect: [at[0], at[1], w, h], mean: best }
}

/**
 * The halo a bright plate throws onto the ground beside it. The profile is
 * read to the LEFT of the plate, which is the one side of this station that
 * carries no type, and the reach is how far out the ground still stands two
 * levels over the ground 200 px further on. A room's own density gradient is
 * broad and shallow and does not answer here; a bloom off the picture does.
 */
function glowReach(img) {
  const [px, py, , ph] = plateOf(img)
  const y = py + Math.floor(ph / 2) - 40
  const col = (x) => stats(rectOf(img, [Math.max(0, x), Math.max(0, y), 12, 80])).mean
  /* A ROOM IS NOT A HALO. The ground behind the portrait carries a density
     gradient by design (the empty-plane rule), and it is broad and shallow.
     What the second verdict faulted was a halo off the PICTURE: steep, local
     and centred on the plate. So the broad field is fitted from two points
     well outside the plate and taken off, and what is left over is the halo. */
  const a = col(Math.max(0, px - 150))
  const b = col(Math.max(0, px - 210))
  const slope = (a - b) / 60
  let reach = 0
  let lift = 0
  for (let d = 6; d < 150; d += 4) {
    const x = px - d - 12
    if (x < 0) break
    const field = a + slope * (150 - d)
    const over = col(x) - field
    if (over > 2) {
      reach = Math.max(reach, d)
      lift = Math.max(lift, over)
    }
  }
  return { reach, lift }
}

/** how blue a patch of sky still is: a burst that desaturates it neutral is
    what the second verdict measured at (1000, 150) */
function blueOf(img, rect) {
  const [x, y, w, h] = rect
  let r = 0
  let b = 0
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const o = ((y + j) * img.width + (x + i)) * 3
      r += img.rgb[o]
      b += img.rgb[o + 2]
    }
  return (b - r) / (w * h)
}

/**
 * A starburst that ends in mid-air. Every ray is walked outward from the
 * flash; the ray's own end is where it falls back into the sky, and the end
 * is CUT when the last step of the fall is most of the ray's height.
 */
function rayEnds(img, centre) {
  const [cx, cy] = centre
  const at = (x, y) => {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return null
    return img.grey[yi * img.width + xi]
  }
  /** how wide the thing is, in degrees, at half its height */
  const spread = (a, r) => {
    const peak = at(cx + Math.cos(a) * r, cy + Math.sin(a) * r) ?? 0
    let deg = 0
    for (let t = 1; t <= 20; t++) {
      const rad = (t * Math.PI) / 180
      const l = at(cx + Math.cos(a - rad) * r, cy + Math.sin(a - rad) * r) ?? 0
      const rr = at(cx + Math.cos(a + rad) * r, cy + Math.sin(a + rad) * r) ?? 0
      if (Math.max(l, rr) < peak * 0.5) break
      deg = t
    }
    return deg
  }
  const ends = []
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8
    const prof = []
    for (let r = 10; r < 420; r += 2) {
      const v = at(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      if (v === null) break
      prof.push(v)
    }
    if (prof.length < 20) continue
    const tail = prof.slice(-10).reduce((s, v) => s + v, 0) / 10
    const head = Math.max(...prof.slice(0, 10))
    // a corona streamer is broad and soft; a starburst ray is a bright,
    // narrow line, and only one of the two can end in mid-air
    if (head < tail + 40) continue
    let end = prof.length - 1
    for (let i = 0; i < prof.length; i++)
      if (prof[i] < tail + 6) {
        end = i
        break
      }
    // a corona streamer is a broad plume; a starburst ray is a line
    if (spread(a, 10 + end) > 8) continue
    const drop = end > 2 ? prof[end - 3] - prof[end] : 0
    ends.push({ angle: Math.round((a * 180) / Math.PI), drop, height: head - tail })
  }
  const cut = ends.filter((e) => e.drop > Math.max(24, e.height * 0.4)).length
  return { rays: ends.length, cut }
}

/**
 * The eclipse's ring, sampled three pixels outside the limb the way the
 * judge did. The limb is found along EACH angle rather than assumed from a
 * radius: the silhouette is drawn in the shader and feathered by the pixel's
 * own footprint, so it does not stand at the same radius in two builds, and
 * three pixels outside the base's limb can be one pixel inside this one's.
 */
function ringSamples(img, centre, radius) {
  const [cx, cy] = centre
  const at = (x, y) => {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return 0
    return img.grey[yi * img.width + xi]
  }
  const out = []
  for (let k = 0; k < 36; k++) {
    const a = (k * Math.PI) / 18
    let limb = radius
    for (let rr = radius - 12; rr < radius + 12; rr++) {
      if (at(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) > 60) {
        limb = rr
        break
      }
    }
    out.push(at(cx + Math.cos(a) * (limb + 3), cy + Math.sin(a) * (limb + 3)))
  }
  return { min: Math.min(...out), max: Math.max(...out), mean: out.reduce((s, v) => s + v, 0) / out.length }
}

/* ── the run ────────────────────────────────────────────────────────────── */

function frameFile(dir, frame) {
  const [vp, ...rest] = frame.split('-')
  const state = rest.join('-')
  const files = readdirSync(`${SHOTS}${dir}`)
  const exact = files.find((f) => f === `${frame}.png`)
  if (exact) return `${SHOTS}${dir}/${exact}`
  // the rig writes <viewport>-<tier>-<state>.png; a folder shot by hand may
  // carry the before folder's own names instead
  const hit = files.find((f) => f.startsWith(`${vp}-`) && f.endsWith(`-${state}.png`))
  return hit ? `${SHOTS}${dir}/${hit}` : null
}

/* THE INCUMBENT MAY BE A PLACEHOLDER. Half of this base was shot before
   the surface it names existed: the `wing` plate is the In-preparation card
   over the night sky, and comparing an October afternoon against it measures
   the difference between two pictures of different things, not a regression
   in the stack. Those pairs are declared in forge/PARITY-BASE.json and read
   out as NOT COMPARABLE rather than counted either way.

   The declaration is pinned to the plate's own sha256, so it expires by
   itself: the day the base is re-shot the hash stops matching, the line
   comes back as a comparison, and the script says that it did. */
const BASE_MANIFEST = 'PARITY-BASE.json'
function placeholders() {
  const path = new URL(`./${BASE_MANIFEST}`, import.meta.url).pathname
  if (!existsSync(path)) return { placeholders: {} }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    console.error(`${BASE_MANIFEST} is not readable JSON: ${err.message}`)
    process.exit(1)
  }
}
const MANIFEST = placeholders()
const stale = []
const hashed = new Map()
/** what this frame's incumbent cannot answer for, or null when it can */
function notComparable(frame, rule) {
  const said = MANIFEST.placeholders?.[frame]
  if (!said || MANIFEST.base !== BASE) return null
  if (!hashed.has(frame)) {
    const file = frameFile(BASE, frame)
    hashed.set(frame, file ? createHash('sha256').update(readFileSync(file)).digest('hex') : '')
  }
  if (hashed.get(frame) !== said.sha256) {
    if (!stale.includes(frame)) stale.push(frame)
    return null
  }
  if ((said.stillComparable ?? []).includes(rule)) return null
  return said.why
}

const rows = []
const add = (frame, line, baseSaid, mine, verdict, note, rule) => {
  const why = notComparable(frame, rule)
  rows.push({ frame, line, base: baseSaid, mine, pass: why ? null : verdict, note, rule, why })
}

for (const frame of FRAMES) {
  if (ONLY && frame !== ONLY) continue
  const bf = frameFile(BASE, frame)
  const nf = frameFile(folder, frame)
  if (!bf || !nf) {
    add(frame, 'the frame itself', bf ? 'present' : 'MISSING', nf ? 'present' : 'MISSING', false, '', 'frame')
    continue
  }
  const B = readPNG(bf)
  const N = readPNG(nf)
  if (B.width !== N.width || B.height !== N.height) {
    add(frame, 'the frame itself', `${B.width}x${B.height}`, `${N.width}x${N.height}`, false, 'the two frames are not the same size', 'frame')
    continue
  }

  // 1 · the base's own darkest patch, which is where a lift shows first
  if (!NO_DARKEST.has(frame)) {
    const side = frame.startsWith('mobile') ? 200 : 240
    const dp = darkestPatch(B, side, Math.round(side * 0.7))
    add(
      frame,
      `the base's darkest ${side}px patch at ${dp.rect[0]},${dp.rect[1]}`,
      ...darksLine(B, N, dp.rect),
      'the ambient term may not lift the black the room falls into',
      'darks'
    )
  }

  for (const r of REGIONS[frame] ?? []) {
    if (r.rule === 'darks') {
      add(frame, r.name, ...darksLine(B, N, r.rect), r.note, r.rule)
    } else if (r.rule === 'scales') {
      const b = threeScales(rectOf(B, r.rect))
      const n = threeScales(rectOf(N, r.rect))
      const within = (x, y) => Math.abs(x - y) / (y || 1) <= TOL.scales
      add(
        frame,
        r.name,
        `coarse ${b.coarse.toFixed(2)} mid ${b.mid.toFixed(2)} fine ${b.fine.toFixed(2)} on ${b.mean.toFixed(1)}`,
        `coarse ${n.coarse.toFixed(2)} mid ${n.mid.toFixed(2)} fine ${n.fine.toFixed(2)} on ${n.mean.toFixed(1)}`,
        within(n.coarse, b.coarse) && within(n.mid, b.mid) && within(n.fine, b.fine),
        r.note,
        r.rule
      )
    } else if (r.rule === 'edge') {
      const b = edgeStep(rectOf(B, r.rect))
      const n = edgeStep(rectOf(N, r.rect))
      add(
        frame,
        r.name,
        `${(b.share * 100).toFixed(1)}% of ${b.crossings} crossings step hard`,
        `${(n.share * 100).toFixed(1)}% of ${n.crossings} crossings step hard`,
        n.share <= b.share + TOL.edge,
        r.note,
        r.rule
      )
      if (CROPS) writeCrop(N, r.rect, 7, `parity-${frame}-edge.png`)
    } else if (r.rule === 'noise') {
      const b = autocorr(rectOf(B, r.rect))
      const n = autocorr(rectOf(N, r.rect))
      add(
        frame,
        r.name,
        `peak ${b.peak.toFixed(3)} at lag ${b.lag.join(',')} on ${b.energy.toFixed(2)}`,
        `peak ${n.peak.toFixed(3)} at lag ${n.lag.join(',')} on ${n.energy.toFixed(2)}`,
        Math.abs(n.peak) <= Math.max(TOL.noise, Math.abs(b.peak)),
        r.note,
        r.rule
      )
    } else if (r.rule === 'room') {
      const b = roomOf(B, r.rect)
      const n = roomOf(N, r.rect)
      add(
        frame,
        r.name,
        `range ${b.range.toFixed(1)} grain ${b.grain.toFixed(2)}`,
        `range ${n.range.toFixed(1)} grain ${n.grain.toFixed(2)}`,
        n.range >= TOL.roomRange && n.grain >= TOL.roomGrain,
        r.note,
        r.rule
      )
    } else if (r.rule === 'grain') {
      const b = roomOf(B, r.rect)
      const n = roomOf(N, r.rect)
      add(
        frame,
        r.name,
        `grain ${b.grain.toFixed(2)}`,
        `grain ${n.grain.toFixed(2)}`,
        n.grain >= TOL.roomGrain,
        r.note,
        r.rule
      )
    } else if (r.rule === 'glow') {
      const b = glowReach(B)
      const n = glowReach(N)
      add(
        frame,
        r.name,
        `${b.reach} px off the plate (lift ${b.lift.toFixed(1)})`,
        `${n.reach} px off the plate (lift ${n.lift.toFixed(1)})`,
        n.reach <= TOL.glow,
        r.note,
        r.rule
      )
    } else if (r.rule === 'blue') {
      const b = blueOf(B, r.rect)
      const n = blueOf(N, r.rect)
      add(
        frame,
        r.name,
        `blue minus red ${b.toFixed(1)}`,
        `blue minus red ${n.toFixed(1)}`,
        n >= b * 0.8,
        r.note,
        r.rule
      )
    } else if (r.rule === 'bays') {
      const spread = (img) => {
        const means = r.bays.map((q) => stats(rectOf(img, q)).mean)
        const m = means.reduce((s2, v) => s2 + v, 0) / means.length
        return { means, sd: Math.sqrt(means.reduce((s2, v) => s2 + (v - m) * (v - m), 0) / means.length) }
      }
      const b = spread(B)
      const n = spread(N)
      add(
        frame,
        r.name,
        `${b.means.map((v) => v.toFixed(0)).join(' ')} → step ${b.sd.toFixed(2)}`,
        `${n.means.map((v) => v.toFixed(0)).join(' ')} → step ${n.sd.toFixed(2)}`,
        n.sd >= b.sd * 0.8,
        r.note,
        r.rule
      )
    } else if (r.rule === 'rays') {
      const b = rayEnds(B, brightest(B))
      const n = rayEnds(N, brightest(N))
      add(
        frame,
        r.name,
        `${b.cut} of ${b.rays} rays end in mid-air`,
        `${n.cut} of ${n.rays} rays end in mid-air`,
        n.cut === 0,
        r.note,
        r.rule
      )
    } else if (r.rule === 'disc') {
      const b = stats(rectOf(B, r.rect))
      const n = stats(rectOf(N, r.rect))
      add(
        frame,
        r.name,
        `${b.mean.toFixed(2)} sd ${b.sd.toFixed(2)}`,
        `${n.mean.toFixed(2)} sd ${n.sd.toFixed(2)}`,
        Math.abs(n.mean - b.mean) <= TOL.darks && n.sd >= 0.6,
        r.note,
        r.rule
      )
    } else if (r.rule === 'ring') {
      const b = ringSamples(B, r.centre, r.radius)
      const n = ringSamples(N, r.centre, r.radius)
      add(
        frame,
        r.name,
        `min ${b.min.toFixed(0)} max ${b.max.toFixed(0)} mean ${b.mean.toFixed(0)}`,
        `min ${n.min.toFixed(0)} max ${n.max.toFixed(0)} mean ${n.mean.toFixed(0)}`,
        n.min >= b.min * 0.8 && n.mean >= b.mean * 0.85,
        r.note,
        r.rule
      )
    } else if (r.rule === 'caption') {
      const c = newBright(B, N, r.rect)
      add(
        frame,
        r.name,
        'the base carries no mote here',
        `${(c.share * 100).toFixed(3)}% of the band is newly bright (${c.count} px)`,
        c.share <= TOL.caption,
        r.note,
        r.rule
      )
    } else if (r.rule === 'bay-far') {
      const far = stats(rectOf(N, r.rect)).mean
      const nearRect = (REGIONS[frame].find((q) => q.name === r.pair) ?? {}).rect
      const near = stats(rectOf(N, nearRect)).mean
      const bFar = stats(rectOf(B, r.rect)).mean
      const bNear = stats(rectOf(B, nearRect)).mean
      const bStep = bNear - bFar
      const nStep = near - far
      add(
        frame,
        'the bay-by-bay step',
        `near ${bNear.toFixed(1)} far ${bFar.toFixed(1)}, step ${bStep.toFixed(1)}`,
        `near ${near.toFixed(1)} far ${far.toFixed(1)}, step ${nStep.toFixed(1)}`,
        nStep >= bStep * 0.8,
        r.note,
        r.rule
      )
    }
  }
}

/**
 * A dark patch answers twice: its average may not move by more than three
 * levels either way, and its FLOOR may not be lifted at all. A floor that
 * goes lower than the base's is a surface that gained texture, which is not
 * what an ambient term does and not what this rule is guarding.
 */
function darksLine(B, N, rect) {
  const bp = rectOf(B, rect)
  const np = rectOf(N, rect)
  const bf = darkOf(bp)
  const nf = darkOf(np)
  const bm = stats(bp).mean
  const nm = stats(np).mean
  return [
    `floor ${bf.toFixed(2)} mean ${bm.toFixed(2)}`,
    `floor ${nf.toFixed(2)} mean ${nm.toFixed(2)}`,
    Math.abs(nm - bm) <= TOL.darks && nf - bf <= TOL.darks,
  ]
}

function roomOf(img, rect) {
  const p = rectOf(img, rect)
  const rowsMean = []
  for (let j = 0; j < p.h; j++) {
    let s = 0
    for (let i = 0; i < p.w; i++) s += p.data[j * p.w + i]
    rowsMean.push(s / p.w)
  }
  const grain = sdOf(sub(p, blur(p, 3)))
  return { range: Math.max(...rowsMean) - Math.min(...rowsMean), grain }
}

/** the portrait plate: the brightest large block of the pane */
function plateOf(img) {
  let bx = 0
  let by = 0
  let best = -1
  for (let y = 0; y + 80 < img.height; y += 20) {
    for (let x = 0; x + 80 < img.width; x += 20) {
      const m = stats(rectOf(img, [x, y, 80, 80])).mean
      if (m > best) {
        best = m
        bx = x
        by = y
      }
    }
  }
  // walk out while the block stays lit
  let x0 = bx
  let x1 = bx + 80
  let y0 = by
  let y1 = by + 80
  const lit = (r) => stats(rectOf(img, r)).mean > best * 0.35
  while (x0 - 20 > 0 && lit([x0 - 20, y0, 20, y1 - y0])) x0 -= 20
  while (x1 + 20 < img.width && lit([x1, y0, 20, y1 - y0])) x1 += 20
  while (y0 - 20 > 0 && lit([x0, y0 - 20, x1 - x0, 20])) y0 -= 20
  while (y1 + 20 < img.height && lit([x0, y1, x1 - x0, 20])) y1 += 20
  return [x0, y0, x1 - x0, y1 - y0]
}

function brightest(img) {
  let bx = 0
  let by = 0
  let best = -1
  for (let y = 4; y < img.height - 4; y += 4) {
    for (let x = 4; x < img.width - 4; x += 4) {
      const v = img.grey[y * img.width + x]
      if (v > best) {
        best = v
        bx = x
        by = y
      }
    }
  }
  return [bx, by]
}

/** pixels this folder lit that the base left dark: a mote on a caption */
function newBright(B, N, rect) {
  const b = rectOf(B, rect)
  const n = rectOf(N, rect)
  let count = 0
  for (let i = 0; i < b.data.length; i++) if (n.data[i] - b.data[i] > 25) count++
  return { count, share: count / b.data.length }
}

function writeCrop(img, [x, y, w, h], scale, name) {
  const dir = `${SHOTS}crops/`
  mkdirSync(dir, { recursive: true })
  const W = w * scale
  const H = h * scale
  const px = Buffer.alloc(W * H * 3)
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const sx = x + Math.floor(i / scale)
      const sy = y + Math.floor(j / scale)
      const o = (sy * img.width + sx) * 3
      const d = (j * W + i) * 3
      px[d] = img.rgb[o]
      px[d + 1] = img.rgb[o + 1]
      px[d + 2] = img.rgb[o + 2]
    }
  }
  writeFileSync(dir + name, encodePNG(px, W, H))
}

/* ── the table ──────────────────────────────────────────────────────────── */

const comparable = rows.filter((r) => r.pass !== null)
const excluded = rows.filter((r) => r.pass === null)
const bad = comparable.filter((r) => !r.pass)

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        folder,
        base: BASE,
        lines: rows.length,
        comparable: comparable.length,
        passed: comparable.length - bad.length,
        notComparable: excluded.length,
        stale,
        rows,
      },
      null,
      2
    )
  )
} else {
  const w1 = Math.max(...rows.map((r) => r.frame.length))
  const w2 = Math.max(...rows.map((r) => r.line.length))
  const w3 = Math.max(...rows.map((r) => String(r.base).length))
  const w4 = Math.max(...rows.map((r) => String(r.mine).length))
  console.log(`parity: forge/shots/${folder} against forge/shots/${BASE}`)
  console.log(
    `${'frame'.padEnd(w1)}  ${'what is measured'.padEnd(w2)}  ${'the base'.padEnd(w3)}  ${'this folder'.padEnd(w4)}  `
  )
  for (const r of rows) {
    const verdict = r.pass === null ? 'NOT COMPARABLE' : r.pass ? 'PASS' : 'FAIL'
    console.log(
      `${r.frame.padEnd(w1)}  ${r.line.padEnd(w2)}  ${String(r.base).padEnd(w3)}  ${String(r.mine).padEnd(w4)}  ${verdict}`
    )
  }
  console.log(`\n${comparable.length - bad.length} of ${comparable.length} comparable lines PASS`)
  for (const r of bad) console.log(` FAIL  ${r.frame}  ${r.line}\n       ${r.note}`)
  if (excluded.length) {
    console.log(`\n${excluded.length} line(s) NOT COMPARABLE, per forge/${BASE_MANIFEST}:`)
    for (const r of excluded) console.log(` ${r.frame}  ${r.line}\n       ${r.why}`)
  }
  for (const f of stale)
    console.log(
      `\nnote: ${BASE_MANIFEST} calls ${f} a placeholder, but the plate on disk is not the one it names.` +
        '\n      The base was re-shot, so the line is compared again. Drop the entry.'
    )
}
process.exitCode = bad.length ? 1 : 0

/* ── PNG, read and written without a dependency ─────────────────────────── */

function readPNG(path) {
  const buf = readFileSync(path)
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path} is not a PNG`)
  let off = 8
  let width = 0
  let height = 0
  let depth = 0
  let type = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const tag = buf.toString('ascii', off + 4, off + 8)
    const body = buf.subarray(off + 8, off + 8 + len)
    if (tag === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      depth = body[8]
      type = body[9]
      if (depth !== 8 || (type !== 2 && type !== 6) || body[12] !== 0)
        throw new Error(`${path}: only 8-bit RGB or RGBA, uninterlaced`)
    } else if (tag === 'IDAT') idat.push(body)
    else if (tag === 'IEND') break
    off += 12 + len
  }
  const ch = type === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const rgb = Buffer.alloc(width * height * 3)
  const grey = new Float64Array(width * height)
  const stride = width * ch
  const line = Buffer.alloc(stride)
  const prev = Buffer.alloc(stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]
    raw.copy(line, 0, p, p + stride)
    p += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0
      const b = prev[i]
      const c = i >= ch ? prev[i - ch] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - b)
        const pc = Math.abs(pp - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      line[i] = v & 255
    }
    for (let x = 0; x < width; x++) {
      const s = x * ch
      const d = (y * width + x) * 3
      rgb[d] = line[s]
      rgb[d + 1] = line[s + 1]
      rgb[d + 2] = line[s + 2]
      grey[y * width + x] = (line[s] + line[s + 1] + line[s + 2]) / 3
    }
    line.copy(prev)
  }
  return { width, height, rgb, grey }
}

function encodePNG(rgb, width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
  }
  const chunk = (tag, body) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(body.length)
    const t = Buffer.from(tag, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([t, body])) >>> 0)
    return Buffer.concat([len, t, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c
}
