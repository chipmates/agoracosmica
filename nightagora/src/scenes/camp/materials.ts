/* THE PALETTE — every solid in this camp is one of these surfaces.

   Base is the silhouette value, albedo is what the firelight finds, rim is
   how much this surface remembers the fire at all. Gold is LIGHT here, so
   it lives only on reflective terms (the wreath, the aquila, the pilum
   heads, the shield bosses, the lamp body) and never as a fill.

   THE ONE PIGMENT is Roman red ochre, on exactly four surfaces (the scuta,
   the two vexilla, the sentries' crests, the praetorium groundcloth), and
   only ever visible where a fire finds it. */

import type { MeshBasicNodeMaterial } from 'three/webgpu'
import { DoubleSide } from 'three/webgpu'
import { inkMaterial, lin, OCHRE } from './hour'

export interface Palette {
  timber: MeshBasicNodeMaterial
  timberI: MeshBasicNodeMaterial
  earth: MeshBasicNodeMaterial
  earthStone: MeshBasicNodeMaterial
  stakes: MeshBasicNodeMaterial
  canvas: MeshBasicNodeMaterial
  kerb: MeshBasicNodeMaterial
  rubble: MeshBasicNodeMaterial
  ochre: MeshBasicNodeMaterial
  gilt: MeshBasicNodeMaterial
  aquila: MeshBasicNodeMaterial
  bronze: MeshBasicNodeMaterial
  coal: MeshBasicNodeMaterial
  log: MeshBasicNodeMaterial
  hearthStone: MeshBasicNodeMaterial
  bedroll: MeshBasicNodeMaterial
  tripod: MeshBasicNodeMaterial
  pot: MeshBasicNodeMaterial
  hide: MeshBasicNodeMaterial
  cloth: MeshBasicNodeMaterial
  helm: MeshBasicNodeMaterial
  load: MeshBasicNodeMaterial
  raven: MeshBasicNodeMaterial
  post: MeshBasicNodeMaterial
  carve: MeshBasicNodeMaterial
  praetorium: MeshBasicNodeMaterial
  flap: MeshBasicNodeMaterial
  floor: MeshBasicNodeMaterial
  parchment: MeshBasicNodeMaterial
  lamp: MeshBasicNodeMaterial
  rug: MeshBasicNodeMaterial
  cloak: MeshBasicNodeMaterial
  cuirass: MeshBasicNodeMaterial
}

let cached: Palette | null = null

