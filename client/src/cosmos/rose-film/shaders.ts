/**
 * cosmos/rose-film/shaders — GLSL for the entry film.
 *
 * One body of light: every point knows its place in the river and its place
 * on the rose. The rose is a parametric petal surface opened by uBloom.
 */

const ROSE = /* glsl */ `
const float PI = 3.141592653589793;
uniform float uBloom;

// tn: 0 at the outermost petal, 1 at the innermost.
float petalRank(float theta) { return (theta + 2.0 * PI) / (17.0 * PI); }

// When a point (or a petal) leaves the round for the rose: the heart first.
float morphDelay(float tn) { return 0.54 * (1.0 - tn); }

// How far a petal has opened. Each tier unfolds as its light arrives, so the
// rose grows from the heart outwards and no closed tier stands in front of it.
float petalOpen(float tn) {
  return smoothstep(0.0, 1.0, clamp((uBloom - morphDelay(tn) - 0.1) / 0.36, 0.0, 1.0));
}

// Outer petals are long, and each turn inwards is shorter, so every petal
// shows a crescent of its face above the one in front of it.
// The outermost petals are a little shorter, so the rose keeps a round outline.
float petalLen(float tn) { return mix(1.0, 0.2, pow(clamp(tn, 0.0, 1.0), 0.6)) * mix(0.72, 1.0, smoothstep(0.02, 0.1, tn)); }

// The rose as a bowl of tiers: theta winds the petal spiral (outer to inner),
// x1 runs from the heart to the petal's rim. Outer petals are long and lie
// open, inner ones are short and stand, so every tier looks down on the heart.
vec3 rosePoint(float theta, float x1) {
  float tn = petalRank(theta);
  float o = petalOpen(tn);
  float u0 = 1.0 - mod(3.6 * theta, 2.0 * PI) / PI;
  // No two petals alike: each has its own length, lean and tip. The
  // difference is nil on a petal's border, so the ribbon stays whole.
  float k = floor(3.6 * theta / (2.0 * PI));
  float own = 1.0 - u0 * u0;
  float len = petalLen(tn) * (1.0 + 0.17 * sin(k * 2.4 + 0.7) * own) * mix(0.5, 1.0, o);
  float phi = (mix(1.02, 0.46, tn) + 0.1 * sin(k * 4.1 + 2.0) * own) * mix(0.55, 1.0, o) + 0.36 * x1 * x1 * x1 * o;
  float u = u0 + 0.14 * sin(k * 3.3 + 1.1) * own;
  float a = 1.25 * u * u - 0.25;
  float X = 1.0 - 0.5 * a * a;
  float b = 1.27689 * x1 - 1.0;
  float y = 1.2 * x1 * x1 * b * b * sin(phi);
  float r = len * X * (x1 * sin(phi) + y * cos(phi));
  float z = len * X * (x1 * cos(phi) - y * sin(phi));
  return vec3(r * sin(theta), r * cos(theta), z - 0.3);
}

vec3 roseNormal(float theta, float x1, vec3 p) {
  vec3 dt = rosePoint(theta + 0.02, x1) - p;
  vec3 dx = rosePoint(theta, x1 - 0.02) - p;
  vec3 n = cross(dt, dx);
  float l = length(n);
  return l > 1e-9 ? n / l : vec3(0.0, 0.0, 1.0);
}

vec3 spinZ(vec3 p, float ang) {
  float c = cos(ang), s = sin(ang);
  return vec3(p.x * c + p.y * s, -p.x * s + p.y * c, p.z);
}

`;

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

/* The petals: white surfaces lit by the heart. The side that faces the
   heart is bright, the back lets a little of the light through. */
export const MESH_VS = `${HEAD}${COMMON_UNIFORMS}${ROSE}
layout(location = 0) in vec2 aUV;
out vec3 vP;
out vec3 vN;
out vec3 vViewP;
out vec3 vViewN;
out float vTn;
out float vX1;
out float vU;
out float vTheta;
void main() {
  float theta = aUV.x, x1 = aUV.y;
  vTheta = theta;
  vec3 p = rosePoint(theta, x1);
  vec3 n = roseNormal(theta, x1, p);
  vec3 w = uModel * spinZ(p, uRot);
  vec3 wn = uModel * spinZ(n, uRot);
  vec4 v = uView * vec4(w, 1.0);
  vP = p;
  vN = n;
  vViewP = v.xyz;
  vViewN = mat3(uView) * wn;
  vTn = petalRank(theta);
  vX1 = x1;
  vU = 1.0 - mod(3.6 * theta, 2.0 * PI) / PI;
  gl_Position = uProj * v;
  gl_Position.z += 0.0035 * gl_Position.w;
}
`;

