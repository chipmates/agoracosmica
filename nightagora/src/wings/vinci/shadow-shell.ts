import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh,
  MeshBasicNodeMaterial, Vector3,
} from 'three/webgpu'

const SHADOW_TRIANGLE_LIMIT = 3000
const ENTRY_SHADOW_TRIANGLE_LIMIT = 600
const FOUNDATION_SHADOW_TRIANGLE_LIMIT = 1000
const toneIs = (value:number, authored:number):boolean => value === Math.fround(authored)

interface SelectedTriangle {
  mesh: Mesh
  indices: [number,number,number]
  area: number
  kind: string
}

/** The existing shell's structural faces, without its repeated surface relief.
 * The backing faces already contain the exact cut apertures and gable outlines;
 * the slate base already contains the roof unions and dormer cuts. Taking those
 * actual triangles avoids a second, gradually divergent architectural model.
 *
 * The constant tones below identify emissions in shell.ts, not brightness tests:
 * .76 is a facade backing, .83 a slate course lip, .80/.82 a chimney body/cap,
 * .70 a roof underside, .72 the complete open oak door leaf, .88 an inner wall.
 * Small ridge caps and carved trim are below this calm shadow's resolution.
 * Keep this selector beside any change to those structural emissions.
 *
 * Return a sibling of the supplied shell, with its current world transform.
 * The caller owns tier selection and disabling the detailed shell's casters.
 * The helper never mutates the supplied geometry, materials or shadow flags.
 */
