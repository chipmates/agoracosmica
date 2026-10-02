/**
 * cosmos/rose-film/shaders — GLSL for the entry film.
 *
 * One body of light: every point knows its place in the river and its place
 * in the rose. The rose is seen from below, as the two on the rock see it: a
 * sun, tiers of the blessed inside the round, a wreath of wings outside it.
 */

const HEAD = /* glsl */ `#version 300 es
precision highp float;
`;

const COMMON_UNIFORMS = /* glsl */ `
uniform mat4 uProj;
uniform mat4 uView;
uniform mat3 uModel;
uniform float uT;
uniform float uRot;
uniform float uPx;
`;

/* The body of light: river, ring, rose. Most points are grains of light,
   some are figures: they arrive as light and take a shape in their tier. */
export const POINT_VS = `${HEAD}${COMMON_UNIFORMS}
const float PI = 3.141592653589793;
layout(location = 0) in vec4 aA; // rank along the river, across (gaussian), depth (gaussian), seed
layout(location = 1) in vec4 aB; // place along the round, radius in the rose, size seed, kind seed
layout(location = 2) in vec2 aC; // figure seed (0: a grain of light), wings (0 or 1)
uniform float uBloom;
uniform float uBend;
uniform float uRingR;
uniform float uLift;
uniform float uRiverRot;
uniform float uWidth;
uniform float uRingness;
uniform float uSizeMul;
uniform float uFade;
uniform float uPour;
uniform float uShear;
uniform float uFigMax;   // the largest half size a point may have, in pixels
uniform float uDense;    // how thickly the grains lie on this screen: their light is thinned by it
uniform vec3 uGold;
uniform vec3 uGoldBright;
uniform vec3 uWhite;
uniform vec3 uBlue;
out vec3 vCol;
flat out vec4 vFig;   // how much of a figure it is, the way its head points (x, y), its half size in pixels
flat out vec3 vPose;  // wings (0 or 1), how high the wings are held (an angle), how the robe trails

float wrapPi(float a) { return mod(a + PI, 2.0 * PI) - PI; }

void main() {
  float theta = aB.x, rT = aB.y;
  float seed = aA.w, sizeSeed = aB.z, kind = aB.w;

  // ---- its place in the rose ----------------------------------------------
  float inw = clamp((uRingR - rT) / uRingR, 0.0, 1.0);        // 0 on the round, 1 at the sun
  float outw = clamp((rT - uRingR - 0.08) / 0.6, 0.0, 1.0);   // 0 on the round, 1 at the wreath's rim
  // The round stands. Its light streams inwards tier by tier, then the wreath gathers outside it.
  float delay = rT < uRingR ? 0.04 + 0.52 * inw : 0.4 + 0.3 * outw;
  float m = clamp((uBloom - delay - 0.16 * seed) / 0.3, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);

  // ---- river / ring -------------------------------------------------------
  // On its way, a point runs ahead along the round: a spiral.
  float lag = -0.7 * (1.0 - (1.0 - m) * (1.0 - m));
  float phi = wrapPi(PI - theta - uRot + lag + uShear * (seed - 0.5) * 2.0);
  float sN = phi / PI;
  float kap = max(uBend, 0.0004) / uRingR;
  float s = sN * PI * uRingR;
  vec2 c = vec2(sin(kap * s) / kap, (1.0 - cos(kap * s)) / kap - uRingR + uLift);
  vec2 nrm = vec2(-sin(kap * s), cos(kap * s));

  float across = aA.y;
  // Sparks leap out of the river and fall back into it.
  float spark = step(kind, 0.008);
  float haze = step(0.008, kind) * step(kind, 0.03);
  float leap = spark * pow(max(0.0, sin(uT * (0.5 + seed) + seed * 40.0)), 3.0) * (1.0 - uRingness);
  across *= 1.0 + 0.5 * leap;
  // The head of the pouring river comes to a point.
  across *= mix(0.12, 1.0, smoothstep(0.0, 0.8, uPour - sN));
  // The round river settles into concentric circles.
  float tiers = 2.0;
  float q = floor(across * tiers + 0.5) / tiers;
  across = mix(across, q + (across - q) * 0.12, uRingness * (1.0 - haze));
  // A dark rift along the river, as in the Milky Way.
  float rift = 0.55 + 0.45 * smoothstep(0.0, 0.5, abs(aA.y - 0.28 * sin(sN * 5.0 + 1.3) - 0.1));
  rift = mix(rift, 1.0, uRingness);

  vec2 rp = c + nrm * across * uWidth;
  float cr = cos(uRiverRot), sr = sin(uRiverRot);
  vec3 ring = vec3(rp.x * cr - rp.y * sr, rp.x * sr + rp.y * cr, aA.z * uWidth * 0.8);
  // The river's two ends stay soft until the round has closed, so they join without a seam.
  float tip = mix(smoothstep(1.0, 0.8, abs(sN)), 1.0, pow(uBend, 400.0));
  // The river pours into the night, its head brightest.
  tip *= smoothstep(uPour, uPour - 0.05, sN) * (1.0 + 1.6 * smoothstep(uPour - 0.3, uPour - 0.02, sN));
  // Clouds of stars along the river: they travel with it.
  float home = PI - theta;
  float clump = 0.5 + 0.5 * sin(home * 3.0 + 1.7 * sin(aA.y * 1.9 + home * 0.7)) * sin(home * 1.3 + 0.6 + aA.y);
  clump = 0.25 + 0.75 * clump * clump * 1.6;
  tip *= mix(clump, 1.0, uRingness);

  // ---- rose ---------------------------------------------------------------
  float a0 = atan(ring.y, ring.x);
  float r0 = length(ring.xy);
  // Each tier turns a little by itself, the inner ones faster.
  float turn = 0.028 * max(uT - 7.0, 0.0) * (0.35 + inw - 0.45 * outw);
  float a = a0 - m * turn;
  float r = mix(r0, rT, m);
  vec3 local = vec3(cos(a) * r, sin(a) * r, ring.z * (1.0 - m));

  vec3 w = uModel * local;
  vec4 v = uView * vec4(w, 1.0);
  float pxW = uPx / max(0.1, -v.z);

  // ---- size ---------------------------------------------------------------
  float big = pow(sizeSeed, 16.0);
  float fig = step(0.0001, aC.x);
  float riverSize = mix(0.0022 + 0.0024 * sizeSeed * sizeSeed + 0.011 * big, 0.1 + 0.07 * sizeSeed, haze) * uSizeMul;
  float grainSize = (0.0022 + 0.0022 * rT + 0.006 * big) * (0.7 + 0.6 * sizeSeed) * uSizeMul;
  // A figure is as tall as its tier is deep: small by the sun, large in the wreath.
  float tall = mix(0.085, 0.125, smoothstep(uRingR + 0.06, uRingR + 0.3, rT)) * rT * (0.8 + 0.5 * sizeSeed);
  float roseSize = mix(mix(grainSize, riverSize, haze), tall * 0.7, fig);
  float size = mix(riverSize, roseSize, m);
  size *= 1.0 + 0.6 * sin(m * PI) * (1.0 - haze) * (1.0 - fig);
  float px = size * pxW;
  float energy = min(1.0, px * px);
  px = min(max(1.5, px), uFigMax);
  gl_PointSize = px * 2.0;

  // ---- the figure's pose --------------------------------------------------
  vec2 radial = vec2(cos(a), sin(a));
  vec2 flight = vec2(radial.y, -radial.x);
  float fs = fract(aC.x * 17.3);
  // All of them are turned to the light, heads inwards, like the petals of
  // one flower. Further out they hold their place more loosely.
  float loose = mix(0.12, 0.5, smoothstep(uRingR - 0.3, uRingR + 0.4, rT));
  vec2 up = normalize(-radial + (fs - 0.5) * 2.0 * loose * flight);
  float figA = fig * smoothstep(0.4, 1.0, m);
  vFig = vec4(figA, up, px);
  // Their robes trail behind the rose's turning.
  // Each holds its wings in its own way and moves them a little.
  float lift = mix(0.22, 0.78, fract(aC.x * 5.3)) + 0.1 * sin(uT * (0.9 + 1.4 * fs) + aC.x * 80.0);
  vPose = vec3(aC.y, lift, 0.35 + 0.65 * fract(aC.x * 7.7));

  // ---- light --------------------------------------------------------------
  float tw = 0.72 + 0.28 * sin(uT * (1.2 + 2.6 * seed) + seed * 90.0);
  vec3 tint = mix(uWhite, uGold, 0.8 * smoothstep(0.7, 1.0, fract(seed * 7.31)));
  tint = mix(tint, uBlue, step(0.97, fract(seed * 13.7)) * 0.5);
  float riverI = (0.045 + 0.095 * sizeSeed * sizeSeed + 1.8 * big) * rift * tip * (1.0 + 1.0 * leap) * pow(uWidth / 0.21, 0.8) * mix(exp(-0.42 * aA.y * aA.y) * 1.5, 1.0, uRingness);

  // In the rose: ivory, warmer towards the sun, a breath cooler in the wreath.
  vec3 roseTint = mix(mix(uWhite, uGoldBright, 0.08 + 0.42 * inw * inw), uBlue, 0.16 * outw);
  float depthLight = (0.75 + 0.85 * inw) * (1.0 - 0.5 * outw);
  float grainI = (0.09 + 0.16 * sizeSeed * sizeSeed + 1.4 * big) * depthLight / sqrt(uDense);
  float figI = 0.8 * depthLight * (0.75 + 0.5 * fract(aC.x * 3.1));
  float roseI = mix(grainI, figI, fig);

  vec3 col = mix(tint * riverI, roseTint * roseI, m);
  col = mix(col, mix(uWhite, uGold, 0.5) * mix(0.05 * tip, 0.012, m), haze);
  col *= 1.0 - 0.45 * pow(max(sin(m * PI), 0.0), 0.6);
  vCol = col * mix(tw, 1.0, max(haze, figA)) * mix(energy, 1.0, figA) * uFade;

  gl_Position = uProj * v;
}
`;