export const MESH_FS = `${HEAD}
float petalLen(float tn) { return mix(1.0, 0.2, pow(clamp(tn, 0.0, 1.0), 0.6)) * mix(0.72, 1.0, smoothstep(0.02, 0.1, tn)); }
in vec3 vP;
in vec3 vN;
in vec3 vViewP;
in vec3 vViewN;
in float vTn;
in float vX1;
in float vU;
in float vTheta;
uniform vec3 uGoldBright;
uniform vec3 uWhite;
uniform vec3 uBlue;
uniform float uBody;
uniform float uBloom;
uniform float uT;
uniform float uCoverage; // 1: the growing edge is smoothed by sample coverage, 0: a plain cut
uniform float uSeatPx;   // how large a seat light is drawn: grows a little slower than the screen's density
out vec4 o;

float hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  if (vTheta < -5.2359878) discard;
  // A petal grows from its foot to its rim while its light streams in from the round.
  float grow = clamp((uBloom - 0.54 * (1.0 - vTn) - 0.18) / 0.32, 0.0, 1.0);
  float reach = grow * 1.03;
  float covered = clamp((reach - vX1) / (fwidth(vX1) + 1e-5) + 0.5, 0.0, 1.0);
  if (covered <= 0.0 || (uCoverage < 0.5 && covered < 0.5)) discard;

  float facing = dot(normalize(vViewN), normalize(-vViewP));
  // The normal of the side we look at.
  vec3 n = normalize(vN) * sign(facing);
  // The light stands above the heart, on the rose's axis, and shines into the bowl.
  vec3 toLight = normalize(vec3(0.0, 0.0, 0.7) - vP);
  float lam = dot(n, toLight);
  float dist = length(vP - vec3(0.0, 0.0, -0.2));
  float fall = 1.0 / (1.0 + 0.2 * dist * dist);
  float lit = max(lam, 0.0);
  float back = max(-lam, 0.0);
  float rim = pow(1.0 - abs(facing), 2.5);
  // The foot of a petal lies in the shade of the petal in front of it:
  // one turn of the spiral further in.
  float cover = petalLen(vTn + 0.1176) / petalLen(vTn);
  float foot = 0.32 + 0.68 * smoothstep(cover - 0.4, cover + 0.3, vX1);
  foot *= 0.85 + 0.15 * (1.0 - vU * vU);

  // The seats: rows of small lights across the petal, some empty. Each keeps
  // its size on the screen, so a petal is made of lights at any distance.
  float len = petalLen(vTn);
  float nRows = max(3.0, floor(len * 20.0 + 0.5));
  float rowF = vX1 * nRows;
  float rowId = floor(rowF);
  float nCols = max(3.0, floor(len * (rowId + 0.5) / nRows * 32.0 + 0.5));
  float colF = (vU * 0.5 + 0.5) * nCols + 0.5 * mod(rowId, 2.0);
  float k = floor(3.6 * vTheta / 6.2831853);
  vec2 id = vec2(floor(colF) + 37.0 * k, rowId + 11.0);
  float h = hash2(id);
  float h2 = hash2(id + 71.3);
  float h3 = hash2(id + 13.7);
  vec2 cell = vec2(fract(colF) - 0.5, fract(rowF) - 0.5) - 0.14 * (vec2(h2, h3) - 0.5);
  // The same offset in pixels, so a light stays round however the petal lies.
  vec2 gc = vec2(dFdx(colF), dFdy(colF));
  vec2 gr = vec2(dFdx(rowF), dFdy(rowF));
  float det = gc.x * gr.y - gc.y * gr.x;
  vec2 cellPx = vec2(gr.y * cell.x - gc.y * cell.y, gc.x * cell.y - gr.x * cell.x) / (abs(det) > 1e-7 ? det : 1e-7);
  float bright = h * h * h;
  float sigma = (0.9 + 0.55 * bright) * uSeatPx;
  float d2 = dot(cellPx, cellPx);
  float seat = (exp(-d2 / (2.0 * sigma * sigma)) + 0.14 * exp(-d2 / (12.0 * sigma * sigma))) * step(0.12, h3);
  // Where the rows are too fine for single lights they melt into an even shimmer.
  float fw = max(fwidth(rowF), fwidth(colF));
  seat = mix(seat, 0.1, smoothstep(0.2, 0.42, fw));
  float tw = 0.75 + 0.25 * sin(uT * (0.5 + 1.7 * h) + h * 60.0);
  // The lowest rows lie under the petal in front.
  float seats = seat * (0.6 + 1.9 * bright) * tw * smoothstep(0.08, 0.3, vX1);

  vec3 warm = mix(uWhite, uGoldBright, 0.55);
  // The heart is the light: gold beside it, ivory further out, a breath of the night's blue on the outermost tiers.
  vec3 face = mix(mix(uGoldBright, uWhite, 0.35), mix(uWhite, uGoldBright, 0.14), smoothstep(0.1, 0.75, dist));
  face = mix(face, uBlue, 0.05 * smoothstep(0.7, 1.2, dist));
  float heartLight = 1.0 / (1.0 + 3.1 * dist * dist);
  // Seen from behind, a petal glows with the light that passes through it.
  float through = (0.3 + 0.5 * back) * heartLight * foot * step(lam, 0.0);
  // A petal is a thin veil: it shows the heart's light and little of its own.
  // A young rose is all lights and rims: its veils fill with the heart's light as it opens.
  float age = mix(0.16, 1.0, smoothstep(0.85, 1.3, uBloom));
  vec3 c = face * (0.032 + 0.66 * age * heartLight * (0.4 + 0.6 * lit)) * foot;
  c += warm * 0.22 * through;
  c += mix(uWhite, uGoldBright, 0.12) * seats * (0.55 + 0.45 * foot);
  c += mix(uWhite, uBlue, 0.4) * 0.05 * rim * foot;
  // The rim is one fine line of light.
  float rimLine = smoothstep(1.0 - 1.6 * fwidth(vX1), 1.0, vX1);
  c += mix(uWhite, uGoldBright, 0.2) * rimLine * (0.5 + 0.8 * heartLight);
  // Light runs along the edge of a petal while it grows.
  float edge = (reach - vX1) / 0.06;
  c += warm * 1.5 * exp(-edge * edge) * (1.0 - smoothstep(0.8, 1.0, grow));

  o = vec4(c * uBody, uCoverage > 0.5 ? covered : 1.0);
}
`;

