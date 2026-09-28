/** THE LION'S CARVED PARTS AS DISTANCE FUNCTIONS, in the lion's rest frame:
 * metres, origin on the floor between the paws, +z forward, +y up, +x the
 * lion's left. Legs, paws and doors are carved on the +x side and mirrored.
 * Material ids: 0 body paint, 1 blue lining, 2 mane paint, 3 iron, 4 bare
 * wood (inside faces and cut edges), 5 gilding.
 *
 * Every size is the museum's choice (no source gives one); the chest's blue
 * and gold follow the letters of 1509 and 1517.
 *
 * The body's file: the head, the face and the tail are carved in head.ts,
 * which reads only COMMON's interface (below) from here.
 */
import { HEAD_PARTS, LOCK_SHAPES } from './head'

export const K = {
  SH: [0.215, 0.8, 0.33], SH_R: 0.112,
  HP: [0.2, 0.8, -0.45], HP_R: 0.125,
  KF: [0.165, 0.42, 0.36],
  WF: [0.145, 0.115, 0.38],
  KH: [0.175, 0.47, -0.33],
  WH: [0.16, 0.245, -0.6],
  T0: [0.0, 0.86, -0.695],
  NECK: [0.0, 0.98, 0.42],
  HINGE: [0.149, 0.66, 0.538],
  DOOR_OPEN: 140 * Math.PI / 180,
  CAV_BACK: 0.28,
} as const

/** The shell's own thickness, and the near flank panel the inspection view
 * takes off: its outline in the side view (z, y) and the plane it is cut at. */
export const SHELL_T = 0.022
export const FLANK = { zc: -0.06, bot: 0.61, below: 0.07, hz: 0.26, r: 0.08, slope: -0.26, x: 0.035, gap: 0.003, collar: 0.035 } as const
/** Where the barrel's arbor passes the near flank, for the winding key. */
export const ARBOR = { y: 0.76, z: -0.03 } as const
/** Where the mane ends over the shoulders, fixed between the body and the
 * head: in the side view a line through the withers (z, y), falling at
 * `fall` radians below the level, nearly upright, so it passes the shoulder
 * pin's height about 6 cm behind the pin. The mane lies in front of it and
 * above it, where `maneEnd(p)` is negative. */
export const MANE_END = { z: 0.24, y: 1.05, fall: 1.45 } as const
/** The shoulder's cap, fixed between the body and the head: inside the
 * shoulder's circle (radius LEG.fore.plate.R about the pin) the fore upper's
 * outer face is a low dome of revolution about the pin, `top` at the pin and
 * `rim` at the circle, level at both, so a fixed mane over it keeps the same
 * gap at any angle of the swing. `shoulderCap(p)` is that dome grown by `clear`. */
export const SHOULDER_CAP = { top: 0.226, rim: 0.2, clear: 0.006 } as const

/** THE LEGS' JOINTS (the +x side). The shoulder and the hip: a domed plate
 * about the pin, its rim flush in a round seat cut in a flat of the body's
 * side, a small bearing hole behind it. Elbow, wrist, stifle, hock: a lap
 * joint, the upper piece's outer cheek over the lower piece's inner cheek
 * on one disc of radius R about the pin; round the pin both faces are the
 * planes xo and xi, so the seam circle stays flush at any angle. */
export const LEG = {
  fore: {
    plate: { R: 0.118, skin: 0.19, boss: 0.13, floor: 0.176, inner: 0.1785, rim: 0.19, seat: 0.238, flat: 0.03, hole: 0.065 },
    elbow: { R: 0.066, xo: 0.215, xi: 0.135 },
    wrist: { R: 0.05, xo: 0.186, xi: 0.108 },
  },
  hind: {
    plate: { R: 0.125, skin: 0.19, boss: 0.137, floor: 0.176, inner: 0.1785, seat: 0.238, flat: 0.03, hole: 0.065 },
    stifle: { R: 0.07, xo: 0.218, xi: 0.132 },
    hock: { R: 0.042, xo: 0.19, xi: 0.13 },
  },
} as const
/** The seams: the radial gap round a cheek and the gap between the cheeks. */
export const SEAM = { ring: 0.001, layer: 0.001 } as const
/** Round each lower joint's pin both pieces' outer faces fall as one shallow
 * cone (a surface of revolution, so the seam stays flush at any angle): this
 * many metres at 3.5 cm outside the disc, in proportion to the distance from
 * the pin. The hinges' leaves are bent to it (works.ts). */
export const LAP_CONE = 0.005
export const coneSlope = (R: number): number => LAP_CONE / (R + 0.035)
/** In the paw's frame (yz), where the fore pastern runs from the wrist pin into the foot. */
export const PASTERN = { fore: [-0.064, 0.032], hind: [-0.18, 0.05] } as const
const unit2 = (y: number, z: number): [number, number] => { const l = Math.hypot(y, z); return [y / l, z / l] }
/** Outside a joint's disc the pieces part on the plane through the pin that
 * halves the rest bend; its normal in yz, toward the upper piece. */
function parting(up: readonly number[], pin: readonly number[], downYZ: readonly number[]): [number, number] {
  const a = unit2(up[1]! - pin[1]!, up[2]! - pin[2]!), b = unit2(downYZ[0]!, downYZ[1]!)
  return unit2(a[0] - b[0], a[1] - b[1])
}
export const NB = {
  foreElbow: parting(K.SH, K.KF, [K.WF[1] - K.KF[1], K.WF[2] - K.KF[2]]),
  foreWrist: parting(K.KF, K.WF, PASTERN.fore),
  hindStifle: parting(K.HP, K.KH, [K.WH[1] - K.KH[1], K.WH[2] - K.KH[2]]),
  hindHock: parting(K.KH, K.WH, PASTERN.hind),
} as const

const f = (x: number): string => {
  const s = x.toFixed(4)
  return s.includes('.') ? s : `${s}.0`
}
const v3 = (a: readonly number[]): string => `vec3(${a.map(f).join(', ')})`
const v2 = (a: readonly number[]): string => `vec2(${a.map(f).join(', ')})`

