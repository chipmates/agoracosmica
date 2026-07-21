/* The Atlas of the Six — the sky phase as a carousel of constellations.
   The dome carries six rigid asterisms around the visitor; scrolling
   wheels the night so the focused house arrives at the gaze. Shapes are
   modeled on real asterisms (the shape IS the identity), so the whole
   dome may breathe but a constellation never deforms. */

import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three/webgpu'
import { CONSTELLATIONS } from '../content/constellations'

const GOLD = new Color('#e0b96a')
const LINE_GOLD = new Color('#caa45d')

const RADIUS = 46
/** patch scale on a wide stage; narrow stages compress via aspect */
const WIDE_SCALE = 5.0

export interface AtlasStarRef {
  slug: string
  chapter: number
  sprite: Sprite
}

export interface AtlasHandles {
  /** ease the dome + staging toward the focused chapter */
  update(dt: number, elapsed: number, aspect: number, reveal: number): void
  /** snap the wheel instantly (forge + reduced motion) */
  snap(chapter: number): void
  setChapter(chapter: number): void
  currentElevation(): number
  /** world position of a star (for projection + the crossing flight) */
  starWorld(slug: string, out: Vector3): Vector3 | null
  stars: AtlasStarRef[]
  visible(v: boolean): void
}

export function createAtlas(scene: Scene): AtlasHandles {
  const dome = new Group()
  dome.visible = false
  scene.add(dome)

  function glowTexture(): CanvasTexture {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255, 250, 232, 1)')
    g.addColorStop(0.1, 'rgba(246, 223, 174, 0.85)')
    g.addColorStop(0.25, 'rgba(224, 185, 106, 0.22)')
    g.addColorStop(0.6, 'rgba(224, 185, 106, 0.05)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new CanvasTexture(canvas)
  }
  const starMap = glowTexture()

  interface Patch {
    group: Group
    starMats: SpriteMaterial[]
    lineMat: LineBasicMaterial
    focus: number // eased 0..1
  }

  const patches: Patch[] = []
  const stars: AtlasStarRef[] = []

  for (let ci = 0; ci < CONSTELLATIONS.length; ci++) {
    const c = CONSTELLATIONS[ci]
    if (!c) continue
    const patch = new Group()
    // the patch hangs on the dome in its azimuth/elevation direction and
    // faces the visitor at the center
    const dir = new Vector3(
      Math.sin(c.azimuth) * Math.cos(c.elevation),
      Math.sin(c.elevation),
      -Math.cos(c.azimuth) * Math.cos(c.elevation)
    )
    patch.position.copy(dir).multiplyScalar(RADIUS)
    patch.lookAt(0, 0, 0)
    patch.scale.setScalar(WIDE_SCALE)

    const starMats: SpriteMaterial[] = []
    for (const s of c.stars) {
      const mat = new SpriteMaterial({
        map: starMap,
        color: GOLD,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      })
      const sprite = new Sprite(mat)
      sprite.position.set(s.x, s.y, 0)
      sprite.scale.setScalar(s.alpha ? 0.62 : 0.4)
      patch.add(sprite)
      starMats.push(mat)
      stars.push({ slug: s.slug, chapter: ci, sprite })
    }

    // hairlines: one segment list per constellation, local coordinates
    const pos: number[] = []
    for (const [a, b] of c.lines) {
      const sa = c.stars[a]
      const sb = c.stars[b]
      if (!sa || !sb) continue
      // start/end pulled in toward each star so lines rest, not touch
      const dx = sb.x - sa.x
      const dy = sb.y - sa.y
      const len = Math.hypot(dx, dy) || 1
      const inset = 0.13
      pos.push(sa.x + (dx / len) * inset, sa.y + (dy / len) * inset, 0)
      pos.push(sb.x - (dx / len) * inset, sb.y - (dy / len) * inset, 0)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    const lineMat = new LineBasicMaterial({
      color: LINE_GOLD,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    patch.add(new LineSegments(geo, lineMat))

    dome.add(patch)
    patches.push({ group: patch, starMats, lineMat, focus: ci === 0 ? 1 : 0 })
  }

  let chapter = 0
  let wheel = 0 // eased dome rotation, radians
  let elevation = CONSTELLATIONS[0]?.elevation ?? 0.6

  function targetWheel(): number {
    const az = CONSTELLATIONS[chapter]?.azimuth ?? 0
    // rotate the dome so the focused patch faces azimuth 0; take the
    // short way around the ring
    let t = az
    while (t - wheel > Math.PI) t -= Math.PI * 2
    while (t - wheel < -Math.PI) t += Math.PI * 2
    return t
  }

  function update(dt: number, elapsed: number, aspect: number, reveal: number): void {
    if (!dome.visible) return
    const t = targetWheel()
    wheel += (t - wheel) * Math.min(1, dt * 2.6)
    dome.rotation.y = wheel
    // the dome breathes: a slow whole-sky sway, shapes untouched
    dome.rotation.z = Math.sin(elapsed * 0.05) * 0.008

    const el = CONSTELLATIONS[chapter]?.elevation ?? 0.6
    elevation += (el - elevation) * Math.min(1, dt * 2.6)

    // narrow stages compress every patch so the widest shape still fits
    const scale = WIDE_SCALE * Math.min(1, Math.max(0.72, aspect / 1.35))
    for (let i = 0; i < patches.length; i++) {
      const p = patches[i]
      if (!p) continue
      p.group.scale.setScalar(scale)
      const want = i === chapter ? 1 : 0
      p.focus += (want - p.focus) * Math.min(1, dt * 2.2)
      const starOp = (0.3 + 0.7 * p.focus) * reveal
      for (const m of p.starMats) m.opacity = starOp
      p.lineMat.opacity = (0.04 + 0.4 * p.focus) * reveal
    }
  }

  function snap(c: number): void {
    chapter = ((c % patches.length) + patches.length) % patches.length
    wheel = targetWheel()
    dome.rotation.y = wheel
    elevation = CONSTELLATIONS[chapter]?.elevation ?? 0.6
    for (let i = 0; i < patches.length; i++) {
      const p = patches[i]
      if (!p) continue
      p.focus = i === chapter ? 1 : 0
    }
  }

  const world = new Vector3()
  function starWorld(slug: string, out: Vector3): Vector3 | null {
    for (const s of stars) {
      if (s.slug !== slug) continue
      s.sprite.updateWorldMatrix(true, false)
      return out.copy(world.set(0, 0, 0)).setFromMatrixPosition(s.sprite.matrixWorld)
    }
    return null
  }

  return {
    update,
    snap,
    setChapter(c: number) {
      chapter = ((c % patches.length) + patches.length) % patches.length
    },
    currentElevation: () => elevation,
    starWorld,
    stars,
    visible(v: boolean) {
      dome.visible = v
    },
  }
}