/* The body of light: river, ring, rose. */
export const POINT_VS = `${HEAD}${COMMON_UNIFORMS}${ROSE}
layout(location = 0) in vec4 aA; // u0 (rank along the petal spiral), across (gaussian), depth (gaussian), seed
layout(location = 1) in vec4 aB; // theta, x1, size seed, kind seed
uniform float uBend;
uniform float uRingR;
uniform float uLift;
uniform float uRiverRot;
uniform float uWidth;
uniform float uRingness;
uniform float uMorph;
uniform float uSizeMul;
uniform float uFade;
uniform float uPour;
uniform float uShear;
uniform vec3 uGold;
uniform vec3 uGoldBright;
uniform vec3 uWhite;
uniform vec3 uBlue;
out vec3 vCol;

float wrapPi(float a) { return mod(a + PI, 2.0 * PI) - PI; }

void main() {
  float theta = aB.x, x1 = aB.y;
  float seed = aA.w, sizeSeed = aB.z, kind = aB.w;
  float tn = petalRank(theta);

  // How far this point has travelled from the round to its petal.
  float m = clamp((uBloom - morphDelay(tn) - 0.2 * seed) / 0.3, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);

  // ---- river / ring -------------------------------------------------------
  // On its way in, a point runs ahead along the round: an inward spiral.
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
  float row = step(0.4, kind) * step(kind, 0.7);
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
  // The spiral's outer end joins the round softly, like the arm of a galaxy.
  tip *= smoothstep(-5.2359878, -5.2359878 + 2.8, theta);
  // The river pours into the night, its head brightest.
  tip *= smoothstep(uPour, uPour - 0.05, sN) * (1.0 + 1.6 * smoothstep(uPour - 0.3, uPour - 0.02, sN));
  // Clouds of stars along the river: they travel with it.
  float home = (PI - theta) * 1.0;
  float clump = 0.5 + 0.5 * sin(home * 3.0 + 1.7 * sin(aA.y * 1.9 + home * 0.7)) * sin(home * 1.3 + 0.6 + aA.y);
  clump = 0.25 + 0.75 * clump * clump * 1.6;
  tip *= mix(clump, 1.0, uRingness);

  // ---- rose ---------------------------------------------------------------
  vec3 rp3 = rosePoint(theta, x1);
  vec3 rn = roseNormal(theta, x1, rp3);
  vec3 rose = spinZ(rp3, uRot);
  vec3 roseN = spinZ(rn, uRot);

  vec3 local = mix(ring, rose, m);
  local.z += sin(m * PI) * 0.1 * (0.4 + seed);

  vec3 w = uModel * local;
  vec4 v = uView * vec4(w, 1.0);
  vec3 vn = mat3(uView) * (uModel * roseN);
  float fres = clamp(1.0 - abs(dot(normalize(vn), normalize(-v.xyz))), 0.0, 1.0);

  // ---- size and light -----------------------------------------------------
  float big = pow(sizeSeed, 16.0);
  float rimK = step(0.1, kind) * step(kind, 0.4);
  float fine = max(rimK, row) * m;
  float size = mix(mix(0.0022 + 0.0024 * sizeSeed * sizeSeed + 0.011 * big, 0.0042, fine), 0.1 + 0.07 * sizeSeed, haze) * uSizeMul;
  size *= 1.0 + 0.6 * sin(m * PI) * (1.0 - haze);
  float px = size * uPx / max(0.1, -v.z);
  float energy = min(1.0, px * px);
  gl_PointSize = max(1.5, px) * 2.0;

  float tw = 0.72 + 0.28 * sin(uT * (1.2 + 2.6 * seed) + seed * 90.0);
  vec3 tint = mix(uWhite, uGold, 0.8 * smoothstep(0.7, 1.0, fract(seed * 7.31)));
  tint = mix(tint, uBlue, step(0.97, fract(seed * 13.7)) * 0.5);
  float riverI = (0.045 + 0.095 * sizeSeed * sizeSeed + 1.8 * big) * rift * tip * (1.0 + 1.0 * leap) * pow(uWidth / 0.21, 0.8) * mix(exp(-0.42 * aA.y * aA.y) * 1.5, 1.0, uRingness);

  float rim = smoothstep(0.9, 1.0, x1);
  // Rims are fine white lines, the rows of seats are gold, the faces carry a few bright lights.
  vec3 roseTint = mix(mix(uWhite, uGoldBright, 0.3), mix(uGold, uGoldBright, 0.7), row);
  roseTint = mix(roseTint, mix(uWhite, uGoldBright, 0.5 * tn), rimK);
  float faceI = (0.03 + 0.4 * big) * (0.3 + 1.2 * pow(fres, 2.0));
  float roseI = mix(faceI, 0.02, row);
  roseI = mix(roseI, 0.04 + 0.1 * pow(fres, 2.0), rimK) * (0.85 + 0.55 * tn);

  vec3 col = mix(tint * riverI, roseTint * roseI, m);
  col = mix(col, mix(uWhite, uGold, 0.5) * mix(0.05, 0.008, m) * tip, haze);
  col *= 1.0 - 0.45 * pow(max(sin(m * PI), 0.0), 0.6);
  vCol = col * mix(tw, 1.0, haze) * energy * uFade;

  gl_Position = uProj * v;
  gl_Position.z -= 0.002 * gl_Position.w * m;
}
`;

