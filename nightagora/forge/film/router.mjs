// THE ROUTER: from the node a visitor stands at to the node asked for, the
// clips the film plays, or a dip where it has none. A pure function of the
// graph (`graph.mjs`): no clock, no page, no file, so the player and its tests
// run the same code.
//
// In order, the first that exists:
//   1. one clip;
//   2. two clips through one rest node, neither walking through the target
//      nor back over the node it began at;
//   3. on a wall, a chain of at most three STEPs;
//   4. a dip, the wing's own chapter cut, the only cut in the museum.
// Between two clips the visitor stands a moment at the middle node, as a walker stops.

/** How long the visitor stands at a middle node between two clips, in seconds. */
export const WAIT_AT_MIDDLE_S = 0.3
/** The longest chain of steps along a wall a press may ask for. */
export const MAX_WALL_STEPS = 3

const indexes = new WeakMap()
/** The graph read once into lookups; the graph itself is never written. */
function indexOf(graph) {
  let held = indexes.get(graph)
  if (held) return held
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const byPair = new Map()
  const out = new Map()
  for (const e of graph.edges) {
    byPair.set(`${e.from}>${e.to}`, e)
    if (!out.has(e.from)) out.set(e.from, [])
    out.get(e.from).push(e)
  }
  for (const list of out.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1))
  const opens = new Set((graph.opens ?? []).flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]))
  const partners = new Map()
  for (const [a, b] of graph.opens ?? []) {
    partners.set(a, [...(partners.get(a) ?? []), b])
    partners.set(b, [...(partners.get(b) ?? []), a])
  }
  const cuts = new Map((graph.cuts ?? []).flatMap((c) => [[`${c.from}|${c.to}`, c], [`${c.to}|${c.from}`, c]]))
  held = { nodes, byPair, out, opens, partners, cuts }
  indexes.set(graph, held)
  return held
}

const secondsOf = (edge, framing, pace) => edge.framings[framing].seconds[pace]
const passes = (edge, node) => (edge.passes ?? []).includes(node)

/** A plan of clips and the moments stood between them. A walk that lands on
    the target's partner at one eye ends by opening the target there. */
function walkPlan(from, to, clips, framing, pace, rule) {
  const steps = []
  let seconds = 0
  clips.forEach((edge, i) => {
    if (i > 0) { steps.push({ wait: WAIT_AT_MIDDLE_S, at: edge.from }); seconds += WAIT_AT_MIDDLE_S }
    const s = secondsOf(edge, framing, pace)
    steps.push({ clip: edge.id, seconds: s })
    seconds += s
  })
  const landed = clips.at(-1).to
  if (landed !== to) steps.push({ open: to, at: landed })
  return { type: 'walk', rule, from, to, clips: clips.map((e) => e.id), steps, seconds }
}
/** The better of two candidates: fewer seconds, and the target itself over its partner on a tie. */
const better = (a, b) => !b || a.seconds < b.seconds - 1e-9 || (Math.abs(a.seconds - b.seconds) <= 1e-9 && a.exact && !b.exact)

/**
 * The way from one node to another.
 *   framing   'wide' or 'upright', whose seconds the plan counts
 *   pace      the pace the seconds are read at (the film renders 'walk')
 *   noDoubleBack   a two-clip route may not walk back over its own start
 */
