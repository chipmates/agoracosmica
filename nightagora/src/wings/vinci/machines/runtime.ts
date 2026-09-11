import { Box3, Group, Vector3 } from 'three/webgpu'
import type { Stack } from '../../../stack'
import { buildParts } from './parts'
import { applyMotion, jointValuesAt } from './motion'
import type { MachineRecord, MachineSlug } from './catalog'
import type { Assembly, MachineBuild } from './types'

export interface ReadyMachineBuild extends MachineBuild {
  readonly slug: MachineSlug
  readonly period: number | null
  /** Wait before the first measured frame. Materials and geometry are then ready. */
  readonly ready: Promise<void>
  /** Actual current geometry, distinct from the dossier's conservative envelope. */
  tightBounds(): Box3
  /** Camera-obscura inspection only: remove roof and right wall from view. */
  section(enabled: boolean): void
}

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
  let assembly: Assembly | undefined
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
    dispose() {
      if (disposed) return
      disposed = true
      assembly?.dispose()
      object.clear()
      object.removeFromParent()
    },
  }
}
