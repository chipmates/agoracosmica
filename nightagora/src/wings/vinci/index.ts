import { createStaticShadowCache } from './static-shadow-cache'
import { applyDisplayedHorizonHaze, displayedHorizonHazeProvenance } from './display-sky-haze'
import { mineralSurfaceProvenance, closeSurfaceProvenance } from './surface'
import { entryMineralSurfaceProvenance } from './entry-mineral-surface'
import { foundationPlinthProvenance } from './foundation-plinth'
import { Color, FogExp2, DirectionalLight, Mesh, Vector3, type Group } from 'three/webgpu'
import { float, mix, vec3, vec4, dot as nodeDot } from 'three/tsl'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import { setRegister, type WingHosts, type WingModule } from '../frame'
import { constructionRecords, evidenceWords } from './evidence-copy'
import { lang } from '../content'
import { GRADES } from '../../stack/grade'
import { createShell } from './shell'
import { createShellShadowDouble } from './shadow-shell'
import { createCollection, collectionProvenance } from './collection'
import { createCollectionReceiverPlaneShadowFilter } from './receiver-plane-shadow'
import { createCollectionAccess, collectionAccessPoint, collectionAccessProvenance } from './collection-access'
import { createRoadDressing, roadDressingProvenance } from './road-dressing'
import { createInnerCourtDressing, innerCourtProvenance, courtDressingProvenance } from './inner-court'
import { createGatePassage, gatePassageProvenance } from './gate-passage'
import { createEntryPassage, entryPassageProvenance } from './entry-passage'
import { createGround } from './ground'
import { createVegetation } from './vegetation'
import { createRail, stationPose, namedPose } from './rail'
import { collectRailSolids, createRailGeometryAuthority } from './rail-proof'
import { createWheelStepper } from './input'
import { dossier, world, hourKey, type Quantity } from './site'
import { gradeAt as groundHeight, galleryBankCapProvenance } from './terrain-mesh'
import { createGroundDressing } from './ground-dressing'
import { createWater, type WaterGroup } from './water'
import { createMeasurement, type VinciMeasurement } from './measurement'
import { collectVinciLabelOccluders, createVinciLabelAnchor, type VinciLabelAnchor, type VinciLabelMode } from './labels'
import { pathSpecifications } from './paths'
import { roadGradeProvenance } from './road-grade'
import { apronProvenance } from './apron'
import { vinciContent, vinciConstructionStatus, vinciThreshold, vinciHourArithmetic, vinciHourSpoken, vinciViewNames, vinciHourLabel, vinciHourIntegrity, vinciCertaintyWords, vinciPlantingAssumptions, vinciWeatherAssumptions, type VinciCertainty, type VinciStatement, type VinciStationId, type VinciText } from './content'
import wingCss from './wing.css?inline'

const text=(value:VinciText):string=>value[lang()]
const make=<K extends keyof HTMLElementTagNameMap>(tag:K,cls:string,value?:string):HTMLElementTagNameMap[K]=>{
  const e=document.createElement(tag);e.className=cls;if(value!==undefined)e.textContent=value;return e
}

