/** THE HOST, SAID IN THE RIG'S WORDS, for the offline harnesses.
 *
 * In the browser `src/bench` owns the phase and mounts the picture bench as
 * one `BenchModule`. The checkers run that module alone, under node, with no
 * host in the room: this is the shape the host presents, so a case stays
 * written against the instrument a rig actually holds (`jump`, `state`,
 * `hang`, `cost`). It is a harness, never a shipped path.
 */
export function offlineHost(original, stack, window) {
  let module = null, owns = false, asked = {}
  /* the host's frame loop hands the whole frame to a standing bench, and a
     kind renders inside its own `frame`: the guard is what keeps that one
     call from arriving back here */
  const base = stack.render.bind(stack)
  let inFrame = false
  stack.render = (dt) => {
    if (inFrame || !owns || !module) return base(dt)
    inFrame = true
    try { module.frame(dt) } finally { inFrame = false }
  }
  const rig = {
    ...original,
    jump(next, opts = {}) {
      if (next === 'bench') {
        owns = true
        asked = { ...opts }
        return void module?.open(opts)
      }
      if (owns) {
        owns = false
        module?.close()
      }
      original.jump(next, opts)
    },
    state() {
      if (!owns || !module) return original.state()
      const reading = module.reading(), cost = stack.cost()
      return { phase: 'bench', kind: 'pictures', ...reading, segment: reading.stationId,
        draws: cost.draws, tris: cost.triangles,
        error: module.telemetry().error ?? null, lookCone: null }
    },
    hang: () => module.telemetry(),
    work: (id) => module.station(id),
    station: (id) => (owns && module ? module.station(id) : original.station(id)),
    rail(t) {
      if (!owns || !module) return original.rail(t)
      const all = module.ids()
      module.station(all[Math.round(Math.min(1, Math.max(0, t)) * (all.length - 1))])
    },
    cost() {
      const c = stack.cost()
      return { ...c, textureMB: module?.telemetry().cost?.textureMB ?? c.textureMB }
    },
    /* the module declares `reloadOnTier`, so the host sends the rig round
       the same address again rather than switching a dressed room live */
    tier(name) {
      original.tier(name)
      if (!owns || !module) return
      // a tier change while a mount is still in flight reopens what was
      // asked for, never the idle reading of a bench that is not standing
      const said = module.telemetry()
      void module.open(said.segment
        ? { segment: said.segment, work: said.selected, view: said.view }
        : asked)
    },
    relight() {
      module.relight()
      return module.lights()
    },
  }
  window.__forge = rig
  return {
    rig,
    /** the way home the host hands every kind */
    onLobby() { owns = false; original.jump('held') },
    attach(next) { module = next; owns = Boolean(next?.reading().stationId); return next },
  }
}
