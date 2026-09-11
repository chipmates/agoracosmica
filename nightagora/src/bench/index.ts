/* THE BENCH — one phase, one address, one kind at a time.
 *
 * A bench is not a station of the museum. It stands ONE built thing under
 * the stack's own light, alone, so that a frame of it can be judged without
 * the wing's weather, its rail or its nineteen doors in the way. The wing
 * itself is unchanged by any of this: nothing here is reachable from the
 * wheel, and the museum's own walk never enters the phase.
 *
 * Address:  /bench/vinci/<kind>/<id>
 * Rig:      window.__forge.jump('bench', { kind, ... })
 *
 *   machines  { kind: 'machines', slug }    one of the fourteen machines
 *   table     { kind: 'table', state }      the reading table's seven states
 *   line      { kind: 'line', state }       the timeline's eight states
 *   object    { kind: 'object', slug }      one built body out of the store,
 *                                           with `state` naming its station
 *   pictures  { kind: 'pictures', segment } reserved, not built yet
 *
 * `kind` may be left out when a `slug` is given: a slug names a machine and
 * nothing else. `state` is ambiguous between two kinds, so those two say
 * which they mean.
 *
 * Each kind's recipes live inside its own wing module, never here, because
 * the wing's provenance checker hashes a record's recipe file and refuses
 * one that sits outside `src/wings/vinci`. This file is the host: the
 * phase, the address, and the one shape the rig addresses all of them
 * through. Kinds are imported on demand, so a night that never opens a
 * bench never pays for one.
 */

import type { ManifestEntry } from '../manifest'
import type { Stack } from '../stack'

export const BENCH_KINDS = ['machines', 'table', 'line', 'object', 'pictures'] as const
export type BenchKind = (typeof BENCH_KINDS)[number]

export interface BenchOptions {
  kind?: string
  /** a machine */
  slug?: string
  /** a state of the table, of the line, or a station of an object */
  state?: string
  /** which body the object bench stands, when `slug` is not used for it */
  object?: string
  /** a segment of the picture bench */
  segment?: string
  lang?: 'en' | 'de'
  [key: string]: unknown
}

/** what the rig's stethoscope reads while a bench stands */
export interface BenchReading {
  station: number
  stations: number
  stationId: string
  stationIds: string[]
  /** the museum's own count plus whatever this kind is still waiting for */
  texturesPending: number
}

/** what a kind owes the host. `frame` draws, including the stack's own
    render call, because a kind may have to run its own clock first. */
export interface BenchModule {
  open: (opts: BenchOptions) => Promise<void>
  close: () => void
  frame: (dt: number) => void
  reading: () => BenchReading
  manifest: () => ManifestEntry[]
  ids: () => readonly string[]
  station: (id: string) => boolean
  /** the kind's own numbers, for the eye that knows what to ask */
  telemetry: () => unknown
  freeze?: (t: number) => void
  relight?: () => void
  lights?: () => { rigs: number; sceneObjects: number }
  /** geometry and maps allocated for one tier: a live switch would shoot a
      half dressed frame, so the rig is sent round the route again instead */
  reloadOnTier?: boolean
}

const KIND_ID: Record<BenchKind, 'slug' | 'state' | 'segment'> = {
  machines: 'slug',
  table: 'state',
  line: 'state',
  /* the address of an object names the BODY and not the station: a body is
     what the bench stands, and its four stations are where the eye goes */
  object: 'slug',
  pictures: 'segment',
}

function isKind(value: unknown): value is BenchKind {
  return typeof value === 'string' && (BENCH_KINDS as readonly string[]).includes(value)
}

/** the kind a set of options is asking for, or null when it names none */
export function kindOf(opts: BenchOptions): BenchKind | null {
  if (isKind(opts.kind)) return opts.kind
  if (typeof opts.slug === 'string') return 'machines'
  return null
}

/** the address of one state of one kind */
export function benchAddress(kind: BenchKind, id: string): string {
  return `/bench/vinci/${kind}/${id}`
}

/** the kind and state this page's address asks for, if it is a bench at all */
export function benchPath(): { kind: BenchKind; id: string } | null {
  const at = /^\/bench\/vinci\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/.exec(location.pathname)
  if (!at || !isKind(at[1]) || !at[2]) return null
  return { kind: at[1], id: at[2] }
}

/** the options an address stands for */
export function benchOptions(route: { kind: BenchKind; id: string }): BenchOptions {
  return { kind: route.kind, [KIND_ID[route.kind]]: route.id }
}