export function palette(): Palette {
  if (cached) return cached
  cached = {
    timber: inkMaterial({ rim: 0.36, albedo: '#8A7358', baseK: 0.46 }),
    timberI: inkMaterial({ rim: 0.36, albedo: '#8A7358', baseK: 0.46, instanced: true }),
    earth: inkMaterial({ rim: 0.3, albedo: '#8B7A62', baseK: 0.44, facePow: 1.4 }),
    earthStone: inkMaterial({ rim: 0.65, albedo: '#8E8574', baseK: 0.46, facePow: 1.2 }),
    stakes: inkMaterial({ rim: 0.5, albedo: '#9A8161', baseK: 0.5, instanced: true }),
    canvas: inkMaterial({
      rim: 0.86,
      albedo: '#B49C7C',
      baseD: '#22243C',
      baseK: 0.34,
      ambK: 0.072,
      emberK: 0.2,
      facePow: 1.9,
      instanced: true,
    }),
    kerb: inkMaterial({
      rim: 0.72, albedo: '#9E9280', baseK: 0.4, ambK: 0.05, facePow: 1.1, instanced: true,
    }),
    rubble: inkMaterial({
      rim: 0.58, albedo: '#8E8474', baseK: 0.38, ambK: 0.045, facePow: 1.1, instanced: true,
    }),
    // the one pigment is paint LIT BY FIRE: away from a flame it sinks to
    // the same navy as everything else, so it never reads as pink cloth
    ochre: inkMaterial({
      rim: 0.66, albedo: '#8E3B22', baseD: '#2A2033', baseK: 0.46, ambK: 0.042,
      emberK: 0.07, side: DoubleSide,
    }),
    gilt: inkMaterial({ rim: 0.85, albedo: '#E6BC5C', baseK: 0.46, facePow: 2.6 }),
    aquila: inkMaterial({ rim: 0.32, albedo: '#C6A263', baseK: 0.46, facePow: 3.0 }),
    bronze: inkMaterial({ rim: 1.05, albedo: '#C08A49', baseK: 0.5, side: DoubleSide }),
    coal: inkMaterial({ rim: 1.5, albedo: '#E0762C', baseK: 0.44, facePow: 1.0 }),
    log: inkMaterial({ rim: 1.25, albedo: '#B07340', baseK: 0.46 }),
    hearthStone: inkMaterial({ rim: 0.95, albedo: '#9F8F79', baseK: 0.48, instanced: true }),
    bedroll: inkMaterial({ rim: 0.8, albedo: '#8E6E52', baseK: 0.5 }),
    tripod: inkMaterial({ rim: 0.7, albedo: '#7E6A52', baseK: 0.5, side: DoubleSide }),
    pot: inkMaterial({ rim: 1.1, albedo: '#6E6A66', baseK: 0.46 }),
    hide: inkMaterial({ rim: 0.44, albedo: '#6B5240', baseK: 0.5 }),
    cloth: inkMaterial({ rim: 0.34, albedo: '#6E6152', baseK: 0.52, side: DoubleSide }),
    helm: inkMaterial({ rim: 1.1, albedo: '#8C8478', baseK: 0.48 }),
    load: inkMaterial({ rim: 0.4, albedo: '#9A8A6E', baseK: 0.5 }),
    raven: inkMaterial({ rim: 0.55, albedo: '#4A4A56', baseK: 0.35 }),
    post: inkMaterial({ rim: 0.95, albedo: '#A98B62', baseK: 0.48 }),
    carve: inkMaterial({ rim: 1.6, albedo: '#CBB183', baseK: 0.5, facePow: 1.1 }),
    // the only lantern on the planet (Hearth law)
    praetorium: inkMaterial({
      rim: 0.5,
      albedo: '#CDBA9A',
      baseD: '#282A40',
      baseK: 0.5,
      inner: true,
      innerC: '#F09040',
      innerK: 0.048,
      side: DoubleSide,
    }),
    // the OUTSIDE of a folded flap: cloth that only the doorway's own
    // spill finds, never a lantern of its own
    flap: inkMaterial({
      rim: 0.34, albedo: '#9C8B70', baseD: '#22243A', baseK: 0.42, ambK: 0.05, side: DoubleSide,
    }),
    floor: inkMaterial({ rim: 0.62, albedo: '#8C7A5E', baseK: 0.34, facePow: 1.5 }),
    parchment: inkMaterial({ rim: 0.34, albedo: '#D8C9A4', baseD: '#2E2F42', baseK: 0.5, facePow: 1.2 }),
    lamp: inkMaterial({ rim: 0.3, albedo: '#B08A5C', baseK: 0.5 }),
    rug: inkMaterial({
      rim: 0.16,
      albedo: `#${OCHRE.clone().lerp(lin('#6E5A44'), 0.72).getHexString()}`,
      baseK: 0.4,
      facePow: 1.6,
    }),
    cloak: inkMaterial({
      rim: 0.2,
      albedo: `#${OCHRE.clone().lerp(lin('#3E3227'), 0.66).getHexString()}`,
      baseK: 0.5,
      side: DoubleSide,
    }),
    cuirass: inkMaterial({
      rim: 0.24,
      albedo: `#${OCHRE.clone().lerp(lin('#9C8158'), 0.5).getHexString()}`,
      baseK: 0.5,
      side: DoubleSide,
    }),
  }
  return cached
}
