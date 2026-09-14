import { BoxGeometry, Color, DirectionalLight, FogExp2, Group, Mesh, MeshStandardNodeMaterial, PerspectiveCamera, PlaneGeometry, Scene, Vector3, type Material } from 'three/webgpu'
import type { Stack, KeyLight } from '../../../../stack'
import { IDENTITY } from '../../../../stack/grade'
import { applyDetail } from '../../../../stack/detail'
import { readLabels } from '../../../../core/labels'
import { loadManifest, type ManifestEntry } from '../../../../manifest'
import { createLine, STUDS, CERTAINTY, SPACING, AFTERLIFE, weld } from '..'
import * as TSL from 'three/tsl'
import { createInscription } from '../../words'
import { Construction, plasterWall, exhibitionFloor, galleryBackdrop } from '../../myths/construction'
import { createMythDeathbed, createMythQuotes, DEATHBED_EVIDENCE } from '../../myths'
import { createGrave, GRAVE_HOUR } from '../../grave'
import { computedHour } from '../../grave/hour'
import { APOCRYPHA_DE, APOCRYPHA_READINGS, SOURCE_LANGUAGE_DE } from '../../myths/translations'
import inscriptions from '../../words/data/inscriptions.json'
import doors from '../../data/doors.json'
import { loadPlate, PLATES, type LoadedPlate } from './assets'
import css from './bench.css?inline'
import { setRegister } from './register'
import { SOURCE_READINGS, INSCRIPTION_SOURCE, GRAVE_SOURCE, GRAVE_DIAGRAM, INGRES_SOURCE } from './visitor-sources'
import {createBenchStone,createBenchDark,createBenchBronze,createBenchBacking} from './materials'