export const POINT_FS = `${HEAD}
in vec3 vCol;
flat in vec4 vFig;
flat in vec3 vPose;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  float grain = r2 > 1.0 ? 0.0 : exp(-r2 * 4.5);
  if (vFig.x < 0.001) {
    if (r2 > 1.0) discard;
    o = vec4(vCol * grain, 1.0);
    return;
  }
  // The figure's own frame: its head points along vFig.yz.
  vec2 q = vec2(d.x, -d.y);
  vec2 up = vFig.yz;
  vec2 p = vec2(dot(q, vec2(up.y, -up.x)), dot(q, up));
  float aa = 1.3 / max(vFig.w, 1.0);

  // A figure of light: brightest at the head and the breast, its robe
  // trailing to one side and dissolving towards the hem.
  float t = clamp((0.4 - p.y) / 1.15, 0.0, 1.0);
  float bx = p.x - vPose.z * 0.34 * t * t;
  float wide = mix(0.06, 0.2, pow(t, 0.75));
  float soft = aa + 0.06 * t * t;
  float robe = (1.0 - smoothstep(wide - soft, wide + soft, abs(bx))) * smoothstep(0.42 + aa, 0.42 - aa, p.y) * smoothstep(-0.9, -0.62, p.y);
  robe *= mix(1.0, 0.4, pow(t, 1.2));
  float head = 1.0 - smoothstep(0.088 - aa, 0.088 + aa, length(p - vec2(0.0, 0.52)));

  // Wings: raised from the shoulders, bright along the leading edge, fading into the feathers.
  float wing = 0.0;
  if (vPose.x > 0.5) {
    vec2 wq = vec2(abs(p.x), p.y) - vec2(0.05, 0.37);
    float ca = cos(vPose.y), sa = sin(vPose.y);
    vec2 wr = vec2(wq.x * ca + wq.y * sa, -wq.x * sa + wq.y * ca);
    float along = clamp(wr.x / 0.76, 0.0, 1.0);
    // Broad by the shoulder, a long pointed tip.
    float deep = 0.58 * pow(along, 0.5) * pow(1.0 - along, 0.85) + 0.004;
    float below = -wr.y;
    float inside = smoothstep(-aa, aa, below + 0.012) * (1.0 - smoothstep(deep - 1.5 * aa, deep + 1.5 * aa, below));
    inside *= step(0.0, wr.x) * (1.0 - smoothstep(0.74, 0.76, wr.x));
    // Feathers: fine ribs fanning from the shoulder, where there is room to see them.
    float rib = 0.82 + 0.18 * sin(atan(below, wr.x + 0.1) * 46.0) * smoothstep(8.0, 16.0, vFig.w);
    wing = inside * (1.0 - 0.6 * clamp(below / deep, 0.0, 1.0)) * (0.6 + 0.4 * (1.0 - along)) * rib;
  }
  float breast = exp(-dot(p - vec2(0.0, 0.3), p - vec2(0.0, 0.3)) / 0.09);
  float a = max(max(head * 1.1, robe), 0.9 * wing) + 0.16 * breast;
  o = vec4(vCol * mix(grain, a, vFig.x), 1.0);
}
`;

