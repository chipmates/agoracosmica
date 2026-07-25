/* Beat 9 · PLANETFALL — THE CAMP OF MARCUS AURELIUS.

   The world-form is criticism. The fort is his discipline: a rectilinear
   grid pressed onto a dark, curved, indifferent planet. The one warm tent
   at the end of the via is his inner citadel. The river is time passing in
   the dark, and it is the only thing here that moves on its own.

   THE WALK: the visitor arrives across the Danube, enters at the porta
   praetoria, walks the via principalis to his tent, stands at his desk,
   and ends at an overlook where the Stoic Taurus burns over the camp. The
   app's own beats are the stations: the hearth is the praetorium, the
   traces are cut where they belong, and His Sky is the vista.

   THE HOUR (Michel, 2026-07-25): the camp is a DAWN you can read. Night
   lives overhead and answers the GAZE — look up and it deepens, look back
   down and his morning is still there. The duskrise takes it all the way,
   because that is the one moment where night falling IS the point. */

import { Group, PerspectiveCamera, Scene, Vector3 } from 'three/webgpu'
import { createFirmament } from '../../core/firmament'
import { createSign } from '../../core/sign'
import { STOIC_TAURUS } from '../../content/signs'
import { STATIONS } from '../../content/carnuntum'
import { mulberry32, FOUNDING_SEED } from '../../core/seed'
import {
  beat,
  groundDrop,
  MAP,
  place,
  uDeep,
  uFloor,
  uGust,
  uInterior,
  uNight,
  uReveal,
  uT,
  uYield,
} from './hour'
import { createWorld } from './ground'
import { createFort } from './fort'
import { createPraetorium } from './praetorium'
import { createFires } from './fire'
import { createBreath, createGrass, createSmoke, createSparks } from './drift'

export { groundDrop, place } from './hour'

declare global {
  interface Window {
    __camp?: { hour(): Record<string, number> }
  }
}

export interface CampState {
  /** 0..1 the world's presence (the entry breath) */
  reveal: number
  elapsed: number
  dt: number
  aspect: number
  /** 0..1 along the walk: far shore → ford → gate → via → tent → desk → vista */
  walk: number
  /** 0..1 a letterpress holds the frame, so the world's marks step back */
  yield: number
  /** 0..1 the duskrise: night falls over his morning and the sign rises */
  dusk: number
  /** 0..1 how far the visitor has raised their own gaze (Michel's law) */
  gaze: number
  reduced: boolean
}

export interface Camp {
  update(s: CampState): void
  /** put the eye on the rail; main.ts adds the hand's own look on top */
  stageCamera(camera: PerspectiveCamera, walk: number, narrow: boolean): void
  /** the three carved words, in world space */
  tracePos: Vector3[]
  /** a point of the walk, in world space (the app's own marks) */
  spot(id: SpotId): Vector3
  setSign(levels: number[], snap?: boolean): void
  /** which station holds the frame at this walk position */
  stationAt(walk: number): number
  /** the station a mark belongs to, for the marks that jump the walk */
  stationT(index: number): number
}

export type SpotId = 'hearth' | 'chapters' | 'prism' | 'quest' | 'hissky' | 'trace'

/* the camera rail, in map space. y is height above the LOCAL ground, so
   the walk stays on the skin of a curved planet instead of floating over
   it. Hand-set at the four refine rounds the camp was built through. */
interface Key {
  t: number
  p: [number, number, number]
  q: [number, number, number]
}
const KEYS: Key[] = [
  { t: 0.0, p: [0.9, 1.75, 30.5], q: [0.0, 2.7, 9.0] },
  { t: 0.14, p: [0.45, 1.7, 24.0], q: [0.4, 2.3, 4.5] },
  { t: 0.28, p: [-0.1, 1.62, 14.6], q: [0.8, 2.0, -1.0] },
  { t: 0.42, p: [0.0, 1.68, 6.0], q: [0.0, 2.4, -4.5] },
  { t: 0.57, p: [0.0, 1.62, -3.6], q: [0.35, 1.9, -13.5] },
  { t: 0.7, p: [0.4, 1.62, -12.4], q: [0.05, 1.95, -19.6] },
  // the desk: low enough to be AT it, and framed so the codex and the
  // lamp share the plate instead of the tabletop filling it (round 2)
  { t: 0.79, p: [0.02, 1.06, -20.6], q: [0.74, 0.66, -22.42] },
  { t: 0.82, p: [-0.02, 1.02, -20.9], q: [0.72, 0.64, -22.44] },
  { t: 0.9, p: [-3.6, 9.4, -31.0], q: [0.3, 4.6, 4.0] },
  { t: 1.0, p: [-4.4, 10.6, -34.0], q: [0.6, 4.9, 6.5] },
]

