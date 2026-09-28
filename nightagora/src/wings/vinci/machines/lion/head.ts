/** THE LION'S HEAD AND TAIL: the face, the mane and the tail as distance
 * functions in the lion's rest frame (frame and material ids: sdf.ts), and
 * the face's painted features.
 *
 * Each part's GLSL here is compiled after SDF_LIB and COMMON (sdf.ts), so it
 * may read the body's interface there and nothing else of the body: the neck
 * under the mane `neck(p)` inside `torsoSolid(p)`, the mane's end line over
 * the shoulders `maneEnd(p)` (MANE_END), the chest's room `chestSpace(p)`,
 * the tail's root T0. The face and the mane are one head: the mane lies on
 * the face's own masses and grows from the face's rim.
 */
import { Color } from 'three/webgpu'
import { clamp, float, mix, smoothstep, vec2, vec3 } from 'three/tsl'
import type { CarvedSpec } from './sdf'

const f = (x: number): string => {
  const s = x.toFixed(4)
  return s.includes('.') ? s : `${s}.0`
}
const v3 = (a: readonly number[]): string => `vec3(${a.map(f).join(', ')})`
const v4 = (a: readonly number[]): string => `vec4(${a.map(f).join(', ')})`

/** The face's own frame, mirrored in x and carried nose down by `pitch`,
 * and what its paint picks out, all in metres of that frame: the eye (its
 * almond's half width and half height, turned out and tipped) with the iris
 * the pupil's cup is drilled at, and the nose's leather, a trapezoid whose
 * front faces forward and down. The carving is drawn at `scale` about `at`. */
export const FACE = {
  at: [0.0, 1.11, 0.835],
  scale: 1.08,
  eye: [0.0799, 0.0194, 0.095],
  pitch: 0.2,
  eyeYaw: 0.5, eyeTilt: -0.24, eyeW: 0.0238, eyeH: 0.0113,
  iris: { at: [-0.0015, 0.0005], r: 0.0092 },
  pupilR: 0.0034,
  leather: { at: [0.0, -0.0432, 0.2894], tilt: 0.3, top: 0.0537, bottom: 0.0245, half: 0.0238, front: 0.0216 },
} as const

const HS = FACE.scale
const u3 = (a: readonly number[]): string => v3(a.map(x => x / HS))
const unit = (a: readonly number[]): number[] => { const l = Math.hypot(...a); return a.map(x => x / l) }
const n3 = (a: readonly number[]): string => v3(unit(a))

/** The head's big masses in the face's frame before its scale: the skull cut
 * flat across the forehead, the cheeks cut in broad facets, the jaw's back,
 * and the lower jaw with its small flat chin. The mane lies on these. */
const MASS = {
  skull: { c: [0, 0.03, -0.01], r: [0.13, 0.078, 0.14] },
  stop: [0, 0.05, 0.108], forehead: unit([0, 0.743, 0.669]),
  cheek: { c: [0.092, -0.012, 0.05], r: [0.056, 0.05, 0.08], at: [0.132, 0, 0.05], n: unit([0.8, 0.5, 0.33]) },
  lowCheek: { c: [0.078, -0.08, 0.05], r: [0.052, 0.066, 0.1], at: [0.12, -0.09, 0.06], n: unit([0.85, -0.45, 0.28]) },
  jawBack: { c: [0, -0.12, -0.02], r: [0.1, 0.085, 0.11] },
  // (the chin about half the muzzle's width and 3 cm behind the pads' front;
  // its sides and underside, which the mane lies on behind the face, as before)
  chin: {
    front: { at: [0, -0.18, 0.24], n: unit([0, -0.15, 1]) }, side: { at: [0.042, 0, 0.25], n: unit([0.97, 0, 0.245]) },
    under: { at: [0, -0.205, 0.2], n: unit([0, -0.98, 0.199]) }, top: -0.125, back: -0.06, round: 0.045,
  },
} as const
/** The lower face in the face's frame before its scale: the two whisker pads'
 * front (their crown, how it falls across and leans back toward the lip), the
 * cleft between them, the lip's edge (an inverted Y: the notch under the
 * cleft, lowest along each pad, rising along the sides to the mouth's corner)
 * and the mouth's line under it. The paint reads the same numbers. */
export const MUZZLE = {
  // (across: the fall toward the cleft; rs: the round shoulder's radius in plan,
  // least at the pad's top and fullest at rsAt, so each pad rolls round into the side)
  pad: { x: 0.036, y: -0.112, z: 0.281, across: 3.0, rs: [0.03, 0.047], rsAt: -0.128, down: 4.0, lean: 0.15 },
  // (w: the valley's width scale; its shoulders about 1.5 w out from the midline)
  cleft: { w: 0.0075, top: 0.003, bottom: 0.007 },
  lip: { notch: -0.143, low: -0.165, lowX: 0.05, side: 0.015, sideX: [0.055, 0.092], rise: 0.012, riseZ: [0.19, 0.12] },
  // the mouth's line behind the pad: where its trough begins, reaches its
  // depth, and where it has faded out (over `fade`), under the pad's back
  corner: { from: 0.19, full: 0.165, at: 0.115, depth: 0.0045, fade: 0.03 },
} as const
/** the ear's centre in the face's frame before its scale; the ruff leaves room round it */
const EAR_AT = [0.11, 0.066, -0.042] as const
/** the lower lid's edge, as a share of the eye's half height below its middle */
const EYE_LOW = { at: 0.62, bend: 0.55 }

/* THE FACE, carved as its own part on a finer grid, in planes as a carver
 * roughs a block: a flat forehead falling to a brow that overhangs small deep
 * eyes, a long flat bridge with a stop at the brow, the nose's leather, a
 * square muzzle whose front is two whisker pads over the lip's inverted Y, a
 * small rounded chin set back under the lip, broad faceted cheeks running
 * back into the ruff.
 * Numbers are in the face's frame before its scale. */