export const SDF_LIB = /* glsl */ `
#ifndef PI
#define PI 3.141592653589793
#endif
float dot2(vec2 v) { return dot(v, v); }
float dot2(vec3 v) { return dot(v, v); }
float smin(float a, float b, float k) { if (k <= 0.0) return min(a, b); float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  float x2 = dot2(pa * l2 - ba * y); float y2 = y * y * l2; float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdRoundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdCappedCyl(vec3 p, vec3 a, vec3 b, float r) {
  vec3 ba = b - a, pa = p - a; float baba = dot(ba, ba), paba = dot(pa, ba);
  float x = length(pa * baba - ba * paba) - r * baba; float y = abs(paba - baba * 0.5) - baba * 0.5;
  float x2 = x * x, y2 = y * y * baba;
  float d = (max(x, y) < 0.0) ? -min(x2, y2) : (((x > 0.0) ? x2 : 0.0) + ((y > 0.0) ? y2 : 0.0));
  return sign(d) * sqrt(abs(d)) / baba;
}
vec2 sdBezier(vec3 pos, vec3 A, vec3 B, vec3 C) {
  vec3 a = B - A, b = A - 2.0 * B + C, c = a * 2.0, d = A - pos;
  float kk = 1.0 / max(dot(b, b), 1e-9);
  float kx = kk * dot(a, b), ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0, kz = kk * dot(d, a);
  vec2 res; float p = ky - kx * kx, p3 = p * p * p, q = kx * (2.0 * kx * kx - 3.0 * ky) + kz, h = q * q + 4.0 * p3;
  if (h >= 0.0) {
    h = sqrt(h); vec2 x = (vec2(h, -h) - q) / 2.0; vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    float t = clamp(uv.x + uv.y - kx, 0.0, 1.0); res = vec2(dot2(d + (c + b * t) * t), t);
  } else {
    float z = sqrt(-p); float v = acos(clamp(q / (p * z * 2.0), -1.0, 1.0)) / 3.0; float m = cos(v), n = sin(v) * 1.732050808;
    vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
    float dis = dot2(d + (c + b * t.x) * t.x); res = vec2(dis, t.x);
    dis = dot2(d + (c + b * t.y) * t.y); if (dis < res.x) res = vec2(dis, t.y);
  }
  return vec2(sqrt(res.x), res.y);
}
// (acos clamped in both: a rounding step past 1 gave NaN, and min() then dropped the curve)
vec2 sd2Bezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
  vec2 a = B - A, b = A - 2.0 * B + C, c = a * 2.0, d = A - pos;
  float kk = 1.0 / max(dot(b, b), 1e-9);
  float kx = kk * dot(a, b), ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0, kz = kk * dot(d, a);
  vec2 res; float p = ky - kx * kx, p3 = p * p * p, q = kx * (2.0 * kx * kx - 3.0 * ky) + kz, h = q * q + 4.0 * p3;
  if (h >= 0.0) {
    h = sqrt(h); vec2 x = (vec2(h, -h) - q) / 2.0; vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    float t = clamp(uv.x + uv.y - kx, 0.0, 1.0); res = vec2(dot2(d + (c + b * t) * t), t);
  } else {
    float z = sqrt(-p); float v = acos(clamp(q / (p * z * 2.0), -1.0, 1.0)) / 3.0; float m = cos(v), n = sin(v) * 1.732050808;
    vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
    float dis = dot2(d + (c + b * t.x) * t.x); res = vec2(dis, t.x);
    dis = dot2(d + (c + b * t.y) * t.y); if (dis < res.x) res = vec2(dis, t.y);
  }
  return vec2(sqrt(res.x), res.y);
}
vec2 sd2Seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return vec2(length(pa - ba * h), h); }
float sd2RoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float hash1(float n) { return fract(sin(n) * 43758.5453123); }

// The heraldic lily, about one unit wide and tall, centred on its band. Negative inside.
float fleur(vec2 p) {
  vec2 q = vec2(abs(p.x), p.y);
  // every point and inner corner rounded past the grid's cell (the lily's own cell is 1.1 mm, S 0.118)
  vec2 s = sd2Seg(q, vec2(0.0, -0.08), vec2(0.0, 0.62));
  float w = 0.36 * pow(s.y, 0.3) * pow(1.0 - s.y, 1.2);
  float d = s.x - max(w - 0.008, 0.0) - 0.012;
  // the side petal's curl in two halves, so its width never jumps inside the curl's eye
  vec2 A1 = vec2(0.08, -0.03), B1 = vec2(0.58, 0.46), C1 = vec2(0.34, -0.11), M1 = 0.25 * (A1 + 2.0 * B1 + C1);
  vec2 ba = sd2Bezier(q, A1, 0.5 * (A1 + B1), M1), bb = sd2Bezier(q, M1, 0.5 * (B1 + C1), C1);
  float ta = 0.5 * ba.y, tb = 0.5 + 0.5 * bb.y;
  // (sin clamped: at the tip sin(PI) rounds below 0, and pow() of it is NaN)
  float wa = mix(0.05, 0.012, ta) + 0.062 * pow(max(sin(PI * ta), 0.0), 0.8);
  float wb = mix(0.05, 0.012, tb) + 0.062 * pow(max(sin(PI * tb), 0.0), 0.8);
  d = smin(d, smin(ba.x - wa, bb.x - wb, 0.02), 0.025);
  d = smin(d, sd2RoundBox(q - vec2(0.0, -0.09), vec2(0.21, 0.04), 0.018), 0.02);
  vec2 s2 = sd2Seg(q, vec2(0.0, -0.12), vec2(0.0, -0.27));
  d = smin(d, s2.x - max(0.06 * (1.0 - s2.y) - 0.008, 0.0) - 0.012, 0.02);
  vec2 b3 = sd2Bezier(q, vec2(0.05, -0.12), vec2(0.21, -0.11), vec2(0.23, -0.23));
  d = smin(d, b3.x - (0.05 * (1.0 - b3.y) + 0.012), 0.02);
  return d;
}
`

/** The body's GLSL shared by every carved part. Its names neck, torsoSolid,
 * maneEnd, shoulderCap, chestSpace, T0 and lockSD are the interface head.ts reads. */
