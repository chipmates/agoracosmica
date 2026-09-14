import { BoxGeometry, Float32BufferAttribute, CylinderGeometry, LatheGeometry, Vector2, ExtrudeGeometry, Group, Mesh, MeshStandardNodeMaterial, Path, Shape, type Material } from 'three/webgpu'
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
    const pieces=meshes.map(m=>{let g=m.geometry.clone().applyMatrix4(m.matrixWorld);if(g.index)g=g.toNonIndexed();if(!g.getAttribute('normal'))g.computeVertexNormals();const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=new Float32Array(pos.count*2);for(let i=0;i<pos.count;i++){const floor=Math.abs(normal.getY(i))>.5,side=Math.abs(normal.getX(i))>.5;uv[i*2]=floor?pos.getX(i):side?pos.getZ(i):pos.getX(i);uv[i*2+1]=floor?pos.getZ(i):pos.getY(i)}g.setAttribute('uv',new Float32BufferAttribute(uv,2));return g})
    const merged=mergeGeometries(pieces,false)
    if(merged){const m=new Mesh(merged,material);m.name='welded '+material.name;m.receiveShadow=true;m.castShadow=meshes.some(x=>x.castShadow);m.userData['manifestId']=meshes[0]?.userData['manifestId']??'vinci/bench-composition';m.userData['asset']=m.userData['manifestId'];m.userData['sourceManifestIds']=[...new Set(meshes.map(x=>x.userData['manifestId']).filter(Boolean))];m.userData['manifestClass']='GENERATED';group.add(m);for(const old of meshes){old.removeFromParent();old.geometry.dispose()}}
    for(const g of pieces)g.dispose()
  }
}

