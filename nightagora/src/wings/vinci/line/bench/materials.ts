import { Color, MeshStandardNodeMaterial, ObjectSpaceNormalMap } from 'three/webgpu'
import * as TSL from 'three/tsl'

const {
  cameraPosition, float, modelWorldMatrix, mx_noise_float, normalMap,
  normalWorldGeometry, positionWorld, smoothstep, vec2, vec3, vec4,
} = TSL

interface SurfaceRecipe {
  kind: 'chalk' | 'slate'
  name: string
  colour: string
  roughness: number
  macroMetres: number
  midMetres: [number, number]
  heightMetres: number
  macroContrast: number
  midContrast: number
  roughnessVariation: number
}

/** Original exhibition materials, not samples or measurements of historic stone.
 * Every distance is in world metres. The host owns and disposes the material.
 * No images, texture allocations, geometry attributes or asynchronous work.
 */
function createSurface(recipe: SurfaceRecipe): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    color: recipe.colour, roughness: recipe.roughness, metalness: 0,
  })
  const p = positionWorld
  const n = normalWorldGeometry.normalize()
  const dominantY = n.y.abs().greaterThanEqual(n.x.abs()).and(n.y.abs().greaterThanEqual(n.z.abs()))
  const dominantX = n.x.abs().greaterThan(n.z.abs())
  const uAxis = dominantY.select(vec3(1, 0, 0), dominantX.select(vec3(0, 0, 1), vec3(1, 0, 0)))
  const vAxis = dominantY.select(vec3(0, 0, 1), vec3(0, 1, 0))
  const projected = vec2(p.dot(uAxis), p.dot(vAxis))
  const distance = p.distance(cameraPosition)
  // The pixel guard below already refuses a scale it cannot resolve, so the
  // distance thinning can reach gallery range instead of stopping at six
  // metres and leaving a hero panel smooth.
  const density = float(1).sub(smoothstep(9, 42, distance))
  const worldPixel = p.dFdx().length().max(p.dFdy().length()).max(0.00001)
  const midScale = Math.min(...recipe.midMetres)
  const midDensity = density.mul(smoothstep(2, 4, float(midScale).div(worldPixel)))
  const octaveDensity = smoothstep(2, 4, float(midScale * 0.5).div(worldPixel))
  const fineDensity = float(1).sub(smoothstep(3, 16, distance))
    .mul(smoothstep(2, 4, float(0.003).div(worldPixel)))
  // Split texture belongs most strongly to the upward-facing slate leaves.
  // Vertical framing/backing keeps a quiet mineral surface with the same
  // material; changing the light cannot reveal a new wall of stripes.
  const faceDetail = recipe.kind === 'slate'
    ? float(.35).add(smoothstep(0.12, 0.65, n.y.abs()).mul(.65))
    : float(1)

  // 1 · Weak, metre-scale mottling preserves the authored mean chalk colour.
  const macro = mx_noise_float(p.div(recipe.macroMetres))
  const midUV = projected.div(vec2(...recipe.midMetres))
  const sampleMid = (offsetU = 0, offsetV = 0) => {
    const q = vec3(midUV.add(vec2(offsetU, offsetV)), 1.37)
    const f = mx_noise_float(q).add(mx_noise_float(q.mul(2).add(vec3(5.1, 9.7, 3.3))).mul(0.5).mul(octaveDensity))
    // Two resolved octaves give chalk sparse recessed pores instead of uniform raised tooth.
    // Folded, anisotropic noise gives slate a split face rather than a wave.
    if (recipe.kind === 'slate') return f.mul(0.35).add(f.abs().mul(1.3).sub(0.29))
    // Chalk pores gather in patches and leave broad smooth stone between them,
    // the way the reference block does. An even pitting everywhere reads as
    // a bought texture, not as cut stone.
    const patch = smoothstep(-.12, .46, mx_noise_float(vec3(midUV.add(vec2(offsetU, offsetV)).mul(.085), 5.7)))
    return f.mul(.15).sub(smoothstep(.34, .68, float(0).sub(f)).mul(.80).mul(patch))
  }
  const mid = sampleMid()
  // Broad, isotropic mineral clusters survive the ordinary gallery distance
  // on wall faces. Roof leaves keep their finer directional split texture.
  const wallDensity=recipe.kind==='slate'?float(1).sub(smoothstep(.12,.65,n.y.abs())).mul(density).mul(smoothstep(2,4,float(.14).div(worldPixel))):float(0)
  const wallMineral=mx_noise_float(vec3(projected.div(.14),2.81))
  const distantWall=positionWorld.z.lessThan(-2.7).and(n.z.abs().greaterThan(.5)).select(.25,1)
  const roofDensity=recipe.kind==='slate'?n.y.abs().greaterThan(.18).and(n.y.abs().lessThan(.93)).select(1,0).mul(density):float(0)
  const base = new Color(recipe.colour)
  // Sparse dark inclusions, faint bedding streaks and a sand grain: the three
  // marks the reference block carries that a pore field alone cannot give.
  const isChalk = recipe.kind === 'chalk'
  const inclusion = isChalk
    ? smoothstep(.58, .86, mx_noise_float(vec3(projected.div(.014), 7.3))).mul(.34)
      .mul(float(1).sub(smoothstep(1.5, 7, distance)))
    : float(0)
  const bedding = isChalk
    ? mx_noise_float(vec3(projected.mul(vec2(2.4, 10.5)), 3.1)).mul(.045).mul(density)
    : float(0)
  const sand = isChalk
    ? mx_noise_float(p.div(.0016)).mul(.035).mul(float(1).sub(smoothstep(1.2, 5, distance)))
    : float(0)
  material.colorNode = vec3(base.r, base.g, base.b).mul(
    float(1).add(macro.mul(recipe.macroContrast).mul(density).mul(distantWall))
      .add(mid.mul(recipe.midContrast).mul(midDensity).mul(faceDetail)).add(wallMineral.mul(.22).mul(wallDensity).mul(distantWall)).add(float(.23).add(wallMineral.mul(.40)).mul(roofDensity))
      .add(bedding).add(sand).sub(inclusion),
  )

  // 2 · A shallow mineral height field changes the actual shading normal.
  // Central differences are in world metres; the face projection also works
  // on slab tops and sloping roof courses without relying on their mesh UVs.
  const epsilon = midScale * 0.12
  const heightSlope = recipe.heightMetres / (2 * epsilon)
  const dx = sampleMid(epsilon / recipe.midMetres[0], 0)
    .sub(sampleMid(-epsilon / recipe.midMetres[0], 0)).mul(heightSlope)
  const dy = sampleMid(0, epsilon / recipe.midMetres[1])
    .sub(sampleMid(0, -epsilon / recipe.midMetres[1])).mul(heightSlope)
  const gradient = uAxis.mul(dx).add(vAxis.mul(dy))
  const surfaceGradient = gradient.sub(n.mul(gradient.dot(n)))
  const boundedGradient = surfaceGradient.div(surfaceGradient.length().div(0.28).max(1))
  const perturbedWorld = n.sub(boundedGradient.mul(midDensity).mul(faceDetail)).normalize()
  // A normal transforms world -> object with transpose(modelWorldMatrix).
  // NormalMapNode then applies Three's object-normal transform to view space.
  const objectNormal = modelWorldMatrix.transpose().mul(vec4(perturbedWorld, 0)).xyz.normalize()
  const mappedNormal = normalMap(objectNormal.mul(0.5).add(0.5))
  mappedNormal.normalMapType = ObjectSpaceNormalMap
  material.normalNode = mappedNormal

  // 3 · Three-millimetre tooth affects roughness only, and vanishes below the
  // fragment footprint rather than sparkling on distant pale surfaces.
  const fine = mx_noise_float(p.div(0.003))
  material.roughnessNode = float(recipe.roughness)
    .add(fine.mul(0.08).mul(fineDensity))
    .add(mid.mul(recipe.roughnessVariation).mul(midDensity).mul(faceDetail)).clamp(0.64, 0.96)
  material.name = recipe.name
  material.userData['proceduralSurface'] = {
    classification: 'GENERATED',
    scalesMetres: { macro: recipe.macroMetres, mid: recipe.midMetres, midOctaves: 2, verticalMineral: recipe.kind==='slate'?.14:null, micro: 0.003 },
    heightMetres: recipe.heightMetres,
    maximumNormalSlope: 0.28,
    distanceFadeMetres: [6, 28],
    microDistanceFadeMetres: [2, 10],
    textureBytes: 0,
    provenance: 'Original procedural exhibition dressing; colour and grain informed by supplied material references, not a measured historic surface.',
  }
  return material
}

