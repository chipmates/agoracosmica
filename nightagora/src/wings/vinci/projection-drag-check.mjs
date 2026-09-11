#!/usr/bin/env node
/** Offline input checks: actual camera projection and bounded time response.
 * Mounted: node src/wings/vinci/projection-drag-check.mjs
 * Unapplied proposal: node forge/results/rail-r20/projection-drag-check.mjs --proposal
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'

const root=fs.realpathSync(process.cwd())
const directory=process.argv.includes('--proposal')?path.relative(root,path.dirname(fileURLToPath(import.meta.url))):'src/wings/vinci'
const sources=[],cases=[]
function load(name) {
  const file=path.resolve(root,directory,name)
  if(!fs.realpathSync(file).startsWith(root+path.sep))throw new Error('Source leaves app')
  const raw=fs.readFileSync(file,'utf8'),exports={}
  sources.push({file:path.relative(root,file),sha256:createHash('sha256').update(raw).digest('hex')})
  const code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new vm.Script(code,{filename:name}).runInNewContext({exports,require:id=>{
    if(id==='three/webgpu')return THREE
    throw new Error('Unexpected dependency '+id)
  }},{timeout:10000})
  return exports
}
const {projectRailDrag}=load('projection-drag.ts')
const {createRailLookSmoother}=load('rail-smoothing.ts')
const {fittedRailFov,assertRailProjection}=load('rail-projection.ts')
const ensure=(value,message)=>{if(!value)throw new Error(message)}
const near=(a,b,tolerance=1e-12)=>Math.abs(a-b)<=tolerance
function check(name,body){try{const values=body();cases.push({name,passed:true,...values})}catch(error){cases.push({name,passed:false,error:String(error)})}}

check('Actual PerspectiveCamera central one-pixel projection across lens and viewport choices',()=>{
  let maximumErrorCssPx=0,measurements=0
  for(const fov of [20,50,60,62,70,72,96,116.1,122])for(const height of [720,844,950])for(const aspect of [390/844,1280/720,2.4]) {
    const camera=new THREE.PerspectiveCamera(fov,aspect,.25,1100),width=height*aspect
    for(const axis of ['yaw','pitch']) {
      const delta=projectRailDrag(axis==='yaw'?1:0,axis==='pitch'?1:0,camera.getEffectiveFOV(),height)
      camera.rotation.set(delta.pitch,delta.yaw,0,'YXZ');camera.updateMatrixWorld()
      const point=new THREE.Vector3(0,0,-10).project(camera)
      const pixels=axis==='yaw'?Math.abs(point.x*width/2):Math.abs(point.y*height/2)
      maximumErrorCssPx=Math.max(maximumErrorCssPx,Math.abs(pixels-1));measurements++
      ensure(Math.abs(pixels-1)<.00001,'Projection is not one CSS pixel at the centre')
    }
  }
  return {measurements,maximumErrorCssPx}
})
check('Deltas add consistently when browser pointer events are partitioned',()=>{
  for(const fov of [50,70,96,122]) {
    const full=projectRailDrag(160,-30,fov,844)
    for(const pieces of [2,8,17]) {
      const part=projectRailDrag(160/pieces,-30/pieces,fov,844)
      ensure(near(full.yaw,part.yaw*pieces)&&near(full.pitch,part.pitch*pieces),'Batching changes target')
    }
    const reverse=projectRailDrag(-160,30,fov,844)
    ensure(near(full.yaw+reverse.yaw,0)&&near(full.pitch+reverse.pitch,0),'Pointer reversal is asymmetric')
  }
})
check('Uses actual lens including zoom and CSS size rather than drawing-buffer dimensions',()=>{
  const camera=new THREE.PerspectiveCamera(70,390/844,.25,1100);camera.zoom=1.4;camera.updateProjectionMatrix()
  const delta=projectRailDrag(1,0,camera.getEffectiveFOV(),844)
  camera.rotation.y=delta.yaw;camera.updateMatrixWorld()
  const point=new THREE.Vector3(0,0,-10).project(camera)
  ensure(Math.abs(Math.abs(point.x*390/2)-1)<.00001,'Effective lens was ignored')
  // A CSS resize doubles both focal length and pointer distance, preserving angle.
  const a=projectRailDrag(20,30,70,844),b=projectRailDrag(40,60,70,1688)
  ensure(near(a.yaw,b.yaw)&&near(a.pitch,b.pitch),'CSS scaling changed normalized motion')
})
check('100 ms filter is frame-rate independent and settles without overshoot',()=>{
  const values=[]
  for(const fps of [30,60,120]) {
    let now=0;const look=createRailLookSmoother(()=>now,()=>false,.1)
    look.dragRadians(.48,.075)
    let previous={yaw:0,pitch:0}
    for(let i=1;i<=fps;i++) {
      now=i/fps;const p=look.sample()
      ensure(p.yaw>=previous.yaw&&p.yaw<=.48&&p.pitch>=previous.pitch&&p.pitch<=.075,'Filter overshoots or reverses')
      previous={...p}
    }
    values.push(previous)
  }
  ensure(values.every(v=>near(v.yaw,values[0].yaw)&&near(v.pitch,values[0].pitch)),'Response depends on render cadence')
  return {settled:values[0]}
})
check('Pointer target is integrated at the event time, then reverses monotonically',()=>{
  let now=0;const look=createRailLookSmoother(()=>now,()=>false,.1)
  look.dragRadians(.5,.2);now=.05
  const atEvent={...look.sample()};look.dragRadians(-1,-.4)
  const sameTime=look.sample();ensure(near(atEvent.yaw,sameTime.yaw)&&near(atEvent.pitch,sameTime.pitch),'Event rewrote past camera motion')
  let last={...sameTime}
  for(let i=1;i<=60;i++) {
    now=.05+i/60;const value=look.sample()
    ensure(value.yaw<=last.yaw&&value.yaw>=-.5&&value.pitch<=last.pitch&&value.pitch>=-.2,'Reversal overshoots')
    last={...value}
  }
})
check('Full look cone remains reachable and bounded; reduced motion responds immediately',()=>{
  for(const reduced of [false,true]) {
    let now=0;const look=createRailLookSmoother(()=>now,()=>reduced,.1)
    for(const sign of [1,-1,1]) {
      const delta=projectRailDrag(-sign*10000,-sign*10000,70,844)
      look.dragRadians(delta.yaw,delta.pitch)
      if(reduced){const v=look.sample();ensure(v.yaw===sign*.6&&v.pitch===sign*.32,'Reduced motion was delayed')}
      for(let i=0;i<90;i++){now+=1/60;const v=look.sample();ensure(Math.abs(v.yaw)<=.6&&Math.abs(v.pitch)<=.32,'Cone exceeded')}
      const v=look.sample();ensure(Math.abs(v.yaw-sign*.6)<1e-6&&Math.abs(v.pitch-sign*.32)<1e-6,'Cone became unreachable')
    }
    look.recenter();now+=2;const centred=look.sample();ensure(Math.abs(centred.yaw)<1e-7&&Math.abs(centred.pitch)<1e-7,'Recentering failed')
  }
})
check('Invalid projection inputs reject before mutating look state',()=>{
  for(const args of [[0,0,0,844],[0,0,180,844],[0,0,70,0],[Infinity,0,70,844],[0,NaN,70,844]]) {
    let failed=false;try{projectRailDrag(...args)}catch{failed=true}ensure(failed,'Invalid input accepted')
  }
})
check('Aspect fitting contains both near-plane extents and preserves the authored review frames',()=>{
  let measurements=0
  for(const phone of [false,true])for(const fov of [50,62,70,72,96,116.1]) {
    const authoredAspect=phone?390/844:1280/720
    const boundY=.25*Math.tan(fov*Math.PI/360),boundX=boundY*authoredAspect
    for(const aspect of [.25,390/844,.9,1,1280/720,2.4,4]) {
      const actual=fittedRailFov(fov,aspect,phone),halfY=.25*Math.tan(actual*Math.PI/360),halfX=halfY*aspect
      ensure(halfY<=boundY+1e-12&&halfX<=boundX+1e-12,'Near rectangle exceeds authored envelope')
      measurements++
    }
    ensure(near(fittedRailFov(fov,authoredAspect,phone),fov),'Prescribed review lens changed')
  }
  return {measurements}
})
check('Projection guard rejects zoom, offsets and near-plane changes before ordinary movement',()=>{
  const changes=[camera=>{camera.zoom=.8},camera=>{camera.near=.2},camera=>{camera.filmOffset=1},camera=>{camera.setViewOffset(390,844,0,100,390,844)}]
  for(const change of changes) {
    const camera=new THREE.PerspectiveCamera(70,390/844,.25,1100);change(camera)
    let failed=false;try{assertRailProjection(camera)}catch{failed=true}
    ensure(failed,'Unproved projection accepted')
    camera.near=.25;camera.zoom=1;camera.filmOffset=0;camera.clearViewOffset();assertRailProjection(camera)
  }
})
const ok=cases.every(c=>c.passed)
console.log(JSON.stringify({kind:'projection-drag-offline-check',ok,sources,cases},null,2))
process.exitCode=ok?0:1
