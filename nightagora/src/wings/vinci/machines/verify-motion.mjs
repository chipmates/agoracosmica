// Run from the app: node --experimental-strip-types src/wings/vinci/machines/verify-motion.mjs
// Independent comparisons against the locked dossier expressions, then joints
// and moving rope paths against their contact and conservation constraints.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { Group, Quaternion, Vector3 } from 'three/webgpu'
import { applyMotion, jointValuesAt, movingCentreline } from './motion.ts'

const dossierRoot = new URL('./data/', import.meta.url)
const dossiers = readdirSync(dossierRoot).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, dossierRoot), 'utf8')))
  .filter((d) => d.status === 'complete')
assert.equal(dossiers.length, 14)
let assertions = 0
function near(a, b, context, tolerance = 1e-9) {
  assertions++
  assert.ok(Math.abs(a - b) <= tolerance, `${context}: ${a} != ${b}`)
}
function formula(value, t) {
  if (typeof value === 'number') return value
  const source = value.replace(/^q\(t\)=/, '').split(/ radians|, radians/)[0]
    .replaceAll('^', '**').replaceAll(/\bpi\b/g, 'Math.PI')
    .replaceAll(/\b(cos|sin)\b/g, 'Math.$1')
  // These are the locked mathematical expressions, never application inputs.
  assert.ok(/^[\d\s.()+*/\-tMathPIsinco]*$/.test(source), source)
  return Function('t', `return (${source})`)(t)
}
const measured = []
for (const d of dossiers) {
  const end = d.motion.period_s
  for (const phase of d.motion.phases) {
    for (let step = 0; step <= 48; step++) {
      const local = phase.duration_s * step / 48
      const t = phase.start_s + local
      const actual = jointValuesAt(d.slug, t)
      for (const [id, expression] of Object.entries(phase.joint_values)) {
        near(actual[id], formula(expression, local), `${d.slug}/${id}@${t}`)
      }
    }
  }
  if (end !== null && d.motion.loop) {
    const first = d.motion.phases[0]
    const last = d.motion.phases.at(-1)
    for (const id of Object.keys(first.joint_values)) {
      const delta = formula(last.joint_values[id], last.duration_s) - formula(first.joint_values[id], 0)
      near(jointValuesAt(d.slug, 3 * end + end / 7)[id],
        jointValuesAt(d.slug, end / 7)[id] + 3 * delta, `${d.slug}/${id} unwrapped loop`, 1e-8)
    }
  } else if (end !== null) {
    assert.deepEqual(jointValuesAt(d.slug, end + 100), jointValuesAt(d.slug, end))
    assertions++
  }
  const object = new Group()
  const parts = new Map()
  for (const p of d.parts) {
    const g = new Group()
    g.position.fromArray(p.position_m)
    g.rotation.set(...p.orientation_rad)
    parts.set(p.id, g)
  }
  for (const p of d.parts) (parts.get(p.parent) ?? object).add(parts.get(p.id))
  const updates = new Map()
  const assembly = { object, parts, meshes: new Map(), updateTube: (id, points) => updates.set(id, points), sync: () => {}, dispose: () => {} }
  const rotation = new Quaternion()
  const testTime = end ? end / 3 : 0
  const values = applyMotion(d, assembly, testTime)
  for (const j of d.joints) {
    if (['gear', 'belt', 'rope'].includes(j.type)) continue
    const p = d.parts.find((p) => p.id === j.child)
    const actual = parts.get(j.child)
    // A hinge pivot is unchanged in parent coordinates even where the part
    // origin differs from its pivot (the vane is the nontrivial case).
    if (j.type !== 'prismatic') {
      rotation.setFromAxisAngle(new Vector3(...j.axis), values[j.id])
      const offset = new Vector3(...p.position_m).sub(new Vector3(...j.pivot_m))
      const expected = offset.applyQuaternion(rotation).add(new Vector3(...j.pivot_m))
      near(actual.position.distanceTo(expected), 0, `${d.slug}/${j.id} pivot`)
    }
  }
  if (d.slug === 'inclinometer') {
    const up = new Vector3(0, 1, 0).applyQuaternion(parts.get('pendulum').getWorldQuaternion(new Quaternion()))
    near(up.distanceTo(new Vector3(0, 1, 0)), 0, 'inclinometer gravity stays vertical')
  }
  if (d.slug === 'water-lifting-screw') {
    const shaft = new Vector3(0, 1, 0).applyQuaternion(parts.get('rotor').getWorldQuaternion(new Quaternion()))
    near(shaft.distanceTo(new Vector3(0, 0.5, Math.sqrt(3) / 2)), 0, 'water screw 30 degree axis')
  }
  if (d.slug === 'proportional-compass') {
    const left = parts.get('leg-left')
    const right = parts.get('leg-right')
    const a = left.localToWorld(new Vector3(0, -0.4, 0)).sub(right.localToWorld(new Vector3(0, -0.4, 0)))
    const b = left.localToWorld(new Vector3(0, 0.2, 0)).sub(right.localToWorld(new Vector3(0, 0.2, 0)))
    // The two blades occupy separate Z layers. The compass measures planar distances.
    near(Math.hypot(a.x, a.y) / Math.hypot(b.x, b.y), 2, 'compass projected 2:1 ratio')
  }
  // Seeking back must reconstruct the original pose rather than accumulating.
  applyMotion(d, assembly, 0)
  for (const p of d.parts) {
    near(parts.get(p.id).position.distanceTo(new Vector3(...p.position_m)), 0, `${d.slug}/${p.id} restore`)
    const rest = new Group()
    rest.rotation.set(...p.orientation_rad)
    near(1 - Math.abs(parts.get(p.id).quaternion.dot(rest.quaternion)), 0, `${d.slug}/${p.id} rotation restore`)
  }
  let maxRate = 0
  const independent = d.joints.filter((j) => !['gear', 'belt', 'rope'].includes(j.type))
  const input = d.drive.input_joint ?? independent[0]?.id
  if (input && end && d.drive.input_rate.unit === 'rad/s') {
    for (let step = 1; step < 2400; step++) {
      const t = end * step / 2400
      const epsilon = 1e-5
      maxRate = Math.max(maxRate, Math.abs((jointValuesAt(d.slug, t + epsilon)[input] - jointValuesAt(d.slug, t - epsilon)[input]) / (2 * epsilon)))
    }
    assert.ok(maxRate <= d.drive.input_rate.value + 1e-7, `${d.slug} exceeds drive rate`)
    assertions++
  }
  measured.push({ slug: d.slug, period_s: end, loop: d.motion.loop, joints: independent.length, input_max_rad_s: maxRate || null })
}

