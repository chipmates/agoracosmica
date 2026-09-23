// THE SKY AS AN ENVIRONMENT MAP: six square views of the engine's own sky,
// resampled into a Blender-convention equirectangular image (u = atan2(y, -x),
// v = elevation, Z up) and written as Radiance RGBE, in linear light.
import { writeFileSync } from 'node:fs'

const W = 1024, H = 512

/** the six views as captureSky took them: look direction and up, in three's frame */
const FACES = [[1, 0, 0, 0, -1, 0], [-1, 0, 0, 0, -1, 0], [0, 1, 0, 0, 0, 1], [0, -1, 0, 0, 0, -1], [0, 0, 1, 0, -1, 0], [0, 0, -1, 0, -1, 0]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l) }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export function writeSky(sky, file) {
  const n = sky.size
  const faces = sky.faces.map((b64) => { const buf = Buffer.from(b64, 'base64'); return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)) })
  // a camera's basis as three's lookAt builds it: z = -forward, x = up x z, y = z x x
  const bases = FACES.map((f) => {
    const z = norm([-f[0], -f[1], -f[2]]), x = norm(cross([f[3], f[4], f[5]], z)), y = cross(z, x)
    return { x, y, z }
  })
  // WHICH WAY UP THE READ-BACK IS: a horizontal view has the sky in one half
  // and the ground in the other; the brighter half is the sky
  const f0 = faces[0]
  let topSum = 0, bottomSum = 0
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = (r * n + c) * 4, l = f0[i] * 0.2126 + f0[i + 1] * 0.7152 + f0[i + 2] * 0.0722
    if (r < n / 2) topSum += l; else bottomSum += l
  }
  const rowZeroIsTop = topSum >= bottomSum
  const sample = (d) => {
    let best = 0, bestV = -Infinity
    for (let k = 0; k < 6; k++) { const v = -dot(d, bases[k].z); if (v > bestV) { bestV = v; best = k } }
    const b = bases[best], depth = -dot(d, b.z)
    const px = dot(d, b.x) / depth, py = dot(d, b.y) / depth
    const col = Math.min(n - 1, Math.max(0, Math.floor(((px + 1) / 2) * n)))
    const row = Math.min(n - 1, Math.max(0, Math.floor((rowZeroIsTop ? (1 - py) / 2 : (1 + py) / 2) * n)))
    const i = (row * n + col) * 4, f = faces[best]
    return [f[i], f[i + 1], f[i + 2]]
  }
  const out = Buffer.alloc(W * H * 4)
  let mean = [0, 0, 0], peak = 0
  for (let j = 0; j < H; j++) {
    const v = 1 - (j + 0.5) / H, lat = (v - 0.5) * Math.PI
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W, lon = (u - 0.5) * 2 * Math.PI
      // Blender direction, then three's (x, z, -y)
      const bx = -Math.cos(lat) * Math.cos(lon), by = Math.cos(lat) * Math.sin(lon), bz = Math.sin(lat)
      const c = sample([bx, bz, -by])
      for (let k = 0; k < 3; k++) mean[k] += c[k] / (W * H)
      peak = Math.max(peak, ...c)
      const m = Math.max(c[0], c[1], c[2]), o = (j * W + i) * 4
      if (m < 1e-32) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; continue }
      const e = Math.ceil(Math.log2(m) + 1e-9), s = 256 / 2 ** e
      out[o] = Math.min(255, Math.floor(c[0] * s)); out[o + 1] = Math.min(255, Math.floor(c[1] * s)); out[o + 2] = Math.min(255, Math.floor(c[2] * s)); out[o + 3] = e + 128
    }
  }
  const header = Buffer.from(`#?RADIANCE\n# the engine's sky, six views resampled\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'ascii')
  writeFileSync(file, Buffer.concat([header, out]))
  return { file: 'sky.hdr', width: W, height: H, faceSize: n, rowZeroIsTop, mean, peak, background: sky.background }
}
