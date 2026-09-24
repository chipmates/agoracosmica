// The router's shape as the player reads it: `router.mjs` stays plain
// JavaScript so its tests run in node, and the page imports the same file.

export interface RouterGraph {
  nodes: readonly { id: string; wall?: string }[]
  edges: readonly {
    id: string
    from: string
    to: string
    kinds: readonly string[]
    passes?: readonly string[]
    framings: Record<string, { seconds: Record<string, number> }>
  }[]
  opens?: readonly (readonly [string, string])[]
  cuts?: readonly { from: string; to: string; title: { en: string; de: string } }[]
  story?: readonly string[]
  filmPace?: string
}

export type RouterStep =
  | { clip: string; seconds: number }
  | { wait: number; at: string }
  | { open: string; at: string }
  | { dip: string; title?: { en: string; de: string } }

export type RouterPlan =
  | { type: 'here'; from: string; to: string; steps: RouterStep[]; seconds: number }
  | { type: 'open'; from: string; to: string; steps: RouterStep[]; seconds: number }
  | { type: 'walk'; rule: 1 | 2 | 3; from: string; to: string; clips: string[]; steps: RouterStep[]; seconds: number }
  | { type: 'dip'; from: string; to: string; steps: RouterStep[]; seconds: number; cut?: boolean }

export const WAIT_AT_MIDDLE_S: number
export const MAX_WALL_STEPS: number

export function route(graph: RouterGraph, from: string, to: string, options?: { framing?: string; pace?: string; noDoubleBack?: boolean }): RouterPlan

export function guidedVisit(graph: RouterGraph, options?: {
  from?: string
  framing?: string
  pace?: string
  readingSeconds?: (node: string) => number
  titleSeconds?: (title: { en: string; de: string }) => number
}): { from: string; steps: ({ read: number; at: string } | { dip: string; title: { en: string; de: string }; seconds: number } | { clip: string; seconds: number })[]; seconds: number }