/** Pale chalk carrier: metre mottle, 24/12 mm irregular pores, 3 mm roughness. */
export function createBenchStone(): MeshStandardNodeMaterial {
  return createSurface({
    kind: 'chalk', name: 'vinci/bench-chalk-stone', colour: '#d9d1bd', roughness: 0.86,
    macroMetres: 1.1, midMetres: [0.024, 0.024], heightMetres: 0.00075,
    macroContrast: 0.16, midContrast: 0.19, roughnessVariation: 0.055,
  })
}

/** Neutral dark mineral backing; subdued directional split-layer grain. */
export function createBenchDark(): MeshStandardNodeMaterial {
  const material=createSurface({
    kind: 'slate', name: 'vinci/bench-dark-mineral', colour: '#3c4449', roughness: 0.78,
    macroMetres: 1.2, midMetres: [0.075, 0.012], heightMetres: 0.0013,
    macroContrast: 0.15, midContrast: 0.42, roughnessVariation: 0.12,
  })
  material.aoNode=float(.5).add(smoothstep(.15,1.8,positionWorld.y).mul(.5))
  return material
}

/** The gallery's backing wall, read at ten to fifteen metres: metre-scale
 * clouding, a half-metre mineral mottle, a 55 mm tooth, a fine near grain, and
 * a density gradient that darkens into the base and lifts toward the wash. */