export function createBench(stack: Stack, onLobby: () => void) {
  const built = new Map<BenchKind, BenchModule>()
  let live: BenchModule | null = null
  let kind: BenchKind | null = null
  let id = ''
  /* every open takes a ticket: a slow kind that arrives after the visitor
     has asked for another one may not stamp the frame it did not draw */
  let serial = 0

  async function build(want: BenchKind): Promise<BenchModule | null> {
    const standing = built.get(want)
    if (standing) return standing
    let made: BenchModule
    if (want === 'machines') {
      const { createBench: create } = await import('../wings/vinci/machines/bench')
      const it = create(stack, onLobby)
      made = {
        open: (opts) => it.open(opts),
        close: it.close,
        frame: it.frame,
        reading: () => ({
          station: Math.max(0, it.ids().indexOf(it.slug())),
          stations: it.ids().length,
          stationId: it.slug(),
          stationIds: [...it.ids()],
          texturesPending: it.ready() ? 0 : 1,
        }),
        manifest: it.manifest,
        ids: it.ids,
        station: it.station,
        telemetry: it.machine,
        freeze: it.freeze,
        relight: it.relight,
        reloadOnTier: true,
      }
    } else if (want === 'object') {
      const { createObjectBench } = await import('../wings/vinci/objects/bench')
      made = createObjectBench(stack)
    } else if (want === 'table') {
      const { createTableBench } = await import('../wings/vinci/table/bench')
      made = createTableBench(stack)
    } else if (want === 'line') {
      const { createBench: create, BENCH_STATES } = await import('../wings/vinci/line/bench')
      const it = create(stack)
      made = {
        open: (opts) => it.show(opts),
        close: it.stop,
        frame: (dt) => {
          it.update()
          stack.render(dt)
        },
        reading: () => {
          const said = it.state()
          return {
            station: said.station,
            stations: said.stations,
            stationId: said.stationId,
            stationIds: said.stationIds,
            texturesPending: said.texturesPending,
          }
        },
        manifest: it.manifest,
        ids: () => BENCH_STATES,
        station: (target: string) => {
          // the eight states first, then the fifty-six studs the line walks:
          // one call answers both, as it does for the other kinds
          if ((BENCH_STATES as readonly string[]).includes(target)) {
            void it.show({ state: target })
            return true
          }
          return it.select(target)
        },
        telemetry: () => (it.active() ? it.telemetry() : null),
      }
    } else {
      // reserved: the address parses and the phase is real, so the day the
      // picture bench lands nothing outside this switch has to change
      console.warn(`the ${want} bench has not landed yet`)
      return null
    }
    built.set(want, made)
    return made
  }

  async function open(opts: BenchOptions = {}): Promise<void> {
    const want = kindOf(opts) ?? kind
    if (!want) {
      console.warn('a bench state names no kind')
      return
    }
    const mine = ++serial
    /* the rig proves a state took by reading this back, so it may never
       still say `bench` from the state before while the next one composes */
    document.body.dataset['forge'] = 'pending'
    if (live && kind !== want) {
      live.close()
      live = null
    }
    const next = await build(want)
    if (!next || mine !== serial) return
    live = next
    kind = want
    id = String(opts[KIND_ID[want]] ?? id)
    await next.open(opts)
  }

  function close(): void {
    if (!live) return
    serial++
    live.close()
    live = null
    kind = null
  }

  return {
    open,
    close,
    active: () => live !== null,
    kind: () => kind,
    id: () => id,
    /** the address the bench is standing at, for a tier change that has to
        travel through a fresh route rather than a live switch */
    address: () => (kind ? benchAddress(kind, id) : null),
    reloadOnTier: () => live?.reloadOnTier === true,
    frame: (dt: number) => live?.frame(dt),
    freeze: (t: number) => live?.freeze?.(t),
    relight: () => live?.relight?.(),
    lights: () => live?.lights?.() ?? null,
    manifest: (): ManifestEntry[] => live?.manifest() ?? [],
    station: (target: string) => live?.station(target) ?? false,
    /** the rail's 0..1 lands on one of the kind's own ids */
    rail: (t: number) => {
      if (!live) return
      const all = live.ids()
      const at = all[Math.round(Math.min(1, Math.max(0, t)) * (all.length - 1))]
      if (at) live.station(at)
    },
    telemetry: () => live?.telemetry() ?? null,
    reading: (): BenchReading | null => (live ? live.reading() : null),
  }
}

export type Bench = ReturnType<typeof createBench>
