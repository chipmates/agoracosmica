#!/usr/bin/env node
/** Execute the actual rail and geometry authority with a controlled clock.
 * Run: node src/wings/vinci/rail-check.mjs > <app-local report.json>
 * Normal routes use the actual mounted factory fingerprint and saved proof.
 * The independent geometry-check verifies their real triangle clearances.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'
const root=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')),wing=path.join(root,'src/wings/vinci')
const media={reduced:false},modules=new Map(),sources=[],cases=[]
const statistics={cameraSamples:0,comparisons:0,maxPositionErrorM:0,maxAngleErrorRad:0,maxFovErrorDegrees:0,maxRollComponent:0,maxQuaternionNormError:0}
function sourceFile(file) {
  const real=fs.realpathSync(file)
  if(!real.startsWith(root+path.sep))throw new Error('Read leaves app: '+file)
  return real
}
function read(file) {
  const real=sourceFile(file),raw=fs.readFileSync(real,'utf8')
  if(!sources.some(s=>s.file===path.relative(root,real)))sources.push({file:path.relative(root,real),sha256:createHash('sha256').update(raw).digest('hex')})
  return raw
}
async function load(file) {
  if(modules.has(file))return modules.get(file)
  const exports={};modules.set(file,exports)
  const code=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const dependencies=new Map()
  for(const [,name] of code.matchAll(/\brequire\(["']([^"']+)["']\)/g)) {
    if(dependencies.has(name))continue
    if(name.startsWith('.')) {
      const target=path.resolve(path.dirname(file),name.replace(/\?raw$/,''))
      dependencies.set(name,name.endsWith('?raw')?{default:read(target)}:await load(target+'.ts'))
    } else if(/^three(?:\/|$)/.test(name))dependencies.set(name,await import(name))
    else throw new Error('Unexpected runtime dependency: '+name)
  }
  // Match the browser's shared typed-array realm across Three and wing factories.
  new vm.Script(code,{filename:path.relative(root,file)}).runInNewContext({exports,require:name=>dependencies.get(name),Float32Array,performance,crypto:globalThis.crypto,TextEncoder:globalThis.TextEncoder,console,matchMedia:()=>({matches:media.reduced})},{timeout:10000})
  return exports
}
const {createRail,stationPose,namedPose,railMoveDurationSeconds:DURATION}=await load(path.join(wing,'rail.ts'))
const {projectRailDrag}=await load(path.join(wing,'projection-drag.ts'))
const {fittedRailFov,assertRailProjection}=await load(path.join(wing,'rail-projection.ts'))
const {vinciContent}=await load(path.join(wing,'content.ts'))
const ids=vinciContent.map(s=>s.id),STEP=DURATION/224
const {createRailGeometryAuthority,collectRailSolids}=await load(path.join(wing,'rail-proof.ts'))
const {gradeAt}=await load(path.join(wing,'terrain-mesh.ts'))
const {createCollectionStandSolids}=await load(path.join(wing,'collection/stands.ts'))
const {vinciExhibitRecords,vinciApproachPose:approachPose}=await load(path.join(wing,'collection/approaches.ts'))
const EXHIBITS=vinciExhibitRecords()
const authorityFactories=[
  ['shell','shell','createShell',false],['terrain','ground','createGround',false],
  ['gate-passage','gate-passage','createGatePassage',false],
  ['inner-court','inner-court','createInnerCourtDressing',true],
  ['collection','collection','createCollection',false],
  ['collection-access','collection-access','createCollectionAccess',false],
  ['entry-passage','entry-passage','createEntryPassage',false],
  ['vegetation','vegetation','createVegetation',true],
  ['road-dressing','road-dressing','createRoadDressing',true],
  ['ground-dressing','ground-dressing','createGroundDressing',true],
]
const realAuthorities=new Map(),factoryGroups=[],identityTimings=[]
for(const tier of ['standard','calm']) {
  const scene=new THREE.Group()
  for(const [id,file,name,grounded] of authorityFactories) {
    const module=await load(path.join(wing,file+'.ts')),group=grounded?module[name](gradeAt,tier):module[name](tier)
    group.traverse(object=>{if(object.isMesh&&typeof object.userData.manifestId!=='string')object.userData.manifestId='vinci/'+id})
    scene.add(group)
  }
  const waterModule=await load(path.join(wing,'water.ts'))
  const water=waterModule.createWater(new THREE.Scene(),{tierName:()=>tier,reflector:()=>({node:TSL.vec4(0,0,0,1),dispose(){}})})
  water.traverse(object=>{if(object.isMesh&&typeof object.userData.manifestId!=='string')object.userData.manifestId='vinci/water'})
  // The exhibits' plinths and bases are mounted before the runtime hashes the
  // scene, so the collision identity here has to carry them too.
  scene.add(createCollectionStandSolids(new THREE.MeshBasicMaterial()))
  scene.add(water);factoryGroups.push(scene)
  const start=performance.now(),authority=createRailGeometryAuthority(collectRailSolids(scene))
  await authority.ready
  if(authority.status!=='verified')throw new Error(authority.failure)
  realAuthorities.set(tier,authority);identityTimings.push({tier,milliseconds:performance.now()-start})
}
function ensure(condition,message){if(!condition)throw new Error(message)}
function snapshot(camera){return {eye:camera.position.clone(),q:camera.quaternion.clone(),fov:camera.fov}}
function compare(actual,expected,label) {
  const a=actual.position?snapshot(actual):actual,b=expected.position?snapshot(expected):expected
  const p=a.eye.distanceTo(b.eye),angle=a.q.angleTo(b.q),fov=Math.abs(a.fov-b.fov)
  statistics.comparisons++;statistics.maxPositionErrorM=Math.max(statistics.maxPositionErrorM,p)
  statistics.maxAngleErrorRad=Math.max(statistics.maxAngleErrorRad,angle);statistics.maxFovErrorDegrees=Math.max(statistics.maxFovErrorDegrees,fov)
  ensure(p<1e-8&&angle<1e-7&&fov<1e-8,`${label}: ${p}m, ${angle}rad, ${fov}deg`)
}
function validate(camera) {
  statistics.cameraSamples++
  ensure([...camera.position.toArray(),...camera.quaternion.toArray(),camera.fov,...camera.projectionMatrix.elements].every(Number.isFinite),'Nonfinite camera')
  const norm=Math.abs(camera.quaternion.length()-1),roll=Math.abs(new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion).y)
  statistics.maxQuaternionNormError=Math.max(statistics.maxQuaternionNormError,norm);statistics.maxRollComponent=Math.max(statistics.maxRollComponent,roll)
  ensure(norm<1e-10&&roll<1e-10,'Camera lost unit quaternion or acquired roll')
}
function harness(phone,initial='arrival',status='verified') {
  let now=0
  const camera=new THREE.PerspectiveCamera(49,phone?390/844:1512/950,.25,1100),calls=[]
  const authority={status,failure:'',rejectRoute:false,route(from,to,requestPhone,actualCamera){
    calls.push({from:from.eye.toArray(),to:to.eye.toArray(),phone:requestPhone})
    ensure(authority.status==='verified','Controller called a pending/failed authority')
    assertRailProjection(actualCamera)
    ensure(actualCamera.position.distanceToSquared(from.eye)<1e-18,'Controller supplied a false route origin')
    if(authority.rejectRoute)throw new Error('Intentional controller route rejection')
    return realAuthorities.get(phone?'calm':'standard').route(from,to,requestPhone,actualCamera)
  },approach(from,to,requestPhone,actualCamera,back=false){
    calls.push({kind:'approach',back,from:from.eye.toArray(),to:to.eye.toArray(),phone:requestPhone})
    ensure(authority.status==='verified','Controller called a pending/failed authority')
    assertRailProjection(actualCamera)
    const origin=back?to:from
    ensure(actualCamera.position.distanceToSquared(origin.eye)<1e-18,'Controller supplied a false approach origin')
    return realAuthorities.get(phone?'calm':'standard').approach(from,to,requestPhone,actualCamera,back)
  }}
  const rail=createRail(camera,()=>now,authority)
  const h={camera,rail,authority,calls,phone,pose:id=>stationPose(id,phone),get now(){return now},
    set(id,instant=false){rail.set(id,stationPose(id,phone),instant,phone)},
    at(time){now=time;rail.update();validate(camera)},
    drag(dx,dy){rail.drag(dx,dy,phone?844:950)},
  }
  h.set(initial,true);h.at(0);return h
}
function canonical(phone,id){return harness(phone,id).camera}
function endpoint(h,id,label=id) {
  ensure(h.rail.navigation.completed===id,'Wrong actual completed semantic station: '+label)
  ensure(h.camera.position.distanceTo(h.pose(id).eye)<1e-8,'Wrong physical endpoint: '+label)
  ensure(Math.abs(h.camera.fov-fittedRailFov(h.pose(id).fov,h.camera.aspect,h.phone))<1e-8,'Wrong endpoint FOV: '+label)
}
function finish(h,id,start){h.at(start);h.at(start+DURATION);endpoint(h,id)}
/** Advance until this semantic station is the one standing. A leg is as long
 * as its own path, so a fixed number of ticks is no longer a wait. */