export const FACE_FN = /* glsl */ `
const vec3 F = ${v3(FACE.at)};
const float HS = ${f(HS)};
const vec3 E = ${u3(FACE.eye)};
const float EW = ${f(FACE.eyeW / HS)}, EH = ${f(FACE.eyeH / HS)};
// the stop between the brows and the forehead's plane through it
const vec3 ST = ${v3(MASS.stop)};
const vec3 NF = ${v3(MASS.forehead)};
// a horizontal almond: half width b, half height hh, negative inside
float almond(vec2 p, float b, float hh) {
  float r = 0.5 * (b * b / hh + hh), d = r - hh;
  p = abs(p);
  return ((p.x - b) * d > p.y * b) ? length(p - vec2(b, 0.0)) : length(p - vec2(0.0, -d)) - r;
}
// the face's frame of a point: mirrored, nose down, before the scale
vec3 faceQ(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z) - F;
  q.yz = rot(${f(-FACE.pitch)}) * q.yz;
  return q / HS;
}
// the eye's own frame: x along the almond, z out of the face, turned out and tipped
vec3 eyeFrame(vec3 q) {
  vec3 e = q - E;
  e.xz = rot(${f(FACE.eyeYaw)}) * e.xz;
  e.xy = rot(${f(FACE.eyeTilt)}) * e.xy;
  return e;
}
// a plane through a with unit normal n: negative behind it
float pln(vec3 q, vec3 a, vec3 n) { return dot(q - a, n); }
// the head's big masses, which the mane lies on as well
float faceMass(vec3 q) {
  float d = sdEllipsoid(q - ${v3(MASS.skull.c)}, ${v3(MASS.skull.r)});
  d = smax(d, pln(q, ST, NF), 0.03);
  float ck = smax(sdEllipsoid(q - ${v3(MASS.cheek.c)}, ${v3(MASS.cheek.r)}), pln(q, ${v3(MASS.cheek.at)}, ${v3(MASS.cheek.n)}), 0.025);
  float lc = smax(sdEllipsoid(q - ${v3(MASS.lowCheek.c)}, ${v3(MASS.lowCheek.r)}), pln(q, ${v3(MASS.lowCheek.at)}, ${v3(MASS.lowCheek.n)}), 0.025);
  d = smin(d, ck, 0.03);
  d = smin(d, lc, 0.035);
  d = smin(d, sdEllipsoid(q - ${v3(MASS.jawBack.c)}, ${v3(MASS.jawBack.r)}), 0.04);
  // the lower jaw set back under the lip, the chin a small flat block
  // (the chin's front rounded off into its sides and underside, a knob and not
  // a block; the jaw's edge behind it, where the mane lies, as before)
  float jw = smax(pln(q, ${v3(MASS.chin.side.at)}, ${v3(MASS.chin.side.n)}), pln(q, ${v3(MASS.chin.under.at)}, ${v3(MASS.chin.under.n)}), mix(0.016, ${f(MASS.chin.round)}, smoothstep(0.17, 0.23, q.z)));
  jw = smax(jw, pln(q, ${v3(MASS.chin.front.at)}, ${v3(MASS.chin.front.n)}), ${f(MASS.chin.round)});
  jw = smax(jw, q.y - ${f(MASS.chin.top)}, 0.02);
  // (its back rounds off into the jaw's back, so the mane over it has no flat end)
  jw = smax(jw, ${f(MASS.chin.back)} - q.z, 0.05);
  return smin(d, jw, 0.016);
}
float face(vec3 p) {
  vec3 q = faceQ(p);
  float d = faceMass(q);
  // THE BRIDGE: long and flat on its back from the stop to the nose, its
  // sides falling steeply to the muzzle
  vec3 bq = q - ST;
  const vec3 AXB = ${n3([0, -0.068, 0.168])};
  const vec3 UPB = ${n3([0, 0.168, 0.068])};
  float bt = dot(bq, AXB), yb = dot(bq, UPB);
  float bhw = mix(0.031, 0.025, clamp(bt / 0.1812, 0.0, 1.0));
  float br = smax(yb, 0.883 * (q.x - bhw) + 0.469 * yb, 0.012);
  br = smax(br, max(-0.03 - bt, bt - 0.186), 0.012);
  br = smax(br, -0.1 - yb, 0.02);
  d = smin(d, br, 0.018);
  // the upper jaw under the bridge's sides, down to the pads
  d = smin(d, sdEllipsoid(q - vec3(0.042, -0.048, 0.185), vec3(0.05, 0.05, 0.095)), 0.03);
  // THE MUZZLE: two whisker pads parted by a cleft under the nose, each
  // swelling forward at its middle and rolling round into the side over a
  // round shoulder, wider toward the lip
  float mz = sdRoundBox(q - vec3(0.0, -0.108, 0.19), vec3(0.092, 0.058, 0.095), 0.02);
  mz = smax(mz, pln(q, vec3(0.094, -0.12, 0.2), ${n3([1, 0.2, 0])}), 0.018);
  float px = q.x - ${f(MUZZLE.pad.x)}, py = q.y - ${f(MUZZLE.pad.y)};
  // the pad's crown line: leaning back toward the lip, fullest at its middle
  float zc = ${f(MUZZLE.pad.z)} + ${f(MUZZLE.pad.lean)} * py - ${f(MUZZLE.pad.down)} * py * py;
  float gy = ${f(MUZZLE.pad.lean)} - ${f(2 * MUZZLE.pad.down)} * py;
  float dp;
  if (px > 0.0) {
    // outward a quarter circle of radius rs in plan, then the side straight back;
    // rs swells toward the pad's lower middle, so from the front each pad's
    // outline is round, not a straight side
    float rb = (q.y - ${f(MUZZLE.pad.rsAt)}) / (q.y > ${f(MUZZLE.pad.rsAt)} ? 0.06 : 0.04);
    float rs = mix(${f(MUZZLE.pad.rs[0])}, ${f(MUZZLE.pad.rs[1])}, max(1.0 - rb * rb, 0.0));
    float zo = q.z - zc + rs;
    dp = zo > 0.0 ? length(vec2(px, zo)) - rs : px - rs;
  } else {
    // toward the midline a gentle fall into the cleft: one rounded valley,
    // deepening from the nose to the lip (a bell-shaped section, so its
    // shoulders are as soft as its floor)
    float cd = mix(${f(MUZZLE.cleft.top)}, ${f(MUZZLE.cleft.bottom)}, smoothstep(-0.07, ${f(MUZZLE.lip.notch)}, q.y));
    float cg = exp(-q.x * q.x * ${f(1 / MUZZLE.cleft.w ** 2)});
    float gx = -${f(2 * MUZZLE.pad.across)} * px + cd * cg * ${f(2 / MUZZLE.cleft.w ** 2)} * q.x;
    dp = (q.z - zc + ${f(MUZZLE.pad.across)} * px * px + cd * cg) / sqrt(1.0 + gx * gx);
  }
  mz = smax(mz, dp / sqrt(1.0 + gy * gy), 0.012);
  // the lip's edge, an inverted Y: high at the notch under the cleft, lowest
  // along each pad, rising along the sides to the mouth's corner; its edge
  // crisp at the notch and rolled round under each pad and its outer corner
  float lu = min(q.x / ${f(MUZZLE.lip.lowX)}, 1.0);
  float ly = ${f(MUZZLE.lip.notch)} + ${f(MUZZLE.lip.low - MUZZLE.lip.notch)} * (1.0 - (1.0 - lu) * (1.0 - lu))
    + ${f(MUZZLE.lip.side)} * smoothstep(${f(MUZZLE.lip.sideX[0])}, ${f(MUZZLE.lip.sideX[1])}, q.x)
    + ${f(MUZZLE.lip.rise)} * smoothstep(${f(MUZZLE.lip.riseZ[0])}, ${f(MUZZLE.lip.riseZ[1])}, q.z);
  float lg = q.x < ${f(MUZZLE.lip.lowX)} ? ${f(2 * (MUZZLE.lip.low - MUZZLE.lip.notch) / MUZZLE.lip.lowX)} * (1.0 - lu) : 0.0;
  mz = smax(mz, (ly - q.y) / sqrt(1.0 + lg * lg), mix(mix(0.007, 0.018, smoothstep(0.008, 0.03, q.x)), 0.014, smoothstep(0.07, 0.088, q.x)));
  // (blended wide into the cheeks, so the muzzle grows from the face, and
  // tight under the lip, so the mouth's overhang keeps its shadow)
  d = smin(d, mz, mix(0.024, 0.012, smoothstep(-0.13, -0.15, q.y) * smoothstep(0.16, 0.21, q.z)));
  // THE BROWS: a heavy ridge over each eye, merging into the forehead above;
  // the socket below cuts it flat underneath
  // (apart at the stop and barely proud of the forehead there, so the
  // profile runs on from the bridge without a hook; their inner ends high
  // and wide apart, so the face reads calm and watchful, not a frown)
  vec2 bw = sdBezier(q, vec3(0.047, 0.049, 0.11), vec3(0.082, 0.063, 0.123), vec3(0.124, 0.034, 0.07)).xy;
  d = smin(d, bw.x - mix(0.011, 0.0095, bw.y), 0.03);
  // THE NOSE: the leather, wide at its top and drawn in to the groove,
  // tipped forward and down, its nostrils curling up at the lower corners
  vec3 n0 = q - ${u3(FACE.leather.at)};
  n0.yz = rot(${f(-FACE.leather.tilt)}) * n0.yz;
  vec3 n = n0;
  n.x /= 0.42 + 12.5 * clamp(n.y + 0.02, 0.0, 0.04);
  d = smin(d, sdRoundBox(n, vec3(0.054, 0.022, 0.02), 0.008), 0.01);
  // (each nostril a comma: round at its inner end, curling up and out to a slit)
  vec2 nb = sdBezier(n0, vec3(0.009, -0.016, 0.023), vec3(0.023, -0.017, 0.021), vec3(0.028, 0.003, 0.013)).xy;
  d = smax(d, -max(nb.x - mix(0.005, 0.0018, nb.y), -(d + 0.009)), 0.003);
  // the mouth's line: under the pads the lip's own overhang, then along the
  // lip's edge a little up and back to where the pad ends, a shallow trough
  // under the lip's overhang that fades out softly there, never a slot
  // (a smooth profile pressed into the surface, so no edge of it is sharp)
  float bd = ${f(MUZZLE.corner.depth)} * smoothstep(${f(MUZZLE.corner.from)}, ${f(MUZZLE.corner.full)}, q.z)
    * smoothstep(${f(MUZZLE.corner.at)}, ${f(MUZZLE.corner.at + MUZZLE.corner.fade)}, q.z) * smoothstep(0.05, 0.065, q.x);
  float by = q.y - ly, bu = by > 0.0 ? by / 0.006 : -by / 0.012;
  d += bu < 1.0 ? bd * (1.0 - bu * bu) * (1.0 - bu * bu) : 0.0;
  // THE EYES, small and deep: the socket cut flat under the brow, the ball,
  // the upper lid's fold
  vec3 e = eyeFrame(q);
  float outline = almond(e.xy, EW, EH);
  float sock = smax(almond(e.xy - vec2(0.0, 0.002), EW + 0.005, EH + 0.005) - 0.003, e.y - EH - 0.006, 0.004);
  // (the cuts' own floors meet their walls rounded, so no crease at the corners)
  d = smax(d, -smax(sock, -e.z - 0.017, 0.004), 0.007);
  d = smax(d, -smax(outline - 0.004, -e.z - 0.02, 0.003), 0.006);
  // (the ball fills its opening to the rim, so it never sits loose in a slot)
  float ball = length(e - vec3(0.0, 0.0, -0.018)) - 0.02;
  d = smin(d, smax(ball, max(outline - 0.007, e.y - EH - 0.002), 0.003), 0.004);
  // the upper lid, a fold with a rounded edge over the ball's top, high enough
  // that the eye reads open and watchful
  float lidY = EH * (0.55 - 0.5 * (e.x / EW) * (e.x / EW));
  float lid = smax(smax(length(e - vec3(0.0, 0.0, -0.018)) - 0.0245, lidY - e.y, 0.004), outline - 0.002, 0.002);
  d = smin(d, lid, 0.005);
  // and a small lower lid, a low fold along the ball's lower edge
  float lowY = -EH * (${f(EYE_LOW.at)} - ${f(EYE_LOW.bend)} * (e.x / EW) * (e.x / EW));
  float lidL = smax(smax(length(e - vec3(0.0, 0.0, -0.018)) - 0.0228, e.y - lowY, 0.004), outline - 0.002, 0.002);
  d = smin(d, lidL, 0.004);
  // THE EARS: low rounded shells, broader than tall and laid back, half sunk
  // in the ruff (the mane rises close round them), their hollow shallow
  vec3 ea = q - ${v3(EAR_AT)};
  ea.xz = rot(-0.35) * ea.xz;
  ea.yz = rot(0.42) * ea.yz;
  float ear = sdEllipsoid(ea, vec3(0.028, 0.021, 0.011));
  ear = smax(ear, -sdEllipsoid(ea - vec3(0.0, -0.003, 0.01), vec3(0.02, 0.014, 0.008)), 0.003);
  d = smin(d, ear, 0.012);
  return d * HS;
}
`

/** THE CARVED LOCK, one function with a shape argument, shared by the mane
 * and (for the breast) the doors. In its own frame: l.x along its flow from
 * the root (0) to the tip (len), l.y across, l.z the height above the ground
 * it lies on. kind 0 a blunt flame, 1 an S-curl whose tip hooks back, 2 a
 * broad flat lock; curl bends it sideways (-1..1), hw its half width, th its
 * half thickness, lift how far its tip stands off the ground. Its section is a
 * rounded ridge with steep sides, every edge rounded 6 mm and every tip at
 * least 9 mm wide, so no edge is thinner than two cells of the film's grid;
 * gouges run along its back.
 * Guarded, so a part may include it twice. Needs sd2Bezier and smax. */
