import {
  BoxGeometry, BufferGeometry, Group, Material, Mesh, Object3D, Vector3,
} from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createText } from '../words'

/** Reusable exhibition materials. The host supplies its TSL node materials. */
export interface ExhibitMaterials {
  stone: Material
  plaster: Material
  bronze: Material
  ink: Material
  dark: Material
  /** The gallery's own wall surface. Falls back to the dark mineral. */
  backing?: Material
}

export interface ExhibitionObject<M = Record<string, unknown>> {
  group: Group
  metadata: M
  /** Disposes owned geometry; host materials and supplied plate remain owned by the host. */
  dispose: () => void
}

/** Static construction is welded by material. The inspection switch is preserved. */
export class Construction {
  readonly group = new Group()
  private readonly batches = new Map<Material, BufferGeometry[]>()

  constructor(readonly materials: ExhibitMaterials, name: string, readonly manifestId = 'vinci/myths-geometry') {
    this.group.name = name
    this.group.userData.manifestClass = 'GENERATED'
    this.group.userData.manifestId = manifestId
  }

  geometry(geometry: BufferGeometry, material: Material): void {
    const batch = this.batches.get(material) ?? []
    batch.push(geometry)
    this.batches.set(material, batch)
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, material: Material): void {
    const geometry = new BoxGeometry(w, h, d)
    geometry.translate(x, y, z)
    this.geometry(geometry, material)
  }

  beam(from: [number, number, number], to: [number, number, number], width: number, depth: number, material: Material): void {
    const a = new Vector3(...from)
    const b = new Vector3(...to)
    const object = new Object3D()
    object.position.copy(a).add(b).multiplyScalar(0.5)
    object.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize())
    object.updateMatrix()
    const geometry = new BoxGeometry(width, a.distanceTo(b), depth)
    geometry.applyMatrix4(object.matrix)
    this.geometry(geometry, material)
  }

  text(text: string, x: number, y: number, z: number, size: number, maxWidth: number, material = this.materials.ink, depth = 0.0018): { width: number; height: number; lines: string[]; lineWidths: number[] } {
    const result = createText(text, { size, maxWidth, material, depth, lineHeight: 1.45, embedded: true })
    result.mesh.geometry.translate(x, y, z)
    this.geometry(result.mesh.geometry, material)
    return result
  }

  finish(): Group {
    const noweld = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noweld')
    for (const [material, geometries] of this.batches) {
      // Text and primitives do not necessarily expose the same attribute set.
      // The physical inscriptions only need positions/normals/uv for host materials.
      const normalized = geometries.map((original) => {
        const geometry = original.index ? original.toNonIndexed() : original
        if (geometry !== original) original.dispose()
        for (const name of Object.keys(geometry.attributes)) {
          if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name)
        }
        return geometry
      })
      const add = (geometry: BufferGeometry): void => {
        const mesh = new Mesh(geometry, material)
        mesh.castShadow = material !== this.materials.ink
        mesh.receiveShadow = true
        mesh.name = `${this.group.name}-made-surface`
        mesh.userData.manifestClass = 'GENERATED'
        mesh.userData.manifestId = this.manifestId
        this.group.add(mesh)
      }
      if (noweld) normalized.forEach(add)
      else {
        const merged = mergeGeometries(normalized, false)
        if (merged) add(merged)
        normalized.forEach((geometry) => geometry.dispose())
      }
    }
    this.batches.clear()
    return this.group
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose()
    })
    this.group.removeFromParent()
  }
}

/** Large backing, recessed joint bands and small edge repairs; fine grain belongs to the host material. */
export function plasterWall(build: Construction, width: number, height: number, centreY: number, z: number): void {
  const { plaster, stone } = build.materials
  build.box(0, centreY, z - 0.16, width, height, 0.30, plaster)
  build.box(0, centreY - height / 2 + 0.10, z + 0.03, width + 0.12, 0.2, 0.18, stone)
  build.box(0, centreY + height / 2 - 0.06, z + 0.015, width + 0.07, 0.12, 0.16, stone)
  for (let side = -1; side <= 1; side += 2) {
    build.box(side * (width / 2 - 0.055), centreY, z + 0.015, 0.11, height, 0.13, stone)
  }
  // Wear is carried by the material and the real wall junction; no rows of
  // decorative subpixel ticks cross the reading surface.

}

/** A real shallow stone floor, with staggered joints and irregular wear at the
 * display. It is laid at the size it is given: a host that stands the floor in
 * a built room cuts it to that room's footprint, so a minimum here would be a
 * slab running through the walls around it. */