export const POINT_FS = `${HEAD}
in vec3 vCol;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 4.5);
  o = vec4(vCol * a, 1.0);
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
uniform vec4 uWords;     // the words' box and the names' box: centre and half size, shares of the frame
uniform float uWordsOn;
uniform vec4 uNames;
uniform float uNamesOn;
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
  vec2 dn = max(abs(uv - uNames.xy) - uNames.zw, 0.0);
  float clear = (1.0 - smoothstep(0.0, 0.12, uWordsOn) * (1.0 - smoothstep(0.0, 0.03, length(dw))))
              * (1.0 - 0.94 * smoothstep(0.0, 0.12, uNamesOn) * (1.0 - smoothstep(0.0, 0.03, length(dn))));
  vCol = tint * (0.16 + 1.6 * big) * tw * min(1.0, px * px) * uFade * clear;
  // Behind everything that has a body.
  gl_Position = vec4(at, 0.9995, 1.0);
}
`;

/* The thirty: each kindles on the horizon, waits by its name, then rises to
   its seat on a rim. One more light comes down from the heart to the ground. */
export const SEAT_VS = `${HEAD}${COMMON_UNIFORMS}${ROSE}
layout(location = 0) in vec4 aSeat;  // theta, x1, seed, kind (0 rises to its seat, 1 comes down from the heart)
layout(location = 1) in float aSub;  // 0..1: how far back along its own tail this sample sits
layout(location = 2) in vec4 aStart; // where it waits (x, y as shares of the frame), when it kindles, when it leaves
uniform float uTail;     // seconds of path the tail covers
uniform float uTravel;   // seconds from the ground to the seat
uniform float uWait;     // how large a light is while it waits by its name
uniform vec4 uFrame;     // half width and half height of the view at the origin plane, the picture's centre shift (x, y)
uniform float uSizeMul;
uniform float uFade;
uniform vec3 uGoldBright;
uniform vec3 uWhite;
out vec3 vCol;
out float vCore;
void main() {
  float theta = aSeat.x, x1 = aSeat.y, seed = aSeat.z, kind = aSeat.w;
  float kindle = aStart.z, lift = aStart.w;
  float when = uT - aSub * uTail;
  float e = clamp((when - lift) / uTravel, 0.0, 1.0);
  float ee = e * e * (3.0 - 2.0 * e);
  vec3 ground = vec3((2.0 * aStart.x - 1.0 - uFrame.z) * uFrame.x, (2.0 * aStart.y - 1.0 - uFrame.w) * uFrame.y, 0.0);
  vec3 seat = uModel * spinZ(mix(rosePoint(theta, x1), vec3(0.0, 0.0, -0.1), kind), uRot);
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
  float rest = mix(1.0, 3.5 + 1.4 * flare + 0.9 * glint, seated);
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

/* The swarm: sparks between the heart and the petals. */
export const BEE_VS = `${HEAD}${COMMON_UNIFORMS}${ROSE}
layout(location = 0) in vec4 aBee; // theta, x1, phase, seed
uniform float uBees;
uniform float uSizeMul;
uniform vec3 uGoldBright;
uniform vec3 uWhite;
out vec3 vCol;
void main() {
  float seed = aBee.w;
  float q = fract(aBee.z + uT * (0.05 + 0.04 * seed));
  float there = 0.5 - 0.5 * cos(q * 2.0 * PI);
  vec3 seat = rosePoint(aBee.x, aBee.y);
  vec3 heart = vec3(0.0, 0.0, 0.05) + 0.06 * vec3(sin(seed * 31.0), cos(seed * 17.0), sin(seed * 5.0));
  vec3 p = mix(heart, seat, there);
  p.z += sin(there * PI) * (0.1 + 0.12 * seed);
  p += 0.02 * vec3(sin(uT * 3.0 + seed * 80.0), cos(uT * 2.3 + seed * 60.0), 0.0);
  vec3 w = uModel * spinZ(p, uRot);
  vec4 v = uView * vec4(w, 1.0);
  float size = 0.0085 * uSizeMul;
  float px = size * uPx / max(0.1, -v.z);
  gl_PointSize = max(1.0, px) * 2.0;
  float ends = smoothstep(0.0, 0.12, there) * smoothstep(1.0, 0.88, there);
  vCol = mix(uGoldBright, uWhite, 0.3) * 1.1 * ends * uBees * min(1.0, px * px);
  gl_Position = uProj * v;
  gl_Position.z -= 0.004 * gl_Position.w;
}
`;

/* The guide: where the light from the rose lands it unfolds into a figure of
   many small lights. Places are given as shares of the frame. */
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
  vCol = tint * mix(0.2 + 0.75 * weight, 0.42 * weight, grain) * mix(tw, 0.85 + 0.15 * tw, grain) * smoothstep(0.0, 0.25, uShow) * uFade;
  gl_Position = vec4(at * 2.0 - 1.0, 0.0, 1.0);
}
`;

