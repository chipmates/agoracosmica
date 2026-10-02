/**
 * createRoseFilm — the entry film's renderer (WebGL2, no library).
 *
 * The whole picture is a function of film time, so any second can be shown
 * on its own. Only the fading lines behind moving light carry history, and
 * seek() rebuilds them by running the last moments before the target time.
 */
import {
  ACCUM_FS,
  BLUR_FS,
  COMPOSITE_FS,
  DOT_FS,
  DOWN_FS,
  GUIDE_VS,
  POINT_FS,
  POINT_VS,
  QUAD_VS,
  SEAT_FS,
  SEAT_VS,
  STAR_VS,
  SUN_FS,
  SUN_VS,
} from './shaders';
import { guideLights } from './guide';
import {
  FIGURE_BOX,
  filmState,
  FILM_DURATION,
  GROUND,
  MEET_START,
  MEET_TRAVEL,
  RING_RADIUS,
  RISE_TRAVEL,
  ROSE,
  SEAT_COUNT,
  SEATS,
  type FilmLayout,
} from './timeline';

export type RoseFilmTier = 'desktop' | 'mobile' | 'mobile-low';
export type Rgb = [number, number, number];

export interface RoseFilmPalette {
  /** The night's four tones: around the rose, at the foot, at the rim, and one lighter veil. */
  night: Rgb;
  void: Rgb;
  abyss: Rgb;
  veil: Rgb;
  gold: Rgb;
  goldBright: Rgb;
  white: Rgb;
  blue: Rgb;
}

export interface RoseFilm {
  readonly duration: number;
  resize(): void;
  /** Render at a share of the tier's pixel budget (1 = full). For devices that fall behind. */
  setQuality(scale: number): void;
  /** Draw the moving light once per frame only. The first relief for a device that falls behind. */
  setSingleStep(single: boolean): void;
  /** The words' box (centre and half size, shares of the frame, y from the foot) and how present they are. */
  setWords(cx: number, cy: number, hw: number, hh: number, on: number): void;
  render(t: number, dt: number): void;
  seek(t: number): void;
  dispose(): void;
}

interface Budget {
  points: number;
  stars: number;
  /** The share of the rose's figures that are drawn (the rows keep their order, with wider gaps). */
  figures: number;
  dprCap: number;
  maxPixels: number;
  /** How often the moving light is drawn per 60th of a second, so its fading lines stay unbroken. */
  substeps: number;
  /** The small lights the guide unfolds into. */
  guide: number;
}

const BUDGET: Record<RoseFilmTier, Budget> = {
  desktop: { points: 130000, stars: 2600, figures: 1, dprCap: 2, maxPixels: 2.8e6, substeps: 4, guide: 2600 },
  mobile: { points: 56000, stars: 1500, figures: 0.8, dprCap: 2, maxPixels: 1.5e6, substeps: 3, guide: 1900 },
  'mobile-low': { points: 26000, stars: 900, figures: 0.55, dprCap: 1.5, maxPixels: 0.9e6, substeps: 2, guide: 1100 },
};

const FOV_Y = (40 * Math.PI) / 180;
// How far the sun's light and rays reach, in the picture's own measure.
const SUN_REACH = 1.95;
// Grains per pixel at which a grain shines at its own strength: thicker, each is dimmer.
const DENSE_REF = 0.1;
const RING_R = RING_RADIUS;
const TWO_PI = Math.PI * 2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inverse normal CDF (Acklam), enough for placing points across the river.
function probit(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || 'unknown';
    gl.deleteShader(sh);
    throw new Error(`rose-film shader: ${log}`);
  }
  return sh;
}

interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const prog = gl.createProgram()!;
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.linkProgram(prog);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`rose-film link: ${gl.getProgramInfoLog(prog) || 'unknown'}`);
  }
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    if (info) u[info.name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, u };
}

interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