export const COMMON = /* glsl */ `
const vec3 SH = ${v3(K.SH)}; const float SH_R = ${f(K.SH_R)};
const vec3 HP = ${v3(K.HP)}; const float HP_R = ${f(K.HP_R)};
const vec3 KF = ${v3(K.KF)}; const vec3 WF = ${v3(K.WF)};
const vec3 KH = ${v3(K.KH)}; const vec3 WH = ${v3(K.WH)};
const vec3 T0 = ${v3(K.T0)};
const float CAV_BACK = ${f(K.CAV_BACK)};
const float SHELL_T = ${f(SHELL_T)};
const float DOOR_T = 0.035;
const float DOOR_Z = 0.42;

const vec3 HINGE = ${v3(K.HINGE)};
const float DOOR_OPEN = ${f(K.DOOR_OPEN)};

const float FP_R = ${f(LEG.fore.plate.R)}, FP_SKIN = ${f(LEG.fore.plate.skin)}, FP_BOSS = ${f(LEG.fore.plate.boss)};
const float FP_FLOOR = ${f(LEG.fore.plate.floor)}, FP_HOLE = ${f(LEG.fore.plate.hole)};
const float HQ_R = ${f(LEG.hind.plate.R)}, HQ_SKIN = ${f(LEG.hind.plate.skin)}, HQ_BOSS = ${f(LEG.hind.plate.boss)};
const float HQ_FLOOR = ${f(LEG.hind.plate.floor)}, HQ_HOLE = ${f(LEG.hind.plate.hole)};
const float SEAM_RING = ${f(SEAM.ring)}, SEAM_LAYER = ${f(SEAM.layer)};
float coneFall(float r, float R) { return min(${f(LAP_CONE)} * r / (R + 0.035), ${f(LAP_CONE)}); }
// THE GOUGE'S FACETS: a jittered grid of cells, each cut as one shallow scoop
// tilted a little, neighbouring scoops meeting in low ridges; the depth the surface sinks, 0 to dep.
// st stretches the cells (longer along a limb); one pattern in the rest frame,
// so pieces that meet at rest carry the same cuts
vec3 fcHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.103, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float facets(vec3 p, float S, float dep, vec3 st) {
  vec3 q = p / (S * st), i0 = floor(q);
  float F1 = 1e9, F2 = 1e9, v1 = 0.5, v2 = 0.5;
  for (int k = 0; k < 27; k++) {
    vec3 c = i0 + vec3(float(k % 3), float((k / 3) % 3), float(k / 9)) - 1.0;
    vec3 dq = q - (c + 0.15 + 0.7 * fcHash(c));
    float dd = dot(dq, dq);
    float v = clamp(0.5 + 1.3 * dot(dq, fcHash(c + 17.31) - 0.5), 0.0, 1.0);
    if (dd < F1) { F2 = F1; v2 = v1; F1 = dd; v1 = v; } else if (dd < F2) { F2 = dd; v2 = v; }
  }
  float e = smoothstep(0.0, 0.45, sqrt(F2) - sqrt(F1));
  return dep * e * (0.75 + 0.5 * (v1 - 0.5));
}
// the flat round seats on the body's sides where the shoulders and hips turn:
// each face a plane x = skin, so the plate's rim lies flush with it at any angle
float seatFlat(vec3 q, vec2 c, float r, float skin) {
  vec2 w = vec2(length(q.yz - c) - r + 0.012, q.x - skin + 0.012);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.012;
}
float seatBoss(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  return min(seatFlat(q, SH.yz, FP_BOSS, FP_SKIN), seatFlat(q, HP.yz, HQ_BOSS, HQ_SKIN));
}

// the doors end under the throat, so the neck stands fixed above them
float doorOutline(vec2 xy) { return sd2RoundBox(xy - vec2(0.0, 0.6575), vec2(0.152, 0.1225), 0.06); }
float cavity(vec3 p) { return smax(doorOutline(p.xy), CAV_BACK - p.z, 0.02); }

// the trunk's stations every 10 cm from z = -0.75: the back line, the
// underline and the half width; a deep chest and a full ribcage, a belly
// that runs level and tucks up only before the stifle, the back dipping
// 16 mm behind the withers and rising again to the croup
const float TR_TOP[15] = float[15](0.9, 0.95, 0.99, 1.0, 0.994, 0.982, 0.974, 0.974, 0.994, 1.01, 1.025, 1.035, 1.03, 1.0, 0.95);
const float TR_BOT[15] = float[15](0.76, 0.72, 0.69, 0.665, 0.605, 0.56, 0.522, 0.502, 0.485, 0.47, 0.456, 0.45, 0.456, 0.485, 0.53);
const float TR_HW[15]  = float[15](0.12, 0.15, 0.175, 0.186, 0.195, 0.2, 0.21, 0.215, 0.215, 0.205, 0.19, 0.188, 0.182, 0.165, 0.13);
float trStation(float A[15], float z) {
  float u = clamp((z + 0.75) / 0.1, 0.0, 13.999);
  int i = int(floor(u)); float t = u - float(i);
  float a = A[max(i - 1, 0)], b = A[i], c = A[min(i + 1, 14)], d = A[min(i + 2, 14)];
  return 0.5 * (2.0 * b + (c - a) * t + (2.0 * a - 5.0 * b + 4.0 * c - d) * t * t + (3.0 * b - a - 3.0 * c + d) * t * t * t);
}
// the section: an ellipse below the widest line, a broad flat back above it,
// narrowing to the sternum and the belly
float trunk(vec3 p) {
  float z = clamp(p.z, -0.6, 0.5);
  float top = trStation(TR_TOP, z), bot = trStation(TR_BOT, z), hw = trStation(TR_HW, z);
  float yc = 0.5 * (top + bot), b = 0.5 * (top - bot);
  float y = p.y - yc;
  // below the widest line the section narrows; under the shoulders it narrows from higher
  // up and further, into the keel between the forelegs, so the arms hang beside it
  float ch = smoothstep(0.05, 0.25, z) * (1.0 - smoothstep(0.4, 0.5, z));
  float kn = 0.2 + 0.24 * ch;
  float a = hw * (1.0 - kn * smoothstep(0.0, -1.0, (y - 0.1 * ch) / b));
  float n = y > 0.0 ? 3.8 : 2.0;
  vec2 u = abs(vec2(p.x / a, y / b)) + 1e-5;
  float N = pow(pow(u.x, n) + pow(u.y, n), 1.0 / n);
  vec2 g = pow(u, vec2(n - 1.0)) * pow(N, 1.0 - n) / vec2(a, b);
  float d = (N - 1.0) / max(length(g), 1e-4);
  // capped at the two ends, where the breast and the rump close it
  float w = max(-0.6 - p.z, p.z - 0.5);
  return min(max(d, w), 0.0) + length(max(vec2(d, w), 0.0));
}
// the neck under the mane, which the head's carving lies on
float neck(vec3 p) { return sdCapsule(p, vec3(0.0, 0.9, 0.28), vec3(0.0, 1.04, 0.54), 0.17); }
// the throat, fixed above the doors: from the breast's top up and forward
// into the jaw, so the head stands on a neck and not out over air
float throat(vec3 p) { return sdRoundCone(p, vec3(0.0, 0.862, 0.56), vec3(0.0, 0.905, 0.8), 0.076, 0.052); }
float torsoSolid(vec3 p) {
  float d = trunk(p);
  // the breast before the fore legs, which the chest's doors are cut from: full
  // before the hinges, narrowing behind them where the arms swing and under the doors to the keel
  vec3 bq = p - vec3(0.0, 0.66, 0.4);
  bq.x /= mix(0.7, 1.0, smoothstep(0.36, 0.52, p.z)) * (1.0 - 0.2 * smoothstep(0.535, 0.44, p.y));
  // a groove down the breast's front between the two pectoral masses, where the doors meet
  float gv = smoothstep(0.46, 0.56, p.z) * smoothstep(0.5, 0.6, p.y) * (1.0 - smoothstep(0.74, 0.8, p.y));
  d = smin(d, sdEllipsoid(bq, vec3(0.178, 0.215, 0.225)) + 0.016 * gv * exp(-p.x * p.x / 0.0012), 0.05);
  // the rump, rounding down from the croup to the tail's root and the thighs,
  // cut in chisel planes: the croup's top and its two falls, the quarters, the seat
  vec3 rq = p - vec3(0.0, 0.85, -0.52);
  float rump = sdEllipsoid(rq, vec3(0.17, 0.155, 0.2));
  vec3 ra = vec3(abs(rq.x), rq.y, rq.z);
  float pl = max(ra.y - 0.153, dot(ra, vec3(0.6, 0.8, 0.0)) - 0.153);
  pl = max(pl, max(ra.x - 0.163, dot(ra, vec3(0.6, 0.0, -0.8)) - 0.181));
  pl = max(pl, max(-ra.z - 0.191, dot(ra, vec3(0.0, 0.6, -0.8)) - 0.177));
  d = smin(d, smax(rump, pl, 0.012), 0.08);
  d = smin(d, neck(p), 0.09);
  d = smin(d, throat(p), 0.05);
  // the flats where the shoulder and the hip turn: round each seat the side is
  // drawn to the plane x = skin and eases back into the carving over 8 cm, so no rim stands round it
  vec3 q = vec3(abs(p.x), p.y, p.z);
  // (the hip's flat eases out over 14 cm, so no ring reads round the haunch)
  d = mix(d, q.x - FP_SKIN, 1.0 - smoothstep(FP_BOSS, FP_BOSS + 0.08, length(q.yz - SH.yz)));
  return mix(d, q.x - HQ_SKIN, 1.0 - smoothstep(HQ_BOSS, HQ_BOSS + 0.14, length(q.yz - HP.yz)));
}
// the skin's point under p along the carving's normal: the doors are cut
// along it, so each of their edges stands square to the skin
vec3 onSkin(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0015;
  vec3 g = k.xyy * torsoSolid(p + k.xyy * e) + k.yyx * torsoSolid(p + k.yyx * e) + k.yxy * torsoSolid(p + k.yxy * e) + k.xxx * torsoSolid(p + k.xxx * e);
  return p - normalize(g) * torsoSolid(p);
}
float doorRegion(vec3 p) {
  if (p.z < DOOR_Z - 0.05 || abs(p.x) > 0.25 || p.y < 0.45 || p.y > 0.95) return doorOutline(p.xy);
  return doorOutline(onSkin(p).xy);
}
// the doors are the breast's front only: the skin stays fixed behind the hinges'
// line, and under the throat behind DOOR_Z
float opening(vec3 p, float g) {
  float back = mix(HINGE.z - 0.012, DOOR_Z, smoothstep(0.78, 0.82, p.y));
  return smax(doorRegion(p) + g, back + g - p.z, 0.02);
}
// the rebate the doors close against: the skin's inner half runs on 15 mm under
// each door's edge, so the seam never opens a straight line into the chest
float doorLip(vec3 p, float s) {
  float o = opening(p, -0.003);
  // (its edges rounded two cells of the shell's grid, so they stay clean lines)
  return smax(max(s + SHELL_T * 0.5, -(s + SHELL_T)), smax(-o - 0.015, o, 0.006), 0.006);
}
// the room the chest needs: its cavity inside, and before the chest the half
// disc each door sweeps round its hinge, with the hinge's own round behind it
float chestSpace(vec3 p) {
  vec2 h = vec2(abs(p.x) - HINGE.x, p.z - HINGE.z);
  float sweep = min(max(length(h) - 0.2, -h.y - 0.03), length(h) - 0.06);
  sweep = max(sweep, max(p.y - 0.795, 0.52 - p.y));
  return min(smax(cavity(p), p.z - 0.62, 0.01), sweep);
}
// the side of the mane's end line p is on: negative where the mane may lie
float maneEnd(vec3 p) { return -(p.z - ${f(MANE_END.z)}) * ${f(Math.sin(MANE_END.fall))} - (p.y - ${f(MANE_END.y)}) * ${f(Math.cos(MANE_END.fall))}; }
// THE SHOULDER'S CAP: the fore upper's outer face inside its circle, x = capFace(r)
// at the distance r from the pin's axis, level at the pin and at the rim
const float CAP_TOP = ${f(SHOULDER_CAP.top)}, CAP_RIM = ${f(SHOULDER_CAP.rim)}, CAP_IN = ${f(LEG.fore.plate.inner)};
float capFace(float r) { float u = clamp(r / FP_R, 0.0, 1.0), w = 1.0 - u * u; return CAP_RIM + (CAP_TOP - CAP_RIM) * w * w; }
// the dome's solid (both sides): inside the circle, from the plate's inner face out to capFace
float shoulderDome(vec3 p) {
  float x = abs(p.x), r = length(p.yz - SH.yz), rc = min(r, FP_R);
  float u = rc / FP_R, s = 4.0 * (CAP_TOP - CAP_RIM) * u * (1.0 - u * u) / FP_R;
  vec2 e = vec2(r - FP_R, max((x - capFace(rc)) / sqrt(1.0 + s * s), CAP_IN - x));
  return min(max(e.x, e.y), 0.0) + length(max(e, 0.0));
}
// what a fixed mane over the shoulder keeps clear of: the dome grown by ${SHOULDER_CAP.clear * 1000} mm
float shoulderCap(vec3 p) { return shoulderDome(p) - ${f(SHOULDER_CAP.clear)}; }
// the panel outline in the side view, for the near flank (x > 0) or mirrored:
// its top edge a band of back below the spine, its lower edge following the
// belly's rise toward the stifle over a band of belly
float flankRegion(vec3 p) {
  float dz = p.z - ${f(FLANK.zc)};
  float top = trStation(TR_TOP, clamp(p.z, -0.6, 0.5)) - ${f(FLANK.below)};
  float bot = ${f(FLANK.bot)} + ${f(FLANK.slope)} * dz;
  return sd2RoundBox(vec2(dz, p.y - 0.5 * (top + bot)), vec2(${f(FLANK.hz)}, 0.5 * (top - bot)), ${f(FLANK.r)});
}

// the lock of a carved mane in its own frame: l = (along the flow, across, height above the base)
float lockSD(vec3 l, float len, float hw, float ht, float sway, float lift, float seed) {
  float h2 = fract(seed * 7.31 + 0.17), h3 = fract(seed * 13.7 + 0.53);
  // a flame: an S from the root, full a quarter of the way, tapering to a point
  vec2 B = vec2(len * 0.52, sway), C = vec2(len, -sway * (0.3 + 0.6 * h2));
  vec2 b = sd2Bezier(l.xy, vec2(0.0), B, C);
  float t = b.y;
  float w = t < 0.25 ? hw * (0.72 + 0.28 * sin(PI * t * 2.0)) : hw * (1.0 - pow((t - 0.25) / 0.75, 1.15)) + 0.004;
  float d2 = b.x - w;
  float cy = 2.0 * (1.0 - t) * t * B.y + t * t * C.y;
  float ac = clamp((l.y - cy) / max(w, 1e-4), -1.0, 1.0);
  // toward its tip the lock lifts off the ground it grows from, so it throws a shadow
  float lf = lift * smoothstep(0.25, 1.0, t);
  float top = ht * (0.45 + 0.55 * sqrt(max(1.0 - ac * ac, 0.0))) * (0.9 + 0.1 * t) + lf;
  // two rounded gouges follow it and run out before the point
  float g1 = -0.36 + 0.12 * h2, g2 = 0.3 + 0.12 * h3;
  float gv = exp(-pow((ac - g1) / 0.18, 2.0)) + 0.85 * exp(-pow((ac - g2) / 0.16, 2.0));
  top -= ht * 0.3 * min(gv, 1.0) * smoothstep(0.05, 0.3, t) * (1.0 - smoothstep(0.7, 0.9, t));
  float bot = -0.06 + lf * 0.85;
  vec2 e = vec2(d2 + 0.003, max(l.z - top, bot - l.z));
  return (min(max(e.x, e.y), 0.0) + length(max(e, 0.0))) - 0.003;
}
`