export const LOCK_SHAPES = /* glsl */ `
#ifndef LION_LOCK_SHAPES
#define LION_LOCK_SHAPES
// distance to a quadratic arc in the plane, its parameter, and the side p is on
vec3 lkArc(vec2 p, vec2 A, vec2 B, vec2 C) {
  vec2 b = sd2Bezier(p, A, B, C);
  float t = b.y;
  vec2 c = mix(mix(A, B, t), mix(B, C, t), t), tg = mix(B - A, C - B, t);
  return vec3(b.x, t, tg.x * (p.y - c.y) - tg.y * (p.x - c.x) < 0.0 ? -1.0 : 1.0);
}
// tip 0 the doors' and the tuft's locks; tip 1 the mane's, whose ends stay
// broad and low, so a lifted end reads as a lock's end and not a horn
float lockShapeT(vec3 l, float len, float hw, float th, float curl, float lift, float kind, float tip) {
  float sw = curl * len;
  vec3 a;
  if (kind < 0.5) {
    a = lkArc(l.xy, vec2(0.0), vec2(0.5 * len, 0.14 * sw), vec2(len, -0.05 * sw));
  } else if (kind < 1.5) {
    vec3 a1 = lkArc(l.xy, vec2(0.0), vec2(0.4 * len, 0.2 * sw), vec2(0.7 * len, 0.14 * sw));
    vec3 a2 = lkArc(l.xy, vec2(0.7 * len, 0.14 * sw), vec2(0.97 * len, 0.08 * sw), vec2(0.9 * len, -0.16 * sw));
    // (on the mane the hook is wider than its curl, so inside the curl two points
    // of the arc lie nearest at once and the nearest's parameter jumps, a step
    // in the lock's height; there the parameter is a soft nearest over the arc)
    if (tip > 0.5) {
      float ws = 0.0, ts = 0.0;
      for (int i = 0; i <= 16; i++) {
        float u = float(i) / 16.0;
        vec2 q = mix(mix(vec2(0.7 * len, 0.14 * sw), vec2(0.97 * len, 0.08 * sw), u), mix(vec2(0.97 * len, 0.08 * sw), vec2(0.9 * len, -0.16 * sw), u), u);
        float e = exp((a2.x - length(l.xy - q)) / 0.004);
        ws += e; ts += e * u;
      }
      a2.y = ts / ws;
    }
    // (the two arcs hand over in a narrow band, so the field has no step there)
    float k = smoothstep(-0.004, 0.004, a2.x - a1.x);
    a = vec3(min(a1.x, a2.x), mix(0.7 + 0.3 * a2.y, 0.7 * a1.y, k), k > 0.5 ? a1.z : a2.z);
  } else {
    a = lkArc(l.xy, vec2(0.0), vec2(0.5 * len, 0.05 * sw), vec2(len, 0.0));
  }
  float t = a.y;
  // its width: full a quarter of the way along, then drawn in to a blunt tip
  float rise = 0.7 + 0.3 * sin(min(t / 0.26, 1.0) * 1.5708);
  float fall = kind < 1.5 ? 1.0 - mix(mix(0.84, 0.62, tip), 0.5, kind) * pow(max(t - 0.26, 0.0) / 0.74, 1.2)
                          : 1.0 - 0.36 * pow(max(t - 0.2, 0.0) / 0.8, 2.0);
  float w = max(hw * rise * fall, 0.009);
  float across = a.z * a.x, ac = clamp(across / w, -1.0, 1.0);
  // its height: flush with the ground for its first fifth, where the row before
  // lies over it, full from half way, a rounded ridge across with steep sides;
  // the tip lifts off the ground and throws its own shadow, while the rest of
  // its underside is sunk in the ground
  float lf = lift * pow(smoothstep(0.3, 1.0, t), 1.5);
  if (kind > 0.5 && kind < 1.5) lf += 0.5 * lift * smoothstep(0.8, 1.0, t);
  float ridge = th * (0.15 + 1.85 * smoothstep(0.18, 0.55, t)) * (1.0 - mix(0.45, 0.65, tip) * smoothstep(0.62, 1.0, t));
  // (a tip never thinner than five cells of the film's grid, four on the thin
  // locks that lie flat on the crown)
  ridge = max(ridge, max(0.5 * th, min(0.012, 1.2 * th)) * smoothstep(0.3, 0.6, t));
  float top = ridge * (0.55 + 0.45 * (1.0 - ac * ac)) + lf;
  // (a tip either lies on the ground or stands a clear 8 mm off it: no thin
  // wedge of air under it; on the mane a tip whose end would stand under 8 mm
  // lies down with its underside sunk, so its rounded edge meets the ground
  // steeply, and one that stands clear opens its gap within a short cove)
  float bot0 = -0.5 * th + 0.4 * th * smoothstep(0.55, 1.0, t);
  float bot = bot0 + lf * smoothstep(0.55, 1.0, t);
  if (tip > 0.5) {
    const float TIP_CLEAR = 0.008;
    float lfEnd = lift * (kind > 0.5 && kind < 1.5 ? 1.5 : 1.0);
    bot = lfEnd - 0.1 * th < TIP_CLEAR ? -0.5 * th : mix(bot0, bot, smoothstep(0.4 * TIP_CLEAR, TIP_CLEAR, bot));
  }
  const float re = 0.006;
  vec2 e = vec2(a.x - w + re, max(l.z - top, bot - l.z) + re);
  float d = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - re;
  // gouges along its back, the strands: two on a flame or a curl, three on a broad lock
  // (they run out where the lock narrows, so no fin between two is thinner than two cells)
  // (the mane's are chisel cuts, about 3 mm deep and 9 mm wide, three on a
  // broad lock; the doors' and the tuft's stay broad soft strands)
  float gr = mix(clamp(0.24 * w, 0.006, 0.014), 0.005, tip);
  // (shallower on the thin locks that lie flat on the crown, so the crown
  // reads as hair lying back, not a comb)
  float gd = mix(0.22 * ridge, 0.003 * clamp(th / 0.012, 0.35, 1.0), tip) * smoothstep(0.25, 0.42, t) * (1.0 - smoothstep(0.72, 0.9, t)) * smoothstep(mix(0.022, 0.014, tip), mix(0.034, 0.022, tip), w);
  // (the blend shrinks with the depth, so a gouge runs out without a step)
  float gk = mix(0.01, 0.004, tip) * smoothstep(0.0, mix(0.003, 0.0015, tip), gd);
  bool three = kind > 1.5 || (tip > 0.5 && hw > 0.04);
  for (int j = 0; j < 3; j++) {
    if (!three && j == 2) break;
    float u = three ? 0.46 * (float(j) - 1.0) : (j == 0 ? -0.36 : 0.32);
    float gz = ridge * (0.55 + 0.45 * (1.0 - u * u)) + lf;
    d = smax(d, -(length(vec2(across - u * w, l.z - (gz + gr - gd))) - gr), gk);
  }
  return d;
}
float lockShape(vec3 l, float len, float hw, float th, float curl, float lift, float kind) {
  return lockShapeT(l, len, hw, th, curl, lift, kind, 0.0);
}
#endif
`

