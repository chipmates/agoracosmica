#!/usr/bin/env node
/** Offline execution of the real shell: seed invariance across batch splits,
 * unchanged geometry and member attributes, affine roof-lining UVs, and
 * triangulation-independent UV seeds. R22 intentionally changes lining UVs.
 * Writes stdout only. Does not compile shaders or replace GPU review.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {BufferGeometry,Float32BufferAttribute} from 'three/webgpu';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const surfaceFile='src/wings/vinci/surface.ts',errors=[];
const fail=(message)=>errors.push(message);
function loader(overrides=new Map()){
  const cache=new Map(),location={search:''};
  const read=(file)=>{
    if(file!==root&&!file.startsWith(root+path.sep))throw new Error('Read leaves app');
    return overrides.get(path.relative(root,file))??fs.readFileSync(file,'utf8');
  };
  async function load(file){
    file=path.resolve(root,file);
    if(cache.has(file))return cache.get(file);
    const exports={};cache.set(file,exports);
    let compiled=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    // Inspect the actual private roof schedule without adding a runtime API.
    if(file.endsWith('/vinci/shell.ts'))compiled+='\nexports.inspectRoofFaces=roofFaces;';
    const dependencies=new Map();
    for(const [,name] of compiled.matchAll(/\brequire\(["']([^"']+)["']\)/g)){
      if(dependencies.has(name))continue;
      if(name.startsWith('.')){
        const target=path.resolve(path.dirname(file),name.replace(/\?raw$/,''));
        dependencies.set(name,name.endsWith('?raw')?{default:read(target)}:await load(target+'.ts'));
      }else if(/^three(?:\/|$)/.test(name))dependencies.set(name,await import(name));
      else throw new Error('Unexpected runtime dependency '+name);
    }
    new vm.Script(compiled,{filename:path.relative(root,file)}).runInNewContext({exports,require:name=>dependencies.get(name),location,URLSearchParams,console},{timeout:10000});
    return exports;
  }
  return {load,location};
}
function attributes(group){
  const result=new Map();
  for(const mesh of group.children){
    let entry=result.get(mesh.name);
    if(!entry){entry=new Map();result.set(mesh.name,entry);}
    for(const [name,attribute] of Object.entries(mesh.geometry.attributes)){
      const bytes=Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength);
      entry.set(name,Buffer.concat([entry.get(name)??Buffer.alloc(0),bytes]));
    }
  }
  return result;
}
const current=loader(),{createShell,inspectRoofFaces}=await current.load('src/wings/vinci/shell.ts');
const welded=createShell('standard'),weldedAttributes=attributes(welded);
current.location.search='?noweld';
const split=createShell('standard'),splitAttributes=attributes(split);
for(const [mesh,entry] of weldedAttributes)for(const [name,bytes] of entry){
  if(!bytes.equals(splitAttributes.get(mesh)?.get(name)??Buffer.alloc(0)))fail(`${mesh}/${name}: welded and noweld differ`);
}
const baselineSources=new Map([surfaceFile,'src/wings/vinci/shell.ts','src/wings/vinci/timber.ts'].map(file=>[file,execFileSync('git',['show',`HEAD:./${file}`],{cwd:root,encoding:'utf8'})]));
const baseline=loader(baselineSources),oldFactory=await baseline.load('src/wings/vinci/shell.ts');
const prior=oldFactory.createShell('standard'),priorAttributes=attributes(prior);
let unchangedAttributes=0;
for(const [mesh,entry] of priorAttributes)for(const [name,bytes] of entry){
  if(name==='oakSeed'||mesh==='vinci/shell/oak'&&name==='uv')continue;
  if(!bytes.equals(weldedAttributes.get(mesh)?.get(name)??Buffer.alloc(0)))fail(`${mesh}/${name}: prior geometry attribute changed`);
  else unchangedAttributes++;
}
const oak=welded.children.find(mesh=>mesh.name==='vinci/shell/oak');
const seeds=oak.geometry.getAttribute('oakSeed'),info=oak.geometry.getAttribute('surfaceInfo');
const positions=oak.geometry.getAttribute('position'),texcoords=oak.geometry.getAttribute('uv'),normals=oak.geometry.getAttribute('normal');
const oldOak=prior.children.find(mesh=>mesh.name==='vinci/shell/oak'),oldUV=oldOak.geometry.getAttribute('uv'),oldSeeds=oldOak.geometry.getAttribute('oakSeed');
const tones=oak.geometry.getAttribute('tone');
const {timberPanelFrame}=await current.load('src/wings/vinci/timber.ts');
const panels=new Map(inspectRoofFaces().map(face=>{const frame=timberPanelFrame(face.polygon.map(p=>[p[0],p[1],p[2]-.07]));return[Math.fround(frame.seed),frame];}));
let changedRoofUVVertices=0,checkedRoofUVVertices=0,unchangedMemberVertices=0;
for(let i=0;i<seeds.count;i++){
  const isLining=tones.getX(i)===Math.fround(.7)&&normals.getY(i)<-.05;
  const uvChanged=texcoords.getX(i)!==oldUV.getX(i)||texcoords.getY(i)!==oldUV.getY(i);
  if(!isLining){
    unchangedMemberVertices++;
    if(uvChanged||seeds.getX(i)!==oldSeeds.getX(i))fail(`Existing member UV or seed changed at ${i}`);
    continue;
  }
  if(uvChanged)changedRoofUVVertices++;
  const panel=panels.get(seeds.getX(i));
  if(!panel){fail(`Roof lining lacks its complete-face seed at ${i}`);continue;}
  const expected=panel.uv([positions.getX(i),-positions.getZ(i),positions.getY(i)]);
  if(Math.abs(texcoords.getX(i)-expected[0])>.00001||Math.abs(texcoords.getY(i)-expected[1])>.00001)fail(`Roof UV differs from its complete affine frame at ${i}`);
  checkedRoofUVVertices++;
}
if(checkedRoofUVVertices===0)fail('No roof lining UVs checked');
const same=(attribute,a,b)=>Array.from({length:attribute.itemSize},(_,axis)=>attribute.getComponent(a,axis)===attribute.getComponent(b,axis)).every(Boolean);
let checkedFaceDiagonals=0;
for(let i=0;i+5<seeds.count;i+=3){
  if(same(positions,i,i+3)&&same(positions,i+2,i+4)&&same(texcoords,i,i+3)&&same(texcoords,i+2,i+4)&&same(normals,i,i+3)){
    checkedFaceDiagonals++;
    if(seeds.getX(i)!==seeds.getX(i+3)){
      const frame=Array.from({length:6},(_,j)=>({position:Array.from({length:3},(_,axis)=>positions.getComponent(i+j,axis)),uv:[texcoords.getX(i+j),texcoords.getY(i+j)]}));
      fail(`Coplanar quad seed changes across its diagonal at ${i}: ${JSON.stringify(frame)}`);
    }
  }
}
for(let i=0;i<seeds.count;i+=3){
  const a=seeds.getX(i);
  if(!Number.isFinite(a)||a<0||a>1||a!==seeds.getX(i+1)||a!==seeds.getX(i+2))fail(`Seed is not finite and triangle-constant at ${i}`);
}
for(let i=0;i<info.count;i++)if(info.getY(i)!==0)fail(`Oak course period changed at ${i}`);
const distinctSeeds=new Set(seeds.array).size;
if(distinctSeeds<2)fail('Different oak faces share one seed');

const {prepareSurfaceGeometry}=await current.load(surfaceFile);
function seedQuad(indices,shift=0){
  const corners=[[0,0],[.14,0],[.14,1.7],[0,1.7]],positions=[],uv=[];
  for(const index of indices){const [u,v]=corners[index];positions.push(14.431+shift+u*.8-v*.3,-9.218+v*Math.sqrt(.75),18.174+u*.6+v*.4);uv.push(u,v);}
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
  geometry.setAttribute('tone',new Float32BufferAttribute(indices.map(()=>1),1));
  geometry.computeVertexNormals();prepareSurfaceGeometry(geometry,'oak');
  const result=Array.from(geometry.getAttribute('oakSeed').array);geometry.dispose();return result;
}
const first=seedQuad([0,1,2,0,2,3]),alternate=seedQuad([0,1,3,1,2,3]);
if(new Set([...first,...alternate]).size!==1)fail('One UV face changes seed when its diagonal changes');
if(seedQuad([0,1,2,0,2,3],.4)[0]===first[0])fail('Translated member did not receive independent variation');
for(const group of [welded,split,prior])for(const mesh of group.children)mesh.geometry.dispose();
console.log(JSON.stringify({checker:'vinci-oak-attributes',replacesEyes:false,unchangedAttributes,unchangedMemberVertices,changedRoofUVVertices,checkedRoofUVVertices,vertices:seeds.count,triangles:seeds.count/3,distinctSeeds,checkedFaceDiagonals,weldedParts:welded.children.length,noweldParts:split.children.length,errors,ok:errors.length===0},null,2));
if(errors.length)process.exitCode=1;
