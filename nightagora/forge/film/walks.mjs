// THE CLIPS A PRESS MAY WALK. A wall of sheets is read, never run along, as
// the live wing reads the body wall: the wall's own steps between neighbours
// are walked, a run past its sheets is not (on a grid of courses it winds
// through every course before the sheet asked for), so a sheet out of the
// steps' reach is reached by the quiet dip. The page and its tests read this
// one file, as they read the router.

/** `nodes` is the release's or the graph's node table, by id or as a list. */
export function walkedClip(nodes) {
  const byId = Array.isArray(nodes) ? new Map(nodes.map((n) => [n.id, n])) : new Map(Object.entries(nodes))
  const sheet = (id) => {
    const n = byId.get(id)
    return n?.kind === 'view' && typeof n.exhibit === 'string' && n.exhibit.startsWith('sheet/')
  }
  return (edge) => !edge.kinds.includes('RUN') || edge.kinds.includes('STEP') || !(sheet(edge.from) || sheet(edge.to))
}