/* A plain round light: the stars and the guide's lights. */
export const DOT_FS = `${HEAD}
in vec3 vCol;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  o = vec4(vCol * exp(-r2 * 4.5), 1.0);
}
`;

/* The far stars. They turn a little around the point, then stand still.
   They are placed on the frame itself, so the picture's zoom never moves them. */
export const STAR_VS = `${HEAD}${COMMON_UNIFORMS}
layout(location = 0) in vec4 aS; // x, y (disc), size seed, seed
uniform float uStarRot;
uniform float uSizeMul;
uniform float uFade;
uniform vec3 uStarFrame; // the turning point (clip x, y) and the frame's aspect
uniform vec4 uWords;     // the words' box: centre and half size, shares of the frame
uniform float uWordsOn;
uniform vec4 uRose;      // the rose: its centre (clip x, y), its radius (in frame heights), how much of it is there
uniform vec3 uGold;
uniform vec3 uWhite;
uniform vec3 uBlue;
out vec3 vCol;
void main() {
  float c = cos(uStarRot), s = sin(uStarRot);
  vec2 q = vec2(aS.x * c + aS.y * s, -aS.x * s + aS.y * c) * 0.29;
  float big = pow(aS.z, 9.0);
  float px = (0.95 + 3.6 * big) * uSizeMul;
  gl_PointSize = max(1.0, px) * 2.0;
  float tw = 0.6 + 0.4 * sin(uT * (0.8 + 2.2 * aS.w) + aS.w * 70.0);
  vec3 tint = mix(uWhite, uGold, step(0.72, fract(aS.w * 5.3)));
  tint = mix(tint, uBlue, step(0.9, fract(aS.w * 11.1)));
  vec2 at = vec2(uStarFrame.x + q.x / uStarFrame.z, uStarFrame.y + q.y);
  // No star shines through a letter.
  vec2 uv = at * 0.5 + 0.5;
  vec2 dw = max(abs(uv - uWords.xy) - uWords.zw, 0.0);
  float clear = 1.0 - smoothstep(0.0, 0.12, uWordsOn) * (1.0 - smoothstep(0.0, 0.03, length(dw)));
  // And none through the rose: its light is the nearer one.
  float fromRose = length((at - uRose.xy) * vec2(uStarFrame.z, 1.0)) * 0.5;
  clear *= 1.0 - uRose.w * (1.0 - smoothstep(0.7 * uRose.z, 1.05 * uRose.z, fromRose));
  vCol = tint * (0.16 + 1.6 * big) * tw * min(1.0, px * px) * uFade * clear;
  // Behind everything that has a body.
  gl_Position = vec4(at, 0.9995, 1.0);
}
`;

