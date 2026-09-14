#!/usr/bin/env node
/** CPU ownership/configuration checks; shader pixels remain an EYES gate. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'
import * as TSL from 'three/tsl'

const source=readFileSync(new URL('./picture-shadow-filter.ts',import.meta.url),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const exports={}
vm.runInThisContext(`(function(exports,require){${code}\n})`)(exports,id=>{assert.equal(id,'three/tsl');return TSL})
const {configurePictureKeyShadow}=exports
const results=[]
const test=(name,run)=>{run();results.push({name,pass:true})}

test('Installs the actual exported TSL filter on the existing key only',()=>{
  const scene=new Three.Scene(),light=new Three.DirectionalLight('#d9e3ef',.65),fill=new Three.HemisphereLight()
  scene.add(light,light.target,fill);light.position.set(-4,3,2);light.target.position.set(1,0,0)
  const shadow=light.shadow,position=light.position.clone(),target=light.target.position.clone(),intensity=light.intensity
  const camera=shadow.camera,frustum=[camera.left,camera.right,camera.top,camera.bottom,camera.near,camera.far]
  shadow.radius=5
  const handle=configurePictureKeyShadow({light})
  assert.equal(shadow.filterNode,TSL.PCFShadowFilter)
  assert.equal(shadow.radius,1.5)
  assert.equal(handle.recipe.extraLights,0);assert.equal(handle.recipe.extraShadowMaps,0)
  assert.equal(scene.children.length,3);assert.equal(light.shadow,shadow);assert.equal(shadow.camera,camera)
  assert.equal(shadow.map,null);assert.equal(light.intensity,intensity)
  assert.deepEqual(light.position,position);assert.deepEqual(light.target.position,target)
  assert.deepEqual([camera.left,camera.right,camera.top,camera.bottom,camera.near,camera.far],frustum)
  handle.restore();assert.equal(shadow.radius,5);assert.equal(Object.hasOwn(shadow,'filterNode'),false)
})

test('Calm shadow policy and map ownership stay unchanged',()=>{
  const light=new Three.DirectionalLight(),shadow=light.shadow
  light.castShadow=false;shadow.autoUpdate=false;shadow.needsUpdate=false
  const handle=configurePictureKeyShadow({light},{radiusTexels:2})
  assert.equal(light.castShadow,false);assert.equal(shadow.autoUpdate,false);assert.equal(shadow.needsUpdate,false)
  assert.equal(shadow.map,null);assert.equal(handle.recipe.radiusTexels,2)
  handle.restore();handle.restore();assert.equal(light.castShadow,false)
})

test('Restoration preserves an existing hook and later independent settings',()=>{
  const light=new Three.DirectionalLight(),shadow=light.shadow
  const existing=()=>{};shadow.filterNode=existing;shadow.radius=4
  const first=configurePictureKeyShadow({light});first.restore()
  assert.equal(shadow.filterNode,existing);assert.equal(shadow.radius,4)
  const second=configurePictureKeyShadow({light}),later=()=>{}
  shadow.filterNode=later;shadow.radius=3
  second.restore();assert.equal(shadow.filterNode,later);assert.equal(shadow.radius,3)
})

test('Invalid light or radii reject before changing any settings',()=>{
  const light=new Three.DirectionalLight(),before=light.shadow.radius
  for(const radiusTexels of [0,-1,9,NaN,Infinity])assert.throws(()=>configurePictureKeyShadow({light},{radiusTexels}))
  assert.equal(light.shadow.radius,before);assert.equal(Object.hasOwn(light.shadow,'filterNode'),false)
  assert.throws(()=>configurePictureKeyShadow({light:new Three.PointLight()}))
})
console.log(JSON.stringify({sourceSha256:createHash('sha256').update(source).digest('hex'),passed:results.length,results,
  limitations:['No GPU, browser, texture sampling or visual softness was exercised.','Stock PCF uses deterministic screen-space noise; moving-edge stability remains an EYES check.']},null,2))
