#!/usr/bin/env node
/** Offline execution of the real Vinci factories and camera rail.
 * Run: node src/wings/vinci/geometry-check.mjs > <app-local report.json>
 * The caller owns redirection. This program creates no files or renderer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WING = 'src/wings/vinci';
const SHELL_CLEARANCE = .25, TERRAIN_CLEARANCE = .3;
const STEP_SECONDS = 1 / 240, TRANSITION_SECONDS = 2.4;
const errors = [], notes = [], loaded = new Map(), modules = new Map();
const report = {
  checker: 'vinci-offline-geometry', replacesEyes: false,
  coordinateFrame: 'Three X=east, Y=height, Z=-north',
  limitations: [
    'No browser, GPU, DOM navigation, touch, wheel or door clicks are exercised.',
    'Actual geometry factories run without material-library textures; shader compilation and texture bytes are not tested.',
    'The water reflector returns an inert TSL node; the actual water geometry and reflector-plane transform still execute.',
    'Rail sampling uses the actual clock-driven implementation at 240 Hz; exact capsule/ray checks cover its sampled chords, not a formal continuous-curve proof.',
    'Terrain clearance is measured vertically at every unique camera sample against actual ground/water triangles and the live gradeAt function.',
    'Shell clearance excludes trees, DOM plates and the camera frustum; it tests the camera centre against the actual shell.',
  ],
  terrain: {}, footprint: {}, sun: {}, geometry: [], rail: {}, sources: [], errors, notes,
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (base, candidate) => candidate === base || candidate.startsWith(base + path.sep);
const relative = filename => path.relative(ROOT, filename).split(path.sep).join('/');
function local(filename) {
  const resolved = path.resolve(ROOT, filename);
  if (!inside(ROOT, resolved)) throw new Error(`Read leaves the app: ${filename}`);
  const real = fs.realpathSync(resolved);
  if (!inside(fs.realpathSync(ROOT), real)) throw new Error(`Symlink leaves the app: ${filename}`);
  return real;
}
function read(filename) {
  const resolved = local(filename), bytes = fs.readFileSync(resolved);
  if (!loaded.has(resolved)) loaded.set(resolved, { file: relative(resolved), sha256: sha(bytes), bytes: bytes.length });
  return bytes;
}
const json = filename => JSON.parse(read(filename).toString('utf8'));
const fail = (code, detail, extra = {}) => errors.push({ code, detail, ...extra });
async function section(name, work) {
  try { await work(); } catch (error) { fail('inspection-error', `${name}: ${error.stack ?? error.message}`); }
}

/** Compile real TS modules in memory, preserving their raw JSON dependency.
 * Only app-local relative imports and the installed Three package are allowed.
 * No alternate geometry or alternate rail implementation is supplied.
 */