export function createShellShadowDouble(shell:Group,entry?:Group):Group {
  shell.updateWorldMatrix(true,true)
  const essential:SelectedTriangle[] = [], timber:SelectedTriangle[] = [], foundation:SelectedTriangle[] = []
  let expectedFoundationTriangles=0
  const sourceCounts:Record<string,number> = {}
  const a=new Vector3(),b=new Vector3(),c=new Vector3(),ab=new Vector3(),ac=new Vector3()

  shell.traverse(object=>{
    if(!(object instanceof Mesh))return
    const kind=object.name.split('/').at(-1)??''
    if(!['stone','slate','brick','oak','dark','clay'].includes(kind))return
    const p=object.geometry.getAttribute('position'),tones=object.geometry.getAttribute('tone')
    if(!p||!tones)return
    const index=object.geometry.getIndex(),count=index?.count??p.count
    const plinth=object.userData['foundationPlinth'] as {startVertex:number;structuralVertices:number;allVertices:number}|undefined
    if(plinth){if(index)throw new Error('Foundation range requires its actual unindexed source');expectedFoundationTriangles+=plinth.structuralVertices/3}
    for(let offset=0;offset+2<count;offset+=3){
      const indices:[number,number,number]=index
        ?[index.getX(offset),index.getX(offset+1),index.getX(offset+2)]
        :[offset,offset+1,offset+2]
      const i=indices[0],tone=tones.getX(i)
      a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,indices[1]);c.fromBufferAttribute(p,indices[2])
      const area=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5
      sourceCounts[kind]=(sourceCounts[kind]??0)+1
      if(plinth&&i>=plinth.startVertex&&i<plinth.startVertex+plinth.allVertices){
        if(i<plinth.startVertex+plinth.structuralVertices)foundation.push({mesh:object,indices,area,kind})
        continue
      }
      if(area<1e-10)continue
      let keep=false,secondary=false
      if(kind==='stone')keep=toneIs(tone,.76)
      if(kind==='slate')keep=!toneIs(tone,.83)&&(!toneIs(tone,1)||area>.07)
      if(kind==='brick')keep=toneIs(tone,.8)||toneIs(tone,.82)||toneIs(tone,1)
      if(kind==='clay')keep=true
      // The outer backing is double-sided, so the matching inner wall adds
      // no silhouette. Window backs and dormer fronts remain real opaque faces.
      if(kind==='dark')keep=!toneIs(tone,.88)&&area>.04
      if(kind==='oak'){
        keep=toneIs(tone,.72)
        secondary=!keep&&!toneIs(tone,.7)&&area>.1
      }
      const triangle={mesh:object,indices,area,kind}
      if(keep)essential.push(triangle)
      else if(secondary)timber.push(triangle)
    }
  })

  // Never meet a budget by dropping a structural wall, aperture or roof face.
  // An evolved shell that exceeds this bound must have its proxy reviewed.
  if(essential.length===0||essential.length>SHADOW_TRIANGLE_LIMIT){
    throw new Error(`Shell shadow structure has ${essential.length} triangles; expected 1–${SHADOW_TRIANGLE_LIMIT}`)
  }
  if(foundation.length!==expectedFoundationTriangles||foundation.length>FOUNDATION_SHADOW_TRIANGLE_LIMIT||foundation.some(t=>t.area<1e-10))
    throw new Error(`Foundation shadow structure has ${foundation.length} triangles; expected ${expectedFoundationTriangles}, at most ${FOUNDATION_SHADOW_TRIANGLE_LIMIT}`)
  timber.sort((left,right)=>right.area-left.area)
  const selected=essential.concat(timber.slice(0,SHADOW_TRIANGLE_LIMIT-essential.length))
  const inverse=new Matrix4().copy(shell.matrixWorld).invert()
  const transforms=new Map<Mesh,Matrix4>(),positions:number[]=[],counts:Record<string,number>={}
  for(const triangle of [...selected,...foundation]){
    let transform=transforms.get(triangle.mesh)
    if(!transform){
      transform=new Matrix4().multiplyMatrices(inverse,triangle.mesh.matrixWorld)
      transforms.set(triangle.mesh,transform)
    }
    const p=triangle.mesh.geometry.getAttribute('position')
    for(const i of triangle.indices){
      a.fromBufferAttribute(p,i).applyMatrix4(transform)
      positions.push(a.x,a.y,a.z)
    }
    counts[triangle.kind]=(counts[triangle.kind]??0)+1
  }
  // The separately authored threshold enclosure is opaque construction.
  // Copy every source triangle into this existing draw, including beams and
  // both storey surfaces. No source material, surface or caster flag changes.
  const entryCounts:Record<string,number>={},entryManifestIds=new Set<string>()
  let entryTriangles=0
  if(entry){
    entry.updateWorldMatrix(true,true)
    entry.traverse(object=>{
      if(!(object instanceof Mesh))return
      const p=object.geometry.getAttribute('position'),index=object.geometry.getIndex()
      if(!p)return
      const count=index?.count??p.count,transform=new Matrix4().multiplyMatrices(inverse,object.matrixWorld)
      if(count%3!==0)throw new Error(`Entry shadow source ${object.name} is not triangulated`)
      for(let offset=0;offset<count;offset++){
        a.fromBufferAttribute(p,index?index.getX(offset):offset).applyMatrix4(transform)
        positions.push(a.x,a.y,a.z)
      }
      entryCounts[object.name]=count/3;entryTriangles+=count/3
      const manifestId=object.userData['manifestId'];if(typeof manifestId==='string')entryManifestIds.add(manifestId)
    })
    if(entryTriangles===0||entryTriangles>ENTRY_SHADOW_TRIANGLE_LIMIT)
      throw new Error(`Entry shadow structure has ${entryTriangles} triangles; expected 1–${ENTRY_SHADOW_TRIANGLE_LIMIT}`)
  }
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere()
  // The stack's established silent-double path: visible to the shadow pass,
  // with an ordinary material that samples no light, map, texture or attribute.
  const material=new MeshBasicNodeMaterial({colorWrite:false,depthWrite:false,side:DoubleSide})
  material.shadowSide=DoubleSide
  const mesh=new Mesh(geometry,material)
  mesh.name='vinci/shell-shadow/structure'
  mesh.castShadow=true;mesh.receiveShadow=false;mesh.frustumCulled=false;mesh.renderOrder=-1
  mesh.userData['labelOccluder']=false;mesh.userData['naLabelOccluder']=false
  mesh.raycast=()=>{}

  const group=new Group()
  group.name='vinci/shell-shadow'
  group.matrix.copy(shell.matrixWorld);group.matrixAutoUpdate=false
  group.userData['labelOccluder']=false;group.userData['naLabelOccluder']=false
  group.userData['triangles']=selected.length+foundation.length+entryTriangles
  group.userData['shadowStructure']={
    sourceCounts,retainedCounts:counts,essentialTriangles:essential.length,
    omittedTimberTriangles:timber.length-(selected.length-essential.length),
    triangleLimit:SHADOW_TRIANGLE_LIMIT,
    foundationTriangles:foundation.length,foundationTriangleLimit:FOUNDATION_SHADOW_TRIANGLE_LIMIT,foundationProvenance:shell.userData['foundationPlinth'],
    entryTriangles,entryCounts,entryTriangleLimit:ENTRY_SHADOW_TRIANGLE_LIMIT,
    entryManifestIds:[...entryManifestIds],entryProvenance:entry?.userData,
    entryBasis:entry?'All original A-LAYOUT threshold enclosure triangles: partitions with side portal cuts, terracotta floor, complete first-storey assembly and oak members. Copied at actual source transforms; no geometry simplification.':undefined,
    basis:'Actual registered shell backing, cut roof, chimney, window-back and door-leaf triangles. Repeated courses, small ridge pieces, lead cames and carved ornament omitted for the calm shadow map.',
  }
  group.add(mesh)
  return group
}
