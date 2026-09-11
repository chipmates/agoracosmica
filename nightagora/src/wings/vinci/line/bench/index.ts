import { BoxGeometry, Color, DirectionalLight, FogExp2, Group, Mesh, MeshStandardNodeMaterial, PerspectiveCamera, PlaneGeometry, Scene, Vector3, type Material } from 'three/webgpu'
import type { Stack, KeyLight } from '../../../../stack'
import { IDENTITY } from '../../../../stack/grade'
import { applyDetail } from '../../../../stack/detail'
import { readLabels } from '../../../../core/labels'
import { loadManifest, type ManifestEntry } from '../../../../manifest'
import { createLine, STUDS, CERTAINTY, SPACING, AFTERLIFE, weld } from '..'
import * as TSL from 'three/tsl'
import { createInscription } from '../../words'
import { createMythDeathbed, createMythQuotes, DEATHBED_EVIDENCE } from '../../myths'
import { createGrave, GRAVE_HOUR } from '../../grave'
import { computedHour } from '../../grave/hour'
import inscriptions from '../../words/data/inscriptions.json'
import doors from '../../data/doors.json'
import { loadPlate, PLATES, type LoadedPlate } from './assets'
import css from './bench.css?inline'
import {createBenchStone,createBenchDark} from './materials'