/* The thirty: each kindles on the horizon, waits, then rises to its seat on
   the crown around the round. One more light comes down from the sun to the ground. */
export const SEAT_VS = `${HEAD}${COMMON_UNIFORMS}
const float PI = 3.141592653589793;
layout(location = 0) in vec4 aSeat;  // angle, radius, seed, kind (0 rises to its seat, 1 comes down from the sun)
layout(location = 1) in float aSub;  // 0..1: how far back along its own tail this sample sits
layout(location = 2) in vec4 aStart; // where it waits (x, y as shares of the frame), when it kindles, when it leaves
uniform float uTail;     // seconds of path the tail covers
uniform float uTravel;   // seconds from the ground to the seat
uniform float uWait;     // how large a light is at rest, on the horizon and on its seat
uniform vec4 uFrame;     // half width and half height of the view at the origin plane, the picture's centre shift (x, y)
uniform float uSizeMul;
uniform float uFade;
uniform vec3 uGoldBright;
uniform vec3 uWhite;
out vec3 vCol;
out float vCore;
void main() {
  float seed = aSeat.z, kind = aSeat.w;
  float kindle = aStart.z, lift = aStart.w;
  float when = uT - aSub * uTail;
  float e = clamp((when - lift) / uTravel, 0.0, 1.0);
  float ee = e * e * (3.0 - 2.0 * e);
  vec3 ground = vec3((2.0 * aStart.x - 1.0 - uFrame.z) * uFrame.x, (2.0 * aStart.y - 1.0 - uFrame.w) * uFrame.y, 0.0);
  // The crown turns with the rose.
  float sa = aSeat.x - uRot;
  vec3 seat = uModel * (vec3(cos(sa), sin(sa), 0.0) * aSeat.y * (1.0 - kind));
  vec3 from = mix(ground, seat, kind);
  vec3 to = mix(seat, ground, kind);
  vec3 p = mix(from, to, ee);
  float curl = (1.0 - ee) * ee * mix(0.45, -0.5, kind);
  p.xy = to.xy + mat2(cos(curl), -sin(curl), sin(curl), cos(curl)) * (p.xy - to.xy);
  p.z += sin(ee * PI) * 0.4;
  vec4 v = uView * vec4(p, 1.0);

  float moving = step(lift, when) * step(e, 0.9999);
  float head = step(aSub, 0.0001);
  // At rest only the head shows: on the horizon before it leaves, on its seat after.
  float waiting = head * smoothstep(kindle, kindle + 0.6, uT) * (1.0 - step(lift, uT)) * (1.0 - kind);
  float seated = head * step(1.0, e) * (1.0 - kind);
  // On its way it is one fine line of even width. The light that comes down dims as it lands.
  float flying = moving * pow(1.0 - aSub, 1.2) * mix(0.8, 0.95 * smoothstep(1.0, 0.82, e), kind);
  // It flares as it takes its seat, and afterwards the thirty glint one after another.
  float since = uT - lift - uTravel;
  float flare = seated * exp(-max(since, 0.0) * 1.8);
  float glint = seated * pow(max(0.0, sin(uT * 0.9 - seed * 6.2831853)), 10.0);
  float rest = mix(1.0, (3.5 + 1.4 * flare + 0.9 * glint) * uWait, seated);
  // On the horizon it is a light in its own right, larger and warmer than any star.
  float breath = 0.85 + 0.15 * sin(uT * (1.3 + seed) + seed * 40.0);
  rest = mix(rest, (3.9 + 0.6 * fract(seed * 7.7)) * breath * uWait, waiting);
  float size = (0.0095 + 0.002 * fract(seed * 3.3)) * uSizeMul * (1.0 - 0.25 * aSub) * rest * mix(1.0, 1.3, kind);
  gl_PointSize = max(1.6, size * uPx / max(0.1, -v.z)) * 2.0;
  float tw = 0.9 + 0.1 * sin(uT * (1.0 + seed) + seed * 50.0);
  float live = max(max(waiting, seated * (0.85 + 1.2 * flare + 0.8 * glint)), flying);
  vec3 tint = mix(mix(uGoldBright, uWhite, 0.55), mix(uGoldBright, uWhite, 0.18), max(seated, waiting));
  vCol = tint * tw * live * uFade;
  vCore = max(seated, waiting);
  gl_Position = uProj * v;
}
`;

