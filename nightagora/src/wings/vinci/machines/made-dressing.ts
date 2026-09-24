/** WEAR AND TONE LAID ON A STANDING MACHINE. The same look `wear.ts` lays
 * before welding, laid here after the machine's parts stand, so a machine can
 * carry its own use without a line in the shared build: damp and grime near
 * the ground, a deck scuffed where a hand stood, rust run down from iron,
 * grease under a bearing, a roll's barrel dulled outside the width the metal
 * ran. Every tint is a vertex-colour multiplier of at most one per channel, cut
 * crisp where a line must read, so a bake or an export keeps it. A material
 * retint multiplies the surface's own colour: a look, never a claim. */
import { Matrix4, type BufferGeometry, type Material, type Mesh, type MeshStandardNodeMaterial, type Object3D } from 'three/webgpu'
import { vec3 } from 'three/tsl'
import { wornSurface, type WearRule } from './wear'
import type { ReadyMachineBuild } from './runtime'

export type { WearRule } from './wear'

export interface MadeWear {
  /** Which drawn surfaces take the rules, by the material's dossier class. */
  classes: RegExp
  rules: readonly WearRule[]
}

export interface MadeRetint {
  classes: RegExp
  multiply: readonly [number, number, number]
}

/** Small helpers the machines' own rules are written with. */
export type Tint = readonly [number, number, number]
export const ONE: Tint = [1, 1, 1]
export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const mix = (a: Tint, b: Tint, t: number): Tint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const steps = (from: number, to: number, step: number): number[] => {
  const out: number[] = []
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}

export interface MadeDressing {
  wear: readonly MadeWear[]
  retint?: readonly MadeRetint[]
}

/** The classes whose own colour already reads the vertex colour. */
const READS_TONE = /planed oak|hewn oak|oak peg|oak grip|cane|starched/

/** `slug:class:set` is how the build names every material it makes. */
const classOf = (material: Material): string => material.name.split(':')[1] ?? ''

function dress(object: Object3D, dressing: MadeDressing, made: Set<BufferGeometry>): void {
  object.updateMatrixWorld(true)
  const root = object.matrixWorld.clone().invert()
  const toMachine = new Matrix4()
  const retinted = new Set<Material>()
  const meshes: Mesh[] = []
  object.traverse(child => { if ((child as Mesh).isMesh) meshes.push(child as Mesh) })
  for (const mesh of meshes) {
    const material = mesh.material as MeshStandardNodeMaterial
    if (Array.isArray(material)) continue
    const cls = classOf(material)
    for (const tint of dressing.retint ?? []) {
      if (!tint.classes.test(cls) || retinted.has(material) || !material.colorNode) continue
      material.colorNode = (material.colorNode as ReturnType<typeof vec3>).mul(vec3(...tint.multiply))
      material.needsUpdate = true
      retinted.add(material)
    }
    // one geometry drawn many times cannot carry one place's wear
    if ((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) continue
    const rules = dressing.wear.filter(w => w.classes.test(cls)).flatMap(w => w.rules)
    // a rope's sweep is rebuilt every frame and keeps no colour
    if (!rules.length || /rope|hemp|thread/.test(cls)) continue
    toMachine.multiplyMatrices(root, mesh.matrixWorld)
    const worn = wornSurface(mesh.geometry, toMachine, rules)
    made.add(worn)
    mesh.geometry = worn
    if (!READS_TONE.test(cls) && !material.vertexColors) {
      material.vertexColors = true
      material.needsUpdate = true
    }
  }
}

/** The machine as built, with its dressing laid the moment its parts stand:
 * `ready` resolves only after, so nothing measures or shoots it bare. */
export function withMadeDressing(build: ReadyMachineBuild, dressing: MadeDressing): ReadyMachineBuild {
  const made = new Set<BufferGeometry>()
  const ready = build.ready.then(() => dress(build.object, dressing, made))
  const dispose = build.dispose
  return {
    ...build,
    ready,
    dispose() {
      dispose.call(build)
      for (const geometry of made) geometry.dispose()
      made.clear()
    },
  }
}
