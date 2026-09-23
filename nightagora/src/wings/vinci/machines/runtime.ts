import { Box3, Group, Vector3, type BufferGeometry, type Object3D } from 'three/webgpu'
import type { Stack } from '../../../stack'
import { buildParts, materialDressed, materialFailure, type DressedAssembly } from './parts'
import { applyMotion, jointValuesAt } from './motion'
import type { MachineRecord, MachineSlug } from './catalog'
import type { MachineBuild } from './types'

/** Where one machine's parts stand. */
export interface MachineStanding {
  /** every part of the dossier is built and attached */
  readonly mounted: boolean
  /** and every surface carries its library set's own maps */
  readonly dressed: boolean
  /** what can no longer arrive, or null while the machine is whole or still coming */
  readonly error: string | null
}

export interface ReadyMachineBuild extends MachineBuild {
  readonly slug: MachineSlug
  readonly period: number | null
  /** Wait before the first measured frame. Materials and geometry are then ready. */
  readonly ready: Promise<void>
  /** Actual current geometry, distinct from the dossier's conservative envelope. */
  tightBounds(): Box3
  /** Camera-obscura inspection only: remove roof and right wall from view. */
  section(enabled: boolean): void
  /** One named part of the dossier: the node its joints move, and the
   * surface it was built with, which stays whole even where the part is
   * welded or instanced into a shared draw. */
  part?(id: string): { node: Object3D; geometry: BufferGeometry } | null
  /** Mounted and dressed, read at this moment. A build without it is read
   * from its `ready` alone. */
  standing?(): MachineStanding
}

/** Every machine the page holds, and whether each is whole. */
export interface MachinesStanding {
  readonly machines: number
  readonly mounted: number
  readonly dressed: number
  /** machines not yet mounted and dressed, failed ones included */
  readonly outstanding: number
  /** slugs still being built or dressed */
  readonly waiting: readonly string[]
  readonly errors: readonly string[]
  /** every part of every machine is mounted and dressed */
  readonly complete: boolean
}

/** THE ROOM'S MACHINE IS THE VITRINE'S MACHINE. A close look lends the one
 * body the room built, with its clock, and never builds a second one. */
const builds = new WeakMap<Object3D, ReadyMachineBuild>()
/** The live machines of the page, until each is disposed. */
const live = new Map<ReadyMachineBuild, { settled: boolean; error: string | null }>()
const standingListeners = new Set<(build: ReadyMachineBuild) => void>()

/** Told once per machine, the moment its parts stand: anything read off a
 * machine's own geometry before then was read off an empty group. */
export function onMachineStanding(listener: (build: ReadyMachineBuild) => void): () => void {
  standingListeners.add(listener)
  return () => { standingListeners.delete(listener) }
}

export function registerMachineBuild(build: ReadyMachineBuild): ReadyMachineBuild {
  builds.set(build.object, build)
  const record = { settled: false, error: null as string | null }
  live.set(build, record)
  build.ready.then(
    () => {
      record.settled = true
      if (live.has(build)) for (const listener of [...standingListeners]) listener(build)
    },
    (error: unknown) => { record.settled = true; record.error = error instanceof Error ? error.message : String(error) },
  )
  const dispose = build.dispose
  build.dispose = () => { live.delete(build); dispose.call(build) }
  return build
}
export function machineBuildOf(object: Object3D): ReadyMachineBuild | undefined {
  return builds.get(object)
}

/** The page's one reading of its machines: what the export and the rigs wait on. */
export function machinesStanding(): MachinesStanding {
  let mounted = 0, dressed = 0
  const waiting: string[] = [], errors: string[] = []
  for (const [build, record] of live) {
    const state: MachineStanding = build.standing?.()
      ?? { mounted: record.settled && !record.error, dressed: record.settled && !record.error, error: record.error }
    if (state.mounted) mounted++
    if (state.mounted && state.dressed) dressed++
    else if (state.error) errors.push(`machine ${build.slug}: ${state.error}`)
    else waiting.push(build.slug)
  }
  const outstanding = live.size - dressed
  return { machines: live.size, mounted, dressed, outstanding, waiting, errors, complete: outstanding === 0 }
}

