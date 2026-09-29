// The real sky's chain, checked against the wing's own sun and two planners'
// independent numbers; with BSC5_CATALOG set to the catalogue file, the whole
// catalogue against its own galactic coordinates and the module on disk.
//
//   node --test forge/night/real-sky.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createLoader, WING_DIR } from '../film/load.mjs'
import {
  DAY_JD, MODULE_FILE, NIGHT_LAT_HOUR, apply, catalogText, engineOf, galacticMatrix, galacticOf, momentAt, momentAtUT,
  readCatalog, skyAt, starModule, sunAt,
} from './real-sky.mjs'

const RAD = Math.PI / 180
/** the great-circle distance between two (altitude, azimuth) pairs, degrees */
const apart = (a, b) => Math.acos(Math.min(1, Math.sin(a.altitude * RAD) * Math.sin(b.altitude * RAD)
  + Math.cos(a.altitude * RAD) * Math.cos(b.altitude * RAD) * Math.cos((a.azimuth - b.azimuth) * RAD))) / RAD

/* the catalogue's own rows (CDS V/50, bytes 1-160) for the stars the checks name */
const ROWS = `
 424  1Alp UMiBD+88    8   8890   308 907    1477  Alp UMi  012233.7+884626023148.7+891551123.28 26.46 2.02  +0.60 +0.38 +0.31   F7:Ib-II          v+0.038-0.015
1708 13Alp AurBD+45 1077  34029 40186 193I   3841   1897    050918.0+455347051641.4+455953162.58  4.57 0.08  +0.80 +0.44 +0.44   G5IIIe+G0III      v+0.076-0.425
5340 16Alp BooBD+19 2777 124897100944 526I          6603    141106.0+194211141539.7+191057 15.14 69.11-0.04  +1.23 +1.27 +0.65   K1.5IIIFe-0.5     v-1.093-1.998
6705 33Gam DraBD+51 2282 164058 30653 676I  10923           175417.0+513002175636.4+512920 79.06 29.22 2.23  +1.52 +1.87 +0.85   K5III             v-0.008-0.019
7001  3Alp LyrBD+38 3238 172167 67174 699I  11510  Alp Lyr  183333.1+384126183656.3+384701 67.44 19.24 0.03   0.00 -0.01 -0.03   A0Va               +0.202+0.286
7417  6Bet1CygBD+27 3410 183912 87301 732I  12540A 12105    192641.3+274458193043.3+275735 62.11  4.57 3.08  +1.13 +0.62 +0.66   K3II+B9.5V         +0.002-0.002
7796 37Gam CygBD+39 4159 194093 49528 765I  13765  13048    201838.3+395611202213.7+401524 78.15  1.87 2.20  +0.68 +0.53 +0.34   F8Ib               +0.004 0.000
7924 50Alp CygBD+44 3541 197345 49941 777I  14172  Alp Cyg  203801.3+445522204125.9+451649 84.28  2.00 1.25  +0.09 -0.24 +0.10   A2Ia              t+0.003+0.002
8238  8Bet CepBD+69 1173 205021 10057 809   15032  Bet Cep  212722.2+700718212839.6+703339107.54 14.03 3.23  -0.22 -0.95 -0.22   B1IV              v+0.010+0.007`
const named = new Map(readCatalog(ROWS).map((s) => [s.hr, s]))
const at = (moment) => new Map(skyAt([...named.values()], moment).map((s) => [s.hr, s]))

test('the day and the hour are the wing\'s own', () => {
  assert.equal(DAY_JD, 2275424.5, '10 October 1517, Julian calendar, 0 h UT')
  const m = momentAt(NIGHT_LAT_HOUR)
  assert.ok(Math.abs(m.utHour - (20 + 41 / 60 + 8 / 3600)) < 1e-9, '21:00 LAT is 20:41:08 UT')
  // the hour statement's own arithmetic: 15:00:08 UT + 00:18:52 = 15:19:00 LAT
  assert.ok(Math.abs(momentAt(15 + 19 / 60).utHour - (15 + 8 / 3600)) < 1e-9)
})

test('the same chain run for the Sun gives the wing\'s sunset azimuth, 255.6 degrees at 17:01 UT', () => {
  const sun = sunAt(momentAtUT(17 + 1 / 60))
  assert.ok(Math.abs(sun.azimuth - 255.6) < 0.1, `azimuth ${sun.azimuth.toFixed(3)}`)
  // and the instant its centre stands 0.833 degrees under (refraction and the half disc) is 17:01 within the statement's two minutes
  let lo = 16.5, hi = 17.5
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (sunAt(momentAtUT(mid)).altitude > -0.8333) lo = mid; else hi = mid }
  const set = sunAt(momentAtUT(lo))
  assert.ok(Math.abs(lo - (17 + 1 / 60)) < 2 / 60, `sunset ${(lo * 60).toFixed(1)} min after 0 h UT`)
  assert.ok(Math.abs(set.azimuth - 255.6) < 0.1, `sunset azimuth ${set.azimuth.toFixed(3)}`)
})