interface LabelFacade { id:string; from:Quantity<number[]>; to:Quantity<number[]>; length_m:Quantity<number> }
const labelFacades=(dossier as unknown as {facades:LabelFacade[]}).facades
/** Registered facade axes place the dot on its actual reconstructed surface. */
function facadeAnchor(id:string,along:number,height:number,out:number):Vector3 {
  const f=labelFacades.find(value=>value.id===id)!
  const a=f.from.value,b=f.to.value,length=f.length_m.value
  const dx=(b[0]!-a[0]!)/length,dn=(b[1]!-a[1]!)/length
  return world(a[0]!+dx*along+dn*out,a[1]!+dn*along-dx*out,height)
}
const anchors:Partial<Record<VinciStationId,Vector3>>={
  arrival:facadeAnchor('F01',5,3.3,.025),
  courtyard:facadeAnchor('ENTRY',.95,4.05,.03),
  garden:facadeAnchor('F17',4.35,3.8,.025),
}
// Actual centre-ray intersections with the mounted inspection surfaces.
const materialInspectionAnchors:Record<string,Vector3>={
  'material-brick-sunlit':world(-13.560321684541906,-14.9178669252478,3.005),
  'material-stone-sunlit':world(-13.560321684541906,-14.9178669252478,-.04),
  'material-brick-close':world(11.117695712897879,-7.078463808598585,2.9986922698566905),
  'material-stone-close':world(2.5620239275497076,-12.509388984024916,3.6508174266979623),
  'material-slate-close':world(-9.782750812457085,-15.639471094269735,10.793980418697382),
  'material-oak-close':world(17.533634691757438,-21.916856110505716,4.270000004592006),
  'material-stone-plain':world(3.207569374398135,-18.204952671485792,0.833024666517249),
}
const entryInspectionAnchors:Record<string,Vector3>={
  'entry-structure':world(-.2569829165,-6.1287166674,2.5164557731),
  'entry-plaster':world(2.2544517139,-7.4190740818,2.3999999949),
  'entry-terracotta':world(1.4087311973,-9.6972077668,.8000000119),
}

/** The near cascade is a tight box, so it has to travel with the visitor:
 * one box over the whole site is a 9 cm texel and it prints its own acne on
 * a stair nosing. The far cascade stays fixed over the site. */
/** The wing's own print. A court under its own walls at this hour stands
 * two thirds of a stop below the garden front, so the aperture opens where
 * the visitor stands, exactly as a camera's would. No light in the scene
 * moves; this is the print, not the sun. */
const PRINT={...GRADES['first-station'],name:'clos-luce-1517',exposure:.94,split:.055,saturation:.9,vignette:.15,grain:.007,bloom:{strength:0,radius:.1,threshold:10,warmth:1}}
const STATION_EXPOSURE:Partial<Record<VinciStationId,number>>={courtyard:1.14}
const SHADOW={nearHalfM:20,nearMapPx:1024,aheadM:10,refocusM:3,lightDistanceM:80} as const