// ---- THE MANE'S LAYOUT, made once when the module loads: each lock's root on
// the mane's ground, its flow, size and shape. The same masses as the GLSL,
// in numbers (the torso's a twin of the body's at the setup commit).
type V3 = [number, number, number]
const va = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const vs = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const vk = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const vd = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const vl = (a: V3): number => Math.hypot(a[0], a[1], a[2])
const vn = (a: V3): V3 => vk(a, 1 / (vl(a) || 1))
const vx = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const lerp3 = (a: V3, b: V3, t: number): V3 => va(a, vk(vs(b, a), t))
const smoothJ = (e0: number, e1: number, x: number): number => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t) }
const sminJ = (a: number, b: number, k: number): number => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25 }
const smaxJ = (a: number, b: number, k: number): number => -sminJ(-a, -b, k)
const ellJ = (p: V3, r: readonly number[]): number => {
  const k0 = Math.hypot(p[0] / r[0]!, p[1] / r[1]!, p[2] / r[2]!), k1 = Math.hypot(p[0] / r[0]! ** 2, p[1] / r[1]! ** 2, p[2] / r[2]! ** 2)
  return k0 * (k0 - 1) / Math.max(k1, 1e-6)
}
const plnJ = (q: V3, a: readonly number[], n: readonly number[]): number => vd(vs(q, a as V3), n as V3)
const capJ = (p: V3, a: V3, b: V3, r: number): number => {
  const pa = vs(p, a), ba = vs(b, a), h = Math.min(1, Math.max(0, vd(pa, ba) / vd(ba, ba)))
  return vl(vs(pa, vk(ba, h))) - r
}
const CP = Math.cos(FACE.pitch), SP = Math.sin(FACE.pitch)
/** rest -> the face's frame before its scale, x mirrored */
const faceQJ = (p: V3): V3 => {
  const x = Math.abs(p[0]) - FACE.at[0], y = p[1] - FACE.at[1], z = p[2] - FACE.at[2]
  return [x / HS, (CP * y + SP * z) / HS, (-SP * y + CP * z) / HS]
}
/** the face's frame before its scale -> rest, on the side sgn */
const restJ = (q: V3, sgn: number): V3 => {
  const y = q[1] * HS, z = q[2] * HS
  return [sgn * q[0] * HS + FACE.at[0], FACE.at[1] + CP * y - SP * z, FACE.at[2] + SP * y + CP * z]
}
const sub3 = (a: readonly number[], b: readonly number[]): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
function faceMassJ(q: V3): number {
  let d = smaxJ(ellJ(sub3(q, MASS.skull.c), MASS.skull.r), plnJ(q, MASS.stop, MASS.forehead), 0.03)
  const ck = smaxJ(ellJ(sub3(q, MASS.cheek.c), MASS.cheek.r), plnJ(q, MASS.cheek.at, MASS.cheek.n), 0.025)
  const lc = smaxJ(ellJ(sub3(q, MASS.lowCheek.c), MASS.lowCheek.r), plnJ(q, MASS.lowCheek.at, MASS.lowCheek.n), 0.025)
  d = sminJ(sminJ(d, ck, 0.03), lc, 0.035)
  d = sminJ(d, ellJ(sub3(q, MASS.jawBack.c), MASS.jawBack.r), 0.04)
  const C = MASS.chin
  let jw = smaxJ(plnJ(q, C.side.at, C.side.n), plnJ(q, C.under.at, C.under.n), 0.016 + (C.round - 0.016) * smoothJ(0.17, 0.23, q[2]))
  jw = smaxJ(jw, plnJ(q, C.front.at, C.front.n), C.round)
  jw = smaxJ(jw, q[1] - C.top, 0.02)
  jw = smaxJ(jw, C.back - q[2], 0.05)
  return sminJ(d, jw, 0.016)
}
// THE BODY AS THE LAYOUT READS IT: twins of COMMON's torsoSolid, chestSpace,
// maneEnd and shoulderCap (sdf.ts), which this module cannot import (sdf.ts
// imports it); the drift check (tools r4/head/twin-drift.mjs) holds them equal
const TR_TOP = [0.9, 0.95, 0.99, 1.0, 0.994, 0.982, 0.974, 0.974, 0.994, 1.01, 1.025, 1.035, 1.03, 1.0, 0.95]
const TR_BOT = [0.76, 0.72, 0.69, 0.665, 0.605, 0.56, 0.522, 0.502, 0.485, 0.47, 0.456, 0.45, 0.456, 0.485, 0.53]
const TR_HW = [0.12, 0.15, 0.175, 0.186, 0.195, 0.2, 0.21, 0.215, 0.215, 0.205, 0.19, 0.188, 0.182, 0.165, 0.13]
const BODY = {
  SH: [0.215, 0.8, 0.33] as V3, HP: [0.2, 0.8, -0.45] as V3,
  FP: { R: 0.118, skin: 0.19, boss: 0.13, inner: 0.1785 }, HQ: { skin: 0.19, boss: 0.137 },
  HINGE: [0.149, 0.66, 0.538] as V3, CAV_BACK: 0.28,
  MANE_END: { z: 0.24, y: 1.05, fall: 1.45 }, CAP: { top: 0.226, rim: 0.2, clear: 0.006 },
} as const
function trStationJ(A: number[], z: number): number {
  const u = Math.min(Math.max((z + 0.75) / 0.1, 0), 13.999), i = Math.floor(u), t = u - i
  const a = A[Math.max(i - 1, 0)]!, b = A[i]!, c = A[Math.min(i + 1, 14)]!, d = A[Math.min(i + 2, 14)]!
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t)
}
function trunkJ(p: V3): number {
  const z = Math.min(Math.max(p[2], -0.6), 0.5)
  const top = trStationJ(TR_TOP, z), bot = trStationJ(TR_BOT, z), hw = trStationJ(TR_HW, z)
  const yc = 0.5 * (top + bot), b = 0.5 * (top - bot), y = p[1] - yc
  const ch = smoothJ(0.05, 0.25, z) * (1 - smoothJ(0.4, 0.5, z))
  const a = hw * (1 - (0.2 + 0.24 * ch) * smoothJ(0, -1, (y - 0.1 * ch) / b)), n = y > 0 ? 3.8 : 2.0
  const ux = Math.abs(p[0] / a) + 1e-5, uy = Math.abs(y / b) + 1e-5
  const N = Math.pow(ux ** n + uy ** n, 1 / n)
  const g = Math.hypot(ux ** (n - 1) * N ** (1 - n) / a, uy ** (n - 1) * N ** (1 - n) / b)
  const dd = (N - 1) / Math.max(g, 1e-4), w = Math.max(-0.6 - p[2], p[2] - 0.5)
  return Math.min(Math.max(dd, w), 0) + Math.hypot(Math.max(dd, 0), Math.max(w, 0))
}
const neckJ = (p: V3): number => capJ(p, [0, 0.9, 0.28], [0, 1.04, 0.54], 0.17)
const throatJ = (p: V3): number => roundConeJ(p, [0, 0.862, 0.56], [0, 0.905, 0.8], 0.076, 0.052)
function torsoJ(p: V3): number {
  let d = trunkJ(p)
  const bq = vs(p, [0, 0.66, 0.4])
  bq[0] /= lerp(0.7, 1.0, smoothJ(0.36, 0.52, p[2])) * (1 - 0.2 * smoothJ(0.535, 0.44, p[1]))
  const gv = smoothJ(0.46, 0.56, p[2]) * smoothJ(0.5, 0.6, p[1]) * (1 - smoothJ(0.74, 0.8, p[1]))
  d = sminJ(d, ellJ(bq, [0.178, 0.215, 0.225]) + 0.016 * gv * Math.exp(-p[0] * p[0] / 0.0012), 0.05)
  const rq = vs(p, [0, 0.85, -0.52]), ra: V3 = [Math.abs(rq[0]), rq[1], rq[2]]
  let pl = Math.max(ra[1] - 0.153, vd(ra, [0.6, 0.8, 0]) - 0.153)
  pl = Math.max(pl, Math.max(ra[0] - 0.163, vd(ra, [0.6, 0, -0.8]) - 0.181))
  pl = Math.max(pl, Math.max(-ra[2] - 0.191, vd(ra, [0, 0.6, -0.8]) - 0.177))
  d = sminJ(d, smaxJ(ellJ(rq, [0.17, 0.155, 0.2]), pl, 0.012), 0.08)
  d = sminJ(sminJ(d, neckJ(p), 0.09), throatJ(p), 0.05)
  const qx = Math.abs(p[0]), B = BODY
  d = lerp(d, qx - B.FP.skin, 1 - smoothJ(B.FP.boss, B.FP.boss + 0.08, Math.hypot(p[1] - B.SH[1], p[2] - B.SH[2])))
  return lerp(d, qx - B.HQ.skin, 1 - smoothJ(B.HQ.boss, B.HQ.boss + 0.14, Math.hypot(p[1] - B.HP[1], p[2] - B.HP[2])))
}
/** the chest's cavity and the doors' swing round their hinges, capped at y 0.795 */
function chestJ(p: V3): number {
  const qx = Math.abs(p[0]) - 0.152 + 0.06, qy = Math.abs(p[1] - 0.6575) - 0.1225 + 0.06
  const door = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 0.06
  const hx = Math.abs(p[0]) - BODY.HINGE[0], hz = p[2] - BODY.HINGE[2], hl = Math.hypot(hx, hz)
  let sweep = Math.min(Math.max(hl - 0.2, -hz - 0.03), hl - 0.06)
  sweep = Math.max(sweep, Math.max(p[1] - 0.795, 0.52 - p[1]))
  return Math.min(smaxJ(smaxJ(door, BODY.CAV_BACK - p[2], 0.02), p[2] - 0.62, 0.01), sweep)
}
/** the fore upper's dome over the shoulder's pin, grown by the mane's clearance */
function shoulderCapJ(p: V3): number {
  const { SH, FP, CAP } = BODY
  const capFace = (r: number): number => { const u = Math.min(Math.max(r / FP.R, 0), 1), w = 1 - u * u; return CAP.rim + (CAP.top - CAP.rim) * w * w }
  const x = Math.abs(p[0]), r = Math.hypot(p[1] - SH[1], p[2] - SH[2]), rc = Math.min(r, FP.R)
  const u = rc / FP.R, sl = 4 * (CAP.top - CAP.rim) * u * (1 - u * u) / FP.R
  const ex = r - FP.R, ey = Math.max((x - capFace(rc)) / Math.sqrt(1 + sl * sl), FP.inner - x)
  return Math.min(Math.max(ex, ey), 0) + Math.hypot(Math.max(ex, 0), Math.max(ey, 0)) - CAP.clear
}
/** the nape: the neck's mass from the skull's back into the body's neck,
 * under the mane only (the face's own part ends before it) */