// The rigs and the export read the same reading off the page.
if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>)['__naMachines'] = machinesStanding

/** The schema specifies conservative swept envelopes, with their own origins. */
function dossierBounds(record: MachineRecord): Box3 {
  const { x, y, z } = record.dossier.scale_m
  const floor = record.dossier.frame.ground_y_m ?? 0
  const forwardMin: Partial<Record<MachineSlug, number>> = {
    'camera-obscura': -0.02,
    'miter-lock-gates': -0.35,
    'multi-barrel-gun': -2,
    'water-lifting-screw': -1.6,
  }
  const min = new Vector3(-x / 2, floor, forwardMin[record.slug] ?? -z / 2)
  return new Box3(min, min.clone().add(new Vector3(x, y, z)))
}

/** One synchronous hall contract, with asynchronous library readiness made explicit. */
export function makeMachine(stack: Stack, record: MachineRecord): ReadyMachineBuild {
  const object = new Group()
  object.name = `vinci/${record.slug}`
  object.userData['assetClass'] = 'GENERATED'
  object.userData['manifestId'] = `vinci/machine/${record.slug}`
  object.userData['dossier'] = record.sourcePath
  object.userData['certainty'] = 'C'
  let assembly: DressedAssembly | undefined
  let failure: string | null = null
  let disposed = false
  let sectionEnabled = false
  let time = 0
  let values = jointValuesAt(record.slug, time)

  function applySection(): void {
    if (record.slug !== 'camera-obscura' || !assembly) return
    for (const id of ['roof', 'right-wall']) {
      const part = assembly.parts.get(id)
      if (part) part.visible = !sectionEnabled
    }
  }

  const ready = buildParts(stack, record.dossier).then((built) => {
    if (disposed) {
      built.dispose()
      return
    }
    assembly = built
    object.add(built.object)
    values = applyMotion(record.dossier, built, time)
    applySection()
  }, (error: unknown) => {
    // A machine that cannot be built is said aloud, never left as an empty group.
    failure = error instanceof Error ? error.message : String(error)
    console.error(`The machine ${record.slug} was not built: ${failure}`)
    throw error
  })

  return {
    object,
    slug: record.slug,
    period: record.dossier.motion.period_s,
    bounds: dossierBounds(record),
    label: { ...record.label },
    ready,
    animate(t, _dt) {
      if (disposed) return
      time = Math.max(0, Number.isFinite(t) ? t : 0)
      values = assembly
        ? applyMotion(record.dossier, assembly, time)
        : jointValuesAt(record.slug, time)
    },
    joints: () => ({ ...values }),
    tightBounds() {
      object.updateMatrixWorld(true)
      return new Box3().setFromObject(object, true)
    },
    section(enabled) {
      if (disposed || record.slug !== 'camera-obscura') return
      sectionEnabled = enabled
      applySection()
    },
    part(id) {
      const node = assembly?.parts.get(id), mesh = assembly?.meshes.get(id)
      return node && mesh ? { node, geometry: mesh.geometry } : null
    },
    standing() {
      if (!assembly || disposed) return { mounted: false, dressed: false, error: failure }
      const bare = [...assembly.sets].filter(set => !materialDressed(set))
      const reasons = bare.flatMap(set => { const why = materialFailure(set); return why ? [`${set.name} undressed (${why})`] : [] })
      return { mounted: true, dressed: bare.length === 0, error: reasons.length ? reasons.join('; ') : null }
    },
    dispose() {
      if (disposed) return
      disposed = true
      assembly?.dispose()
      object.clear()
      object.removeFromParent()
    },
  }
}