export const BENCH_STATES=['line-early','line-late','stud-1503','inscription','myth-deathbed','myth-quotes','grave','phone-line'] as const
export type BenchState=typeof BENCH_STATES[number]
export interface BenchOptions {kind?:string;state?:string;stud?:string;lang?:'en'|'de';quote?:number;audit?:boolean;seconds?:number;sources?:boolean;close?:'bronze'|'limestone'|'plaster'|'tuffeau'|'slate'}
const TITLES:Record<BenchState,[string,string]>={
 'line-early':['Vinci, Florence, Milan','Vinci, Florenz, Mailand'],
 'line-late':['The wandering years, and Rome','Die Wanderjahre und Rom'],
 'stud-1503':['The Vespucci note','Die Vespucci-Notiz'],
 inscription:['His own words','Seine eigenen Worte'],
 'myth-deathbed':['The room of corrections','Der Raum der Richtigstellungen'],
 'myth-quotes':['The quotations he never wrote','Die Zitate, die er nie schrieb'],
 grave:['Presumed','Mutmaßlich'],
 'phone-line':['Every date on the line','Jedes Datum auf der Linie'],
}
const make=<K extends keyof HTMLElementTagNameMap>(tag:K,cls:string,text?:string)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el}
export function createBench(stack:Stack){
 let materialReady:Promise<void>|undefined, mount=0, stableFrames=0, close:BenchOptions['close']
 let host:HTMLElement|undefined, key:KeyLight|undefined, root:Group|undefined
 const scene=new Scene(),camera=new PerspectiveCamera(43,innerWidth/innerHeight,.08,100)
 let state:BenchState='line-early', selected=0, language:'en'|'de'='en', quote=0, clockSeconds=0, sourceOpen=false, hourPlaying=false, hourStart=0, walkStart=0, walkOffset=0, serial=0, pending=0, active=false, audit=false
 let plate:LoadedPlate|undefined, controller:AbortController|undefined, entries:ManifestEntry[]=[]
 let title:HTMLElement,card:HTMLElement,count:HTMLElement,previous:HTMLButtonElement,next:HTMLButtonElement,section:HTMLElement,question:HTMLElement
 let materials:{stone:Material;plaster:Material;bronze:Material;ink:Material;dark:Material;tuffeau:Material}|undefined
 const narrow=()=>innerWidth<651
 const isLine=()=>state.startsWith('line-')||state==='phone-line'||state==='stud-1503'
 const passage=inscriptions.passages.find(p=>p.id==='richter-498')!
 const owned=new Set<Material>()
 const text=(en:string,de:string)=>language==='en'?en:de
 function init(){
  active=true
  scene.background=new Color('#2b3534');scene.fog=new FogExp2('#53605a',.023)
  stack.setScene(scene,camera,{...IDENTITY,name:'vinci-line-bench',exposure:1.12,saturation:.86,vignette:.16,grain:.003})
  key=stack.light({azimuth:135,elevation:28,kelvin:4900,lux:280,ambient:.42,reach:28,cascades:[14,28],sky:{zenith:'#a1b6bf',horizon:'#e0d4b9',ground:'#4f5146',stars:0}})
  key.fill.color.set('#bdc6bf');key.fill.groundColor.set('#575744');key.fill.intensity=.8;scene.environmentIntensity=.6
  const projection=TSL.normalWorld.y.abs().greaterThan(.5).select(TSL.positionWorld.xz,TSL.normalWorld.x.abs().greaterThan(.5).select(TSL.positionWorld.zy,TSL.positionWorld.xy))
  const generation=++mount
  materialReady=Promise.all(['limestone-pale','plaster-lime-aged','bronze-dark'].map(async name=>{const set=stack.materials.sync(name),start=performance.now();while(!set.ready.value){const failure=stack.materials.missing().find(item=>item.name===name);if(failure)throw new Error(failure.reason);if(performance.now()-start>20000)throw new Error(`Material did not become ready: ${name}`);await new Promise(resolve=>setTimeout(resolve,40))}return set})).then(()=>{
  if(generation!==mount)return
  const surface=(name:string)=>{const set=stack.materials.sync(name),opts={count:3 as const,uv:projection,...(name==='plaster-lime-aged'?{maps:.5,mid:.18,macro:.1,micro:.4}:{mid:.25})};const mat=set.material(opts);if(name==='limestone-pale'&&set.grain)applyDetail(mat,{...set,grain:{...set.grain,relief:.035,sheen:.025}},opts);mat.name=name;owned.add(mat);return mat}
  materials={tuffeau:createBenchStone(),stone:surface('limestone-pale'),plaster:surface('plaster-lime-aged'),bronze:surface('bronze-dark'),ink:new MeshStandardNodeMaterial({color:'#292f2b',roughness:.92}),dark:createBenchDark()}
  owned.add(materials.ink);owned.add(materials.dark);owned.add(materials.tuffeau)
  })
  host=make('section','vb');host.setAttribute('aria-label','Leonardo da Vinci exhibition bench')
  const style=make('style','');style.textContent=css;host.append(style)
  const surfaceHost=make('div','vb-surface');surfaceHost.setAttribute('aria-label',text('Walk the line with wheel or swipe','Die Linie mit Rad oder Wischgeste gehen'));host.append(surfaceHost)
  const header=make('header','vb-header');header.dataset['naPersistent']=''
  const brand=make('div','vb-brand','AGORA COSMICA');brand.dataset['naBrand']=''
  const tools=make('div','vb-tools'), langButton=make('button','vb-lang',language==='en'?'DE':'EN');langButton.type='button';langButton.setAttribute('aria-label','Change language');langButton.onclick=()=>{language=language==='en'?'de':'en';langButton.textContent=language==='en'?'DE':'EN';void compose()}
  const sources=make('button','vb-sources',text('Sources','Quellen'));sources.type='button';sources.onclick=()=>{sourceOpen=!sourceOpen;paint();if(sourceOpen)card.querySelector('details')?.scrollIntoView({block:'nearest'})}
  tools.append(sources,langButton);header.append(brand,tools);host.append(header)
  title=make('div','vb-title');card=make('aside','vb-card');card.setAttribute('aria-live','polite');host.append(title,card)
  const footer=make('nav','vb-footer');footer.dataset['naPersistent']='';footer.setAttribute('aria-label','Exhibition navigation')
  const steps=make('div','vb-steps');previous=make('button','',text('← Previous','← Zurück'));next=make('button','',text('Next →','Weiter →'));previous.type=next.type='button';previous.onclick=()=>step(-1);next.onclick=()=>step(1);count=make('span','vb-count');const bay=make('select','vb-bay');bay.setAttribute('aria-label','Choose a timeline chapter');for(const [value,label] of [['0','1452–1499'],['25','1500–1515'],['36','1516–2020']]){const option=make('option','',label);option.value=value!;bay.append(option)}bay.onchange=()=>{selected=Number(bay.value);sourceOpen=false;void compose()};steps.append(previous,count,next,bay)
  section=make('div','vb-sections');for(const [id,en,de] of [['line-early','The line','Die Linie'],['inscription','Words','Worte'],['myth-deathbed','Corrections','Richtigstellungen'],['grave','Presumed','Mutmaßlich']]){const b=make('button','',text(en!,de!));b.type='button';b.dataset['state']=id;b.onclick=()=>void show({state:id});section.append(b)}footer.append(steps,section);host.append(footer)
  question=make('span','vb-sr');host.append(question)
  host.append(make('div','vb-instruction',text('WHEEL OR SWIPE TO WALK · EQUAL SPACING, NOT ELAPSED YEARS','RAD ODER WISCHEN · ABSTÄNDE NICHT ZEITPROPORTIONAL')))
  document.body.append(host)
  controller=new AbortController();const signal=controller.signal
  let wheel=0,lastWheel=0,touchY=0,touchX=0
  surfaceHost.addEventListener('wheel',e=>{if(e.ctrlKey)return;e.preventDefault();const now=performance.now();if(now-lastWheel<360)return;wheel+=e.deltaY;if(Math.abs(wheel)>55){step(wheel>0?1:-1);wheel=0;lastWheel=now}},{signal,passive:false})
  surfaceHost.addEventListener('touchstart',e=>{touchY=e.touches[0]?.clientY??0;touchX=e.touches[0]?.clientX??0},{signal,passive:true})
  surfaceHost.addEventListener('touchend',e=>{const t=e.changedTouches[0];if(t&&Math.abs(t.clientY-touchY)>45&&Math.abs(t.clientY-touchY)>Math.abs(t.clientX-touchX))step(t.clientY<touchY?1:-1)},{signal,passive:true})
  window.addEventListener('keydown',e=>{if(!active||e.ctrlKey||e.metaKey||e.altKey||(e.target as Element)?.closest('input,select,textarea'))return;if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)){e.preventDefault();step(e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1)}if(e.key==='Escape'){const detail=card.querySelector('details');if(detail)detail.open=false}},{signal})
  let wasNarrow=narrow();window.addEventListener('resize',()=>{if(wasNarrow!==narrow()){wasNarrow=narrow();void compose()}else{pose();paint()}},{signal})
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
  sourceOpen=Boolean(opts.sources)
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
   const incoming=plateId?(plate?.entry.id===plateId&&plate.tier===stack.cost().tier?plate:await loadPlate(plateId,stack.cost().tier)):undefined
   if(ticket!==serial||!active){if(incoming!==plate)incoming?.texture.dispose();return}
   // Keep the visible exhibit until its replacement is ready; reuse an unchanged plate.
   const continuedWalk=walk?-(selected-Number(root?.userData['benchSelected']??selected))*1.65+(root?.position.z??0):0
   clear(incoming);plate=incoming
   if(isLine()){
    root=createLine(m,selected,language,narrow())
    // The facsimile lies on a real angled reading stand beside its date.
    if(plate){const stand=new Group();stand.position.set(.3,1.24,-1.6);stand.rotation.x=.32;box(stand,3.5,.06,1.25,0,0,0,m.bronze);const imageMat=new MeshStandardNodeMaterial({map:plate.texture,roughness:.9,metalness:0});const leaf=new Mesh(new PlaneGeometry(3.22,.966),imageMat);leaf.userData={manifestId:plate.entry.id,asset:plate.entry.id,manifestClass:plate.entry.class};leaf.position.y=.036;leaf.rotation.x=-Math.PI/2;stand.add(leaf);box(root,.07,1.2,.07,.3,.6,-1.6,m.bronze);if(narrow()){stand.scale.set(.78,1,.78);stand.position.x=.08}root.add(stand)}
   }else if(state==='myth-deathbed')root=createMythDeathbed(m,plate?.texture).group
   else if(state==='myth-quotes')root=createMythQuotes(m,{mobile:narrow(),quoteIndex:quote}).group
   else if(state==='grave')root=createGrave(m).group
   else{
    root=new Group();box(root,7.8,4.2,.22,0,2.1,-.35,m.plaster)
    const inscription=createInscription(passage.id,language,{surface:m.tuffeau,ink:m.ink,width:4.8,height:2.8,size:.29});inscription.group.position.set(0,2.1,.12);root.add(inscription.group)
    box(root,12,.15,14,0,-.09,2,m.stone)
   }
   root.traverse(o=>{if(o instanceof Mesh&&!o.userData['manifestId']){o.userData['manifestId']=isLine()?'vinci/line-geometry':state==='inscription'?'vinci/inscription-carrier':state==='grave'?'vinci/grave-geometry':'vinci/myths-geometry';o.userData['asset']=o.userData['manifestId']}})
   weld(root);root.userData['benchSelected']=selected
   scene.add(root);walkOffset=matchMedia('(prefers-reduced-motion: reduce)').matches?0:continuedWalk;root.position.z=walkOffset;walkStart=performance.now()
   const manifest=await loadManifest();if(ticket!==serial||!active)return
   entries=manifest.all.filter(e=>e.id.startsWith('vinci/')&&(/line-|inscription|words|myths|grave|bench|computed/.test(e.id)||e.id===plate?.entry.id))
   key?.dispose();key=stack.light({azimuth:state==='grave'?180+GRAVE_HOUR.gableBearing-GRAVE_HOUR.sunAzimuth:135,elevation:state==='grave'?GRAVE_HOUR.sunAltitude:28,kelvin:state==='grave'?3800:4900,lux:280,ambient:.42,reach:28,cascades:[14,28],sky:{zenith:'#a1b6bf',horizon:'#e0d4b9',ground:'#4f5146',stars:0}});key.fill.intensity=.8
   scene.environmentRotation.y=0;if(state==='grave')applyHour()
   pose();paint();document.body.dataset['forge']='bench'
  }finally{if(ticket===serial){pending=0;host?.setAttribute('aria-busy','false')}}
 }
 function pose(){
  camera.aspect=innerWidth/innerHeight;camera.fov=narrow()?43:43;camera.clearViewOffset()
  if(isLine()){
   camera.position.set(narrow()?2.5:4.1,narrow()?4.3:5.4,narrow()?5.3:6.8);camera.lookAt(narrow()?.25:0,0,narrow()?-.5:-3)
   camera.setViewOffset(innerWidth,innerHeight,narrow()?0:-innerWidth*.16,innerHeight*(narrow()?(selected>=42?.25:.15):0),innerWidth,innerHeight)
  }else if(state==='grave'){
   camera.position.set(narrow()?6.3:5.7,narrow()?7.4:4.8,narrow()?16:8.3);camera.lookAt(0,.9,-.4)
   camera.setViewOffset(innerWidth,innerHeight,narrow()?0:-innerWidth*.1,innerHeight*(narrow()?.20:0),innerWidth,innerHeight)
  }else{
   camera.position.set(state==='inscription'?.5:.7,2.7,narrow()?(state==='myth-deathbed'?25.5:state==='inscription'?19:15.5):11.0);camera.lookAt(0,2.5,0)
   camera.setViewOffset(innerWidth,innerHeight,narrow()?0:-innerWidth*.13,innerHeight*(narrow()?(state==='myth-quotes'?.04:state==='myth-deathbed'?.14:.10):0),innerWidth,innerHeight)
  }
  if(isLine()&&plate&&narrow()){camera.position.set(.5,4.8,8.5);camera.lookAt(.1,.1,-.2);camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.07,innerWidth,innerHeight)}
  if(close){
   const studies={bronze:{p:[.35,.72,.95],to:[0,.005,0],fov:34},limestone:{p:[1.1,1.4,1.9],to:[.5,0,.3],fov:38},plaster:{p:[narrow()?-.5:-2.2,3.9,3.6],to:[narrow()?-.5:-2.2,3.9,-.11],fov:38},tuffeau:{p:[-1.5,3,2],to:[-1.8,2.8,.12],fov:34},slate:{p:[3.8,5.9,1.4],to:[1.65,3.18,-1.25],fov:32}}
   const view=studies[close];camera.clearViewOffset();camera.position.fromArray(view.p);camera.lookAt(new Vector3().fromArray(view.to));camera.fov=view.fov
  }
  camera.updateProjectionMatrix()
 }
 function appendFact(certainty:keyof typeof CERTAINTY,label:string,anchor:string,cls='procedural'){
  const p=make('p','vb-fact');p.style.setProperty('--certainty',CERTAINTY[certainty].colour);p.dataset['naClaim']=certainty;p.dataset['naAnchor']=anchor;p.dataset['naAnchorClass']=cls;p.append(make('span','vb-dot'),document.createTextNode(label));card.append(p)
 }
 function paint(){
  if(!host)return
  host.dataset['state']=state;host.dataset['close']=String(Boolean(close));host.querySelector('.vb-material-note')?.remove();if(close)host.append(make('p','vb-material-note',`${close} · material study · ${state==='grave'?'computed 18:50 UT light':'gallery light: 135° azimuth / 28° elevation / 4900 K'}`))
  host.lang=language;host.querySelector('.vb-lang')!.textContent=language==='en'?'DE':'EN';host.querySelector('.vb-sources')!.textContent=text('Sources','Quellen');previous.textContent=text('← Previous','← Zurück');next.textContent=text('Next →','Weiter →');const names=language==='en'?['The line','Words','Corrections','Presumed']:['Die Linie','Worte','Korrekturen','Mutmaßlich'];Array.from(section.children).forEach((b,i)=>b.textContent=names[i]!);
  const label=isLine()&&state!=='phone-line'&&state!=='stud-1503'?selected>=36?['Amboise, and the threshold','Amboise und die Schwelle']:selected>=25?TITLES['line-late']:TITLES['line-early']:TITLES[state];title.replaceChildren(make('p','vb-eyebrow',text('LEONARDO DA VINCI · THE LINE','LEONARDO DA VINCI · DIE LINIE')),make('h1','',label[language==='en'?0:1]),make('p','vb-sub',isLine()?text('56 dates. Each one carries its evidence.','56 Daten. Jedes trägt seinen Beleg.'):state==='myth-deathbed'?text('A later account became a familiar deathbed.','Ein später Bericht wurde zum vertrauten Sterbebild.') :''))
  const bay=host.querySelector<HTMLSelectElement>('.vb-bay')!;bay.hidden=!isLine();bay.value=String(selected>=36?36:selected>=25?25:0)
  card.className='vb-card'+(isLine()&&plate?.entry.id===PLATES.vespucci?' vb-card--document':state==='myth-deathbed'?' vb-card--deathbed':'')+(isLine()&&selected>=42?' vb-card--reception':'')+(audit?' vb-card--audit':'')+(sourceOpen?' vb-card--open':'');card.replaceChildren()
  const details=make('details',''),summary=make('summary','',text('READ THE SOURCE','QUELLE LESEN'));details.append(summary);details.open=sourceOpen;details.addEventListener('toggle',()=>{if(!details.isConnected)return;sourceOpen=details.open;card.classList.toggle('vb-card--open',sourceOpen)})
  if(isLine()){
   const s=STUDS[selected]!;appendFact(s.certainty as keyof typeof CERTAINTY,`${s.certainty} · ${CERTAINTY[s.certainty as keyof typeof CERTAINTY].de}`,`vinci/source/${s.id}`)
   if(selected>=42)card.append(make('p','vb-reception',AFTERLIFE))
   card.append(make('h2','',language==='en'?s.date_label_en:s.date_label_de),make('p','',language==='en'?s.line_en:s.line_de),make('p','vb-de',language==='en'?s.line_de:s.line_en))
   details.append(make('p','',s.document),make('p','',s.holder??text('Present holder not established.','Heutiger Aufbewahrungsort nicht ermittelt.')))
   if(s.qualifications_en)details.append(make('p','',language==='en'?s.qualifications_en:s.qualifications_de))
   for(const gap of s.gaps)details.append(make('p','',gap))
   details.append(make('p','',`${s.calendar} · ${s.document_status}`),make('p','',SPACING))
   if(selected>=42)details.append(make('p','',AFTERLIFE))
   const source=make('a','',text('Source record ↗','Quellenbeleg ↗'));source.href=s.source_url;source.target='_blank';source.rel='noopener';details.append(source)
   count.textContent=`${String(selected+1).padStart(2,'0')} / 56`;previous.disabled=selected===0;next.disabled=selected===55
  }else if(state==='inscription'){
   appendFact('documented',text('Leonardo’s words · Richter 498','Leonardos Worte · Richter 498'),'vinci/source/richter-498')
   card.append(make('h2','',text('The disciple','Der Schüler')),make('p','',language==='en'?passage.text_en:passage.text_de!),make('p','vb-de',language==='en'?passage.text_de!:passage.text_en))
   details.append(make('p','',passage.folio_siglum),make('p','','Jean Paul Richter, 1888 · Marie Herzfeld, 1906'),make('p','',passage.folio_notes));count.textContent='01 / 01';previous.disabled=next.disabled=true
  }else if(state==='myth-deathbed'){
   appendFact('tradition',text("The king's embrace comes from a later story, not a witnessed death record.",'Die Umarmung des Königs stammt aus einer späteren Erzählung, nicht aus einem bezeugten Todesbericht.'),'vinci/source/deathbed');card.lastElementChild?.classList.add('vb-verdict')
   card.append(make('p','',text("A royal act was issued at Saint-Germain-en-Laye on 3 May 1519, the day after the death. The act alone does not prove where the king was on 2 May.",'Eine königliche Urkunde wurde am 3. Mai 1519, dem Tag nach dem Tod, in Saint-Germain-en-Laye ausgestellt. Sie allein beweist nicht, wo sich der König am 2. Mai befand.')))
   details.append(make('p','',text('A royal act was issued at Saint-Germain-en-Laye on 3 May 1519, the day after the death. Melzi’s letter of 1 June says nothing about the king being present.','Eine königliche Urkunde wurde am 3. Mai 1519, dem Tag nach dem Tod, in Saint-Germain-en-Laye ausgestellt. Melzis Brief vom 1. Juni erwähnt die Anwesenheit des Königs nicht.')),make('p','',text('Champollion argued a chancellor could sign in the king’s absence. Not disproved, not supported by any record.','Champollion wandte ein, ein Kanzler könne in Abwesenheit des Königs unterschreiben. Nicht widerlegt, durch keinen Beleg gestützt.')),make('p','',text('Enlarged reproduction: 396.97 × 500 cm. Original: 40 × 50.5 cm. Complete 4K painting image, kept in proportion.','Vergrößerte Reproduktion: 396,97 × 500 cm. Original: 40 × 50,5 cm. Vollständiges 4K-Gemäldebild im ursprünglichen Seitenverhältnis.')))
   details.append(make('p','',DEATHBED_EVIDENCE.earliestSource),make('p','',DEATHBED_EVIDENCE.vasari),make('p','',DEATHBED_EVIDENCE.age));
   count.textContent='01 / 02';previous.disabled=true;next.disabled=false
  }else if(state==='myth-quotes'){
   const q=inscriptions.apocrypha[quote]!;appendFact('tradition',text('Familiar words need a source.','Vertraute Worte brauchen eine Quelle.'),'vinci/source/apocrypha')
   card.append(make('h2','',text('A quotation without a folio','Ein Zitat ohne Blattangabe')),make('p','',q.actual_origin))
   details.append(make('p','',q.quote),make('p','',q.verdict));const link=make('a','','Source ↗');link.href=q.source_url;link.target='_blank';link.rel='noopener';details.append(link)
   count.textContent=`0${quote+1} / 06`;previous.disabled=quote===0;next.disabled=quote===5
  }else{
   appendFact('inferred',text('presumed remains','mutmaßliche Überreste'),'vinci/source/remains')
   card.append(make('h2','','Saint-Hubert'),make('p','',language==='en'?STUDS.find(s=>s.id==='life-48')!.line_en:STUDS.find(s=>s.id==='life-48')!.line_de))
   details.append(make('p','',language==='en'?STUDS.find(s=>s.id==='life-49')!.line_en:STUDS.find(s=>s.id==='life-49')!.line_de),make('p','','2 May 1519 (Julian) · 18:50 UT · A 292.71° · h 3.74°'),make('p','','JD 2275994.284722222 · ΔT 178.978 s · 4λ + EOT = 8.3353424 min · LAST 18:58:20'),make('p','',text('Chosen computed light. No death hour or weather is recorded. The plaque is described from an account; its design is not documented.','Gewähltes berechnetes Licht. Todesstunde und Wetter sind nicht überliefert. Die Plakette ist aus einem Bericht bekannt; ihre Gestaltung ist nicht dokumentiert.')))
   details.append(make('p','',String(root?.userData['exhibit']?.geometryDisclosure??'')));
   const hour=make('div','vb-hour'),readout=make('p','vb-hour-readout'),play=make('button','vb-hour-play',text('Watch one minute','Eine Minute ansehen'));play.type='button';play.onclick=()=>{if(hourPlaying){hourPlaying=false}else{if(clockSeconds>=60)clockSeconds=0;hourStart=performance.now()-clockSeconds*1000;hourPlaying=true}play.textContent=hourPlaying?text('Pause','Pause'):text('Watch one minute','Eine Minute ansehen')};hour.append(readout,play);card.prepend(hour);
   count.textContent='19 / 19';previous.disabled=false;next.disabled=true
  }
  if(plate){card.append(make('small','vb-licence',plate.entry.id===PLATES.vespucci?'PD-Art · Universitätsbibliothek Heidelberg':`${plate.entry.class==='PD-ART'?'PD-Art':plate.entry.class} · Paris Musées`));details.append(make('p','',plate.entry.licence))}
  const stationId=isLine()?STUDS[selected]!.station:state==='inscription'?'line-early':state==='grave'?'grave':'myths'
  const door=doors.doors.find(d=>d.station===stationId)!
  question.textContent=language==='en'?door.question_en:door.question_de
  details.append(make('p','',question.textContent));card.append(details)
  if(audit){const pre=make('pre','vb-audit');pre.textContent=auditText();card.prepend(pre)}
  for(const button of section.querySelectorAll('button'))button.setAttribute('aria-current',String(button.dataset['state']===(isLine()?'line-early':state==='myth-quotes'?'myth-deathbed':state)))
  host.querySelector('.vb-instruction')!.textContent=isLine()?text('WHEEL OR SWIPE TO WALK · EQUAL SPACING, NOT ELAPSED YEARS','RAD ODER WISCHEN · ABSTÄNDE NICHT ZEITPROPORTIONAL'):'';if(state==='grave')updateHourLabel()
  const url=`/bench/vinci/line/${state}${location.search}#stud=${STUDS[selected]!.id}&lang=${language}&quote=${quote}`;history.replaceState({},'',url)
 }
 function step(delta:number){sourceOpen=false;if(isLine()){const before=selected;selected=Math.min(55,Math.max(0,selected+delta));if(before===selected)return;void compose(-(selected-before)*1.65)}else if(state==='myth-deathbed'&&delta>0)void show({state:'myth-quotes'});else if(state==='myth-quotes'){quote=Math.min(5,Math.max(0,quote+delta));void compose()}else if(state==='grave'&&delta<0)void show({state:'myth-quotes'})}
 function applyHour(){if(!key)return;const h=computedHour(clockSeconds),az=(180+GRAVE_HOUR.gableBearing-h.azimuth)*Math.PI/180,el=h.altitude*Math.PI/180;key.direction.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el));for(const object of scene.children)if(object instanceof DirectionalLight)object.position.copy(key.direction).multiplyScalar(24);scene.environmentRotation.y=(h.azimuth-GRAVE_HOUR.sunAzimuth)*Math.PI/180}
 function updateHourLabel(){const el=card.querySelector('.vb-hour-readout');if(el){const h=computedHour(clockSeconds);el.textContent=`2 May 1519 · ${h.UTclock} UT · A ${h.azimuth.toFixed(3)}° · h ${h.altitude.toFixed(3)}°`}}
 function auditText(){const c=telemetry().cost,labels=readLabels(),targets=labels.flatMap(l=>l.targetPx===null?[]:[l.targetPx]);return `${state} · ${c.tier} · ${c.backend}\n${c.draws} draws · ${c.triangles} triangles\ntexture ${c.totalTextureMB.toFixed(2)} MB (plate ${c.plateTextureMB.toFixed(2)})\nframe ${c.frameMsP50}/${c.frameMsP95} ms p50/p95\nCPU ${c.cpuMsP50}/${c.cpuMsP95} ms · ${c.frames} frames\n${STUDS[selected]!.id} · ${language}\n${Math.min(...targets)}px min · ${labels.filter(l=>l.persistent).length} marks · ${labels.filter(l=>l.brand).length} brand` }
 function telemetry(){const s=STUDS[selected]!;return {state,selectedStud:s.id,selectedIndex:selected,date:s.date,dateLabel:s.date_label_en,certainty:s.certainty,certaintyColour:CERTAINTY[s.certainty as keyof typeof CERTAINTY].colour,inscription:state==='inscription'?{id:passage.id,text:language==='en'?passage.text_en:passage.text_de,siglum:passage.folio_siglum}:null,quote:state==='myth-quotes'?inscriptions.apocrypha[quote]:null,language,studs:56,hour:state==='grave'?computedHour(clockSeconds):null,cost:{...stack.cost(),plateTextureMB:plate?.textureMB??0,totalTextureMB:stack.cost().textureMB+(plate?.textureMB??0)},plate:plate?{id:plate.entry.id,class:plate.entry.class,licence:plate.entry.licence}:null,labels:readLabels(),camera:camera.position.toArray(),materialStudy:close??null,lookCone:null}}
 return {show,update(){if(!pending&&!stack.materials.pending())stableFrames=Math.min(120,stableFrames+1);if(state==='grave'&&hourPlaying){clockSeconds=Math.min(60,(performance.now()-hourStart)/1000);applyHour();updateHourLabel();if(clockSeconds>=60){hourPlaying=false;const b=card.querySelector('.vb-hour-play');if(b)b.textContent=text('Watch one minute','Eine Minute ansehen')}}if(root&&walkOffset){const t=Math.min(1,(performance.now()-walkStart)/420);root.position.z=walkOffset*(1-t*t*(3-2*t));if(t===1)walkOffset=0}if(audit&&card){const pre=card.querySelector('pre');if(pre)pre.textContent=auditText()}},stop(){serial++;mount++;active=false;pending=0;controller?.abort();clear();key?.dispose();host?.remove();host=undefined;for(const mat of owned)mat.dispose();owned.clear();materials=undefined},active:()=>active,state:()=>({phase:'bench' as const,station:selected,stations:56,stationId:STUDS[selected]!.id,stationIds:STUDS.map(s=>s.id),texturesPending:pending+stack.materials.pending()+(audit&&stableFrames<120?1:0),stableFrames,cam:{p:camera.position.toArray(),r:camera.rotation.toArray().slice(0,3),fov:camera.fov,proj:camera.projectionMatrix.elements.slice(0,4)}}),telemetry,manifest:()=>entries,select(id:string){const n=STUDS.findIndex(s=>s.id===id);if(n<0)return false;selected=n;void compose();return true}}
}