const NAPE: [V3, V3] = [[0, 1.04, 0.74], [0, 0.98, 0.52]]
const NAPE_R = 0.14
/** what the mane lies on: the face's masses, the nape and the torso */
/** the throat under the jaw, running down and back to meet the breast above the doors */
const THROAT = { a: [0, 0.91, 0.9] as V3, b: [0, 0.8, 0.73] as V3, r1: 0.06, r2: 0.035 }
const roundConeJ = (p: V3, a: V3, b: V3, r1: number, r2: number): number => {
  const ba = vs(b, a), l2 = vd(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2
  const pa = vs(p, a), y = vd(pa, ba), z = y - l2
  const w = vs(vk(pa, l2), vk(ba, y)), x2 = vd(w, w), y2 = y * y * l2, z2 = z * z * l2
  const k = Math.sign(rr) * rr * rr * x2
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
}
// (and over the shoulder's dome, so the hood rises over it and keeps its 6 mm;
// blended in, so the ground has no crease where the dome leaves the body)
const underJ = (p: V3): number => sminJ(sminJ(sminJ(sminJ(faceMassJ(faceQJ(p)) * HS, capJ(p, NAPE[0], NAPE[1], NAPE_R), 0.05), roundConeJ(p, THROAT.a, THROAT.b, THROAT.r1, THROAT.r2), 0.05), torsoJ(p), 0.06), shoulderCapJ(p), 0.02)
/** a table of seven values every 30 degrees round from the crown (0) to the throat (180) */
const tableJ = (A: readonly number[], deg: number): number => {
  const a = Math.min(Math.max(deg / 30, 0), 5.999), i = Math.floor(a), t = a - i, s = t * t * (3 - 2 * t)
  return A[i]! + (A[i + 1]! - A[i]!) * s
}
const angJ = (q: V3): number => Math.atan2(q[0], q[1] + 0.05) * 180 / Math.PI
/** the rim where the mane begins, as its depth in the face's frame */
const RIM_Z = [0.07, 0.05, 0.008, -0.012, 0.03, 0.085, 0.11]
/** the mane's depth over what it lies on, round the face (the ruff) */
const RUFF_T = [0.004, 0.012, 0.07, 0.095, 0.09, 0.07, 0.05]
const maneEndJ = (p: V3): number => -(p[2] - BODY.MANE_END.z) * Math.sin(BODY.MANE_END.fall) - (p[1] - BODY.MANE_END.y) * Math.cos(BODY.MANE_END.fall)
/** how low the mane hangs: over the doors just above their swing (capped at
 * 0.795); on the sides above the arm's swept top before the shoulder's circle
 * (0.805 at z 0.46) and down over the dome inside it; under the jaw to the throat */
const LOW = { doors: 0.81, side: 0.82, dome: 0.69, throat: 0.74, domeIn: 0.088, domeOut: 0.106 }
/** the hood's hard ends: the ground stops this far inside the end and low
 * lines and reaches its full depth over these distances from them; above the
 * shoulder's dome the end thins out over endHigh, so the neck's end is no wall,
 * and over the breast the lower edge over lowFront, so it is no brim; over
 * the shoulder's dome over lowDome, so the hood ends there in a lip, not a slab */
const EDGE = { margin: 0.01, end: 0.04, low: 0.05, endHigh: 0.14, high: [0.9, 1.0] as const, lowFront: 0.12, lowDome: 0.1 }
/** the neck's depth behind the ruff: deep on its sides, less on its top,
 * where it falls to nothing over topFall before the withers; on the sides
 * it thins to sideEnd of itself over sideFall before the end, so the hood
 * ends in a lip over the shoulder, not a wall */
const NECK = { side: 0.07, top: 0.035, topFall: 0.12, sideEnd: 0.45, sideFall: 0.1 }
/** over the dome the hood's edge dips lowest over the pin and rises toward
 * the circle's front and back (by DOME_RISE at 10 cm), a round lobe, not a tab */
const DOME_RISE = 0.1
const maneLowJ = (p: V3): number => {
  const r = Math.hypot(p[1] - BODY.SH[1], p[2] - BODY.SH[2]), dz = (p[2] - BODY.SH[2]) / 0.1
  const side = lerp(LOW.side, LOW.dome + DOME_RISE * dz * dz, 1 - smoothJ(LOW.domeIn, LOW.domeOut, r)) - p[1]
  const front = lerp(LOW.doors, LOW.throat, smoothJ(0.68, 0.76, p[2]) * smoothJ(0.15, 0.09, Math.abs(p[0]))) - p[1]
  return lerp(side, front, smoothJ(0.4, 0.55, p[2]) * smoothJ(0.3, 0.16, Math.abs(p[0])))
}
/** the mane's depth: nothing at the rim, rising to the ruff round the face,
 * deep on the neck's sides and thin on its top, down to nothing at the end
 * line and at the lower edge, so no step and no shelf anywhere */
/** the rim's depth at a point of the face's frame: the table round the face,
 * fading to its mean near the axis, so the rim's surface has no cone point */
const rimZAtJ = (q: V3): number => lerp(0.04, tableJ(RIM_Z, angJ(q)), smoothJ(0.02, 0.06, Math.hypot(q[0], q[1] + 0.05)))
const EAR: V3 = [EAR_AT[0], EAR_AT[1], EAR_AT[2]]
function maneDepthJ(p: V3): number {
  const q = faceQJ(p), zone = (rimZAtJ(q) - q[2]) * HS
  const up = (p[1] - (0.9 + (p[2] - 0.28) * 0.5385)) / 0.17
  const ear = vl(vs(q, EAR)) * HS, me = maneEndJ(p) + EDGE.margin, low = maneLowJ(p) + EDGE.margin
  const neck = lerp(NECK.side * lerp(NECK.sideEnd, 1, smoothJ(0, NECK.sideFall, -me)), NECK.top * smoothJ(0, NECK.topFall, -me), smoothJ(0.3, 0.95, up))
  const T = lerp(tableJ(RUFF_T, angJ(q)), neck, smoothJ(-0.06, -0.3, q[2]))
  const edge = Math.min(zone, -me, -low)
  const endFade = lerp(EDGE.end, EDGE.endHigh, smoothJ(EDGE.high[0], EDGE.high[1], p[1]))
  const lowFade = lerp(lerp(EDGE.low, EDGE.lowFront, smoothJ(0.5, 0.62, p[2]) * smoothJ(0.2, 0.12, Math.abs(p[0]))), EDGE.lowDome, 1 - smoothJ(LOW.domeIn, LOW.domeOut, Math.hypot(p[1] - BODY.SH[1], p[2] - BODY.SH[2])))
  return T * smoothJ(0, 0.1, zone) * smoothJ(0, endFade, -me) * smoothJ(0, lowFade, -low) * smoothJ(0.026, 0.05, ear) - 0.004 * (1 - smoothJ(0, 0.03, edge))
}
const groundJ = (p: V3): number => underJ(p) - maneDepthJ(p)
const gradJ = (p: V3): V3 => {
  const e = 0.0008
  return vn([groundJ([p[0] + e, p[1], p[2]]) - groundJ([p[0] - e, p[1], p[2]]), groundJ([p[0], p[1] + e, p[2]]) - groundJ([p[0], p[1] - e, p[2]]), groundJ([p[0], p[1], p[2] + e]) - groundJ([p[0], p[1], p[2] - e])])
}
/** along a ray from inside, the outermost crossing of a surface */
function toSurfaceJ(from: V3, dir: V3, fn: (p: V3) => number): V3 {
  let last = -1
  for (let t = 0; t <= 0.6; t += 0.004) if (fn(va(from, vk(dir, t))) < 0) last = t
  if (last < 0) return from
  let a = last, b = last + 0.004
  for (let i = 0; i < 30; i++) { const m = 0.5 * (a + b); if (fn(va(from, vk(dir, m))) < 0) a = m; else b = m }
  return va(from, vk(dir, 0.5 * (a + b)))
}
/** where the mane ends: over the withers, down the end line behind the
 * shoulder's pin, over the dome, and across the breast above the doors (rest
 * frame, near side, every 30 degrees from the crown) */
const END_LOOP: V3[] = [[0, 1.08, 0.26], [0.1, 1.06, 0.255], [0.2, 1.0, 0.25], [0.24, 0.8, 0.27], [0.24, 0.77, 0.4], [0.14, 0.81, 0.57], [0, 0.81, 0.6]]
const endJ = (deg: number): V3 => {
  const a = Math.min(Math.max(deg / 30, 0), 5.999), i = Math.floor(a), t = a - i
  return lerp3(END_LOOP[i]!, END_LOOP[i + 1]!, t)
}
/** the neck's axis the rings wrap round, head to withers */
const AXIS: V3[] = [[0, 1.1, 0.86], [0, 1.02, 0.6], [0, 0.95, 0.42], [0, 0.9, 0.3]]
function axisPointJ(p: V3): V3 {
  let best: V3 = AXIS[0]!, bd = Infinity
  for (let i = 0; i + 1 < AXIS.length; i++) {
    const a = AXIS[i]!, b = AXIS[i + 1]!, ab = vs(b, a), t = Math.min(1, Math.max(0, vd(vs(p, a), ab) / vd(ab, ab)))
    const c = va(a, vk(ab, t)), dd = vl(vs(p, c))
    if (dd < bd) { bd = dd; best = c }
  }
  return best
}
/** a point carried out from the neck's axis onto the mane's ground */
const onGroundJ = (p: V3): V3 => { const c = axisPointJ(p); return toSurfaceJ(c, vn(vs(p, c)), groundJ) }
/** the rim's point at an angle, on the face's masses, in the rest frame */
function rimPointJ(deg: number, sgn: number): V3 {
  const r = deg * Math.PI / 180
  return restJ(toSurfaceJ([0, -0.05, tableJ(RIM_Z, deg)], [Math.sin(r), Math.cos(r), 0], faceMassJ), sgn)
}
/** A seeded draw, so the mane is the same on every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/** The seats the layout left empty, and why. */
export const MANE_EMPTY: { tier: number; side: number; deg: number; why: string }[] = []
export interface ManeLock { tier: number; side: number; deg: number; root: V3; flow: V3; across: V3; len: number; hw: number; th: number; lift: number; kind: number; curl: number }
/** four rows from the face's rim to the withers, the rows further apart as
 * the locks grow; each row's angles on the near side, from the crown (0) round
 * to the throat (180), a lock at 0 lying on the crown's line; each lock's size
 * follows its room: half its row's spacing wide, reaching over the next row's
 * roots, within the row's bounds */
const TIERS = [
  { mu: 0.0, degs: [6, 19, 58, 82, 106, 130], hw: [0.022, 0.034], len: [0.08, 0.11], lift: [0.006, 0.009], kinds: [0.5, 0.35] },
  { mu: 0.2, degs: [8, 46, 66, 87, 108, 129], hw: [0.032, 0.05], len: [0.12, 0.16], lift: [0.007, 0.011], kinds: [0.4, 0.35] },
  { mu: 0.42, degs: [0, 27, 54, 81, 108, 136], hw: [0.042, 0.062], len: [0.16, 0.21], lift: [0.008, 0.012], kinds: [0.35, 0.3] },
  { mu: 0.62, degs: [10, 32, 54, 76, 98, 120], hw: [0.045, 0.07], len: [0.18, 0.24], lift: [0.009, 0.013], kinds: [0.35, 0.2] },
] as const
const between = (r: () => number, lo: number, hi: number): number => lo + (hi - lo) * r()

function layMane(): ManeLock[] {
  const rand = [rng(911), rng(577)]
  type Seat = { k: number; sgn: number; deg: number; root: V3; next: V3; r: () => number }
  const seats: Seat[] = []
  const seat = (k: number, sgn: number, deg0: number, r: () => number): void => {
    const T = TIERS[k]!
    const deg = deg0 === 0 ? 0 : deg0 + between(r, -3, 3)
    const rim = rimPointJ(deg, sgn), end = endJ(deg)
    const endP = onGroundJ([sgn * end[0], end[1], end[2]])
    const at = (mu: number): V3 => (mu <= 0 ? rim : onGroundJ(lerp3(rim, endP, mu)))
    let root = at(T.mu)
    if (deg0 === 0) root = [0, root[1], root[2]]
    seats.push({ k, sgn: deg0 === 0 ? 0 : sgn, deg, root, next: k + 1 < TIERS.length ? at(TIERS[k + 1]!.mu) : endP, r })
  }
  TIERS.forEach((T, k) => {
    for (const sgn of [1, -1]) {
      const r = rand[sgn > 0 ? 0 : 1]!
      for (const deg0 of T.degs) if (deg0 !== 0 || sgn > 0) seat(k, sgn, deg0, r)
    }
  })
  // the throat's ruff under the jaw, on its own draw so the rest stays as it was
  const rt = rng(1601)
  for (const [k, deg0] of [[0, 160], [1, 157]] as const) for (const sgn of [1, -1]) seat(k, sgn, deg0, rt)
  const locks: ManeLock[] = []
  for (const s of seats) {
    const T = TIERS[s.k]!, r = s.r
    // the first row's locks start on the face itself, 2.5 cm before the rim,
    // flush with its skin, so the face has no edge where the mane begins
    let root = s.root
    if (s.k === 0) {
      let p = vs(root, vk(vn(vs(s.next, root)), 0.025))
      for (let i = 0; i < 3; i++) p = vs(p, vk(gradJ(p), groundJ(p)))
      root = p
    }
    // a lock whose root lies behind the mane's end is not carved at all
    if (maneEndJ(root) > -0.015) { MANE_EMPTY.push({ tier: s.k, side: s.sgn, deg: s.deg, why: 'behind the end' }); continue }
    // its room: the distance to its neighbours in the row, on its own side
    const row = seats.filter(o => o !== s && o.k === s.k && (o.sgn === s.sgn || o.sgn === 0 || s.sgn === 0))
    const near = row.map(o => vl(vs(o.root, root))).sort((a, b) => a - b)
    const room = near.length > 1 ? 0.5 * (near[0]! + near[1]!) : near[0] ?? 0.1
    const n = gradJ(root)
    // the flow: on toward the next row, down with the weight of the hair on
    // the sides; the crown's locks run straight back between the ears
    let flow = vs(s.next, root)
    if (s.k > 0 && s.deg < 100) flow = va(flow, vk([0, -1, 0], 0.025 * Math.sin(s.deg * Math.PI / 180)))
    if (s.k === 0 && s.deg < 30) flow = [0, flow[1], flow[2]]
    flow = vn(vs(flow, vk(n, vd(flow, n))))
    const across = vn(vx(n, flow))
    const gap = vl(vs(s.next, root))
    const u = r()
    // the crown's locks are flames: a curl there reads as a horn
    const kind = s.deg > 150 ? 2 : u < T.kinds[0] || (s.k === 0 && s.deg < 40) ? 0 : u < T.kinds[0] + T.kinds[1] ? 1 : 2
    let len = Math.min(Math.max(gap * (s.k === 3 ? 0.98 : 2.0), T.len[0]), T.len[1]) * between(r, 0.9, 1.06)
    let hw = Math.min(Math.max(0.4 * room, T.hw[0]), T.hw[1]) * between(r, 0.9, 1.1) * (kind === 2 ? 1.1 : 1) * (s.k === 0 && s.deg < 30 ? 1.05 : 1)
    // (an S-curl's hook turns down on the neck's sides, so it lies back like
    // hair and never stands up like a horn)
    let sign = r() < 0.5 ? -1 : 1
    if (kind === 1 && Math.abs(across[1]) > 0.3) sign = Math.sign(across[1])
    const curl = sign * (kind === 0 ? between(r, 0.3, 0.8) : kind === 1 ? between(r, 0.6, 1.0) : between(r, 0.1, 0.35))
    // thinner on the crown, where the mane lies flat
    const upR = (root[1] - (0.9 + (root[2] - 0.28) * 0.5385)) / 0.17
    let th = Math.min(Math.max(0.42 * hw, 0.011), 0.026) * (s.deg < 40 ? lerp(0.45, 1, s.deg / 40) : 1) * lerp(1, 0.45, smoothJ(0.5, 1, upR))
    // the crown's locks lie flat, so no tip stands above the head's outline
    // (flat, not a little lifted: a thin gap under a tip frays on the grid)
    let lift = between(r, T.lift[0], T.lift[1]) * (s.deg < 25 || s.deg > 150 ? 0 : 1)
    // shorten a lock, then narrow it (never cut it) until all of it keeps clear
    // of the chest's room and inside the rest box
    let bad: V3 = root, wide = false
    const clear = (L: number, W: number): boolean => {
      for (const f of [0.3, 0.6, 1]) for (const c of [-1, 0, 1]) {
        const a = va(va(root, vk(flow, L * f)), vk(across, c * W * (f < 1 ? 1 : 0.4)))
        // (the tip's lift grows along the lock as lockShapeT lifts it)
        const p = va(a, vk(n, 2 * th + 1.5 * lift * Math.pow(smoothJ(0.3, 1, f), 1.5)))
        wide = Math.abs(p[0]) > 0.316
        if (chestJ(p) < 0.02 || wide) { bad = p; return false }
        // (all of it over the hood's lower edge, so none hangs into the arm's swing)
        if (maneLowJ(a) > -(th + 0.004)) { bad = a; return false }
        // (its sunk underside clear of the doors' room, and over the shoulder's
        // dome only where the ground is deep enough to hold it, so neither
        // keep-out cuts a lock)
        if (chestJ(va(a, vk(n, -0.5 * th))) < 0.012) { bad = a; return false }
        if (Math.hypot(a[1] - BODY.SH[1], a[2] - BODY.SH[2]) < BODY.FP.R + 0.03 && maneDepthJ(a) < 0.5 * th + 0.004) { bad = a; return false }
        // (and its tip short of the end line and the lower edge, so neither cuts it)
        if (f === 1 && (maneEndJ(p) > -0.005 || maneLowJ(p) > -0.06)) { bad = p; return false }
      }
      return true
    }
    // and off the ear on its side
    const earAt = restJ(EAR, s.sgn || 1)
    const offEar = (L: number): boolean => {
      const e = vs(earAt, root), t = Math.min(Math.max(vd(e, flow) / L, 0), 1)
      return vl(vs(e, vk(flow, t * L))) > (s.k === 0 ? hw + 0.02 : 0.6 * hw + 0.025)
    }
    while (!offEar(len) && len > T.len[0] * 0.5) len *= 0.94
    if (!offEar(len)) { MANE_EMPTY.push({ tier: s.k, side: s.sgn, deg: s.deg, why: 'over the ear' }); continue }
    // (on the neck's widest, a lock's end lies down and the lock grows
    // flatter before it grows shorter)
    const th0 = th
    while (!clear(len, hw) && wide && (lift > 0.002 || th > th0 * 0.6)) { if (lift > 0.002) lift *= 0.8; else th *= 0.94 }
    while (!clear(len, hw) && len > T.len[0] * 0.5) len *= 0.94
    while (!clear(len, hw) && hw > T.hw[0] * 0.5) hw *= 0.94
    if (!clear(len, hw)) {
      MANE_EMPTY.push({ tier: s.k, side: s.sgn, deg: s.deg, why: `no room: root ${root.map(x => x.toFixed(3))} at ${bad.map(x => x.toFixed(3))} chest ${chestJ(bad).toFixed(3)} flow ${flow.map(x => x.toFixed(2))}` })
      continue
    }
    // (an S-curl's hook lies down where the hood's ground runs out before the
    // mane's end, so it never hangs off the neck as a flap)
    if (kind === 1) {
      const tp = va(root, vk(flow, len))
      lift *= smoothJ(0, lerp(EDGE.end, EDGE.endHigh, smoothJ(EDGE.high[0], EDGE.high[1], tp[1])), -(maneEndJ(tp) + EDGE.margin))
    }
    locks.push({ tier: s.k, side: s.sgn, deg: s.deg, root, flow, across, len, hw, th, lift, kind, curl })
  }
  // no two neighbours alike within a tenth on length, width and curl
  const alike = (x: number, y: number): boolean => Math.abs(x - y) <= 0.1 * Math.max(Math.abs(x), Math.abs(y))
  for (let pass = 0, changed = true; changed && pass < 8; pass++) {
    changed = false
    for (let i = 0; i < locks.length; i++) for (let j = 0; j < i; j++) {
      const a = locks[i]!, b = locks[j]!
      if (vl(vs(a.root, b.root)) > 1.4 * Math.max(a.len, b.len)) continue
      if (alike(a.len, b.len) && alike(a.hw, b.hw) && alike(a.curl, b.curl)) { a.curl *= 1.25; changed = true }
    }
  }
  return locks
}
/** The mane's locks, for the builders' checks and the stamp log. */
export const MANE_LOCKS: readonly ManeLock[] = layMane()
/** the layout's twins of the body, for the drift check against the live GLSL */
export const BODY_TWINS = { torsoSolid: torsoJ, chestSpace: chestJ, maneEnd: (p: V3): number => maneEndJ(p), shoulderCap: shoulderCapJ, neck: neckJ, throat: throatJ }
/** how far below its root's tangent plane a lock's own ground falls along it,
 * plus its thickness: below that, the column under the lock is not the lock */
const lockDepth = (m: ManeLock): number => {
  const n = vn(vx(m.flow, m.across))
  let drop = 0
  for (let s = 0; s <= 1.0001; s += 0.1) {
    const top = va(va(m.root, vk(m.flow, s * m.len)), vk(n, 0.15))
    for (let t = 0; t < 0.5; t += 0.004) {
      const q = va(top, vk(n, -t))
      if (groundJ(q) < 0) { drop = Math.max(drop, -vd(vs(q, m.root), n)); break }
    }
  }
  return drop + m.th + 0.05
}

const lockArrays = (): string => {
  const L = MANE_LOCKS
  const bound = (m: ManeLock): number[] => {
    const c = va(va(m.root, vk(m.flow, 0.5 * m.len)), vk(gradJ(m.root), m.th + 0.5 * m.lift))
    return [...c, Math.hypot(0.5 * m.len + 0.02, m.hw + 0.02 + Math.abs(m.curl) * 0.2 * m.len) + 2 * m.th + 1.5 * m.lift + 0.03]
  }
  const list = (name: string, rows: number[][], fn: (a: number[]) => string, type: string): string =>
    `const ${type} ${name}[${L.length}] = ${type}[${L.length}](\n  ${rows.map(fn).join(',\n  ')});`
  return [
    `const int M_N = ${L.length};`,
    list('M_R', L.map(m => m.root), v3, 'vec3'),
    list('M_T', L.map(m => m.flow), v3, 'vec3'),
    list('M_S', L.map(m => m.across), v3, 'vec3'),
    list('M_P', L.map(m => [m.len, m.hw, m.th, m.lift]), v4, 'vec4'),
    list('M_Q', L.map(m => [m.kind, m.curl, lockDepth(m), 1]), v4, 'vec4'),
    list('M_B', L.map(bound), v4, 'vec4'),
  ].join('\n')
}
const table7 = (name: string, A: readonly number[]): string => `const float ${name}[7] = float[7](${A.map(f).join(', ')});`

/* THE HEAD, one block with the face: the mane grows from the face's rim, a
 * forelock parted on the crown and a ruff standing round the cheeks and under
 * the jaw, and falls in four rows of carved locks, small at the face and large
 * on the neck, each laid over the roots of the next, to the withers and the
 * breast above the doors. A lock is carved whole or not at all. */
export const HEAD = FACE_FN + LOCK_SHAPES + /* glsl */ `
${lockArrays()}
${table7('RIMZ', RIM_Z)}
${table7('RUFFT', RUFF_T)}
float table7(float A[7], vec3 q) {
  float a = clamp(atan(q.x, q.y + 0.05) * 6.0 / PI, 0.0, 5.999);
  int i = int(a);
  float t = a - float(i);
  return mix(A[i], A[i + 1], t * t * (3.0 - 2.0 * t));
}
// how low the mane may hang: above the doors in front of the chest, to the
// shoulders on the neck's sides, under the jaw to the throat
float maneLow(vec3 p) {
  float r = length(p.yz - SH.yz);
  float dz = (p.z - SH.z) * 10.0;
  float side = mix(${f(LOW.side)}, ${f(LOW.dome)} + ${f(DOME_RISE)} * dz * dz, 1.0 - smoothstep(${f(LOW.domeIn)}, ${f(LOW.domeOut)}, r)) - p.y;
  float front = mix(${f(LOW.doors)}, ${f(LOW.throat)}, smoothstep(0.68, 0.76, p.z) * smoothstep(0.15, 0.09, abs(p.x))) - p.y;
  return mix(side, front, smoothstep(0.4, 0.55, p.z) * smoothstep(0.3, 0.16, abs(p.x)));
}
float map(vec3 p) {
  vec3 q = faceQ(p);
  float ts = torsoSolid(p), sc = shoulderCap(p);
  float un = smin(smin(smin(smin(faceMass(q) * HS, sdCapsule(p, ${v3(NAPE[0])}, ${v3(NAPE[1])}, ${f(NAPE_R)}), 0.05),
    sdRoundCone(p, ${v3(THROAT.a)}, ${v3(THROAT.b)}, ${f(THROAT.r1)}, ${f(THROAT.r2)}), 0.05), ts, 0.06), sc, 0.02);
  // the mane's own depth (twin of maneDepthJ): nothing at the rim, the ruff
  // round the face, deep on the neck's sides, nothing at its ends
  float rz = mix(0.04, table7(RIMZ, q), smoothstep(0.02, 0.06, length(q.xy + vec2(0.0, 0.05))));
  float zone = (rz - q.z) * HS, me = maneEnd(p) + ${f(EDGE.margin)}, low = maneLow(p) + ${f(EDGE.margin)};
  float up = (p.y - (0.9 + (p.z - 0.28) * 0.5385)) / 0.17;
  float neck = mix(${f(NECK.side)} * mix(${f(NECK.sideEnd)}, 1.0, smoothstep(0.0, ${f(NECK.sideFall)}, -me)), ${f(NECK.top)} * smoothstep(0.0, ${f(NECK.topFall)}, -me), smoothstep(0.3, 0.95, up));
  float tb = mix(table7(RUFFT, q), neck, smoothstep(-0.06, -0.3, q.z));
  float endFade = mix(${f(EDGE.end)}, ${f(EDGE.endHigh)}, smoothstep(${f(EDGE.high[0])}, ${f(EDGE.high[1])}, p.y));
  float lowFade = mix(mix(${f(EDGE.low)}, ${f(EDGE.lowFront)}, smoothstep(0.5, 0.62, p.z) * smoothstep(0.2, 0.12, abs(p.x))), ${f(EDGE.lowDome)}, 1.0 - smoothstep(${f(LOW.domeIn)}, ${f(LOW.domeOut)}, length(p.yz - SH.yz)));
  tb *= smoothstep(0.0, 0.1, zone) * smoothstep(0.0, endFade, -me) * smoothstep(0.0, lowFade, -low);
  // (its edges sink 4 mm under the face and the body, so none is a thin lip)
  tb = tb * smoothstep(0.026, 0.05, length(q - ${v3(EAR_AT)}) * HS) - 0.004 * (1.0 - smoothstep(0.0, 0.03, min(zone, min(-me, -low))));
  float h = un - tb;
  // the ground between the locks ends where its depth has run out, never in a shelf
  // (it ends a hand's breadth before the end line on the back, under the last
  // row's tips, so the mane ends at the withers)
  float d = smax(h, -zone, 0.008);
  d = smax(d, me, 0.02);
  d = smax(d, low, 0.02);
  for (int i = 0; i < M_N; i++) {
    // (the margin is the blend's, so skipping a lock never breaks the surface)
    if (length(p - M_B[i].xyz) - M_B[i].w > d + 0.006) continue;
    vec3 r = p - M_R[i];
    vec4 P = M_P[i];
    float lk = lockShapeT(vec3(dot(r, M_T[i]), dot(r, M_S[i]), h), P.x, P.y, P.z, M_Q[i].y, P.w, M_Q[i].x, M_Q[i].w);
    // (the lock's column ends below its own ground, so no ghost of it shows on
    // another part of the head the column passes through)
    lk = max(lk, -dot(r, cross(M_T[i], M_S[i])) - M_Q[i].z);
    d = smin(d, lk, 0.006);
  }
  // 6 mm off the shoulder's piece inside its circle (the dome and what lies
  // behind it, in to x 0.16; 10 mm over the pin, whose forged head stands
  // 4 mm proud of the dome), and no deeper than 12 mm into the body (its shell
  // is 22 mm), so the mane's inner faces stay hidden in the shell
  float sr = length(p.yz - SH.yz);
  float slab = max(sr - FP_R - 0.012, max(0.16 - abs(p.x), abs(p.x) - capFace(sr) - 0.006 - 0.004 * (1.0 - smoothstep(0.03, 0.045, sr))));
  d = smax(d, -slab, 0.01);
  d = smax(d, -(ts + 0.012), 0.006);
  // clear of the chest's cavity and the doors' swing, inside the hall's rest box
  d = max(d, abs(p.x) - 0.317);
  return smax(d, 0.006 - chestSpace(p), 0.012);
}
float matId(vec3 p) { return 2.0; }
`

export const FACE_PART = FACE_FN + /* glsl */ `
// (its back ends under the mane, behind the jaw's back, so no cut face shows)
float map(vec3 p) { return smax(face(p), (-0.14 - faceQ(p).z) * HS, 0.01); }
float matId(vec3 p) { return 0.0; }
`

/** THE TAIL'S TUFT: six carved locks round the tail's end, flowing on along
 * it and splaying a little, lying on a small core, their tips level so the
 * tuft ends blunt. Made once, like the mane's layout. */
const TUFT = (() => {
  const E: V3 = [0, 1.23, -0.84], D = vn([0, -0.02, 0.14]), C = va(E, vk(D, 0.045))
  const r = rng(313), locks: { root: V3; flow: V3; across: V3; len: number; hw: number; th: number; lift: number; kind: number; curl: number }[] = []
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 + 15 + between(r, -8, 8)) * Math.PI / 180
    const rad: V3 = [Math.cos(a), Math.sin(a), 0]
    const root = va(va(C, vk(rad, 0.026)), vk(D, -0.04))
    const flow = vn(va(D, vk(rad, 0.22)))
    const across = vn(vx(rad, flow))
    const kind = [0, 2, 1, 0, 2, 0][i]!
    locks.push({ root, flow, across, len: between(r, 0.1, 0.12), hw: between(r, 0.021, 0.028), th: between(r, 0.009, 0.011), lift: 0.005, kind, curl: (i % 2 ? -1 : 1) * between(r, 0.25, 0.55) })
  }
  return { C, locks }
})()

