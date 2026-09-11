import { BoxGeometry, Float32BufferAttribute, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardNodeMaterial, Path, Shape, type Material } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import timeline from './data/timeline.json'
import { createText } from '../words'

export type Stud = (typeof timeline.studs)[number]
export type Certainty = Stud['certainty']
export const CERTAINTY = {
  documented: { colour: '#71a98b', en: 'documented', de: 'belegt' },
  inferred: { colour: '#d7aa58', en: 'inferred', de: 'erschlossen' },
  tradition: { colour: '#d17c70', en: 'tradition', de: 'Überlieferung' },
} as const
const stationOrder = ['line-early', 'line-late', 'line-amboise']
export const STUDS = [...timeline.studs].sort((a,b)=>stationOrder.indexOf(a.station)-stationOrder.indexOf(b.station)||a.display_order-b.display_order)
export const SPACING = timeline.design.spacing
export const AFTERLIFE = timeline.design.afterlife
export const STUD_SPACING = 1.65
export interface LineMaterials { stone:Material; bronze:Material; ink:Material; dark:Material }

/** Merge only static meshes. Keep an honest noweld comparison for the bench. */
export function weld(group:Group):void {
  if (new URLSearchParams(location.search).has('noweld')) return
  group.updateMatrixWorld(true)
  const batches=new Map<Material,Mesh[]>()
  group.traverse(o=>{if(o instanceof Mesh&&!Array.isArray(o.material)&&!o.userData['noWeld']){const list=batches.get(o.material)??[];list.push(o);batches.set(o.material,list)}})
  for(const [material,meshes] of batches){
    if(meshes.length<2)continue
    const pieces=meshes.map(m=>{let g=m.geometry.clone().applyMatrix4(m.matrixWorld);if(g.index)g=g.toNonIndexed();g.deleteAttribute('normal');g.computeVertexNormals();const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=new Float32Array(pos.count*2);for(let i=0;i<pos.count;i++){const floor=Math.abs(normal.getY(i))>.5,side=Math.abs(normal.getX(i))>.5;uv[i*2]=floor?pos.getX(i):side?pos.getZ(i):pos.getX(i);uv[i*2+1]=floor?pos.getZ(i):pos.getY(i)}g.setAttribute('uv',new Float32BufferAttribute(uv,2));return g})
    const merged=mergeGeometries(pieces,false)
    if(merged){const m=new Mesh(merged,material);m.name='welded '+material.name;m.receiveShadow=true;m.castShadow=meshes.some(x=>x.castShadow);m.userData['manifestId']=meshes[0]?.userData['manifestId']??'vinci/bench-composition';m.userData['asset']=m.userData['manifestId'];m.userData['sourceManifestIds']=[...new Set(meshes.map(x=>x.userData['manifestId']).filter(Boolean))];m.userData['manifestClass']='GENERATED';group.add(m);for(const old of meshes){old.removeFromParent();old.geometry.dispose()}}
    for(const g of pieces)g.dispose()
  }
}

/** A selected date is one of 56 physical floor sockets, never an interval scale. */
export function createLine(materials:LineMaterials, selected=0, language:'en'|'de'='en', phone=false):Group {
  const group=new Group();group.name='56 dates, bronze let into limestone'
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:Material)=>{const m=new Mesh(new BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.receiveShadow=true;group.add(m);return m}
  const first=Math.max(0,selected-(phone?1:3)),last=Math.min(STUDS.length-1,selected+(phone?3:8))
  // Long coursed stone floor: large joints, the library's sediment, microscopic pores.
  for(let row=-6;row<10;row++)for(let col=-3;col<=3;col++){
    // The centre course is replaced by a socket only where a visible stud
    // exists. Before the first and beyond the last, the paving continues.
    if(col===0&&row>=first-selected&&row<=last-selected)continue
    box(1.585,.18,1.635,col*1.6,-.10,-row*STUD_SPACING,materials.stone)
  }
  const inlayMaterials=new Map<Certainty,MeshStandardNodeMaterial>()
  for(let n=first;n<=last;n++){
    const stud=STUDS[n]!, z=-(n-selected)*STUD_SPACING
    const shape=new Shape();shape.moveTo(-.795,-.815);shape.lineTo(.795,-.815);shape.lineTo(.795,.815);shape.lineTo(-.795,.815);shape.closePath()
    const hole=new Path();hole.absarc(0,0,.128,0,Math.PI*2,true);shape.holes.push(hole)
    const slab=new Mesh(new ExtrudeGeometry(shape,{depth:.18,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:1,curveSegments:24}),materials.stone);slab.rotation.x=-Math.PI/2;slab.position.set(0,-.18,z);slab.receiveShadow=true;group.add(slab)
    const socket=new Mesh(new CylinderGeometry(.123,.123,.065,32),materials.bronze);socket.position.set(0,-.026,z);socket.receiveShadow=true;group.add(socket)
    const fact=CERTAINTY[stud.certainty as keyof typeof CERTAINTY]
    let colour=inlayMaterials.get(stud.certainty)
    if(!colour){colour=new MeshStandardNodeMaterial({color:fact.colour,roughness:.65,metalness:.06});colour.name=stud.certainty;colour.userData['owned']=true;inlayMaterials.set(stud.certainty,colour)}
    const inlay=new Mesh(new CylinderGeometry(.061,.061,.009,24),colour);inlay.position.set(0,.003,z);inlay.userData['studId']=stud.id;group.add(inlay)
    const year=createText(stud.date.slice(0,4),{size:n===selected?.38:.23,depth:.002,maxWidth:1.4,material:materials.ink});year.mesh.rotation.x=-Math.PI/2;year.mesh.position.set(.31,.004,z+.23);group.add(year.mesh)
    const word=createText(language==='en'?stud.certainty:fact.de,{size:.087,depth:.001,maxWidth:1.5,material:materials.ink});word.mesh.rotation.x=-Math.PI/2;word.mesh.position.set(.33,.004,z-.22);group.add(word.mesh)
    box(.021,.008,1.635,-.3,.002,z,materials.bronze)
    if(n===selected){box(.022,.009,1.50,-.62,.002,z,materials.bronze);box(.95,.009,.016,-.16,.002,z+.64,materials.bronze);box(.95,.009,.016,-.16,.002,z-.64,materials.bronze)}
  }
  // Low rail with tenons and a stone sill; its continuation cues a walk.
  box(.075,.075,21,-1.35,.86,-5,materials.bronze).castShadow=true
  for(let n=-2;n<7;n++){box(.045,.8,.045,-1.35,.42,-n*2.4,materials.bronze).castShadow=true;box(.22,.08,.22,-1.35,.035,-n*2.4,materials.bronze).castShadow=true}
  group.traverse(o=>{if(o instanceof Mesh){o.userData['manifestId']='vinci/line-geometry';o.userData['asset']='vinci/line-geometry'}})
  weld(group)
  return group
}
