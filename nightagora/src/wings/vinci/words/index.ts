import {
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
    const geometry = new TextGeometry(line, {
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

export interface InscriptionOptions {
  surface?: Material
  ink?: Material
  width?: number
  height?: number
  size?: number
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
  const body = available && raw ? createText(raw, {
    size: options.size ?? .32,
    maxWidth: width - margin * 2,
    lineHeight: 1.43,
    depth: .002,
    material: ink,
  }) : null
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
  // Chisel runs are concentrated along two margins. Sparse gaps and varied
  // run lengths keep the face from becoming a regular decorative pattern.
  for (const side of [-1, 1]) for (let i = 0; i < 11; i++) {
    const key = i + (side === 1 ? 40 : 1)
    if (side === 1 && i % 3 === 0) continue
    cavity(side * (hw - .15 - seed(key) * .032),
      -hh + .34 + i * (height - .75) / 10 + (seed(key + 3) - .5) * .035,
      .004 + seed(key + 8) * .003,
      .025 + seed(key + 16) * .027,
      (seed(key + 22) - .5) * .36)
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
  const faceGeometry = new ExtrudeGeometry(face, { depth: .024, bevelEnabled: false, curveSegments: 4, steps: 1 })
  faceGeometry.translate(0, 0, -.024)
  const dressedFace = new Mesh(faceGeometry, surface)
  dressedFace.name = 'Dressed tuffeau face with marginal chisel cuts and pores'
  dressedFace.castShadow = true
  dressedFace.receiveShadow = true
  dressedFace.userData.asset = 'vinci/bench-inscription-carrier'
  group.add(dressedFace)
  geometries.push(faceGeometry)

  // A dressed, stepped edge belongs to the same stone, not a floating label.
  const edgeParts: BufferGeometry[] = []
  for (const side of [-1, 1]) {
    const vertical = new BoxGeometry(.016, height - .19, .012)
    vertical.translate(side * (width / 2 - .088), 0, -.001)
    edgeParts.push(vertical)
    const horizontal = new BoxGeometry(width - .19, .016, .012)
    horizontal.translate(0, side * (height / 2 - .088), -.001)
    edgeParts.push(horizontal)
  }
  const edgeGeometry = mergeGeometries(edgeParts, false)!
  edgeParts.forEach(g => g.dispose())
  const edge = new Mesh(edgeGeometry, surface)
  edge.castShadow = true
  group.add(edge)
  geometries.push(edgeGeometry)

  if (body) {
    // Hero and source share the stone. Ink has an actual side wall and receives
    // the room light, with neither a plane nor a text texture behind it.
    const top = Math.min(height / 2 - .48, body.height / 2 + .24)
    body.mesh.castShadow = true
    // Keep the hero's real shadow separate from the much smaller siglum:
    // the integrating weld batches by material and would otherwise inherit it.
    body.mesh.userData.noWeld = true
    body.mesh.position.set(-width / 2 + margin, top, .0004)
    group.add(body.mesh)
    geometries.push(body.mesh.geometry)
    const source = createText(passage.folio_siglum, {
      size: .115,
      maxWidth: width - margin * 2,
      depth: .0009,
      material: ink,
    })
    source.mesh.position.set(-width / 2 + margin, Math.min(top - body.height - .38, -height / 2 + .53), .0004)
    group.add(source.mesh)
    geometries.push(source.mesh.geometry)
  }
  const reason = available ? undefined : raw === null ? passage.de_status : passage.folio_notes
  group.userData = {
    asset: 'vinci/bench-inscription-carrier',
    inscription: { id, language, text: raw, siglum: passage.folio_siglum, available, reason },
    source: 'brief/collection/inscriptions.json',
    carrier: 'GENERATED modern exhibition stone; no claim to a surviving Leonardo inscription',
  }
  return {
    group, width, height, passage, text: raw, siglum: passage.folio_siglum, available, reason,
    dispose() { geometries.forEach(g => g.dispose()); ownedMaterials.forEach(m => m?.dispose()) },
  }
}