export function route(graph, from, to, { framing = 'wide', pace = graph.filmPace ?? 'walk', noDoubleBack = true } = {}) {
  const { nodes, byPair, out, opens, partners, cuts } = indexOf(graph)
  if (!nodes.has(from)) throw new Error(`no node ${from}`)
  if (!nodes.has(to)) throw new Error(`no node ${to}`)
  if (from === to) return { type: 'here', from, to, steps: [], seconds: 0 }
  // one eye, two compositions: the work opens where the visitor stands
  if (opens.has(`${from}|${to}`)) return { type: 'open', from, to, steps: [{ open: to, at: from }], seconds: 0 }
  // the target, or the node at its eye where it opens without a walk
  const targets = [to, ...(partners.get(to) ?? [])]
  const pick = (build) => {
    let best
    for (const target of targets) {
      const found = build(target)
      if (found && better({ ...found, exact: target === to }, best)) best = { ...found, exact: target === to }
    }
    return best
  }
  const one = pick((target) => {
    const edge = byPair.get(`${from}>${target}`)
    return edge && { seconds: secondsOf(edge, framing, pace), clips: [edge] }
  })
  if (one) return walkPlan(from, to, one.clips, framing, pace, 1)
  const two = pick((target) => {
    let best
    for (const first of out.get(from) ?? []) {
      const middle = first.to
      if (middle === target || passes(first, target) || passes(first, to)) continue
      const second = byPair.get(`${middle}>${target}`)
      if (!second || passes(second, to) || (noDoubleBack && passes(second, from))) continue
      const seconds = secondsOf(first, framing, pace) + secondsOf(second, framing, pace)
      if (better({ seconds }, best)) best = { seconds, clips: [first, second] }
    }
    return best
  })
  if (two) return walkPlan(from, to, two.clips, framing, pace, 2)
  const three = pick((target) => {
    const chain = wallSteps(graph, from, target, framing, pace)
    return chain && { seconds: chain.reduce((sum, e) => sum + secondsOf(e, framing, pace), 0), clips: chain }
  })
  if (three) return walkPlan(from, to, three.clips, framing, pace, 3)
  const cut = cuts.get(`${from}|${to}`)
  return { type: 'dip', from, to, steps: [{ dip: to, ...(cut ? { title: cut.title } : {}) }], seconds: 0, ...(cut ? { cut: true } : {}) }
}

/** The shortest chain of at most three STEPs from one node to another on one wall. */
function wallSteps(graph, from, to, framing, pace) {
  const { nodes, out } = indexOf(graph)
  const wall = nodes.get(from).wall
  if (!wall || nodes.get(to).wall !== wall) return undefined
  let best
  const walk = (at, chain, seconds) => {
    if (at === to) { if (!best || seconds < best.seconds - 1e-9) best = { seconds, chain }; return }
    if (chain.length === MAX_WALL_STEPS) return
    for (const e of out.get(at) ?? []) {
      if (!e.kinds.includes('STEP') || chain.some((c) => c.from === e.to) || e.to === from) continue
      walk(e.to, [...chain, e], seconds + secondsOf(e, framing, pace))
    }
  }
  walk(from, [], 0)
  return best?.chain
}

/**
 * THE SILENT GUIDED VISIT: the life's own walk, LEGs only, standing at each
 * stop for its reading, and the chapter cuts as dips with their titles.
 *   from             the stop it begins at (the first of the life by default)
 *   readingSeconds   (nodeId) => seconds the visitor stands there reading
 *   titleSeconds     (title) => seconds a chapter's title stands
 */
export function guidedVisit(graph, { from = graph.story[0], framing = 'wide', pace = graph.filmPace ?? 'walk', readingSeconds = () => 0, titleSeconds = () => 0 } = {}) {
  const { byPair, cuts } = indexOf(graph)
  const start = graph.story.indexOf(from)
  if (start < 0) throw new Error(`${from} is not a stop of the life`)
  const steps = []
  let seconds = 0
  for (let i = start; i < graph.story.length; i++) {
    const here = graph.story[i]
    const read = readingSeconds(here)
    steps.push({ read, at: here })
    seconds += read
    const next = graph.story[i + 1]
    if (!next) break
    const cut = cuts.get(`${here}|${next}`)
    if (cut) {
      const stand = titleSeconds(cut.title)
      steps.push({ dip: next, title: cut.title, seconds: stand })
      seconds += stand
      continue
    }
    const leg = byPair.get(`${here}>${next}`)
    if (!leg || !leg.kinds.includes('LEG')) throw new Error(`${here} to ${next}: the life has no LEG here`)
    const s = secondsOf(leg, framing, pace)
    steps.push({ clip: leg.id, seconds: s })
    seconds += s
  }
  return { from, steps, seconds }
}
