// THE WING'S OWN MODULES, RUN IN NODE for the film's graph and its replay.
//
// The loader of `build-in-node.mjs`, with three things the film needs beside
// it: every file it opens is recorded with its hash (a clip's key names what
// made it), a module may be stood in for by name, and the sources may be read
// at a git revision instead of the working tree, so a track can be replayed
// against the code a capture actually ran.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** Every three.js addon the app's sources name, resolved up front: the module
    loader below is synchronous and cannot await one. */
let addons
async function loadAddons() {
  if (addons) return addons
  addons = new Map()
  for (const dir of ['src/wings/vinci', 'src/stack', 'src/wings/vitrine', 'src']) {
    const walk = (at) => fs.readdirSync(at, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? (entry.name === 'node_modules' ? [] : walk(path.join(at, entry.name)))
        : /\.(ts|mjs)$/.test(entry.name) ? [path.join(at, entry.name)] : [])
    for (const file of walk(path.join(APP_ROOT, dir)))
      for (const hit of fs.readFileSync(file, 'utf8').matchAll(/from '(three\/addons\/[^']+)'/g)) addons.set(hit[1], null)
  }
  for (const specifier of [...addons.keys()]) addons.set(specifier, await import(specifier))
  return addons
}

/** The app's files at one revision, read through git; the working tree when none is named. */
function sourceReader(rev) {
  if (!rev) {
    return {
      exists: (relative) => fs.existsSync(path.join(APP_ROOT, relative)),
      read: (relative) => fs.readFileSync(path.join(APP_ROOT, relative), 'utf8'),
      label: 'working tree',
    }
  }
  const top = execFileSync('git', ['-C', APP_ROOT, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const prefix = path.relative(top, APP_ROOT).split(path.sep).join('/')
  const commit = execFileSync('git', ['-C', APP_ROOT, 'rev-parse', '--verify', `${rev}^{commit}`], { encoding: 'utf8' }).trim()
  const listed = new Set(execFileSync('git', ['-C', top, 'ls-tree', '-r', '--name-only', commit, '--', `${prefix}/src`], { encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\n').filter(Boolean).map((file) => file.slice(prefix.length + 1)))
  return {
    exists: (relative) => listed.has(relative),
    read: (relative) => execFileSync('git', ['-C', APP_ROOT, 'show', `${commit}:${prefix}/${relative}`], { encoding: 'utf8', maxBuffer: 1 << 28 }),
    label: commit,
  }
}

/**
 * A loader over the app's sources.
 *   rev        a git revision to read the sources at (default: the working tree)
 *   stand      { 'src/.../module.ts': exportsObject } modules stood in for, by path
 *   quiet      drop the modules' console.warn lines (the rail proof reports on it)
 */
export async function createLoader({ rev = '', stand = {}, quiet = true } = {}) {
  const known = await loadAddons()
  const reader = sourceReader(rev)
  const cache = new Map()
  const opened = new Map()
  const source = (relative) => {
    const text = reader.read(relative)
    if (!opened.has(relative)) opened.set(relative, { file: relative, sha256: sha256(text), bytes: Buffer.byteLength(text) })
    return text
  }
  const asJson = (relative) => { const value = JSON.parse(source(relative)); return { ...value, default: value } }
  const consoleOut = quiet ? { ...console, warn: () => {}, log: () => {} } : console
  function load(relative) {
    if (stand[relative]) return stand[relative]
    if (cache.has(relative)) return cache.get(relative)
    const module = { exports: {} }
    cache.set(relative, module.exports)
    const compiled = ts.transpileModule(source(relative), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const require = (specifier) => {
      if (specifier === 'three/tsl') return TSL
      if (specifier === 'three' || specifier === 'three/webgpu') return THREE
      if (known.has(specifier)) return known.get(specifier)
      if (!specifier.startsWith('.')) throw new Error(`Unexpected import: ${specifier} in ${relative}`)
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier))
      if (resolved.endsWith('?raw')) return { default: source(resolved.slice(0, -4)) }
      if (resolved.endsWith('.json')) return asJson(resolved)
      if (stand[resolved + '.ts']) return stand[resolved + '.ts']
      const file = reader.exists(resolved + '.ts') ? resolved + '.ts'
        : reader.exists(resolved + '.json') ? resolved + '.json' : resolved + '/index.ts'
      if (file.endsWith('.json')) return asJson(file)
      return load(file)
    }
    vm.runInNewContext(compiled, {
      module, exports: module.exports, require, console: consoleOut,
      matchMedia: () => ({ matches: false }), performance, URL, URLSearchParams,
      location: { search: '' }, crypto: globalThis.crypto, TextEncoder: globalThis.TextEncoder,
    }, { filename: relative })
    return module.exports
  }
  return {
    load,
    /** a data file as text, recorded like a module */
    text: source,
    revision: reader.label,
    /** every file opened so far, sorted, with its hash */
    sources: () => [...opened.values()].sort((a, b) => (a.file < b.file ? -1 : 1)),
  }
}

export const WING_DIR = 'src/wings/vinci'
export const CERTIFICATE_FILE = `${WING_DIR}/data/rail-clearance.json`
