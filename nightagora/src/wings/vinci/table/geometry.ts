import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardNodeMaterial, PlaneGeometry, TorusGeometry, Vector2, Vector3, type Material, type Texture } from 'three/webgpu'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { attribute, color, float, mix, mx_noise_float, positionLocal, positionWorld, smoothstep, uv, vec3 } from 'three/tsl'
import type { Stack } from '../../../stack'
import { createMaterialLibrary } from '../../../stack/materials'
import { textBlockGeometry } from './text-block'
import { roundedBoardGeometry } from './binding-geometry'

/** Exhibition reference, in metres. The source map has no physical dimensions.
 * The complete 1883 plate is contained within this approximate Ms B extent. */
export const LEAF = { width: 0.16, height: 0.23, source: 'brief/COMMISSION.md: approximate Ms B leaf size', approximate: true } as const
export const PAGE_Y = 0.031

/** A bent ribbon integrated along its cross-section, with a 16 cm reference
 * arc. A changing local tangent bends the sheet, rather than rotating a card.
 * A 0.7 mm rest cockle keeps every sampled turn non-planar, including endpoints. */
export function leafGeometry(): BufferGeometry {
  const g = new PlaneGeometry(LEAF.width, LEAF.height, 64, 20)
  bendLeaf(g, 0, 1)
  return g
}

