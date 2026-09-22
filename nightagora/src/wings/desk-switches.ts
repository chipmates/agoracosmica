/* THE DESKTOP'S NEW CHROME, ONE STEP AT A TIME. Each step of the frozen
   desktop design lands alone behind its own switch, so main keeps today's
   picture at every station until the owner has walked the new one and said
   yes. A switch is read from the address once per visit and written onto
   `#wing` as one data attribute, so the stylesheet and the code branch on the
   same word and nothing can drift between them.

   `?desk=words`, `?desk=words,ways`, `?desk=all`, `?desk=none`. The constants
   below are the default: flipping one to true makes that step the picture
   main ships, and `?desk=none` is then the way back to today. */

export type DeskStep = 'type14' | 'words' | 'ways' | 'freearea' | 'stage' | 'drawer'

/** the steps this chrome knows, in the design's own build order */
export const DESK_STEPS: readonly DeskStep[] = ['type14', 'words', 'ways', 'freearea', 'stage', 'drawer']

/* ONE CONSTANT PER STEP. Off today: the address is the only way to see them. */
export const DESK_TYPE14 = false
export const DESK_WORDS = false
export const DESK_WAYS = false
export const DESK_FREEAREA = false
export const DESK_STAGE = false
export const DESK_DRAWER = false

const DEFAULT: Readonly<Record<DeskStep, boolean>> = {
  type14: DESK_TYPE14,
  words: DESK_WORDS,
  ways: DESK_WAYS,
  freearea: DESK_FREEAREA,
  stage: DESK_STAGE,
  drawer: DESK_DRAWER,
}

function fromAddress(): Record<DeskStep, boolean> {
  const state = { ...DEFAULT }
  let asked: string | null = null
  try {
    asked = new URLSearchParams(location.search).get('desk')
  } catch {
    // a document with no address keeps the defaults
  }
  if (asked === null) return state
  const words = asked.split(/[ ,]+/).filter(Boolean)
  if (words.includes('none')) for (const step of DESK_STEPS) state[step] = false
  if (words.includes('all')) for (const step of DESK_STEPS) state[step] = true
  for (const step of DESK_STEPS) if (words.includes(step)) state[step] = true
  return state
}

/* READ ONCE. A switch that could change inside a visit would leave half the
   chrome built under one answer and half under another. */
let state: Record<DeskStep, boolean> | null = null
const steps = (): Record<DeskStep, boolean> => (state ??= fromAddress())

export function deskOn(step: DeskStep): boolean {
  return steps()[step]
}

/** True while any step of the new chrome stands, which is what the parts
    outside this chrome ask before they change anything for it. */
export function deskAny(): boolean {
  return DESK_STEPS.some(step => steps()[step])
}

/** the attribute's value: every step that is on, space separated for `~=` */
export function deskWord(): string {
  return DESK_STEPS.filter(step => steps()[step]).join(' ')
}

/** Write the switches where the stylesheet reads them. */
export function applyDeskSteps(wing: HTMLElement): void {
  const word = deskWord()
  if (word) wing.dataset['desk'] = word
  else delete wing.dataset['desk']
}
