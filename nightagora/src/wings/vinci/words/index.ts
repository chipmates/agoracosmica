import {
  Vector2,
  BoxGeometry,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshStandardNodeMaterial,
  Path,
  Shape,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import catalogue from './data/inscriptions.json'
import { assertGlyphs, font, textAdvance } from './font'

/** The advance of one unwrapped line at a given cap height, in metres. */
export const lineAdvance = (text: string, size: number): number => textAdvance(text, size)

export type InscriptionLanguage = 'en' | 'de'
export type InscriptionPassage = (typeof catalogue.passages)[number]
export const passages: readonly InscriptionPassage[] = catalogue.passages

export interface TextOptions {
  /** Cap height in metres; diacritics and descenders extend beyond this. */
  size: number
  maxWidth?: number
  material: Material
  /** Physical extrusion, in metres. */
  depth?: number
  /** Baseline distance as a multiple of cap height. Default 1.40. */
  lineHeight?: number
  /** Small bevel for a hero inscription; normally omitted on tiny lettering. */
  bevel?: number
  /** Omit only the invisible back cap when ink is bonded to a carrier. */
  embedded?: boolean
}

export interface PhysicalText {
  /** One draw, local XY, facing +Z, with top-left at (0,0). Descends along -Y. */
  mesh: Mesh<BufferGeometry, Material>
  /** Measured geometry bounds, not a character-count estimate. */
  width: number
  height: number
  lines: string[]
  lineWidths: number[]
  /** Actual cap height after the single-overlong-word safeguard. */
  size: number
  dispose(): void
}

function wrap(text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue }
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (line && textAdvance(candidate, size) > maxWidth) {
        lines.push(line)
        line = word
      } else line = candidate
    }
    lines.push(line)
  }
  return lines
}

function withoutBackCaps(geometry: BufferGeometry): BufferGeometry {
  const source = geometry.index ? geometry.toNonIndexed() : geometry
  const normal = source.getAttribute('normal')
  if (!normal) return source
  const keep: number[] = []
  for (let i = 0; i < normal.count; i += 3) {
    if (!(normal.getZ(i) < -.999 && normal.getZ(i+1) < -.999 && normal.getZ(i+2) < -.999)) keep.push(i,i+1,i+2)
  }
  const result = new BufferGeometry()
  for (const name of ['position','normal','uv']) {
    const attr = source.getAttribute(name)
    if (!attr) continue
    const values = new Float32Array(keep.length * attr.itemSize)
    for(let i=0;i<keep.length;i++){
      const from=keep[i]!,to=i*attr.itemSize
      values[to]=attr.getX(from);values[to+1]=attr.getY(from)
      if(attr.itemSize>2)values[to+2]=attr.getZ(from)
    }
    result.setAttribute(name,new Float32BufferAttribute(values,attr.itemSize))
  }
  geometry.dispose();if(source!==geometry)source.dispose()
  return result
}

/** Geometry-only text. Reflow changes whitespace; spelling, case and
 * punctuation stay untouched. The unmodified source stays in userData.text. */
export function createText(text: string, opts: TextOptions): PhysicalText {
  assertGlyphs(text)
  if (!Number.isFinite(opts.size) || opts.size <= 0) throw new Error('Text size must be positive')
  if (opts.maxWidth !== undefined && (!Number.isFinite(opts.maxWidth) || opts.maxWidth <= 0)) {
    throw new Error('Text maxWidth must be positive')
  }
  const maxWidth = opts.maxWidth ?? Infinity
  const longest = Math.max(1e-9, ...text.split(/\s+/).map(word => textAdvance(word, opts.size)))
  const size = opts.size * Math.min(1, maxWidth / longest)
  const lines = wrap(text, size, maxWidth)
  const parts: BufferGeometry[] = []
  const lineWidths: number[] = []
  const lineHeight = size * (opts.lineHeight ?? 1.40)
  for (const [i, line] of lines.entries()) {
    if (!line.trim()) { lineWidths.push(0); continue }
    const extruded = new TextGeometry(line, {
      font,
      size,
      depth: opts.depth ?? .0015,
      curveSegments: 4,
      steps: 1,
      bevelEnabled: (opts.bevel ?? 0) > 0,
      bevelSize: opts.bevel ?? 0,
      bevelThickness: opts.bevel ?? 0,
      bevelSegments: 1,
    })
    const geometry = opts.embedded ? withoutBackCaps(extruded) : extruded
    geometry.clearGroups()
    geometry.computeBoundingBox()
    lineWidths.push(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x)
    geometry.translate(0, -i * lineHeight, 0)
    parts.push(geometry)
  }
  const geometry = parts.length ? mergeGeometries(parts, false)! : new BufferGeometry()
  for (const part of parts) part.dispose()
  if (!parts.length) geometry.setAttribute('position', new Float32BufferAttribute([], 3))
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox!
  const width = parts.length ? bounds.max.x - bounds.min.x : 0
  const height = parts.length ? bounds.max.y - bounds.min.y : 0
  if (parts.length) geometry.translate(-bounds.min.x, -bounds.max.y, 0)
  const mesh = new Mesh(geometry, opts.material)
  mesh.name = `physical-text:${text.slice(0, 48)}`
  mesh.castShadow = false
  mesh.receiveShadow = true
  mesh.userData = { text, lines, physicalLettering: true, asset: 'vinci/bench-vector-letters' }
  return { mesh, width, height, lines, lineWidths, size, dispose: () => geometry.dispose() }
}