export function createBenchBacking(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ color: '#3a4246', roughness: .88, metalness: 0 })
  const p = positionWorld
  const n = normalWorldGeometry.normalize()
  // Wall faces are vertical, so the face coordinate runs along the wall.
  const face = vec2(p.x.mul(n.z.abs()).add(p.z.mul(n.x.abs())), p.y)
  const pixel = p.dFdx().length().max(p.dFdy().length()).max(.00001)
  const near = float(1).sub(smoothstep(3, 15, p.distance(cameraPosition)))
  const macro = mx_noise_float(vec3(face.div(2.75), 1.7))
  const mid = mx_noise_float(vec3(face.div(.62), 4.3))
  // A worked wall keeps the direction of the tool: the float is stretched.
  const float_ = mx_noise_float(vec3(face.mul(vec2(.85, 3.1)), 2.9))
  const tooth = mx_noise_float(vec3(face.div(.055), 8.1))
  const fine = mx_noise_float(p.div(.0045))
  const toothDensity = smoothstep(1.6, 3.2, float(.055).div(pixel))
  const base = new Color('#3a4246')
  // Soiling gathers at the base; the upper field falls away from the wash.
  const gradient = float(.82)
    .add(smoothstep(0, 1.9, p.y).mul(.26))
    .sub(smoothstep(3.0, 6.6, p.y).mul(.15))
    .add(smoothstep(-8, 7, p.x).mul(.17))
  material.colorNode = vec3(base.r, base.g, base.b).mul(
    gradient
      .add(macro.mul(.27))
      .add(mid.mul(.165))
      .add(float_.mul(.085))
      .add(tooth.mul(.09).mul(toothDensity))
      .add(fine.mul(.06).mul(near)),
  )
  material.roughnessNode = float(.88).add(mid.mul(.06)).add(tooth.mul(.05).mul(toothDensity))
    .add(fine.mul(.05).mul(near)).clamp(.70, .96)
  material.aoNode = float(.52).add(smoothstep(.1, 2.6, p.y).mul(.48))
  material.name = 'vinci/bench-gallery-backing'
  material.userData['proceduralSurface'] = {
    classification: 'GENERATED',
    scalesMetres: { macro: 2.75, mid: .62, float: [1.18, .32], tooth: .055, micro: .0045 },
    densityGradient: 'base soiling, upper falloff, lateral wash',
    textureBytes: 0,
    provenance: 'Original procedural exhibition dressing; a modern gallery wall, not a measured historic surface.',
  }
  return material
}

/** Turned bronze: broad warm reflection, quiet patina, resolved fine tool tooth. */
export function createBenchBronze(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({color:'#b7925b',metalness:0.88,roughness:0.31})
  const p=positionWorld, base=new Color('#b7925b'), patina=new Color('#786044')
  const macro=mx_noise_float(p.mul(1.4)).mul(.5).add(.5)
  const mid=mx_noise_float(p.mul(38)).mul(.5).add(.5)
  const density=float(1).sub(smoothstep(2,15,p.distance(cameraPosition)))
  const pixel=p.dFdx().length().max(p.dFdy().length()).max(.00001)
  // A 1.5 mm mark is legible once it covers more than a pixel and a half.
  const tooth=density.mul(smoothstep(1.2,2.6,float(.0015).div(pixel)))
  const patinaMask=smoothstep(.38,.62,macro.mul(.35).add(mid.mul(.65)))
  // Turning marks and a fine pitting: a cast rim that has been walked past for
  // years does not hold one unbroken highlight.
  const turning=mx_noise_float(vec3(p.x.mul(760),p.y.mul(38),p.z.mul(760)))
  const pits=mx_noise_float(p.mul(96)).mul(.6).add(mx_noise_float(p.mul(240)).mul(.4))
  m.colorNode=TSL.mix(vec3(base.r,base.g,base.b),vec3(patina.r,patina.g,patina.b),float(.14).add(patinaMask.mul(.30).mul(density)).add(smoothstep(.10,.62,pits).mul(.34).mul(density)))
  m.roughnessNode=float(.29).add(patinaMask.mul(.10).mul(density)).add(mid.mul(.03).mul(density)).add(mx_noise_float(p.mul(650)).mul(.025).mul(tooth)).add(turning.mul(.06).mul(tooth)).add(smoothstep(.06,.60,pits).mul(.11).mul(density))
  m.name='vinci/turned-bronze'
  m.userData['proceduralSurface']={classification:'GENERATED',scalesMetres:[.714,.026,.0042,.0015],textureBytes:0}
  return m
}
