#!/usr/bin/env node
// THE STILLS CHECK — is this export still the checkout's own, and is every
// picture whole. Offline: no browser, no server, no render.
//
//   node forge/prerender/stills-check.mjs                 (the default export)
//   node forge/prerender/stills-check.mjs --order=life
//   node forge/prerender/stills-check.mjs --out=<dir> --json
//
// What it refuses:
//   · a stop or a framing the run recorded and the disk does not carry
//   · a still whose bytes are not the bytes the sidecar names
//   · a sidecar whose scene hashes are not this checkout's, which is exactly
//     how a scene revision turns its own stale stills red
//   · a mark whose box leaves the still
//   · a mark band that a player's crop would cut
//   · a lead picture over the search plan's byte line
//   · a still whose own record does not prove the chrome was struck
//
// Exit 1 on any refusal. With no export on disk it exits 0 and says so: the
// pictures do not live in the repo, so this stands with the rig, not with the
// wing's offline checkers.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const flags = new Map()
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue
  const at = a.indexOf('=')
  flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
}
const flag = (n, d) => flags.get(n) ?? d
const ORDER = String(flag('order', 'life'))
const OUT = String(flag('out', resolve(APP_ROOT, '..', 'stills')))
const JSON_ONLY = Boolean(flag('json', false))
const LEAD_BYTES = 120 * 1024

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const shaFile = (file) => sha(readFileSync(file))
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: APP_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

/** the same reading the exporter wrote into every sidecar */
function provenance() {
  const certFile = join(APP_ROOT, 'src/wings/vinci/data/rail-clearance.json')
  const manifestFile = join(APP_ROOT, 'assets/wing-vinci/manifest.json')
  const cert = existsSync(certFile) ? JSON.parse(readFileSync(certFile, 'utf8')) : {}
  return {
    head: git('rev-parse', 'HEAD'),
    srcTree: git('rev-parse', 'HEAD:./src'),
    certificateSha256: existsSync(certFile) ? shaFile(certFile) : '',
    geometrySha256: cert.geometrySha256 ?? '',
    recipeSha256: cert.recipeSha256 ?? '',
    wingManifestSha256: existsSync(manifestFile) ? shaFile(manifestFile) : '',
  }
}

const refusals = []
const notes = []
const refuse = (stop, what) => refusals.push({ stop, what })

const runFile = join(OUT, ORDER, 'stills.json')
if (!existsSync(runFile)) {
  const said = { ok: true, skipped: `no export at ${runFile}` }
  console.log(JSON.stringify(said, null, 1))
  process.exit(0)
}
const run = JSON.parse(readFileSync(runFile, 'utf8'))
const here = provenance()
/** WHAT MAKES A STILL STALE. The commit is NOT one of these: a forge-only
 *  commit moves HEAD and restages nothing, and the source tree, the
 *  certificate and the wing's manifest are what a picture is made of. */
const SCENE_KEYS = ['srcTree', 'certificateSha256', 'geometrySha256', 'recipeSha256', 'wingManifestSha256']

let stills = 0
let deliveries = 0
let marks = 0
const stale = new Set()