export const SEAT_FS = `${HEAD}
in vec3 vCol;
in float vCore;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r = length(d);
  if (r > 1.0) discard;
  float halo = exp(-r * r * 5.0) * (0.55 + 0.45 * vCore) * (1.0 - r * r);
  float core = exp(-r * r * 46.0) * 2.8 * vCore;
  o = vec4(vCol * (halo + core), 1.0);
}
`;

/* The guide: where the light from the rose lands it unfolds into many small
   lights in her shape. Places are given as shares of the frame. */
export const GUIDE_VS = `${HEAD}
layout(location = 0) in vec4 aG; // x, y (shares of the frame, y from the foot), seed, weight
uniform vec2 uChest;
uniform float uShow;
uniform float uT;
uniform float uSizeMul;
uniform float uFade;
uniform vec3 uGoldBright;
uniform vec3 uWhite;
out vec3 vCol;
void main() {
  // A negative weight marks the fine grain her body is made of, a positive one a light.
  float seed = aG.z, weight = abs(aG.w), grain = step(aG.w, 0.0);
  // Each light leaves the landing place in its own moment and settles where it belongs.
  float e = clamp((uShow * 1.35 - 0.35 * seed) / 0.65, 0.0, 1.0);
  e = 1.0 - (1.0 - e) * (1.0 - e) * (1.0 - e);
  vec2 at = mix(uChest, aG.xy, e);
  at += mix(0.0016, 0.0006, grain) * vec2(sin(uT * (0.7 + seed) + seed * 50.0), cos(uT * (0.9 + 0.6 * seed) + seed * 31.0)) * e;
  float px = mix(1.5 + 2.4 * weight * weight, 1.5 + 0.5 * seed, grain) * uSizeMul;
  gl_PointSize = max(1.5, px) * 2.0;
  float tw = 0.72 + 0.28 * sin(uT * (1.1 + 2.3 * seed) + seed * 80.0);
  vec3 tint = mix(uWhite, uGoldBright, mix(0.25 + 0.45 * fract(seed * 5.7), 0.3, grain));
  // Once she stands there, most of the light has gone into her: a little stays on her cloak.
  float stays = mix(1.0, mix(0.07, 0.3, 1.0 - grain), smoothstep(0.5, 1.0, uShow));
  vCol = tint * mix(0.2 + 0.75 * weight, 0.42 * weight, grain) * mix(tw, 0.85 + 0.15 * tw, grain) * smoothstep(0.0, 0.25, uShow) * stays * uFade;
  gl_Position = vec4(at * 2.0 - 1.0, 0.0, 1.0);
}
`;

/* The first point of light, and later the sun at the heart of the rose with
   its rays. Measured in the picture's own measure, so it grows with the rose. */
export const SUN_VS = `${HEAD}${COMMON_UNIFORMS}
layout(location = 0) in vec2 aQ;
uniform float uSunR;
out vec2 vQ;
void main() {
  vQ = aQ * uSunR;
  gl_Position = uProj * uView * vec4(uModel * vec3(vQ, 0.0), 1.0);
}
`;