/** A rectangle of stone left standing between cut letters, in panel space. */
export interface WebRect { x: number; y: number; w: number; h: number }

interface CutGlyph { outer: Vector2[]; counters: Vector2[][] }

/** Where one simple polygon covers a scanline, as sorted x intervals. */
function spansAt(points: Vector2[], y: number): [number, number][] {
  const crossings: number[] = []
  for (let i = 0, n = points.length; i < n; i++) {
    const a = points[i]!, b = points[(i + 1) % n]!
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      crossings.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x))
    }
  }
  crossings.sort((p, q) => p - q)
  const spans: [number, number][] = []
  for (let i = 0; i + 1 < crossings.length; i += 2) spans.push([crossings[i]!, crossings[i + 1]!])
  return spans
}

function subtract(spans: [number, number][], cuts: [number, number][]): [number, number][] {
  let out = spans
  for (const [c0, c1] of cuts) {
    const next: [number, number][] = []
    for (const [s0, s1] of out) {
      if (c1 <= s0 || c0 >= s1) { next.push([s0, s1]); continue }
      if (c0 > s0) next.push([s0, c0])
      if (c1 < s1) next.push([c1, s1])
    }
    out = next
  }
  return out
}

function merge(spans: [number, number][]): [number, number][] {
  if (!spans.length) return spans
  const sorted = [...spans].sort((a, b) => a[0] - b[0])
  const out: [number, number][] = [sorted[0]!]
  for (const span of sorted.slice(1)) {
    const last = out[out.length - 1]!
    if (span[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], span[1])
    else out.push([span[0], span[1]])
  }
  return out
}

/** The union of every glyph on one scanline: inside an outer contour and
 * outside that glyph's own counters. A stroke alphabet overlaps itself, so
 * the union is taken here in one dimension rather than by polygon boolean. */
function lettersAt(glyphs: CutGlyph[], y: number): [number, number][] {
  const spans: [number, number][] = []
  for (const glyph of glyphs) {
    const outer = spansAt(glyph.outer, y)
    if (!outer.length) continue
    const counters: [number, number][] = []
    for (const counter of glyph.counters) counters.push(...spansAt(counter, y))
    spans.push(...subtract(outer, merge(counters)))
  }
  return merge(spans)
}

/** The stone that is NOT letter, as rows of rectangles. Rows whose gaps
 * repeat are merged, so a stem costs one rectangle and not one per band. */
export function stoneWeb(
  field: { x0: number; y0: number; x1: number; y1: number },
  glyphs: CutGlyph[],
  band: number,
  /** Widen the opening by this much, for the splayed mouth of the cut. */
  grow = 0,
): WebRect[] {
  const rows = Math.max(1, Math.round((field.y1 - field.y0) / band))
  const step = (field.y1 - field.y0) / rows
  const rects: WebRect[] = []
  let open: { y0: number; y1: number; gaps: [number, number][] } | undefined
  const flush = () => {
    if (!open) return
    let x = field.x0
    for (const [g0, g1] of open.gaps) {
      if (g0 - x > 0.0008) rects.push({ x, y: open.y0, w: g0 - x, h: open.y1 - open.y0 })
      x = Math.max(x, g1)
    }
    if (field.x1 - x > 0.0008) rects.push({ x, y: open.y0, w: field.x1 - x, h: open.y1 - open.y0 })
    open = undefined
  }
  for (let i = 0; i < rows; i++) {
    const y0 = field.y0 + i * step, y1 = y0 + step
    // Three scanlines per band, unioned: a letter is never under-cut.
    const at = (y: number) => lettersAt(glyphs, y).map(([a, b]) => [a - grow, b + grow] as [number, number])
    const gaps = merge(grow > 0
      ? [...at(y0 - grow), ...at(y0 + step * .02), ...at((y0 + y1) / 2), ...at(y1 - step * .02), ...at(y1 + grow)]
      : [...at(y0 + step * .02), ...at((y0 + y1) / 2), ...at(y1 - step * .02)])
    const same = open && open.gaps.length === gaps.length && open.gaps.every((g, n) => Math.abs(g[0] - gaps[n]![0]) < 0.0016 && Math.abs(g[1] - gaps[n]![1]) < 0.0016)
    if (same && open) open.y1 = y1
    else { flush(); open = { y0, y1, gaps } }
  }
  flush()
  return rects
}