export function bendLeaf(g: BufferGeometry, progress: number, direction: number, thickness = 0.016): void {
  const p = Math.max(0, Math.min(1, progress))
  const a = p * Math.PI
  const pos = g.getAttribute('position') as BufferAttribute
  const uvs = g.getAttribute('uv') as BufferAttribute
  const wave = Math.sin(p * Math.PI)
  const xx: number[] = [0], yy: number[] = [0]
  for (let i = 1; i <= 64; i++) {
    const s = (i - 0.5) / 64
    const theta = a + wave * (0.68 * Math.sin(s * Math.PI * 1.2) - 0.24)
    xx.push((xx[i - 1] ?? 0) + Math.cos(theta) * LEAF.width / 64)
    yy.push((yy[i - 1] ?? 0) + Math.sin(theta) * LEAF.width / 64)
  }
  for (let i = 0; i < pos.count; i++) {
    const u = uvs.getX(i), v = uvs.getY(i)
    const at = Math.round(u * 64)
    const cockle = 0.0007 * Math.sin(u * 8.4 + v * 4.1) * u
    const gutter = -thickness * (u < 0.5 ? 0.16 : 0.075) * (u * 2 - 1) ** 2
    pos.setXYZ(i, direction * ((xx[at] ?? 0) + 0.003), PAGE_Y + (yy[at] ?? 0) + cockle + gutter,
      (0.5 - v) * LEAF.height + wave * 0.007 * Math.sin(u * Math.PI) * (v - 0.5))
  }
  // Offsets alter the integrated arc. Normalize the completed 3D cross-section
  // around its unchanged gutter root at every pose. This preserves the
  // requested arc while keeping the section-dependent crown and cockle.
  // Moving and receiving sheets use the same endpoint construction.
  const correction = 1
  for (let first = 0; first < pos.count; first += 65) {
    const rootX = pos.getX(first), rootY = pos.getY(first), rootZ = pos.getZ(first)
    let length = 0
    for (let i = first + 1; i < first + 65; i++) length += Math.hypot(
      pos.getX(i) - pos.getX(i - 1), pos.getY(i) - pos.getY(i - 1), pos.getZ(i) - pos.getZ(i - 1))
    const scale = 1 + (LEAF.width / length - 1) * correction
    for (let i = first + 1; i < first + 65; i++) pos.setXYZ(i,
      rootX + (pos.getX(i) - rootX) * scale,
      rootY + (pos.getY(i) - rootY) * scale,
      rootZ + (pos.getZ(i) - rootZ) * scale)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  g.computeBoundingSphere()
}

function stamp(object: Mesh | Group, id: string): void {
  object.userData['manifestId'] = `vinci/table-${id}`
  object.userData['assetClass'] = 'GENERATED'
}

/** Padded modern support, retaining the original bounds. The addon's six
 * face charts are measured in metres along their rounded surfaces, so linen
 * wraps down the sides instead of stretching a top-down map into stripes. */
export function linenSupportGeometry(width: number, height: number, depth: number): BufferGeometry {
  const radius = Math.min(0.0025, height * 0.35)
  const rounded = new RoundedBoxGeometry(width, height, depth, 3, radius)
  const texcoords = rounded.getAttribute('uv') as BufferAttribute
  const span = (length: number) => length - 2 * radius + Math.PI * radius / 2
  for (const group of rounded.groups) {
    const side = group.materialIndex ?? 0
    const u = span(side < 2 ? depth : width)
    const v = span(side < 2 || side > 3 ? height : depth)
    for (let i = group.start; i < group.start + group.count; i++) {
      texcoords.setXY(i, texcoords.getX(i) * u, texcoords.getY(i) * v)
    }
  }
  const geometry = mergeVertices(rounded, 1e-7)
  rounded.dispose()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function buildFurniture(stack: Stack) {
  // Carrier maps use the existing library's compact one-map profile. Three
  // scales of procedural detail remain at every tier, including calm.
  const library = createMaterialLibrary({ ...stack.tierConfig(), detail: 1 })
  let carrierDisposed = false
  const carrierTextures = new Set<Texture>()
  const closedImages = new WeakSet<object>()
  function closeImage(image: unknown): void {
    if (!image || typeof image !== 'object' || !('close' in image) || typeof image.close !== 'function' || closedImages.has(image)) return
    closedImages.add(image)
    image.close()
  }
  function carrierSet(name: string) {
    const set = library.sync(name)
    const maps = set.maps
    if (!maps) return set
    // r185 keeps the GPU allocation of an ordinary texture when its image
    // changes. A rendered 1px placeholder would therefore stay a 1px map
    // after decode. Allocate the admitted 1024px extent BEFORE any draw;
    // the library's ready uniform still masks its pixels until they arrive.
    const placeholder = maps.albedo.image
    if (placeholder instanceof HTMLCanvasElement) {
      placeholder.width = placeholder.height = maps.size
      const context = placeholder.getContext('2d')
      if (context) {
        context.fillStyle = 'rgb(128,128,128)'
        context.fillRect(0, 0, maps.size, maps.size)
      }
      maps.albedo.needsUpdate = true
    }
    for (const map of [maps.albedo, maps.normal, maps.surface]) {
      if (carrierTextures.has(map)) continue
      carrierTextures.add(map)
      // The shared loader has no abort handle. Keep Texture.image's normal
      // source-data semantics, but close a late bitmap immediately when
      // this carrier has already left the scene. No timer or second fetch.
      Object.defineProperty(map, 'image', {
        configurable: true,
        get: () => map.source.data,
        set: (image: unknown) => {
          map.source.data = image
          if (carrierDisposed) {
            closeImage(image)
            map.dispose()
          }
        },
      })
    }
    return set
  }
  const object = new Group()
  object.name = 'vinci-reading-table'
  stamp(object, 'furniture')
  const wood = new MeshStandardNodeMaterial({ color: '#65503a', roughness: 0.72 })
  wood.colorNode = color('#514532')
  stack.detail(wood, carrierSet('oak-planks-worn'), { count: 3, scales: [0.48, 0.025, 0.0007], fade: [0.65, 2.6], mid: 0.12, macro: 0.35, maps:0.72 })
  wood.roughnessNode = float(0.86).add(mx_noise_float(positionWorld.mul(1900)).mul(0.035))
  // A lamp pool dims the surrounding carrier; the facsimile is never tinted.
  const pool = float(1).sub(smoothstep(0.12, 0.65, positionWorld.xz.sub(vec3(-0.08, 0, -0.06).xz).length()))
  wood.colorNode = wood.colorNode!.mul(pool.mul(0.82).add(0.18))
  const leather = new MeshStandardNodeMaterial({ color: '#332119', roughness: 0.69 })
  leather.colorNode = color('#332119')
  const leatherSet = carrierSet('leather-worn')
  stack.detail(leather, {...leatherSet, grain:leatherSet.grain ? {...leatherSet.grain, relief:0.035, pitch:0.035, fold:0.15, tooth:0.0006, sheen:0.1} : null}, { count: 3, scales: [0.24, 0.012, 0.0004], fade: [0.7, 2.0], mid: 0.04, macro: 0.25 })
  const toolingDistance = positionWorld.x.abs().sub(0.074).max(positionWorld.z.abs().sub(0.1085)).abs()
  const tooling = float(1).sub(smoothstep(0.00018,0.0007,toolingDistance)).mul(smoothstep(0.038,0.040,positionWorld.y))
  leather.colorNode = leather.colorNode!.mul(float(1).sub(tooling.mul(0.16)))
  leather.roughnessNode = float(0.81).add(mx_noise_float(positionWorld.mul(2300)).mul(0.035)).sub(tooling.mul(0.08))
  const paper = new MeshStandardNodeMaterial({ color: '#b39b73', roughness: 0.91 })
  const grain = mx_noise_float(positionWorld.mul(vec3(240, 100, 120)))
  const broadPaper = mx_noise_float(positionWorld.mul(vec3(8,50,10))).mul(0.035)
  const finePaper = mx_noise_float(positionWorld.mul(vec3(4800,12000,2600))).mul(0.015)
  paper.colorNode = color('#baa780').mul(grain.mul(0.022).add(broadPaper).add(finePaper).add(0.94))
  const linen = new MeshStandardNodeMaterial({ color: '#625e4c', roughness: 0.96 })
  linen.colorNode = color('#625e4c')
  const linenSet = carrierSet('linen')
  // Pin the admitted tile extent before the synchronous node graph is built:
  // library/linen records 0.271 m, while the loader initially holds 1 m.
  // Its existing mipmapped albedo carries the approximately 0.7 mm weave.
  linenSet.scale = [0.271, 0.271]
  const linenDetail = stack.detail(linen, {
    ...linenSet,
    grain: linenSet.grain ? {
      ...linenSet.grain, relief: 0.025, pitch: 0.016, fold: 0.09, tooth: 0, sheen: 0.02,
    } : null,
  }, {
    count: 3, scales: [0.15, 0, 0.0004], fade: [0.5, 1.8],
    // Keep broad variation and slubs; omit the extra photograph at one fifth
    // scale and the unfiltered tooth so the fine weave can average cleanly.
    macro: 0.22, micro: 0.25, maps: 0.64, uv: uv(),
  })
  // Quiet the square contrast while keeping the admitted physical weave;
  // uneven short fibres keep the padded fitting from reading as a grid.
  linen.colorNode = linen.colorNode!.mul(mx_noise_float(positionWorld.mul(vec3(110,800,2800))).mul(0.04).add(0.98))
  linen.roughnessNode = linenDetail.roughness.mul(0.04).add(0.93)
  const metal = new MeshStandardNodeMaterial({ color: '#514936', metalness: 0.48, roughness: 0.4 })
  metal.roughnessNode = mx_noise_float(positionWorld.mul(430)).mul(0.07).add(0.38)
  const shade = new MeshStandardNodeMaterial({ color: '#202824', metalness: 0.12, roughness: 0.6 })
  const shadeInterior = attribute<'float'>('shadeInterior', 'float')
  shade.colorNode = mix(color('#202824'), color('#e2c89b'), shadeInterior).mul(mx_noise_float(positionWorld.mul(90)).mul(0.035).add(0.97))
  const interiorFalloff = positionLocal.xz.length().div(0.061).oneMinus().mul(0.35).add(0.48)
  shade.emissiveNode = color('#ffc778').mul(shadeInterior).mul(interiorFalloff)
  const bulb = new MeshStandardNodeMaterial({ color: '#a89a76', emissive: '#ffdba1', emissiveIntensity: 0.4, roughness: 0.75 })
  const materials = [wood, leather, paper, linen, metal, shade, bulb]

  function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: Material, parent = object) {
    const geometry = mat === leather ? roundedBoardGeometry(w, h, d)
      : mat === linen ? linenSupportGeometry(w, h, d) : new BoxGeometry(w, h, d)
    const m = new Mesh(geometry, mat)
    m.position.set(x, y, z)
    m.receiveShadow = true
    stamp(m, 'furniture')
    parent.add(m)
    return m
  }
  const ground = new Group()
  ground.name = 'oak-reading-ground'
  stamp(ground, 'furniture')
  object.add(ground)
  const table = box(2.8, 0.045, 2, 0, -0.027, 0.025, wood, ground)
  table.name = 'oak-tabletop'
  box(0.91, 0.075, 0.023, 0, -0.083, 0.35, wood)
  box(0.04, 0.4, 0.04, -0.44, -0.26, 0.3, wood)
  box(0.04, 0.4, 0.04, 0.44, -0.26, 0.3, wood)
  const cradle = box(0.357, 0.007, 0.263, 0, 0.001, 0, linen)
  cradle.name = 'modern-linen-support'
  box(0.022, 0.012, 0.255, -0.151, 0.01, 0, linen)
  box(0.022, 0.012, 0.255, 0.151, 0.01, 0, linen)

  const book = new Group()
  book.name = 'facsimile-binding'
  stamp(book, 'binding')
  object.add(book)
  const leftBoard = box(0.166, 0.0035, 0.238, -0.086, 0.011, 0, leather, book)
  const rightBoard = box(0.166, 0.0035, 0.238, 0.086, 0.011, 0, leather, book)
  leftBoard.castShadow = rightBoard.castShadow = true
  if (!new URLSearchParams(location.search).has('noweld')) {
    const parts = [leftBoard,rightBoard].map(board => { board.updateMatrix(); return board.geometry.clone().applyMatrix4(board.matrix) })
    const boards = new Mesh(mergeGeometries(parts, false)!, leather)
    boards.castShadow = boards.receiveShadow = true
    stamp(boards, 'binding')
    book.remove(leftBoard,rightBoard)
    parts.forEach(part=>part.dispose())
    leftBoard.geometry.dispose(); rightBoard.geometry.dispose()
    book.add(boards)
  }
  const makeStack = (side: -1 | 1) => {
    const stack = new Mesh(textBlockGeometry(0.159,0.016,0.231,side),paper)
    stack.position.set(side*0.083,0.021,0)
    stack.castShadow = true
    stack.receiveShadow = false
    stamp(stack,'binding')
    book.add(stack)
    return stack
  }
  const leftStack = makeStack(-1), rightStack = makeStack(1)
  const spine = box(0.008, 0.022, 0.237, 0, 0.014, 0, leather, book)
  spine.name = 'hollow-spine'
  const closed = new Group()
  stamp(closed, 'binding')
  object.add(closed)
  box(0.174, 0.004, 0.244, 0, 0.008, 0, leather, closed)
  const closedSection = new Mesh(textBlockGeometry(0.161,0.027,0.233,1),paper)
  closedSection.position.set(0.003,0.023,0)
  stamp(closedSection,'binding')
  closed.add(closedSection)
  const lid = box(0.174, 0.004, 0.244, 0, 0.039, 0, leather, closed)
  lid.castShadow = true
  box(0.008, 0.031, 0.244, -0.085, 0.024, 0, leather, closed)
  // The material carries a shallow blind-tooled rule, without coplanar strips.
  // No fictitious title or original binding is claimed.

  const lamp = new Group()
  lamp.position.set(-0.275, 0, -0.115)
  lamp.scale.y = 0.72
  stamp(lamp, 'furniture')
  object.add(lamp)
  const baseProfile = [[0,-0.003],[0.046,-0.003],[0.050,-0.001],[0.049,0.002],[0.046,0.005],[0.039,0.008],[0.025,0.010],[0,0.011]].map(([r,y]) => new Vector2(r!,y!))
  const base = new Mesh(new LatheGeometry(baseProfile,64), metal)
  base.position.y = -0.00325
  lamp.add(base)
  const stem = new Mesh(new CylinderGeometry(0.0035, 0.0045, 0.23, 16), metal)
  stem.position.set(0, 0.12, 0)
  lamp.add(stem)
  const arm = new Mesh(new CylinderGeometry(0.0035, 0.0035, 0.104, 16), metal)
  arm.position.set(0.044, 0.235, 0)
  arm.rotation.z = -Math.PI / 2
  lamp.add(arm)
  // A continuous spun-metal cross-section returns along its lit inner wall.
  // Cap, cone, rolled lip and interior share rings: there is no cap seam.
  const profile = [new Vector2(0,0.019),new Vector2(0.027,0.019),
    new Vector2(0.030,0.017),new Vector2(0.059,-0.016),
    new Vector2(0.061,-0.018),new Vector2(0.060,-0.020),
    new Vector2(0.058,-0.019),new Vector2(0.027,0.014),new Vector2(0,0.014)].reverse()
  const hoodGeometry = new LatheGeometry(profile, 64)
  const interior = new Float32Array(hoodGeometry.getAttribute('position').count)
  for (let i=0;i<interior.length;i++) interior[i] = i % profile.length <= 4 ? 1 : 0
  hoodGeometry.setAttribute('shadeInterior',new BufferAttribute(interior,1))
  const hood = new Mesh(hoodGeometry,shade)
  hood.position.set(0.095,0.22,0.007)
  hood.rotation.x = -1.0
  lamp.add(hood)

  function weld(parent: Group): void {
    if (new URLSearchParams(location.search).has('noweld')) return
    const byMat = new Map<Material, Mesh[]>()
    for (const c of parent.children) if (c instanceof Mesh && !c.castShadow && !Array.isArray(c.material)) {
      const group = byMat.get(c.material) ?? []
      group.push(c)
      byMat.set(c.material, group)
    }
    for (const [mat, meshes] of byMat) {
      if (meshes.length < 2) continue
      const parts = meshes.map(m => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix) })
      const g = mergeGeometries(parts, false)
      parts.forEach(p => p.dispose())
      if (!g) continue
      const merged = new Mesh(g, mat)
      merged.receiveShadow = true
      stamp(merged, 'furniture')
      meshes.forEach(m => { parent.remove(m); m.geometry.dispose() })
      parent.add(merged)
    }
  }
  weld(closed); weld(lamp); weld(object)

  return { object, ground, book, closed, lamp, library, materials, paper,
    textureMB: () => carrierDisposed ? 0 : library.textureMB(),
    progress(index: number, total: number) {
      const ratio = Math.max(0.04, Math.min(0.96, index / Math.max(1, total - 1)))
      leftStack.scale.y = 0.2 + ratio * 1.1
      rightStack.scale.y = 1.3 - ratio * 1.1
      leftStack.position.y = 0.013 + 0.008 * leftStack.scale.y
      rightStack.position.y = 0.013 + 0.008 * rightStack.scale.y

    },
    thicknesses() { return {left:0.016*leftStack.scale.y,right:0.016*rightStack.scale.y} },
    pageHeights() { return { left:0.013 + 0.016 * leftStack.scale.y + 0.0013, right:0.013 + 0.016 * rightStack.scale.y + 0.0013 } },
    dispose() {
      carrierDisposed = true
      object.traverse(o => { if (o instanceof Mesh) o.geometry.dispose() })
      materials.forEach(m => m.dispose())
      for (const map of carrierTextures) { map.dispose(); closeImage(map.image) }
      library.dispose()
    },
  }
}