/* The point, and later the heart of the rose. */
export const HEART_VS = `${HEAD}${COMMON_UNIFORMS}
layout(location = 0) in vec2 aQ;
uniform float uHeartSize;
uniform float uAspect;
out vec2 vQ;
void main() {
  vec4 c = uProj * uView * vec4(uModel * vec3(0.0, 0.0, -0.06), 1.0);
  vQ = aQ;
  gl_Position = c + vec4(aQ.x * uHeartSize / uAspect, aQ.y * uHeartSize, 0.0, 0.0) * c.w;
}
`;

export const HEART_FS = `${HEAD}
in vec2 vQ;
uniform vec3 uGoldBright;
uniform vec3 uWhite;
uniform float uHeart;
uniform float uPoint;
out vec4 o;
void main() {
  float r = length(vQ);
  if (r > 1.0) discard;
  float edge = smoothstep(1.0, 0.6, r);
  float glow = exp(-r * r * 9.0) * 0.42 + exp(-r * 5.0) * 0.1;
  float core = exp(-r * r * 220.0) * 3.0;
  float star = exp(-r * r * 60.0) * 1.2 * uPoint;
  vec3 c = mix(uGoldBright, uWhite, 0.2 + 0.8 * exp(-r * 9.0));
  o = vec4(c * (glow * uHeart + core * (0.4 + uHeart) + star) * edge, 1.0);
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

/* The frame: night, light, glow, rays from the heart, grade, dither. */
export const COMPOSITE_FS = `${HEAD}
in vec2 vUv;
uniform sampler2D uLight;
uniform sampler2D uExtra;
uniform sampler2D uGlow1;
uniform sampler2D uGlow2;
uniform sampler2D uGlow3;
uniform vec3 uNight;
uniform vec3 uVoid;
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
uniform vec4 uNames;       // the same for the block of names
uniform float uNamesOn;
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

