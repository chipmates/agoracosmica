/** Reuse only the fixed, opaque owned scene's real depth maps. */
import {BasicShadowMap,PCFShadowMap,PCFSoftShadowMap,DirectionalLight,Material,Mesh,Object3D,
  type Camera,type Scene,type WebGPURenderer,type RenderTarget,type BufferAttribute,type InterleavedBufferAttribute}from'three/webgpu'

type LightState={autoUpdate:boolean;map:RenderTarget|null;onDispose:()=>void}
type UnknownMaterial=Material&Record<string,unknown>
const unsupportedNodes=['positionNode','vertexNode','castShadowPositionNode','depthNode','maskNode','maskShadowNode','alphaTestNode','opacityNode','castShadowNode','fragmentNode','geometryNode'] as const
const maps=['map','alphaMap','displacementMap'] as const
const callbacks=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'] as const
const nativeShadowUpdate=new DirectionalLight().shadow.updateMatrices

export function createStaticShadowCache(scene:Scene,camera:Camera,renderer:WebGPURenderer,pending:()=>number){
  const ids=new WeakMap<object,number>(),lights=new Map<DirectionalLight,LightState>(),initialColor=new WeakMap<Material,unknown>()
  let nextId=1,previous='',closed=false,dirty=true,previousPending=0,checks=0,invalidations=0,eligible=false,reasons:string[]=[]
  const id=(value:unknown):number=>{if(value===null||typeof value!=='object'&&typeof value!=='function')return 0;const object=value as object;let n=ids.get(object);if(n===undefined){n=nextId++;ids.set(object,n)}return n}
  const onMapDisposed=()=>{dirty=true}
  // Initial factory materials are the audited static RGB recipes. If one is
  // replaced with an unknown color graph, keep native updates until remounted.
  scene.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])initialColor.set(m,(m as UnknownMaterial)['colorNode'])})
  function update(){
    if(closed)return
    checks++;scene.updateMatrixWorld(true)
    const parts:(string|number|boolean|null)[]=[],unsupported=new Set<string>(),owned:DirectionalLight[]=[],effectiveCasters:Mesh[]=[]
    const push=(...values:(string|number|boolean|null)[])=>{parts.push(...values)}
    function attr(a:BufferAttribute|InterleavedBufferAttribute|undefined){
      if(!a){push(0);return}
      if('isInterleavedBufferAttribute'in a){const data=(a as InterleavedBufferAttribute).data;push(id(a),id(data),id(data.array),data.version,data.stride,a.count,a.itemSize,a.normalized)}
      else{const b=a as BufferAttribute;push(id(b),id(b.array),b.version,b.count,b.itemSize,b.normalized,b.usage,b.gpuType)}
    }
    function material(m:Material){
      const q=m as UnknownMaterial
      push('material',id(m),m.version,m.visible,m.side,m.shadowSide,m.opacity,m.transparent,m.alphaTest,m.alphaHash,m.alphaToCoverage,m.depthTest,m.depthWrite,m.colorWrite,m.allowOverride,m.clipShadows,m.clipIntersection)
      if(m.opacity!==1||m.transparent||m.alphaTest!==0||m.alphaHash||m.alphaToCoverage||!m.allowOverride)unsupported.add('non-opaque or override-resistant material')
      if(m.clippingPlanes?.length)unsupported.add('material clipping planes')
      if(m.onBeforeRender!==Material.prototype.onBeforeRender||m.onBeforeCompile!==Material.prototype.onBeforeCompile)unsupported.add('material callback')
      if(!initialColor.has(m)||initialColor.get(m)!==q['colorNode'])unsupported.add('new or changed color graph')
      push(id(q['colorNode']))
      for(const key of unsupportedNodes){push(id(q[key]));if(q[key]!=null)unsupported.add('dynamic shadow input '+key)}
      for(const key of maps){const value=q[key] as {version?:number;source?:{version?:number}}|null;push(id(value),value?.version??0,value?.source?.version??0);if(value!=null)unsupported.add('unproven alpha/displacement texture '+key)}
      // Node transmission/backdrops alter the shadow override's transparency.
      for(const key of['transmissionNode','backdropNode'])if(q[key]!=null)unsupported.add('transmissive node '+key)
      if(typeof q['transmission']==='number'&&q['transmission']>0)unsupported.add('transmissive material')
    }
    function walk(object:Object3D,parentsVisible:boolean){
      const visible=parentsVisible&&object.visible
      if(object instanceof DirectionalLight)owned.push(object)
      const extended=object as Object3D&{isClippingGroup?:boolean;enabled?:boolean;isLOD?:boolean;isLine?:boolean;isPoints?:boolean;isSprite?:boolean}
      if(visible&&extended.isClippingGroup&&extended.enabled)unsupported.add('scene clipping group')
      if(visible&&extended.isLOD)unsupported.add('camera-dependent LOD')
      if(visible&&object.castShadow&&!(object instanceof Mesh)&&(extended.isLine||extended.isPoints||extended.isSprite||'geometry'in object||'material'in object))unsupported.add('non-mesh shadow caster')
      if(object instanceof Mesh&&object.castShadow&&visible){
        effectiveCasters.push(object)
        const mesh=object as Mesh&{isSkinnedMesh?:boolean;isInstancedMesh?:boolean;isBatchedMesh?:boolean}
        if(mesh.isSkinnedMesh||mesh.isInstancedMesh||mesh.isBatchedMesh||mesh.morphTargetInfluences?.length)unsupported.add('skinned, instanced, batched or morph caster')
        for(const key of callbacks)if(mesh[key]!==Object3D.prototype[key])unsupported.add('object callback '+key)
        push('caster',id(mesh),mesh.layers.mask,mesh.frustumCulled,...mesh.matrixWorld.elements)
        const g=mesh.geometry;push('geometry',id(g),g.drawRange.start,String(g.drawRange.count),'index')
        attr(g.index??undefined)
        const attributes=Object.keys(g.attributes).sort();push('attributes',attributes.length)
        for(const name of attributes){push('attribute',name);attr(g.attributes[name])}
        if(Object.values(g.morphAttributes).some(a=>a&&a.length))unsupported.add('morph geometry')
        push('groups',g.groups.length)
        for(const group of g.groups)push(group.start,group.count,group.materialIndex??0)
        const sphere=g.boundingSphere,box=g.boundingBox
        if(sphere)push('sphere',...sphere.center.toArray(),sphere.radius);else push('sphere-null')
        if(box)push('box',...box.min.toArray(),...box.max.toArray());else push('box-null')
        const materialArray=Array.isArray(mesh.material),materials=materialArray?mesh.material as Material[]:[mesh.material as Material];push('materials',materialArray,materials.length)
        for(const m of materials)material(m)
      }
      for(const child of object.children)walk(child,visible)
    }
    walk(scene,true)
    const shadowConfig=renderer.shadowMap,loadCount=pending(),validPending=Number.isFinite(loadCount)&&Number.isInteger(loadCount)&&loadCount>=0
    push('renderer',shadowConfig.enabled,shadowConfig.type,shadowConfig.transmitted,renderer.reversedDepthBuffer,renderer.logarithmicDepthBuffer,renderer.highPrecision,camera.layers.mask)
    if(!new Set<number>([BasicShadowMap,PCFShadowMap,PCFSoftShadowMap]).has(shadowConfig.type))unsupported.add('unsupported shadow-map type')
    if(shadowConfig.transmitted)unsupported.add('transmitted shadow color')
    if(!validPending)unsupported.add('invalid material pending count')
    else if(loadCount>0)unsupported.add('material load pending')
    if(previousPending>0&&validPending&&loadCount===0)dirty=true
    previousPending=validPending?loadCount:1
    push('lights',owned.length)
    for(const light of owned){
      const s=light.shadow
      if(!lights.has(light))lights.set(light,{autoUpdate:s.autoUpdate,map:null,onDispose:onMapDisposed})
      const state=lights.get(light)!,map=s.map
      if(state.map!==map){state.map?.removeEventListener('dispose',state.onDispose);state.map=map;map?.addEventListener('dispose',state.onDispose);dirty=true}
      light.updateWorldMatrix(true,false);light.target.updateWorldMatrix(true,false)
      for(const object of[light,light.target])for(const key of callbacks)if(object[key]!==Object3D.prototype[key])unsupported.add('light or target callback '+key)
      if(s.updateMatrices!==nativeShadowUpdate)unsupported.add('custom shadow camera update')
      const c=s.camera,extra=s as typeof s&{filterNode?:unknown;biasNode?:unknown;normalBiasNode?:unknown;shadowNode?:unknown}
      push('light',id(light),light.visible,light.layers.mask,light.castShadow,...light.matrixWorld.elements,id(light.target),...light.target.matrixWorld.elements,
        s.mapSize.x,s.mapSize.y,s.mapType,id(map),map?.width??0,map?.height??0,id(map?.depthTexture),map?.depthTexture?.version??0,
        c.near,c.far,c.left,c.right,c.top,c.bottom,c.layers.mask,...c.up.toArray(),...c.projectionMatrix.elements,...s.matrix.elements,
        s.bias,s.normalBias,s.radius,s.blurSamples,s.intensity,id(extra.filterNode),id(extra.biasNode),id(extra.normalBiasNode),id(extra.shadowNode))
      if(extra.biasNode||extra.normalBiasNode||extra.shadowNode)unsupported.add('custom light shadow node')
    }
    for(const[light,state]of lights)if(!owned.includes(light)){state.map?.removeEventListener('dispose',state.onDispose);light.shadow.autoUpdate=state.autoUpdate;lights.delete(light);dirty=true}
    // Fallback membership is itself a dependency: when an unknown caster or
    // callback disappears, render a fresh map before returning to reuse.
    push('unsupported',unsupported.size,...[...unsupported].sort())
    const signature=JSON.stringify(parts),changed=signature!==previous
    previous=signature;reasons=[...unsupported];eligible=reasons.length===0
    if(changed||dirty){invalidations++;for(const light of owned)light.shadow.needsUpdate=true}
    for(const light of owned)light.shadow.autoUpdate=!eligible
    // Only clear the guard's own latch. Three alone clears shadow.needsUpdate
    // after its render/depth-version checks, including the map resize retry.
    dirty=false
    void effectiveCasters
  }
  update()
  return{update,invalidate(){dirty=true},state:()=>({checks,invalidations,eligible,reasons:[...reasons],lights:lights.size}),
    dispose(){if(closed)return;closed=true;for(const[light,state]of lights){state.map?.removeEventListener('dispose',state.onDispose);light.shadow.autoUpdate=state.autoUpdate}lights.clear()}}
}