/** The web as surfaces, not solids: a front face and the two side walls that
 * make a letter's flanks. A closed box would double the triangle count for
 * faces that are either internal or half a pixel tall. */
function webSurface(courses: { rects: WebRect[]; front: number; depth: number }[]): BufferGeometry {
  let count = 0
  for (const course of courses) count += course.rects.length * 18
  const position = new Float32Array(count * 3)
  const normal = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  let v = 0
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    position[v * 3] = x; position[v * 3 + 1] = y; position[v * 3 + 2] = z
    normal[v * 3] = nx; normal[v * 3 + 1] = ny; normal[v * 3 + 2] = nz
    uv[v * 2] = x; uv[v * 2 + 1] = y
    v++
  }
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]) => {
    for (const p of [a, b, c, a, c, d]) put(p[0]!, p[1]!, p[2]!, n[0]!, n[1]!, n[2]!)
  }
  for (const course of courses) {
    const back = course.front - course.depth
    for (const r of course.rects) {
      const x0 = r.x, x1 = r.x + r.w, y0 = r.y, y1 = r.y + r.h, z = course.front
      quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1])
      quad([x0, y0, back], [x0, y0, z], [x0, y1, z], [x0, y1, back], [-1, 0, 0])
      quad([x1, y0, z], [x1, y0, back], [x1, y1, back], [x1, y1, z], [1, 0, 0])
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return geometry
}

/** Every glyph of a wrapped passage, in panel space, top-left at (0,0). */
export function cutGlyphs(text: string, size: number, maxWidth: number, lineHeight: number): { glyphs: CutGlyph[]; lines: string[]; width: number; height: number } {
  assertGlyphs(text)
  const longest = Math.max(1e-9, ...text.split(/\s+/).map(word => textAdvance(word, size)))
  const cap = size * Math.min(1, maxWidth / longest)
  const lines = wrap(text, cap, maxWidth)
  const step = cap * lineHeight
  const glyphs: CutGlyph[] = []
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  lines.forEach((line, index) => {
    if (!line.trim()) return
    for (const shape of font.generateShapes(line, cap)) {
      const points = shape.extractPoints(4)
      const move = (list: Vector2[]) => list.map(p => new Vector2(p.x, p.y - index * step))
      const outer = move(points.shape)
      for (const p of outer) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      glyphs.push({ outer, counters: points.holes.map(move) })
    }
  })
  if (!glyphs.length) return { glyphs, lines, width: 0, height: 0 }
  for (const glyph of glyphs) {
    for (const p of glyph.outer) { p.x -= minX; p.y -= maxY }
    for (const counter of glyph.counters) for (const p of counter) { p.x -= minX; p.y -= maxY }
  }
  return { glyphs, lines, width: maxX - minX, height: maxY - minY }
}

export interface InscriptionOptions {
  surface?: Material
  ink?: Material
  width?: number
  height?: number
  size?: number
  /** Cut the folio siglum under the passage. A citation on an exhibit is the
   * record in the label's place, so a museum host passes false and prints the
   * siglum in its record instead. Standalone use keeps it. */
  siglum?: boolean
}

export interface Inscription {
  group: Group
  width: number
  height: number
  passage: InscriptionPassage
  /** Raw text_en/text_de from the locked JSON. Never display_text_en/de. */
  text: string | null
  siglum: string
  available: boolean
  /** Catalogue wording: never a substituted English quotation in a DE state. */
  reason?: string
  dispose(): void
}