async function load(filename) {
  const resolved = local(filename);
  if (modules.has(resolved)) return modules.get(resolved);
  const exported = {};
  modules.set(resolved, exported);
  const source = read(resolved).toString('utf8');
  const compiled = ts.transpileModule(source, { fileName: resolved, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const dependencies = new Map();
  for (const match of compiled.matchAll(/\brequire\(["']([^"']+)["']\)/g)) {
    const specifier = match[1];
    if (dependencies.has(specifier)) continue;
    if (specifier.startsWith('.')) {
      const target = path.resolve(path.dirname(resolved), specifier.replace(/\?raw$/, ''));
      if (specifier.endsWith('?raw')) dependencies.set(specifier, { default: read(target).toString('utf8') });
      else {
        const candidates = [target, `${target}.ts`, `${target}.js`, path.join(target, 'index.ts')];
        const found = candidates.find(candidate => inside(ROOT, candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (!found) throw new Error(`Cannot resolve ${specifier} from ${relative(resolved)}`);
        dependencies.set(specifier, await load(found));
      }
    } else if (/^three(?:\/|$)/.test(specifier)) dependencies.set(specifier, await import(specifier));
    else throw new Error(`Unexpected external module ${specifier} in ${relative(resolved)}`);
  }
  new vm.Script(compiled, { filename: relative(resolved) }).runInNewContext({
    exports: exported,
    require(specifier) {
      if (!dependencies.has(specifier)) throw new Error(`Unresolved runtime import: ${specifier}`);
      return dependencies.get(specifier);
    },
    matchMedia: () => ({ matches: false }),
    console: {
      log: (...values) => notes.push(values.join(' ')),
      warn: (...values) => notes.push(values.join(' ')),
      error: (...values) => fail('module-console-error', values.join(' ')),
    },
    performance,
  }, { timeout: 10000 });
  return exported;
}

let site, groundModule, shellModule, vegetationModule, waterModule, railModule;
await section('load actual modules', async () => {
  site = await load(`${WING}/site.ts`);
  groundModule = await load(`${WING}/ground.ts`);
  shellModule = await load(`${WING}/shell.ts`);
  vegetationModule = await load(`${WING}/vegetation.ts`);
  waterModule = await load(`${WING}/water.ts`);
  railModule = await load(`${WING}/rail.ts`);
});
const gradeModule = await load(`${WING}/terrain-mesh.ts`).catch(error => { fail('grade-load', error.message); return null; });

await section('retained IGN data', () => {
  const file = 'src/wings/vinci/data/terrain.json', currentBytes = read(file), terrain = json(file);
  const firstCommit = execFileSync('git', ['log', '--reverse', '--diff-filter=A', '--format=%H', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n')[0];
  if (!/^[a-f0-9]{40}$/.test(firstCommit ?? '')) throw new Error('Cannot identify the initial tracked terrain dossier.');
  const originalBytes = execFileSync('git', ['show', `${firstCommit}:./${file}`], { cwd: ROOT });
  const original = JSON.parse(originalBytes.toString('utf8'));
  const values = terrain.heights_m.value, baseline = original.heights_m.value;
  const coordinates = terrain.origin.value, spacing = terrain.spacing.value;
  let count = 0, maxSampleError = 0;
  values.forEach((row, r) => row.forEach((value, c) => {
    count++;
    const sampled = site.surveyedHeight(coordinates[0] + c * spacing[0], coordinates[1] + r * spacing[1]);
    maxSampleError = Math.max(maxSampleError, Math.abs(sampled - value));
    if (value !== baseline[r]?.[c]) fail('ign-sample-changed', 'Retained height differs from the original dossier.', { row: r, column: c, original: baseline[r]?.[c], actual: value });
  }));
  const fileUnchanged = currentBytes.equals(originalBytes);
  const moduleUnchanged = JSON.stringify(site.heights) === JSON.stringify(values);
  if (!fileUnchanged) fail('ign-file-changed', 'Terrain dossier bytes differ from the first tracked version.');
  if (!moduleUnchanged || count !== 165 || maxSampleError > 1e-10) fail('ign-grid', 'Expected 165 unchanged values and exact grid-node interpolation.');
  report.terrain = { file, originalCommit: firstCommit, originalSha256: sha(originalBytes), currentSha256: sha(currentBytes), fileUnchanged, moduleUnchanged, samples: count, rows: values.length, columns: values[0]?.length, maxGridNodeErrorM: maxSampleError };
});

await section('registered footprint', () => {
  const points = site.dossier.site.footprint.map(point => point.value);
  const area = Math.abs(points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);
  const expected = 567.310795;
  if (Math.abs(area - expected) > 1e-6) fail('footprint-area', 'Registered footprint differs from the commissioned area.', { expectedM2: expected, measuredM2: area });
  report.footprint = { vertices: points.length, measuredM2: area, expectedM2: expected, toleranceM2: 1e-6 };
});

await section('actual shared key-light direction', async () => {
  const data = json('src/wings/vinci/data/light-rig.json');
  const day = data.dates.find(value => value.julian_date === '1517-10-10');
  const key = day.keyframes.find(value => value.label === '15:19:00 LAT');
  const az = key.sun_azimuth_deg.value * Math.PI / 180, el = key.sun_elevation_deg.value * Math.PI / 180;
  const enu = [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
  const expected = site.world(...enu).normalize();
  const lightModule = await load('src/stack/light.ts'), tiers = await load('src/stack/tier.ts');
  const probe = new THREE.Texture();
  const keyLight = lightModule.createKeyLight(new THREE.Scene(), tiers.TIERS.calm, {
    azimuth: site.hourKey.sun_azimuth_deg.value, elevation: site.hourKey.sun_elevation_deg.value,
    kelvin: 4700, lux: 320, ambient: .35, probe,
  });
  const direction = keyLight.direction.clone();
  const error = direction.distanceTo(expected);
  const tableError = direction.distanceTo(new THREE.Vector3(...key.sun_direction_threejs.value));
  if (error > 1e-12 || tableError > 1e-6) fail('sun-vector', 'Actual key direction differs from the ENU arithmetic or supplied rounded vector.', { error, tableError });
  report.sun = { julianDate: day.julian_date, key: key.label, azimuthDegrees: key.sun_azimuth_deg.value, elevationDegrees: key.sun_elevation_deg.value, expectedThree: expected.toArray(), actualThree: direction.toArray(), vectorError: error, roundedTableError: tableError, shadowAzimuthDegrees: (key.sun_azimuth_deg.value + 180) % 360 };
  keyLight.dispose(); probe.dispose();
});

function validateGeometry(name, tier, group) {
  group.updateWorldMatrix(true, true);
  let meshes = 0, triangles = 0, components = 0, nonfinite = 0, invalidIndices = 0;
  const buffers = [];
  group.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    const geometry = object.geometry, position = geometry.getAttribute('position');
    if (!position) { fail('missing-position', `${name}/${tier}/${object.name} has no position buffer.`); return; }
    const index = geometry.getIndex(), count = index?.count ?? position.count;
    triangles += count / 3;
    if (count % 3 !== 0) fail('triangle-buffer-size', `${name}/${tier}/${object.name} is not a whole triangle count.`);
    for (const [attributeName, attribute] of Object.entries(geometry.attributes)) {
      const array = attribute.array ?? attribute.data?.array;
      if (!array) { fail('unknown-buffer', `Cannot inspect ${name}/${tier}/${object.name}/${attributeName}.`); continue; }
      components += array.length;
      for (const value of array) if (!Number.isFinite(value)) nonfinite++;
      buffers.push({ mesh: object.name, attribute: attributeName, count: attribute.count, itemSize: attribute.itemSize, bytes: array.byteLength });
    }
    if (index) for (const value of index.array) if (!Number.isInteger(value) || value < 0 || value >= position.count) invalidIndices++;
    for (const value of object.matrixWorld.elements) if (!Number.isFinite(value)) nonfinite++;
  });
  if (nonfinite || invalidIndices || !meshes) fail('geometry-buffer', `${name}/${tier} has invalid geometry.`, { nonfinite, invalidIndices, meshes });
  report.geometry.push({ name, tier, meshes, triangles, numericComponents: components, nonfinite, invalidIndices, buffers });
}
function dispose(group) {
  const materials = new Set();
  group.traverse(object => { if (object.isMesh) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); } });
  for (const material of materials) material.dispose();
}

/** Packed copies of the actual world-space triangles, used only as a spatial
 * index. The factory meshes remain the sole source of all vertex positions. */
function trianglesOf(groups, topOnly = false) {
  const values = [], names = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const group of groups) {
    group.updateWorldMatrix(true, true);
    group.traverse(mesh => {
      if (!mesh.isMesh || !mesh.visible) return;
      if (mesh.isInstancedMesh) throw new Error(`Instanced collision mesh requires instance expansion: ${mesh.name}`);
      const g = mesh.geometry, p = g.getAttribute('position'), index = g.getIndex();
      const count = index?.count ?? p.count;
      for (let i = 0; i + 2 < count; i += 3) {
        a.fromBufferAttribute(p, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
        if (topOnly && Math.abs((b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)) < 1e-9) continue;
        values.push(...a.toArray(), ...b.toArray(), ...c.toArray()); names.push(mesh.name);
      }
    });
  }
  return { values: new Float64Array(values), names, count: names.length };
}
function makeIndex(data, dimensions, cellSize) {
  const bins = new Map(), axes = dimensions === 2 ? [0, 2] : [0, 1, 2];
  for (let i = 0; i < data.count; i++) {
    const at = i * 9;
    const limits = axes.map(axis => [Math.floor(Math.min(data.values[at + axis], data.values[at + 3 + axis], data.values[at + 6 + axis]) / cellSize), Math.floor(Math.max(data.values[at + axis], data.values[at + 3 + axis], data.values[at + 6 + axis]) / cellSize)]);
    for (let x = limits[0][0]; x <= limits[0][1]; x++) for (let y = limits[1][0]; y <= limits[1][1]; y++) for (let z = dimensions === 3 ? limits[2][0] : 0; z <= (dimensions === 3 ? limits[2][1] : 0); z++) {
      const key = `${x},${y},${z}`;
      let bucket = bins.get(key); if (!bucket) { bucket = []; bins.set(key, bucket); } bucket.push(i);
    }
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  return { data, bins, cellSize, triangle(i) {
    const n = i * 9;
    a.fromArray(data.values, n); b.fromArray(data.values, n + 3); c.fromArray(data.values, n + 6);
    return [a, b, c];
  } };
}

// Exact distance between two finite segments, including point/parallel cases.
const edgeU = new THREE.Vector3(), edgeV = new THREE.Vector3(), edgeW = new THREE.Vector3();
function segmentDistanceSq(a, b, c, d) {
  edgeU.subVectors(b, a); edgeV.subVectors(d, c); edgeW.subVectors(a, c);
  const aa = edgeU.dot(edgeU), bb = edgeU.dot(edgeV), cc = edgeV.dot(edgeV), dd = edgeU.dot(edgeW), ee = edgeV.dot(edgeW);
  let s = 0, t = 0;
  const clamp = x => Math.max(0, Math.min(1, x));
  if (aa < 1e-18) t = cc < 1e-18 ? 0 : clamp(ee / cc);
  else if (cc < 1e-18) s = clamp(-dd / aa);
  else {
    const determinant = aa * cc - bb * bb;
    s = determinant < 1e-18 ? 0 : clamp((bb * ee - cc * dd) / determinant);
    t = (bb * s + ee) / cc;
    if (t < 0) { t = 0; s = clamp(-dd / aa); }
    else if (t > 1) { t = 1; s = clamp((bb - dd) / aa); }
  }
  return edgeW.addScaledVector(edgeU, s).addScaledVector(edgeV, -t).lengthSq();
}
const ray = new THREE.Ray(), triangle = new THREE.Triangle(), closest = new THREE.Vector3(), rayPoint = new THREE.Vector3(), direction = new THREE.Vector3();
function segmentTriangleDistanceSq(start, end, a, b, c) {
  direction.subVectors(end, start);
  const lengthSq = direction.lengthSq();
  if (lengthSq > 1e-18) {
    ray.set(start, direction.normalize());
    if (ray.intersectTriangle(a, b, c, false, rayPoint) && rayPoint.distanceToSquared(start) <= lengthSq + 1e-12) return 0;
  }
  triangle.set(a, b, c);
  let distance = triangle.closestPointToPoint(start, closest).distanceToSquared(start);
  distance = Math.min(distance, triangle.closestPointToPoint(end, closest).distanceToSquared(end));
  return Math.min(distance, segmentDistanceSq(start, end, a, b), segmentDistanceSq(start, end, b, c), segmentDistanceSq(start, end, c, a));
}
function shellClearance(index, start, end) {
  const radius = SHELL_CLEARANCE, size = index.cellSize, seen = new Set();
  const min = [Math.min(start.x, end.x), Math.min(start.y, end.y), Math.min(start.z, end.z)].map(v => Math.floor((v - radius) / size));
  const max = [Math.max(start.x, end.x), Math.max(start.y, end.y), Math.max(start.z, end.z)].map(v => Math.floor((v + radius) / size));
  let distanceSq = radius * radius, hit = null;
  for (let x = min[0]; x <= max[0]; x++) for (let y = min[1]; y <= max[1]; y++) for (let z = min[2]; z <= max[2]; z++) {
    for (const i of index.bins.get(`${x},${y},${z}`) ?? []) {
      if (seen.has(i)) continue; seen.add(i);
      const value = segmentTriangleDistanceSq(start, end, ...index.triangle(i));
      if (value < distanceSq) { distanceSq = value; hit = index.data.names[i]; }
    }
  }
  return { lowerBoundM: Math.sqrt(distanceSq), mesh: hit, candidates: seen.size };
}
const downRay = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)), groundPoint = new THREE.Vector3();
function groundTop(index, eye) {
  downRay.origin.set(eye.x, 1000, eye.z);
  let top = -Infinity;
  const bucket = index.bins.get(`${Math.floor(eye.x / index.cellSize)},${Math.floor(eye.z / index.cellSize)},0`) ?? [];
  for (const i of bucket) if (downRay.intersectTriangle(...index.triangle(i), false, groundPoint)) top = Math.max(top, groundPoint.y);
  return Number.isFinite(top) ? top : null;
}
const coordinate = eye => ({ east: eye.x, north: -eye.z, height: eye.y });

const collisionSets = new Map();
await section('actual geometry buffers at all tiers', () => {
  for (const tier of ['hero', 'standard', 'calm']) {
    const shell = shellModule.createShell(tier);
    const ground = groundModule.createGround(tier);
    const vegetation = vegetationModule.createVegetation(gradeModule.gradeAt, tier);
    const water = waterModule.createWater(new THREE.Scene(), {
      tierName: () => tier,
      reflector: () => ({ node: TSL.vec4(0, 0, 0, 1), dispose() {} }),
    });
    for (const [name, group] of [['shell', shell], ['ground', ground], ['vegetation', vegetation], ['water', water]]) validateGeometry(name, tier, group);
    if (tier === 'standard' || tier === 'calm') collisionSets.set(tier, { shell, ground, water });
    else { dispose(shell); dispose(ground); water.dispose(); }
    dispose(vegetation);
  }
});

await section('actual camera rail against actual triangles', () => {
  const ids = json('src/wings/vinci/data/doors.json').doors.map(door => door.station);
  if (ids.length !== 19 || new Set(ids).size !== 19) throw new Error('Expected nineteen unique canonical station IDs.');
  const paths = [], poses = [], violations = [], collisionGeometry = [], MAX_VIOLATIONS = 80;
  let violationCount = 0, intersectingChords = 0;
  let totalSamples = 0, uniquePositions = 0, maxStepM = 0, maxRoll = 0, maxQuaternionError = 0, maxAimError = 0;
  let minimumGrade = Infinity, minimumMesh = Infinity, minimumShell = SHELL_CLEARANCE, missingGround = 0;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  for (const narrow of [false, true]) {
    const viewport = narrow ? 'mobile' : 'desktop';
    const tier = narrow ? 'calm' : 'standard', geometry = collisionSets.get(tier);
    if (!geometry) throw new Error(`${tier} geometry was not constructed.`);
    geometry.shell.traverse(object => { if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.side = THREE.DoubleSide; });
    const shellIndex = makeIndex(trianglesOf([geometry.shell]), 3, 1);
    const groundIndex = makeIndex(trianglesOf([geometry.ground, geometry.water], true), 2, 4);
    collisionGeometry.push({ viewport, tier, shellTriangles: shellIndex.data.count, groundAndWaterTriangles: groundIndex.data.count });
    const camera = new THREE.PerspectiveCamera();
    let clock = 0;
    const rail = railModule.createRail(camera, () => clock);
    rail.set(ids[0], railModule.stationPose(ids[0], narrow), true); rail.update();
    const adjacentItinerary = [...ids, ...ids.slice(0, -1).reverse()];
    // The scrolling rail permits direct station selection. These five IDs
    // represent every distinct physical pose used by the nineteen stations.
    const physicalIds = ['arrival','courtyard','hall','garden','line-early'];
    const direct = physicalIds.flatMap(from => physicalIds.filter(to => to !== from).map(to => ({ from, to })));
    const itinerary = [...adjacentItinerary, ...direct.map(item => item.to)];
    for (let beat = 0; beat < itinerary.length; beat++) {
      const jump = direct[beat - adjacentItinerary.length];
      const id = itinerary[beat], from = jump?.from ?? (beat ? itinerary[beat - 1] : id);
      if (jump) { rail.set(from, railModule.stationPose(from, narrow), true); rail.update(); }
      const pose = railModule.stationPose(id, narrow);
      if (beat) rail.set(id, pose, false);
      const startTime = clock;
      const previous = camera.position.clone();
      let lastTested = null, pathGrade = Infinity, pathMesh = Infinity, pathShell = SHELL_CLEARANCE, pathStep = 0, pathRoll = 0, tested = 0;
      const steps = beat ? Math.ceil(TRANSITION_SECONDS / STEP_SECONDS) : 1;
      for (let sample = 0; sample <= steps; sample++) {
        clock = startTime + sample * STEP_SECONDS;
        rail.update(); totalSamples++;
        const eye = camera.position;
        if (![...eye.toArray(), ...camera.quaternion.toArray(), camera.fov].every(Number.isFinite)) { fail('camera-nonfinite', `${viewport}/${from}->${id}`); break; }
        euler.setFromQuaternion(camera.quaternion, 'YXZ');
        pathRoll = Math.max(pathRoll, Math.abs(euler.z));
        maxQuaternionError = Math.max(maxQuaternionError, Math.abs(camera.quaternion.length() - 1));
        const segmentLength = eye.distanceTo(previous);
        pathStep = Math.max(pathStep, segmentLength);
        if (!lastTested || eye.distanceToSquared(lastTested) > 1e-16) {
          tested++; uniquePositions++;
          const ground = gradeModule.gradeAt(eye.x, -eye.z), surface = groundTop(groundIndex, eye);
          const gradeClearance = eye.y - ground, meshClearance = surface === null ? null : eye.y - surface;
          const shell = shellClearance(shellIndex, previous, eye);
          if (shell.lowerBoundM < 1e-8) intersectingChords++;
          pathGrade = Math.min(pathGrade, gradeClearance);
          if (meshClearance === null) missingGround++; else pathMesh = Math.min(pathMesh, meshClearance);
          pathShell = Math.min(pathShell, shell.lowerBoundM);
          if (gradeClearance < TERRAIN_CLEARANCE - 1e-6 || meshClearance === null || meshClearance < TERRAIN_CLEARANCE - 1e-6 || shell.lowerBoundM < SHELL_CLEARANCE - 1e-6) {
            violationCount++;
            if (violations.length < MAX_VIOLATIONS) violations.push({ viewport, from, to: id, seconds: clock - startTime, ...coordinate(eye), gradeClearanceM: gradeClearance, meshClearanceM: meshClearance, shellClearanceM: shell.lowerBoundM, shellMesh: shell.mesh });
          }
          lastTested = eye.clone();
        }
        previous.copy(eye);
      }
      const endpointError = camera.position.distanceTo(pose.eye);
      if (endpointError > 1e-6) fail('rail-endpoint', 'Rail did not reach the actual target pose within the observation window.', { viewport, station: id, distanceM: endpointError });
      const expectedForward = pose.at.clone().sub(pose.eye).normalize();
      const actualForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const aimError = expectedForward.angleTo(actualForward); maxAimError = Math.max(maxAimError, aimError);
      if (beat < ids.length) {
        poses.push({ viewport, station: id, ...coordinate(camera.position), fov: camera.fov, endpointErrorM: endpointError, aimErrorRadians: aimError });
        for (const yaw of [-.6, .6]) for (const pitch of [-.32, .32]) {
          rail.look(yaw, pitch); rail.update(); euler.setFromQuaternion(camera.quaternion, 'YXZ'); pathRoll = Math.max(pathRoll, Math.abs(euler.z));
        }
        rail.look(0, 0); rail.update();
      }
      paths.push({ viewport, direction: jump ? 'direct' : beat < ids.length ? 'forward' : 'back', from, to: id, samples: steps + 1, distinctPositionSamples: tested, maxSampleStepM: pathStep, minimumGradeClearanceM: pathGrade, minimumMeshClearanceM: Number.isFinite(pathMesh) ? pathMesh : null, shellClearanceLowerBoundM: pathShell, maximumYXZRollRadians: pathRoll });
      minimumGrade = Math.min(minimumGrade, pathGrade); minimumMesh = Math.min(minimumMesh, pathMesh); minimumShell = Math.min(minimumShell, pathShell);
      maxRoll = Math.max(maxRoll, pathRoll); maxStepM = Math.max(maxStepM, pathStep);
    }
  }
  if (minimumGrade < TERRAIN_CLEARANCE - 1e-6 || minimumMesh < TERRAIN_CLEARANCE - 1e-6 || missingGround) fail('terrain-clearance', 'Camera samples do not all clear the live grade and rendered ground by 0.3 m.', { minimumGradeM: minimumGrade, minimumMeshM: minimumMesh, missingGround });
  if (minimumShell < SHELL_CLEARANCE - 1e-6) fail('shell-clearance', 'A sampled path chord passes within 0.25 m of the actual DoubleSide shell.', { minimumM: minimumShell });
  if (maxRoll > 1e-8 || maxQuaternionError > 1e-10 || maxAimError > 1e-6) fail('camera-orientation', 'YXZ roll, quaternion norm or final target direction exceeds tolerance.', { maxRoll, maxQuaternionError, maxAimError });
  report.rail = { stationIds: ids, viewportCount: 2, adjacentTransitions: 2 * 2 * (ids.length - 1), directPhysicalTransitions: 40, timeStepSeconds: STEP_SECONDS, transitionObservationSeconds: TRANSITION_SECONDS, shellThresholdM: SHELL_CLEARANCE, terrainThresholdM: TERRAIN_CLEARANCE, collisionGeometry, totalCameraSamples: totalSamples, distinctPositionSamples: uniquePositions, maximumSampleStepM: maxStepM, minimumGradeClearanceM: minimumGrade, minimumMeshClearanceM: Number.isFinite(minimumMesh) ? minimumMesh : null, shellClearanceLowerBoundM: minimumShell, intersectingSampleChords: intersectingChords, maximumYXZRollRadians: maxRoll, maximumQuaternionNormError: maxQuaternionError, maximumAimErrorRadians: maxAimError, missingGroundSamples: missingGround, violationCount, violationExamples: violations, violationExamplesCappedAt: MAX_VIOLATIONS, poses, paths };
});

for (const { shell, ground, water } of collisionSets.values()) { dispose(shell); dispose(ground); water.dispose(); }
report.checkerSha256 = sha(read(`${WING}/geometry-check.mjs`));
for (const [filename, record] of loaded) {
  const unchangedDuringAudit = sha(fs.readFileSync(filename)) === record.sha256;
  report.sources.push({ ...record, unchangedDuringAudit });
  if (!unchangedDuringAudit) fail('source-changed-during-audit', 'Source changed after it was loaded; rerun on a stable tree.', { file: record.file });
}
report.ok = errors.length === 0;
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.ok ? 0 : 1;
