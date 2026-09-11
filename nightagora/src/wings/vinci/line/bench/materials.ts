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
  const density = float(1).sub(smoothstep(6, 28, distance))
  const worldPixel = p.dFdx().length().max(p.dFdy().length()).max(0.00001)
  const midScale = Math.min(...recipe.midMetres)
  const midDensity = density.mul(smoothstep(2, 4, float(midScale).div(worldPixel)))
  const octaveDensity = smoothstep(2, 4, float(midScale * 0.5).div(worldPixel))
  const fineDensity = float(1).sub(smoothstep(2, 10, distance))
    .mul(smoothstep(2, 4, float(0.003).div(worldPixel)))
  // Split texture belongs most strongly to the upward-facing slate leaves.
  // Vertical framing/backing keeps a quiet mineral surface with the same
  // material; changing the light cannot reveal a new wall of stripes.
  const faceDetail = recipe.kind === 'slate'
    ? smoothstep(0.12, 0.65, n.y.abs())
    : float(1)

  // 1 · Weak, metre-scale mottling preserves the authored mean chalk colour.
  const macro = mx_noise_float(p.div(recipe.macroMetres))
  const midUV = projected.div(vec2(...recipe.midMetres))
  const sampleMid = (offsetU = 0, offsetV = 0) => {
    const q = vec3(midUV.add(vec2(offsetU, offsetV)), 1.37)
    const f = mx_noise_float(q).add(mx_noise_float(q.mul(2).add(vec3(5.1, 9.7, 3.3))).mul(0.5).mul(octaveDensity))
    // Two resolved octaves turn the former smooth mounds into mineral tooth.
    // Folded, anisotropic noise gives slate a split face rather than a wave.
    return recipe.kind === 'slate' ? f.mul(0.35).add(f.abs().mul(1.3).sub(0.29)) : f
  }
  const mid = sampleMid()
  const base = new Color(recipe.colour)
  material.colorNode = vec3(base.r, base.g, base.b).mul(
    float(1).add(macro.mul(recipe.macroContrast).mul(density))
      .add(mid.mul(recipe.midContrast).mul(midDensity).mul(faceDetail)),
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
    scalesMetres: { macro: recipe.macroMetres, mid: recipe.midMetres, midOctaves: 2, micro: 0.003 },
    heightMetres: recipe.heightMetres,
    maximumNormalSlope: 0.28,
    distanceFadeMetres: [6, 28],
    microDistanceFadeMetres: [2, 10],
    textureBytes: 0,
    provenance: 'Original procedural exhibition dressing; colour and grain informed by supplied material references, not a measured historic surface.',
  }
  return material
}

/** Pale chalk carrier: metre mottle, 24/12 mm mineral relief, 3 mm roughness. */
export function createBenchStone(): MeshStandardNodeMaterial {
  return createSurface({
    kind: 'chalk', name: 'vinci/bench-chalk-stone', colour: '#d9d1bd', roughness: 0.86,
    macroMetres: 1.1, midMetres: [0.024, 0.024], heightMetres: 0.0018,
    macroContrast: 0.055, midContrast: 0.24, roughnessVariation: 0.055,
  })
}

/** Neutral dark mineral backing; subdued directional split-layer grain. */
export function createBenchDark(): MeshStandardNodeMaterial {
  return createSurface({
    kind: 'slate', name: 'vinci/bench-dark-mineral', colour: '#3c4449', roughness: 0.78,
    macroMetres: 1.2, midMetres: [0.075, 0.012], heightMetres: 0.0013,
    macroContrast: 0.06, midContrast: 0.42, roughnessVariation: 0.12,
  })
}