// The bench normally supplies its shared limestone; this standalone fallback
// remains a fully procedural surface with three scales and distance thinning.
function defaultStone(): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial({ color: new Color('#b9ad91'), roughness: .91 })
  const { positionWorld, cameraPosition, mx_noise_float, mix, vec3, smoothstep, float } = TSL
  const density = float(1).sub(smoothstep(4, 18, positionWorld.distance(cameraPosition)))
  const macro = mx_noise_float(positionWorld.mul(.7)).mul(.5).add(.5)
  const mid = mx_noise_float(positionWorld.mul(13)).mul(.5).add(.5)
  const fine = mx_noise_float(positionWorld.mul(180)).mul(.5).add(.5)
  const base = new Color('#b9ad91'), dark = new Color('#8d846e')
  mat.colorNode = mix(vec3(base.r, base.g, base.b), vec3(dark.r, dark.g, dark.b), macro.mul(.34).add(mid.mul(.13)).add(fine.mul(density).mul(.07)))
  mat.roughnessNode = float(.84).add(fine.mul(density).mul(.14))
  return mat
}

/** One original passage on one masonry surface. Centre the group where the
 * wall belongs; its face is at z=0 and its thickness occupies -0.30..0. */
export function createInscription(
  id = 'richter-498',
  language: InscriptionLanguage = 'en',
  options: InscriptionOptions = {},
): Inscription {
  const passage = passages.find(p => p.id === id)
  if (!passage) throw new Error(`Unknown inscription ${id}`)
  const raw = language === 'de' ? passage.text_de : passage.text_en
  const ready = language === 'de' ? passage.display_ready_de : passage.display_ready_en
  const available = raw !== null && ready
  const group = new Group()
  group.name = `vinci-inscription:${id}:${language}`
  const width = options.width ?? 4.8
  const surface = options.surface ?? defaultStone()
  const ink = options.ink ?? new MeshStandardNodeMaterial({ color: '#27261f', roughness: .9 })
  const ownedMaterials = [!options.surface ? surface : null, !options.ink ? ink : null]
  const geometries: BufferGeometry[] = []
  const margin = Math.min(.52, width * .11)
  // The quotation is CUT, not printed: the dressed face opens over the text
  // field, the stone web between the letters is rebuilt at the face level, and
  // what shows through every letter is the pigment lying 12 mm down the cut.
  // A stroke alphabet's glyphs overlap themselves, so the web is solved on
  // scanlines rather than by a polygon boolean the stack does not carry.
  const cutSize = options.size ?? .32
  const cut = available && raw ? cutGlyphs(raw, cutSize, width - margin * 2, 1.43) : null
  const body = cut && cut.glyphs.length ? cut : null
  // A longer passage needs more stone, not progressively smaller words.
  const height = Math.max(options.height ?? 3.25, (body?.height ?? 0) + 1.45)
  const carrierGeometry = new RoundedBoxGeometry(width, height, .286, 2, .035)
  const carrier = new Mesh(carrierGeometry, surface)
  carrier.position.z = -.157
  carrier.castShadow = true
  carrier.receiveShadow = true
  carrier.name = 'Tuffeau inscription carrier — modern exhibition surface'
  carrier.userData.asset = 'vinci/bench-inscription-carrier'
  group.add(carrier)
  geometries.push(carrierGeometry)

  // The dressed front is real stone with cut voids. The carrier behind it
  // closes each void 14 mm below the face, so a mark is a small cavity and
  // takes the room's light rather than being a dark mark painted on a plane.
  const hw = width / 2 - .035, hh = height / 2 - .035, corner = .018
  const face = new Shape()
  face.moveTo(-hw + corner, -hh)
  face.lineTo(hw - corner, -hh)
  face.quadraticCurveTo(hw, -hh, hw, -hh + corner)
  face.lineTo(hw, hh - corner)
  face.quadraticCurveTo(hw, hh, hw - corner, hh)
  face.lineTo(-hw + corner, hh)
  face.quadraticCurveTo(-hw, hh, -hw, hh - corner)
  face.lineTo(-hw, -hh + corner)
  face.quadraticCurveTo(-hw, -hh, -hw + corner, -hh)
  const seed = (n: number) => { const x = Math.sin(n * 71.713 + 3.17) * 43758.5453; return x - Math.floor(x) }
  const cavity = (x: number, y: number, rx: number, ry: number, angle: number) => {
    const hole = new Path()
    hole.absellipse(x, y, rx, ry, 0, Math.PI * 2, true, angle)
    face.holes.push(hole)
  }
  // Small open pores live near the upper and lower edge, away from the
  // quotation and siglum. No hole overlaps another or removes source text.
  for (const side of [-1, 1]) for (let i = 0; i < 17; i++) {
    const key = 80 + i + (side === 1 ? 30 : 0)
    if (seed(key) < .27) continue
    cavity(-hw + .35 + i * (width - .77) / 16,
      side * (hh - .19 - seed(key + 2) * .07),
      .004 + seed(key + 4) * .006,
      .005 + seed(key + 7) * .004,
      seed(key + 9) * Math.PI)
  }

  let webRects = 0
  if (body) {
    // With the citation in the record, the quotation is the whole face and
    // centres on it; with a siglum below, it sits up to leave that room.
    const top = (options.siglum ?? true) ? Math.min(height / 2 - .48, body.height / 2 + .24) : body.height / 2
    const left = -width / 2 + margin
    const pad = cutSize * .30
    const field = { x0: left - pad, x1: left + body.width + pad, y0: top - body.height - pad, y1: top + pad }
    // The opening and the web share an edge exactly, so nothing shows there.
    const inset = 0
    const opening = new Path()
    opening.moveTo(field.x0 + inset, field.y0 + inset)
    opening.lineTo(field.x1 - inset, field.y0 + inset)
    opening.lineTo(field.x1 - inset, field.y1 - inset)
    opening.lineTo(field.x0 + inset, field.y1 - inset)
    opening.closePath()
    face.holes.push(opening)
    const placed = body.glyphs.map(glyph => ({
      outer: glyph.outer.map(p => new Vector2(p.x + left, p.y + top)),
      counters: glyph.counters.map(c => c.map(p => new Vector2(p.x + left, p.y + top))),
    }))
    // Two courses of web: the mouth of the cut is splayed 3.5 mm wider than
    // its walls, so every letter keeps a narrow ledge that takes the light
    // while the wall under it stays in shadow. That pair is what says cut.
    const band = Math.max(.0022, cutSize * .012)
    const web = stoneWeb(field, placed, band, .0035)
    const walls = stoneWeb(field, placed, band)
    webRects = web.length + walls.length
    const webGeometry = webSurface([
      { rects: web, front: -.002, depth: .005 },
      { rects: walls, front: -.0068, depth: .009 },
    ])
    const webMesh = new Mesh(webGeometry, surface)
    webMesh.name = 'Stone left standing between the cut letters'
    webMesh.castShadow = true
    webMesh.receiveShadow = true
    webMesh.userData.asset = 'vinci/bench-inscription-carrier'
    group.add(webMesh)
    geometries.push(webGeometry)
    // The pigment in the cut, twelve millimetres down, is what a reader sees.
    const floorGeometry = new BoxGeometry(field.x1 - field.x0, field.y1 - field.y0, .003)
    floorGeometry.translate((field.x0 + field.x1) / 2, (field.y0 + field.y1) / 2, -.0135)
    const floor = new Mesh(floorGeometry, ink)
    floor.name = 'Pigment at the bottom of the cut'
    floor.receiveShadow = true
    floor.userData.asset = 'vinci/bench-inscription-carrier'
    group.add(floor)
    geometries.push(floorGeometry)
    if (options.siglum ?? true) {
      const source = createText(passage.folio_siglum, {
        embedded: true,
        size: .135,
        maxWidth: width - margin * 2,
        depth: .0009,
        material: ink,
      })
      source.mesh.position.set(-width / 2 + margin, Math.min(top - body.height - .38, -height / 2 + .53), .0004)
      group.add(source.mesh)
      geometries.push(source.mesh.geometry)
    }
  }
  // The face is extruded last: the text field is one of its openings.
  // No chamfer: the text field is an opening in this face and the web fills it
  // exactly. A flare of any size leaves a lit hairline round the field, which
  // reads as a frame nobody drew.
  const faceGeometry = new ExtrudeGeometry(face, { depth: .024, bevelEnabled: false, curveSegments: 4, steps: 1 })
  faceGeometry.translate(0, 0, -.026)
  const dressedFace = new Mesh(faceGeometry, surface)
  dressedFace.name = 'Dressed tuffeau face with quiet marginal pores'
  dressedFace.castShadow = true
  dressedFace.receiveShadow = true
  dressedFace.userData.asset = 'vinci/bench-inscription-carrier'
  group.add(dressedFace)
  geometries.push(faceGeometry)

  const reason = available ? undefined : raw === null ? passage.de_status : passage.folio_notes
  group.userData = {
    asset: 'vinci/bench-inscription-carrier',
    inscription: { id, language, text: raw, siglum: passage.folio_siglum, available, reason },
    source: 'brief/collection/inscriptions.json',
    carrier: 'GENERATED modern exhibition stone; no claim to a surviving Leonardo inscription',
    lettering: { kind: 'cut', depthMm: 12, webRects },
  }
  return {
    group, width, height, passage, text: raw, siglum: passage.folio_siglum, available, reason,
    dispose() { geometries.forEach(g => g.dispose()); ownedMaterials.forEach(m => m?.dispose()) },
  }
}