export function exhibitionFloor(build: Construction, width = 13, depth = 12): void {
  const { stone, dark } = build.materials
  // Each joint is the open interval between complete slabs over a mortar bed.
  // No overlaid subpixel strokes or freestanding diagonal chips.
  build.box(0, -0.1155, 2.5, width, 0.20, depth, dark)
  const minZ = 2.5 - depth / 2
  for (let row = 0; row < Math.ceil(depth / 1.4); row++) {
    const z0 = minZ + row * 1.4
    const z1 = Math.min(minZ + depth, z0 + 1.4)
    const offset = row % 2 === 0 ? 0 : 0.9
    for (let col = -Math.ceil(width / 3.6)-1; col <= Math.ceil(width / 3.6); col++) {
      const x0 = Math.max(-width / 2, col * 1.8 + offset)
      const x1 = Math.min(width / 2, (col + 1) * 1.8 + offset)
      if (x1 - x0 < .04) continue
      build.box((x0+x1)/2, -.115, (z0+z1)/2, x1-x0-.026, .20, z1-z0-.026, stone)
    }
  }
}

/** Modern gallery enclosure; never a reconstruction of a historical room.
 * The wall carries its own three scales: bays with real shadow gaps, a dado
 * and a cornice band that model the raking light, and a fine head bead. */
export function galleryBackdrop(build: Construction, width=18, backZ=-5.5, height=6, quiet=false): void {
  const {dark,stone}=build.materials
  const backing=build.materials.backing??dark
  const plinth=.46, cornice=.34, gap=quiet?.075:.05
  const field=height-plinth-cornice
  build.box(0,height/2,backZ-.16,width,height,.30,backing)
  // Each bay is a stack of cast boards: a real 0.6 m rhythm with open joints,
  // so the raking light finds an edge every board instead of one flat field.
  const board=.58, joint=.017
  const bay=(x:number,w:number,z:number)=>{
    for(let n=0,y=plinth;y<plinth+field-.12;n++,y+=board+joint){
      const h=Math.min(board,plinth+field-y)
      build.box(x,y+h/2,z+(n%2?.004:0),w,h,.112+(n%2?.007:0),backing)
      build.box(x,y+h-.011,z+.070+(n%2?.004:0),w-.05,.022,.024,backing)
    }
  }
  const bays=Math.max(2,Math.round(width/(quiet?4.4:2.4))), bayWidth=width/bays
  for(let n=0;n<bays;n++)bay(-width/2+(n+.5)*bayWidth,bayWidth-gap,backZ+.02)
  build.box(0,.105,backZ+.13,width+.1,.21,.40,stone)
  build.box(0,.25,backZ+.055,width,.06,.25,backing)
  // Dado line under the bays and a shallow cornice over them: the two bands
  // that keep a long wall from being one field.
  build.box(0,plinth-.045,backZ+.05,width,.09,.26,backing)
  build.box(0,plinth-.115,backZ+.028,width,.055,.20,backing)
  build.box(0,height-cornice+.10,backZ+.045,width,.115,.245,backing)
  build.box(0,height-cornice+.205,backZ+.012,width,.075,.175,backing)
  /** A RUN THAT ENDS ON ANOTHER RUN'S END PLANE FIGHTS IT. The return wall,
   * its stone base and its two bands are one body and all four used to stop
   * on one plane, so at the open end a pale end face and three dark ones sat
   * at the same depth: from the court that reads as a comb of stripes, and it
   * breaks up as the eye moves. The three inset runs stop a bed short of the
   * wall they are set into; nothing moves on any face a visitor sees along. */
  const END=.006
  for(const side of [-1,1]){
    build.box(side*width/2,height/2,backZ+10,.3,height,20.3,backing)
    build.box(side*(width/2-.09),.105,backZ+10-END,.42,.21,20.3-END*2,stone)
    build.box(side*(width/2-.14),plinth-.045,backZ+10-END,.16,.09,20.3-END*2,backing)
    build.box(side*(width/2-.13),height-cornice+.10,backZ+10-END,.155,.115,20.3-END*2,backing)
    for(let n=0;n<8;n++){
      const z=backZ+.1+(n+.5)*2.5
      for(let row=0,y=plinth;y<plinth+field-.12;row++,y+=board+joint){
        const h=Math.min(board,plinth+field-y)
        build.box(side*(width/2-.16),y+h/2,z,.108+(row%2?.006:0),h,2.5-gap,backing)
      }
    }
  }
}