export function createWing():WingModule {
  let hosts:WingHosts|undefined, shell:Group, water:WaterGroup, measurement:VinciMeasurement, labels:VinciLabelAnchor
  let rail:ReturnType<typeof createRail>, key:ReturnType<WingHosts['world']['stack']['light']>
  let station=0, activeView='', mode:VinciLabelMode=1, controller:AbortController|undefined
  let header:HTMLElement,dock:HTMLElement,record:HTMLElement,source:HTMLButtonElement,sky:SkyMesh
  let labelHostHidden:string|null=null
  let shadowCache:ReturnType<typeof createStaticShadowCache>|undefined
  let restoreEnvironmentRotation:(()=>void)|null=null
  const narrow=()=>innerWidth/innerHeight<=.9
  const shadowFocus=new Vector3(NaN,NaN,NaN), focusAhead=new Vector3()
  function focusNearCascade(force=false):void {
    if(!hosts)return
    const camera=hosts.world.camera
    camera.getWorldDirection(focusAhead)
    focusAhead.multiplyScalar(SHADOW.aheadM).add(camera.position)
    if(!force&&focusAhead.distanceToSquared(shadowFocus)<SHADOW.refocusM*SHADOW.refocusM)return
    shadowFocus.copy(focusAhead)
    key.light.target.position.copy(shadowFocus)
    key.light.position.copy(key.direction).multiplyScalar(SHADOW.lightDistanceM).add(shadowFocus)
    key.light.target.updateMatrixWorld();key.light.updateMatrixWorld()
  }
  function init(h:WingHosts) {
    // Vinci's interactive source cards need an accessible host only while mounted.
    labelHostHidden=h.labels.getAttribute('aria-hidden');h.labels.removeAttribute('aria-hidden')
    hosts=h;h.stage.textContent='';h.labels.textContent='';h.stage.parentElement!.dataset['wing']='vinci';const style=make('style','');style.textContent=wingCss;h.stage.append(style)
    const {scene,camera,stack,clock}=h.world
    camera.near=.25;camera.updateProjectionMatrix()
    scene.clear();scene.background=new Color('#b3b7ac');scene.fog=new FogExp2('#c0bba9',.0075)
    stack.setScene(scene,camera,{...PRINT})
    key=stack.light({azimuth:hourKey.sun_azimuth_deg.value,elevation:hourKey.sun_elevation_deg.value,kelvin:4700,lux:320,ambient:.35,reach:100,cascades:[SHADOW.nearHalfM,90],sky:{zenith:'#8dabc0',horizon:'#d8cbb1',ground:'#514d3b',stars:0}})
    key.fill.color.set('#a5b5bb');key.fill.groundColor.set('#736550');key.fill.intensity=.48;scene.environmentIntensity=.28
    // The procedural probe paints azimuth from north; r185 samples longitude
    // from +X. Its inverse environment matrix needs this quarter-turn so the
    // probe disc and the measured key share the same physical sun direction.
    const priorEnvironmentRotation=scene.environmentRotation.clone()
    restoreEnvironmentRotation=()=>{scene.environmentRotation.copy(priorEnvironmentRotation)}
    scene.environmentRotation.set(0,-Math.PI/2,0)
    key.light.shadow.bias=-.00008;key.light.shadow.normalBias=.012;key.light.shadow.mapSize.setScalar(SHADOW.nearMapPx)
    focusNearCascade(true)
    // r185 implements filterNode; the installed LightShadow type predates it.
    Object.assign(key.light.shadow,{filterNode:createCollectionReceiverPlaneShadowFilter()})
    sky=new SkyMesh();sky.material.fog=false
    const skyRGB=(sky.material.colorNode as ReturnType<typeof vec4>).rgb
    const skyLuma=nodeDot(skyRGB,vec3(.2126,.7152,.0722))
    // Compress only the assumed atmosphere's bright lobe. The measured
    // solar direction, building irradiance and shadow rig are untouched.
    sky.material.colorNode=vec4(mix(vec3(skyLuma),skyRGB,.48).div(float(1).add(skyLuma.div(.58))),1)
    applyDisplayedHorizonHaze(sky.material,scene.fog as FogExp2)
    sky.scale.setScalar(1800);sky.sunPosition.value.copy(key.direction).multiplyScalar(450000);sky.turbidity.value=4;sky.rayleigh.value=1.4;sky.cloudScale.value=.0006;sky.cloudCoverage.value=.28;sky.cloudDensity.value=.42;sky.cloudElevation.value=.35;sky.cloudSpeed.value=0;scene.add(sky)
    const entry=createEntryPassage(stack.tierName())
    shell=createShell(stack.tierName(),stack.materials);scene.add(createGround(stack.tierName(),stack.materials),shell,entry,createGatePassage(stack.tierName()),createInnerCourtDressing(groundHeight,stack.tierName()),createRoadDressing(groundHeight,stack.tierName()),createCollection(),createCollectionAccess(),createVegetation(groundHeight,stack.tierName()),createGroundDressing(groundHeight,stack.tierName()))
    if(stack.tierName()==='calm'){
      const shadowShell=createShellShadowDouble(shell,entry)
      shell.traverse(o=>{if(o instanceof Mesh)o.castShadow=false})
      scene.add(shadowShell)
      key.light.castShadow=true;key.light.shadow.autoUpdate=true;key.light.shadow.needsUpdate=true
    }
    water=createWater(scene,stack);scene.add(water)
    shadowCache=createStaticShadowCache(scene,camera,stack.renderer,()=>stack.materials.pending())
    for(const root of scene.children){const id=root===shell?'vinci/shell':root.name==='vinci/shell-shadow'?'vinci/shell-shadow':root.name==='wing-vinci/gate-passage'?'vinci/gate-passage':root===water?'vinci/water':root===sky?'vinci/sky':root.name.includes('landscape trees')?'vinci/vegetation':root.name==='vinci/collection-modern-insertion'?'vinci/collection':root.name==='vinci generated road dressing'?'vinci/road-dressing':root.name==='vinci generated inner court dressing'?'vinci/inner-court':root.name.includes('dressing')?'vinci/ground-dressing':'vinci/terrain';root.traverse(o=>{if(o instanceof Mesh){const assetId=typeof o.userData['manifestId']==='string'?o.userData['manifestId']:id;o.userData['manifestId']=assetId;o.userData['asset']=assetId}})}
    rail=createRail(camera,clock,createRailGeometryAuthority(collectRailSolids(scene)));measurement=createMeasurement(h.labels,stack)
    header=make('div','vinci-heading');h.stage.append(header)
    source=make('button','vinci-source',lang()==='de'?'Quellen':'Sources');source.append(make('kbd','vinci-key','L'));source.type='button';source.setAttribute('aria-controls','vinci-source-card');source.addEventListener('click',()=>{mode=mode===2?1:2;paintDock();if(mode===2)dock.focus({preventScroll:true})});h.stage.parentElement!.querySelector('.wing-rail-group')!.append(source)
    dock=make('aside','vinci-dock');setRegister(dock,'drawer');dock.id='vinci-source-card';dock.tabIndex=0;dock.setAttribute('aria-label',lang()==='de'?'Quellen und Rekonstruktion':'Sources and reconstruction');h.labels.append(dock)
    labels=createVinciLabelAnchor({host:h.labels,camera,occluders:collectVinciLabelOccluders(scene),onOpen:()=>{mode=2;paintDock();dock.focus({preventScroll:true})}})
    controller=new AbortController();const options={signal:controller.signal}
    let touchX=0,touchY=0,lastX=0,lastY=0,dragging=false,pointer=-1
    const wheelStep=createWheelStepper(()=>performance.now())
    h.stage.addEventListener('wheel',(e)=>{if(e.ctrlKey||e.defaultPrevented||(e.target as Element).closest('.vinci-dock,.wing-rail-group'))return;e.preventDefault();const step=wheelStep(e.deltaY,e.deltaMode,innerHeight);if(step)h.navigate(station+step)},{...options,passive:false})
    h.stage.addEventListener('pointerdown',(e)=>{if(!e.isPrimary||e.button!==0||(e.target as Element).closest('button,a,input,textarea,select,.vinci-dock,.wing-rail-group'))return;e.preventDefault();dragging=true;pointer=e.pointerId;touchX=lastX=e.clientX;touchY=lastY=e.clientY;h.stage.setPointerCapture(e.pointerId)},options)
    h.stage.addEventListener('pointermove',(e)=>{if(!dragging||pointer!==e.pointerId)return;rail.drag(e.clientX-lastX,e.clientY-lastY,h.stage.getBoundingClientRect().height);lastX=e.clientX;lastY=e.clientY},options)
    h.stage.addEventListener('pointerup',(e)=>{if(!dragging||pointer!==e.pointerId)return;dragging=false;pointer=-1;if(e.pointerType==='touch'&&Math.abs(e.clientY-touchY)>65&&Math.abs(e.clientY-touchY)>Math.abs(e.clientX-touchX)*1.3)h.navigate(station+(e.clientY<touchY?1:-1))},options)
    const cancelDrag=()=>{dragging=false;pointer=-1}
    h.stage.addEventListener('pointercancel',cancelDrag,options)
    h.stage.addEventListener('lostpointercapture',cancelDrag,options)
    window.addEventListener('keydown',(e)=>{
      if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return
      const target=e.target instanceof Element?e.target:document.body
      if(target.closest('input,textarea,select,[contenteditable="true"]'))return
      if(e.key==='Escape'){e.preventDefault();mode=1;rail.look(0,0);paintDock();source.focus({preventScroll:true});return}
      if(e.key.toLowerCase()==='l'&&!e.repeat){e.preventDefault();mode=((mode+1)%3) as VinciLabelMode;paintDock();if(mode===2)dock.focus({preventScroll:true});else if(target.closest('.vinci-dock'))source.focus({preventScroll:true});return}
      if(target.closest('.vinci-dock'))return
      if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();h.navigate(station+1)}
      if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();h.navigate(station-1)}
    },options)
    window.addEventListener('resize',()=>{placeCanonicalStation();paintDock()},options)
  }
  // Named inspection entry and return are paired deliberate placements.
  // Their off-rail eye never becomes the start of an animated station route.
  /** The card names what the frame holds: a sub-view carries its own title. */
  function titleForView(viewId:string) {
    const s=vinciContent[station]!
    const name=vinciViewNames[viewId]??(viewId.startsWith('collection')?vinciViewNames['collection']:undefined)
    const h1=header.querySelector('.vinci-title')
    if(h1)h1.textContent=text(name??s.name)
  }
  function aimPrint(id:VinciStationId):void {
    if(!hosts)return
    const {scene,camera,stack}=hosts.world
    stack.setScene(scene,camera,{...PRINT,exposure:STATION_EXPOSURE[id]??PRINT.exposure})
  }
  function placeCanonicalStation() {
    const id=vinciContent[station]!.id
    activeView='';measurement.hide();header.querySelector('.vinci-insertion')?.remove();titleForView('')
    rail.set(id,stationPose(id,narrow()),true,narrow())
  }
  function endInspection() { if(activeView)placeCanonicalStation() }
  function appendRecord(value:VinciText,citation:string,certainty?:VinciCertainty,anchorId?:string,anchorClass?:'GENERATED'|'procedural'):void {
    const p=make('p','vinci-statement')
    if(certainty){
      p.dataset['certainty']=certainty
      p.dataset['naClaim']=certainty==='documented'?'documented':certainty==='conjectural'?'tradition':certainty==='unknown'?'':'inferred'
      if(anchorId)p.dataset['naAnchor']=anchorId
      if(anchorClass)p.dataset['naAnchorClass']=anchorClass
      p.append(make('span','vinci-certainty-word',text(vinciCertaintyWords[certainty])))
    }
    p.append(document.createTextNode(text(value)))
    record.append(p,make('small','vinci-citation',citation))
  }
  function appendStatement(value:VinciText,certainty:VinciCertainty,anchorId:string,anchorClass:'GENERATED'|'procedural',citation:string,full:VinciText=value,humanSource?:VinciText):void {
    const p=make('p','vinci-statement')
    p.dataset['certainty']=certainty
    p.dataset['naClaim']=certainty==='documented'?'documented':certainty==='conjectural'?'tradition':certainty==='unknown'?'':'inferred'
    p.dataset['naAnchor']=anchorId;p.dataset['naAnchorClass']=anchorClass
    p.append(make('span','vinci-certainty-word',text(vinciCertaintyWords[certainty])),document.createTextNode(' '+text(value)))
    if(humanSource)p.append(make('span','vinci-human-source',text(humanSource)))
    dock.append(p)
    appendRecord(full,citation,certainty,anchorId,anchorClass)
  }
  function appendEvidence(key:string,value:VinciText,certainty:VinciCertainty,anchorId:string,citation:string):void {
    appendStatement(evidenceWords[key]!,certainty,anchorId,'GENERATED',citation,value)
  }
  function appendLabel(label:VinciStatement):void {
    const carrier=label.id==='planting-assumptions'?'vinci/vegetation':label.id==='weather-assumptions'?'vinci/sky':'vinci/shell'
    appendStatement(label,label.certainty,label.target==='carrier'?carrier:`vinci/source/${label.id}`,label.target==='carrier'?'GENERATED':'procedural',label.source,label.record??label,label.humanSource)
  }
  function paintDock() {
    if(!hosts)return
    const s=vinciContent[station]!,scroll=dock.scrollTop
    header.hidden=mode===2
    const camera=hosts.world.camera
    dock.dataset['station']=s.id
    // Opening Sources changes presentation only, inside the same proven lens.
    camera.zoom=1;camera.clearViewOffset();camera.updateProjectionMatrix()
    dock.hidden=mode!==2;source.setAttribute('aria-expanded',String(mode===2))
    labels.setMode(mode)
    const collectionView=activeView.startsWith('collection')
    const entryAnchor=entryInspectionAnchors[activeView]
    labels.setAnchor(materialInspectionAnchors[activeView]??entryAnchor??(activeView==='collection-court-access'?world(...collectionAccessPoint(1.05,.65),-.46):collectionView?world(-21.92,-33.92,-3.2):s.outdoor?anchors[s.id]??null:null),`${text(vinciCertaintyWords.reconstructed)} · ${entryAnchor?(lang()==='de'?'Vorgeschlagene Eingangsstruktur':'Proposed entrance structure'):collectionView?(lang()==='de'?'Museumseinbau der Gegenwart':'Modern museum insertion'):text(s.name)}`)
    dock.textContent=''
    record=make('div','vinci-record');setRegister(record,'record');record.id='vinci-full-record';record.hidden=true;record.append(make('h3','',lang()==='de'?'Vollständiger Nachweis':'Full record'))
    const title=make('p','vinci-certainty',text(s.outdoor?vinciCertaintyWords.reconstructed:vinciConstructionStatus))
    title.dataset['certainty']=s.outdoor?'reconstructed':'unknown'
    if(s.outdoor){title.dataset['naClaim']='inferred';title.dataset['naAnchor']='vinci/shell';title.dataset['naAnchorClass']='GENERATED'}
    dock.append(title,make('h2','',text(s.name)))
    for(const label of s.labels)appendLabel(label)
    if(!s.outdoor){dock.append(make('p','vinci-promise',text(s.promise)));appendRecord(s.record??s.promise,s.promiseSource)}
    // The card claims the hour at every outdoor station, so every one of them
    // carries the chain that backs it.
    if(s.outdoor)record.insertBefore(make('pre','vinci-arithmetic',text(vinciHourArithmetic)),record.children[1]??null)
    if(s.id==='courtyard'){appendLabel(vinciHourLabel);appendLabel(vinciHourIntegrity)}
    if(s.id==='arrival'||s.id==='garden'){
      appendLabel(vinciPlantingAssumptions);appendLabel(vinciWeatherAssumptions)
      const path=pathSpecifications[s.id==='arrival'?0:1]!
      appendEvidence(s.id==='arrival'?'streetPath':'gardenPath',path.sourceLabel,'conjectural','vinci/path-surfaces',path.alignmentSource.join(' · '))
    }
    if(s.outdoor){
      appendEvidence('foundation',foundationPlinthProvenance.label,'reconstructed','vinci/shell',foundationPlinthProvenance.source.join(' · '))
      appendStatement(galleryBankCapProvenance.label,'conjectural','vinci/terrain-mesh','GENERATED',galleryBankCapProvenance.source.join(' · '),galleryBankCapProvenance.record,{en:'The cadastre and the registered site plan guide its outline.',de:'Das Kataster und der registrierte Lageplan bestimmen seinen Umriss.'})
      appendEvidence('minerals',mineralSurfaceProvenance.label,'reconstructed','vinci/surfaces','A-MATERIAL · A-MASONRY · materials.csv · Q124 · Q130')
      appendEvidence('finish',closeSurfaceProvenance.label,'conjectural','vinci/surfaces','A-MATERIAL · materials.csv · Q019 · Q124 · Q127')
      const constructionSources=[
        ['slate','vinci/surfaces','Q019 · Q124 · Q127 · A-HEIGHT'],
        ['retaining','vinci/terrain','Q001 · Q124 · A-SITE'],
        ['chapel','vinci/shell','Q175 · ARVIVA-0 · A-OPENING'],
        ['glazing','vinci/shell','BUILDING-DOSSIER § materials · Q124 · Q127 · A-OPENING'],
      ] as const
      for(const [name,anchor,citation] of constructionSources)appendEvidence(name,constructionRecords[name]!,name==='slate'?'conjectural':'reconstructed',anchor,citation)
    }
    if(s.outdoor||collectionView)appendEvidence('haze',displayedHorizonHazeProvenance.label,'conjectural','vinci/sky',displayedHorizonHazeProvenance.source.join(' · '))
    if(s.id==='garden'||!s.outdoor||collectionView){
      appendEvidence('collection',collectionProvenance.label,'reconstructed','vinci/collection',collectionProvenance.source.join(' · '))
      appendEvidence('collectionDesign',collectionProvenance.parameterLabel,'reconstructed','vinci/collection','COMMISSION § Judges list10 · maquette.ts COLLECTION')
      appendEvidence('approach',collectionProvenance.approachLabel,'reconstructed','vinci/collection','maquette.ts garden approach · A-SITE terrace · modern exhibition design')
    }
    if(s.id==='courtyard'||s.id==='garden'||!s.outdoor){
      appendEvidence('access',collectionAccessProvenance.label,'reconstructed','vinci/collection-access',collectionAccessProvenance.source.join(' · '))
      appendEvidence('accessDesign',collectionAccessProvenance.parameterLabel,'reconstructed','vinci/collection-access','A-SITE retained court and terrace · modern museum access proposal')
    }
    if(s.id==='courtyard'||['hall','oratory','study','chamber'].includes(s.id)||activeView.startsWith('entry-')){
      appendEvidence('entry',entryPassageProvenance.label,'reconstructed','vinci/entry-passage',entryPassageProvenance.source.join(' · '))
      appendEvidence('entryFinish',entryMineralSurfaceProvenance.label,'reconstructed','vinci/entry-mineral-surface',entryMineralSurfaceProvenance.source.join(' · '))
    }
    if(s.id==='arrival'){
      appendEvidence('road',roadDressingProvenance.label,'conjectural','vinci/road-dressing',roadDressingProvenance.source.join(' · '))
      appendEvidence('court',innerCourtProvenance.label,'reconstructed','vinci/inner-court',innerCourtProvenance.source.join(' · '))
      appendEvidence('courtWear',courtDressingProvenance.label,'conjectural','vinci/inner-court',courtDressingProvenance.source.join(' · '))
      appendEvidence('gate',gatePassageProvenance.label,'reconstructed','vinci/gate-passage',gatePassageProvenance.source.join(' · '))
      appendEvidence('roadGrade',roadGradeProvenance.label,'reconstructed','vinci/road-grade',roadGradeProvenance.source.join(' · '))
      appendEvidence('apron',apronProvenance.label,'reconstructed','vinci/house-side-apron',apronProvenance.source.join(' · '))
    }
    appendRecord({en:'© OpenStreetMap contributors · ODbL 1.0. IGN · Licence Ouverte 2.0. Geometry and surfaces: procedural reconstruction.',de:'© OpenStreetMap-Mitwirkende · ODbL 1.0. IGN · Licence Ouverte 2.0. Geometrie und Oberflächen: prozedurale Rekonstruktion.'},'OpenStreetMap · IGN')
    appendRecord({en:'CC0 1.0 · ambientCG · stone-tuffeau, earth-packed, grass-short. Library material surrogates; no site photography sampled.',de:'CC0 1.0 · ambientCG · stone-tuffeau, earth-packed, grass-short. Materialersatz aus der Bibliothek. Keine Standortfotografie als Textur verwendet.'},'CC0 material library')
    appendRecord({en:'Assumed dimensions: brick 0.22–0.27 × 0.035–0.055 m; wall 0.45–0.80 m; main eaves 7.0–8.4 m. Basis: BUILDING-DOSSIER, Q001/Q124/Q127.',de:'Angenommene Maße: Ziegel 0.22–0.27 × 0.035–0.055 m; Mauer 0.45–0.80 m; Haupttraufe 7.0–8.4 m. Grundlage: BUILDING-DOSSIER, Q001/Q124/Q127.'},'brief/BUILDING-DOSSIER.md')
    const recordButton=make('button','vinci-record-toggle',lang()==='de'?'Vollständiger Nachweis':'Full record')
    recordButton.type='button';recordButton.setAttribute('aria-controls',record.id);recordButton.setAttribute('aria-expanded','false')
    recordButton.addEventListener('click',()=>{record.hidden=!record.hidden;recordButton.setAttribute('aria-expanded',String(!record.hidden))})
    dock.insertBefore(recordButton,dock.children[2]??null);recordButton.after(record)
    dock.scrollTop=scroll
  }
  return {
    stations:vinciContent.map(s=>({id:s.id,name:text(s.name),question:text(s.door)})),
    show(index,h){const first=!hosts;if(first)init(h);else endInspection();if(station!==index)dock.scrollTop=0;station=index;activeView='';measurement.hide();const s=vinciContent[index]!;aimPrint(s.id);rail.set(s.id,stationPose(s.id,narrow()),first,narrow());header.textContent='';header.append(make('p','vinci-kicker',`CLOS LUCE, 1517 · ${String(index+1).padStart(2,'0')} / 19${s.outdoor?' · '+text(vinciCertaintyWords.reconstructed):''}`),make('h1','vinci-title',text(s.name)));if(s.outdoor)header.append(make('p','vinci-hour',text(vinciHourSpoken)));if(!s.outdoor){header.classList.add('vinci-construction');header.append(make('p','vinci-status',text(vinciConstructionStatus)),make('p','vinci-promise',text(s.promise)));if(s.id==='hall')header.append(make('p','vinci-threshold',text(vinciThreshold)))}else header.classList.remove('vinci-construction');paintDock()},
    view(id){const inspectCost=id.endsWith('-cost')&&id!=='audit-cost';if(inspectCost)id=id.slice(0,-5);const s=vinciContent[station]!;if(id==='scene')endInspection();if(id==='scene'||id.startsWith('audit-'))rail.look(0,0);if(id==='scene'||id==='audit-cost'){mode=1;paintDock()}if(id==='audit-cost')measurement.show(s.id);if(id==='audit-ui'){mode=1;paintDock();measurement.show(s.id,'ui')}if(id==='audit-ui-labels'){mode=2;paintDock();measurement.show(s.id,'ui')}const pose=namedPose(id,narrow());if(pose){activeView=id;mode=1;paintDock();rail.set(s.id,pose,true,narrow());header.querySelector('.vinci-insertion')?.remove();titleForView(id);if(id.startsWith('collection'))header.append(make('p','vinci-insertion',lang()==='de'?'Museumseinbau der Gegenwart · Räume im Bau':'Modern museum insertion · Rooms in construction'))}const cone=/(?:^|-)cone-(ul|ur|dl|dr)$/.exec(id);if(cone){placeCanonicalStation();rail.look(cone[1]!.includes('l')?.6:-.6,cone[1]!.startsWith('u')?.32:-.32)}if(id==='labels'||id==='hour'||id==='record'){mode=2;paintDock();if(id==='record'){dock.querySelector<HTMLButtonElement>('.vinci-record-toggle')?.click();dock.scrollTop=record.offsetTop-18}}if(inspectCost&&(pose||cone))measurement.show(`${s.id} / ${id}`)},
    look(y,p){rail?.look(y,p)},
    update(){if(!hosts)return;measurement.update();rail.update();focusNearCascade();shadowCache?.update();sky.position.copy(hosts.world.camera.position);labels.update(dock.hidden?null:dock.getBoundingClientRect())},
    stop(){shadowCache?.dispose();shadowCache=undefined;restoreEnvironmentRotation?.();restoreEnvironmentRotation=null;controller?.abort();source?.remove();labels?.dispose();measurement?.dispose();water?.dispose();hosts?.world.scene.traverse(o=>{if(o instanceof DirectionalLight&&o!==key?.light)o.dispose()});key?.dispose();if(hosts){hosts.world.scene.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});hosts.world.scene.clear();delete hosts.stage.parentElement!.dataset['wing'];if(labelHostHidden===null)hosts.labels.removeAttribute('aria-hidden');else hosts.labels.setAttribute('aria-hidden',labelHostHidden)}hosts=undefined},
  }
}
