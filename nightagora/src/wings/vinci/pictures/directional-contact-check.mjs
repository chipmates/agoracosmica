#!/usr/bin/env node
/** Independent geometry/direction checks; no browser or renderer is launched. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'
import * as TSL from 'three/tsl'

function load(file, extra='') {
  const source=readFileSync(new URL(file,import.meta.url),'utf8')
  const code=ts.transpileModule(source+extra,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
  const exports={}
  vm.runInThisContext(`(function(exports,require){${code}\n})`,{filename:file})(exports,id=>{
    if(id==='three/webgpu')return Three
    if(id==='three/tsl')return TSL
    // The frame is lit by the room's opening; the check loads the real one.
    if(id==='./aperture')return load('./aperture.ts')
    throw Error(`Unexpected import: ${id}`)
  })
  return {...exports,sha256:createHash('sha256').update(source).digest('hex')}
}
const api=load('./directional-contact.ts','\nexport const __test = { triangle, tree, directions, blocked };')
const {buildBakedFrameContact,DIRECTIONAL_CONTACT_RECIPE:R}=api
const {triangle,tree,directions,blocked}=api.__test
const results=[]
function test(name,run){run();results.push({name,pass:true})}
const f={id:'panel',x:0,y:0,width:1,height:1}
function support(x=0,z=.04){
  const group=new Three.Group(),mesh=new Three.Mesh(new Three.PlaneGeometry(1,1),new Three.MeshBasicNodeMaterial())
  mesh.position.set(x,0,z);group.add(mesh)
  return {group,dispose(){mesh.geometry.dispose();mesh.material.dispose()}}
}
const unit=new Three.Vector3(-1,1,1).normalize()
let first,source

test('Default direction is exactly the bench key, and every source ray stays in its small disk',()=>{
  const az=235*Math.PI/180,el=34*Math.PI/180
  const direction=new Three.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el))
  const rays=directions(direction,2.5)
  assert.equal(rays.length,25)
  assert.deepEqual(rays,directions(direction,2.5))
  for(const ray of rays){
    const v=new Three.Vector3(...ray)
    assert.ok(Math.abs(v.length()-1)<1e-12)
    assert.ok(v.x<0 && v.y>0 && v.z>0)
    assert.ok(v.angleTo(direction)<=2.5*Math.PI/180+1e-12)
  }
})

test('Triangle BVH matches independent Three.Ray visibility, including parallel axes',()=>{
  const v=(...p)=>new Three.Vector3(...p)
  const triangles=[triangle(v(-.5,-.5,.04),v(.5,-.5,.04),v(.5,.5,.04)),triangle(v(-.5,-.5,.04),v(.5,.5,.04),v(-.5,.5,.04))]
  const root=tree([...triangles]),target=new Three.Vector3()
  const rays=[...directions(unit,2.5),[0,0,1],[0,1,0],[1,0,0]]
  for(const x of [-.6,-.5,-.2,0,.2,.5,.6])for(const y of [-.6,-.5,0,.5,.6])for(const d of rays){
    const origin=v(x,y,R.wallRayOriginM),ray=new Three.Ray(origin,v(...d))
    const expected=triangles.some(t=>{
      const a=v(...t.a),b=a.clone().add(v(...t.e1)),c=a.clone().add(v(...t.e2))
      const hit=ray.intersectTriangle(a,b,c,false,target)
      return hit && origin.distanceTo(hit)>1e-6 && origin.distanceTo(hit)<=R.rayMaxM
    })
    assert.equal(blocked(root,x,y,d,{boundsTests:0,triangleTests:0}),Boolean(expected))
  }
})

test('Raised plate casts down/right at its analytically projected edges, with no four-sided halo',()=>{
  source=support()
  first=buildBakedFrameContact(source.group,[f],{direction:unit.toArray(),angularRadiusDeg:0,strength:.3})
  assert.equal(first.stats.sourceTriangles,2)
  assert.equal(first.group.children.length,1)
  const g=first.group.children[0].geometry,p=g.getAttribute('position'),c=g.getAttribute('color')
  const shaded=[]
  for(let i=0;i<p.count;i++)if(c.getW(i)>0)shaded.push([p.getX(i),p.getY(i),c.getW(i)])
  assert.ok(shaded.length>0)
  const shift=.04-R.wallRayOriginM
  for(const [x,y,a]of shaded){
    assert.ok(x>=-.5+shift-1e-7 && x<=.5+shift+1e-7)
    assert.ok(y>=-.5-shift-1e-7 && y<=.5-shift+1e-7)
    assert.ok(Math.abs(a-.3)<1e-6)
  }
  assert.ok(shaded.some(([x])=>x>.5),'Right-hand cast shadow exists')
  assert.ok(shaded.some(([,y])=>y<-.5),'Lower cast shadow exists')
  assert.ok(!shaded.some(([x])=>x<-.5),'No left halo')
  assert.ok(!shaded.some(([,y])=>y>.5),'No top halo')
  assert.equal(first.stats.peakOcclusion,1)
  assert.equal(first.stats.peakOpacity,.3)
})

test('One finite source makes a geometric penumbra; zero strength and distant geometry allocate no receiver',()=>{
  const soft=buildBakedFrameContact(source.group,[f],{direction:unit.toArray(),angularRadiusDeg:10,strength:.3})
  const alpha=soft.group.children[0].geometry.getAttribute('color')
  assert.ok(Array.from({length:alpha.count},(_,i)=>alpha.getW(i)).some(v=>v>0 && v<.29))
  soft.dispose()
  const off=buildBakedFrameContact(source.group,[f],{strength:0})
  assert.equal(off.group.children.length,0);assert.equal(off.stats.rays,0);off.dispose()
  const moved=support(0,2),far=buildBakedFrameContact(moved.group,[f])
  assert.equal(far.group.children.length,0);assert.equal(far.stats.blockedRays,0);far.dispose();moved.dispose()
})

test('Solo selection matches isolated bake, changed selection owns its receiver and releases it',()=>{
  const second=support(1.6),union=new Three.Group()
  union.add(source.group.clone(),second.group)
  const frames=[f,{...f,id:'second',x:1.6}]
  const both=buildBakedFrameContact(union,frames,{direction:unit.toArray(),angularRadiusDeg:0,strength:.3})
  const rays=both.stats.rays
  both.setVisible(['panel'])
  assert.deepEqual(Array.from(both.group.children[0].geometry.getAttribute('color').array),Array.from(first.group.children[0].geometry.getAttribute('color').array))
  const geometry=both.group.children[0].geometry
  let disposed=0;geometry.addEventListener('dispose',()=>disposed++)
  both.setVisible(['panel','panel']);assert.equal(disposed,0)
  both.setVisible([]);assert.equal(disposed,1);assert.equal(both.group.children.length,0)
  both.setVisible();assert.equal(both.stats.rays,rays)
  both.dispose();both.dispose();assert.equal(both.stats.cpuBytes,0);second.dispose()
})

test('Parent transforms cancel and mesh-local transforms remain physical',()=>{
  const transformed=support(2.5)
  const parent=new Three.Group();parent.position.set(3,-2,1);parent.rotation.set(.2,-.5,.4);parent.add(transformed.group)
  const result=buildBakedFrameContact(transformed.group,[{...f,x:2.5}],{direction:unit.toArray(),angularRadiusDeg:0,strength:.3})
  const p=first.group.children[0].geometry.getAttribute('position'),q=result.group.children[0].geometry.getAttribute('position')
  assert.equal(p.count,q.count)
  for(let i=0;i<p.count;i++){assert.ok(Math.abs(q.getX(i)-p.getX(i)-2.5)<1e-6);assert.ok(Math.abs(q.getY(i)-p.getY(i))<1e-6)}
  result.dispose();transformed.dispose()
})

test('Invalid source direction, invalid placements and empty input fail or clear predictably',()=>{
  for(const options of [{direction:[0,0,-1]},{direction:[0,0,0]},{strength:NaN},{strength:1.1},{angularRadiusDeg:13}])
    assert.throws(()=>buildBakedFrameContact(source.group,[f],options))
  assert.throws(()=>buildBakedFrameContact(source.group,[f,f]))
  const empty=buildBakedFrameContact(new Three.Group(),[])
  assert.equal(empty.stats.sourceTriangles,0);assert.equal(empty.group.children.length,0);empty.dispose()
})
first.dispose();source.dispose()
test('Physical frame stands 6 mm from plaster and retains its exact 45 mm section',()=>{
  const {buildFrameBatch,FRAME_BACK_M,FRAME_FRONT_M,FRAME_MOULDING_WIDTH_M}=load('./frame.ts')
  const stack={materials:{sync(){return{material(){const m=new Three.MeshStandardNodeMaterial();m.colorNode=TSL.vec3(1);m.roughnessNode=TSL.float(.5);return m}}}},detail(){}}
  const frame=buildFrameBatch(stack,[f])
  const bounds=new Three.Box3().setFromObject(frame.group)
  assert.ok(Math.abs(bounds.min.z-.006)<1e-8)
  assert.ok(Math.abs(bounds.max.z-.051)<1e-8)
  assert.ok(Math.abs(bounds.max.z-bounds.min.z-.045)<1e-8)
  assert.ok(Math.abs(FRAME_BACK_M-.006)<1e-12)
  assert.ok(Math.abs(FRAME_FRONT_M-.051)<1e-12)
  assert.ok(Math.abs(bounds.max.x-(f.width/2+FRAME_MOULDING_WIDTH_M))<1e-7)
  assert.ok(Math.abs(bounds.max.y-(f.height/2+FRAME_MOULDING_WIDTH_M))<1e-7)
  frame.dispose()
})
let benchmark
test('Six real swept mouldings stay one draw and bake in a bounded local budget',()=>{
  const {buildFrameBatch}=load('./frame.ts')
  const stack={materials:{sync(){return{material(){const m=new Three.MeshStandardNodeMaterial();m.colorNode=TSL.vec3(1);m.roughnessNode=TSL.float(.5);return m}}}},detail(){}}
  let x=0
  const frames=[[1.2,2],[.39,.54],[.55,.62],[.3,.44],[1.3,2],[2.4,2.4]].map(([width,height],i)=>{const f={id:`frame-${i}`,x:x+width/2,y:1.55,width,height};x+=width+.56;return f})
  const actual=buildFrameBatch(stack,frames),bake=buildBakedFrameContact(actual.group,frames)
  benchmark={...bake.stats}
  assert.equal(bake.group.children.length,1)
  assert.ok(bake.stats.sourceTriangles>=1200)
  assert.ok(bake.stats.visibleTriangles<150000)
  assert.ok(bake.stats.bakeMs<10000)
  bake.dispose();actual.dispose()
})
console.log(JSON.stringify({sourceSha256:api.sha256,passed:results.length,results,benchmark},null,2))