export const SUN_FS = `${HEAD}
const float PI = 3.141592653589793;
in vec2 vQ;
uniform vec3 uGoldBright;
uniform vec3 uWhite;
uniform float uHeart;
uniform float uPoint;
uniform float uSun;
uniform float uBody;     // how much of the rose stands
uniform float uRingR;
uniform float uRot;
uniform float uT;
uniform float uPxWorld;  // pixels per unit of the picture's measure
uniform float uSunR;
out vec4 o;

float hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}

float hash1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

void main() {
  float r = length(vQ);
  float px = 1.0 / uPxWorld;
  float edge = 1.0 - smoothstep(0.82 * uSunR, uSunR, r);
  vec3 gold = uGoldBright;
  vec3 hot = mix(uGoldBright, uWhite, 0.7);

  // The point: a small hard star with a soft breath around it.
  float star = (exp(-r * r / 0.0009) * 3.0 + exp(-r * r / 0.012) * 0.35) * uPoint;

  // The sun: a disc of gold, white at its middle, and the light it sheds into the tiers.
  float disc = 0.085;
  float body = (1.0 - smoothstep(disc - px, disc + px, r)) * (2.2 + 1.6 * exp(-r * r / 0.003));
  float corona = exp(-max(r - disc, 0.0) / 0.07) * 0.75 + exp(-r / 0.42) * 0.2;

  // The rays: fine lines of gold, long and short in turn, each a little different.
  float ang = atan(vQ.y, vQ.x);
  float n = 40.0;
  float f = (ang + 0.012 * uT) / (2.0 * PI) * n;
  float id = floor(f + 0.5);
  float lat = abs(sin((f - id) * (2.0 * PI / n))) * r;
  float key = mod(id, n);
  float h = hash1(key + 3.0);
  float len = (mod(key, 2.0) < 0.5 ? mix(0.72, 0.98, h) : mix(0.4, 0.6, h)) * uSun;
  float along = clamp(r / max(len, 0.001), 0.0, 1.0);
  float wide = mix(0.0095, 0.0016, along) + 0.45 * px;
  float line = (1.0 - smoothstep(wide - px, wide + px, lat)) * smoothstep(disc * 0.9, disc * 1.2, r) * (1.0 - smoothstep(0.72, 1.0, along));
  float shimmer = 0.78 + 0.22 * sin(uT * (0.7 + h) + key * 2.4);

  vec3 c = hot * star;
  c += mix(gold, hot, exp(-r * r / 0.004)) * body * uSun;
  c += gold * corona * uSun * (0.4 + 0.6 * uHeart);
  c += gold * line * 1.6 * shimmer * (1.0 - 0.5 * along);

  // The rose is full of light: most by the sun, less towards the round, and
  // the round itself is one bright ring. Clouds of it turn with the rose.
  float turnA = ang + uRot;
  // (The cloud is laid on a circle, so it has no seam where the angle wraps.)
  vec2 round2 = vec2(cos(turnA), sin(turnA));
  float cloud = vnoise(round2 * 2.2 + r * 3.0 + 7.0) * 0.6 + vnoise(round2 * 6.0 * (0.4 + r) + r * 9.0) * 0.4;
  float within = (0.34 * exp(-r / 0.4) + 0.05) * (1.0 - smoothstep(uRingR - 0.1, uRingR + 0.02, r));
  float dr = (r - uRingR) / 0.075;
  float round = 0.2 * exp(-dr * dr);
  float beyond = 0.035 * smoothstep(uRingR, uRingR + 0.1, r) * (1.0 - smoothstep(uRingR + 0.15, uSunR * 0.95, r));
  c += mix(uWhite, gold, 0.25 + 0.5 * exp(-r / 0.3)) * (within + round + beyond) * (0.6 + 0.8 * cloud) * uBody;
  o = vec4(c * edge, 1.0);
}
`;

export const QUAD_VS = `${HEAD}
layout(location = 0) in vec2 aQ;
out vec2 vUv;
void main() {
  vUv = aQ * 0.5 + 0.5;
  gl_Position = vec4(aQ, 0.0, 1.0);
}
`;

/* Moving light leaves a short fading line. */
export const ACCUM_FS = `${HEAD}
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uPrev;
uniform float uDecay;
out vec4 o;
void main() {
  vec3 s = texture(uScene, vUv).rgb;
  // A stray NaN would spread through the glow: drop it here.
  s = vec3(s.r >= 0.0 ? s.r : 0.0, s.g >= 0.0 ? s.g : 0.0, s.b >= 0.0 ? s.b : 0.0);
  s = min(s, vec3(48.0));
  vec3 p = texture(uPrev, vUv).rgb * uDecay;
  o = vec4(max(s, p), 1.0);
}
`;

export const DOWN_FS = `${HEAD}
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uKnee;
uniform sampler2D uTex2;
uniform float uAdd;
out vec4 o;
void main() {
  vec3 c = texture(uTex, vUv + uTexel * vec2(-0.5, -0.5)).rgb
         + texture(uTex, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture(uTex, vUv + uTexel * vec2(-0.5, 0.5)).rgb
         + texture(uTex, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  o = vec4(max(c * 0.25 + texture(uTex2, vUv).rgb * uAdd - uKnee, 0.0), 1.0);
}
`;