// The ridge at the foot of the frame, as a share of the frame's height.
// It is level where the two stand and rough further out.
float ridgeTop(float xs) {
  float away = abs(xs - uStand);
  float wide = fbm(vec2(xs * 1.6 + 3.0, 0.5)) - 0.5;
  float crag = fbm(vec2(xs * 7.0 + 9.0, 2.5)) - 0.5;
  float rough = smoothstep(0.035, 0.3, away);
  return uGroundTop - 0.034 * smoothstep(0.08, 0.9, away) + (0.07 * wide + 0.024 * crag) * rough;
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
  float behind = (1.0 - smoothstep(0.4, 1.6, length(wq * vec2(1.0, 0.9)))) * uWordsOn;
  // And behind the names: a box with soft edges. The thirty's own lights stay as they are.
  vec2 nq = max(abs(vUv - uNames.xy) - uNames.zw, 0.0) * vec2(uAspect, 1.0);
  float under = (1.0 - smoothstep(0.0, 0.07, length(nq))) * uNamesOn;
  vec3 body = texture(uLight, vUv).rgb + g1 * 0.17 + g2 * 0.1 + g3 * 0.04 * vec3(1.0, 0.9, 0.72) + rays;
  vec4 extra = texture(uExtra, vUv);
  vec3 hdr = (body * (1.0 - 0.8 * under) + extra.rgb) * (1.0 - 0.74 * behind);
  vec3 lit = 1.0 - exp(-hdr * 1.25);

  // The app's night: deep space above, the void at the foot.
  vec3 bg = mix(toLinear(uVoid), toLinear(uNight), smoothstep(0.0, 0.3, vUv.y));
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float vig = smoothstep(1.25, 0.25, length(q) / max(1.0, uAspect * 0.62));
  bg *= mix(0.62, 1.0, vig);

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
  vec3 dusk = mix(uGoldBright, uBlue, 0.2) * (0.05 * exp(-above * 9.0) + 0.085 * exp(-above * 32.0));
  dusk *= 0.75 + 0.25 * fbm(vec2(xs * 1.3 + 5.0, 1.5));
  c += dusk * (1.0 - 0.5 * uFlash);
  float hid = 0.0;
  if (vUv.y < range + 0.01) {
    // The farthest range is almost the sky's colour.
    vec3 hill = mix(toLinear(uNight) * 0.95, mix(uGoldBright, uBlue, 0.4) * 0.05, exp(-max(range - vUv.y, 0.0) * 45.0));
    hid = smoothstep(0.0, 1.5 * uPixel, range - vUv.y);
    c = mix(c, hill, hid);
  }
  if (vUv.y < far + 0.01) {
    // The far ridge stands in the haze, a shade lighter than the near one.
    vec3 hill = mix(toLinear(uNight) * 0.62, mix(uGoldBright, uBlue, 0.5) * 0.03, exp(-max(far - vUv.y, 0.0) * 60.0));
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
    c += (uBlue * 0.012 + warm * 0.03 * uHeartLight * below) * mist;
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
  float n = hash(gl_FragCoord.xy + fract(uT) * 91.7) + hash(gl_FragCoord.yx + fract(uT) * 37.3) - 1.0;
  c += n * (1.6 / 255.0);
  o = vec4(c, 1.0);
}
`;