// Prove the comparator can reject a changed schedule, not only pass its own rows.
assert.throws(() => near(jointValuesAt('rolling-mill', 6)['q-upper'], -Math.PI / 2, 'negative control: wrong gear ratio'))

const length = (points) => points.slice(1).reduce((n, p, i) => n + new Vector3(...p).distanceTo(new Vector3(...points[i])), 0)
const crane = dossiers.find((d) => d.slug === 'revolving-crane')
const lathe = dossiers.find((d) => d.slug === 'lathe')
for (let step = 0; step <= 120; step++) {
  const t = step / 10
  const q = jointValuesAt('revolving-crane', t)
  const exposedRest = crane.parts.find((p) => p.id === 'hoist-rope').dimensions_m.centreline
  const exposed = movingCentreline('revolving-crane', 'hoist-rope', exposedRest, q)
  const wrap = movingCentreline('revolving-crane', 'drum-wrap', [], q)
  // Analytic arc length avoids assigning the tessellated chord error to the rope.
  near(length(exposedRest) - length(exposed), q.lift, `crane exposed payout@${t}`)
  near(0.08 * (1 - q.hoist) - 0.08, q.lift, `crane wrap uptake@${t}`)
  const end = new Vector3(...wrap.at(-1)).applyEuler(partsEuler(crane, 'drum'))
    .applyAxisAngle(new Vector3(1, 0, 0), q.hoist)
  near(end.distanceTo(new Vector3(0, 0, -0.08)), 0, `crane tangent@${t}`)
  near(exposed.at(-1)[1], 0.82 + q.lift, `crane load contact@${t}`)
  const lq = jointValuesAt('lathe', t)
  const ropeRest = lathe.parts.find((p) => p.id === 'drive-rope').dimensions_m.centreline
  const rope = movingCentreline('lathe', 'drive-rope', ropeRest, lq)
  near(length(rope), length(ropeRest), `lathe fixed rope length@${t}`)
  near(lq.spin * 0.04000791493439473, lq.foot, `lathe spool payout@${t}`)
  const bowRest = lathe.parts.find((p) => p.id === 'bow').dimensions_m.centreline
  const bow = movingCentreline('lathe', 'bow', bowRest, lq)
  near(new Vector3(...bow.at(-1)).distanceTo(new Vector3(...rope[0])), 0, `lathe bow contact@${t}`)
}
function partsEuler(d, id) {
  const g = new Group()
  g.rotation.set(...d.parts.find((p) => p.id === id).orientation_rad)
  return g.rotation
}
console.log(JSON.stringify({ ok: true, assertions, machines: measured }, null, 2))
