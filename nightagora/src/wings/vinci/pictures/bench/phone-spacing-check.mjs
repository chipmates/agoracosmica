#!/usr/bin/env node
/** CPU projection of the actual hang and frame geometry. Material maps,
 * image decoding, directional-contact transport and DOM are doubles; no
 * browser, visibility culling or image modification is involved. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import * as Three from 'three/webgpu'
import * as TSL from 'three/tsl'

const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../../..'),hashes={},modules=new Map()
const read=file=>{
  const full=path.resolve(app,file);assert.ok(full.startsWith(app+path.sep))
  const text=fs.readFileSync(full,'utf8');hashes[path.relative(app,full)]=createHash('sha256').update(text).digest('hex');return text
}
class Element {
  constructor(){this.children=[];this.dataset={};this.style={setProperty(){}}}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(...nodes){this.children=nodes}
  setAttribute(){}
  remove(){}
}
const streamDouble=()=>({material:new Three.MeshStandardNodeMaterial(),ready:Promise.resolve(),
  available:()=>true,pending:()=>0,error:()=>null,textureMB:()=>0,
  allocation:()=>({previewMB:0,fullMB:0}),high:()=>Promise.resolve(),update(){},dispose(){this.material.dispose()}})
function load(file){
  const full=path.resolve(app,file);if(modules.has(full))return modules.get(full)
  const exports={};modules.set(full,exports)
  const js=ts.transpileModule(read(full),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
  vm.runInNewContext(js,{exports,console,document:{createElement:()=>new Element()},require(id){
    if(id==='three'||id==='three/webgpu')return Three
    if(id==='three/tsl')return TSL
    if(id==='./stream')return{createPlateStream:streamDouble}
    if(id==='./directional-contact')return{buildBakedFrameContact:()=>({group:new Three.Group(),setVisible(){},dispose(){},stats:{fixture:'No contact transport needed for solid frame bounds'}})}
    assert.ok(id.startsWith('.'),id)
    if(id.endsWith('?raw'))return{default:read(path.resolve(path.dirname(full),id.slice(0,-4)))}
    return load(path.resolve(path.dirname(full),id+'.ts'))
  }},{filename:full})
  return exports
}
const pictures=load('src/wings/vinci/pictures/index.ts'),frameModule=load('src/wings/vinci/pictures/frame.ts')
// The signature print hangs only without the capture chosen over it, so that choice is set aside here.
const chosen=JSON.parse(read('public/na-manifest.json')).assets.filter(e=>e.chosen_over?.length)
const all=JSON.parse(read('public/na-manifest.json')).assets.filter(e=>!chosen.some(c=>c.work_id===e.work_id&&c.plate_id===e.plate_id)),manifest={all,byId:new Map(all.map(e=>[e.id,e]))}
const benchSource=read('src/wings/vinci/pictures/bench/index.ts')
const gap=Number(benchSource.match(/completeHang \? \{ gapM: ([\d.]+) \}/)?.[1]);assert.equal(gap,2)
const config=JSON.parse(read('src/wings/vinci/pictures/bench/gi-config.json')).segments.find(r=>r.segment==='complete-hang')
assert.equal(config.extent,89.48403834732778)
const material=()=>{const m=new Three.MeshStandardNodeMaterial();m.colorNode=TSL.vec3(1);m.roughnessNode=TSL.float(.5);return m}
const set={albedo:new Three.Color(1,1,1),roughness:.5,metalness:0,material}
const stack={materials:{sync:()=>set},detail(m){m.colorNode??=TSL.vec3(1);m.roughnessNode??=TSL.float(.5)},tierName:()=> 'standard'}
const hang=pictures.buildHang(stack,pictures.segmentWorks('complete-hang'),manifest,{gapM:gap})
await Promise.resolve();hang.setVisible();hang.wall.updateMatrixWorld(true)
assert.equal(hang.frames.length,25)
assert.equal(hang.frames.flatMap(f=>f.cards).length,26)
// A print-only work keeps its measured field and hides its document, so the
// visible-plate assertion covers the works whose source is the work itself.
assert.ok(hang.frames.every(f=>f.furniture.visible&&f.aperture.visible
  &&(hang.documentOnlyIds.has(f.work.id)||f.cards.every(c=>c.mesh.visible))))
assert.deepEqual([...hang.documentOnlyIds],['mona-lisa'])
const mouldings=hang.wall.getObjectByName('vinci/pictures/physical-frames')
assert.equal(mouldings.userData.visibleFrameCount,26)
const placements=mouldings.userData.apertures
const rows=hang.frames.map(f=>{
  const owned=frameModule.buildFrameBatch(stack,placements.filter(p=>p.id===f.work.id||p.id.startsWith(f.work.id+':')))
  owned.group.updateMatrixWorld(true)
  const bounds=new Three.Box3().setFromObject(owned.group)
  bounds.expandByObject(f.furniture);bounds.expandByObject(f.aperture)
  for(const card of f.cards)bounds.expandByObject(card.mesh)
  owned.dispose()
  return{id:f.work.id,left:f.left,right:f.right,y:f.y,bounds}
})
const viewport={width:390,height:844},pxPerCm=Math.min(1.08,(viewport.width-48)/265,(viewport.height*.36)/265)
const camera=new Three.PerspectiveCamera(40,viewport.width/viewport.height,.03,100)
const distance=viewport.height/(2*Math.tan(20*Math.PI/180)*pxPerCm*100)
camera.setViewOffset(viewport.width,viewport.height,0,viewport.height*.10,viewport.width,viewport.height)
camera.updateProjectionMatrix()
function projectBounds(bounds,translationX){
  let min=Infinity,max=-Infinity
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const p=new Three.Vector3(x+translationX,y,z).project(camera),cssX=(p.x*.5+.5)*viewport.width
    min=Math.min(min,cssX);max=Math.max(max,cssX)
  }
  return{minX:min,maxX:max}
}
function auditAt(testGap){
  const results=[]
  for(const [i,selected] of rows.entries()){
    camera.position.set((selected.left+selected.right)/2+i*(testGap-gap),selected.y,distance+.021)
    camera.rotation.set(0,0,0);camera.updateMatrixWorld(true)
    const neighbours=[]
    for(const [j,other] of rows.entries())if(i!==j){
      const projected=projectBounds(other.bounds,j*(testGap-gap)),side=j<i?'left':'right'
      const clearance=side==='left'?-projected.maxX:projected.minX-viewport.width
      neighbours.push({id:other.id,side,clearanceCssPx:clearance,...projected})
    }
    const nearest=neighbours.reduce((a,b)=>a.clearanceCssPx<b.clearanceCssPx?a:b)
    results.push({selected:selected.id,nearest,adjacent:neighbours.filter(n=>n.id===rows[i-1]?.id||n.id===rows[i+1]?.id)})
  }
  return{gapM:testGap,minimumClearanceCssPx:Math.min(...results.map(r=>r.nearest.clearanceCssPx)),rows:results}
}
const current=auditAt(gap),old=auditAt(1.4)
assert.ok(current.minimumClearanceCssPx>0,'Some neighbouring assembly remains within the phone view')
assert.ok(old.minimumClearanceCssPx<0,'The old-gap negative control must reproduce a neighbour fringe')
let lower=1.4,upper=2
for(let i=0;i<32;i++){const middle=(lower+upper)/2;if(auditAt(middle).minimumClearanceCssPx<0)lower=middle;else upper=middle}
const offset=(config.extent-hang.extent)/2
// The pair separation follows the boards the two faces carry, so Ginevra's
// wider mount moved this padding by 5 mm. Anything else is drift.
assert.ok(Math.abs(offset-6.284019173663886)<1e-10,'Room padding changed with the added gaps')
const result={kind:'r19-actual-hang-phone-neighbour-bounds',pass:true,browser:false,gpu:false,sourceHashes:hashes,
  method:'Production buildHang, policy, scale, source windows, arch masks and swept frame geometry. Each full assembly bounding box is conservatively projected through a Three perspective camera for every selected work. Gap alternatives translate those fixed actual assemblies; no object is hidden.',
  limitations:['DOM, stream/image decoding, materials and directional-contact transport are doubles.','Bounds include all solid field, backing, source, mat and moulding geometry. Contact/shadow extent and pixel appearance require final EYES.'],
  viewport,pxPerCm,cameraDistanceM:distance+.021,roomExtentM:config.extent,hangExtentM:hang.extent,centredOffsetM:offset,
  mountedWorks:25,mountedSourcePlanes:26,mountedMouldings:26,current,oldGapNegativeControl:old,
  minimumZeroClearanceGapM:upper}
hang.dispose()
console.log(JSON.stringify(result,null,2))