/* THE TAIL: one spline of two arcs meeting in one tangent and one radius, so
 * no ring halfway, tapering from the rump to the tuft. */
export const TAIL = LOCK_SHAPES + /* glsl */ `
const vec3 TUFT_C = ${v3(TUFT.C)};
float map(vec3 p) {
  float d = length(p - T0) - 0.052;
  vec2 b1 = sdBezier(p, T0, vec3(0.0, 0.83, -1.0), vec3(0.0, 1.05, -0.99));
  vec2 b2 = sdBezier(p, vec3(0.0, 1.05, -0.99), vec3(0.0, 1.25, -0.98), vec3(0.0, 1.23, -0.84));
  float tube = min(b1.x - mix(0.04, 0.031, b1.y), b2.x - mix(0.031, 0.024, b2.y));
  d = smin(d, tube, 0.02);
  // the tuft's core, and its six locks lying on it
  float core = sdEllipsoid(p - TUFT_C, vec3(0.03, 0.03, 0.058));
  float tuft = core;
${TUFT.locks.map(m => `  tuft = smin(tuft, lockShape(vec3(dot(p - ${v3(m.root)}, ${v3(m.flow)}), dot(p - ${v3(m.root)}, ${v3(m.across)}), core), ${f(m.len)}, ${f(m.hw)}, ${f(m.th)}, ${f(m.curl)}, ${f(m.lift)}, ${f(m.kind)}), 0.006);`).join('\n')}
  return min(d, tuft);
}
float matId(vec3 p) { return p.y > 1.19 && p.z > -0.86 ? 2.0 : 0.0; }
`

