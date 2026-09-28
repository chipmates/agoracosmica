/** THE CARVING, SAMPLED. A distance function written in GLSL is sampled on a
 * grid on a private WebGL2 canvas, meshed on the CPU by naive surface nets,
 * and every vertex is then refined on the GPU: projected onto the surface,
 * given its normal, its near and wide occlusion, its convexity and the
 * material its part names. The canvas is not the museum's renderer, so the
 * same code runs beside the WebGPU stage or its WebGL2 fallback.
 */

export interface BakeSpec {
  name: string
  /** GLSL defining `float map(vec3 p)` and `float matId(vec3 p)`. */
  glsl: string
  bmin: readonly [number, number, number]
  bmax: readonly [number, number, number]
  /** grid spacing, metres */
  h: number
  /** occlusion radius, metres */
  aoR: number
  /** convexity probe radius, metres */
  curvR?: number
}

export interface Baked {
  position: Float32Array
  normal: Float32Array
  /** near occlusion, wide occlusion, convexity, material id */
  attr: Float32Array
  index: Uint32Array
}

const VS = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`

function gridFS(library: string, body: string): string {
  return `#version 300 es
precision highp float; precision highp int;
uniform vec3 uMin; uniform float uH; uniform ivec3 uN; uniform int uCols;
out vec4 o;
${library}
${body}
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  int tx = fc.x / uN.x, ty = fc.y / uN.y;
  int ix = fc.x - tx * uN.x, iy = fc.y - ty * uN.y;
  int iz = (ty * uCols + tx) * 4;
  vec3 p = uMin + vec3(float(ix), float(iy), float(iz)) * uH;
  o = vec4(map(p), map(p + vec3(0.0, 0.0, uH)), map(p + vec3(0.0, 0.0, 2.0 * uH)), map(p + vec3(0.0, 0.0, 3.0 * uH)));
}`
}

function refineFS(library: string, body: string): string {
  return `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uPos; uniform int uW; uniform int uCount; uniform float uH; uniform float uAoR; uniform float uCurvR;
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; layout(location = 2) out vec4 o2;
${library}
${body}
vec3 grad(vec3 p, float e){
  const vec2 k = vec2(1.0, -1.0);
  return k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e);
}
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  int id = fc.y * uW + fc.x;
  if (id >= uCount) { o0 = vec4(0.0); o1 = vec4(0.0); o2 = vec4(0.0); return; }
  vec3 p0 = texelFetch(uPos, fc, 0).xyz, p = p0;
  for (int i = 0; i < 4; i++) { float e = uH * 0.25; float d = map(p); vec3 g = grad(p, e); float gl2 = max(dot(g, g), 1e-12); p -= g * (d * 4.0 * e / gl2) * 0.9; }
  // where Newton leaves the cell or stops short (creases, cut edges), bisect
  // along the start's gradient for the sign change within 1.2 cells
  if (length(p - p0) > uH * 1.2 || abs(map(p)) > uH * 0.02) {
    float d0 = map(p0);
    vec3 g0 = grad(p0, uH * 0.25);
    vec3 dir = -sign(d0) * g0 / max(length(g0), 1e-9);
    float a = 0.0, b = -1.0;
    for (int k = 1; k <= 8; k++) {
      float t = uH * 0.15 * float(k);
      if (sign(map(p0 + dir * t)) != sign(d0)) { b = t; a = t - uH * 0.15; break; }
    }
    if (b > 0.0) {
      for (int k = 0; k < 14; k++) { float m = 0.5 * (a + b); if (sign(map(p0 + dir * m)) == sign(d0)) a = m; else b = m; }
      p = p0 + dir * (0.5 * (a + b));
    } else if (length(p - p0) > uH * 1.2) p = p0;
  }
  vec3 n = normalize(grad(p, uH * 0.3));
  float occ = 0.0, sca = 1.0;
  for (int i = 1; i <= 5; i++) { float hh = uAoR * 0.2 * float(i); occ += (hh - map(p + n * hh)) * sca; sca *= 0.75; }
  float aoN = clamp(1.0 - 3.0 * occ / uAoR, 0.0, 1.0);
  vec3 t1 = normalize(abs(n.y) < 0.9 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  float vis = 0.0;
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 16.0);
    vec3 dir = normalize(n * sqrt(1.0 - r * r) + (t1 * cos(a) + t2 * sin(a)) * r);
    float v = 1.0;
    for (int j = 1; j <= 5; j++) { float s = uAoR * 2.5 * float(j) / 5.0; v = min(v, clamp(map(p + dir * s) / (s * 0.5), 0.0, 1.0)); }
    vis += v;
  }
  float aoH = vis / 16.0;
  float c = 0.0;
  for (int i = 0; i < 14; i++) {
    vec3 d = i < 6 ? vec3(i == 0 ? 1.0 : i == 1 ? -1.0 : 0.0, i == 2 ? 1.0 : i == 3 ? -1.0 : 0.0, i == 4 ? 1.0 : i == 5 ? -1.0 : 0.0)
                   : normalize(vec3((i & 1) == 0 ? 1.0 : -1.0, (i & 2) == 0 ? 1.0 : -1.0, (i & 4) == 0 ? 1.0 : -1.0));
    c += map(p + d * uCurvR);
  }
  c = c / 14.0 / uCurvR;
  o0 = vec4(p, matId(p));
  o1 = vec4(n, aoN);
  o2 = vec4(c, aoH, 0.0, 0.0);
}`
}

export class LionBaker {
  private readonly gl: WebGL2RenderingContext
  private readonly maxW: number
  private readonly vbo: WebGLBuffer
  readonly stats: string[] = []

  constructor(private readonly library: string) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 4
    const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, alpha: false, preserveDrawingBuffer: false })
    if (!gl) throw new Error('the lion is carved on a WebGL2 canvas, and this page has none')
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float missing')
    this.gl = gl
    this.maxW = Math.min(8192, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number)
    const vbo = gl.createBuffer()
    if (!vbo) throw new Error('no buffer')
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    this.vbo = vbo
  }

  private program(fs: string): WebGLProgram {
    const gl = this.gl
    const compile = (type: number, src: string): WebGLShader => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, src)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) ?? ''
        const lines = src.split('\n').map((l, i) => `${i + 1}: ${l}`)
        const m = /ERROR: \d+:(\d+)/.exec(log)
        const at = m ? lines.slice(Math.max(0, Number(m[1]) - 4), Number(m[1]) + 2).join('\n') : ''
        throw new Error(`lion shader: ${log}\n${at}`)
      }
      return shader
    }
    const p = gl.createProgram()!
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs))
    gl.bindAttribLocation(p, 0, 'aPos')
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`lion link: ${gl.getProgramInfoLog(p) ?? ''}`)
    return p
  }

  /** Bands keep each draw short: a long one trips a driver's watchdog. */
  private drawBands(W: number, H: number, bandH: number): void {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.viewport(0, 0, W, H)
    gl.enable(gl.SCISSOR_TEST)
    for (let y = 0; y < H; y += bandH) {
      gl.scissor(0, y, W, Math.min(bandH, H - y))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.finish()
    }
    gl.disable(gl.SCISSOR_TEST)
  }

  bake(spec: BakeSpec): Baked {
    const gl = this.gl, t0 = performance.now()
    const { glsl, bmin, bmax, h } = spec
    const nx = Math.ceil((bmax[0] - bmin[0]) / h) + 1, ny = Math.ceil((bmax[1] - bmin[1]) / h) + 1
    const nz = Math.ceil((bmax[2] - bmin[2]) / h / 4) * 4
    const tiles = nz / 4, cols = Math.max(1, Math.floor(this.maxW / nx)), rows = Math.ceil(tiles / cols)
    const W = Math.min(tiles, cols) * nx, H = rows * ny
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, W, H)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    const gp = this.program(gridFS(this.library, glsl))
    gl.useProgram(gp)
    gl.uniform3f(gl.getUniformLocation(gp, 'uMin'), bmin[0], bmin[1], bmin[2])
    gl.uniform1f(gl.getUniformLocation(gp, 'uH'), h)
    gl.uniform3i(gl.getUniformLocation(gp, 'uN'), nx, ny, nz)
    gl.uniform1i(gl.getUniformLocation(gp, 'uCols'), cols)
    this.drawBands(W, H, Math.max(ny, 256))
    const buffer = new Float32Array(W * H * 4)
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, buffer)
    gl.deleteFramebuffer(fb); gl.deleteTexture(tex); gl.deleteProgram(gp)
    const t1 = performance.now()
    const grid = new Float32Array(nx * ny * nz)
    for (let t = 0; t < tiles; t++) {
      const tx = t % cols, ty = (t / cols) | 0
      for (let j = 0; j < 4; j++) {
        const iz = t * 4 + j
        for (let iy = 0; iy < ny; iy++) {
          let src = ((ty * ny + iy) * W + tx * nx) * 4 + j
          const dst = (iz * ny + iy) * nx
          for (let ix = 0; ix < nx; ix++, src += 4) grid[dst + ix] = buffer[src]!
        }
      }
    }
    const mesh = surfaceNets(grid, nx, ny, nz, bmin, h)
    const t2 = performance.now()
    const out = mesh.count ? this.refine(glsl, mesh.pos, mesh.count, h, spec.aoR, spec.curvR ?? h * 3)
      : { position: new Float32Array(0), normal: new Float32Array(0), attr: new Float32Array(0) }
    const t3 = performance.now()
    this.stats.push(`${spec.name}: grid ${nx}x${ny}x${nz} ${(t1 - t0).toFixed(0)}ms, nets ${mesh.count}v ${(t2 - t1).toFixed(0)}ms, refine ${(t3 - t2).toFixed(0)}ms`)
    return { position: out.position, normal: out.normal, attr: out.attr, index: mesh.index }
  }

  private refine(glsl: string, pos: Float32Array, count: number, h: number, aoR: number, curvR: number): Omit<Baked, 'index'> {
    const gl = this.gl
    const Wt = 2048, Ht = Math.max(1, Math.ceil(count / Wt))
    const data = new Float32Array(Wt * Ht * 4)
    for (let i = 0; i < count; i++) { data[i * 4] = pos[i * 3]!; data[i * 4 + 1] = pos[i * 3 + 1]!; data[i * 4 + 2] = pos[i * 3 + 2]! }
    const src = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, src)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, Wt, Ht)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, Wt, Ht, gl.RGBA, gl.FLOAT, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    const outs = [0, 1, 2].map(() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, Wt, Ht); return t })
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    outs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0))
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2])
    const rp = this.program(refineFS(this.library, glsl))
    gl.useProgram(rp)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src)
    gl.uniform1i(gl.getUniformLocation(rp, 'uPos'), 0)
    gl.uniform1i(gl.getUniformLocation(rp, 'uW'), Wt)
    gl.uniform1i(gl.getUniformLocation(rp, 'uCount'), count)
    gl.uniform1f(gl.getUniformLocation(rp, 'uH'), h)
    gl.uniform1f(gl.getUniformLocation(rp, 'uAoR'), aoR)
    gl.uniform1f(gl.getUniformLocation(rp, 'uCurvR'), curvR)
    this.drawBands(Wt, Ht, 16)
    const read = (i: number): Float32Array => {
      gl.readBuffer(gl.COLOR_ATTACHMENT0 + i)
      const b = new Float32Array(Wt * Ht * 4)
      gl.readPixels(0, 0, Wt, Ht, gl.RGBA, gl.FLOAT, b)
      return b
    }
    const r0 = read(0), r1 = read(1), r2 = read(2)
    gl.deleteFramebuffer(fb); gl.deleteTexture(src); outs.forEach(t => gl.deleteTexture(t)); gl.deleteProgram(rp)
    const position = new Float32Array(count * 3), normal = new Float32Array(count * 3), attr = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      position[i * 3] = r0[i * 4]!; position[i * 3 + 1] = r0[i * 4 + 1]!; position[i * 3 + 2] = r0[i * 4 + 2]!
      normal[i * 3] = r1[i * 4]!; normal[i * 3 + 1] = r1[i * 4 + 1]!; normal[i * 3 + 2] = r1[i * 4 + 2]!
      attr[i * 4] = r1[i * 4 + 3]!
      attr[i * 4 + 1] = r2[i * 4 + 1]!
      attr[i * 4 + 2] = r2[i * 4]!
      attr[i * 4 + 3] = r0[i * 4 + 3]!
    }
    return { position, normal, attr }
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteBuffer(this.vbo)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

/** Naive surface nets: one vertex per sign-changing cell at the mean of its
 * edge crossings, one quad per sign-changing grid edge. */
export function surfaceNets(grid: Float32Array, nx: number, ny: number, nz: number, bmin: readonly number[], h: number): { pos: Float32Array; count: number; index: Uint32Array } {
  const cx = nx - 1, cy = ny - 1
  const slA = new Int32Array(cx * cy).fill(-1), slB = new Int32Array(cx * cy).fill(-1)
  let pos = new Float32Array(1 << 16), pc = 0
  let idx = new Uint32Array(1 << 17), ic = 0
  const v = new Float32Array(8)
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]] as const
  const sx = 1, sy = nx, sz = nx * ny
  const off = [0, sx, sy, sx + sy, sz, sz + sx, sz + sy, sz + sx + sy]
  const dist2 = (a: number, b: number): number => {
    const dx = pos[a * 3]! - pos[b * 3]!, dy = pos[a * 3 + 1]! - pos[b * 3 + 1]!, dz = pos[a * 3 + 2]! - pos[b * 3 + 2]!
    return dx * dx + dy * dy + dz * dz
  }
  const pushQuad = (a: number, b: number, c: number, d: number, flip: boolean): void => {
    if (ic + 6 > idx.length) { const n = new Uint32Array(idx.length * 2); n.set(idx); idx = n }
    let t = dist2(a, c) <= dist2(b, d) ? [a, b, c, a, c, d] : [a, b, d, b, c, d]
    if (flip) t = [t[0]!, t[2]!, t[1]!, t[3]!, t[5]!, t[4]!]
    for (let k = 0; k < 6; k++) idx[ic++] = t[k]!
  }
  for (let z = 0; z < nz - 1; z++) {
    const cur = (z & 1) ? slB : slA, prev = (z & 1) ? slA : slB
    for (let y = 0; y < cy; y++) {
      for (let x = 0; x < cx; x++) {
        const base = x + y * nx + z * sz
        let mask = 0
        for (let i = 0; i < 8; i++) { v[i] = grid[base + off[i]!]!; if (v[i]! < 0) mask |= 1 << i }
        const ci = x + y * cx
        if (mask === 0 || mask === 255) { cur[ci] = -1; continue }
        let ax = 0, ay = 0, az = 0, n = 0
        for (const [a, b] of E) {
          if (((mask >> a) & 1) === ((mask >> b) & 1)) continue
          const t = v[a]! / (v[a]! - v[b]!)
          ax += (a & 1) + t * ((b & 1) - (a & 1))
          ay += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1))
          az += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1))
          n++
        }
        if (pc + 3 > pos.length) { const nn = new Float32Array(pos.length * 2); nn.set(pos); pos = nn }
        const vi = pc / 3
        pos[pc++] = bmin[0]! + (x + ax / n) * h
        pos[pc++] = bmin[1]! + (y + ay / n) * h
        pos[pc++] = bmin[2]! + (z + az / n) * h
        cur[ci] = vi
        const in0 = v[0]! < 0
        if (y > 0 && z > 0 && in0 !== (v[1]! < 0)) {
          const a = cur[ci]!, b = cur[ci - cx]!, c = prev[ci - cx]!, d = prev[ci]!
          if (a >= 0 && b >= 0 && c >= 0 && d >= 0) pushQuad(a, b, c, d, !in0)
        }
        if (x > 0 && z > 0 && in0 !== (v[2]! < 0)) {
          const a = cur[ci]!, b = prev[ci]!, c = prev[ci - 1]!, d = cur[ci - 1]!
          if (a >= 0 && b >= 0 && c >= 0 && d >= 0) pushQuad(a, b, c, d, !in0)
        }
        if (x > 0 && y > 0 && in0 !== (v[4]! < 0)) {
          const a = cur[ci]!, b = cur[ci - 1]!, c = cur[ci - 1 - cx]!, d = cur[ci - cx]!
          if (a >= 0 && b >= 0 && c >= 0 && d >= 0) pushQuad(a, b, c, d, !in0)
        }
      }
    }
    prev.fill(-1)
  }
  return { pos: pos.slice(0, pc), count: pc / 3, index: idx.slice(0, ic) }
}