export const BENCH_STATES=['line-early','line-late','stud-1503','inscription','myth-deathbed','myth-quotes','grave','phone-line'] as const
export type BenchState=typeof BENCH_STATES[number]
export interface BenchOptions {kind?:string;state?:string;stud?:string;lang?:'en'|'de';quote?:number;audit?:boolean;seconds?:number;sources?:boolean;record?:boolean;close?:'bronze'|'limestone'|'plaster'|'tuffeau'|'slate'}
const TITLES:Record<BenchState,[string,string]>={
 'line-early':['Vinci, Florence, Milan','Vinci, Florenz, Mailand'],
 'line-late':['The wandering years, and Rome','Die Wanderjahre und Rom'],
 'stud-1503':['Agostino Vespucci’s note','Die Notiz des Agostino Vespucci'],
 inscription:['His own words','Seine eigenen Worte'],
 'myth-deathbed':['The room of corrections','Der Raum der Richtigstellungen'],
 'myth-quotes':['Six lines everyone quotes','Sechs Sätze, die alle zitieren'],
 grave:['Presumed','Mutmaßlich'],
 'phone-line':['Every date on the line','Jedes Datum auf der Linie'],
}
const AFTERLIFE_DE='Die Einträge nach 1519 betreffen die spätere Rezeption des Werks, nicht Leonardos bezeugte Lebenszeit.'
const sourceText=(value:string,lang:string)=>{const p=make('p','',value);p.lang=lang;return p}
const make=<K extends keyof HTMLElementTagNameMap>(tag:K,cls:string,text?:string)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el}
export function createBench(stack:Stack){
 let materialReady:Promise<void>|undefined, mount=0, stableFrames=0, close:BenchOptions['close']
 let host:HTMLElement|undefined, key:KeyLight|undefined, root:Group|undefined
 const scene=new Scene(),camera=new PerspectiveCamera(43,innerWidth/innerHeight,.08,100)
 let state:BenchState='line-early', selected=0, language:'en'|'de'='en', quote=0, clockSeconds=0, sourceOpen=false, recordOpen=false, hourPlaying=false, hourStart=0, walkStart=0, walkOffset=0, serial=0, pending=0, active=false, audit=false
 let plateFailure:string|undefined
 let plate:LoadedPlate|undefined, controller:AbortController|undefined, entries:ManifestEntry[]=[]
 let title:HTMLElement,card:HTMLElement,count:HTMLElement,previous:HTMLButtonElement,next:HTMLButtonElement,section:HTMLElement,question:HTMLElement
 let materials:{stone:Material;plaster:Material;bronze:Material;ink:Material;dark:Material;tuffeau:Material;backing:Material}|undefined
 const narrow=()=>innerWidth<651
 const isLine=()=>state.startsWith('line-')||state==='phone-line'||state==='stud-1503'
 const passage=inscriptions.passages.find(p=>p.id==='richter-498')!
 const owned=new Set<Material>()
 const text=(en:string,de:string)=>language==='en'?en:de
 function init(){
  active=true
  scene.background=new Color('#2b3534');scene.fog=new FogExp2('#53605a',.023)
  // Each room carries its own air: the walk is long enough for distance to
  // dissolve, a gallery wall ten metres off must not go grey.
  stack.setScene(scene,camera,{...IDENTITY,name:'vinci-line-bench',exposure:1.12,saturation:.86,vignette:.16,grain:.003})
  key=stack.light({azimuth:135,elevation:28,kelvin:4900,lux:280,ambient:.42,reach:28,cascades:[14,28],sky:{zenith:'#a1b6bf',horizon:'#e0d4b9',ground:'#4f5146',stars:0}})
  key.fill.color.set('#bdc6bf');key.fill.groundColor.set('#575744');key.fill.intensity=.8;scene.environmentIntensity=.6
  const projection=TSL.normalWorld.y.abs().greaterThan(.5).select(TSL.positionWorld.xz,TSL.normalWorld.x.abs().greaterThan(.5).select(TSL.positionWorld.zy,TSL.positionWorld.xy))
  const generation=++mount
  materialReady=Promise.all(['limestone-pale','plaster-lime-aged','bronze-dark'].map(async name=>{const set=stack.materials.sync(name),start=performance.now();while(!set.ready.value){const failure=stack.materials.missing().find(item=>item.name===name);if(failure)throw new Error(failure.reason);if(performance.now()-start>20000)throw new Error(`Material did not become ready: ${name}`);await new Promise(resolve=>setTimeout(resolve,40))}return set})).then(()=>{
  if(generation!==mount)return
  const surface=(name:string)=>{const set=stack.materials.sync(name),opts={count:3 as const,uv:projection,...(name==='plaster-lime-aged'?{maps:.5,mid:.32,macro:.17,micro:.7}:{maps:.22,mid:.12,macro:.2,micro:.3})};const mat=new MeshStandardNodeMaterial({color:set.albedo,roughness:set.roughness,metalness:set.metalness});applyDetail(mat,name==='limestone-pale'&&set.grain?{...set,normalStrength:.16,grain:{...set.grain,relief:.012,shade:.025,sheen:.015}}:set,opts);if(name==='plaster-lime-aged')mat.aoNode=TSL.float(.35).add(TSL.smoothstep(.05,2.9,TSL.positionWorld.y).mul(.65)).mul(TSL.float(.65).add(TSL.smoothstep(-8.4,6.2,TSL.positionWorld.x).mul(.35)));if(name==='limestone-pale'){
   // The walk has a grain that runs with it: long bedding streaks, tight
   // across the path and stretched along it, thinning with distance so the
   // far paving never sparkles.
   const near=TSL.float(1).sub(TSL.smoothstep(7,26,TSL.positionWorld.distance(TSL.cameraPosition)))
   const bedding=TSL.mx_noise_float(TSL.vec3(TSL.positionWorld.x.mul(11.5),TSL.positionWorld.z.mul(.52),7.7)).mul(.5).add(.5)
   const fine=TSL.mx_noise_float(TSL.vec3(TSL.positionWorld.x.mul(46),TSL.positionWorld.z.mul(2.1),2.3)).mul(.5).add(.5)
   const up=TSL.normalWorld.y.abs().greaterThan(.5)
   const streak=up.select(bedding.mul(.098).add(fine.mul(.042)).mul(near),TSL.float(0))
   const tinted=mat.colorNode,rough=mat.roughnessNode
   if(tinted)mat.colorNode=(tinted as unknown as {mul:(n:unknown)=>never}).mul(TSL.float(1).sub(streak))
   mat.roughnessNode=rough?(rough as unknown as {add:(n:unknown)=>never}).add(streak.mul(.5)):TSL.float(.84).add(streak.mul(.5))
  }
  mat.name=name;owned.add(mat);return mat}
  materials={tuffeau:createBenchStone(),stone:surface('limestone-pale'),plaster:surface('plaster-lime-aged'),bronze:createBenchBronze(),ink:new MeshStandardNodeMaterial({color:'#292f2b',roughness:.92}),dark:createBenchDark(),backing:createBenchBacking()}
  owned.add(materials.bronze);owned.add(materials.ink);owned.add(materials.dark);owned.add(materials.tuffeau);owned.add(materials.backing)
  })
  host=make('section','vb');host.setAttribute('aria-label','Leonardo da Vinci exhibition bench')
  const style=make('style','');style.textContent=css;host.append(style)
  const surfaceHost=make('div','vb-surface');surfaceHost.setAttribute('aria-label',text('Walk the line with wheel or swipe','Die Linie mit Rad oder Wischgeste gehen'));host.append(surfaceHost)
  const header=make('header','vb-header');header.dataset['naPersistent']=''
  const brand=make('div','vb-brand','AGORA COSMICA');brand.dataset['naBrand']=''
  const tools=make('div','vb-tools'), langButton=make('button','vb-lang',language==='en'?'DE':'EN');langButton.type='button';langButton.setAttribute('aria-label',text('Change language','Sprache wechseln'));langButton.onclick=()=>{language=language==='en'?'de':'en';langButton.textContent=language==='en'?'DE':'EN';void compose()}
  const sources=make('button','vb-sources',text('Sources','Quellen'));sources.type='button';sources.setAttribute('aria-controls','vb-source-drawer');sources.onclick=()=>{sourceOpen=!sourceOpen;if(!sourceOpen)recordOpen=false;paint();if(sourceOpen){card.querySelector('details')?.scrollIntoView({block:'nearest'});card.focus({preventScroll:true})}}
  tools.append(sources,langButton);header.append(brand,tools);host.append(header)
  title=make('div','vb-title');card=setRegister(make('aside','vb-card'),'drawer');card.setAttribute('aria-live','polite');card.tabIndex=-1;host.append(title,card)
  const footer=make('nav','vb-footer');footer.dataset['naPersistent']='';footer.setAttribute('aria-label',text('Exhibition navigation','Ausstellungsnavigation'))
  const steps=make('div','vb-steps');previous=make('button','',text('← Previous','← Zurück'));next=make('button','',text('Next →','Weiter →'));previous.type=next.type='button';previous.onclick=()=>step(-1);next.onclick=()=>step(1);count=make('span','vb-count');const bay=make('select','vb-bay');bay.setAttribute('aria-label',text('Choose a timeline chapter','Zeitraum wählen'));for(const [value,label] of [['0','1452–1499'],['25','1500–1515'],['36','1516–2020']]){const option=make('option','',label);option.value=value!;bay.append(option)}bay.onchange=()=>{selected=Number(bay.value);sourceOpen=false;recordOpen=false;void compose()};steps.append(previous,count,next,bay)
  section=make('div','vb-sections');for(const [id,en,de] of [['line-early','The line','Die Linie'],['inscription','Words','Worte'],['myth-deathbed','Corrections','Richtigstellungen'],['grave','Presumed','Mutmaßlich']]){const b=make('button','',text(en!,de!));b.type='button';b.dataset['state']=id;b.onclick=()=>void show({state:id});section.append(b)}footer.append(steps,section)
  host.append(footer)
  question=make('span','vb-sr');host.append(question)
  footer.append(make('div','vb-instruction',text('WHEEL OR SWIPE TO WALK · EQUAL SPACING, NOT ELAPSED YEARS','RAD ODER WISCHEN · ABSTÄNDE NICHT ZEITPROPORTIONAL')))
  document.body.append(host)
  controller=new AbortController();const signal=controller.signal
  let wheel=0,lastWheel=0,touchY=0,touchX=0
  surfaceHost.addEventListener('wheel',e=>{if(e.ctrlKey)return;e.preventDefault();const now=performance.now();if(now-lastWheel<360)return;wheel+=e.deltaY;if(Math.abs(wheel)>55){step(wheel>0?1:-1);wheel=0;lastWheel=now}},{signal,passive:false})
  surfaceHost.addEventListener('touchstart',e=>{touchY=e.touches[0]?.clientY??0;touchX=e.touches[0]?.clientX??0},{signal,passive:true})
  surfaceHost.addEventListener('touchend',e=>{const t=e.changedTouches[0];if(t&&Math.abs(t.clientY-touchY)>45&&Math.abs(t.clientY-touchY)>Math.abs(t.clientX-touchX))step(t.clientY<touchY?1:-1)},{signal,passive:true})
  window.addEventListener('keydown',e=>{
   if(!active||e.ctrlKey||e.metaKey||e.altKey)return
   if(e.key==='Escape'){const detail=card.querySelector<HTMLDetailsElement>('.vb-record[open]')??card.querySelector<HTMLDetailsElement>('.vb-drawer[open]');if(detail){detail.open=false;e.preventDefault()}return}
   if((e.target as Element)?.closest('input,select,textarea,button,a,summary,[contenteditable="true"],.vb-card'))return
   if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)){e.preventDefault();step(e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1)}
  },{signal})
  const restore=()=>{
   const restoredState=location.pathname.split('/')[4]
   if(!active||!location.pathname.startsWith('/bench/vinci/line/')||!BENCH_STATES.includes(restoredState as BenchState))return
   const hash=new URLSearchParams(location.hash.slice(1)),lang=hash.get('lang'),q=Number(hash.get('quote'))
   void show({state:restoredState,stud:hash.get('stud')??undefined,lang:lang==='de'?'de':'en',quote:Number.isFinite(q)?q:0})
  }
  window.addEventListener('hashchange',restore,{signal});window.addEventListener('popstate',restore,{signal})
  let wasNarrow=narrow();window.addEventListener('resize',()=>{if(wasNarrow!==narrow()){wasNarrow=narrow();void compose()}else{pose();paint();pose()}},{signal})
 }
 function clear(preserve?:LoadedPlate){if(root){scene.remove(root);root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(!owned.has(m))m.dispose()}});root=undefined}if(plate!==preserve)plate?.texture.dispose();plate=undefined}
 async function show(opts:BenchOptions={}){
  if(!active)init()
  if(opts.lang)language=opts.lang
  if(opts.state&&BENCH_STATES.includes(opts.state as BenchState))state=opts.state as BenchState
  if(opts.stud){const n=STUDS.findIndex(s=>s.id===opts.stud);if(n>=0)selected=n}
  else if(opts.state){selected=state==='stud-1503'?STUDS.findIndex(s=>s.id==='life-29'):state==='line-late'?25:0}
  if(opts.quote!==undefined)quote=Number.isFinite(opts.quote)?Math.min(5,Math.max(0,Math.floor(opts.quote))):0
  close=opts.close
  sourceOpen=Boolean(opts.sources||opts.record);recordOpen=Boolean(opts.record)
  clockSeconds=Number.isFinite(opts.seconds)?Math.min(60,Math.max(0,opts.seconds!)):0;hourPlaying=false
  audit=Boolean(opts.audit)
  await compose()
 }
 function box(g:Group,w:number,h:number,d:number,x:number,y:number,z:number,mat:Material){const m=new Mesh(new BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m}
 async function compose(walk=0){
  // Every selection path, including a restored hash, leaves the special plate
  // state when its selected record is no longer the Vespucci note.
  if(state==='stud-1503'&&STUDS[selected]?.id!=='life-29')state=STUDS[selected]?.station==='line-early'?'line-early':'line-late'
  const ticket=++serial;pending=1;stableFrames=0;host?.setAttribute('aria-busy','true')
  const plateId=state==='myth-deathbed'?PLATES.ingres:isLine()&&STUDS[selected]?.id==='life-29'?PLATES.vespucci:undefined
  try{
   await materialReady;if(ticket!==serial||!active)return
   const m=materials!
   let incoming:LoadedPlate|undefined
   plateFailure=undefined
   try{incoming=plateId?(plate?.entry.id===plateId&&plate.tier===stack.cost().tier?plate:await loadPlate(plateId,stack.cost().tier)):undefined}
   catch(error){if(ticket!==serial||!active)return;plateFailure=error instanceof Error?error.message:String(error)}
   if(ticket!==serial||!active){if(incoming!==plate)incoming?.texture.dispose();return}
   // Keep the visible exhibit until its replacement is ready; reuse an unchanged plate.
   const continuedWalk=walk?-(selected-Number(root?.userData['benchSelected']??selected))*1.65+(root?.position.z??0):0
   clear(incoming);plate=incoming
   if(isLine()){
    root=createLine(m,selected,language,narrow())
    // The facsimile lies on a real angled reading stand beside its date.
    if(plate){const stand=new Group();const standScale=narrow()?.93:1,standX=narrow()?.24:.3;stand.position.set(standX,1.24,-1.6);stand.rotation.x=.32;box(stand,3.2,.06,1.25,0,0,0,m.dark).castShadow=false;box(stand,3.18,.022,1.23,0,-.02,0,m.bronze);box(stand,3.06,.008,1.05,0,.032,0,m.ink).castShadow=false;box(stand,2.98,.006,.986,0,.034,0,m.stone).castShadow=false;box(stand,3.2,.035,.035,0,.044,.606,m.bronze);const imageMat=new MeshStandardNodeMaterial({map:plate.texture,roughness:.9,metalness:0});const leaf=new Mesh(new PlaneGeometry(2.94,.882),imageMat);leaf.userData={manifestId:plate.entry.id,asset:plate.entry.id,manifestClass:plate.entry.class};leaf.position.y=.038;leaf.rotation.x=-Math.PI/2;stand.add(leaf);
     // The top carries its own weight: each leg stands 0.2 m in from the end
     // it supports, at either viewport, so nothing cantilevers into the air.
     // The right leg also stays clear of the floor words it stands beside.
     const half=1.6*standScale,legs=[standX-half+.20,standX+half-.20];
     for(const x of legs){
      box(root,.07,1.22,.07,x,.61,-1.6,m.bronze);
      box(root,.31,.009,.30,x,.004,-1.6,m.dark).castShadow=false;
      box(root,.28,.06,.27,x,.032,-1.6,m.bronze);
      box(root,.115,.075,.115,x,.083,-1.6,m.bronze)
     }
     box(root,legs[1]!-legs[0]!,.045,.045,(legs[0]!+legs[1]!)/2,1.02,-1.6,m.bronze);
     if(narrow())stand.scale.set(standScale,1,standScale);root.add(stand)}
   }else if(state==='myth-deathbed')root=createMythDeathbed(m,plate?.texture,language,{mobile:narrow()}).group
   else if(state==='myth-quotes')root=createMythQuotes(m,{mobile:narrow(),quoteIndex:quote,readings:APOCRYPHA_READINGS[language]}).group
   else if(state==='grave')root=createGrave(m,language,{mobile:narrow()}).group
   else{
    root=new Group();const wall=new Construction(m,'inscription-wall','vinci/inscription-carrier');plasterWall(wall,7.8,4.2,2.1,-.24);root.add(wall.finish());
    box(root,7.94,.08,.42,0,.035,-.06,m.dark);
    box(root,7.9,.20,.34,0,.16,-.10,m.tuffeau);
    box(root,.22,4.2,.66,3.82,2.1,-.05,m.plaster);
    box(root,7.88,.13,.60,0,4.22,-.07,m.tuffeau)
    const inscription=createInscription(passage.id,language,{surface:m.tuffeau,ink:m.ink,width:4.8,height:2.8,size:.29,siglum:false})
    // The tablet is set into the wall behind a moulded surround, not stood off
    // it: a 0.37 m standoff threw a hard shadow and read as a card pinned up.
    inscription.group.position.set(0,2.1,-.06)
    const surroundW=inscription.width+.34, surroundH=inscription.height+.34
    box(root,surroundW+.30,.17,.27,0,2.1+surroundH/2-.085,-.10,m.tuffeau)
    box(root,surroundW+.30,.17,.27,0,2.1-surroundH/2+.085,-.10,m.tuffeau)
    for(const side of [-1,1])box(root,.17,surroundH,.27,side*(surroundW/2-.085),2.1,-.10,m.tuffeau)
    box(root,surroundW+.36,.05,.31,0,2.1+surroundH/2+.005,-.12,m.tuffeau)
    root.add(inscription.group)
    const ground=new Construction(m,'inscription-ground','vinci/inscription-carrier');exhibitionFloor(ground);root.add(ground.finish())
   }
   if(!isLine()&&state!=='grave'){const room=new Construction(m,'gallery-room','vinci/bench-composition');galleryBackdrop(room,24,-3,7.5,state==='inscription');root.add(room.finish())}
   root.traverse(o=>{if(o instanceof Mesh&&!o.userData['manifestId']){o.userData['manifestId']=isLine()?'vinci/line-geometry':state==='inscription'?'vinci/inscription-carrier':state==='grave'?'vinci/grave-geometry':'vinci/myths-geometry';o.userData['asset']=o.userData['manifestId']}})
   weld(root);root.userData['benchSelected']=selected
   scene.add(root);walkOffset=matchMedia('(prefers-reduced-motion: reduce)').matches?0:continuedWalk;root.position.z=walkOffset;walkStart=performance.now()
   const manifest=await loadManifest();if(ticket!==serial||!active)return
   entries=manifest.all.filter(e=>e.id.startsWith('vinci/')&&(/line-|inscription|words|myths|grave|bench|computed/.test(e.id)||e.id===plate?.entry.id))
   key?.dispose();key=stack.light({azimuth:state==='grave'?180+GRAVE_HOUR.gableBearing-GRAVE_HOUR.sunAzimuth:135,elevation:state==='grave'?GRAVE_HOUR.sunAltitude:28,kelvin:state==='grave'?3800:4900,lux:280,ambient:.42,reach:28,cascades:[14,28],sky:{zenith:'#a1b6bf',horizon:'#e0d4b9',ground:'#4f5146',stars:0}});key.fill.color.set('#bdc6bf');key.fill.groundColor.set('#575744');key.fill.intensity=.38;scene.environmentIntensity=.32
   if(scene.fog instanceof FogExp2)scene.fog.density=isLine()?.046:.016
   scene.environmentRotation.y=0;if(state==='grave')applyHour()
   pose();paint();pose();document.body.dataset['forge']='bench'
  }finally{if(ticket===serial){pending=0;host?.setAttribute('aria-busy','false')}}
 }
 /** The band a phone frame may use: under the title block, over the card. */
 function phoneStage(){
  const titleBox=host?.querySelector('.vb-title')?.getBoundingClientRect()
  const cardBox=card?.getBoundingClientRect()
  const top=(titleBox&&titleBox.height?titleBox.bottom:innerHeight*.2)+7
  const bottom=(cardBox&&cardBox.height?cardBox.top:innerHeight*.58)-7
  const height=Math.max(150,bottom-top)
  return {top,height,centre:top+height/2}
 }
 /** Compose a phone frame around the points an exhibit says must be in it.
  * The projection is linear in one over the distance, so two passes land it. */
 function fitPhoneStage(points:readonly [number,number,number][],target:Vector3,fill=.92){
  const stage=phoneStage()
  camera.clearViewOffset();camera.updateProjectionMatrix();camera.updateMatrixWorld(true)
  for(let pass=0;pass<3;pass++){
   let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
   for(const p of points){
    const v=new Vector3(p[0],p[1],p[2]).project(camera)
    const x=(v.x*.5+.5)*innerWidth,y=(1-(v.y*.5+.5))*innerHeight
    if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y
   }
   if(pass===2){camera.setViewOffset(innerWidth,innerHeight,(minX+maxX)/2-innerWidth/2,(minY+maxY)/2-stage.centre,innerWidth,innerHeight);return}
   const scale=Math.min(stage.height*fill/Math.max(1,maxY-minY),innerWidth*.94/Math.max(1,maxX-minX))
   const offset=camera.position.clone().sub(target).divideScalar(scale)
   camera.position.copy(target).add(offset)
   camera.updateMatrixWorld(true)
  }
 }
 function pose(){
  camera.aspect=innerWidth/innerHeight;camera.fov=narrow()?43:43;camera.clearViewOffset()
  if(isLine()){
   camera.position.set(narrow()?2.5:4.1,narrow()?4.3:5.4,narrow()?5.3:6.8);camera.lookAt(narrow()?.25:0,0,narrow()?-.5:-3)
   camera.setViewOffset(innerWidth,innerHeight,narrow()?0:-innerWidth*.16,innerHeight*(narrow()?(selected>=42?.25:.15):0),innerWidth,innerHeight)
  }else if(state==='grave'){
   // The phone reads the burial along the slab, so the group stands tall in a
   // narrow frame instead of spreading across it.
   camera.position.set(narrow()?2.3:5.7,narrow()?8.2:4.8,narrow()?12.0:8.3);camera.lookAt(narrow()?-.25:0,narrow()?.9:.9,narrow()?.25:-.4)
   camera.setViewOffset(innerWidth,innerHeight,narrow()?0:-innerWidth*.1,innerHeight*(narrow()?.215:0),innerWidth,innerHeight)
   const points=root?.userData['exhibit']?.framePoints as [number,number,number][]|undefined
   if(narrow()&&points?.length)fitPhoneStage(points,new Vector3(-.25,.9,.25),.97)
  }else{
   camera.position.set(state==='inscription'?.5:.7,2.7,narrow()?(state==='myth-deathbed'?29.2:state==='inscription'?19:15.5):11.0);camera.lookAt(0,2.5,0)
   camera.setViewOffset(innerWidth,innerHeight,narrow()?0:-innerWidth*.13,innerHeight*(narrow()?(state==='myth-quotes'?(language==='de'?.08:.04):state==='myth-deathbed'?.148:.10):0),innerWidth,innerHeight)
  }
  if(state==='myth-quotes'&&!narrow()){
   // The whole wall stands in one frame. The distance comes from the wall the
   // module actually measured, never from a number typed here.
   const exhibit=root?.userData['exhibit'] as {wallSizeM?:[number,number]}|undefined
   const wallWidth=Number(exhibit?.wallSizeM?.[0]??14.4),wallHeight=Number(exhibit?.wallSizeM?.[1]??9.3)
   const vtan=Math.tan(camera.fov*Math.PI/360)
   const distance=Math.max(wallWidth/(2*vtan*camera.aspect),wallHeight/(2*vtan))/.945
   camera.position.set(0,wallHeight/2,distance-.11);camera.lookAt(0,wallHeight/2,-.11)
   camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.008,innerWidth,innerHeight)
  }
  if(state==='myth-quotes'&&narrow()){
   // The wall is the reading on the phone, so it takes the stage between the
   // title and the compact card, and the camera is placed to fit it exactly.
   const height=Number(root?.userData['exhibit']?.wallSizeM?.[1]??3)
   const top=language==='de'?196:184
   const stage=Math.max(220,innerHeight-top-326)
   const distance=Math.max(6,height*innerHeight/(stage*2*Math.tan(43*Math.PI/360)))
   camera.position.set(0,height/2,distance);camera.lookAt(0,height/2,0)
   const pixelsPerMetre=innerHeight/(2*distance*Math.tan(43*Math.PI/360))
   camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.5-top-height*pixelsPerMetre*.5,innerWidth,innerHeight)
  }
  if(state==='myth-deathbed'&&narrow()){
   // The painting and both its plaques stand in the band between the title and
   // the card, measured from the DOM: German runs longer and must not clip it.
   const extent=(root?.userData['exhibit']?.extentY as [number,number]|undefined)??[.19,4.85]
   const stage=phoneStage()
   const centre=(extent[0]+extent[1])/2, span=Math.max(.5,extent[1]-extent[0])
   const vtan=Math.tan(camera.fov*Math.PI/360)
   const pixelsPerMetre=stage.height*.94/span
   camera.position.set(0,centre,innerHeight/(2*vtan*pixelsPerMetre))
   camera.lookAt(0,centre,0)
   camera.setViewOffset(innerWidth,innerHeight,0,innerHeight/2-stage.centre,innerWidth,innerHeight)
  }
  if(isLine()&&plate&&narrow()){camera.position.set(.5,4.8,8.5);camera.lookAt(.1,.1,-.2);camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.028,innerWidth,innerHeight)}
  if(close){
   const plasterY=narrow()?Number(root?.userData['exhibit']?.wallSizeM?.[1]??3)*.6:3.9
   const studies={bronze:{p:[.35,.72,.95],to:[0,.005,0],fov:34},limestone:{p:[1.1,1.4,1.9],to:[.5,0,.3],fov:38},plaster:{p:[narrow()?-.5:-2.2,plasterY,3.6],to:[narrow()?-.5:-2.2,plasterY,-.11],fov:38},tuffeau:{p:[-1.5,3,2],to:[-1.8,2.8,.12],fov:34},letters:{p:[.10,2.44,1.86],to:[0,2.30,.12],fov:30},slate:{p:[narrow()?3.5:3.8,narrow()?5.2:5.9,1.4],to:[narrow()?1.27:1.65,narrow()?2.61:3.18,-1.25],fov:32}}
   const view=studies[close];camera.clearViewOffset();camera.position.fromArray(view.p);camera.lookAt(new Vector3().fromArray(view.to));camera.fov=view.fov
  }
  camera.updateProjectionMatrix()
 }
 function appendFact(certainty:keyof typeof CERTAINTY,label:string,anchor:string,cls='procedural'){
  const p=setRegister(make('p','vb-fact'),'label');p.style.setProperty('--certainty',CERTAINTY[certainty].colour);p.dataset['naClaim']=certainty;p.dataset['naAnchor']=anchor;p.dataset['naAnchorClass']=cls;p.append(make('span','vb-dot'),document.createTextNode(label));card.append(p)
 }
 function paint(){
  if(!host)return
  host.dataset['state']=state;host.dataset['close']=String(Boolean(close));host.querySelector('.vb-material-note')?.remove();if(close)host.append(setRegister(make('p','vb-material-note',`${close} · material study · ${state==='grave'?'computed 18:50 UT light':'gallery light: 135° azimuth / 28° elevation / 4900 K'}`),'record'))
  host.lang=language;host.setAttribute('aria-label',text('Leonardo da Vinci exhibition bench','Leonardo da Vinci Ausstellungsstudie'));host.querySelector('.vb-lang')?.setAttribute('aria-label',text('Change language','Sprache wechseln'));host.querySelector('.vb-surface')?.setAttribute('aria-label',text('Walk the line with wheel or swipe','Die Linie mit Rad oder Wischgeste gehen'));host.querySelector('.vb-footer')?.setAttribute('aria-label',text('Exhibition navigation','Ausstellungsnavigation'));host.querySelector('.vb-bay')?.setAttribute('aria-label',text('Choose a timeline chapter','Zeitraum wählen'));host.querySelector('.vb-lang')!.textContent=language==='en'?'DE':'EN';host.querySelector('.vb-sources')!.textContent=text('Sources','Quellen');previous.textContent=text('← Previous','← Zurück');next.textContent=text('Next →','Weiter →');const names=language==='en'?['The line','Words','Corrections','Presumed']:['Die Linie','Worte','Korrekturen','Mutmaßlich'];Array.from(section.children).forEach((b,i)=>b.textContent=names[i]!);
  const label=isLine()&&state!=='phone-line'&&state!=='stud-1503'?selected>=36?['Amboise, and the threshold','Amboise und die Schwelle']:selected>=25?TITLES['line-late']:TITLES['line-early']:TITLES[state];title.replaceChildren(make('p','vb-eyebrow',text('LEONARDO DA VINCI · THE LINE','LEONARDO DA VINCI · DIE LINIE')),make('h1','',label[language==='en'?0:1]),make('p','vb-sub',state==='stud-1503'?'':isLine()?text('56 dates. Each one says how we know it.','56 Daten. Jedes sagt, woher wir es wissen.'):state==='myth-deathbed'?text('A later account became a familiar deathbed.','Ein später Bericht wurde zum vertrauten Sterbebild.'):state==='myth-quotes'?text('None of them is traced to Leonardo.','Keiner ist bei Leonardo nachgewiesen.') :''))
  const bay=host.querySelector<HTMLSelectElement>('.vb-bay')!;bay.hidden=!isLine();bay.value=String(selected>=36?36:selected>=25?25:0)
  card.className='vb-card'+(isLine()&&plate?.entry.id===PLATES.vespucci?' vb-card--document':state==='myth-deathbed'?' vb-card--deathbed':'')+(isLine()&&selected>=42?' vb-card--reception':'')+(audit?' vb-card--audit':'')+(sourceOpen?' vb-card--open':'');card.replaceChildren()
  const details=setRegister(make('details','vb-drawer'),'drawer'),summary=make('summary','',text('READ THE SOURCE','QUELLE LESEN'))
  details.id='vb-source-drawer';details.append(summary);details.open=sourceOpen
  const sourceButton=host.querySelector<HTMLButtonElement>('.vb-sources')!
  sourceButton.setAttribute('aria-expanded',String(sourceOpen))
  details.addEventListener('toggle',()=>{if(!details.isConnected)return;sourceOpen=details.open;card.classList.toggle('vb-card--open',sourceOpen);sourceButton.setAttribute('aria-expanded',String(sourceOpen));if(!sourceOpen){record.open=false;recordOpen=false}})
  const record=setRegister(make('details','vb-record'),'record');record.id='vb-source-record';record.open=recordOpen
  record.append(make('summary','',text('OPEN THE RECORD','BELEG ÖFFNEN')))
  record.addEventListener('toggle',()=>{if(record.isConnected){recordOpen=record.open;if(record.open)record.scrollIntoView({block:'nearest'})}})
  const reading=isLine()?SOURCE_READINGS[STUDS[selected]!.id]:state==='inscription'?INSCRIPTION_SOURCE:state==='myth-deathbed'?INGRES_SOURCE:state==='grave'?GRAVE_SOURCE:undefined
  if(reading)details.append(make('p','vb-source-reading',reading[language]))
  if(isLine()){
   const s=STUDS[selected]!;appendFact(s.certainty as keyof typeof CERTAINTY,`${s.certainty} · ${CERTAINTY[s.certainty as keyof typeof CERTAINTY].de}`,`vinci/source/${s.id}`)
   if(selected>=42)card.append(make('p','vb-reception',text(AFTERLIFE,AFTERLIFE_DE)))
   card.append(make('h2','',language==='en'?s.date_label_en:s.date_label_de),Object.assign(make('p','',language==='en'?s.line_en:s.line_de),{lang:language}),Object.assign(make('p','vb-de',language==='en'?s.line_de:s.line_en),{lang:language==='en'?'de':'en'}))
   record.append(make('p','',s.document),make('p','',s.holder??text('Present holder not established.','Heutiger Aufbewahrungsort nicht ermittelt.')))
   if(s.qualifications_en)record.append(make('p','',language==='en'?s.qualifications_en:s.qualifications_de))
   for(const gap of s.gaps)record.append(make('p','',gap))
   record.append(make('p','',`${s.calendar} · ${s.document_status}`),make('p','',SPACING))
   if(selected>=42)record.append(sourceText(AFTERLIFE,'en'),...(language==='de'?[sourceText(AFTERLIFE_DE,'de')]:[]))
   const source=make('a','',text('Source record ↗','Quellenbeleg ↗'));source.href=s.source_url;source.target='_blank';source.rel='noopener';record.append(source)
   count.textContent=`${String(selected+1).padStart(2,'0')} / 56`;previous.disabled=selected===0;next.disabled=selected===55
  }else if(state==='inscription'){
   appendFact('documented',text('documented · Leonardo’s words','belegt · Leonardos Worte'),'vinci/source/richter-498')
   card.append(make('h2','',text('The disciple','Der Schüler')),Object.assign(make('p','',language==='en'?passage.text_en:passage.text_de!),{lang:language}),Object.assign(make('p','vb-de',language==='en'?passage.text_de!:passage.text_en),{lang:language==='en'?'de':'en'}))
   record.append(make('p','',passage.folio_siglum),make('p','','Jean Paul Richter, 1888 · Marie Herzfeld, 1906'),make('p','',passage.folio_notes));count.textContent='01 / 01';previous.disabled=next.disabled=true
  }else if(state==='myth-deathbed'){
   appendFact('tradition',text("tradition · The king’s embrace comes from a later story, not a witnessed death record.",'Überlieferung · Die Umarmung des Königs stammt aus einer späteren Erzählung, nicht aus einem bezeugten Sterbebericht.'),'vinci/source/deathbed');card.lastElementChild?.classList.add('vb-verdict')
   const actEN="A royal act was issued at Saint-Germain-en-Laye on 3 May 1519, the day after the death. The act alone does not prove where the king was on 2 May."
   const actDE='Eine königliche Urkunde wurde am 3. Mai 1519, dem Tag nach dem Tod, in Saint-Germain-en-Laye ausgestellt. Sie allein beweist nicht, wo sich der König am 2. Mai befand.'
   card.append(Object.assign(make('p','',language==='en'?actEN:actDE),{lang:language}),Object.assign(make('p','vb-de',language==='en'?actDE:actEN),{lang:language==='en'?'de':'en'}))
   record.append(make('p','',text('A royal act was issued at Saint-Germain-en-Laye on 3 May 1519, the day after the death. Melzi’s letter of 1 June says nothing about the king being present.','Eine königliche Urkunde wurde am 3. Mai 1519, dem Tag nach dem Tod, in Saint-Germain-en-Laye ausgestellt. Melzis Brief vom 1. Juni erwähnt die Anwesenheit des Königs nicht.')),make('p','',text('Champollion argued a chancellor could sign in the king’s absence. Not disproved, not supported by any record.','Champollion wandte ein, ein Kanzler könne in Abwesenheit des Königs unterschreiben. Nicht widerlegt, durch keinen Beleg gestützt.')),make('p','',text('Enlarged reproduction: 396.97 × 500 cm. Original: 40 × 50.5 cm. Complete 4K painting image, kept in proportion.','Vergrößerte Reproduktion: 396,97 × 500 cm. Original: 40 × 50,5 cm. Vollständiges 4K-Gemäldebild im ursprünglichen Seitenverhältnis.')))
   card.append(Object.assign(make('p','vb-scale',language==='en'?'A small painting, enlarged for this room.':'Ein kleines Gemälde, für diesen Raum vergrößert.'),{lang:language}),Object.assign(make('p','vb-scale vb-de',language==='en'?'Ein kleines Gemälde, für diesen Raum vergrößert.':'A small painting, enlarged for this room.'),{lang:language==='en'?'de':'en'}))
   record.append(make('p','',text(DEATHBED_EVIDENCE.earliestSource,'Vasari, 1568. Ein später Bericht. Vasari war kein Augenzeuge.')),sourceText(DEATHBED_EVIDENCE.vasari,'it'),make('p','',text(DEATHBED_EVIDENCE.age,'Vasari nennt 75 Jahre. Leonardo war 67.')));
   count.textContent='01 / 02';previous.disabled=true;next.disabled=false
  }else if(state==='myth-quotes'){
   const q=inscriptions.apocrypha[quote]!;appendFact('tradition',text('tradition · Familiar words need a source.','Überlieferung · Vertraute Worte brauchen eine Quelle.'),'vinci/source/apocrypha')
   card.append(make('h2','',text('A quotation without a folio','Ein Zitat ohne Blattangabe')),make('p','',APOCRYPHA_READINGS[language][quote]!))
   if(language==='de'){card.append(make('small','vb-language-note','Der Wortlaut an der Wand ist englisch, wie in der Sammlung.'));record.append(make('p','',SOURCE_LANGUAGE_DE),make('p','',APOCRYPHA_DE[quote]!.actual_origin))}
   record.append(sourceText(q.quote,'en'),sourceText(q.actual_origin,'en'),make('p','',language==='en'?q.verdict:APOCRYPHA_DE[quote]!.verdict));const link=make('a','',text('Source ↗','Quelle ↗'));link.href=q.source_url;link.target='_blank';link.rel='noopener';record.append(link)
   count.textContent=`0${quote+1} / 06`;previous.disabled=quote===0;next.disabled=quote===5
  }else{
   appendFact('inferred',text('presumed remains','mutmaßliche Überreste'),'vinci/source/remains')
   const dig=STUDS.find(s=>s.id==='life-48')!
   card.append(make('h2','','Saint-Hubert'),Object.assign(make('p','',language==='en'?dig.line_en:dig.line_de),{lang:language}),Object.assign(make('p','vb-de',language==='en'?dig.line_de:dig.line_en),{lang:language==='en'?'de':'en'}))
   record.append(make('p','',language==='en'?STUDS.find(s=>s.id==='life-49')!.line_en:STUDS.find(s=>s.id==='life-49')!.line_de),make('p','',text('2 May 1519 (Julian) · 18:50 UT · A 292.71° · h 3.74°','2. Mai 1519 (julianisch) · 18:50 UT · A 292,71° · h 3,74°')),make('p','','JD 2275994.284722222 · ΔT 178.978 s · 4λ + EOT = 8.3353424 min · LAST 18:58:20'),make('p','',text('Chosen computed light. No death hour or weather is recorded. The plaque is described from an account; its design is not documented.','Gewähltes berechnetes Licht. Todesstunde und Wetter sind nicht überliefert. Die Plakette ist aus einem Bericht bekannt; ihre Gestaltung ist nicht dokumentiert.')))
   record.append(make('p','',String(root?.userData['exhibit']?.geometryDisclosure??'')));
   const hour=setRegister(make('div','vb-hour'),'label'),readout=make('p','vb-hour-readout'),play=make('button','vb-hour-play',hourPlaying?text('Pause','Pause'):text('Watch one minute','Eine Minute ansehen'));play.type='button';play.onclick=()=>{if(hourPlaying){hourPlaying=false}else{if(clockSeconds>=60)clockSeconds=0;hourStart=performance.now()-clockSeconds*1000;hourPlaying=true}play.textContent=hourPlaying?text('Pause','Pause'):text('Watch one minute','Eine Minute ansehen')};readout.dataset['naClaim']='inferred';readout.dataset['naAnchor']='vinci/grave-geometry';readout.dataset['naAnchorClass']='GENERATED';const date=make('p','vb-hour-date');date.dataset['naClaim']='documented';date.dataset['naAnchor']='vinci/bench-source-readings';date.dataset['naAnchorClass']='GENERATED';date.style.setProperty('--certainty',CERTAINTY.documented.colour);date.append(make('span','vb-dot'),document.createTextNode(text('documented · 2 May 1519 (Julian)','belegt · 2. Mai 1519 (julianisch)')))
   hour.append(readout,date,play);card.prepend(hour)
   details.append(make('p','',SOURCE_READINGS['life-41']![language]),make('p','',GRAVE_DIAGRAM[language]));
   count.textContent='19 / 19';previous.disabled=false;next.disabled=true
  }
  if(plateFailure){const message=make('p','vb-load-error',text('The image could not be loaded. You can try again.','Das Bild konnte nicht geladen werden. Bitte erneut versuchen.'));message.setAttribute('role','status');const retry=make('button','',text('Try again','Erneut versuchen'));retry.onclick=()=>void compose();card.append(message,retry);record.append(make('p','',plateFailure))}
  if(plate){card.append(make('small','vb-holder',plate.entry.id===PLATES.vespucci?'Universitätsbibliothek Heidelberg':'Ingres · 1818 · Paris Musées · Petit Palais'));record.append(make('p','',plate.entry.licence))}
  const stationId=isLine()?STUDS[selected]!.station:state==='inscription'?'line-early':state==='grave'?'grave':'myths'
  const door=doors.doors.find(d=>d.station===stationId)!
  question.textContent=language==='en'?door.question_en:door.question_de
  details.append(make('p','vb-question',question.textContent))
  const complete=isLine()?{collection:'brief/collection/timeline.json',stud:STUDS[selected],spacing:SPACING}:state==='inscription'?{collection:'brief/collection/inscriptions.json',passage}:state==='myth-quotes'?{collection:'brief/collection/inscriptions.json',apocryphon:inscriptions.apocrypha[quote]}:state==='grave'?{hour:computedHour(clockSeconds),parameters:GRAVE_HOUR,exhibit:root?.userData['exhibit'],death:STUDS.find(s=>s.id==='life-41'),excavation:STUDS.find(s=>s.id==='life-48'),transfer:STUDS.find(s=>s.id==='life-49')}:{exhibit:root?.userData['exhibit'],evidence:DEATHBED_EVIDENCE}
  const machine=make('pre','vb-record-data',JSON.stringify({source:complete,plate:plate?.entry,manifest:entries},null,2));record.append(machine)
  details.append(record);card.append(details)
  if(audit){const pre=setRegister(make('pre','vb-audit'),'record');pre.textContent=auditText();card.prepend(pre)}
  for(const button of section.querySelectorAll('button'))button.setAttribute('aria-current',String(button.dataset['state']===(isLine()?'line-early':state==='myth-quotes'?'myth-deathbed':state)))
  host.querySelector('.vb-instruction')!.textContent=isLine()?text('WHEEL OR SWIPE TO WALK · EQUAL SPACING, NOT ELAPSED YEARS','RAD ODER WISCHEN · ABSTÄNDE NICHT ZEITPROPORTIONAL'):'';if(state==='grave')updateHourLabel()
  const url=`/bench/vinci/line/${state}${location.search}#stud=${STUDS[selected]!.id}&lang=${language}&quote=${quote}`;history.replaceState({},'',url)
 }
 function step(delta:number){
  if(isLine()){
   const destination=Math.min(55,Math.max(0,selected+delta));if(destination===selected)return
   const before=selected;selected=destination;sourceOpen=false;recordOpen=false;void compose(-(selected-before)*1.65)
  }else if(state==='myth-deathbed'&&delta>0)void show({state:'myth-quotes'})
  else if(state==='myth-quotes'){
   const destination=Math.min(5,Math.max(0,quote+delta));if(destination===quote)return
   quote=destination;sourceOpen=false;recordOpen=false;void compose()
  }else if(state==='grave'&&delta<0)void show({state:'myth-quotes'})
 }
 function applyHour(){if(!key)return;const h=computedHour(clockSeconds),az=(180+GRAVE_HOUR.gableBearing-h.azimuth)*Math.PI/180,el=h.altitude*Math.PI/180;key.direction.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el));for(const object of scene.children)if(object instanceof DirectionalLight)object.position.copy(key.direction).multiplyScalar(24);scene.environmentRotation.y=(h.azimuth-GRAVE_HOUR.sunAzimuth)*Math.PI/180}
 function updateHourLabel(){
  const el=card.querySelector('.vb-hour-readout');if(el&&!el.textContent){el.replaceChildren(make('span','vb-dot'),document.createTextNode(text('Chosen light · Just before seven by the sun.','Gewähltes Licht · Kurz vor sieben nach der Sonne.')))}
  const data=card.querySelector('.vb-record-data');if(data&&state==='grave'&&data.getAttribute('data-second')!==String(Math.floor(clockSeconds))){data.setAttribute('aria-live','off');data.setAttribute('data-second',String(Math.floor(clockSeconds)));data.textContent=JSON.stringify({hour:computedHour(clockSeconds),parameters:GRAVE_HOUR,exhibit:root?.userData['exhibit'],death:STUDS.find(s=>s.id==='life-41'),excavation:STUDS.find(s=>s.id==='life-48'),transfer:STUDS.find(s=>s.id==='life-49'),manifest:entries},null,2)}
 }
 function auditText(){const c=telemetry().cost,labels=readLabels(),targets=labels.flatMap(l=>l.targetPx===null?[]:[l.targetPx]);return `${state} · ${c.tier} · ${c.backend}\n${c.draws} draws · ${c.triangles} triangles\ntexture ${c.totalTextureMB.toFixed(2)} MB (plate ${c.plateTextureMB.toFixed(2)})\nframe ${c.frameMsP50}/${c.frameMsP95} ms p50/p95\nCPU ${c.cpuMsP50}/${c.cpuMsP95} ms · ${c.frames} frames\n${STUDS[selected]!.id} · ${language}\n${Math.min(...targets)}px min · ${labels.filter(l=>l.persistent).length} marks · ${labels.filter(l=>l.brand).length} brand` }
 function telemetry(){const s=STUDS[selected]!,rendererBackend=stack.renderer.backend as typeof stack.renderer.backend & {isWebGPUBackend?:boolean;isWebGLBackend?:boolean};return {state,selectedStud:s.id,selectedIndex:selected,date:s.date,dateLabel:s.date_label_en,certainty:s.certainty,certaintyColour:CERTAINTY[s.certainty as keyof typeof CERTAINTY].colour,inscription:state==='inscription'?{id:passage.id,text:language==='en'?passage.text_en:passage.text_de,siglum:passage.folio_siglum}:null,quote:state==='myth-quotes'?inscriptions.apocrypha[quote]:null,language,studs:56,hour:state==='grave'?computedHour(clockSeconds):null,cost:{...stack.cost(),backend:rendererBackend.isWebGPUBackend?'webgpu':rendererBackend.isWebGLBackend?'webgl2':'unknown',configuredBackend:stack.backend,plateTextureMB:plate?.textureMB??0,totalTextureMB:stack.cost().textureMB+(plate?.textureMB??0)},plate:plate?{id:plate.entry.id,class:plate.entry.class,licence:plate.entry.licence}:null,labels:readLabels(),camera:camera.position.toArray(),materialStudy:close??null,lookCone:null}}
 return {show,update(){if(!pending&&!stack.materials.pending())stableFrames=Math.min(120,stableFrames+1);if(state==='grave'&&hourPlaying){clockSeconds=Math.min(60,(performance.now()-hourStart)/1000);applyHour();updateHourLabel();if(clockSeconds>=60){hourPlaying=false;const b=card.querySelector('.vb-hour-play');if(b)b.textContent=text('Watch one minute','Eine Minute ansehen')}}if(root&&walkOffset){const t=Math.min(1,(performance.now()-walkStart)/420);root.position.z=walkOffset*(1-t*t*(3-2*t));if(t===1)walkOffset=0}if(audit&&card){const pre=card.querySelector('pre');if(pre)pre.textContent=auditText()}},stop(){serial++;mount++;active=false;pending=0;controller?.abort();clear();key?.dispose();host?.remove();host=undefined;for(const mat of owned)mat.dispose();owned.clear();materials=undefined},active:()=>active,state:()=>({phase:'bench' as const,station:selected,stations:56,stationId:STUDS[selected]!.id,stationIds:STUDS.map(s=>s.id),texturesPending:pending+stack.materials.pending()+(audit&&stableFrames<120?1:0),stableFrames,cam:{p:camera.position.toArray(),r:camera.rotation.toArray().slice(0,3),fov:camera.fov,proj:camera.projectionMatrix.elements.slice(0,4)}}),telemetry,manifest:()=>entries,select(id:string){const n=STUDS.findIndex(s=>s.id===id);if(n<0)return false;selected=n;sourceOpen=false;recordOpen=false;void compose();return true}}
}