const smoothstep = (a: number, b: number, x: number): number => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/** the app's own points, in map space: where a mark hangs on the walk */
const SPOTS: Record<SpotId, [number, number, number]> = {
  // beside the doorway wedge, never inside the tent's light
  hearth: [-2.5, 1.5, -19.4],
  // at the crossed-log fire, where the legion's own nights are told
  chapters: [-3.4, 1.3, -11.2],
  // the standard on the via: his thought split into its colors
  prism: [4.35, 2.5, -7.0],
  // the gate: a journey across his ground begins at a threshold
  quest: [2.9, 2.6, 4.4],
  // the sky above the fort, from the vista
  hissky: [1.2, 12.0, -4.0],
  trace: [3.32, 1.02, -5.22],
}

export function createCamp(scene: Scene): Camp {
  const rand = mulberry32(FOUNDING_SEED + 91)
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mobile = typeof window !== 'undefined' && window.innerWidth < 720
  const tier = {
    stars: mobile ? 1500 : 2800,
    sparks: mobile ? 12 : 26,
    smoke: mobile ? 8 : 16,
    grass: mobile ? 130 : 300,
  }

  const root = new Group()
  root.visible = false
  scene.add(root)

  const world = createWorld()
  root.add(world.group)

  const fort = createFort(rand)
  root.add(fort.group)
  root.add(createPraetorium(rand))

  const fires = createFires(rand)
  root.add(fires.group)

  // ---- the drifting things
  const sparks = createSparks({
    origins: [place(2.85, 0.26, 12.6), place(-3.4, 0.2, -11.2)],
    perFire: tier.sparks,
    rand,
    reduced,
  })
  root.add(sparks.mesh)
  const T = MAP.praetorium
  const smoke = createSmoke({
    origins: [
      { p: place(2.85, 0.8, 12.6), scale: 1.0, rate: 1.0 },
      { p: place(-3.4, 0.7, -11.2), scale: 1.15, rate: 0.9 },
      { p: place(-2.35, 2.4, 4.5), scale: 0.6, rate: 1.3 },
      { p: place(2.35, 2.4, 4.5), scale: 0.6, rate: 1.3 },
      { p: place(-0.55, T.h + 0.55, T.z - 0.9), scale: 0.85, rate: 0.62 },
    ],
    perFire: tier.smoke,
    rand,
    reduced,
  })
  root.add(smoke.mesh)
  root.add(createGrass({ count: tier.grass, rand }).mesh)
  root.add(
    createBreath({
      anchors: fort.sentryAnchors.map((p, i) => ({ p, dir: i % 2 ? 1 : -1 })),
      rand,
    }).mesh
  )

  // ---- the standard stars, and HIS SIGN over the camp
  const firmament = createFirmament({
    count: tier.stars,
    far: [58, 150],
    // the near shell is the sky's bokeh: pushed out, so his stars read as
    // STARS over the camp instead of as smudges on the lens (round 1)
    near: [42, 74],
    bias: 'zenith',
    rand,
    heroes: 11,
    meteors: true,
  })
  root.add(firmament.points)

  const sign = createSign({
    pattern: STOIC_TAURUS,
    width: 26,
    height: 15,
    rand: mulberry32(FOUNDING_SEED + 7),
  })
  root.add(sign.group)
  // the vista's frame, and the narrow restage: a smaller sign brought
  // nearer and lower, so a phone gets the whole animal, never a crop
  const SIGN_WIDE = place(0, 16.0, 6.0)
  const SIGN_NARROW = place(0, 13.2, 1.0)
  let signLevels: number[] = new Array(STOIC_TAURUS.length).fill(0)

  // ---- the rail
  const camPos = new Vector3()
  const camTgt = new Vector3()
  function railAt(t: number): void {
    let i = 0
    while (i < KEYS.length - 2) {
      const next = KEYS[i + 1]
      if (!next || t <= next.t) break
      i++
    }
    const a = KEYS[i] ?? KEYS[0]
    const b = KEYS[i + 1] ?? a
    if (!a || !b) return
    const k = smoothstep(a.t, b.t, t)
    for (let j = 0; j < 3; j++) {
      const pa = a.p[j] ?? 0
      const pb = b.p[j] ?? 0
      const qa = a.q[j] ?? 0
      const qb = b.q[j] ?? 0
      camPos.setComponent(j, pa + (pb - pa) * k)
      camTgt.setComponent(j, qa + (qb - qa) * k)
    }
    camPos.y -= groundDrop(camPos.x, camPos.z)
    camTgt.y -= groundDrop(camTgt.x, camTgt.z)
  }

  function stationAt(t: number): number {
    let best = 0
    let bd = 9
    STATIONS.forEach((s, i) => {
      const d = Math.abs(s.t - t)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    return best
  }

  const spotCache = new Map<SpotId, Vector3>()

  // the camp's own stethoscope: the rig reads the hour and the population
  // instead of guessing them from pixels (numbers first, then the shot)
  window.__camp = {
    hour: () => ({
      reveal: uReveal.value,
      night: uNight.value,
      deep: uDeep.value,
      interior: uInterior.value,
      visible: root.visible ? 1 : 0,
      children: root.children.length,
      camX: camPos.x,
      camY: camPos.y,
      camZ: camPos.z,
    }),
  }

  return {
    tracePos: fires.tracePos,

    spot(id) {
      const cached = spotCache.get(id)
      if (cached) return cached
      const raw = SPOTS[id]
      const v = place(raw[0], raw[1], raw[2])
      spotCache.set(id, v)
      return v
    },

    stationAt,
    stationT(index) {
      return STATIONS[index]?.t ?? 0
    },

    setSign(levels, snap = false) {
      signLevels = levels
      if (snap) sign.snap(levels)
    },

    stageCamera(camera, walk, narrow) {
      // the vista is a wide shot and the desk is a close one: the lens
      // opens as the overlook opens, and shuts inside the tent, because
      // sixty degrees at a hand's reach puts the codex in your lap
      const base = narrow ? 50 : 46
      const wide = narrow ? 66 : 58
      const shut = narrow ? 42 : 40
      const inside = smoothstep(0.72, 0.79, walk) * (1 - smoothstep(0.83, 0.9, walk))
      const fov = base + (wide - base) * smoothstep(0.82, 0.97, walk) + (shut - base) * inside
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
      sparks.setLens(fov, typeof window === 'undefined' ? 900 : window.innerHeight)
      sign.group.scale.setScalar(narrow ? 0.62 : 1)
      sign.group.position.copy(narrow ? SIGN_NARROW : SIGN_WIDE)

      railAt(walk)
      if (narrow) {
        // a phone frame is tall, and a level rail hands it half a screen of
        // bare earth. The eye lifts a little and the target lifts more, so
        // the fort — not the ground in front of it — owns the frame.
        camPos.y += 0.16
        camTgt.y += 0.92 + 1.6 * smoothstep(0.86, 1, walk)
      }
      camera.position.copy(camPos)
      camera.lookAt(camTgt)
      // the dome and the stars ride with the eye: a sky is never a place
      // you can reach
      world.follow(camera.position.x, camera.position.y, camera.position.z)
      firmament.points.position.copy(camera.position)
    },

    update(s) {
      root.visible = s.reveal > 0.01
      if (!root.visible) return
      const t = s.elapsed

      uT.value = t
      uReveal.value = s.reveal
      uYield.value = s.yield
      uFloor.value = 1
      // THE HOUR: the sky answers the gaze all the way, the camp only part
      // of the way — and the duskrise takes both
      uNight.value = Math.max(s.gaze, s.dusk)
      uDeep.value = Math.max(s.gaze * 0.45, s.dusk)
      // the interior takes over as the visitor steps into the tent
      uInterior.value =
        smoothstep(0.72, 0.79, s.walk) * (1 - smoothstep(0.83, 0.9, s.walk))
      beat(t, s.reduced)

      fort.update(t, uGust.value)
      fires.update(t, camPos, s.reveal)

      // the firmament keeps dawn's reserve, and comes up as the night does:
      // at the duskrise HIS SIGN is the hero of that sky, so the field stays
      // a choir behind it
      firmament.update(t, (0.1 + 0.72 * uNight.value) * s.reveal)
      const signMaster = Math.max(s.dusk, smoothstep(0.86, 0.98, s.walk)) * s.reveal
      sign.update(s.dt, t, signLevels, signMaster)
    },
  }
}
