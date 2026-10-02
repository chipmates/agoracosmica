// THE SAME PLACE ON THE WAY IN THE OTHER FRAMING. A leg is rendered once per
// framing along one eye path, each framing at its own pace (281 of the 357
// legs of the October release differ in frame count), so the share of the
// walk is no common measure: at one share the two eyes stand up to eleven
// metres apart. The frame sought is the other track's whose eye stands
// nearest, the look and then the share breaking ties where the eye stands
// still; none where no frame of it passes within a stride. The page and its
// tests read this one file.

/** metres of eye one radian of look counts as, where the eye stands still */
export const LOOK_METRES = 1
/** metres the whole of a walk's share counts as, the last tie-break */
export const SHARE_METRES = 0.2
/** the farthest apart two eyes may stand for a cross between them: a stride */
export const EYE_MOST = 0.75

/** where a print looks: the camera's -z through its Euler XYZ rotation */
const forward = (p) => [-Math.sin(p[4]), Math.sin(p[3]) * Math.cos(p[4]), -Math.cos(p[3]) * Math.cos(p[4])]

/** `from` and `to` are two tracks of one leg, a print a frame (eye x y z,
    rotation x y z, lens); `at` is the frame of `from` on screen. */
export function samePlace(from, at, to, { most = EYE_MOST } = {}) {
  if (!from?.length || !to?.length) return null
  const i = Math.max(0, Math.min(from.length - 1, Math.round(at)))
  const a = from[i], fa = forward(a)
  const share = from.length > 1 ? i / (from.length - 1) : 0
  let best = -1, cost = Infinity, eye = Infinity, look = 0
  for (let j = 0; j < to.length; j++) {
    const b = to[j], fb = forward(b)
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    const t = Math.acos(Math.max(-1, Math.min(1, fa[0] * fb[0] + fa[1] * fb[1] + fa[2] * fb[2])))
    const c = d + LOOK_METRES * t + SHARE_METRES * Math.abs((to.length > 1 ? j / (to.length - 1) : 0) - share)
    if (c < cost) { cost = c; best = j; eye = d; look = t }
  }
  return eye <= most ? { frame: best, eye, look } : null
}