/** A selected date is one of 56 physical floor sockets, never an interval scale. */
export function createLine(materials:LineMaterials, selected=0, language:'en'|'de'='en', phone=false):Group {
  const group=new Group();group.name='56 dates, bronze let into limestone'
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:Material)=>{const m=new Mesh(new BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.receiveShadow=true;group.add(m);return m}
  const ashlar=(width:number,height:number,depth:number,x:number,y:number,z:number)=>{
    const face=new Shape();face.moveTo(-width/2,-height/2);face.lineTo(width/2,-height/2);face.lineTo(width/2,height/2);face.lineTo(-width/2,height/2);face.closePath()
    const mesh=new Mesh(new ExtrudeGeometry(face,{depth,bevelEnabled:true,bevelSize:.016,bevelThickness:.012,bevelSegments:1}),materials.dark)
    mesh.position.set(x,y,z);mesh.receiveShadow=true;group.add(mesh);return mesh
  }
  const first=Math.max(0,selected-(phone?1:3)),last=Math.min(STUDS.length-1,selected+(phone?3:8))
  // Long coursed stone floor: large joints, the library's sediment, microscopic pores.
  box(11.2,.20,26.4,0,-.122,-2.475,materials.dark)
  for(let row=-6;row<10;row++)for(let col=-3;col<=3;col++){
    // The centre course is replaced by a socket only where a visible stud
    // exists. Before the first and beyond the last, the paving continues.
    if(col===0&&row>=first-selected&&row<=last-selected)continue
    box(1.585,.18,1.635,col*1.6,-.10,-row*STUD_SPACING,materials.stone)
  }
  // A low gallery wall contains the walk. Recessed bays, projecting sill and
  // mineral grain give the left edge scale without competing with the dates.
  box(.30,2.65,27,-3.65,1.31,-3.3,materials.dark)
  for(let course=0;course<4;course++)for(let stone=0;stone<18;stone++){
    const z=9.42-stone*1.6+(course%2)*.80
    const face=ashlar(1.55,.515,.10,-3.49,.57+course*.55,z);face.rotation.y=Math.PI/2
  }
  box(.46,.22,27,-3.54,.10,-3.3,materials.stone)
  // A broad coping with a drip course: the parapet's head is a made thing the
  // low light can model, not a strip laid on top of the masonry.
  box(.88,.105,27,-3.50,2.715,-3.3,materials.stone)
  box(.96,.055,27,-3.48,2.635,-3.3,materials.stone)
  box(.74,.030,27,-3.52,2.594,-3.3,materials.bronze)
  box(.30,.045,27,-3.86,2.645,-3.3,materials.stone)
  // Coping stones are laid, not poured: an open joint every 1.6 m.
  for(let n=-4;n<12;n++)box(.90,.12,.016,-3.50,2.712,9.4-n*1.6,materials.dark).castShadow=true
  for(let bay=0;bay<6;bay++){
    const z=9.9-bay*4.8
    box(.38,2.41,.22,-3.45,1.43,z,materials.dark)
    box(.42,.07,.32,-3.45,2.57,z,materials.stone)
  }
  // The far transverse sill meets the floor; the route remains open ahead.
  box(2.45,2.65,.30,-2.425,1.325,-15.56,materials.dark)
  box(4.40,2.65,.30,3.40,1.325,-15.56,materials.dark)
  box(2.4,.28,.30,0,2.51,-15.56,materials.dark)
  box(9.30,.10,.46,.975,2.70,-15.56,materials.stone)
  // Deep reveals and staggered ashlar faces finish the end wall around the
  // open threshold. Chamfered faces catch light without another material.
  for(const [left,right] of [[-3.65,-1.2],[1.2,5.6]]){
    for(let row=0;row<4;row++){
      const joint=.045,course=.60,start=left!-(row%2)*.62
      for(let x=start;x<right!;x+=1.24){const a=Math.max(left!,x),b=Math.min(right!,x+1.24);if(b-a>.08)ashlar(b-a-joint,course-joint,.11,(a+b)/2,.37+row*course,-15.39)}
    }
    box(right!-left!,.18,.43,(left!+right!)/2,.09,-15.48,materials.stone)
  }
  for(const x of [-1.2,1.2])box(.12,2.40,.52,x,1.20,-15.44,materials.stone)
  // Beyond the threshold the walk continues: paving, two returns and a far
  // cross wall that takes a little of the same light. The opening is depth,
  // not a dark panel in a wall.
  box(2.42,.20,7.4,0,-.122,-19.4,materials.dark)
  for(let row=0;row<5;row++)box(2.36,.18,1.46,0,-.10,-16.1-row*1.52,materials.stone)
  for(const side of [-1,1]){
    box(.34,2.9,7.4,side*1.38,1.45,-19.4,materials.dark)
    for(let course=0;course<4;course++)for(let stone=0;stone<5;stone++)box(.10,.52,1.42,side*1.20,.36+course*.58,-16.2-stone*1.5,materials.dark)
    box(.42,.20,7.4,side*1.32,.09,-19.4,materials.stone)
  }
  box(3.4,3.1,.34,0,1.55,-23.3,materials.dark)
  box(3.4,.16,.42,0,2.86,-23.16,materials.stone)
  box(2.9,.12,.30,0,.09,-23.05,materials.stone)
  for(let course=0;course<4;course++)for(let bay=0;bay<3;bay++)box(.92,.50,.12,-.96+bay*.96,.36+course*.58,-23.06,materials.dark)
  const inlayMaterials=new Map<Certainty,MeshStandardNodeMaterial>()
  for(let n=first;n<=last;n++){
    const stud=STUDS[n]!, z=-(n-selected)*STUD_SPACING
    const shape=new Shape();shape.moveTo(-.795,-.815);shape.lineTo(.795,-.815);shape.lineTo(.795,.815);shape.lineTo(-.795,.815);shape.closePath()
    const hole=new Path();hole.absarc(0,0,.128,0,Math.PI*2,true);shape.holes.push(hole)
    const slab=new Mesh(new ExtrudeGeometry(shape,{depth:.18,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:1,curveSegments:24}),materials.stone);slab.rotation.x=-Math.PI/2;slab.position.set(0,-.18,z);slab.receiveShadow=true;group.add(slab)
    const recess=new Mesh(new CylinderGeometry(.127,.127,.052,48),materials.ink);recess.position.set(0,-.047,z);recess.receiveShadow=true;group.add(recess)
    const profile=[[.068,-.024],[.068,-.005],[.075,.006],[.113,.006],[.123,-.001],[.123,-.024],[.068,-.024]].map(([r,y])=>new Vector2(r!,y!)).reverse()
    const socket=new Mesh(new LatheGeometry(profile,64),materials.bronze);socket.position.set(0,0,z);socket.receiveShadow=true;group.add(socket)
    const fact=CERTAINTY[stud.certainty as keyof typeof CERTAINTY]
    let colour=inlayMaterials.get(stud.certainty)
    if(!colour){colour=new MeshStandardNodeMaterial({color:fact.colour,roughness:.65,metalness:.06});colour.name=stud.certainty;colour.userData['owned']=true;inlayMaterials.set(stud.certainty,colour)}
    const inlay=new Mesh(new CylinderGeometry(.061,.061,.009,24),colour);inlay.position.set(0,-.009,z);inlay.userData['studId']=stud.id;group.add(inlay)
    const cue=stud.id==='life-30'?(language==='en'?'Anghiari contract':'Anghiari-Vertrag'):stud.id==='life-31'?(language==='en'?"Father’s death":'Tod des Vaters'):undefined
    // The year is bronze set into the paving, not a mark lying on it. The
    // socket course's dressed face is 3 mm over the group's origin, so the
    // numeral runs from 0.5 mm under it to 2 mm over: it crosses the floor
    // surface and takes the room's light as metal does, with no gap beneath.
    // The words beside it stay painted, 1.6 mm proud.
    const
year=createText(stud.date.slice(0,4),{embedded:true,size:n===selected?.38:phone?.27:.23,depth:.005,maxWidth:1.4,material:materials.bronze});year.mesh.rotation.x=-Math.PI/2;year.mesh.position.set(.31,.0005,z+(cue?.08:.23));group.add(year.mesh)
    const
word=createText(language==='en'?stud.certainty:fact.de,{embedded:true,size:phone?.115:.087,depth:.0038,maxWidth:1.5,material:materials.ink});word.mesh.rotation.x=-Math.PI/2;word.mesh.position.set(.33,.0010,z-.22);group.add(word.mesh)
    if(cue){const
event=createText(cue,{embedded:true,size:phone?.115:.095,depth:.0038,maxWidth:1.48,material:materials.ink});event.mesh.rotation.x=-Math.PI/2;event.mesh.position.set(.33,.0010,z+.60);group.add(event.mesh)}
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