test('at 19:00 LAT it reproduces the Fable planner\'s independent numbers within 0.3 degrees', () => {
  const sky = at(momentAt(19))
  for (const [hr, name, altitude, azimuth] of [[7001, 'Vega', 63.5, 262.8], [7924, 'Deneb', 85.6, 212], [5340, 'Arcturus', 8.7, 292.8], [1708, 'Capella', 16.3, 39]]) {
    const d = apart(sky.get(hr), { altitude, azimuth })
    assert.ok(d < 0.3, `${name}: ${d.toFixed(3)} deg apart (${sky.get(hr).altitude.toFixed(2)} / ${sky.get(hr).azimuth.toFixed(2)})`)
  }
})

test('at 21:00 LAT Vega, Deneb, Polaris and Eltanin stand where the Opus planner\'s chart has them', () => {
  const sky = at(momentAt(21))
  for (const [hr, name, altitude, azimuth] of [[7001, 'Vega', 43.138, 283.811], [7924, 'Deneb', 66.318, 273.286], [424, 'Polaris', 50.416, 2.135], [6705, 'Eltanin', 44.121, 303.923]]) {
    const d = apart(sky.get(hr), { altitude, azimuth })
    assert.ok(d < 0.3, `${name}: ${d.toFixed(4)} deg apart`)
  }
})

test('the galactic matrix takes a star\'s engine direction to the catalogue\'s own galactic coordinates', () => {
  const m = momentAt(21), M = galacticMatrix(m)
  for (const s of skyAt([...named.values()], m)) {
    if (Math.hypot(s.pmRA, s.pmDE) > 0.05) continue
    const g = galacticOf(apply(M, engineOf(s)))
    const d = apart({ altitude: g.b, azimuth: g.l }, { altitude: s.glat, azimuth: s.glon })
    assert.ok(d < 0.1, `HR ${s.hr}: ${d.toFixed(3)} deg from the catalogue's l ${s.glon} b ${s.glat}`)
  }
})

test('the star module carries the same numbers', async () => {
  const loader = await createLoader()
  const mod = loader.load(`${WING_DIR}/farewell-night-stars.ts`)
  const stride = mod.NIGHT_STARS_STRIDE, rows = mod.NIGHT_STARS
  assert.equal(rows.length % stride, 0)
  const count = rows.length / stride
  assert.ok(count > 4300 && count < 4700, `${count} stars`)
  const sky = at(momentAt(21))
  let seen = 0
  for (let i = 0; i < rows.length; i += stride) {
    assert.ok(rows[i + 1] > -1.001, 'every star above -1 degree')
    const s = sky.get(rows[i + 4])
    if (!s) continue
    seen++
    assert.ok(apart({ azimuth: rows[i], altitude: rows[i + 1] }, s) < 0.01, `HR ${s.hr}`)
    assert.equal(rows[i + 2], s.V)
  }
  assert.ok(seen >= 8, 'the named stars are in the module')
  const M = galacticMatrix(momentAt(21))
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) assert.ok(Math.abs(mod.NIGHT_GALACTIC[r][c] - M[r][c]) < 1e-9)
})

test('with the catalogue at hand: every star against its galactic coordinates, and the module is current', { skip: !process.env.BSC5_CATALOG && 'set BSC5_CATALOG to the V/50 catalog file' }, () => {
  const stars = readCatalog(catalogText(readFileSync(process.env.BSC5_CATALOG)))
  assert.equal(stars.length, 9096, 'every entry with a position')
  const m = momentAt(21), M = galacticMatrix(m)
  const errors = []
  for (const s of skyAt(stars, m)) {
    if (Math.hypot(s.pmRA, s.pmDE) > 0.05) continue
    const g = galacticOf(apply(M, engineOf(s)))
    errors.push(apart({ altitude: g.b, azimuth: g.l }, { altitude: s.glat, azimuth: s.glon }))
  }
  errors.sort((a, b) => a - b)
  const median = errors[errors.length >> 1], p99 = errors[Math.floor(errors.length * 0.99)]
  assert.ok(median < 0.02 && p99 < 0.06, `median ${median.toFixed(4)}, 99th percentile ${p99.toFixed(4)} of ${errors.length}`)
  const disk = readFileSync(new URL(`../../${MODULE_FILE}`, import.meta.url), 'utf8')
  assert.equal(disk, starModule(stars, m), 'the module on disk is the generator\'s output')
})