/* THE SHELL, in panels. The torso is a carved shell two fingers thick over
 * the frame; its panels meet in cut seams. The near flank panel is its own
 * part (FLANK_PANEL) so the inspection view can take it off; the far flank
 * keeps its panel and shows the same seam as a groove. */
const SHELL_COMMON = COMMON + /* glsl */ `
float shellHollow(vec3 p) {
  float s = torsoSolid(p);
  // the skin is cut only where the doors stand; the chest's box is a lining a
  // finger thick round the cavity, inside the body
  float c = cavity(p);
  float doorway = opening(p, -0.003);
  // (thick enough to run into the skin wherever the two come close, so no sliver of air lies between them)
  float lining = smax(max(max(c - 0.03, -c), s), -doorway, 0.006);
  float sh = min(smax(max(s, -(s + SHELL_T)), -doorway, 0.006), lining);
  sh = smin(sh, doorLip(p, s), 0.004);
  return max(sh, -(length(p - T0) - 0.05));
}
// the shoulder's seat: the recess its plate turns in, and the bearing hole behind it
float foreSeat(vec3 p) { vec3 q = vec3(abs(p.x), p.y, p.z); return max(FP_FLOOR - q.x, length(q.yz - SH.yz) - FP_R - SEAM_RING); }
float foreHole(vec3 p) { vec3 q = vec3(abs(p.x), p.y, p.z); return max(0.12 - q.x, length(q.yz - SH.yz) - FP_HOLE); }
// the floor each plate turns on, a finger thick whatever the skin's depth there
float seatFloors(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  // (its inner face kept 1 cm inside the skin's, so the two never nearly meet)
  float f = max(max(FP_FLOOR - 0.022 - q.x, q.x - FP_FLOOR), length(q.yz - SH.yz) - FP_R - 0.006);
  f = max(f, FP_HOLE - length(q.yz - SH.yz));
  float h = max(max(HQ_FLOOR - 0.022 - q.x, q.x - HQ_FLOOR), length(q.yz - HP.yz) - HQ_R - 0.006);
  return min(f, max(h, HQ_HOLE - length(q.yz - HP.yz)));
}
// the hip's seat and bearing hole, the same
float hindSeat(vec3 p) { vec3 q = vec3(abs(p.x), p.y, p.z); return max(HQ_FLOOR - q.x, length(q.yz - HP.yz) - HQ_R - SEAM_RING); }
float hindHole(vec3 p) { vec3 q = vec3(abs(p.x), p.y, p.z); return max(0.12 - q.x, length(q.yz - HP.yz) - HQ_HOLE); }
// where the flank's opening keeps off: the seats
float sockets(vec3 p) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  return min(max(0.12 - q.x, length(q.yz - SH.yz) - FP_R - SEAM_RING), max(0.12 - q.x, length(q.yz - HP.yz) - HQ_R - SEAM_RING));
}
// the flank panel's outline, kept two fingers off the sockets, so a band of
// shell rings each socket where the opening would leave a knife edge
float panelOutline(vec3 p) { return smax(flankRegion(p), ${f(FLANK.collar)} - sockets(p), 0.03); }
// a seam cut along a panel's edge: a V 8 mm wide at the face and 5 mm deep, only in the outer face
float seam(vec3 p, float edge, float s) {
  return max(abs(edge) - 0.004 - 0.8 * s, -(s + 0.005));
}
float grooves(vec3 p, float s) {
  vec3 q = vec3(abs(p.x), p.y, p.z);
  // the far flank's panel outline, and the seam along the belly
  float g = p.x < 0.0 ? seam(p, panelOutline(p), s) : 1e9;
  g = min(g, max(seam(p, p.x, s), p.y - 0.6));
  // the shoulder panels meet the neck in a cut ring under the mane
  g = min(g, max(seam(p, p.z - 0.47, s), 0.84 - p.y));
  return g;
}
float arborHole(vec3 p) { return max(length(p.yz - vec2(${f(ARBOR.y)}, ${f(ARBOR.z)})) - 0.021, -p.x); }
`

export const SHELL = SHELL_COMMON + /* glsl */ `
float map(vec3 p) {
  float s = torsoSolid(p);
  float d = shellHollow(p);
  d = smax(d, -grooves(p, s), 0.0015);
  // the near flank panel is lifted out, with the seam's own gap round it;
  // round the opening the shell stands twice as thick, the panel's rebate
  float region = max(panelOutline(p) - ${f(FLANK.gap / 2)}, ${f(FLANK.x)} - p.x);
  float sk = sockets(p);
  d = min(d, max(smax(max(s, -(s + SHELL_T + 0.018)), region - 0.028, 0.008), 0.02 - sk));
  // the opening's edge rounded over two of the shell's cells, so it draws clean
  d = smax(d, -region, 0.024);
  // the shoulders' and hips' seats and their bearing holes
  d = smax(d, -foreSeat(p), 0.003);
  d = max(d, -foreHole(p));
  d = smax(d, -hindSeat(p), 0.003);
  d = max(d, -hindHole(p));
  return min(d, seatFloors(p));
}
float matId(vec3 p) {
  float s = torsoSolid(p);
  float c = cavity(p);
  if (c > -0.002 && c < 0.014 && s < -0.004) return 1.0;
  // bare wood inside; the opening's cut faces painted round with the skin, so
  // the rim reads as a thick panel's edge and the paint ends inside, out of sight
  float region = max(panelOutline(p), ${f(FLANK.x)} - p.x);
  if (s < -SHELL_T * 0.45 && region > 0.014) return 4.0;
  return 0.0;
}
`

export const FLANK_PANEL = SHELL_COMMON + /* glsl */ `
float map(vec3 p) {
  float s = torsoSolid(p);
  float d = max(s, -(s + SHELL_T));
  d = smax(d, max(panelOutline(p) + ${f(FLANK.gap / 2)}, ${f(FLANK.x)} - p.x), 0.004);
  d = smax(d, -arborHole(p), 0.003);
  return smax(d, -sockets(p), 0.004);
}
float matId(vec3 p) {
  float s = torsoSolid(p);
  if (s < -SHELL_T * 0.45) return 4.0;
  if (abs(panelOutline(p)) < 0.006 && s < -0.003) return 4.0;
  if (length(p.yz - vec2(${f(ARBOR.y)}, ${f(ARBOR.z)})) < 0.026) return 4.0;
  return 0.0;
}
`


