import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardNodeMaterial, PlaneGeometry, SphereGeometry, TorusGeometry, Vector2, Vector3, type Material, type Texture } from 'three/webgpu'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { attribute, cameraPosition, color, float, mix, mx_noise_float, positionLocal, positionWorld, sin, smoothstep, uniform, uv, vec3 } from 'three/tsl'
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
    /* THE COCKLE IS THE PAPER. A leaf is bound at the gutter and free at the
       fore edge, so its undulation grows across the page: two waves out of
       phase, 1.6 mm at the fore edge and nothing at the sewing. Under a
       raking lamp this is the difference between paper and a printed card. */
    /* AND IT LIFTS, IT DOES NOT SINK. A cockled sheet rises away from the
       stack under it; a symmetric wave would dip 1.6 mm into a text block
       that sits 1.3 mm below the sheet on a thick gathering, and the block
       would come through the paper. The whole field is biased upward. */
    const cockle = (0.00108 * Math.sin(u * 7.2 + v * 3.1) + 0.00056 * Math.sin(u * 17.3 - v * 9.7) + 0.00122) * Math.pow(u, 0.85)
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
  /* THE READING LAMP'S POOL. The stack gives a scene ONE key and that key is
     directional: it carries an hour and no falloff, and a reading lamp is
     falloff. So the lamp's own inverse-square term is carried by the carrier
     materials, at the emitter's real position inside the shade, and every
     carrier takes the same term: a pool that dims the table but not the
     leather beside it is two lamps. No admitted plate is dimmed or tinted. */
  const LAMP_AT = vec3(-0.180, 0.152, -0.108)
  const lampRange = 0.16
  const lampDistance = positionWorld.sub(LAMP_AT).length()
  const lampFall = float(lampRange * lampRange).div(lampDistance.mul(lampDistance).add(lampRange * lampRange))
  // about 0.66 on the open page, 0.22 at the table's near edge, 0.12 a metre out:
  // the last term is the room's own bounce, and without it the far boards go
  // to flat black and take their grain with them
  /* THE TERM STANDS IN FOR A LAMP THE SCENE LACKS, laid out about the origin
     the table is built at. A room that lights the table with a lamp of its own
     sets `userData.lampStandIn` to 0: its light carries the falloff, and this
     term, read in world space far from that origin, would dim every carrier
     to a tenth a second time. */
  const lampStandIn = uniform(1)
  object.userData['lampStandIn'] = lampStandIn
  const pool = mix(float(1), lampFall.mul(2.4).min(0.95).add(0.10), lampStandIn)

  const wood = new MeshStandardNodeMaterial({ color: '#65503a', roughness: 0.72 })
  wood.colorNode = color('#57472f')
  const oakSet = carrierSet('oak-planks-worn')
  stack.detail(wood, oakSet, { count: 3, scales: [0.74, 0, 0.0009], fade: [1.9, 5.4], macro: 0.52, micro: 0.85, maps: 1 })
  /* THE BOARDS ARE THE MID SCALE. The helper's mid band is a second read of
     the set's own photograph at a fifth of its size, turned: over a 25 cm
     plank that lays a 5 cm crosshatch and the table reads as mottle. The
     band is off (mid scale 0) and the mid structure is authored at the pitch
     the photograph itself has, so the joint the eye reads and the joint the
     map carries are the same joint. */
  const BOARD_M = 0.25
  const acrossBoards = positionWorld.z.div(BOARD_M)
  const seat = acrossBoards.fract()
  const joint = smoothstep(0, 0.017, seat).mul(smoothstep(0, 0.017, seat.oneMinus()))
  // the arris of a worn board catches the raking light just before the joint
  const arris = smoothstep(0.030, 0.013, seat).add(smoothstep(0.970, 0.987, seat)).mul(0.12)
  const boardTone = mx_noise_float(vec3(acrossBoards.floor().mul(4.3), 0.5, 0)).mul(0.085).add(1)
  const longGrain = mx_noise_float(positionWorld.mul(vec3(5.5, 0, 180))).mul(0.5).add(0.5)
  const fineGrain = mx_noise_float(positionWorld.mul(vec3(24, 0, 940)))
  /* THE RACK'S OWN CONTACT. Its shadow would cost two draws of a budget of
     forty, and the rack stands in exactly one state, so the occlusion under
     its footprint is authored and switched by the object that makes it. */
  const shelfContact = uniform(0)
  /* THE READING COPY'S OWN CONTACT, AUTHORED. Its mount and plinth stand in
     exactly one state and their cast shadow costs four draws of a budget of
     forty (two casters, two cascades), so the dark they put on the table is
     written into the boards and switched by the state that raises them. */
  const copyContact = uniform(0)
  /* THE RACK CARRIES ITS OWN FITTING. Eight plates glowing while the only
     lamp in the room points down at the book is a light with no source, so
     the rack has a picture light over its top row: its own emitter, its own
     inverse-square term, switched on with the rack and off with it. */
  const RACK_AT = vec3(0, 0.209, -0.440)
  const rackRange = 0.26
  const rackDistance = positionWorld.sub(RACK_AT).length()
  const rackFall = float(rackRange * rackRange).div(rackDistance.mul(rackDistance).add(rackRange * rackRange))
  const rackLight = rackFall.mul(shelfContact)
  // what every carrier in the room is actually lit by: the lamp, plus the
  // rack's fitting when the rack is standing
  const lit = pool.add(rackLight.mul(0.40))
  // the copy stands at x 0.19 to 0.36; the lamp throws its shadow to +x and +z
  const copyFoot = smoothstep(0.145, 0.045, positionWorld.x.sub(0.300).abs())
    .mul(smoothstep(0.165, 0.055, positionWorld.z.sub(0.022).abs()))
  const copyCast = smoothstep(0.115, 0.030, positionWorld.x.sub(0.345).abs())
    .mul(smoothstep(0.135, 0.040, positionWorld.z.sub(0.055).abs()))
  const rackFoot = smoothstep(0.315, 0.185, positionWorld.x.abs())
    .mul(float(1).sub(smoothstep(-0.245, -0.170, positionWorld.z)))
    .mul(smoothstep(-0.545, -0.450, positionWorld.z))
  wood.colorNode = wood.colorNode!
    .mul(float(1).sub(rackFoot.mul(shelfContact).mul(0.62)))
    .mul(float(1).sub(copyFoot.mul(copyContact).mul(0.55)))
    .mul(float(1).sub(copyCast.mul(copyContact).mul(0.30)))
    .mul(boardTone)
    .mul(joint.mul(0.58).add(0.42))
    .mul(arris.add(1))
    .mul(longGrain.mul(0.11).add(0.935))
    .mul(lit)
  // a waxed board is smoother along its own grain, and a joint is never waxed
  wood.roughnessNode = float(0.72)
    .add(fineGrain.mul(0.05))
    .add(longGrain.mul(0.07))
    .add(joint.oneMinus().mul(0.16))
  const leather = new MeshStandardNodeMaterial({ color: '#4b2f17', roughness: 0.69 })
  leather.colorNode = color('#4b2f17')
  const leatherSet = carrierSet('leather-worn')
  stack.detail(leather, {...leatherSet, grain:leatherSet.grain ? {...leatherSet.grain, relief:0.035, pitch:0.035, fold:0.15, tooth:0.0006, sheen:0.1} : null}, { count: 3, scales: [0.24, 0.012, 0.0004], fade: [0.7, 2.0], mid: 0.04, macro: 0.25 })
  const toolingDistance = positionWorld.x.abs().sub(0.074).max(positionWorld.z.abs().sub(0.1085)).abs()
  // 1.6 mm of blind tooling: at 0.4 mm the rule was half a pixel on the frame
  const tooling = float(1).sub(smoothstep(0.0004,0.0016,toolingDistance)).mul(smoothstep(0.038,0.040,positionWorld.y))
  leather.colorNode = leather.colorNode!.mul(float(1).sub(tooling.mul(0.26)))
  // handled edges go darker and shinier than the middle of a board
  const handled = smoothstep(0.062, 0.086, positionWorld.x.abs()).max(smoothstep(0.096, 0.120, positionWorld.z.abs()))
  leather.colorNode = leather.colorNode!.mul(handled.mul(-0.13).add(1))
  leather.roughnessNode = float(0.60)
    .add(mx_noise_float(positionWorld.mul(2300)).mul(0.05))
    .add(mx_noise_float(positionWorld.mul(vec3(52, 90, 52))).mul(0.13))
    .sub(tooling.mul(0.14))
    .sub(handled.mul(0.1))
  leather.colorNode = leather.colorNode!.mul(lit)
  const paper = new MeshStandardNodeMaterial({ color: '#b39b73', roughness: 0.91 })
  const grain = mx_noise_float(positionWorld.mul(vec3(240, 100, 120)))
  const broadPaper = mx_noise_float(positionWorld.mul(vec3(8,50,10))).mul(0.035)
  const finePaper = mx_noise_float(positionWorld.mul(vec3(4800,12000,2600))).mul(0.015)
  paper.colorNode = color('#baa780').mul(grain.mul(0.022).add(broadPaper).add(finePaper).add(0.94))
  /* UNBLEACHED LINEN, the flax's own oatmeal: a grey cloth under a warm lamp
     read as a plastic slab beside the page. */
  const linen = new MeshStandardNodeMaterial({ color: '#8f7c5c', roughness: 0.96 })
  linen.colorNode = color('#8f7c5c')
  const linenSet = carrierSet('linen')
  // Pin the admitted tile extent before the synchronous node graph is built:
  // library/linen records 0.271 m, while the loader initially holds 1 m.
  // Its existing mipmapped albedo carries the approximately 0.7 mm weave.
  linenSet.scale = [0.271, 0.271]
  const linenDetail = stack.detail(linen, {
    ...linenSet,
    grain: linenSet.grain ? {
      ...linenSet.grain, relief: 0.19, pitch: 0.011, fold: 0.115, tooth: 0.0007, sheen: 0.055,
    } : null,
  }, {
    /* THE SUPPORT NEEDS RELIEF, NOT ONLY COLOUR. With the mid band at zero the
       helper builds no normal at all, and a padded cover under a raking lamp
       became a pale slab with a seam, the one surface in the room that read
       as flat colour. A small mid band at three centimetres gives the cloth
       the sag the light can find, without laying the set's own photograph
       over it at a findable size. */
    count: 3, scales: [0.15, 0.028, 0.0004], fade: [0.5, 1.8],
    macro: 0.22, mid: 0.30, micro: 0.25, maps: 0.64, uv: uv(),
  })
  // Quiet the square contrast while keeping the admitted physical weave;
  // uneven short fibres keep the padded fitting from reading as a grid.
  linen.colorNode = linen.colorNode!.mul(mx_noise_float(positionWorld.mul(vec3(110,800,2800))).mul(0.04).add(0.98))
  /* A FITTED SUPPORT IS SEWN AND IT IS USED. A hem six millimetres in, the
     soiling a hundred readings leave where hands lift the boards at the near
     margin, the margin the book never covers faded paler than its footprint,
     and the rounded edge rubbed through to the lighter fibre. Read in the
     table's own frame, so the marks stay on the support wherever a room sets
     the table down. */
  const at = positionLocal
  const hemDistance = at.x.abs().sub(0.1785).max(at.z.abs().sub(0.1315)).abs()
  const hem = float(1).sub(smoothstep(0.0006, 0.0022, hemDistance.sub(0.006).abs()))
  const soil = smoothstep(0.055, 0.005, at.z.abs().sub(0.03).abs()).mul(smoothstep(0.16, 0.06, at.x.abs()))
    .max(smoothstep(0.112, 0.128, at.z).mul(smoothstep(0.13, 0.02, at.x.abs())).mul(mx_noise_float(at.mul(vec3(90, 0, 60))).mul(0.4).add(0.7)))
  const margin = smoothstep(0.1685, 0.1705, at.x.abs()).max(smoothstep(0.1185, 0.1205, at.z.abs()))
  // the corners take the most: a hand squares the support there
  const corner = smoothstep(0.03, 0.004, at.x.abs().sub(0.1785).abs().add(at.z.abs().sub(0.1315).abs()))
  const rubbed = hemDistance.lessThan(0.0035).select(float(1), float(0)).mul(smoothstep(0.0015, 0.0035, at.y)).max(corner.mul(0.8))
    .mul(mx_noise_float(at.mul(600)).mul(0.5).add(0.6)).clamp(0, 1)
  // and the cloth darkens where it has stood on the boards of the table
  const clothFoot = smoothstep(0.0022, -0.0022, at.y).mul(0.3)
  /* THREE SCALES ON THE SUPPORT, AUTHORED, NOT BORROWED. The carrier's weave
     averages away at the distance this slab is seen from, and a pale plane
     with one faint seam reads as flat colour. Large: the bleach and wear of
     a fitting that has been washed. Mid: the sag of a padded cover between
     its rails, and the wrinkle a hand leaves. Fine: the tooth of the cloth,
     faded out before it can alias. */
  const linenNear = float(1).sub(smoothstep(0.5, 1.6, positionWorld.sub(cameraPosition).length()))
  const linenWear = mx_noise_float(at.mul(vec3(7.5, 3, 8.5))).mul(0.11)
  const linenSag = mx_noise_float(at.mul(vec3(26, 8, 31))).mul(0.07)
    .add(mx_noise_float(at.mul(vec3(58, 14, 66))).mul(0.04))
  const linenTooth = mx_noise_float(at.mul(vec3(330, 90, 330))).mul(0.055)
    .add(mx_noise_float(at.mul(vec3(960, 200, 960))).mul(0.03))
  // slubs: the thick threads of an unbleached weave, running along warp and weft
  const slubs = mx_noise_float(at.mul(vec3(900, 40, 18))).max(mx_noise_float(at.mul(vec3(18, 40, 900)).add(5))).sub(0.35).max(0).mul(0.22)
  // the two rails press a line into the cover on either side of the boards
  const rails = smoothstep(0.010, 0.002, at.x.abs().sub(0.151).abs()).mul(0.10)
  linen.colorNode = linen.colorNode!
    .mul(linenWear.add(linenSag).add(linenTooth.mul(linenNear)).add(slubs.mul(linenNear.mul(0.6).add(0.4))).add(1))
    .mul(hem.mul(-0.16).add(1))
    .mul(soil.mul(-0.32).add(1))
    .mul(margin.mul(0.1).add(1))
    .mul(mix(vec3(1), vec3(1.22, 1.2, 1.16), rubbed))
    .mul(float(1).sub(clothFoot))
    .mul(float(1).sub(rails))
    .mul(lit)
  linen.roughnessNode = linenDetail.roughness.mul(0.04).add(0.90)
    .add(linenTooth.mul(1.4).mul(linenNear))
    .add(linenSag.mul(0.5))
    .sub(soil.mul(0.06))
    .add(rubbed.mul(0.04))
  /* A LACQUERED LAMP, NOT A MIRROR. At metalness 0.48 the stem and the arm
     reflected the baked night sky and read as flat black bars beside a lit
     shade; a painted fitting keeps a diffuse term the key can model. */
  const metal = new MeshStandardNodeMaterial({ color: '#5b5039', metalness: 0.26, roughness: 0.36 })
  metal.colorNode = color('#6a5c42').mul(lit.mul(0.42).add(0.58))
  metal.roughnessNode = mx_noise_float(positionWorld.mul(430)).mul(0.07).add(0.38)
  /* THE SHADE. Spun steel, painted outside, bare and lit inside. Three scales
     on the outer skin, because it is the one plane that could otherwise read
     as flat colour: a dent field across the cone, the turning marks the
     spinning tool left (2.2 mm, mostly in the roughness, which is how spun
     metal actually reads), and a grain under both. Each thins with distance. */
  const shade = new MeshStandardNodeMaterial({ color: '#202824', metalness: 0.12, roughness: 0.6 })
  const shadeInterior = attribute<'float'>('shadeInterior', 'float')
  const shadeRadius = positionLocal.xz.length()
  const shadeNear = float(1).sub(smoothstep(0.55, 1.9, positionWorld.sub(cameraPosition).length()))
  const shadeDents = mx_noise_float(positionLocal.mul(vec3(23, 31, 23))).mul(0.085)
    .add(mx_noise_float(positionLocal.mul(vec3(7.5, 9, 7.5))).mul(0.06))
  const shadeSpin = sin(shadeRadius.mul(2860)).mul(0.5).add(sin(shadeRadius.mul(1130)).mul(0.5))
  const shadeGrain = mx_noise_float(positionLocal.mul(2400)).mul(0.019)
    .add(mx_noise_float(positionLocal.mul(760)).mul(0.012))
  const shadeSkin = float(1)
    .add(shadeDents.mul(shadeNear.mul(0.55).add(0.45)))
    .add(shadeSpin.mul(0.005).mul(shadeNear))
    .add(shadeGrain.mul(1.7).mul(shadeNear))
    // the cone darkens toward its rim: a density gradient the eye can follow
    .mul(smoothstep(0.064, 0.012, shadeRadius).mul(0.10).add(0.92))
  shade.colorNode = mix(color('#202824'), color('#e2c89b'), shadeInterior).mul(shadeSkin)
  /* A SPUN SHADE IS SPECKLED, NOT TERRACED. The turning marks were carried
     at an amplitude that read as concentric steps at close range; the paint's
     own tooth carries the surface now and the rings stay under it. */
  shade.roughnessNode = float(0.55)
    .add(shadeSpin.mul(0.035).mul(shadeNear))
    .add(shadeGrain.mul(3.2))
    .add(shadeDents.mul(0.35))
  /* THE INTERIOR IS A LIT WALL, NOT A LIGHT BOX. It was one flat value and
     read as a cut-out ellipse of cream; the bulb below the cap is what it is
     brightest for, and the wall falls away from it toward the rim. */
  const interiorFalloff = smoothstep(0.066, 0.006, shadeRadius).mul(0.72).add(0.28)
  shade.emissiveNode = color('#ffc478')
    .mul(shadeInterior)
    .mul(interiorFalloff)
    .mul(0.52)
    // the inner wall is spun too: its rings read as light, not as paint
    .mul(sin(shadeRadius.mul(1130)).mul(0.05).add(mx_noise_float(positionLocal.mul(vec3(70, 70, 70))).mul(0.07)).add(0.96))
  const materialsHeadband = new MeshStandardNodeMaterial({ color: '#8d7852', roughness: 0.78 })
  materialsHeadband.colorNode = color('#8d7852')
    .mul(mx_noise_float(positionWorld.mul(vec3(1400, 260, 260))).mul(0.13).add(0.94))
    .mul(lit)
  /* THE RACK'S TUBE IS A FITTING, NOT A FLARE. It is seen directly, unlike
     the bulb inside the lamp's shade, so it sits at a fifth of that level:
     bright enough to be the reason the plates are lit, never the brightest
     thing in the frame. */
  const fitting = new MeshStandardNodeMaterial({ color: '#6d6146', emissive: '#f2c98c', emissiveIntensity: 0.20, roughness: 0.5 })
  const materialsWall: MeshStandardNodeMaterial[] = []
  const materials = [wood, leather, paper, linen, metal, shade, materialsHeadband, fitting]

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
  /* THE ROOM HAS A BACK. Without it the frame ran off the table's far edge
     into the renderer's background, and a reading room became a lit board in
     a void. Plaster, because the wing's room is plaster and the panelling is
     the table's own boards. Three scales: float patches, the trowel's sweep,
     the fine tooth, and the lamp's own falloff across all of it. */
  /* THE KEY COMES FROM BEHIND THIS WALL. Its azimuth puts the sun's stand-in
     on the far side, so the wall is lit by the lamp's spill and the room's
     fill alone: it needs a real plaster albedo to read at all, the way a pale
     wall in a dark room does. */
  const plaster = new MeshStandardNodeMaterial({ color: '#a1907a', roughness: 0.94 })
  const wallX = positionWorld.x
  const wallY = positionWorld.y
  const patches = mx_noise_float(vec3(wallX.mul(1.7), wallY.mul(1.7), 0)).mul(0.10)
  const trowel = mx_noise_float(vec3(wallX.mul(9.5), wallY.mul(7.0), 4.5)).mul(0.055)
    .add(mx_noise_float(vec3(wallX.mul(23), wallY.mul(17), 1.5)).mul(0.03))
  const tooth = mx_noise_float(vec3(wallX.mul(420), wallY.mul(420), 9)).mul(0.026)
  // a wall is dirtier at its foot and paler where it has been washed down
  const foot = smoothstep(0.26, -0.02, wallY).mul(0.07)
  /* the room's one straight line: a painted skirting, its board darker than
     the plaster and its top edge catching what the lamp throws this far */
  const skirtBoard = smoothstep(0.096, 0.090, wallY)
  const skirtEdge = smoothstep(0.0865, 0.0925, wallY).mul(smoothstep(0.0985, 0.0925, wallY))
  plaster.colorNode = color('#a1907a')
    .mul(patches.add(trowel).add(tooth).add(1))
    .mul(float(1).sub(foot))
    .mul(float(1).sub(skirtBoard.mul(0.34)))
    .mul(skirtEdge.mul(0.30).add(1))
    // the lamp's spill: brightest low and on the lamp's side, gone in the corner
    .mul(lit.mul(1.5).min(0.62).add(0.42))
  plaster.roughnessNode = float(0.90).add(trowel.mul(1.2)).add(tooth.mul(2.4))
  materialsWall.push(plaster)
  const ground = new Group()
  ground.name = 'oak-reading-ground'
  stamp(ground, 'furniture')
  object.add(ground)
  const table = box(2.8, 0.045, 2, 0, -0.027, 0.025, wood, ground)
  table.name = 'oak-tabletop'
  const wall = new Mesh(new PlaneGeometry(4.4, 2.2), plaster)
  wall.name = 'reading-room-wall'
  wall.position.set(0, 0.62, -1.02)
  /* THE WALL TAKES NO SHADOW MAP. It stands a metre behind the book, past
     the cascade fitted to the book, where a clamped edge sample reads as a
     blocker and the whole plane goes to ambient. */
  wall.receiveShadow = false
  stamp(wall, 'furniture')
  ground.add(wall)
  /* THE SKIRTING IS PAINTED, NOT BUILT. Standing proud of the wall it turned
     its face to the +z side, which is the side this room's key never reaches,
     and a black bar ran across the foot of every frame that saw the wall. In
     the plaster it is the same straight line and it takes the same light. */
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
  /* A ROUNDED SPINE, NOT A FLAT STRIP. A sewn book's back is a half round
     between its boards; a box there reads as a slipcase. The lathe runs along
     the volume's height, which is the axis a spine is rounded on. */
  const closedSpine = new Mesh(
    new CylinderGeometry(0.0175, 0.0175, 0.244, 18, 1, true, Math.PI, Math.PI), leather)
  closedSpine.rotation.x = Math.PI / 2
  closedSpine.position.set(-0.0855, 0.0235, 0)
  closedSpine.castShadow = closedSpine.receiveShadow = true
  stamp(closedSpine, 'binding')
  closed.add(closedSpine)
  /* THE HEADBAND. Two millimetres of rolled silk at head and tail, the one
     detail that separates a sewn volume from a block of card. */
  /* Both bands of a volume are ONE draw and neither casts: two millimetres of
     silk at the spine cannot throw a shadow anything can see, and the table's
     draw budget is spent on the paper. */
  for (const [group, y, reach] of [[closed, 0.0345, 0.1195], [book, 0.0305, 0.1155]] as const) {
    const parts = [-1, 1].map(side => {
      const part = new CylinderGeometry(0.0019, 0.0019, 0.0155, 10, 1)
      part.rotateZ(Math.PI / 2)
      part.translate(-0.0805, y, side * reach)
      return part
    })
    const bands = new Mesh(mergeGeometries(parts, false)!, materialsHeadband)
    parts.forEach(part => part.dispose())
    stamp(bands, 'binding')
    group.add(bands)
  }
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
  /* 160 SEGMENTS AND A RAMP AT THE LIP. Sixty-four segments plus a hard 0/1
     step across the two-millimetre lip made a comb of teeth along the lit
     ellipse whenever the lamp was seen nearly edge-on. The silhouette is now
     finer than a pixel at reading distance and the emissive fades over the
     roll instead of ending on a ring boundary. */
  const hoodGeometry = new LatheGeometry(profile, 160)
  const interior = new Float32Array(hoodGeometry.getAttribute('position').count)
  const INTERIOR_RAMP = [1, 1, 0.94, 0.52, 0.16, 0, 0, 0, 0]
  for (let i=0;i<interior.length;i++) interior[i] = INTERIOR_RAMP[i % profile.length] ?? 0
  hoodGeometry.setAttribute('shadeInterior',new BufferAttribute(interior,1))
  /* THE BULB RIDES THE SHADE'S OWN CROSS-SECTION. As its own mesh it was a
     draw in every state for a lamp seen from above, where the shade hides it.
     Merged into the spun section with the interior attribute set, it glows on
     the same material and costs nothing. */
  const bulbGeometry = new SphereGeometry(0.0125, 20, 12)
  bulbGeometry.translate(0, 0.006, 0)
  const bulbInterior = new Float32Array(bulbGeometry.getAttribute('position').count).fill(1)
  bulbGeometry.setAttribute('shadeInterior', new BufferAttribute(bulbInterior, 1))
  const lampHead = mergeGeometries([hoodGeometry, bulbGeometry], false)!
  hoodGeometry.dispose(); bulbGeometry.dispose()
  const hood = new Mesh(lampHead,shade)
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
  weld(closed); weld(lamp); weld(object); weld(ground)

  return { object, ground, book, closed, lamp, library, materials, paper, shelfContact, copyContact, pool, rackLight,
    textureMB: () => carrierDisposed ? 0 : library.textureMB(),
    /* A MAP THAT NEVER LANDED IS NOT A MATERIAL DECISION. The library keeps
       a failed set silent (the scene draws as authored), so the carrier
       reports what it actually has: a report that says "three scales" while
       the photograph is missing is a report about nothing. */
    carriers: () => ({
      missing: library.missing(),
      textureMB: carrierDisposed ? 0 : library.textureMB(),
      sets: library.manifest().map(entry => entry.id),
    }),
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
      materialsWall.forEach(m => m.dispose())
      for (const map of carrierTextures) { map.dispose(); closeImage(map.image) }
      library.dispose()
    },
  }
}