export const BLUR_FS = `${HEAD}
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 o;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 0.227027;
  c += (texture(uTex, vUv + uDir * 1.384615).rgb + texture(uTex, vUv - uDir * 1.384615).rgb) * 0.316216;
  c += (texture(uTex, vUv + uDir * 3.230769).rgb + texture(uTex, vUv - uDir * 3.230769).rgb) * 0.070270;
  o = vec4(c, 1.0);
}
`;

/* The frame: the slate night, light, glow, rays from the sun, the ground, grade, tooth. */
export const COMPOSITE_FS = `${HEAD}
in vec2 vUv;
uniform sampler2D uLight;
uniform sampler2D uExtra;
uniform sampler2D uGlow1;
uniform sampler2D uGlow2;
uniform sampler2D uGlow3;
uniform vec3 uNight;       // the slate around the rose
uniform vec3 uVoid;        // the deeper slate at the foot
uniform vec3 uAbyss;       // the rim of the frame
uniform vec3 uVeil;        // one lighter veil, off centre
uniform vec3 uGoldBright;
uniform vec3 uWhite;
uniform vec3 uBlue;
uniform vec2 uHeartUv;
uniform float uRays;
uniform float uFlash;
uniform float uT;
uniform float uAspect;
uniform float uGroundTop;
uniform float uStand;      // where the two stand: across the frame, in units of its short side, from the centre
uniform float uShort;      // the frame's short side over its width
uniform float uPixel;      // one pixel as a share of the frame's height
uniform float uHeartLight;
uniform vec4 uWords;       // the words' box: centre and half size, in shares of the frame
uniform float uWordsOn;
out vec4 o;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

// The rock at the foot of the frame, as a share of the frame's height.
// It is level where the two stand, falls away on both sides and is rough further out.
float ridgeTop(float xs) {
  float away = abs(xs - uStand);
  float wide = fbm(vec2(xs * 1.6 + 3.0, 0.5)) - 0.5;
  float crag = fbm(vec2(xs * 7.0 + 9.0, 2.5)) - 0.5;
  float rough = smoothstep(0.03, 0.26, away);
  float ledge = abs(fbm(vec2(xs * 9.0 + 2.0, 6.5)) - 0.5);
  return uGroundTop - 0.05 * smoothstep(0.05, 0.55, away) - 0.02 * smoothstep(0.55, 1.3, away) + (0.055 * wide + 0.03 * crag) * rough - 0.018 * ledge * smoothstep(0.03, 0.12, away) * (1.0 - smoothstep(0.35, 0.8, away));
}

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

void main() {
  vec3 g1 = texture(uGlow1, vUv).rgb;
  vec3 g2 = texture(uGlow2, vUv).rgb;
  vec3 g3 = texture(uGlow3, vUv).rgb;

  // Rays: the glow smeared along the line to the heart.
  vec3 rays = vec3(0.0);
  vec2 dir = uHeartUv - vUv;
  float jit = hash(gl_FragCoord.xy);
  for (int i = 0; i < 16; i++) {
    float f = (float(i) + jit) / 16.0;
    rays += texture(uGlow2, vUv + dir * f * 0.82).rgb * (1.0 - f * 0.7);
  }
  rays *= 0.01 * uRays * vec3(1.0, 0.9, 0.72);

  // The light steps back behind the words.
  vec2 wq = (vUv - uWords.xy) / max(uWords.zw, vec2(0.001));
  float behind = (1.0 - smoothstep(0.4, 1.6, length(wq * vec2(1.0, 0.9)))) * smoothstep(0.0, 0.25, uWordsOn);
  vec3 body = texture(uLight, vUv).rgb + g1 * 0.17 + g2 * 0.1 + g3 * 0.04 * vec3(1.0, 0.9, 0.72) + rays;
  vec4 extra = texture(uExtra, vUv);
  vec3 hdr = (body + extra.rgb) * (1.0 - 0.9 * behind);
  vec3 lit = 1.0 - exp(-hdr * 1.25);

  // The night is a slate plane, and no plane is one colour: deeper at the
  // foot, one lighter veil off centre, the rim closing to the abyss.
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float drift = fbm(q * 1.6 + 3.0) - 0.5;
  vec3 bg = mix(toLinear(uVoid), toLinear(uNight), smoothstep(0.02, 0.5, vUv.y + 0.14 * drift));
  vec2 v1 = (q - vec2(-0.34 * uAspect, 0.3)) / vec2(0.62 * max(uAspect, 0.8), 0.55);
  vec2 v2 = (q - vec2(0.3 * uAspect, 0.18)) / vec2(0.4 * max(uAspect, 0.8), 0.4);
  bg = mix(bg, toLinear(uVeil), (0.5 * exp(-dot(v1, v1) * 1.5) + 0.16 * exp(-dot(v2, v2) * 1.8)) * (0.75 + 0.5 * drift));
  float vig = smoothstep(1.25, 0.25, length(q) / max(1.0, uAspect * 0.62));
  bg = mix(toLinear(uAbyss), bg, mix(0.5, 1.0, vig));

  vec3 c = bg + lit * mix(0.82, 1.0, vig);

  // The ground: a far ridge and a near one against the last light on the horizon.
  float xs = (vUv.x - 0.5) * uShort;
  float top = ridgeTop(xs);
  float far = uGroundTop + 0.052 + 0.05 * (fbm(vec2(xs * 2.3 + 21.0, 7.5)) - 0.5) + 0.02 * (fbm(vec2(xs * 9.0 + 4.0, 3.5)) - 0.5);
  float range = uGroundTop + 0.088 + 0.07 * (fbm(vec2(xs * 1.5 + 40.0, 11.5)) - 0.5) + 0.016 * (fbm(vec2(xs * 7.0 + 14.0, 5.5)) - 0.5);
  float sx = (vUv.x - uHeartUv.x) * uAspect;
  float below = exp(-sx * sx * 0.9);
  vec3 warm = mix(uWhite, uGoldBright, 0.45);
  float above = max(vUv.y - range, 0.0);
  // Afterglow: a low band of gold behind the farthest range, fading into the night.
  vec3 dusk = mix(uGoldBright, uBlue, 0.55) * (0.022 * exp(-above * 9.0) + 0.045 * exp(-above * 32.0));
  dusk *= 0.75 + 0.25 * fbm(vec2(xs * 1.3 + 5.0, 1.5));
  c += dusk * (1.0 - 0.5 * uFlash);
  float hid = 0.0;
  if (vUv.y < range + 0.01) {
    // The farthest range is almost the sky's colour.
    vec3 hill = mix(toLinear(uNight) * 0.95, mix(uGoldBright, uBlue, 0.8) * 0.05, exp(-max(range - vUv.y, 0.0) * 45.0));
    hid = smoothstep(0.0, 1.5 * uPixel, range - vUv.y);
    c = mix(c, hill, hid);
  }
  if (vUv.y < far + 0.01) {
    // The far ridge stands in the haze, a shade lighter than the near one.
    vec3 hill = mix(toLinear(uNight) * 0.62, mix(uGoldBright, uBlue, 0.8) * 0.03, exp(-max(far - vUv.y, 0.0) * 60.0));
    float nearer = smoothstep(0.0, 1.5 * uPixel, far - vUv.y);
    c = mix(c, hill, nearer);
    hid = max(hid, nearer);
  }
  // The thirty and the guide stand before the far ridges.
  c += (1.0 - exp(-extra.rgb * 1.25)) * min(extra.a, 1.0) * hid;
  if (vUv.y < top + 0.14) {
    float depth = top - vUv.y;
    // A thin mist lies between the ridges.
    float mist = exp(-max(-depth, 0.0) * 30.0) * (0.55 + 0.45 * fbm(vec2(xs * 3.0 + uT * 0.01, 4.0)));
    // The haze takes the rose's light cool, as the night does.
    vec3 haze = mix(uWhite, uBlue, 0.5);
    c += (uBlue * 0.012 + haze * 0.03 * uHeartLight * below) * mist;
    // Cloud banks lie behind the rock and take the rose's light on their crowns.
    float billow = fbm(vec2(xs * 4.2 + uT * 0.006, vUv.y * 9.0 + 1.0));
    float bank = smoothstep(0.3, 1.0, 1.7 * billow - 0.35 + 0.45 * exp(-max(-depth, 0.0) * 16.0)) * exp(-max(-depth, 0.0) * 11.0) * step(depth, 2.0 * uPixel);
    c += (uBlue * 0.02 + haze * 0.05 * uHeartLight * (0.4 + 0.6 * below)) * bank;
    float crest = exp(-max(depth, 0.0) * 150.0);
    float slope = exp(-max(depth, 0.0) * 14.0);
    // The earth keeps the night's blue and takes a little light on its crest.
    vec3 earth = toLinear(uVoid) * (0.34 + 0.3 * slope);
    earth += (mix(uGoldBright, uBlue, 0.5) * 0.03 + warm * 0.12 * uHeartLight * below) * crest;
    earth += (uBlue * 0.006 + warm * 0.014 * uHeartLight * below) * slope;
    c = mix(c, earth, smoothstep(0.0, 1.5 * uPixel, depth));
  }
  c = mix(c, bg, uFlash);

  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  // A fine tooth, as on paper, and a dither against banding.
  c += (vnoise(gl_FragCoord.xy * 0.42) - 0.5) * (2.4 / 255.0);
  float n = hash(gl_FragCoord.xy + fract(uT) * 91.7) + hash(gl_FragCoord.yx + fract(uT) * 37.3) - 1.0;
  c += n * (1.6 / 255.0);
  o = vec4(c, 1.0);
}
`;