/** The head's carved parts, their boxes and grid steps at the finest tier;
 * sdf.ts puts COMMON before each and lists them in CARVED. */
export const HEAD_PARTS: Record<'head' | 'face' | 'tail', CarvedSpec> = {
  head: { glsl: HEAD, bmin: [-0.32, 0.7, 0.2], bmax: [0.32, 1.3, 0.97], h: 0.0024, aoR: 0.05 },
  face: { glsl: FACE_PART, bmin: [-0.17, 0.83, 0.655], bmax: [0.17, 1.26, 1.155], h: 0.0014, aoR: 0.03 },
  tail: { glsl: TAIL, bmin: [-0.12, 0.78, -1.08], bmax: [0.12, 1.36, -0.6], h: 0.0028, aoR: 0.03 },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const v = (a: readonly number[]): N => vec3(a[0]!, a[1]!, a[2]!)
const lin = (hex: string): N => { const c = new Color(hex); return vec3(c.r, c.g, c.b) }
/** THE FACE'S PAINTED FEATURES, read in the carving's rest frame, where only
 * the head reaches this far forward: the eyeball in ochre with its pupil in
 * black, the nose's leather in umber. Weights in [0, 1]; q is the face's frame
 * in metres (the carving's scale included). */
function faceFeatures(P: N): { q: N; eye: N; pupil: N; nose: N } {
  const q0 = vec3(P.x.abs(), P.y, P.z).sub(v(FACE.at))
  // the face's own frame, carried nose down as the carving carries it
  const cp = Math.cos(FACE.pitch), sp = Math.sin(FACE.pitch)
  const q = vec3(q0.x, q0.y.mul(cp).add(q0.z.mul(sp)), q0.z.mul(cp).sub(q0.y.mul(sp)))
  // the eye's own frame, as the carving turns it
  const e0 = q.sub(v(FACE.eye))
  const cy = Math.cos(FACE.eyeYaw), sy = Math.sin(FACE.eyeYaw), ct = Math.cos(FACE.eyeTilt), stl = Math.sin(FACE.eyeTilt)
  const ex = e0.x.mul(cy).sub(e0.z.mul(sy)), ez = e0.x.mul(sy).add(e0.z.mul(cy))
  const exx = ex.mul(ct).sub(e0.y.mul(stl)), eyy = ex.mul(stl).add(e0.y.mul(ct))
  const inBall = smoothstep(-0.012, -0.005, ez)
  const almond = exx.div(FACE.eyeW).pow(2).add(eyy.div(FACE.eyeH * 1.1).pow(2))
  // (not on the lower lid, which is skin)
  const lowY = float(-FACE.eyeH).mul(float(EYE_LOW.at).sub(exx.div(FACE.eyeW).pow(2).mul(EYE_LOW.bend)))
  const eye = smoothstep(1.0, 0.8, almond).mul(inBall).mul(smoothstep(lowY.sub(0.0006), lowY.add(0.0006), eyy))
  const r = vec3(exx.sub(FACE.iris.at[0]), eyy.sub(FACE.iris.at[1]), 0).length()
  const pupil = smoothstep(FACE.pupilR + 0.0014, FACE.pupilR + 0.0002, r).mul(inBall)
  // the nose's leather, its front face only: a trapezoid wide at the top
  const L = FACE.leather
  const n = q.sub(v(L.at))
  const c2 = Math.cos(L.tilt), s2 = Math.sin(L.tilt)
  const ny = n.y.mul(c2).add(n.z.mul(s2)), nz = n.z.mul(c2).sub(n.y.mul(s2))
  const half = mix(float(L.bottom), float(L.top), clamp(ny.add(L.half).div(2 * L.half), 0, 1))
  const nose = smoothstep(0.003, -0.002, q.x.sub(half)).mul(smoothstep(L.half + 0.004, L.half - 0.001, ny.abs()))
    .mul(smoothstep(L.front - 0.009, L.front - 0.004, nz))
  return { q, eye: clamp(eye, 0, 1), pupil: clamp(pupil, 0, 1), nose: clamp(nose, 0, 1) }
}

/** Where the face's own planes carry the shading: the muzzle, the cheeks and
 * the brow in front of the ears, above the throat. The body's grime and the
 * hide's mottle are damped here, so no blotch lies across a plane. 0 to 1. */
export function faceCalm(P: N): N {
  const { q } = faceFeatures(P)
  const qs: N = q.div(HS)
  return smoothstep(-0.02, 0.06, qs.z).mul(smoothstep(0.17, 0.12, qs.x)).mul(smoothstep(-0.25, -0.2, qs.y))
}

/** THE FACE'S COLOURS over the body's paint `col` (paint the painted share):
 * the eye, its pupil, the nose's leather, and the lower face as the carving
 * cuts it (MUZZLE): the whisker pads in the body's tan with rows of dark
 * spots, pale only along their lowest third, a dark red-brown line along the
 * lip's edge to the mouth's corner, cream on the chin under it. Every edge is
 * feathered and follows a carved line, never a straight one of the frame. */
export function faceColour(P: N, col: N, paint: N, n1: N, n2: N): { col: N; eye: N; calm: N } {
  const f = faceFeatures(P)
  const qs: N = f.q.div(HS)
  const M = MUZZLE, Lp = M.lip
  // the lip's edge as the carving cuts it (face(): the inverted Y, the side's rise)
  const lu: N = qs.x.div(Lp.lowX).min(1), lv = float(1).sub(lu)
  const ly: N = float(Lp.notch).add(float(Lp.low - Lp.notch).mul(float(1).sub(lv.mul(lv))))
    .add(smoothstep(Lp.sideX[0], Lp.sideX[1], qs.x).mul(Lp.side)).add(smoothstep(Lp.riseZ[0], Lp.riseZ[1], qs.z).mul(Lp.rise))
  const dy: N = qs.y.sub(ly)
  // the muzzle's block, front and sides, in front of the cheek and under the nose
  const block: N = smoothstep(0.095, 0.125, qs.z).mul(smoothstep(0.1, 0.086, qs.x)).mul(smoothstep(-0.045, -0.07, qs.y)).mul(float(1).sub(f.nose))
  const pad: N = block.mul(smoothstep(-0.003, 0.004, dy))
  // pale only along the pads' lowest third, fading up over 2 cm
  const low: N = pad.mul(smoothstep(0.03, 0.008, dy)).mul(0.55)
  // the whisker spots: four rows curving down and out over each pad's upper half, a seeded jitter so no grid reads
  const u: N = qs.x, vr = qs.y.add(u.div(0.075).pow(2).mul(0.01))
  const row: N = vr.sub(-0.077).div(-0.0102).floor().clamp(0, 3)
  const stag: N = row.mul(0.0045)
  const col0: N = u.sub(0.015).sub(stag).div(0.0105).floor()
  const cell: N = vec2(col0, row)
  const jit: N = vec2(cell.dot(vec2(12.9898, 78.233)).sin().mul(43758.5453).fract(), cell.dot(vec2(39.346, 11.135)).sin().mul(24634.6345).fract()).sub(0.5).mul(0.0048)
  const cx: N = col0.add(0.5).mul(0.0105).add(0.015).add(stag).add(jit.x)
  const cyr: N = row.add(0.5).mul(-0.0102).add(-0.077).add(jit.y)
  const dd: N = vec2(u.sub(cx), vr.sub(cyr)).length()
  const inRows: N = smoothstep(0.012, 0.016, u).mul(smoothstep(0.075, 0.066, u.sub(row.mul(0.004)))).mul(smoothstep(-0.08, -0.078, vr).oneMinus())
    .mul(smoothstep(-0.12, -0.116, vr))
  // (each dot its own size, a few left out, the lowest row the smallest)
  const h3: N = cell.dot(vec2(7.13, 157.1)).sin().mul(3758.5453).fract()
  const rr: N = mix(0.0015, 0.0025, h3).mul(float(1).sub(row.mul(0.07)))
  // (and each its own depth of tone, a third left out, so no printed pattern reads)
  const spots: N = smoothstep(rr.add(0.0009), rr.sub(0.0006), dd).mul(smoothstep(0.26, 0.34, h3.mul(7.0).fract()))
    .mul(mix(0.6, 1.0, h3.mul(13.0).fract()))
    .mul(inRows).mul(pad).mul(smoothstep(0.24, 0.255, qs.z))
  // the lip's line: the upper lip's margin (seen from the front as a dark rim
  // under each pad) and the lower lip under it, back to the corner
  const lip: N = smoothstep(0.0065, 0.002, dy).mul(smoothstep(-0.014, -0.007, dy)).mul(smoothstep(0.1, 0.086, qs.x))
    .mul(smoothstep(M.corner.at, M.corner.at + M.corner.fade, qs.z)).mul(smoothstep(-0.03, -0.07, qs.y))
  // the cleft's lower half dark down to the lip's notch, the inverted Y's stem
  const stem: N = smoothstep(0.0036, 0.0012, qs.x).mul(smoothstep(-0.088, -0.112, qs.y)).mul(smoothstep(-0.004, 0.0, dy))
    .mul(smoothstep(0.24, 0.255, qs.z)).mul(0.85)
  // the chin in cream under the lip, a rounded patch about half the muzzle's
  // width, fading back along the jaw and down into the throat
  const ce: N = qs.x.div(0.046).pow(2).add(qs.y.add(0.182).div(0.05).pow(2))
  const chin: N = smoothstep(-0.006, -0.013, dy).mul(smoothstep(0.16, 0.21, qs.z)).mul(smoothstep(1.2, 0.7, ce))
  // the lower lip, the band under the line to the jaw's turn, in the lip's
  // own red-umber, feathered into the chin (cream there reads cold in shade)
  const lower: N = smoothstep(-0.003, -0.007, dy).mul(smoothstep(-0.05, -0.03, dy)).mul(smoothstep(0.1, 0.086, qs.x))
    .mul(smoothstep(M.corner.at, M.corner.at + M.corner.fade, qs.z)).mul(smoothstep(-0.03, -0.07, qs.y))
  let c: N = col
  c = mix(c, c.mul(1.06), pad.mul(paint))
  c = mix(c, lin('#cdb48c').mul(mix(0.92, 1.04, n2)), low.mul(paint))
  c = mix(c, lin('#3a2415').mul(mix(0.9, 1.08, n1)), spots.mul(paint).mul(0.6))
  c = mix(c, lin('#e4d0aa').mul(mix(0.94, 1.04, n2)), chin.mul(paint).mul(0.95))
  c = mix(c, lin('#34160f').mul(mix(1.3, 2.4, smoothstep(-0.01, -0.035, dy))).mul(mix(0.9, 1.1, n1)), lower.mul(paint).mul(0.85))
  c = mix(c, lin('#34160f').mul(mix(0.9, 1.1, n1)), lip.max(stem).mul(paint).mul(0.88))
  c = mix(c, lin('#a5712a').mul(mix(0.9, 1.08, n1)), f.eye.mul(paint))
  c = mix(c, lin('#120b07'), f.pupil.mul(paint))
  c = mix(c, lin('#3a2415').mul(mix(0.85, 1.1, n1)), f.nose.mul(paint).mul(0.9))
  // (eye: where no gilt, wear or crackle of the body's paint may cross: the
  // eyes, and the face's front, whose planes and colours carry it alone)
  const calm = faceCalm(P)
  return { col: c, eye: f.eye.max(calm), calm }
}
