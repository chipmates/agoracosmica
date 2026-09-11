#!/usr/bin/env node
/** Execute the actual rail factory with a controlled clock; no browser or rig.
 * Run: node src/wings/vinci/rail-check.mjs > <app-local report.json>
 * Interrupted trajectories are compared with uninterrupted factory controls.
 * The separate geometry checker establishes clearance of those route segments.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const media={reduced:false}, modules=new Map(), sources=[];
const errors=[], cases=[];
const statistics={cameraSamples:0,comparisons:0,maxPositionErrorM:0,maxAngleErrorRad:0,maxFovErrorDegrees:0,maxRollComponent:0,maxQuaternionNormError:0};
const DURATION=1.12, STEPS=224, STEP=DURATION/STEPS;
function appFile(file) {
  const absolute=fs.realpathSync(path.resolve(ROOT,file));
  if(absolute!==ROOT&&!absolute.startsWith(ROOT+path.sep))throw new Error('Read leaves app: '+file);
  return absolute;
}
function read(file) {
  const absolute=appFile(file),bytes=fs.readFileSync(absolute);
  if(!sources.some(s=>s.file===path.relative(ROOT,absolute)))sources.push({file:path.relative(ROOT,absolute),sha256:createHash('sha256').update(bytes).digest('hex')});
  return bytes.toString('utf8');
}
async function load(file) {
  const absolute=appFile(file);
  if(modules.has(absolute))return modules.get(absolute);
  const result={};modules.set(absolute,result);
  const code=ts.transpileModule(read(absolute),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const dependencies=new Map();
  for(const [,name] of code.matchAll(/\brequire\(["']([^"']+)["']\)/g)) {
    if(dependencies.has(name))continue;
    if(name.startsWith('.')) {
      const target=path.resolve(path.dirname(absolute),name.replace(/\?raw$/,''));
      dependencies.set(name,name.endsWith('?raw')?{default:read(target)}:await load(target+'.ts'));
    } else if(/^three(?:\/|$)/.test(name))dependencies.set(name,await import(name));
    else throw new Error('Unexpected runtime dependency: '+name);
  }
  new vm.Script(code,{filename:path.relative(ROOT,absolute)}).runInNewContext({
    exports:result,require:name=>dependencies.get(name),performance,
    matchMedia:()=>({matches:media.reduced}),
  },{timeout:10000});
  return result;
}
const {createRail,stationPose,namedPose}=await load('src/wings/vinci/rail.ts');
const {vinciContent}=await load('src/wings/vinci/content.ts');
const ids=vinciContent.map(station=>station.id);
const ensure=(condition,message)=>{if(!condition)throw new Error(message)};
function snapshot(camera) {return {eye:camera.position.clone(),q:camera.quaternion.clone(),fov:camera.fov}}
function compare(actual,expected,label) {
  const a=actual.position?snapshot(actual):actual,b=expected.position?snapshot(expected):expected;
  const p=a.eye.distanceTo(b.eye),angle=a.q.angleTo(b.q),fov=Math.abs(a.fov-b.fov);
  statistics.comparisons++;statistics.maxPositionErrorM=Math.max(statistics.maxPositionErrorM,p);
  statistics.maxAngleErrorRad=Math.max(statistics.maxAngleErrorRad,angle);statistics.maxFovErrorDegrees=Math.max(statistics.maxFovErrorDegrees,fov);
  ensure(p<1e-8&&angle<1e-7&&fov<1e-8,`${label}: camera differs (${p} m, ${angle} rad, ${fov} deg)`);
}
function validate(camera) {
  statistics.cameraSamples++;
  const values=[...camera.position.toArray(),...camera.quaternion.toArray(),camera.fov,...camera.projectionMatrix.elements];
  ensure(values.every(Number.isFinite),'Nonfinite camera state');
  const norm=Math.abs(camera.quaternion.length()-1),roll=Math.abs(new Vector3(1,0,0).applyQuaternion(camera.quaternion).y);
  statistics.maxQuaternionNormError=Math.max(statistics.maxQuaternionNormError,norm);statistics.maxRollComponent=Math.max(statistics.maxRollComponent,roll);
  ensure(norm<1e-10&&roll<1e-10,`Camera lost normalization or acquired roll (${norm}, ${roll})`);
}
function harness(narrow,initial='arrival') {
  let now=0;
  const camera=new PerspectiveCamera(49,narrow?780/1688:1512/950,.25,1100),rail=createRail(camera,()=>now);
  const h={camera,rail,pose:id=>stationPose(id,narrow),
    set(id,instant=false){rail.set(id,stationPose(id,narrow),instant)},
    at(time){now=time;rail.update();validate(camera)},
    requestAt(time,id){h.at(time);h.set(id)},
  };
  h.set(initial,true);h.at(0);return h;
}
function canonical(narrow,id) {return harness(narrow,id).camera}
function runCase(viewport,name,work) {
  const before=statistics.cameraSamples;
  try{work();cases.push({viewport,name,passed:true,samples:statistics.cameraSamples-before})}
  catch(error){const detail=error.stack??String(error);cases.push({viewport,name,passed:false});errors.push({viewport,name,detail})}
  finally{media.reduced=false}
}

for(const narrow of [false,true]) {
  const viewport=narrow?'phone':'desktop';
  runCase(viewport,'drag continuity and repeated arrival boundary',()=>{
    const h=harness(narrow);h.rail.drag(75,-43);h.at(0);const looked=snapshot(h.camera);
    for(let i=0;i<6;i++){h.set('arrival');h.at(0);compare(h.camera,looked,'duplicate arrival preserves gaze')}
    h.set('courtyard');compare(h.camera,looked,'navigation call preserves displayed gaze');h.at(0);compare(h.camera,looked,'first animated sample preserves displayed gaze');
    for(let i=1;i<=STEPS;i++)h.at(i*STEP);
    compare(h.camera,canonical(narrow,'courtyard'),'dragged leg arrives at canonical courtyard');
  });
  runCase(viewport,'latest pending request waits for completed route',()=>{
    const h=harness(narrow),control=harness(narrow);h.set('courtyard');control.set('courtyard');
    for(let i=0;i<=STEPS;i++){
      const t=i*STEP;h.at(t);control.at(t);
      if(i===45)h.set('garden');if(i===100)h.set('hall');if(i===145)h.set('arrival');
      compare(h.camera,control.camera,'interruptions retain the complete first route');
    }
    const back=harness(narrow,'courtyard');back.set('arrival');
    for(let i=0;i<=STEPS;i++){h.at(DURATION+i*STEP);back.at(i*STEP);compare(h.camera,back.camera,'latest route begins at completed courtyard')}
    h.at(8);compare(h.camera,canonical(narrow,'arrival'),'stale garden and hall requests are absent');
  });
  runCase(viewport,'repeated active target cancels stale pending work',()=>{
    const h=harness(narrow),control=harness(narrow);h.set('courtyard');control.set('courtyard');
    for(let i=0;i<=STEPS;i++){
      h.at(i*STEP);control.at(i*STEP);if(i===40)h.set('garden');if(i===80)h.set('courtyard');
      compare(h.camera,control.camera,'active duplicate keeps original timing');
    }
    h.at(10);compare(h.camera,canonical(narrow,'courtyard'),'active duplicate cleared the pending garden');
  });
  runCase(viewport,'same-position construction stations preserve gaze',()=>{
    const h=harness(narrow,'hall');h.rail.drag(-49,29);h.at(0);const looked=snapshot(h.camera);
    for(const id of ['oratory','study','chamber','hall']){h.set(id);h.at(3);compare(h.camera,looked,'shared threshold does not restart orientation')}
  });
  runCase(viewport,'instant named view and resize replace active and pending states',()=>{
    const h=harness(narrow);h.set('courtyard');h.requestAt(.2,'garden');
    const inspection=namedPose('oak-junction',narrow);ensure(inspection,'Named oak pose is missing');
    h.rail.set('arrival',inspection,true);const named=snapshot(h.camera);h.at(10);compare(h.camera,named,'same-ID named view cancelled motion and pending');
    const resized=stationPose('arrival',!narrow);h.rail.set('arrival',resized,true);const resize=snapshot(h.camera);h.at(20);compare(h.camera,resize,'same-ID resize remains applied');
    ensure(Math.abs(h.camera.fov-resized.fov)<1e-12,'Resize FOV was ignored');
  });
  runCase(viewport,'delayed update does not consume pending-route time',()=>{
    const h=harness(narrow);h.set('courtyard');h.requestAt(.2,'garden');h.at(10);
    compare(h.camera,canonical(narrow,'courtyard'),'delayed first leg ends at courtyard');
    h.at(10);compare(h.camera,canonical(narrow,'courtyard'),'pending leg has zero elapsed time');
    const control=harness(narrow,'courtyard');control.set('garden');
    for(let i=0;i<=STEPS;i++){h.at(10+i*STEP);control.at(i*STEP);compare(h.camera,control.camera,'pending leg uses the completion clock')}
  });
  runCase(viewport,'reduced motion cancels queued routes and preserves duplicates',()=>{
    const h=harness(narrow);h.set('courtyard');h.requestAt(.2,'garden');media.reduced=true;h.set('hall');
    compare(h.camera,canonical(narrow,'hall'),'reduced motion lands immediately');h.at(5);compare(h.camera,canonical(narrow,'hall'),'reduced motion cleared the queue');
    h.rail.drag(34,20);h.at(5);const looked=snapshot(h.camera);h.set('hall');h.at(6);compare(h.camera,looked,'reduced-motion duplicate preserves gaze');
  });
  runCase(viewport,'normalized forge rail cadence and final boundary',()=>{
    const h=harness(narrow);ensure(ids.length===19,'Expected the 19 actual stations');
    for(let i=0;i<ids.length;i++){
      const id=ids[Math.round((i/(ids.length-1))*(ids.length-1))],start=i*1.2;
      h.at(start);h.set(id);
      for(let sample=1;sample<=240;sample++)h.at(start+sample*.005);
      compare(h.camera,canonical(narrow,id),'1.2-second normalized forge request reaches '+id);
    }
    h.rail.drag(31,-19);h.at(24);const looked=snapshot(h.camera);
    for(let i=0;i<6;i++){h.set(ids.at(-1));h.at(25+i*.1);compare(h.camera,looked,'final boundary preserves gaze')}
  });
}

console.log(JSON.stringify({checker:'vinci-actual-factory-rail-interruptions',replacesEyes:false,
  limitations:['No browser, wheel, touch, keyboard event dispatch or shared-frame labels are exercised. Their common rail.set contract is exercised.',
    'Clearance is not independently measured here. Trajectory equivalence retains the routes inspected by geometry-check.mjs.',
    'Named material poses and resize are explicit instant inspection overrides, not traversed walking routes.'],
  sampleIntervalSeconds:STEP,transitionSeconds:DURATION,cases,statistics,sources,errors},null,2));
process.exitCode=errors.length?1:0;