// ---- legs (+x side). Each piece is carved as the limb it stands for and
// turns on an iron pin at the animal's own joint: shoulder, elbow, wrist; hip,
// stifle, hock. A pin shows its head and washer on the outer face, and a
// forged strap on each upper piece runs to it, so the joint shows how it swings.
const LEG_COMMON = COMMON + /* glsl */ `
// a carved limb: a slab swept from a to b in the yz plane, its half width
// (across) and half depth growing from s0 to s1
float limb(vec3 p, vec3 a, vec3 b, vec2 s0, vec2 s1, float r) {
  vec2 ab = b.yz - a.yz; float L = length(ab); vec2 u = ab / L, v = vec2(-u.y, u.x);
  vec2 d = p.yz - a.yz; float t = dot(d, u), n = dot(d, v), k = clamp(t / L, 0.0, 1.0);
  vec2 sz = mix(s0, s1, k);
  return sdRoundBox(vec3(p.x - mix(a.x, b.x, k), n, t - 0.5 * L), vec3(sz.x, sz.y, 0.5 * L), min(r, min(sz.x, sz.y) * 0.95));
}
// the same with an oval section, for the muscled pieces, rounded at its ends
float limbE(vec3 p, vec3 a, vec3 b, vec2 s0, vec2 s1) {
  vec2 ab = b.yz - a.yz; float L = length(ab); vec2 u = ab / L, v = vec2(-u.y, u.x);
  vec2 d = p.yz - a.yz; float t = dot(d, u), n = dot(d, v), k = clamp(t / L, 0.0, 1.0);
  vec2 sz = mix(s0, s1, k);
  return sdEllipsoid(vec3(p.x - mix(a.x, b.x, k), n, t - k * L), vec3(sz, min(sz.x, sz.y)));
}
// where a piece may be through its whole swing about the pivot's axis, from
// angle a0 to a1: a centimetre clear of the body, or inside its socket
float clearOfBody(vec3 p, vec3 pivot, float r, float a0, float a1) {
  float socket = sdCappedCyl(p, vec3(0.1, pivot.y, pivot.z), vec3(0.45, pivot.y, pivot.z), r);
  float c = 0.012 - torsoSolid(p);
  if (c < -0.25) return min(c, socket);
  for (int i = 0; i <= 6; i++) {
    vec3 q = p;
    q.yz = pivot.yz + rot(mix(a0, a1, float(i) / 6.0)) * (p.yz - pivot.yz);
    c = max(c, 0.012 - torsoSolid(q));
  }
  return min(c, socket);
}
// an iron strap nailed along a piece's outer face, about 5 mm proud
float strap(vec3 p, float d, vec2 a, vec2 b, float hw, float xin) {
  vec2 sg = sd2Seg(p.yz, a, b);
  // its section a flat bar with edges rounded wider than the grid, so they stay clean
  vec2 e = vec2(sg.x - hw - 0.002 * (1.0 - sg.y) + 0.0025, max(d - 0.0027, -d - 0.009));
  return max(length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - 0.0025, xin - p.x);
}
// a nail's head on a strap
float nail(vec3 p, float d, vec2 at) { return max(length(p.yz - at) - 0.0055, max(d - 0.0072, -d - 0.004)); }
// a pin's head and its washer on a flat outer face at x = xs
float pinHead(vec3 p, vec3 c, float xs, float rw) {
  float washer = sdCappedCyl(p, vec3(xs - 0.006, c.y, c.z), vec3(xs + 0.0035, c.y, c.z), rw) - 0.0012;
  float head = max(length(p - vec3(xs - 0.004, c.y, c.z)) - rw * 0.62, xs + 0.001 - p.x);
  return min(washer, head);
}
// the foot, in the paw's frame (the pin at the origin, the floor at y0): one
// broad low mass with four short toes blended into it, the middle two longest,
// a plane across the knuckles' tops falling to the tips, grooves between the
// toes deep at the front, short blunt claws drawn in as a walking lion keeps
// them, the big pad behind; kept under the lap's disc above it
float foot(vec3 p, float y0, float z0, float w) {
  float d = sdEllipsoid(p - vec3(0.0, y0 + 0.031, z0 + 0.02), vec3(0.074 * w, 0.031, 0.075));
  float toes = 1e9;
  for (int i = 0; i < 4; i++) {
    float fi = float(i) - 1.5;
    vec3 c = vec3(fi * 0.037 * w, y0 + 0.029, z0 + 0.088 - abs(fi) * 0.02);
    vec3 q = p - c; q.yz = rot(-0.22) * q.yz;
    toes = min(toes, sdEllipsoid(q, vec3(0.0195 * w, 0.026, 0.037)));
    // a short sheathed claw, drawn into the toe's front (no thinner than two cells of the paw's grid)
    vec2 cl = sdBezier(p, c + vec3(0.0, -0.008, 0.024), c + vec3(0.0, -0.01, 0.031), c + vec3(0.0, -0.014, 0.032)).xy;
    toes = smin(toes, cl.x - mix(0.0048, 0.0034, cl.y), 0.004);
  }
  d = smin(d, toes, 0.01);
  // the plane across the knuckles' tops, low enough to flatten the toes
  d = smax(d, p.y - (y0 + 0.051 - 0.3 * max(p.z - z0 - 0.05, 0.0)), 0.012);
  // the grooves between the toes, deep at the front
  for (int i = 0; i < 3; i++) {
    float x = (float(i) - 1.0) * 0.037 * w;
    float g = smoothstep(z0 + 0.03, z0 + 0.1, p.z);
    // (the groove starts below the surface, so it never opens as a hairline slit)
    d = smax(d, -(length(vec2(p.x - x, max(p.y - y0 - 0.008, 0.0) * 0.45)) - 0.0068 * g + 0.0015 * (1.0 - g)), 0.004 * g + 0.0005);
  }
  // the big pad under the heel of the foot
  d = smin(d, sdEllipsoid(p - vec3(0.0, y0 + 0.022, z0 - 0.018), vec3(0.05 * w, 0.024, 0.04)), 0.02);
  return max(d, y0 - p.y);
}
`
// THE LEG KIT (round 3). A leg is carved as one limb at rest and cut at
// its joints: each joint a disc about its pin, the upper piece's outer
// cheek over the lower piece's inner cheek; outside the disc the pieces part
// on a plane through the pin. Round each pin the faces are the planes xo and
// xi, so the seam's circle stays flush at any angle.
const LEG_KIT = LEG_COMMON + /* glsl */ `
// in yz: a tapered capsule from a (radius ra) to b (radius rb), its flanks tangent to both circles
float taper2(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 ba = b - a; float h = length(ba); vec2 u = ba / h, d = p - a;
  vec2 q = vec2(abs(u.x * d.y - u.y * d.x), dot(d, u));
  float s = (ra - rb) / h, c = sqrt(max(1.0 - s * s, 0.0));
  float k = dot(q, vec2(-s, c));
  if (k < 0.0) return length(q) - ra;
  if (k > c * h) return length(q - vec2(0.0, h)) - rb;
  return dot(q, vec2(c, s)) - ra;
}
// an outline in yz (its distance d2) between the faces x = xi and x = xo, the edges rounded r
float slab(float d2, float x, float xi, float xo, float r) {
  vec2 w = vec2(d2 + r, max(xi - x, x - xo) + r);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - r;
}
// along (x) and across (y, positive behind) a segment from a to b in yz
vec2 segTN(vec2 q, vec2 a, vec2 b) { vec2 u = normalize(b - a), d = q - a; return vec2(dot(d, u), u.x * d.y - u.y * d.x); }
float ell2(vec2 q, vec2 r) { float k0 = length(q / r), k1 = length(q / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
// the lap joint about a pin at c (yz): the upper piece keeps the outer cheek
// (x above the parting xm) inside the disc of radius R and everything on its
// side of the plane through the pin (normal nb, toward the upper piece)
float lapUpper(vec3 p, vec2 c, float R, float xm, vec2 nb) {
  vec2 d = p.yz - c; float r = length(d);
  float outer = xm + 0.5 * SEAM_LAYER - p.x, side = -dot(d, nb);
  return min(min(max(outer, side), max(outer, r - R)), max(side, R + SEAM_RING - r));
}
float lapLower(vec3 p, vec2 c, float R, float xm, vec2 nb) {
  vec2 d = p.yz - c; float r = length(d);
  float inner = p.x - xm + 0.5 * SEAM_LAYER, side = dot(d, nb);
  return min(min(max(inner, side), max(inner, r - R)), max(side, R + SEAM_RING - r));
}
// the cut edges at a lap's seam, rounded under one cell of the film grid so the seam stays a line
const float LAP_K = 0.0015;
// the facets on a leg, in the rest frame, cells longer down the leg; none within
// 1.5 cm of a seam circle or on the plate, so the seams and the iron lie on the plain carving
float legFacets(vec3 P, float d) {
  if (abs(d) > 0.006) return 0.0;
  vec3 q = vec3(abs(P.x), P.y, P.z);
  float r = min(min(length(q.yz - KF.yz) - ${f(LEG.fore.elbow.R)}, length(q.yz - WF.yz) - ${f(LEG.fore.wrist.R)}),
                min(length(q.yz - KH.yz) - ${f(LEG.hind.stifle.R)}, length(q.yz - WH.yz) - ${f(LEG.hind.hock.R)}));
  r = min(r, min(length(q.yz - SH.yz) - 0.03, length(q.yz - HP.yz) - 0.03));
  return facets(P, 0.07, 0.0007, vec3(1.0, 1.5, 1.0)) * smoothstep(0.004, 0.016, r);
}
// the upper piece's disc where the lower piece runs on round it: a crisp rim,
// flush with the lower piece's face, so the seam is a line and not a rolled groove
float discRim(float rr, vec2 q, vec2 c, vec2 nb, float R) {
  float lower = smoothstep(0.004, -0.004, dot(q - c, nb)) * (1.0 - smoothstep(R + 0.004, R + 0.02, length(q - c)));
  return mix(rr, 0.0025, lower);
}
// a bump in [0, 1] over k in (k0, k3), full from k1 to k2
float bump(float k, float k0, float k1, float k2, float k3) { return smoothstep(k0, k1, k) * (1.0 - smoothstep(k2, k3, k)); }

// THE FORELEG
const float FE_R = ${f(LEG.fore.elbow.R)}, FE_XO = ${f(LEG.fore.elbow.xo)}, FE_XI = ${f(LEG.fore.elbow.xi)};
const float FW_R = ${f(LEG.fore.wrist.R)}, FW_XO = ${f(LEG.fore.wrist.xo)}, FW_XI = ${f(LEG.fore.wrist.xi)};
const float FP_INNER = ${f(LEG.fore.plate.inner)}, FP_RIM = ${f(LEG.fore.plate.rim)}, FP_SEAT = ${f(LEG.fore.plate.seat)}, FP_FLAT = ${f(LEG.fore.plate.flat)};
const vec2 NB_FE = ${v2(NB.foreElbow)}, NB_FW = ${v2(NB.foreWrist)};
const vec2 F_PASTERN = ${v2(PASTERN.fore)};
// a carved limb's outer face across its section: two broad planes meeting
// at a soft spine along the ridge line n = nr, falling by slope per metre
float gable(float n, float nr, float slope) { float a = n - nr; return -slope * sqrt(a * a + 0.00012); }
// a limb's side outline in yz: the tapered capsule from a (radius ra) to b
// (radius rb), widened in front (+v) by ef and behind by eb; both run to zero at the ends
float limb2(vec2 q, vec2 a, vec2 b, float ra, float rb, float ef, float eb) {
  vec2 tn = segTN(q, a, b);
  return taper2(q, a, b, ra, rb) - (tn.y > 0.0 ? eb : ef);
}
// the shoulder and the arm, one piece: inside the shoulder's circle the cap,
// a low dome of revolution under the mane's hood; below it the arm's mass,
// the triceps full behind, tapering to the elbow's disc
float foreArm(vec3 p) {
  vec2 q = p.yz, a = SH.yz, b = KF.yz;
  float L = length(b - a);
  vec2 tn = segTN(q, a, b);
  float k = clamp(tn.x / L, 0.0, 1.0), u = tn.x / L;
  float d2 = limb2(q, a, b, FP_R, FE_R, 0.028 * bump(k, 0.3, 0.52, 0.64, 0.86), 0.07 * bump(k, 0.12, 0.42, 0.6, 0.84));
  float r0 = length(q - SH.yz), re = length(q - KF.yz);
  // the arm's face: highest over the upper arm, two planes meeting at a soft
  // spine down its front third, flat round the elbow's pin
  float xo = 0.198 + (FP_SEAT - 0.198) * bump(u, -0.42, -0.02, 0.4, 0.86);
  xo = mix(xo, FE_XO, smoothstep(0.6, 0.74, k));
  float fz = 1.0 - smoothstep(FE_R + 0.012, FE_R + 0.035, re);
  xo += mix(gable(tn.y, -0.004 + 0.016 * k, 0.32), -coneFall(re, FE_R), fz);
  // (inside the circle the face is the cap alone, whatever the swing; the arm's mass rises from its rim)
  xo = mix(capFace(r0), xo, smoothstep(FP_R, FP_R + 0.08, r0));
  // the plate turns in its seat under the carving
  float xi = r0 < FP_R ? FP_INNER : (tn.x < 0.0 ? 0.0 : mix(FP_INNER, FE_XI, smoothstep(0.3, 0.62, k)));
  // edges rounded broad on the mass, fine at the cap's rim and where it meets the elbow's seam circle
  float rr = mix(0.007, 0.028, smoothstep(0.0, 0.03, re - FE_R - 0.02));
  rr = mix(0.004, rr, smoothstep(FP_R + 0.004, FP_R + 0.05, r0));
  rr = discRim(rr, q, KF.yz, NB_FE, FE_R);
  return slab(d2, p.x, xi, xo, rr);
}
// the forearm, a column: the flexors full behind in its upper half, the front nearly straight;
// the masses swell in over a hand's length below the elbow's disc (a quick swell read as a cuff)
float foreForearm(vec3 p) {
  vec2 q = p.yz, a = KF.yz, b = WF.yz;
  float L = length(b - a);
  vec2 tn = segTN(q, a, b);
  float k = clamp(tn.x / L, 0.0, 1.0);
  float d2 = limb2(q, a, b, FE_R, FW_R, 0.016 * bump(k, 0.2, 0.42, 0.5, 0.76), 0.034 * bump(k, 0.2, 0.42, 0.5, 0.78));
  float re = length(q - a), rw = length(q - b);
  float fzE = 1.0 - smoothstep(FE_R + 0.012, FE_R + 0.035, re), fzW = 1.0 - smoothstep(FW_R + 0.012, FW_R + 0.032, rw);
  float fz = max(fzE, fzW), cone = fzE >= fzW ? coneFall(re, FE_R) : coneFall(rw, FW_R);
  float m = bump(k, 0.24, 0.48, 0.55, 0.8) * (1.0 - fz);
  float xo = mix(FE_XO, FW_XO, smoothstep(0.3, 0.72, k)) + 0.016 * m;
  float xi = mix(FE_XI, FW_XI, smoothstep(0.3, 0.72, k)) - 0.01 * m;
  xo += mix(gable(tn.y, -0.01, 0.2), -cone, fz);
  float rr = mix(0.007, 0.018, smoothstep(0.0, 0.03, min(re - FE_R - 0.02, rw - FW_R - 0.02)));
  rr = discRim(rr, q, WF.yz, NB_FW, FW_R);
  return slab(d2, p.x, xi, xo, rr);
}
float forePaw(vec3 p) {
  vec3 w = p - WF;
  float y0 = -WF.y;
  // the pastern, broad and short, from the wrist's disc down and a little forward into the foot
  float d2 = taper2(w.yz, vec2(0.0), F_PASTERN, FW_R, 0.05);
  float r = length(w.yz);
  float wide = smoothstep(FW_R + 0.022, 0.1, r);
  float xo = FW_XO - WF.x + 0.018 * wide - coneFall(r, FW_R), xi = FW_XI - WF.x - 0.018 * wide;
  float pastern = slab(d2, w.x, xi, xo, mix(0.006, 0.02, smoothstep(0.0, 0.03, r - FW_R - 0.02)));
  return smin(pastern, foot(w, y0, 0.02, 1.1), 0.014);
}
// where the upper piece may be: on its seat, the boss in the bearing hole, or 6 mm clear of the body through its swing
// (the two rules joined by min and max, so the field stays whole across the plate's rim)
float clearFore(vec3 p) {
  float r0 = length(p.yz - SH.yz), rim = r0 - FP_R - 0.0005;
  float plate = smax(min(FP_INNER - p.x, max(r0 - 0.06, 0.13 - p.x)), rim, 0.003);
  float c = 0.006 - torsoSolid(p);
  if (c > -0.25) for (int i = 0; i <= 6; i++) {
    vec3 q = p;
    q.yz = SH.yz + rot(mix(-0.47, 0.27, float(i) / 6.0)) * (p.yz - SH.yz);
    c = max(c, 0.006 - torsoSolid(q));
  }
  return smin(plate, smax(c, -rim, 0.003), 0.003);
}

// THE HIND LEG
const float HS_R = ${f(LEG.hind.stifle.R)}, HS_XO = ${f(LEG.hind.stifle.xo)}, HS_XI = ${f(LEG.hind.stifle.xi)};
const float HH_R = ${f(LEG.hind.hock.R)}, HH_XO = ${f(LEG.hind.hock.xo)}, HH_XI = ${f(LEG.hind.hock.xi)};
const float HQ_INNER = ${f(LEG.hind.plate.inner)}, HQ_SEAT = ${f(LEG.hind.plate.seat)}, HQ_FLAT = ${f(LEG.hind.plate.flat)};
const vec2 NB_HS = ${v2(NB.hindStifle)}, NB_HH = ${v2(NB.hindHock)};
const vec2 H_PASTERN = ${v2(PASTERN.hind)};
// the haunch and the thigh, one teardrop: broad over the plate, full behind
// over the hamstrings, the quadriceps in front running on tangent off the
// plate's circle, tapering to the stifle's disc
float hindThigh(vec3 p) {
  vec2 q = p.yz, a = HP.yz, b = KH.yz;
  float L = length(b - a);
  vec2 tn = segTN(q, a, b);
  float k = clamp(tn.x / L, 0.0, 1.0), u = tn.x / L;
  float d2 = limb2(q, a, b, HQ_R, HS_R, 0.034 * bump(k, 0.0, 0.3, 0.55, 0.8), 0.08 * bump(k, 0.08, 0.38, 0.6, 0.95));
  // the haunch's top: the thigh's mass runs on over the bearing, up and back onto the croup's side
  d2 = smin(d2, taper2(q, HP.yz, HP.yz + vec2(0.11, -0.07), HQ_R, 0.05), 0.07);
  float r0 = length(q - a), re = length(q - b);
  float xo = 0.198 + (HQ_SEAT - 0.198) * bump(u, -0.4, -0.02, 0.45, 0.9);
  xo = mix(xo, HS_XO, smoothstep(0.55, 0.72, k));
  float fzP = 1.0 - smoothstep(HQ_FLAT, HQ_FLAT + 0.03, r0), fzS = 1.0 - smoothstep(HS_R + 0.012, HS_R + 0.035, re);
  float fz = max(fzP, fzS);
  xo += mix(gable(tn.y, 0.03, 0.32), fzS >= fzP ? -coneFall(re, HS_R) : 0.0, fz);
  // (inside the seat's ring the face never falls under the body's skin, or the
  // plate thins to nothing at its top and the seat's floor shows through a torn edge)
  xo = smax(xo, mix(HQ_SKIN + 0.002, 0.0, smoothstep(HQ_R - 0.004, HQ_R + 0.012, r0)), 0.01);
  float xi = r0 < HQ_R ? HQ_INNER : (tn.x < 0.0 ? 0.0 : mix(HQ_INNER, HS_XI, smoothstep(0.3, 0.62, k)));
  float rr = mix(0.007, 0.028, smoothstep(0.0, 0.03, re - HS_R - 0.02));
  // (fine at the plate's rim, so it meets its seat without a rolled groove)
  rr = mix(0.005, rr, smoothstep(HQ_R + 0.004, HQ_R + 0.04, r0));
  rr = discRim(rr, q, KH.yz, NB_HS, HS_R);
  return slab(d2, p.x, xi, xo, rr);
}
// the gaskin: the calf high and short behind, just under the stifle, then a
// slim tendon down to the point of the hock; the shin straight, thinner below
// its middle, to the hock's disc
float hindGaskin(vec3 p) {
  vec2 q = p.yz, a = KH.yz, b = WH.yz;
  float L = length(b - a);
  vec2 tn = segTN(q, a, b);
  float k = clamp(tn.x / L, 0.0, 1.0);
  float d2 = limb2(q, a, b, HS_R, HH_R, 0.02 * bump(k, 0.24, 0.44, 0.5, 0.7), 0.045 * bump(k, 0.02, 0.16, 0.26, 0.52) + 0.01 * bump(k, 0.36, 0.52, 0.8, 0.94));
  float re = length(q - a), rw = length(q - b);
  float thin = 0.01 * smoothstep(0.4, 0.6, k) * (1.0 - smoothstep(0.74, 0.86, k));
  float xo = mix(HS_XO, HH_XO, smoothstep(0.25, 0.75, k)) - thin;
  float xi = mix(HS_XI, HH_XI, smoothstep(0.25, 0.75, k)) + thin;
  float fzS = 1.0 - smoothstep(HS_R + 0.012, HS_R + 0.035, re), fzH = 1.0 - smoothstep(HH_R + 0.012, HH_R + 0.032, rw);
  float fz = max(fzS, fzH), cone = fzS >= fzH ? coneFall(re, HS_R) : coneFall(rw, HH_R);
  xo += mix(gable(tn.y, 0.0, 0.2), -cone, fz);
  float rr = mix(0.007, 0.018, smoothstep(0.0, 0.03, min(re - HS_R - 0.02, rw - HH_R - 0.02)));
  rr = discRim(rr, q, WH.yz, NB_HH, HH_R);
  return slab(d2, p.x, xi, xo, rr);
}
// the hind foot in the paw's frame (the hock pin at the origin): the cannon
// broad and square from the hock's disc down into the foot
float hindPawShape(vec3 p) {
  float y0 = -WH.y;
  float d2 = taper2(p.yz, vec2(0.0), H_PASTERN, HH_R, 0.036);
  float r = length(p.yz);
  float wide = smoothstep(0.1, 0.19, r);
  float xo = HH_XO - WH.x + 0.012 * wide - coneFall(r, HH_R), xi = HH_XI - WH.x - 0.012 * wide;
  // (rounded across, so the cannon is a limb and not a square boot)
  float cannon = slab(d2, p.x, xi, xo, mix(0.006, 0.022, smoothstep(0.0, 0.03, r - HH_R - 0.02)));
  return smin(cannon, foot(p, y0, 0.07, 0.95), 0.016);
}
// where the thigh may be: on its seat, the boss in the bearing hole, or 6 mm clear of the body through its swing
float clearHind(vec3 p) {
  float r0 = length(p.yz - HP.yz), rim = r0 - HQ_R - 0.0005;
  float plate = smax(min(HQ_INNER - p.x, max(r0 - 0.06, 0.13 - p.x)), rim, 0.003);
  float c = 0.006 - torsoSolid(p);
  if (c > -0.25) for (int i = 0; i <= 6; i++) {
    vec3 q = p;
    q.yz = HP.yz + rot(mix(-0.29, 0.57, float(i) / 6.0)) * (p.yz - HP.yz);
    c = max(c, 0.006 - torsoSolid(q));
  }
  return smin(plate, smax(c, -rim, 0.003), 0.003);
}
`
export const FORE_UPPER = LEG_KIT + /* glsl */ `
float map(vec3 p) {
  float d = foreArm(p);
  d += legFacets(p, d);
  // the turned boss behind the plate, in the bearing hole
  d = min(d, slab(length(p.yz - SH.yz) - 0.06, p.x, 0.13, FP_INNER + 0.004, 0.004));
  d = smax(d, lapUpper(p, KF.yz, FE_R, KF.x, NB_FE), LAP_K);
  // (the clearance cut rounded away from the plate's ring, as the thigh's)
  float cl = clearFore(p);
  return mix(max(d, cl), smax(d, cl, 0.006), smoothstep(FP_R + 0.01, FP_R + 0.03, length(p.yz - SH.yz)));
}
float matId(vec3 p) { return 0.0; }
`
export const FORE_LOWER = LEG_KIT + /* glsl */ `
float map(vec3 p) {
  float d = foreForearm(p);
  d += legFacets(p, d);
  d = smax(d, lapLower(p, KF.yz, FE_R, KF.x, NB_FE), LAP_K);
  return smax(d, lapUpper(p, WF.yz, FW_R, WF.x, NB_FW), LAP_K);
}
float matId(vec3 p) { return 0.0; }
`
export const HIND_UPPER = LEG_KIT + /* glsl */ `
float map(vec3 p) {
  float d = hindThigh(p);
  d += legFacets(p, d);
  // the turned boss behind the plate, in the bearing hole
  d = min(d, slab(length(p.yz - HP.yz) - 0.06, p.x, 0.13, HQ_INNER + 0.004, 0.004));
  d = smax(d, lapUpper(p, KH.yz, HS_R, KH.x, NB_HS), LAP_K);
  // (away from the seat's ring the clearance cut is rounded, so where it runs
  // along the thigh's front at a grazing angle its edge is carved and not torn;
  // at the ring it stays sharp, where rounding would groove the seam)
  float cl = clearHind(p);
  return mix(max(d, cl), smax(d, cl, 0.006), smoothstep(HQ_R + 0.01, HQ_R + 0.03, length(p.yz - HP.yz)));
}
float matId(vec3 p) { return 0.0; }
`
export const HIND_LOWER = LEG_KIT + /* glsl */ `
float map(vec3 p) {
  float d = hindGaskin(p);
  d += legFacets(p, d);
  d = smax(d, lapLower(p, KH.yz, HS_R, KH.x, NB_HS), LAP_K);
  return smax(d, lapUpper(p, WH.yz, HH_R, WH.x, NB_HH), LAP_K);
}
float matId(vec3 p) { return 0.0; }
`
// the fore paw in its own frame: origin at the wrist pin, the floor at y = -wrist height
export const PAW = LEG_KIT + /* glsl */ `
float map(vec3 p) {
  vec3 P = p + WF;
  float d = forePaw(P);
  d += legFacets(P, d);
  return smax(d, lapLower(P, WF.yz, FW_R, WF.x, NB_FW), LAP_K);
}
float matId(vec3 p) { return 0.0; }
`
// the hind foot in its own frame: origin at the hock pin, the floor at y = -hock height
export const HIND_PAW = LEG_KIT + /* glsl */ `
float map(vec3 p) {
  vec3 P = p + WH;
  float d = hindPawShape(p);
  d += legFacets(P, d);
  return smax(d, lapLower(P, WH.yz, HH_R, WH.x, NB_HH), LAP_K);
}
float matId(vec3 p) { return 0.0; }
`
// the +x door: the breast's outer shell inside the outline, bare wood inside
export const DOOR = COMMON + LOCK_SHAPES + /* glsl */ `
#define BREAST_ARM 2
// the fixed skin round the opening
float frame(vec3 q) {
  float s = torsoSolid(q);
  return min(max(max(s, -(s + SHELL_T)), -opening(q, -0.003)), doorLip(q, s));
}
// near its hinge, and along its top under the throat, the door is eased
// wherever its swing would bite the frame
float swingRelief(vec3 p) {
  vec2 h = p.xz - HINGE.xz;
  // where the relief may cut, as one continuous field (a switch here leaves a step in the door)
  float gate = min(max(0.05 - length(h), p.y - 0.745), min(p.y - 0.5, 0.82 - p.y));
  // outside the zone, a value past the door's smooth max (0.006), so its edge draws no crease
  if (gate < -0.004) return gate - 0.006;
  float c = -1.0;
  for (int i = 1; i <= 12; i++) {
    float a = DOOR_OPEN * pow(float(i) / 12.0, 1.5);
    vec2 r = vec2(h.x * cos(a) + h.y * sin(a), h.y * cos(a) - h.x * sin(a));
    c = smax(c, 0.005 - frame(vec3(HINGE.x + r.x, p.y, HINGE.z + r.y)), 0.004);
  }
  return -smax(-c, -gate, 0.004);
}
// the mane runs on over the doors: three locks on each, a flame, a curl and a
// broad lock falling from the throat, each whole inside its door, in the body's paint
float breastLocks(vec3 p, float s) {
  float d = 1e9;
  for (int i = 0; i < 3; i++) {
    // root (x, y), length, half width; half thickness, curl, kind, turn outward
    vec4 r = i == 0 ? vec4(0.046, 0.748, 0.12, 0.027) : (i == 1 ? vec4(0.1, 0.738, 0.1, 0.023) : vec4(0.074, 0.655, 0.08, 0.022));
    vec4 k = i == 0 ? vec4(0.009, 0.18, 0.0, 0.08) : (i == 1 ? vec4(0.008, -0.3, 1.0, 0.12) : vec4(0.008, 0.12, 2.0, 0.04));
    vec2 f = rot(-k.w) * vec2(r.y - p.y, p.x - r.x);
    if (length(f - vec2(0.5 * r.z, 0.0)) > 0.5 * r.z + r.w + 0.03) continue;
    d = smin(d, lockShape(vec3(f, s), r.z, r.w, k.x, k.y, 0.0, k.z), 0.006);
  }
  return d;
}
float map(vec3 p) {
  float s = torsoSolid(p);
  float shell = max(s, -(s + DOOR_T));
  float region = max(opening(p, 0.005), 0.0025 - p.x);
#if BREAST_ARM == 1
  shell = min(shell, max(breastLocks(p, s), -(s + DOOR_T)));
#endif
  // the hinges' straps are iron on the outer face (works.ts), the back of the panel plain
  float d = smax(shell, region, 0.004);
  d = smax(d, 0.001 - doorLip(p, s), 0.003);
  return smax(d, swingRelief(p), 0.006);
}
float matId(vec3 p) {
  float s = torsoSolid(p);
  float region = max(opening(p, 0.005), 0.0025 - p.x);
  // the inner face bare limewood, as a carver leaves the back of a panel
  if (s < -(DOOR_T - 0.006) && region < -0.006 && p.x > 0.008) return 4.0;
  return 0.0;
}
`
// a gilded lily in relief, front toward +z
export const LILY = /* glsl */ `
float map(vec3 p) {
  const float S = 0.118;
  float d2 = fleur(p.xy / S) * S;
  float inside = max(-d2, 0.0);
  float top = 0.006 + 0.014 * sqrt(min(inside / 0.014, 1.0));
  // its edges rounded 1.8 mm, past the grid's cell, the faces where they were
  vec2 e = vec2(d2 + 0.0018, max(p.z - top, -p.z - 0.003) + 0.0006);
  float d = (min(max(e.x, e.y), 0.0) + length(max(e, 0.0))) - 0.0018;
  d = min(d, sdCapsule(p, vec3(0.0, -0.035, -0.001), vec3(0.0, -0.035, -0.03), 0.006));
  return d;
}
float matId(vec3 p) { return 5.0; }
`