for (const [framing, record] of Object.entries(run.framings ?? {})) {
  const dir = join(OUT, run.order, framing)
  for (const still of record.stills) {
    const id = `${framing}/${still.id}`
    const png = join(dir, `${still.id}.png`)
    const sidecarFile = join(dir, `${still.id}.sidecar.json`)
    const marksFile = join(dir, `${still.id}.marks.json`)
    if (!existsSync(png)) {
      refuse(id, 'the still is not on disk')
      continue
    }
    stills++
    if (shaFile(png) !== still.sha256) refuse(id, 'the still on disk is not the still the run recorded')
    if (!existsSync(sidecarFile)) {
      refuse(id, 'no sidecar')
      continue
    }
    const sidecar = JSON.parse(readFileSync(sidecarFile, 'utf8'))
    if (sidecar.master.sha256 !== still.sha256) refuse(id, 'the sidecar names other bytes than the run')
    /* THE STALE TEST. A scene revision changes the source tree or the mounted
       geometry, and every still made before it is then a picture of a museum
       that has moved on. */
    /* a hash may be one string or a list of them, one per tier: compared as
       text, so a list never reads as changed just for being a new array */
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    for (const key of SCENE_KEYS) {
      if (!here[key] || !sidecar.scene[key]) continue
      if (!same(sidecar.scene[key], here[key])) stale.add(`${id}: ${key}`)
    }
    if (sidecar.scene.dirty) notes.push(`${id}: made on a tree with uncommitted work, so HEAD does not describe it`)
    /* THE CHROME. Not a reading of the pixels: the run counted, in the page and
       at the moment of the shot, every element the browser was still painting.
       One canvas and nothing else is a frame no glyph can be in. */
    const chrome = sidecar.picture.chromeProof
    if (!chrome) refuse(id, 'the run kept no proof that the chrome was struck')
    else if (chrome.painted !== 0) refuse(id, `${chrome.painted} painted element(s) over the picture: ${(chrome.what ?? []).join(', ')}`)
    /* the delivery, and the lead picture's byte line */
    for (const file of sidecar.delivery ?? []) {
      const on = join(dir, file.file)
      if (!existsSync(on)) {
        refuse(id, `the delivery is not on disk: ${file.file}`)
        continue
      }
      deliveries++
      if (statSync(on).size !== file.bytes) refuse(id, `the delivery has other bytes than the sidecar: ${file.file}`)
      if (file.lead && file.bytes > LEAD_BYTES) refuse(id, `the lead picture is ${Math.round(file.bytes / 1024)} kB, over the ${LEAD_BYTES / 1024} kB line: ${file.file}`)
    }
    if (!existsSync(marksFile)) {
      refuse(id, 'no marks file')
      continue
    }
    const mark = JSON.parse(readFileSync(marksFile, 'utf8'))
    marks += mark.marks.length
    if (!mark.sameProjection) refuse(id, 'the marks were read on another projection than the still')
    if (mark.cam !== sidecar.picture.cam) refuse(id, 'the marks file names another camera than the sidecar')
    for (const m of mark.marks) {
      const b = m.box
      if (b.left < 0 || b.top < 0 || b.right > 1 || b.bottom > 1) refuse(id, `a mark leaves the still: ${m.id}`)
      if (b.right <= b.left || b.bottom <= b.top) refuse(id, `a mark has no box: ${m.id}`)
    }
    /* THE BAND THE WORDS MUST LEAVE ALONE, against the crops a player may
       take. The story's own `sees` names the object the frame must show and
       the wing computes no box for it, so what is proved here is the band the
       marks stand in: a crop that cuts it cuts the thing the stop is about. */
    if (mark.sees && !mark.seesBox) notes.push(`${id}: the sees box is not computed, the mark band stands for it`)
    if (mark.freeBand) {
      for (const crop of mark.crops) {
        const k = crop.keeps
        if (mark.freeBand.top < k.top || mark.freeBand.bottom > k.bottom) {
          refuse(id, `the ${crop.name} crop (${crop.why}) cuts the band the marks stand in`)
        }
      }
    } else if (mark.marks.length) {
      refuse(id, 'marks without a band')
    }
  }
  if (!record.stills.length) refuse(framing, 'a framing with no stills')
}

const ok = refusals.length === 0 && stale.size === 0
const said = {
  ok,
  order: run.order,
  head: { run: run.made.head, here: here.head, same: run.made.head === here.head },
  counted: { stills, deliveries, marks, framings: Object.keys(run.framings ?? {}) },
  stale: [...stale],
  refusals,
  notes,
}
console.log(JSON.stringify(said, null, 1))
if (!JSON_ONLY && !ok) {
  for (const r of refusals) console.error(`REFUSED ${r.stop}: ${r.what}`)
  for (const s of stale) console.error(`STALE ${s}`)
}
process.exit(ok ? 0 : 1)