function settle(h,id,label=id) {
  for(let guard=0;guard<600&&h.rail.navigation.completed!==id;guard++)h.at(h.now+Math.max(.25,(h.rail.navigation.legSeconds||DURATION)/3))
  endpoint(h,id,label)
}
function check(viewport,name,body) {
  const before=statistics.cameraSamples
  try{const details=body();cases.push({viewport,name,passed:true,samples:statistics.cameraSamples-before,...details})}
  catch(error){cases.push({viewport,name,passed:false,error:error.stack??String(error)})}
  finally{media.reduced=false}
}

for(const phone of [false,true]) {
  const viewport=phone?'phone':'desktop'
  check(viewport,'Repeated tail preserves settled gaze and the first animated sample is continuous',()=>{
    const h=harness(phone);h.drag(75,-43);h.at(2);const looked=snapshot(h.camera)
    for(let i=0;i<6;i++){h.set('arrival');h.at(2);compare(h.camera,looked,'Duplicate boundary')}
    h.set('courtyard');compare(h.camera,looked,'Set call');h.at(2);compare(h.camera,looked,'First route sample')
    for(let i=1;i<=224;i++)h.at(2+i*STEP)
    endpoint(h,'courtyard');h.at(6);compare(h.camera,canonical(phone,'courtyard'),'Settled endpoint')
  })
  check(viewport,'A target no further along preserves the complete active trajectory, and the newest is taken directly',()=>{
    const h=harness(phone),control=harness(phone);h.set('courtyard');control.set('courtyard')
    h.at(0);control.at(0)
    // A VISITOR PRESSING ON SPEEDS THE LEG, so the control is given the first
    // press too. What is measured here is the other half of the law: a target
    // no further along the walk than the one already asked for changes
    // neither a sample of the leg nor the moment it lands.
    h.set('hall');control.set('hall')
    // A leg lasts as long as its own length and its own pace say, so the
    // sub-step is this leg's own duration and not the longest leg in the wing.
    const seconds=h.rail.navigation.legSeconds/h.rail.navigation.legPace,step=seconds/224
    for(let i=1;i<224;i++) {
      h.at(i*step);control.at(i*step)
      if(i===45)h.set('arrival');if(i===100)h.set('hall');if(i===145)h.set('arrival')
      ensure(h.rail.navigation.queued.length<=1,'Input grew a chain behind the active leg')
      compare(h.camera,control.camera,'Queued input changes no in-flight sample')
    }
    h.at(seconds+1e-6);control.at(seconds+1e-6);compare(h.camera,control.camera,'Queued input changes no arrival sample')
    endpoint(h,'courtyard')
    ensure(h.rail.navigation.queued.join(',')==='arrival','Newest target was not retained')
    settle(h,'arrival')
    ensure(h.rail.navigation.queued.length===0&&h.calls.length===2,'Superseded targets were walked')
    ensure(h.calls[1].from.every((v,i)=>Math.abs(v-h.pose('courtyard').eye.getComponent(i))<1e-12)
      &&h.calls[1].to.every((v,i)=>Math.abs(v-h.pose('arrival').eye.getComponent(i))<1e-12),'Newest target did not get a direct station-to-station proof')
  })
  check(viewport,'A target further along the walk speeds the leg under way',()=>{
    // The walk runs arrival, courtyard, hall, oratory, study, chamber,
    // garden: the hall stands one station beyond the leg's destination and
    // the garden five.
    const land=pending=>{
      const h=harness(phone);h.set('courtyard');h.at(0)
      if(pending)h.set(pending)
      const seconds=h.rail.navigation.legSeconds
      for(let i=1;i<=900;i++){const now=i*seconds/300;h.at(now);if(h.rail.navigation.completed==='courtyard')return now}
      return Infinity
    }
    const alone=land(null),oneOn=land('hall'),fiveOn=land('garden')
    ensure(alone>oneOn&&oneOn>fiveOn,'Pressing on did not speed the leg under way')
    return {secondsToLand:{alone:+alone.toFixed(2),oneStationOn:+oneOn.toFixed(2),fiveStationsOn:+fiveOn.toFixed(2)}}
  })
  check(viewport,'Repeated pending targets deduplicate and the active target cancels any pending reversal',()=>{
    const h=harness(phone);h.set('courtyard');h.set('courtyard');h.at(0);h.at(.2)
    h.set('garden');h.set('garden');ensure(h.rail.navigation.queued.join(',')==='garden','Duplicate target grew a queue')
    h.set('hall');h.set('garden');ensure(h.rail.navigation.queued.join(',')==='garden','Newest pending reversal was lost')
    h.set('courtyard');h.set('courtyard')
    ensure(h.rail.navigation.queued.length===0,'Requesting the active endpoint retained an older target')
    settle(h,'courtyard');h.at(h.now+DURATION)
    ensure(h.calls.length===1&&!h.rail.navigation.active,'A cancelled target started another leg')
  })
  check(viewport,'Only the latest shared-pose station completes without resetting the settled gaze',()=>{
    const h=harness(phone,'hall');h.drag(-49,29);h.at(3);const looked=snapshot(h.camera)
    for(const id of ['oratory','study','chamber'])h.set(id)
    ensure(h.rail.navigation.queued.join(',')==='chamber','Shared poses retained superseded targets')
    h.at(3);endpoint(h,'chamber');compare(h.camera,looked,'Latest shared threshold gaze')
    h.set('oratory');h.set('hall');h.at(3);endpoint(h,'hall');compare(h.camera,looked,'Returning shared threshold gaze')
    ensure(h.calls.length===0,'Equal-pose semantic change invented a route')
  })
  check(viewport,'A long held-input burst retains at most one target and walks only the active and latest endpoints',()=>{
    // The burst never ends on the station it starts from: asking for the
    // endpoint you already stand at cancels the queue by design, and a walk
    // whose station count happens to divide the burst would test that instead.
    const h=harness(phone),others=ids.filter(id=>id!=='courtyard')
    const accepted=Array.from({length:257},(_,i)=>others[i%others.length])
    h.set('courtyard');h.at(0);h.at(.2)
    for(const id of accepted){h.set(id);ensure(h.rail.navigation.queued.length<=1,'A held input built a chain')}
    ensure(h.rail.navigation.queued.join(',')===accepted.at(-1),'Burst did not retain its latest target')
    const trace=[];let previous='arrival'
    for(let tick=0;trace.length<2&&tick<600;tick++) {
      h.at(.2+tick*2)
      const current=h.rail.navigation.completed
      if(current!==previous){trace.push(current);endpoint(h,current);previous=current}
    }
    ensure(trace.join(',')===['courtyard',accepted.at(-1)].join(','),'Burst walked a superseded endpoint or lost its newest target')
    ensure(h.calls.length===2&&h.rail.navigation.queued.length===0,'Burst created an extra route')
    return {acceptedRequests:accepted.length,observedEndpoints:trace.length}
  })
  check(viewport,'A delayed frame completes only the active endpoint and gives later legs fresh clocks',()=>{
    const h=harness(phone);h.set('courtyard');h.at(0);h.at(.2);h.set('garden');h.set('hall')
    const late=DURATION+10
    h.at(late);endpoint(h,'courtyard');ensure(h.rail.navigation.active===undefined,'A second leg began during completion')
    ensure(h.rail.navigation.queued.join(',')==='hall','Delayed frame lost the newest pending request')
    h.at(late);compare(h.camera,canonical(phone,'courtyard'),'New leg zero elapsed time')
    const control=harness(phone,'courtyard');control.set('hall');control.at(0)
    const seconds=control.rail.navigation.legSeconds/control.rail.navigation.legPace,step=seconds/224
    for(let i=1;i<224;i++){h.at(late+i*step);control.at(i*step);compare(h.camera,control.camera,'Fresh route clock')}
    h.at(late+seconds+1e-6);control.at(seconds+1e-6);compare(h.camera,control.camera,'Fresh route clock at the endpoint')
    endpoint(h,'hall')
  })
  check(viewport,'Reduced motion finishes the active request then completes only the newest pending target',()=>{
    const h=harness(phone);h.set('courtyard');h.at(0);h.at(.2);h.set('garden');h.set('hall')
    media.reduced=true
    const trace=[]
    for(let i=0;i<2;i++){h.at(10);trace.push(h.rail.navigation.completed)}
    ensure(trace.join(',')==='courtyard,hall','Reduced motion lost the active endpoint or newest target')
    ensure(h.calls.length===2&&h.rail.navigation.queued.length===0,'Reduced motion walked a superseded target')
    h.drag(34,20);h.at(10);const looked=snapshot(h.camera);h.set('hall');h.at(11);compare(h.camera,looked,'Reduced duplicate')
  })
  check(viewport,'Pending or failed authority holds the origin and retains only the newest target',()=>{
    const h=harness(phone,'arrival','checking'),origin=snapshot(h.camera)
    h.set('courtyard');h.set('garden');h.set('arrival');h.at(10)
    compare(h.camera,origin,'Pending proof');ensure(h.calls.length===0,'Pending authority was bypassed')
    ensure(h.rail.navigation.queued.length===0,'Requesting the standing station failed to cancel pending work')
    h.set('courtyard');h.set('garden')
    h.authority.status='failed';h.at(20);compare(h.camera,origin,'Failed proof')
    ensure(h.rail.navigation.queued.join(',')==='garden','Proof failure lost the latest target or retained superseded work')
    h.authority.status='verified';h.at(30);compare(h.camera,origin,'Ready proof fresh clock');settle(h,'garden')
    ensure(h.calls.length===1,'Pending proof later walked a superseded request')
  })
  check(viewport,'A rejected route or lens cannot move, claim arrival, or discard the accepted request',()=>{
    const h=harness(phone),origin=snapshot(h.camera);h.set('courtyard');h.set('garden');h.authority.rejectRoute=true
    let failed=false;try{h.at(0)}catch{failed=true}ensure(failed,'Route rejection was bypassed')
    compare(h.camera,origin,'Rejected route');ensure(h.rail.navigation.queued.join(',')==='garden','Rejected target was discarded or a superseded one retained')
    h.authority.rejectRoute=false;h.camera.zoom=.8;failed=false;try{h.at(0)}catch{failed=true}ensure(failed,'Invalid lens was bypassed')
    ensure(h.rail.navigation.completed==='arrival'&&h.rail.navigation.queued.length===1,'Invalid lens reported arrival')
    h.camera.zoom=1;h.at(0);settle(h,'garden')
  })
  check(viewport,'Explicit inspection and resize cancel only their old sequence and render the cut first',()=>{
    const h=harness(phone);h.set('courtyard');h.at(0);h.at(.2);h.set('garden')
    const inspection=namedPose('entry-structure',phone);ensure(inspection,'Missing actual named pose')
    h.rail.set('arrival',inspection,true,phone);const named=snapshot(h.camera);h.at(10);compare(h.camera,named,'Named explicit placement')
    ensure(h.rail.navigation.queued.length===0&&!h.rail.navigation.active,'Named reset retained old work')
    // Ordinary inspection return restores the previous canonical eye first.
    h.set('arrival',true);h.set('courtyard');h.set('garden');const callCount=h.calls.length
    h.at(20);compare(h.camera,canonical(phone,'arrival'),'Return placement frame');ensure(h.calls.length===callCount,'Return cut skipped its rendered update')
    h.at(20);ensure(h.calls.length===callCount+1,'Certified canonical route did not start')
    ensure(h.calls.at(-1).from.every((v,i)=>Math.abs(v-h.pose('arrival').eye.getComponent(i))<1e-12),'Named eye borrowed a canonical proof')
    const resized=stationPose('arrival',!phone);h.camera.aspect=phone?1280/720:390/844
    h.rail.set('arrival',resized,true,!phone);h.at(30)
    ensure(h.rail.navigation.queued.length===0&&!h.rail.navigation.active,'Resize retained stale requests')
    ensure(h.camera.position.distanceTo(resized.eye)<1e-8&&Math.abs(h.camera.fov-resized.fov)<1e-8,'Resize family or lens was ignored')
  })
  check(viewport,'Every station of the walk is reached, each leg walked in full at its measured pace',()=>{
    const h=harness(phone);ensure(ids.length===vinciContent.length&&ids.length>0,'Actual canon lost a station')
    const walks=[]
    let clock=0
    for(let i=0;i<ids.length;i++) {
      h.at(clock);h.set(ids[i]);h.at(clock+=.005)
      const metres=h.rail.navigation.legMetres,seconds=h.rail.navigation.legSeconds
      const samples=Math.max(240,Math.ceil(seconds/.005))
      for(let sample=1;sample<samples;sample++)h.at(clock+sample*seconds/samples)
      h.at(clock+seconds+1e-6)
      clock+=seconds+.05
      endpoint(h,ids[i]);compare(h.camera,canonical(phone,ids[i]),'Walked leg '+ids[i])
      if(metres>0)walks.push({from:ids[i-1],to:ids[i],metres:+metres.toFixed(2),seconds:+seconds.toFixed(2),metresPerSecond:+(metres/seconds).toFixed(2)})
    }
    return {walks}
  })
  check(viewport,'An approach walks from the station eye to one exhibit and the return lands on that eye exactly',()=>{
    const h=harness(phone,'picture-room')
    const exhibit=EXHIBITS[9],pose=approachPose(exhibit.id,phone)
    ensure(exhibit.id==='picture/virgin-of-the-rocks-louvre/front','The tenth plate of the hang moved')
    ensure(h.rail.approach(exhibit.id,pose,phone),'The rail refused a certified approach')
    ensure(h.calls.at(-1).kind==='approach'&&h.calls.at(-1).back===false,'The approach borrowed a station proof')
    const seconds=h.rail.navigation.legSeconds
    for(let i=1;i<240;i++)h.at(i*seconds/240)
    h.at(seconds+1e-6)
    ensure(h.rail.navigation.exhibit===exhibit.id,'The exhibit eye is not the one standing')
    ensure(h.rail.navigation.completed==='picture-room','An approach eye became a station')
    const arrival=h.camera.position.distanceTo(pose.eye)
    ensure(arrival===0,'The arrival missed the certified viewing eye by '+arrival)
    ensure(Math.abs(h.camera.fov-fittedRailFov(pose.fov,h.camera.aspect,phone))<1e-9,'The arrival kept another lens')
    ensure(h.rail.approach(EXHIBITS[0].id,approachPose(EXHIBITS[0].id,phone),phone)===false,'A second exhibit opened over the first')
    ensure(h.rail.returnToStation(),'The rail refused the return')
    const back=h.rail.navigation
    for(let i=1;i<240;i++)h.at(seconds+1+i*(back.legSeconds||seconds)/240)
    h.at(seconds*3+2)
    const drift=h.camera.position.distanceTo(h.pose('picture-room').eye)
    ensure(drift===0,'The return drifted '+drift+' m off the certified station eye')
    endpoint(h,'picture-room','return')
    ensure(h.rail.navigation.exhibit===undefined,'An exhibit stayed open after the return')
    compare(h.camera,canonical(phone,'picture-room'),'Returned station eye')
    return {approachMetres:+pose.eye.distanceTo(h.pose('picture-room').eye).toFixed(4),arrivalErrorM:arrival,returnErrorM:drift}
  })
  check(viewport,'A station pressed while an approach stands returns first and then walks the certified pair',()=>{
    const h=harness(phone,'picture-room')
    const exhibit=EXHIBITS[9],pose=approachPose(exhibit.id,phone)
    h.rail.approach(exhibit.id,pose,phone,true)
    h.at(0)
    ensure(h.camera.position.distanceTo(pose.eye)===0,'An instant approach missed its certified eye')
    h.set('garden')
    settle(h,'garden')
    const legs=h.calls.filter(call=>call.kind==='approach')
    ensure(legs.length===2&&legs[1].back===true,'The visitor did not come back before walking on')
    const route=h.calls.filter(call=>!call.kind).at(-1)
    ensure(route.from.every((v,i)=>Math.abs(v-h.pose('picture-room').eye.getComponent(i))<1e-12),'The station leg started off the station eye')
    ensure(h.rail.navigation.exhibit===undefined,'The exhibit survived a station press')
  })
  check(viewport,'An uncertified approach throws instead of moving',()=>{
    const h=harness(phone,'picture-room'),origin=snapshot(h.camera)
    const exhibit=EXHIBITS[9],pose=approachPose(exhibit.id,phone)
    const moved={eye:pose.eye.clone().setY(pose.eye.y+.01),at:pose.at.clone(),fov:pose.fov}
    let threw=false
    try{h.rail.approach(exhibit.id,moved,phone)}catch{threw=true}
    ensure(threw,'An uncertified viewing eye was walked to')
    h.at(1);compare(h.camera,origin,'Refused approach')
    threw=false
    try{h.rail.approach(exhibit.id,moved,phone,true)}catch{threw=true}
    ensure(threw,'An uncertified viewing eye was cut to')
    h.at(2);compare(h.camera,origin,'Refused placement')
    ensure(h.rail.navigation.exhibit===undefined,'A refused approach left an exhibit standing')
  })
  check(viewport,'Actual controller consumes the projected pixel delta and reaches 63.212% at 100 ms',()=>{
    const h=harness(phone),pose=h.pose('arrival'),base=new THREE.PerspectiveCamera();base.position.copy(pose.eye);base.lookAt(pose.at)
    const forward=new THREE.Vector3(0,0,-1).applyQuaternion(base.quaternion),heading=Math.atan2(-forward.x,-forward.z),elevation=Math.asin(forward.y)
    const delta=projectRailDrag(13,-9,h.camera.getEffectiveFOV(),phone?844:950),before=snapshot(h.camera)
    h.drag(13,-9);h.at(0);compare(h.camera,before,'Pointer event is continuous')
    for(const time of [.013,.049,.1,.173,1.7,10]) {
      h.at(time);const fraction=-Math.expm1(-time/.1)
      const expected={eye:pose.eye,q:new THREE.Quaternion().setFromEuler(new THREE.Euler(elevation+delta.pitch*fraction,heading+delta.yaw*fraction,0,'YXZ')),fov:h.camera.fov}
      compare(h.camera,expected,'Closed-form look response '+time)
    }
    return {responseSeconds:.1,fractionAtResponseTime:1-Math.exp(-1)}
  })
}
const ok=cases.every(c=>c.passed)
console.log(JSON.stringify({kind:'vinci-actual-factory-rail-interruptions',ok,clearanceMeasuredSeparately:true,actualGeometryAuthority:true,identityTimings,limitations:['Does not execute browser events or source-card DOM behavior.','Clearance is independently measured by geometry-check and the continuous route proof; these tests validate actual controller behavior on the verified routes.','Pending/rejected authority tests deliberately inject readiness/rejection failures around the real route provider.','Named inspection and resize remain explicit placements, not animated cleared paths.'],transitionSeconds:DURATION,cases,statistics,sources},null,2))
for(const group of factoryGroups)group.traverse(object=>{if(object.isMesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose()}})
process.exitCode=ok?0:1
