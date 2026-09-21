// WHERE TWO FRAMES DIFFER, and by how much. A hash says two captures are not
// the same; it never says whether the difference is a moved shadow edge or the
// film's own tooth. This prints the share, the strength and the box, and
// writes the difference amplified so it can be looked at.
//
//   node forge/prerender/frame-diff.mjs a.png b.png [out.png] [--gain=8]
import sharp from 'sharp'

const words = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const gain = Number((process.argv.slice(2).find((a) => a.startsWith('--gain=')) ?? '--gain=8').split('=')[1])
const [a, b, out] = words
if (!a || !b) throw new Error('two frames wanted')

const A = await sharp(a).raw().toBuffer({ resolveWithObject: true })
const B = await sharp(b).raw().toBuffer()
const { width: W, height: H, channels: C } = A.info
if (A.data.length !== B.length) throw new Error('the two frames are not the same size')

const d = Buffer.alloc(A.data.length)
let sum = 0
let moved = 0
let max = 0
let x0 = W
let x1 = -1
let y0 = H
let y1 = -1
for (let i = 0; i < A.data.length; i++) {
  const v = Math.abs(A.data[i] - B[i])
  d[i] = Math.min(255, v * gain)
  if (!v) continue
  moved++
  sum += v
  if (v > max) max = v
  const px = Math.floor(i / C)
  const x = px % W
  const y = Math.floor(px / W)
  if (x < x0) x0 = x
  if (x > x1) x1 = x
  if (y < y0) y0 = y
  if (y > y1) y1 = y
}
if (out) await sharp(d, { raw: { width: W, height: H, channels: C } }).png().toFile(out)
const share = (100 * moved) / A.data.length
console.log(
  `${W}x${H}: ${moved} of ${A.data.length} bytes differ (${share.toFixed(4)}%), ` +
    `mean ${moved ? (sum / moved).toFixed(2) : 0} of 255, max ${max}` +
    (moved ? `, box x ${x0} to ${x1}, y ${y0} to ${y1}` : '')
)