export interface CarvedSpec { glsl: string; bmin: [number, number, number]; bmax: [number, number, number]; h: number; aoR: number; curvR?: number }

/** The carved parts, their boxes and their grid steps at the finest tier. */
export const CARVED: Record<string, CarvedSpec> = {
  shell: { glsl: SHELL, bmin: [-0.3, 0.36, -0.84], bmax: [0.3, 1.25, 0.87], h: 0.004, aoR: 0.06 },
  flank: { glsl: FLANK_PANEL, bmin: [0.02, 0.48, -0.36], bmax: [0.24, 1.08, 0.24], h: 0.004, aoR: 0.05 },
  head: { ...HEAD_PARTS.head, glsl: COMMON + HEAD_PARTS.head.glsl },
  face: { ...HEAD_PARTS.face, glsl: COMMON + HEAD_PARTS.face.glsl },
  foreUpper: { glsl: FORE_UPPER, bmin: [0.08, 0.35, 0.15], bmax: [0.26, 1.0, 0.49], h: 0.0021, aoR: 0.04 },
  foreLower: { glsl: FORE_LOWER, bmin: [0.08, 0.05, 0.26], bmax: [0.24, 0.5, 0.47], h: 0.0024, aoR: 0.03 },
  hindUpper: { glsl: HIND_UPPER, bmin: [0.08, 0.36, -0.75], bmax: [0.26, 1.0, -0.24], h: 0.0021, aoR: 0.04 },
  hindLower: { glsl: HIND_LOWER, bmin: [0.1, 0.19, -0.66], bmax: [0.24, 0.56, -0.24], h: 0.0024, aoR: 0.03 },
  paw: { glsl: PAW, bmin: [-0.1, -0.12, -0.08], bmax: [0.1, 0.065, 0.18], h: 0.002, aoR: 0.025 },
  hindPaw: { glsl: HIND_PAW, bmin: [-0.1, -0.25, -0.08], bmax: [0.1, 0.065, 0.25], h: 0.002, aoR: 0.025 },
  tail: { ...HEAD_PARTS.tail, glsl: COMMON + HEAD_PARTS.tail.glsl },
  door: { glsl: DOOR, bmin: [-0.004, 0.5, 0.29], bmax: [0.2, 0.82, 0.7], h: 0.0015, aoR: 0.02 },
  lily: { glsl: LILY, bmin: [-0.064, -0.05, -0.042], bmax: [0.064, 0.085, 0.027], h: 0.0011, aoR: 0.012, curvR: 0.0025 },
}
