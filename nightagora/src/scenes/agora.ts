import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
} from 'three/webgpu'
import { mulberry32, FOUNDING_SEED } from '../core/seed'

const FLOOR = new Color('#070b18')
const COLUMN = new Color('#0d1330')
const EMBER_GOLD = new Color('#f0c87e')

function radialTexture(stops: Array<[number, string]>): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [at, color] of stops) g.addColorStop(at, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

export interface AgoraState {
  /** 0..1 fade-in of the ground world after the dark door */
  reveal: number
  elapsed: number
}

/**
 * The ground hub, lean first pass: marble disc, colonnade silhouettes,
 * the fire with rising embers. The camera stays at origin; the world
 * sits low (floor at y=-1.7) so the sky scenes keep their framing.
 */
export function createAgora(scene: Scene) {
  const rand = mulberry32(FOUNDING_SEED + 7)
  const root = new Group()
  root.visible = false
  scene.add(root)

  // the eye sits low, as if seated at the fire: floor just under the chest
  const FLOOR_Y = -0.9
  const FIRE = { x: 0, z: -4.8 }

  // marble disc
  const floorMat = new MeshBasicMaterial({ color: FLOOR, transparent: true, opacity: 0 })
  const floor = new Mesh(new CircleGeometry(14, 72), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = FLOOR_Y
  root.add(floor)

  // pool of firelight on the marble
  const poolMat = new MeshBasicMaterial({
    map: radialTexture([
      [0, 'rgba(224, 185, 106, 0.34)'],
      [0.5, 'rgba(169, 124, 47, 0.12)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]),
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  })
  const pool = new Mesh(new CircleGeometry(5.4, 48), poolMat)
  pool.rotation.x = -Math.PI / 2
  pool.position.set(FIRE.x, FLOOR_Y + 0.02, FIRE.z)
  root.add(pool)

  // colonnade silhouettes, an open arc (nothing behind the visitor's back)
  const colMat = new MeshBasicMaterial({ color: COLUMN, transparent: true, opacity: 0 })
  const colGeo = new CylinderGeometry(0.24, 0.3, 4.6, 10)
  for (let i = 0; i < 9; i++) {
    if (i === 4) continue // the arc frames the fire, never skewers it
    const a = (-Math.PI * 0.78) + (i / 8) * Math.PI * 1.56
    const col = new Mesh(colGeo, colMat)
    col.position.set(Math.sin(a) * 11.5, FLOOR_Y + 2.3, -Math.cos(a) * 11.5)
    root.add(col)
  }

  // the fire: three breathing layers of light
  function flame(stops: Array<[number, string]>, sx: number, sy: number, y: number) {
    const mat = new SpriteMaterial({
      map: radialTexture(stops),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    })
    const s = new Sprite(mat)
    s.position.set(FIRE.x, y, FIRE.z)
    s.scale.set(sx, sy, 1)
    root.add(s)
    return { s, mat, sx, sy }
  }
  // a fire is a tongue, not a lamp: tall tight core, modest body, small halo,
  // and darkness allowed to hold the edges
  const core = flame(
    [
      [0, 'rgba(255, 250, 235, 0.95)'],
      [0.16, 'rgba(246, 223, 174, 0.6)'],
      [0.4, 'rgba(224, 185, 106, 0.14)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ],
    1.0,
    2.3,
    FLOOR_Y + 1.0
  )
  const body = flame(
    [
      [0, 'rgba(240, 200, 126, 0.5)'],
      [0.35, 'rgba(224, 185, 106, 0.16)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ],
    1.7,
    2.3,
    FLOOR_Y + 0.9
  )
  const halo = flame(
    [
      [0, 'rgba(224, 185, 106, 0.2)'],
      [0.5, 'rgba(169, 124, 47, 0.06)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ],
    4.6,
    3.4,
    FLOOR_Y + 1.3
  )
  // the polished marble answers the fire: a low sheen across the stone,
  // and the flame's streak mirrored toward the visitor
  const sheen = flame(
    [
      [0, 'rgba(240, 200, 126, 0.26)'],
      [0.5, 'rgba(169, 124, 47, 0.08)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ],
    7.2,
    1.15,
    FLOOR_Y + 0.14
  )
  const streak = flame(
    [
      [0, 'rgba(240, 200, 126, 0.16)'],
      [0.4, 'rgba(224, 185, 106, 0.05)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ],
    0.8,
    2.1,
    FLOOR_Y - 0.15
  )
  streak.s.position.z = FIRE.z + 1.6

  // embers: sparks that rise toward the firmament
  const EMBERS = 64
  const emberGeo = new BufferGeometry()
  const emberPos = new Float32Array(EMBERS * 3)
  const emberSeed: Array<{ speed: number; sway: number; phase: number }> = []
  for (let i = 0; i < EMBERS; i++) {
    emberPos[i * 3] = FIRE.x + (rand() - 0.5) * 0.7
    emberPos[i * 3 + 1] = FLOOR_Y + 0.4 + rand() * 5.5
    emberPos[i * 3 + 2] = FIRE.z + (rand() - 0.5) * 0.7
    emberSeed.push({ speed: 0.55 + rand() * 0.8, sway: 0.15 + rand() * 0.3, phase: rand() * Math.PI * 2 })
  }
  emberGeo.setAttribute('position', new Float32BufferAttribute(emberPos, 3))
  const emberMat = new PointsMaterial({
    color: EMBER_GOLD,
    size: 0.12,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const embers = new Points(emberGeo, emberMat)
  root.add(embers)

  function update(s: AgoraState): void {
    root.visible = s.reveal > 0.01
    if (!root.visible) return

    const r = s.reveal
    floorMat.opacity = r
    poolMat.opacity = r
    colMat.opacity = r

    const t = s.elapsed
    const breathe = (f: number, p: number) => 1 + Math.sin(t * f + p) * 0.06 + Math.sin(t * f * 2.7 + p * 2) * 0.03
    core.mat.opacity = 0.95 * r * (0.85 + Math.sin(t * 9.1) * 0.08 + Math.sin(t * 13.7) * 0.05)
    body.mat.opacity = 0.62 * r
    halo.mat.opacity = 0.5 * r
    core.s.scale.set(core.sx * breathe(7.3, 0), core.sy * breathe(9.7, 0.7), 1)
    body.s.scale.set(body.sx * breathe(4.1, 1.3), body.sy * breathe(5.3, 2.1), 1)
    halo.s.scale.set(halo.sx * breathe(2.3, 2.6), halo.sy * breathe(2.9, 0.4), 1)
    sheen.mat.opacity = 0.75 * r * (0.9 + Math.sin(t * 5.9) * 0.1)
    streak.mat.opacity = 0.7 * r * (0.85 + Math.sin(t * 7.7 + 1) * 0.15)

    emberMat.opacity = 0.8 * r
    const pos = emberGeo.getAttribute('position')
    for (let i = 0; i < EMBERS; i++) {
      const seed = emberSeed[i]
      if (!seed) continue
      let y = pos.getY(i) + seed.speed * 0.016
      if (y > FLOOR_Y + 6.2) y = FLOOR_Y + 0.4
      pos.setY(i, y)
      const k = (y - FLOOR_Y) / 6.2
      pos.setX(i, FIRE.x + Math.sin(t * seed.sway * 4 + seed.phase) * (0.2 + k * 0.9))
      pos.setZ(i, FIRE.z + Math.cos(t * seed.sway * 3.1 + seed.phase) * (0.2 + k * 0.7))
    }
    pos.needsUpdate = true
  }

  return { update }
}
