/** THE NIGHT ON THE DEVICE, and nothing more than that.
 *
 * A museum without accounts can still offer a visitor what they opened, and
 * the only place that can live is the device in front of them. So this keeps
 * one record per wing under one key: EXHIBIT IDS AND STATION IDS. No titles,
 * no sentences, no timestamps, no route. Every title and every line the recap
 * shows is resolved again at render from the wing's own registers, which is
 * why nothing a sentence could be read out of is ever written down.
 *
 * Three rules live here.
 *
 * · A REFUSED STORE FORGETS QUIETLY. A browser that will not keep anything
 *   still walks the whole wing and still gets its recap for the visit it is
 *   in; it simply has nothing to offer the next one. Never a warning, never
 *   a second ask.
 * · ONE KEY CARRIES THE WING'S OWN SLUG, so a second wing never inherits the
 *   first one's night.
 * · THE ONE DOOR WRITES IT. The vitrine calls `noteOpened` where every close
 *   look of every kind passes, and a wing opens and closes the visit around
 *   its own lifetime. Nothing a visitor did not open can enter the list.
 */

export interface VisitRecord {
  v: 1
  wing: string
  /** the calendar day the list belongs to, so a new night starts a new list */
  night: string
  opened: readonly string[]
  stood: readonly string[]
}

export interface Visit {
  readonly wing: string
  /** the ids in the order they were opened, which is the only order kept */
  readonly opened: readonly string[]
  readonly stood: readonly string[]
  /** True while the device is keeping this record. */
  readonly kept: boolean
  open(id: string): void
  stand(id: string): void
  /** Drop the night, on the device and in memory. */
  forget(): void
  /** Hand the door back: the vitrine's calls stop reaching this record. */
  close(): void
}

const KEY = (wing: string): string => `na-visit-${wing}`

/** The local calendar day. A night is a day and never a time of one. */
function night(): string {
  const now = new Date()
  const two = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`
}

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function store(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    /* a store that refuses is not a reason to stop the walk */
    return false
  }
}

function drop(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing was kept, so nothing has to be dropped */
  }
}

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

/** What the device holds for this wing, or null. Anything that is not this
 * museum's own record reads as nothing, so a foreign or a broken value can
 * never reach a render. */
export function readVisit(wing: string): VisitRecord | null {
  const raw = stored(KEY(wing))
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<VisitRecord>
    if (value?.v !== 1 || value.wing !== wing || typeof value.night !== 'string') return null
    return { v: 1, wing, night: value.night, opened: ids(value.opened), stood: ids(value.stood) }
  } catch {
    return null
  }
}

export function forgetVisit(wing: string): void {
  drop(KEY(wing))
}

/** The visit the vitrine's one call reaches. A wing owns its lifetime. */
let current: Visit | null = null

export function beginVisit(wing: string): Visit {
  const held = readVisit(wing)
  let record: VisitRecord = held ?? { v: 1, wing, night: night(), opened: [], stood: [] }
  let kept = held !== null

  /** A new night is a new list. It rolls over at the first thing opened, so
   * the last night's record is still there for a lobby that offers it. */
  function tonight(): void {
    const today = night()
    if (record.night === today) return
    record = { v: 1, wing, night: today, opened: [], stood: [] }
  }
  function write(): void {
    kept = store(KEY(wing), JSON.stringify(record))
  }
  function add(field: 'opened' | 'stood', id: string): void {
    if (!id || record[field].includes(id)) return
    tonight()
    if (record[field].includes(id)) return
    record = { ...record, [field]: [...record[field], id] }
    write()
  }

  const visit: Visit = {
    wing,
    get opened() { return record.opened },
    get stood() { return record.stood },
    get kept() { return kept },
    open: id => add('opened', id),
    stand: id => add('stood', id),
    forget() {
      record = { v: 1, wing, night: night(), opened: [], stood: [] }
      kept = false
      forgetVisit(wing)
    },
    close() {
      if (current === visit) current = null
    },
  }
  current = visit
  return visit
}

/** THE ONE DOOR. The vitrine calls this where every close look opens, so one
 * line records a picture, a sheet, a mural, a machine, a manuscript, a date
 * and a place, and a wing with no visit open records nothing. */
export function noteOpened(id: string): void {
  current?.open(id)
}

/** The stations a visitor has stood at, for the plan's own reading. */
export function noteStood(id: string): void {
  current?.stand(id)
}