export function createRoseFilm(
  canvas: HTMLCanvasElement,
  opts: { tier: RoseFilmTier; palette: RoseFilmPalette }
): RoseFilm {
  const budget = BUDGET[opts.tier];
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('rose-film: no WebGL2');

  const hdr = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  const rnd = mulberry32(3301);

  // ---- geometry -------------------------------------------------------------
  const N = budget.points;
  const pa = new Float32Array(N * 4);
  const pb = new Float32Array(N * 4);
  const pc = new Float32Array(N * 2);
  const gauss = () => probit(0.002 + 0.996 * rnd());
  // Its place in the river: a rank along it, a place across it and in its depth, a seed.
  const river = (i: number) => {
    const u0 = rnd();
    pa[i * 4] = u0;
    pa[i * 4 + 1] = probit(Math.min(0.999, Math.max(0.001, 0.8 * u0 + 0.2 * rnd())));
    pa[i * 4 + 2] = gauss();
    pa[i * 4 + 3] = rnd();
  };

  // The figures first, row by row: every tier inside the round carries two
  // rows of them, the round itself two rows of wings, the wreath its loose rows.
  const tiers = ROSE.tiers;
  let n = 0;
  const row = (radius: number, spread: number, pitch: number, winged: number) => {
    const count = Math.max(8, Math.round(((TWO_PI / pitch) * budget.figures)));
    const turn = rnd() * TWO_PI;
    for (let j = 0; j < count && n < N; j++) {
      river(n);
      pb[n * 4] = turn + (TWO_PI * (j + 0.7 * (rnd() - 0.5))) / count;
      pb[n * 4 + 1] = radius + spread * gauss();
      pb[n * 4 + 2] = rnd();
      pb[n * 4 + 3] = 0.5;
      pc[n * 2] = 0.001 + 0.999 * rnd();
      pc[n * 2 + 1] = rnd() < winged ? 1 : 0;
      n++;
    }
  };
  tiers.forEach((r, i) => {
    const gap = (i + 1 < tiers.length ? tiers[i + 1] : RING_R - 0.08) - r;
    row(r - 0.2 * gap, 0.05 * gap, 0.085 * 0.7, 0.65);
    row(r + 0.2 * gap, 0.05 * gap, 0.085 * 0.7, 0.65);
  });
  row(RING_R - 0.04, 0.012, 0.085 * 0.9, 0.9);
  row(RING_R + 0.05, 0.012, 0.085 * 0.9, 0.9);
  ROSE.wreath.forEach((r) => row(r, 0.045, 0.125 * 1.3, 1));
  row(1.53, 0.1, 0.125 * 2.6, 1);
  const figures = n;

  // Then the grains of light: most gather on the tiers, a third stays on the round, the rest drifts in the wreath.
  const tierWeight = tiers.map((r) => Math.pow(r, 1.25));
  const tierSum = tierWeight.reduce((a, b) => a + b, 0);
  for (let i = figures; i < N; i++) {
    river(i);
    const zone = rnd();
    let radius: number;
    if (zone < 0.5) {
      let pick = rnd() * tierSum;
      let k = 0;
      while (k < tiers.length - 1 && pick > tierWeight[k]) pick -= tierWeight[k++];
      const gap = (k + 1 < tiers.length ? tiers[k + 1] : RING_R - 0.08) - tiers[k];
      radius = tiers[k] + 0.2 * gap * gauss();
    } else if (zone < 0.82) {
      radius = RING_R + 0.038 * gauss();
    } else {
      radius = RING_R + 0.1 + 0.62 * Math.pow(rnd(), 1.6);
    }
    let kind = 0.1 + 0.9 * rnd();
    // A few points are sparks in the river, a few a soft haze.
    const special = rnd();
    if (special < 0.03) kind = special;
    pb[i * 4] = rnd() * TWO_PI;
    pb[i * 4 + 1] = Math.max(0.12, radius);
    pb[i * 4 + 2] = rnd();
    pb[i * 4 + 3] = kind;
  }

  const stars = new Float32Array(budget.stars * 4);
  for (let i = 0; i < budget.stars; i++) {
    const r = 9.5 * Math.sqrt(rnd());
    const a = rnd() * TWO_PI;
    stars[i * 4] = Math.cos(a) * r;
    stars[i * 4 + 1] = Math.sin(a) * r;
    stars[i * 4 + 2] = rnd();
    stars[i * 4 + 3] = rnd();
  }

  // Each of the thirty is drawn many times along its own path, so a rising
  // light carries an unbroken tail. The last entry is the light that comes down.
  const SEAT_SUBS = 80;
  const LIGHTS = SEAT_COUNT + 1;
  const seats = new Float32Array(LIGHTS * SEAT_SUBS * 4);
  const seatSub = new Float32Array(LIGHTS * SEAT_SUBS);
  const seatStart = new Float32Array(LIGHTS * SEAT_SUBS * 4);
  for (let i = 0; i < LIGHTS; i++) {
    const s = i < SEAT_COUNT ? SEATS[i] : null;
    for (let j = 0; j < SEAT_SUBS; j++) {
      const k = i * SEAT_SUBS + j;
      seats[k * 4] = s ? s.angle : 0;
      seats[k * 4 + 1] = s ? s.radius : 0;
      seats[k * 4 + 2] = s ? s.seed : 0.37;
      seats[k * 4 + 3] = s ? 0 : 1;
      seatSub[k] = j / (SEAT_SUBS - 1);
    }
  }

  // Her lights in the drawing's own measure, and the same placed on the frame.
  const guideShape = guideLights(budget.guide, rnd);
  const guide = new Float32Array(budget.guide * 4);

  const buffers: WebGLBuffer[] = [];
  const vaos: WebGLVertexArrayObject[] = [];
  function vao(attrs: { data: Float32Array; size: number }[], index?: Uint16Array): WebGLVertexArrayObject {
    const v = gl!.createVertexArray()!;
    gl!.bindVertexArray(v);
    attrs.forEach((a, loc) => {
      const buf = gl!.createBuffer()!;
      buffers.push(buf);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
      gl!.bufferData(gl!.ARRAY_BUFFER, a.data, gl!.STATIC_DRAW);
      gl!.enableVertexAttribArray(loc);
      gl!.vertexAttribPointer(loc, a.size, gl!.FLOAT, false, 0, 0);
    });
    if (index) {
      const ib = gl!.createBuffer()!;
      buffers.push(ib);
      gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, ib);
      gl!.bufferData(gl!.ELEMENT_ARRAY_BUFFER, index, gl!.STATIC_DRAW);
    }
    gl!.bindVertexArray(null);
    vaos.push(v);
    return v;
  }
  const pointVao = vao([{ data: pa, size: 4 }, { data: pb, size: 4 }, { data: pc, size: 2 }]);
  const starVao = vao([{ data: stars, size: 4 }]);
  const seatVao = vao([{ data: seats, size: 4 }, { data: seatSub, size: 1 }, { data: seatStart, size: 4 }]);
  const seatStartBuf = buffers[buffers.length - 1];
  const guideVao = vao([{ data: guide, size: 4 }]);
  const guideBuf = buffers[buffers.length - 1];
  const quadVao = vao([{ data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), size: 2 }]);

  // ---- programs -------------------------------------------------------------
  const pointP = link(gl, POINT_VS, POINT_FS);
  const starP = link(gl, STAR_VS, DOT_FS);
  const seatP = link(gl, SEAT_VS, SEAT_FS);
  const guideP = link(gl, GUIDE_VS, DOT_FS);
  const sunP = link(gl, SUN_VS, SUN_FS);
  const accumP = link(gl, QUAD_VS, ACCUM_FS);
  const downP = link(gl, QUAD_VS, DOWN_FS);
  const blurP = link(gl, QUAD_VS, BLUR_FS);
  const compP = link(gl, QUAD_VS, COMPOSITE_FS);
  const programs = [pointP, starP, seatP, guideP, sunP, accumP, downP, blurP, compP];
  // A figure is one point: no larger than this device draws a point.
  const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
  const figMax = Math.max(8, ((pointRange ? pointRange[1] : 64) || 64) / 2 - 1);

  // ---- targets --------------------------------------------------------------
  let W = 0;
  let H = 0;
  let cssW = 0;
  let cssH = 0;
  let scene: Target | null = null;
  let accum: [Target, Target] | null = null;
  let glow: { a: Target; b: Target }[] = [];
  let accumIdx = 0;
  let quality = 1;
  let singleStep = false;
  const words = new Float32Array([0.5, 0.86, 0.3, 0.05, 0]);
  const chest = new Float32Array([0.5, 0.2]);

  function makeTarget(w: number, h: number): Target {
    const tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    if (hdr) gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA16F, w, h, 0, gl!.RGBA, gl!.HALF_FLOAT, null);
    else gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA8, w, h, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    const fbo = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
    return { fbo, tex, w, h };
  }

  function freeTarget(t: Target | null) {
    if (!t) return;
    gl!.deleteFramebuffer(t.fbo);
    gl!.deleteTexture(t.tex);
  }

  function freeTargets() {
    freeTarget(scene);
    if (accum) accum.forEach(freeTarget);
    glow.forEach((g) => {
      freeTarget(g.a);
      freeTarget(g.b);
    });
    scene = null;
    accum = null;
    glow = [];
  }

  function clearTarget(t: Target) {
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, t.fbo);
    gl!.clearColor(0, 0, 0, 1);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, rect.width);
    cssH = Math.max(1, rect.height);
    const dpr = Math.min(budget.dprCap, window.devicePixelRatio || 1);
    const scale = Math.min(dpr, Math.sqrt((budget.maxPixels * quality) / (cssW * cssH)));
    const w = Math.max(2, Math.round(cssW * scale));
    const h = Math.max(2, Math.round(cssH * scale));
    if (w === W && h === H) return;
    W = w;
    H = h;
    canvas.width = W;
    canvas.height = H;
    freeTargets();
    scene = makeTarget(W, H);
    accum = [makeTarget(W, H), makeTarget(W, H)];
    accum.forEach(clearTarget);
    let gw = W;
    let gh = H;
    for (let i = 0; i < 3; i++) {
      gw = Math.max(2, gw >> 1);
      gh = Math.max(2, gh >> 1);
      glow.push({ a: makeTarget(gw, gh), b: makeTarget(gw, gh) });
    }
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    place();
  }

  // ---- matrices -------------------------------------------------------------
  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  const model = new Float32Array(9);

  function layout(): FilmLayout {
    const aspect = cssW / cssH;
    return { aspect, portrait: aspect < 0.8 };
  }

  function setCamera(dist: number, centerX: number, centerY: number) {
    const aspect = W / H;
    const f = 1 / Math.tan(FOV_Y / 2);
    const near = 0.1;
    const far = 80;
    proj.fill(0);
    proj[0] = f / aspect;
    proj[5] = f;
    proj[10] = (far + near) / (near - far);
    proj[11] = -1;
    proj[14] = (2 * far * near) / (near - far);
    // Shift the picture's centre: clip.xy += centre * clip.w, and w = -z_view.
    proj[8] = -centerX;
    proj[9] = -centerY;
    view.fill(0);
    view[0] = 1;
    view[5] = 1;
    view[10] = 1;
    view[15] = 1;
    view[14] = -dist;
    // The rose faces the two who look up into it.
    model.fill(0);
    model[0] = 1;
    model[4] = 1;
    model[8] = 1;
  }

  // The camera's distance at a moment of the film: the round fills a set share of the short side.
  function distanceAt(st: { halfShort: number; zoom: number }): number {
    return st.halfShort / (Math.tan(FOV_Y / 2) * Math.min(1, W / H)) / st.zoom;
  }

  const pal = opts.palette;
  function setCommon(p: Program, t: number, rot: number, px: number) {
    gl!.useProgram(p.prog);
    gl!.uniformMatrix4fv(p.u.uProj, false, proj);
    gl!.uniformMatrix4fv(p.u.uView, false, view);
    gl!.uniformMatrix3fv(p.u.uModel, false, model);
    gl!.uniform1f(p.u.uT, t);
    gl!.uniform1f(p.u.uRot, rot);
    gl!.uniform1f(p.u.uPx, px);
    gl!.uniform3fv(p.u.uGold, pal.gold);
    gl!.uniform3fv(p.u.uGoldBright, pal.goldBright);
    gl!.uniform3fv(p.u.uWhite, pal.white);
    gl!.uniform3fv(p.u.uBlue, pal.blue);
  }

  function drawQuad() {
    gl!.bindVertexArray(quadVao);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }

  // One moment of the moving light, added to the fading lines.
  function drawLight(t: number, dt: number, lay: FilmLayout) {
    const st = filmState(t, lay);
    const dist = distanceAt(st);
    setCamera(dist, st.centerX, st.centerY);
    const px = H / 2 / Math.tan(FOV_Y / 2);
    const sizeMul = Math.pow(H / cssH, 0.75) * (lay.portrait ? 0.85 : 1);

    gl!.bindFramebuffer(gl!.FRAMEBUFFER, scene!.fbo);
    gl!.viewport(0, 0, W, H);
    gl!.clearColor(0, 0, 0, 1);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.disable(gl!.DEPTH_TEST);
    gl!.enable(gl!.BLEND);
    gl!.blendFunc(gl!.ONE, gl!.ONE);

    // How thickly the grains lie in the finished rose on this screen.
    const pxEnd = px / distanceAt(filmState(FILM_DURATION - 2, lay));
    const dense = (N - figures) / (Math.PI * ROSE.rim * ROSE.rim * pxEnd * pxEnd);

    setCommon(pointP, t, st.rot, px);
    gl!.uniform1f(pointP.u.uBloom, st.bloom);
    gl!.uniform1f(pointP.u.uBend, st.bend);
    gl!.uniform1f(pointP.u.uRingR, RING_R);
    gl!.uniform1f(pointP.u.uLift, st.lift * RING_R);
    gl!.uniform1f(pointP.u.uRiverRot, st.riverRot);
    gl!.uniform1f(pointP.u.uWidth, st.width);
    gl!.uniform1f(pointP.u.uRingness, st.ringness);
    gl!.uniform1f(pointP.u.uSizeMul, sizeMul * st.grain);
    gl!.uniform1f(pointP.u.uFade, st.fade);
    gl!.uniform1f(pointP.u.uPour, st.pour);
    gl!.uniform1f(pointP.u.uShear, st.shear);
    gl!.uniform1f(pointP.u.uFigMax, figMax);
    gl!.uniform1f(pointP.u.uDense, Math.min(3, Math.max(0.5, dense / DENSE_REF)));
    gl!.bindVertexArray(pointVao);
    gl!.drawArrays(gl!.POINTS, 0, N);

    setCommon(sunP, t, st.rot, px);
    gl!.uniform1f(sunP.u.uSunR, SUN_REACH);
    gl!.uniform1f(sunP.u.uPxWorld, px / dist);
    gl!.uniform1f(sunP.u.uHeart, st.heart * st.fade);
    gl!.uniform1f(sunP.u.uPoint, st.point * st.fade);
    gl!.uniform1f(sunP.u.uSun, st.sun * st.fade);
    gl!.uniform1f(sunP.u.uBody, st.body * st.fade);
    gl!.uniform1f(sunP.u.uRingR, RING_R);
    drawQuad();

    gl!.disable(gl!.BLEND);

    const prev = accum![accumIdx];
    const next = accum![1 - accumIdx];
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, next.fbo);
    gl!.useProgram(accumP.prog);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, scene!.tex);
    gl!.uniform1i(accumP.u.uScene, 0);
    gl!.activeTexture(gl!.TEXTURE1);
    gl!.bindTexture(gl!.TEXTURE_2D, prev.tex);
    gl!.uniform1i(accumP.u.uPrev, 1);
    gl!.uniform1f(accumP.u.uDecay, Math.exp(-Math.max(0.0005, dt) / st.trail));
    drawQuad();
    accumIdx = 1 - accumIdx;
  }

  function render(t: number, dt: number) {
    if (!scene || !accum) return;
    const lay = layout();

    // Light that moves fast is drawn several times across the frame's time,
    // or its fading line breaks into a row of dots.
    const st0 = filmState(t, lay);
    const steps = singleStep ? 1 : Math.max(1, Math.min(12, Math.round(1 + (budget.substeps * dt * 60 - 1) * st0.motion)));
    const span = Math.min(dt, t);
    for (let k = 1; k <= steps; k++) drawLight(t - span + (span * k) / steps, dt / steps, lay);

    const st = st0;
    // The stars turn around the place where the point first stood.
    const start = filmState(0, lay);
    const aspect = W / H;
    const px = H / 2 / Math.tan(FOV_Y / 2);
    const sizeMul = Math.pow(H / cssH, 0.75) * (lay.portrait ? 0.85 : 1);
    const next = accum[accumIdx];

    // ---- the stars and the thirty, outside the fading lines: each of the thirty carries its own tail
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, scene.fbo);
    gl!.viewport(0, 0, W, H);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.clearColor(0, 0, 0, 1);
    gl!.enable(gl!.BLEND);
    gl!.blendFunc(gl!.ONE, gl!.ONE);

    // The stars leave the alpha alone: it marks the lights that stand before the far ridge.
    gl!.colorMask(true, true, true, false);
    setCommon(starP, t, st.rot, px);
    gl!.uniform1f(starP.u.uStarRot, st.starRot);
    gl!.uniform1f(starP.u.uSizeMul, sizeMul);
    gl!.uniform1f(starP.u.uFade, st.fade);
    gl!.uniform3f(starP.u.uStarFrame, start.centerX, start.centerY, aspect);
    gl!.uniform4f(starP.u.uWords, words[0], words[1], words[2], words[3]);
    gl!.uniform1f(starP.u.uWordsOn, words[4]);
    gl!.uniform4f(starP.u.uRose, st.centerX, st.centerY, (ROSE.rim * px) / distanceAt(st) / H, st.body);
    gl!.bindVertexArray(starVao);
    gl!.drawArrays(gl!.POINTS, 0, budget.stars);
    gl!.colorMask(true, true, true, true);

    if (t > SEATS[0].kindle) {
      const halfH = st.halfShort / Math.min(1, aspect) / st.zoom;
      setCommon(seatP, t, st.rot, px);
      gl!.uniform4f(seatP.u.uFrame, halfH * aspect, halfH, st.centerX, st.centerY);
      gl!.uniform1f(seatP.u.uSizeMul, sizeMul);
      gl!.uniform1f(seatP.u.uFade, st.fade);
      gl!.uniform1f(seatP.u.uTail, 0.26);
      gl!.uniform1f(seatP.u.uWait, lay.portrait ? 0.8 : 1);
      gl!.uniform1f(seatP.u.uTravel, RISE_TRAVEL);
      gl!.bindVertexArray(seatVao);
      gl!.drawArrays(gl!.POINTS, 0, SEAT_COUNT * SEAT_SUBS);
      if (st.meet > 0 && st.meet < 1) {
        gl!.uniform1f(seatP.u.uTravel, MEET_TRAVEL);
        gl!.drawArrays(gl!.POINTS, SEAT_COUNT * SEAT_SUBS, SEAT_SUBS);
      }
    }
    if (st.beatrice > 0.001) {
      gl!.useProgram(guideP.prog);
      gl!.uniform2f(guideP.u.uChest, chest[0], chest[1]);
      gl!.uniform1f(guideP.u.uShow, st.beatrice);
      gl!.uniform1f(guideP.u.uT, t);
      gl!.uniform1f(guideP.u.uSizeMul, sizeMul);
      gl!.uniform1f(guideP.u.uFade, st.fade * (1 - st.flash));
      gl!.uniform3fv(guideP.u.uGoldBright, pal.goldBright);
      gl!.uniform3fv(guideP.u.uWhite, pal.white);
      gl!.bindVertexArray(guideVao);
      gl!.drawArrays(gl!.POINTS, 0, budget.guide);
    }
    gl!.disable(gl!.BLEND);

    // ---- glow -----------------------------------------------------------------
    let src: Target = next;
    for (const g of glow) {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, g.a.fbo);
      gl!.viewport(0, 0, g.a.w, g.a.h);
      gl!.useProgram(downP.prog);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, src.tex);
      gl!.uniform1i(downP.u.uTex, 0);
      gl!.uniform2f(downP.u.uTexel, 1 / src.w, 1 / src.h);
      gl!.uniform1f(downP.u.uKnee, src === next ? 0.3 + 0.6 * st.body : 0);
      gl!.activeTexture(gl!.TEXTURE1);
      gl!.bindTexture(gl!.TEXTURE_2D, scene.tex);
      gl!.uniform1i(downP.u.uTex2, 1);
      gl!.uniform1f(downP.u.uAdd, src === next ? 1 : 0);
      gl!.activeTexture(gl!.TEXTURE0);
      drawQuad();
      gl!.useProgram(blurP.prog);
      gl!.uniform1i(blurP.u.uTex, 0);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, g.b.fbo);
      gl!.bindTexture(gl!.TEXTURE_2D, g.a.tex);
      gl!.uniform2f(blurP.u.uDir, 1 / g.a.w, 0);
      drawQuad();
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, g.a.fbo);
      gl!.bindTexture(gl!.TEXTURE_2D, g.b.tex);
      gl!.uniform2f(blurP.u.uDir, 0, 1 / g.a.h);
      drawQuad();
      src = g.a;
    }

    // ---- the frame ------------------------------------------------------------
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, W, H);
    gl!.useProgram(compP.prog);
    const bind = (unit: number, tex: WebGLTexture, loc: WebGLUniformLocation | null) => {
      gl!.activeTexture(gl!.TEXTURE0 + unit);
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      gl!.uniform1i(loc, unit);
    };
    bind(0, next.tex, compP.u.uLight);
    bind(1, glow[0].a.tex, compP.u.uGlow1);
    bind(2, glow[1].a.tex, compP.u.uGlow2);
    bind(3, glow[2].a.tex, compP.u.uGlow3);
    bind(4, scene.tex, compP.u.uExtra);
    gl!.uniform3fv(compP.u.uWhite, pal.white);
    gl!.uniform3fv(compP.u.uBlue, pal.blue);
    gl!.uniform3fv(compP.u.uNight, pal.night);
    gl!.uniform3fv(compP.u.uVoid, pal.void);
    gl!.uniform3fv(compP.u.uAbyss, pal.abyss);
    gl!.uniform3fv(compP.u.uVeil, pal.veil);
    gl!.uniform3fv(compP.u.uGoldBright, pal.goldBright);
    gl!.uniform2f(compP.u.uHeartUv, 0.5 + st.centerX * 0.5, 0.5 + st.centerY * 0.5);
    gl!.uniform1f(compP.u.uRays, st.rays);
    gl!.uniform1f(compP.u.uFlash, st.flash);
    gl!.uniform1f(compP.u.uT, t);
    gl!.uniform1f(compP.u.uAspect, aspect);
    gl!.uniform1f(compP.u.uGroundTop, st.groundTop);
    gl!.uniform1f(compP.u.uShort, aspect / Math.min(1, aspect));
    gl!.uniform1f(compP.u.uStand, (st.standX - 0.5) * (aspect / Math.min(1, aspect)));
    gl!.uniform1f(compP.u.uPixel, 1 / H);
    gl!.uniform1f(compP.u.uHeartLight, st.heart * st.fade);
    gl!.uniform4f(compP.u.uWords, words[0], words[1], words[2], words[3]);
    gl!.uniform1f(compP.u.uWordsOn, words[4]);
    drawQuad();
    gl!.bindVertexArray(null);
  }

  function seek(t: number) {
    if (!accum) return;
    accum.forEach(clearTarget);
    const step = 1 / 60;
    const from = Math.max(0, t - 0.6);
    for (let x = from; x < t; x += step) render(x, step);
    render(t, step);
  }

  function dispose() {
    freeTargets();
    buffers.forEach((b) => gl!.deleteBuffer(b));
    vaos.forEach((v) => gl!.deleteVertexArray(v));
    programs.forEach((p) => gl!.deleteProgram(p.prog));
  }

  function setQuality(scale: number) {
    quality = Math.min(1, Math.max(0.25, scale));
    resize();
  }

  function setSingleStep(single: boolean) {
    singleStep = single;
  }

  // Where the thirty wait and where she lands. It depends on the frame's shape.
  function place() {
    const lay = layout();
    const g = lay.portrait ? GROUND.portrait : GROUND.landscape;
    const boxW = (g.figure * FIGURE_BOX.aspect) / lay.aspect;
    for (let i = 0; i < LIGHTS; i++) {
      const seat = i < SEAT_COUNT ? SEATS[i] : null;
      // The thirty kindle along the far ranges. She lands where her drawing stands, at the height of her chest.
      const x = seat ? seat.startX : g.standX + (FIGURE_BOX.beatriceX - 0.5) * boxW;
      const y = seat ? g.top + 0.062 + 0.026 * ((i * 7) % 4) : g.top + g.figure * FIGURE_BOX.chestY;
      for (let j = 0; j < SEAT_SUBS; j++) {
        const k = (i * SEAT_SUBS + j) * 4;
        seatStart[k] = x;
        seatStart[k + 1] = y;
        seatStart[k + 2] = seat ? seat.kindle : 0;
        seatStart[k + 3] = seat ? seat.lift : MEET_START;
      }
    }
    gl!.bindBuffer(gl!.ARRAY_BUFFER, seatStartBuf);
    gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, seatStart);

    // The guide's lights, from the drawing's measure to shares of the frame.
    const left = g.standX - boxW / 2;
    const foot = g.top - 0.009;
    for (let i = 0; i < budget.guide; i++) {
      guide[i * 4] = left + ((FIGURE_BOX.beatriceX * 120 + guideShape[i * 4]) / 120) * boxW;
      guide[i * 4 + 1] = foot + (g.figure * (4 - guideShape[i * 4 + 1])) / 116;
      guide[i * 4 + 2] = guideShape[i * 4 + 2];
      guide[i * 4 + 3] = guideShape[i * 4 + 3];
    }
    gl!.bindBuffer(gl!.ARRAY_BUFFER, guideBuf);
    gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, guide);
    chest[0] = g.standX + (FIGURE_BOX.beatriceX - 0.5) * boxW;
    chest[1] = g.top + g.figure * FIGURE_BOX.chestY;
  }

  function setWords(cx: number, cy: number, hw: number, hh: number, on: number) {
    words[0] = cx;
    words[1] = cy;
    words[2] = hw;
    words[3] = hh;
    words[4] = on;
  }

  resize();
  return { duration: FILM_DURATION, resize, setQuality, setSingleStep, setWords, render, seek, dispose };
}
