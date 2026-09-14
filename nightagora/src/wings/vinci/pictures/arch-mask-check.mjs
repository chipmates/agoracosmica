#!/usr/bin/env node
/** Geometry checks plus optional read-only source-byte validation.
 * No browser or image is generated. --source-check requires the existing
 * ImageMagick command to decode the already-admitted evidence JPEGs.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'

const source=readFileSync(new URL('./arch-mask.ts',import.meta.url),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const exports={}
vm.runInThisContext(`(function(exports,require){${code}\n})`)(exports,id=>{assert.equal(id,'three/webgpu');return Three})
const {PICTURE_ARCH_MASKS:recipes,pictureArchMask,archMaskBoundaryY,buildArchShoulderGeometry,archMaskDefaultWindow}=exports
const results=[]
const test=(name,run)=>{run();results.push({name,pass:true})}

test('Only exact admitted source IDs and hashes inherit a mask',()=>{
  for(const recipe of recipes){
    assert.equal(recipe.physicalRegistration,false)
    for(const item of recipe.sources){assert.equal(pictureArchMask(item),recipe);assert.equal(pictureArchMask({...item,sha256:'0'.repeat(64)}),null)}
    assert.equal(pictureArchMask({...recipe.sources[0],id:'a-different-source'}),null)
    assert.ok(recipe.retainedFringePx>0)
    for(let i=1;i<recipe.boundaryPx.length;i++)assert.ok(recipe.boundaryPx[i][0]>recipe.boundaryPx[i-1][0])
  }
})

test('Masks retain measured asymmetry and do not invent a circular apex',()=>{
  const [louvre,london]=recipes
  assert.equal(archMaskBoundaryY(louvre,0),278)
  assert.equal(archMaskBoundaryY(louvre,646),291)
  assert.ok(archMaskBoundaryY(louvre,320)<0,'Crown should remain wholly visible')
  assert.notEqual(archMaskBoundaryY(london,805),archMaskBoundaryY(london,2413))
  assert.equal(archMaskBoundaryY(london,0),null)
})

test('Geometry covers only the traced shoulders inside the actual source window',()=>{
  for(const recipe of recipes){
    const window=archMaskDefaultWindow(recipe),widthM=1.3,heightM=2.1
    const geometry=buildArchShoulderGeometry(recipe,{widthM,heightM,window})
    const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal')
    assert.ok(p.count>0 && p.count<600)
    assert.equal(geometry.userData.recipe.sourcePixelsEdited,false)
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i)
      assert.ok(Math.abs(x)<=widthM/2+1e-7 && Math.abs(y)<=heightM/2+1e-7 && z===0)
      assert.equal(n.getZ(i),1)
      const sx=(window.left+(x/widthM+.5)*(window.right-window.left))*recipe.evidence.width
      const sy=(window.top+(.5-y/heightM)*(window.bottom-window.top))*recipe.evidence.height
      const boundary=archMaskBoundaryY(recipe,Math.min(recipe.boundaryPx.at(-1)[0],Math.max(recipe.boundaryPx[0][0],sx)))
      assert.ok(sy<=Math.max(window.top*recipe.evidence.height,boundary)+.001)
    }
    for(let i=0;i<p.count;i+=3){
      const a=new Three.Vector3().fromBufferAttribute(p,i),b=new Three.Vector3().fromBufferAttribute(p,i+1),c=new Three.Vector3().fromBufferAttribute(p,i+2)
      assert.ok(b.sub(a).cross(c.sub(a)).z>0)
    }
    geometry.dispose()
  }
})

test('Independent triangle rays leave painting below the measured boundary uncovered',()=>{
  for(const recipe of recipes){
    const window=archMaskDefaultWindow(recipe),geometry=buildArchShoulderGeometry(recipe,{widthM:1,heightM:1,window})
    const mesh=new Three.Mesh(geometry,new Three.MeshBasicMaterial()),ray=new Three.Raycaster()
    mesh.updateMatrixWorld()
    for(let u=.01;u<1;u+=.019){
      const sx=(window.left+u*(window.right-window.left))*recipe.evidence.width
      const boundary=archMaskBoundaryY(recipe,sx)
      if(boundary===null)continue
      const y=(boundary+recipe.retainedFringePx+2)/recipe.evidence.height
      const v=(y-window.top)/(window.bottom-window.top)
      if(v<=0 || v>=1)continue
      ray.set(new Three.Vector3(u-.5,.5-v,1),new Three.Vector3(0,0,-1))
      assert.equal(ray.intersectObject(mesh).length,0)
    }
    geometry.dispose();mesh.material.dispose()
  }
})

test('Arbitrary contained windows clip safely and invalid dimensions reject',()=>{
  const r=recipes[0]
  const cropped=buildArchShoulderGeometry(r,{widthM:1,heightM:1,window:{left:.05,top:.10,right:.95,bottom:.8}})
  assert.ok(cropped.getAttribute('position').count>0);cropped.dispose()
  const none=buildArchShoulderGeometry(r,{widthM:1,heightM:1,window:{left:.1,top:.5,right:.9,bottom:1}})
  assert.equal(none.getAttribute('position').count,0);none.dispose()
  for(const opts of [{widthM:0,heightM:1},{widthM:1,heightM:NaN},{widthM:1,heightM:1,window:{left:-.1,top:0,right:1,bottom:1}}])assert.throws(()=>buildArchShoulderGeometry(r,opts))
})

let sourceEvidence=null
if(process.argv.includes('--source-check')){
  const sha=buffer=>createHash('sha256').update(buffer).digest('hex')
  const decode=recipe=>{
    // Resolve admitted fixtures through the recorded download manifest rather
    // than introducing a second bare image-path allowlist into source code.
    const appRoot=new URL('../../../../',import.meta.url)
    const directory=recipe.evidence.id.startsWith('vinci/painting-plate/') ? 'full/' : ''
    const downloaded=JSON.parse(readFileSync(new URL(`forge/shots/w2-source-scale/${directory}download-audit.json`,appRoot),'utf8'))
    const record=downloaded.find(item=>item[0]===recipe.evidence.id)
    assert.ok(record,'The exact evidence source must be present in the recorded download audit')
    assert.ok(record[1].startsWith(`forge/shots/w2-source-scale/${directory}`))
    const path=new URL(record[1],appRoot)
    assert.equal(sha(readFileSync(path)),recipe.evidence.sha256)
    const data=execFileSync('magick',[path.pathname,'-depth','8','RGB:-'],{maxBuffer:128*1024*1024})
    assert.equal(data.length,recipe.evidence.width*recipe.evidence.height*3)
    return data
  }
  sourceEvidence={}
  test('Louvre covered pixels remain source-white, leaving every significant non-white pixel',()=>{
    const recipe=recipes[0],data=decode(recipe),w=recipe.evidence.width
    let maskedPixels=0,minChannel=255,removedNonWhite=0
    for(let x=0;x<w;x++){
      const end=Math.max(0,Math.floor(archMaskBoundaryY(recipe,x+.5) ?? 0))
      for(let y=0;y<end;y++){
        const i=(y*w+x)*3,m=Math.min(data[i],data[i+1],data[i+2])
        maskedPixels++;minChannel=Math.min(minChannel,m);if(m<240)removedNonWhite++
      }
    }
    assert.ok(maskedPixels>30000)
    assert.equal(removedNonWhite,0)
    sourceEvidence.louvre={evidenceSha256:recipe.evidence.sha256,maskedPixels,minChannel,removedNonWhite,threshold:240}
  })
  test('London mask stays outside independently detected sustained dark rebate',()=>{
    const recipe=recipes[1],data=decode(recipe),w=recipe.evidence.width
    const luminance=(x,y)=>{const i=(y*w+x)*3;return .2126*data[i]+.7152*data[i+1]+.0722*data[i+2]}
    let checkedColumns=0,minClearance=Infinity,unresolvedColumns=0
    for(let x=780;x<=2430;x++){
      // A loose search envelope only. No ellipse or fitted curve enters the
      // mask; the checked boundary is the source's sustained dark edge.
      const guide=1680-757*Math.sqrt(Math.max(0,1-((x-1605)/835)**2))
      let observed=null
      for(let y=Math.max(860,Math.floor(guide)-130);y<Math.min(2000,Math.floor(guide)+180);y++){
        let dark=true
        for(let yy=y;yy<y+24;yy++)if((luminance(x-1,yy)+luminance(x,yy)+luminance(x+1,yy))/3>=80){dark=false;break}
        if(dark){observed=y;break}
      }
      if(observed===null){unresolvedColumns++;continue}
      checkedColumns++
      minClearance=Math.min(minClearance,observed-archMaskBoundaryY(recipe,x))
    }
    assert.ok(checkedColumns>1600)
    assert.ok(minClearance>=10,`Only ${minClearance} source pixels outside the detected dark rebate`)
    sourceEvidence.london={evidenceSha256:recipe.evidence.sha256,checkedColumns,unresolvedColumns,minClearancePx:minClearance,
      limitation:'Dark-edge segmentation checks the manually inspected aperture transition; it is not a semantic classifier for every painted pixel.'}
  })
  test('Benois covered pixels remain source-white, leaving every significant non-white pixel',()=>{
    const recipe=recipes.find(item=>item.id==='benois-madonna'),data=decode(recipe),w=recipe.evidence.width
    let maskedPixels=0,minChannel=255,removedNonWhite=0,minClearance=Infinity
    for(let x=0;x<w;x++){
      const boundary=archMaskBoundaryY(recipe,x+.5) ?? 0
      const end=Math.max(0,Math.floor(boundary))
      for(let y=0;y<recipe.evidence.height;y++){
        const i=(y*w+x)*3,m=Math.min(data[i],data[i+1],data[i+2])
        if(y<end){maskedPixels++;minChannel=Math.min(minChannel,m);if(m<240)removedNonWhite++}
        if(m<240){minClearance=Math.min(minClearance,y-boundary);break}
      }
    }
    assert.ok(maskedPixels>30000)
    assert.equal(removedNonWhite,0)
    assert.ok(minClearance>=2.5)
    sourceEvidence.benois={evidenceSha256:recipe.evidence.sha256,maskedPixels,minChannel,removedNonWhite,
      threshold:240,minClearancePx:minClearance,limitation:'Exhaustive preview-pixel check; normalized onto the exact full-source identity with a retained fringe, not a full-resolution semantic segmentation.'}
  })
}
console.log(JSON.stringify({sourceSha256:createHash('sha256').update(source).digest('hex'),passed:results.length,results,sourceEvidence},null,2))
