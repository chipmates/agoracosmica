#!/usr/bin/env node
/** THE FILM'S PLAN AND LIFE, proved without a browser.
 *   node src/wings/vinci/film-ways-check.mjs [--release=<folder holding film.json>]
 * The life the film composes is the wing's whole record; the plan's stations
 * are the film's own stops that are stations, numbered as the band counts
 * them, at the eyes the film was printed from; the line's works are its
 * twelve cut dates and its floor; the floor's id is the live registry's.
 * With a release, the plan is read against it; without one, that part is
 * skipped and says so.
 */
import { createServer } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..')
const flags = new Map(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const at = a.indexOf('='); return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)] }))
const RELEASE = flags.has('release') ? resolve(String(flags.get('release'))) : null

let failed = 0
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++ }

const vite = await createServer({ root: ROOT, configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const load = path => vite.ssrLoadModule(path)
  const life = await load('/src/wings/vinci/life-record.ts')
  const { LINE_STUDS, LINE_SECTIONS } = await load('/src/wings/vinci/line/studs.ts')
  const { LINE_FLOOR_PICK } = await load('/src/wings/vinci/collection/approaches.ts')
  const { vinciContent, vinciLifeBands } = await load('/src/wings/vinci/content.ts')
  const { REGISTER } = await load('/src/wings/vinci/pictures/register.ts')

  // THE LIFE: every date of the record, in its own band, the twelve the floor cuts marked so
  const record = life.vinciLifeRecord(() => true)
  check(record.events.length === LINE_STUDS.length, `the life holds every date of the record (${record.events.length} of ${LINE_STUDS.length})`)
  check(record.bands.length === vinciLifeBands.length, `every period stands (${record.bands.length})`)
  check(record.events.every(e => record.bands.some(b => b.id === e.band)), 'every date stands in a period it names')
  const cut = record.events.filter(e => e.walk && 'stud' in e.walk).map(e => e.id)
  const cutWant = LINE_SECTIONS.flatMap(s => [0, 1, 2, 3].map(o => LINE_STUDS[s.selected + o].id))
  check(cut.length === 12 && cutWant.every(id => cut.includes(id)), `the twelve cut dates carry the floor's mark (${cut.length})`)
  check(record.works.length === REGISTER.length, `the works row holds the register (${record.works.length})`)
  check(record.works.every(w => w.exhibit === `picture/${w.id}/front`), 'a work the wing shows carries the door to its wall')
  check(life.vinciLifeRecord(() => false).works.every(w => w.exhibit === null), 'a work the wing cannot show carries no door')
  check(Boolean(record.here) && record.events.some(e => e.id === record.here), `the hour's own date stands (${record.here})`)
  check(['en', 'de'].every(l => record.words.provenance[l] && record.words.back[l] && record.words.honesty[l]), 'the record door, the way back and the honesty line in both languages')
  check(record.sure.documented && record.sure.inferred && record.sure.tradition, 'the three certainties carry their words and colours')

  // THE LINE'S WORKS: the cut dates in the record's order, then the floor
  const floor = (await load('/src/wings/vinci/film-ways.ts')).FILM_LINE_FLOOR
  check(floor === LINE_FLOOR_PICK, `the floor's mark is the live registry's id (${floor})`)
  const line = life.vinciLineHighlights(floor)
  check(line.length === 13 && line.at(-1).id === floor, `the line lists its twelve dates and the floor (${line.length})`)
  check(line.slice(0, 12).map(h => h.id).join() === LINE_STUDS.filter(s => cutWant.includes(s.id)).map(s => `stud/${s.id}`).join(), 'the dates stand in the record\'s own order')
  check(line.at(-1).title.de === vinciContent.find(s => s.id === 'line-early').name.de, 'the floor is named by its station')

  // THE PLAN against a release: the film's stops that are stations, at their printed eyes
  const file = RELEASE ? [join(RELEASE, 'film.json'), RELEASE].find(p => existsSync(p) && p.endsWith('.json')) : null
  if (!file) console.log('skip the plan: no --release given')
  else {
    const release = JSON.parse(readFileSync(file, 'utf8'))
    const plan = await load('/src/wings/vinci/film-plan.ts')
    // the walk the release was rendered along, as the film wing reads it
    const stops = release.story.map(node => { const id = node.slice('stop:'.length), station = release.nodes[node].station; return { id, station, name: vinciContent.find(s => s.id === station)?.name ?? { en: id, de: id } } })
    const site = plan.filmPlanSite(release, stops, () => true, [])
    const want = stops.flatMap((s, i) => s.id === s.station && vinciContent.some(c => c.id === s.id) ? [i + 1] : [])
    check(site.stations.map(s => s.number).join() === want.join(), `the plan's stations are the stops that are stations, numbered as the band counts (${want.join(' ')})`)
    check(site.stations.every(s => { const p = release.nodes[`stop:${s.id}`].print.wide.split(',').map(Number); return s.east === p[0] && s.north === -p[2] }), 'every mark stands at the eye its stop was printed from')
    check(!site.stations.some(s => s.id === 'picture-room-lisa' || s.id === 'body-valve'), 'a place of the walk inside a room is no mark of its own')
    check(site.rooms.length === 6 && site.shapes.length === 5 && site.shapes[0].points.length > 10, 'the rooms and the house\'s outline are the live plan\'s')
    const cells = async ids => ids.map(id => ({ id, title: id, kind: id.split('/')[0], openable: true, certainty: 'documented', preview: null }))
    const table = Array.from({ length: 17 }, (_, i) => `topic/t${i}`)
    const works = await plan.filmPlanHighlights(release, stops, () => true, cells, { floor, table }, 'de')
    const under = id => works.filter(w => w.station === id).length
    check(under('picture-room') === (release.sets['picture-room'] ?? []).length && under('picture-room-west') === 0, `the hang stands once, under the room's first stop (${under('picture-room')})`)
    check(under('flight') === (release.sets.flight ?? []).length && under('works') === (release.sets.works ?? []).length, `the hall's two stops keep their own machines (${under('flight')}, ${under('works')})`)
    check(under('reading-table') === table.length, `the reading table offers the set it is handed (${under('reading-table')})`)
    check(under('line-early') === 13 && works.filter(w => w.station === 'line-early').every(w => w.kind === 'stud'), `the line offers its dates and floor (${under('line-early')})`)
  }
} finally {
  await vite.close()
}
console.log(failed ? `${failed} failed` : 'all held')
process.exit(failed ? 1 : 0)
