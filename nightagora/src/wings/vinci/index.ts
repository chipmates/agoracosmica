import { createStaticShadowCache } from './static-shadow-cache'
import { applyDisplayedHorizonHaze, displayedHorizonHazeProvenance } from './display-sky-haze'
import { mineralSurfaceProvenance, closeSurfaceProvenance } from './surface'
import { entryMineralSurfaceProvenance } from './entry-mineral-surface'
import { foundationPlinthProvenance } from './foundation-plinth'
import { Color, FogExp2, DirectionalLight, Mesh, Raycaster, Vector2, Vector3, type Group } from 'three/webgpu'
import { float, mix, vec3, vec4, dot as nodeDot, positionWorld, cameraPosition, smoothstep, mx_fractal_noise_float } from 'three/tsl'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import { setRegister, type WingHosts, type WingModule } from '../frame'
import { constructionRecords, evidenceWords } from './evidence-copy'
import { lang, WING_TEXT } from '../content'
import { createVinciSourcesWindow, type VinciSourcesTab, type VinciExhibitSources } from './sources'
import { createVinciWelcome, vinciWelcomeSeen } from './welcome'
import { GRADES } from '../../stack/grade'
import { createShell } from './shell'
import { createShellShadowDouble } from './shadow-shell'
import { createWingShadowBody, type WingShadowBody } from './shadow-body'
import { createCollection, collectionProvenance } from './collection'
import { collectionView } from './collection/views'
import { mountCollectionExhibits, type CollectionExhibits } from './collection/exhibits'
import { isMachineSlug, type MachineSlug } from './machines'
import { createPictureRecord, createPolicyWorkLabel, policyLabelText, PICTURE_CERTAINTY_KEY } from './pictures/policy-label'
import { MAIN_HANG, REGISTER, type PictureRights } from './pictures/register'
import { MACHINE_SLUGS, machineCatalog } from './machines/catalog'
import { validatePaintingRecord } from './pictures/policy'
import { ASSET_BASE } from '../../stack/materials'
import { createCollectionReceiverPlaneShadowFilter } from './receiver-plane-shadow'
import { createCollectionAccess, collectionAccessPoint, collectionAccessProvenance } from './collection-access'
import { createRoadDressing, roadDressingProvenance } from './road-dressing'
import { createInnerCourtDressing, innerCourtProvenance, courtDressingProvenance } from './inner-court'
import { createGatePassage, gatePassageProvenance } from './gate-passage'
import { createEntryPassage, entryPassageProvenance } from './entry-passage'
import { createGround } from './ground'
import { createVegetation } from './vegetation'
import { createRail, stationPose, namedPose, vinciStandsInRoom } from './rail'
import { collectRailSolids, createRailGeometryAuthority } from './rail-proof'
import { createWheelStepper } from './input'
import { dossier, world, hourKey, type Quantity } from './site'
import { gradeAt as groundHeight, galleryBankCapProvenance } from './terrain-mesh'
import { createGroundDressing } from './ground-dressing'
import { createWater, type WaterGroup } from './water'
import { createMeasurement, type VinciMeasurement } from './measurement'
import { collectVinciLabelOccluders, createVinciExhibitDots, createVinciLabelAnchor, vinciSightBlocked, type VinciExhibitDots, type VinciExhibitMark, type VinciLabelAnchor, type VinciLabelMode } from './labels'
import { pickVinciExhibit, readVinciExhibits, type VinciPickEntry } from './collection/pick'
import { vinciApproachPose } from './collection/approaches'
import { createVinciCloseLook } from './collection/close-look'
import { pathSpecifications } from './paths'
import { roadGradeProvenance } from './road-grade'
import { apronProvenance } from './apron'
import { vinciContent, vinciLegacyStationIds, vinciConstructionStatus, vinciReconstruction, vinciCollectionThreshold, vinciRoomStationIds, vinciHourArithmetic, vinciHourSpoken, vinciViewNames, vinciHourLabel, vinciHourIntegrity, vinciCertaintyWords, vinciPlantingAssumptions, vinciWeatherAssumptions, vinciAbsences, vinciGrounds, vinciRightsPolicy, vinciWingCounts, vinciSourcesHeadings, type VinciCertainty, type VinciStatement, type VinciStationId, type VinciText } from './content'
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
// A COURT UNDER ITS OWN WALLS. Most of this wing stands in the building's own
// shade at this hour, and an eye standing there opens on the shade, not on the
// sky. The toe is lifted a little, cool, the way shade is: it is the print, and
// no light in the scene moves.
const PRINT={...GRADES['first-station'],name:'clos-luce-1517',exposure:.94,lift:[.012,.014,.018] as [number,number,number],split:.055,saturation:.9,vignette:.15,grain:.007,bloom:{strength:0,radius:.1,threshold:10,warmth:1}}
// The court used to open two thirds of a stop, which warmed the tuffeau toward
// grey-gold and lifted the plaster's mottling into view. One print holds the
// whole wing now, and the court is lit rather than exposed.
/** A ROOM IS NOT THE STREET. The stations in the insertion stand indoors,
 * under a clerestory and two fittings, and the outdoor exposure left them a
 * stop and a half under. The eye opens at the door, as a camera does. */
const STATION_EXPOSURE:Partial<Record<VinciStationId,number>>={courtyard:1.0,
  'picture-room':1.34,'reading-table':1.5,scattered:1.3,flight:1.24,works:1.24,body:1.4,myths:1.38}
const SHADOW={nearHalfM:20,nearMapPx:1024,aheadM:10,refocusM:3,lightDistanceM:80} as const

export interface VinciWingModule extends WingModule {
  openSources(tab?:VinciSourcesTab):void
  setExhibitSources(exhibit:VinciExhibitSources|null):void
  /** The close look's hold on one machine's clock. Null is the rest pose. */
  demonstrateMachine(slug:string|null):void
}

export function createWing():VinciWingModule {
  let hosts:WingHosts|undefined, shell:Group, water:WaterGroup, measurement:VinciMeasurement, labels:VinciLabelAnchor
  let rail:ReturnType<typeof createRail>, key:ReturnType<WingHosts['world']['stack']['light']>
  // THE CARD NAMES WHERE THE VISITOR IS. `station` is the station asked for,
  // `card` is the one actually standing: while the walk is on the way the
  // frame keeps the card of the place it is still in.
  let station=0, card=0, activeView='', mode:VinciLabelMode=1, controller:AbortController|undefined
  let header:HTMLElement,dock:HTMLDialogElement,drawer:HTMLElement,record:HTMLElement,source:HTMLButtonElement,sky:SkyMesh
  let sources:ReturnType<typeof createVinciSourcesWindow>
  let welcome:ReturnType<typeof createVinciWelcome>|undefined
  let exhibitSources:VinciExhibitSources|null=null
  let labelHostHidden:string|null=null
  // THE WAIT AT THE STREET SHOWS ITSELF. The heading is painted and the frame
  // is given to the browser before the place is built, so the visitor stands
  // at a named station instead of at nothing; a measured hairline says how
  // much of the stone has landed, and a station asked for before the rail's
  // own proof is verified is placed rather than queued and lost.
  let standing=false, scheduled=0, sign:HTMLElement|undefined, plates=0
  let authority:ReturnType<typeof createRailGeometryAuthority>|undefined
  let shadowCache:ReturnType<typeof createStaticShadowCache>|undefined
  let shadowBody:WingShadowBody|undefined
  /** The share of a leg after which the card names the station ahead. */
  const CARD_HANDOVER=.5
  let exposureAt:VinciStationId|undefined
  let exhibits:CollectionExhibits|undefined, exhibitClock=0
  /** THE CLOSE LOOK. The registry is a read over the collection's own group,
   * the dots live in the label layer, and one owner holds the open exhibit. */
  let collectionRoot:Group|undefined, occluders:readonly Mesh[]=[]
  let dots:VinciExhibitDots|undefined, closeLook:ReturnType<typeof createVinciCloseLook>|undefined
  let picks:VinciPickEntry[]=[], picksTier=''
  const pickRay=new Raycaster(), sightRay=new Raycaster(), sightHits:Parameters<typeof vinciSightBlocked>[4]=[]
  /** Three on calm, six on standard, eight on hero: what is in front of the
   * visitor carries a mark, and the rest of the room does not. */
  const DOTS_PER_TIER:Record<string,number>={hero:8,standard:6,calm:3}
  /** The one mode a press opens in, set by the caller the press came from. */
  let openMode:'auto'|'walk'|'cut'='auto'
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
  /** The heading, the hairline and nothing else: cheap enough to paint in the
   * frame the visitor arrives in. */
  function mount(h:WingHosts) {
    // Vinci's interactive source cards need an accessible host only while mounted.
    labelHostHidden=h.labels.getAttribute('aria-hidden');h.labels.removeAttribute('aria-hidden')
    hosts=h;h.stage.textContent='';h.labels.textContent='';h.stage.parentElement!.dataset['wing']='vinci';const style=make('style','');style.textContent=wingCss;h.stage.append(style)
    header=make('div','vinci-heading');h.stage.append(header)
    sign=make('div','vinci-opening');sign.append(make('span','vinci-opening-fill'));h.stage.append(sign)
  }
  function schedule() { scheduled=requestAnimationFrame(()=>{scheduled=requestAnimationFrame(build)}) }
  function build() {
    scheduled=0
    const h=hosts!
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
    // HIGH CLOUD. The dome's own cloud layer stands near the horizon, so above
    // about twenty degrees every frame in this wing was an empty plane, and it
    // is the largest plane in the packet. A thin streaked veil, densest at
    // forty degrees and gone at the zenith and the horizon, gives the phone's
    // upper corner something to hold. Assumed weather, as the label says.
    const ray=positionWorld.sub(cameraPosition).normalize()
    const veil=mx_fractal_noise_float(vec3(ray.x.mul(2.6),ray.y.mul(5.5),ray.z.mul(2.1)),4,2,.5).clamp(-1,1)
    const mass=mx_fractal_noise_float(vec3(ray.x.mul(.9),ray.y.mul(1.7),ray.z.mul(.8)),3,2,.5).clamp(-1,1)
    const height=ray.y.clamp(0,1)
    const cover=veil.mul(.42).add(mass.mul(.58)).mul(.5).add(.5)
    const cirrus=smoothstep(.04,.26,height).mul(float(1).sub(smoothstep(.80,1,height)).mul(.35).add(.65))
      .mul(smoothstep(.54,.82,cover))
    // High cloud at this hour is lit from the west and grey away from it, so
    // the veil takes the sun's own direction rather than one flat tone.
    const toSun=ray.dot(vec3(key.direction.x,key.direction.y,key.direction.z))
    const litCloud=mix(vec3(.40,.44,.51),vec3(.71,.68,.62),smoothstep(-.25,.85,toSun))
    const veiled=mix(mix(vec3(skyLuma),skyRGB,.48),litCloud,cirrus.mul(.58))
    sky.material.colorNode=vec4(veiled.div(float(1).add(skyLuma.div(.58))),1)
    applyDisplayedHorizonHaze(sky.material,scene.fog as FogExp2)
    sky.scale.setScalar(1800);sky.sunPosition.value.copy(key.direction).multiplyScalar(450000);sky.turbidity.value=4;sky.rayleigh.value=1.4;sky.cloudScale.value=.0006;sky.cloudCoverage.value=.28;sky.cloudDensity.value=.42;sky.cloudElevation.value=.35;sky.cloudSpeed.value=0;scene.add(sky)
    const entry=createEntryPassage(stack.tierName())
    shell=createShell(stack.tierName(),stack.materials)
    const ground=createGround(stack.tierName(),stack.materials)
    // The collection is built after the house has asked the library for its
    // own sets, so the machines' smaller requests never arrive first.
    const collection=createCollection()
    exhibits=mountCollectionExhibits(collection,stack)
    scene.add(ground,shell,entry,createGatePassage(stack.tierName()),createInnerCourtDressing(groundHeight,stack.tierName()),createRoadDressing(groundHeight,stack.tierName()),collection,createCollectionAccess(),createVegetation(groundHeight,stack.tierName()),createGroundDressing(groundHeight,stack.tierName()))
    // THE SHELL CASTS ITS SHADOW THROUGH ITS DOUBLE, AT EVERY TIER. The
    // detailed shell carries its surface relief into both cascades, which is
    // 140,000 triangles twice for a shadow that cannot show a brick. The
    // double is the same structural faces with the same apertures, gable
    // outlines and roof unions, under three thousand.
    {
      const shadowShell=createShellShadowDouble(shell,entry)
      // The double is built from the entry's structural faces too, so the
      // entry was throwing its shadow twice.
      for(const group of [shell,entry])group.traverse(o=>{if(o instanceof Mesh)o.castShadow=false})
      scene.add(shadowShell)
      key.light.castShadow=true;key.light.shadow.autoUpdate=true;key.light.shadow.needsUpdate=true
    }
    water=createWater(scene,stack);scene.add(water)
    shadowCache=createStaticShadowCache(scene,camera,stack.renderer,()=>stack.materials.pending())
    // The cache proves the scene's casters are the ones it snapshotted. The
    // court's exhibit brings its own materials from the library a moment
    // later, so the snapshot is taken again once they have arrived; without
    // it the whole shadow map is re-rendered on every frame of the walk.
    void exhibits?.ready.then(()=>{if(!hosts||!standing)return;shadowCache?.dispose();shadowCache=createStaticShadowCache(scene,camera,stack.renderer,()=>stack.materials.pending());if(mode===2)paintDock()})
    for(const root of scene.children){const id=root===shell?'vinci/shell':root.name==='vinci/shell-shadow'?'vinci/shell-shadow':root.name==='wing-vinci/gate-passage'?'vinci/gate-passage':root===water?'vinci/water':root===sky?'vinci/sky':root.name.includes('landscape trees')?'vinci/vegetation':root.name==='vinci/collection-modern-insertion'?'vinci/collection':root.name==='vinci generated road dressing'?'vinci/road-dressing':root.name==='vinci generated inner court dressing'?'vinci/inner-court':root.name.includes('dressing')?'vinci/ground-dressing':'vinci/terrain';root.traverse(o=>{if(o instanceof Mesh){const assetId=typeof o.userData['manifestId']==='string'?o.userData['manifestId']:id;o.userData['manifestId']=assetId;o.userData['asset']=assetId}})}
    // The ids above are what the shadow body folds by, so it is welded
    // after them and before the rail reads the scene.
    shadowBody=createWingShadowBody(scene);scene.add(shadowBody.group)
    authority=createRailGeometryAuthority(collectRailSolids(scene))
    rail=createRail(camera,clock,authority);measurement=createMeasurement(h.labels,stack)
    source=make('button','vinci-source',lang()==='de'?'Quellen':'Sources');source.type='button';source.setAttribute('aria-keyshortcuts','l');source.setAttribute('aria-controls','vinci-source-card');source.addEventListener('click',()=>{mode=mode===2?1:2;paintDock()});h.stage.parentElement!.querySelector('.wing-rail-group')!.append(source)
    sources=createVinciSourcesWindow(h.labels,source,()=>{mode=1;paintDock()});dock=sources.element;drawer=sources.panels.station
    occluders=collectVinciLabelOccluders(scene)
    labels=createVinciLabelAnchor({host:h.labels,camera,occluders,onOpen:()=>{mode=2;paintDock()}})
    collectionRoot=collection
    dots=createVinciExhibitDots({host:h.labels,camera,occluders,limit:DOTS_PER_TIER[stack.tierName()]??6,
      onOpen:(id,dot)=>openExhibit(id,dot)})
    closeLook=createVinciCloseLook({host:h.labels,narrow,
      onOpen:id=>{
        dots?.invalidate();paintExhibitTitle();paintHeaderVisibility()
        const pose=openMode==='auto'||openMode==='walk'||openMode==='cut'?vinciApproachPose(id,narrow()):undefined
        if(!pose)return false
        // A cut is the rig's own placement and the calm body's; a walk is what
        // a visitor gets. Neither moves without the leg's own certificate.
        if(openMode==='walk')return rail.approach(id,pose,narrow(),false)
        if(openMode==='cut')return rail.approach(id,pose,narrow(),true)
        if(!exhibitWalks())return false
        return rail.approach(id,pose,narrow(),cutToStation())
      },
      onClose:()=>{
        if(exhibitSources){exhibitSources=null;if(mode===2)mode=1;paintDock()}
        rail.returnToStation();dots?.invalidate();paintExhibitTitle();paintHeaderVisibility()
      }})
    void exhibits?.picturesReady.then(()=>{if(hosts&&standing)refreshExhibits()})
    welcome=createVinciWelcome(h.labels,route=>{if(route==='collection')enterCollection();focusTheBar()})
    controller=new AbortController();const options={signal:controller.signal}
    let touchX=0,touchY=0,lastX=0,lastY=0,dragging=false,pointer=-1
    const wheelStep=createWheelStepper(()=>performance.now())
    // A notch asks for the next station AND walks a stride along the leg that
    // is under way, so a visitor who keeps scrolling keeps moving instead of
    // waiting the walk out, and the station asked for is never lost.
    h.stage.addEventListener('wheel',(e)=>{if(e.ctrlKey||e.defaultPrevented||(e.target as Element).closest('.vinci-dock,.wing-rail-group,.vinci-exhibit-card'))return;e.preventDefault();const step=wheelStep(e.deltaY,e.deltaMode,innerHeight);if(!step)return;rail.stride(1);h.navigate(station+step)},{...options,passive:false})
    h.stage.addEventListener('pointerdown',(e)=>{if(!e.isPrimary||e.button!==0||(e.target as Element).closest('button,a,input,textarea,select,.vinci-dock,.wing-rail-group,.vinci-exhibit-card'))return;e.preventDefault();dragging=true;pointer=e.pointerId;touchX=lastX=e.clientX;touchY=lastY=e.clientY;h.stage.setPointerCapture(e.pointerId)},options)
    h.stage.addEventListener('pointermove',(e)=>{if(!dragging||pointer!==e.pointerId)return;rail.drag(e.clientX-lastX,e.clientY-lastY,h.stage.getBoundingClientRect().height);lastX=e.clientX;lastY=e.clientY},options)
    // A PRESS IS A PRESS, NOT A DRAG AND NOT A SWIPE. A flick on the phone is
    // still a station, a drag is still a look, and what is left is one ray.
    h.stage.addEventListener('pointerup',(e)=>{
      if(!dragging||pointer!==e.pointerId)return
      dragging=false;pointer=-1
      const dx=e.clientX-touchX,dy=e.clientY-touchY
      if(e.pointerType==='touch'&&Math.abs(dy)>65&&Math.abs(dy)>Math.abs(dx)*1.3){h.navigate(station+(dy<0?1:-1));return}
      if(Math.hypot(dx,dy)<=8)pressExhibit(e.clientX,e.clientY)
    },options)
    const cancelDrag=()=>{dragging=false;pointer=-1}
    h.stage.addEventListener('pointercancel',cancelDrag,options)
    h.stage.addEventListener('lostpointercapture',cancelDrag,options)
    window.addEventListener('keydown',(e)=>{
      if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return
      const target=e.target instanceof Element?e.target:document.body
      if(document.querySelector('dialog[open]'))return
      if(target.closest('input,textarea,select,[contenteditable="true"]'))return
      // THE READER OWNS ITS OWN KEYS. Nothing typed inside an open exhibit
      // walks the rail or cycles the label layer, and Escape is one step back.
      if(closeLook?.id&&(e.key==='Escape'||closeLook.owns(target))){
        if(e.key==='Escape'){e.preventDefault();closeLook.close()}
        return
      }
      if(e.key==='Escape'){e.preventDefault();mode=1;rail.look(0,0);paintDock();source.focus({preventScroll:true});return}
      if(e.key.toLowerCase()==='l'&&!e.repeat){e.preventDefault();mode=((mode+1)%3) as VinciLabelMode;paintDock();if(mode!==2&&target.closest('.vinci-dock'))source.focus({preventScroll:true});return}
      if(target.closest('.vinci-dock'))return
      if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();h.navigate(station+1)}
      if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();h.navigate(station-1)}
    },options)
    window.addEventListener('resize',()=>{placeCanonicalStation();paintDock()},options)
    standing=true
    plates=stack.materials.pending()
    card=station
    const s=vinciContent[card]!
    aimPrint(s.id);exposureAt=s.id;rail.set(s.id,stationPose(s.id,narrow()),true,narrow());paintHeader();paintDock()
    if(pendingView){const id=pendingView;pendingView='';showView(id)}
    // THE PANEL IS FOR A VISITOR. The eyes arrive through the forge marker and
    // a sheet over the arrival frame would stand in every frame they shoot.
    if(!document.body.classList.contains('forge')&&!vinciWelcomeSeen()&&card===0)welcome?.open()
  }
  /** The bar carries the walk, so the hand lands there when a sheet closes. */
  function focusTheBar():void {
    const group=hosts?.stage.parentElement?.querySelector('.wing-rail-group')
    const mark=group?.querySelector<HTMLElement>('.wing-step[aria-current="true"]')??group?.querySelector<HTMLElement>('.wing-step')
    mark?.focus({preventScroll:true})
  }
  /** The certified cut to the collection's first station, with its own card.
   * The frame is told first, so the bar, the hash and the question follow. */
  function enterCollection():void {
    const index=vinciContent.findIndex(station=>station.group==='collection')
    if(index<0||!hosts)return
    const id=vinciContent[index]!.id
    hosts.navigate(index)
    exhibits?.warm()
    rail.set(id,stationPose(id,narrow()),true,narrow())
    station=card=index;activeView='';aimPrint(id);exposureAt=id;paintHeader();paintDock();paintQuestion()
  }
  /** True once the rail's own geometry proof has resolved: before that the
   * rail cannot walk a certified route, so a station is placed instead. */
  const railReady=()=>authority?.status==='verified'
  /** A station is WALKED to when a visitor asks for it. Two callers are not
   * a visitor: the rail's proof is not verified yet, or an address is being
   * composed as a still (the marker the eye writes while it lands a state),
   * which is a cut to a station and never a walk through the gate. */
  const cutToStation=()=>!railReady()||document.body.dataset['forge']==='pending'
  // Named inspection entry and return are paired deliberate placements.
  // Their off-rail eye never becomes the start of an animated station route.
  /** A named composition at the standing station. Asked for before the place
   * is built it is remembered, so the eye never shoots the plain station
   * believing it shot a corner. */
  let pendingView=''
  function showView(id:string) {
    if(id==='welcome'){welcome?.open();return}
    if(id.startsWith('sources-')){const tab=id.slice(8);if(tab==='station'||tab==='room'||tab==='wing'){sources.select(tab);mode=2;paintDock();return}}
    const inspectCost=id.endsWith('-cost')&&id!=='audit-cost';if(inspectCost)id=id.slice(0,-5);const s=vinciContent[card]!;
    // THE EYES REACH ONE EXHIBIT BY NAME: the arrival, the leg on the way to
    // it, and the return. A still is a cut; the leg and the return are walked.
    if(id.startsWith('exhibit-')){
      let work=id.slice(8),how:'walk'|'cut'='cut',back=false
      if(work.endsWith('-leg')){work=work.slice(0,-4);how='walk'}
      else if(work.endsWith('-return')){work=work.slice(0,-7);back=true}
      if(!picks.length)refreshExhibits()
      const target=picks.find(pick=>pick.openable&&pick.workId===work&&pick.face==='front')
      if(target){
        closeLook?.close();placeCanonicalStation()
        openExhibit(target.id,null,how)
        if(back)closeLook?.close()
        if(inspectCost)measurement.show(`${s.id} / ${id}`)
      }
      return
    }if(id==='scene')endInspection();if(id==='scene'||id.startsWith('audit-'))rail.look(0,0);if(id==='scene'||id==='audit-cost'){mode=1;paintDock()}if(id==='audit-cost')measurement.show(s.id);if(id==='audit-ui'){mode=1;paintDock();measurement.show(s.id,'ui')}if(id==='audit-ui-labels'){mode=2;paintDock();measurement.show(s.id,'ui')}if(id.startsWith('collection-room')||id.startsWith('collection-hang'))exhibits?.warm()
    const pose=namedPose(id,narrow())??collectionView(id,narrow());if(pose){activeView=id;mode=1;paintDock();rail.set(s.id,pose,true,narrow());header.querySelector('.vinci-insertion')?.remove();titleForView(id);if(id.startsWith('collection')&&!s.built&&!vinciStandsInRoom(s.id))header.append(make('p','vinci-insertion',lang()==='de'?'Museumseinbau der Gegenwart · Räume im Bau':'Modern museum insertion · Rooms in construction'))}const cone=/(?:^|-)cone-(ul|ur|dl|dr)$/.exec(id);if(cone){placeCanonicalStation();rail.look(cone[1]!.includes('l')?.6:-.6,cone[1]!.startsWith('u')?.32:-.32)}if(id==='labels'||id==='hour'||id==='record'){sources.select(id==='hour'?'wing':'station');mode=2;paintDock();if(id==='record'){if(record.hidden)dock.querySelector<HTMLButtonElement>('.vinci-record-toggle')?.click();dock.scrollTop=record.offsetTop-(dock.querySelector('.vinci-sources-toolbar')?.getBoundingClientRect().height??0)-18}}if(inspectCost&&(pose||cone))measurement.show(`${s.id} / ${id}`)
  }
  /** THE REGISTRY IS A READ, so it is taken again whenever the scene it reads
   * could have changed: when the room's own sources have landed, and when a
   * tier change remounts the plates under new meshes. */
  function refreshExhibits():void {
    if(!hosts||!collectionRoot)return
    picks=readVinciExhibits(collectionRoot)
    picksTier=hosts.world.stack.tierName()
    paintExhibitMarks()
  }
  /** What each exhibit's mark says and what colour it carries: its own name
   * and its own certainty, both off the picture module's register. */
  function paintExhibitMarks():void {
    const sources=exhibits?.pictureSources()??[]
    const marks:VinciExhibitMark[]=[]
    for(const entry of picks){
      if(!entry.openable)continue
      const found=sources.find(source=>source.work.id===entry.workId)
      if(!found)continue
      const entries=sources.filter(source=>source.work.id===entry.workId).map(source=>source.entry)
      marks.push({id:entry.id,anchor:entry.anchor,object:entry.object,
        label:lang()==='de'?found.work.title_de:found.work.title_en,
        colour:policyLabelText(found.work,entries).colour})
    }
    dots?.setExhibits(marks)
  }
  /** The wing's own certainty word for a picture, read off the picture
   * module's own key so the two cannot drift. */
  function pictureCertainty(colour:string):VinciCertainty {
    const order:VinciCertainty[]=['documented','unknown','reconstructed','conjectural']
    const at=PICTURE_CERTAINTY_KEY.findIndex(entry=>entry.colour===colour)
    return order[at<0?2:at]!
  }
  /** WHEN OPENING IS A MOVE OF THE BODY. On calm the stream raises no full
   * plate and the card is the whole close look; under reduced motion a view
   * changes without a walk; at an inspection eye there is no station to leave. */
  function exhibitWalks():boolean {
    if(!hosts||activeView||!railReady())return false
    if(hosts.world.stack.tierName()==='calm')return false
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return false
    const nav=rail.navigation
    return !nav.active&&!nav.exhibit
  }
  /** ONE RAY ON A PRESS, never on a hover. */
  function pressExhibit(x:number,y:number):void {
    if(!hosts||!picks.length||closeLook?.id)return
    const rect=hosts.stage.getBoundingClientRect()
    if(rect.width<=0||rect.height<=0)return
    pickRay.setFromCamera(new Vector2((x-rect.left)/rect.width*2-1,-((y-rect.top)/rect.height)*2+1),hosts.world.camera)
    const hit=pickVinciExhibit({ray:pickRay,entries:picks,
      occluded:(from,to)=>vinciSightBlocked(from,to,occluders,sightRay,sightHits)})
    if(hit)openExhibit(hit.id,null)
  }
  /** The record is opened on purpose, into the window the wing already has for
   * a source: one sources window, never a second one over the card. */
  function showExhibitRecord(id:string,work:Parameters<typeof createPictureRecord>[0],entries:Parameters<typeof createPictureRecord>[1]):void {
    const record=createPictureRecord(work,entries)
    record.hidden=false
    exhibitSources={id,title:{en:work.title_en,de:work.title_de},
      certainty:pictureCertainty(policyLabelText(work,entries).colour),
      renderStation(host){host.append(record)}}
    sources.resetScroll();sources.select('station');mode=2;paintDock()
  }
  /** THE CARD IS THE PICTURE MODULE'S OWN LABEL, mounted as it is, with two
   * controls under it and the station's own question at its foot. */
  function openExhibit(id:string,from:HTMLElement|null,how:'auto'|'walk'|'cut'='auto'):void {
    const entry=picks.find(pick=>pick.id===id)
    if(!entry?.openable||!hosts||!closeLook)return
    if(entry.station!==vinciContent[card]!.id)return
    const sources=exhibits?.pictureSources()??[]
    const found=sources.find(source=>source.work.id===entry.workId)
    if(!found)return
    const work=found.work
    const entries=sources.filter(source=>source.work.id===entry.workId).map(source=>source.entry)
    const plate=entries.find(source=>source.face===entry.face)??entries[0]
    const label=createPolicyWorkLabel(work,entries,false,[],narrow())
    const controls:HTMLElement[]=[]
    if(plate){
      // E4 BUILDS THE PLATE VIEW. Until it does, the whole plate is the
      // admitted file itself, which is the control the wing already carries.
      const whole=make('a','vinci-exhibit-control',lang()==='de'
        ? plate.face==='reverse'?'Vollständige Reproduktion der Rückseite öffnen':'Vollständige Reproduktion öffnen'
        : plate.face==='reverse'?'Open the complete reverse reproduction':'Open the complete reproduction')
      whole.href=ASSET_BASE+validatePaintingRecord(plate.plate,'painting-plate').path
      whole.target='_blank';whole.rel='noopener'
      controls.push(whole)
    }
    const record=make('button','vinci-exhibit-control',lang()==='de'?'Vollständiger Nachweis':'Full record')
    record.type='button'
    record.addEventListener('click',()=>showExhibitRecord(id,work,entries))
    const shut=make('button','vinci-exhibit-control',lang()==='de'?'Schließen':'Close')
    shut.type='button'
    shut.addEventListener('click',()=>closeLook?.close())
    controls.push(record,shut)
    openMode=how
    closeLook.open({id,title:lang()==='de'?work.title_de:work.title_en,label,
      question:text(vinciContent[card]!.door),controls},from)
    openMode='auto'
  }
  /** The door asks about the place the visitor is standing in, so the
   * question travels with the card and not with the rail mark. */
  function paintQuestion() {
    const q=hosts?.stage.parentElement?.querySelector('.wing-question')
    if(q)q.textContent=text(vinciContent[card]!.door)
  }
  function paintHeader() {
    const index=card,s=vinciContent[index]!
    header.textContent=''
    const title=make('h1','vinci-title')
    const dot=make('span','vinci-title-dot');dot.dataset['certainty']=s.built?s.carrierCertainty:'unknown'
    dot.setAttribute('role','img');dot.setAttribute('aria-label',text(vinciCertaintyWords[s.built?s.carrierCertainty:'unknown']))
    title.append(dot,make('span','vinci-title-name',text(s.name)))
    header.append(make('p','vinci-kicker',stationKicker()),title)
    if(s.outdoor)header.append(make('p','vinci-hour',text(vinciHourSpoken)))
    // A STATION THAT STANDS IN A ROOM DOES NOT COVER IT. The centred panel
    // belongs to the stations that are still a plate; where the room is
    // built, the card docks to the side and the room is the frame.
    const standing=vinciStandsInRoom(s.id)
    header.classList.toggle('vinci-standing',standing)
    if(!s.outdoor){header.classList.toggle('vinci-construction',!standing&&!s.built);if(!standing&&!s.built)header.append(make('p','vinci-status',text(vinciConstructionStatus)))}
    else header.classList.remove('vinci-construction')
    // THE CARD SPEAKS AT EVERY STATION, indoors and out. The three outdoor
    // stations used to carry a title and the hour and nothing that said what
    // the visitor was looking at.
    header.append(make('p','vinci-promise',text(s.promise)))
    paintExhibitTitle()
  }
  /** The card names what the frame holds: a sub-view carries its own title.
   * THE NUMBER COUNTS STATIONS. Two frames could otherwise read the same
   * count under two titles, so a named sub-view drops the count and says
   * which station it is a view from. */
  function titleForView(viewId:string) {
    const s=vinciContent[card]!
    const name=vinciViewNames[viewId]??(viewId.startsWith('collection')?vinciViewNames['collection']:undefined)
    const h1=header.querySelector('.vinci-title-name')
    if(h1)h1.textContent=text(name??s.name)
    const kicker=header.querySelector('.vinci-kicker')
    if(kicker)kicker.textContent=name?viewKicker():stationKicker()
  }
  /** ONE CARD AT A TIME ON A NARROW STAGE. The room's card stands beside the
   * exhibit's on the wide one and would cover it on the phone. */
  function paintHeaderVisibility():void {
    if(header)header.hidden=mode===2||(narrow()&&Boolean(closeLook?.id))
  }
  /** AN APPROACH EYE IS NEVER A STATION. It stands in the station's own room
   * and carries the sub-view kicker the wing already writes for a view. */
  function paintExhibitTitle():void {
    const kicker=header?.querySelector('.vinci-kicker')
    if(kicker)kicker.textContent=closeLook?.id?viewKicker():activeView?viewKicker():stationKicker()
  }
  const stationNumber=()=>String(card+1).padStart(2,'0')
  const stationKicker=()=>`CLOS LUCE, 1517 · ${stationNumber()} / 19`
  const viewKicker=()=>`CLOS LUCE, 1517 · ${lang()==='de'?'BLICK VON STATION':'A VIEW FROM STATION'} ${stationNumber()}`
  function aimPrint(id:VinciStationId):void {
    if(!hosts)return
    const {scene,camera,stack}=hosts.world
    stack.setScene(scene,camera,{...PRINT,exposure:STATION_EXPOSURE[id]??PRINT.exposure})
  }
  function placeCanonicalStation() {
    const id=vinciContent[card]!.id
    activeView='';measurement.hide();header.querySelector('.vinci-insertion')?.remove();titleForView('')
    rail.set(id,stationPose(id,narrow()),true,narrow())
  }
  function endInspection() { if(activeView)placeCanonicalStation() }
  function appendRecord(value:VinciText,citation:string,certainty?:VinciCertainty,anchorId?:string,anchorClass?:'GENERATED'|'procedural'):[HTMLElement,HTMLElement] {
    const p=make('p','vinci-statement')
    if(certainty){
      p.dataset['certainty']=certainty
      p.dataset['naClaim']=certainty==='documented'?'documented':certainty==='conjectural'?'tradition':certainty==='unknown'?'':'inferred'
      if(anchorId)p.dataset['naAnchor']=anchorId
      if(anchorClass)p.dataset['naAnchorClass']=anchorClass
      p.append(make('span','vinci-certainty-word',text(vinciCertaintyWords[certainty])))
    }
    p.append(document.createTextNode(text(value)))
    const citationNode=make('small','vinci-citation',citation)
    record.append(p,citationNode)
    return [p,citationNode]
  }
  function appendStatement(value:VinciText,certainty:VinciCertainty,anchorId:string,anchorClass:'GENERATED'|'procedural',citation:string,full:VinciText=value,humanSource?:VinciText):void {
    const p=make('p','vinci-statement')
    p.dataset['certainty']=certainty
    p.dataset['naClaim']=certainty==='documented'?'documented':certainty==='conjectural'?'tradition':certainty==='unknown'?'':'inferred'
    p.dataset['naAnchor']=anchorId;p.dataset['naAnchorClass']=anchorClass
    p.append(make('span','vinci-certainty-word',text(vinciCertaintyWords[certainty])),document.createTextNode(' '+text(value)))
    if(humanSource)p.append(make('span','vinci-human-source',text(humanSource)))
    drawer.append(p)
    appendRecord(full,citation,certainty,anchorId,anchorClass)
  }
  function appendEvidence(key:string,value:VinciText,certainty:VinciCertainty,anchorId:string,citation:string):void {
    appendStatement(evidenceWords[key]!,certainty,anchorId,'GENERATED',citation,value)
  }
  function appendLabel(label:VinciStatement):void {
    const carrier=label.id==='planting-assumptions'?'vinci/vegetation':label.id==='weather-assumptions'?'vinci/sky':'vinci/shell'
    appendStatement(label,label.certainty,label.target==='carrier'?carrier:`vinci/source/${label.id}`,label.target==='carrier'?'GENERATED':'procedural',label.source,label.record??label,label.humanSource)
  }
  /** The spoken half stands on the surface, the machine chain goes to the
   * record the tab folds away, so a source key never meets an unasked eye. */
  function appendSourceStatement(host:HTMLElement,label:VinciStatement,into?:HTMLElement):void {
    const paragraph=make('p','vinci-statement')
    paragraph.dataset['certainty']=label.certainty
    paragraph.append(make('span','vinci-certainty-word',text(vinciCertaintyWords[label.certainty])),document.createTextNode(' '+text(label)))
    if(label.humanSource)paragraph.append(make('span','vinci-human-source',text(label.humanSource)))
    const full=make('div','vinci-record');setRegister(full,'record')
    full.append(make('p','vinci-statement',text(label.record??label)),make('small','vinci-citation',label.source))
    host.append(paragraph)
    ;(into??host).append(full)
  }
  function appendCertaintyLegend(host:HTMLElement):void {
    const legend=make('ul','vinci-certainty-legend')
    for(const certainty of Object.keys(vinciCertaintyWords) as VinciCertainty[]){
      const item=make('li',''),dot=make('span','vinci-title-dot')
      dot.dataset['certainty']=certainty;dot.setAttribute('aria-hidden','true')
      item.append(dot,document.createTextNode(text(vinciCertaintyWords[certainty])));legend.append(item)
    }
    host.append(legend)
  }
  /** THE RECORD IS OPENED ON PURPOSE. Inline it puts source keys and licence
   * lines in front of a visitor who asked for the room, so each tab folds its
   * own record behind one control. */
  function foldRecord(host:HTMLElement,full:HTMLElement):void {
    const details=make('details','vinci-record-fold')
    const summary=document.createElement('summary')
    summary.textContent=lang()==='de'?'Vollständiger Nachweis':'Full record'
    details.append(summary,full)
    host.append(details)
  }
  const ROOM_CLASS_WORD:Record<PictureRights,VinciText>={DG:vinciSourcesHeadings.classShown,
    RC:vinciSourcesHeadings.classUnderReview,REF:vinciSourcesHeadings.classReference}
  /** What stands in the room, one line per exhibit with the collection that
   * holds it and the class its reproduction was given. */
  function appendRoomExhibits(host:HTMLElement,id:VinciStationId):void {
    const works=id==='picture-room'?MAIN_HANG:id==='supper-wall'?REGISTER.filter(w=>w.hang.wall==='supper-wall'):[]
    // The hall is one room under three stations, so its machines are listed once.
    const machines=id==='flight'?MACHINE_SLUGS:[]
    if(!works.length&&!machines.length)return
    host.append(make('h3','',text(vinciSourcesHeadings.inThisRoom)))
    const list=make('ul','vinci-room-list')
    for(const work of works)list.append(make('li','',`${lang()==='de'?work.title_de:work.title_en} · ${work.holder} · ${text(ROOM_CLASS_WORD[work.rights_class])}`))
    for(const slug of machines){const machine=machineCatalog[slug];list.append(make('li','',`${text(machine.title)} · ${text(machine.label)}`))}
    host.append(list)
  }
  /** ABSENCE IS A SENTENCE. It stands here, with its holder and its reason,
   * and never as a frame on a wall. */
  function appendAbsences(host:HTMLElement,id:VinciStationId):void {
    const absences=vinciAbsences[id]
    if(!absences?.length)return
    host.append(make('h3','',text(vinciSourcesHeadings.elsewhere)))
    const list=make('ul','vinci-absence-list')
    for(const absence of absences){
      const item=make('li','')
      item.append(make('span','vinci-absence-work',`${text(absence.work)} · ${text(absence.holder)}`),
        document.createTextNode(' '+text(absence.reason)))
      list.append(item)
    }
    host.append(list)
  }
  /** The text seat can expand these room records without changing the window. */
  function paintRoomSources():void {
    const panel=sources.panels.room;panel.textContent=''
    if(exhibitSources?.renderRoom){exhibitSources.renderRoom(panel);return}
    for(const id of vinciRoomStationIds(vinciContent[card]!.id)){
      const station=vinciContent.find(s=>s.id===id)!
      const section=make('section','vinci-room-source')
      section.append(make('h2','',text(station.name)),make('p','vinci-promise',text(station.promise)))
      const full=make('div','vinci-record');setRegister(full,'record')
      for(const label of station.labels)appendSourceStatement(section,label,full)
      full.append(make('p','vinci-statement',text(station.record??station.promise)),make('small','vinci-citation',station.promiseSource))
      const sources=exhibits?.pictureSources()??[]
      if(id==='picture-room'||id==='supper-wall'){
        const works=new Map(sources.filter(({work})=>(work.id==='last-supper')===(id==='supper-wall')).map(({work})=>[work.id,work]))
        for(const work of works.values())full.append(createPolicyWorkLabel(work,sources.filter(source=>source.work.id===work.id).map(source=>source.entry),true))
      }
      appendRoomExhibits(section,id);appendAbsences(section,id);foldRecord(section,full);panel.append(section)
    }
  }
  function paintWingSources(credits:readonly HTMLElement[]):void {
    const panel=sources.panels.wing;panel.textContent=''
    const full=make('div','vinci-record');setRegister(full,'record')
    appendSourceStatement(panel,vinciReconstruction,full)
    appendSourceStatement(panel,vinciCollectionThreshold,full)
    appendSourceStatement(panel,vinciHourLabel,full)
    appendSourceStatement(panel,vinciHourIntegrity,full)
    panel.append(make('h3','',text(vinciSourcesHeadings.grounds)))
    for(const ground of vinciGrounds)panel.append(make('p','vinci-statement',text(ground)))
    panel.append(make('h3','',text(vinciSourcesHeadings.policy)),make('p','vinci-statement',text(vinciRightsPolicy)))
    panel.append(make('h3','',text(vinciSourcesHeadings.counted)),make('p','vinci-statement',text(vinciWingCounts)))
    full.append(make('pre','vinci-arithmetic',text(vinciHourArithmetic)),...credits.map(node=>node.cloneNode(true)))
    foldRecord(panel,full);appendCertaintyLegend(panel)
    panel.append(make('p','vinci-door-disclosure',text(WING_TEXT.doorNote)))
  }
  function paintDock() {
    if(!hosts)return
    const s=vinciContent[card]!,scroll=dock.scrollTop
    const focused=dock.contains(document.activeElement)?document.activeElement as HTMLElement:null
    const recordOpen=dock.dataset['station']===s.id&&record?.isConnected&&!record.hidden
    paintHeaderVisibility()
    const camera=hosts.world.camera
    dock.dataset['station']=s.id
    // Opening Sources changes presentation only, inside the same proven lens.
    camera.zoom=1;camera.clearViewOffset();camera.updateProjectionMatrix()
    sources.setOpen(mode===2)
    labels.setMode(mode)
    const collectionView=activeView.startsWith('collection')
    const entryAnchor=entryInspectionAnchors[activeView]
    labels.setAnchor(materialInspectionAnchors[activeView]??entryAnchor??(activeView==='collection-court-access'?world(...collectionAccessPoint(1.05,.65),-.46):collectionView?world(-21.92,-33.92,narrow()?-5.85:-3.2):s.outdoor?anchors[s.id]??null:null),`${text(vinciCertaintyWords.reconstructed)} · ${entryAnchor?(lang()==='de'?'Vorgeschlagene Eingangsstruktur':'Proposed entrance structure'):collectionView?(lang()==='de'?'Museumseinbau der Gegenwart':'Modern museum insertion'):text(s.name)}`)
    drawer.textContent=''
    record=make('div','vinci-record');setRegister(record,'record');record.id='vinci-full-record';record.hidden=true;record.append(make('h3','',lang()==='de'?'Vollständiger Nachweis':'Full record'))
    const certainty=exhibitSources?.certainty??(s.built?s.carrierCertainty:'unknown')
    const title=make('p','vinci-certainty',text(vinciCertaintyWords[certainty]))
    title.dataset['certainty']=certainty
    if(s.outdoor&&!exhibitSources){title.dataset['naClaim']='inferred';title.dataset['naAnchor']='vinci/shell';title.dataset['naAnchorClass']='GENERATED'}
    drawer.append(title,make('h2','',text(exhibitSources?.title??s.name)))
    for(const label of s.labels)appendLabel(label)
    if(!s.labels.includes(vinciReconstruction))appendLabel(vinciReconstruction)
    drawer.append(make('p','vinci-promise',text(s.promise)));appendRecord(s.record??s.promise,s.promiseSource)
    if(s.id==='picture-room'||s.id==='supper-wall'){
      const sources=exhibits?.pictureSources()??[]
      const works=new Map(sources.filter(({work})=>(work.id==='last-supper')===(s.id==='supper-wall')).map(({work})=>[work.id,work]))
      for(const work of works.values()){
        const entries=sources.filter(source=>source.work.id===work.id).map(source=>source.entry)
        const label=createPolicyWorkLabel(work,entries,true)
        setRegister(label,'record')
        for(const entry of entries){
          const complete=make('a','vinci-picture-source',lang()==='de'
            ? entry.face==='reverse'?'Vollständige Reproduktion der Rückseite öffnen':'Vollständige Reproduktion öffnen'
            : entry.face==='reverse'?'Open the complete reverse reproduction':'Open the complete reproduction')
          complete.href=ASSET_BASE+validatePaintingRecord(entry.plate,'painting-plate').path
          complete.target='_blank';complete.rel='noopener'
          label.append(complete)
        }
        record.append(label)
      }
    }
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
    const wingCredits=[
      ...appendRecord({en:'© OpenStreetMap contributors · ODbL 1.0. IGN · Licence Ouverte 2.0. Geometry and surfaces: procedural reconstruction.',de:'© OpenStreetMap-Mitwirkende · ODbL 1.0. IGN · Licence Ouverte 2.0. Geometrie und Oberflächen: prozedurale Rekonstruktion.'},'OpenStreetMap · IGN'),
      ...appendRecord({en:'CC0 1.0 · ambientCG · stone-tuffeau, earth-packed, grass-short. Library material surrogates; no site photography sampled.',de:'CC0 1.0 · ambientCG · stone-tuffeau, earth-packed, grass-short. Materialersatz aus der Bibliothek. Keine Standortfotografie als Textur verwendet.'},'CC0 material library'),
      ...appendRecord({en:'Assumed dimensions: brick 0.22–0.27 × 0.035–0.055 m; wall 0.45–0.80 m; main eaves 7.0–8.4 m. Basis: BUILDING-DOSSIER, Q001/Q124/Q127.',de:'Angenommene Maße: Ziegel 0.22–0.27 × 0.035–0.055 m; Mauer 0.45–0.80 m; Haupttraufe 7.0–8.4 m. Grundlage: BUILDING-DOSSIER, Q001/Q124/Q127.'},'brief/BUILDING-DOSSIER.md'),
    ]
    const recordButton=make('button','vinci-record-toggle',lang()==='de'?'Vollständiger Nachweis':'Full record')
    recordButton.id='vinci-record-toggle'
    record.hidden=!recordOpen
    recordButton.type='button';recordButton.setAttribute('aria-controls',record.id);recordButton.setAttribute('aria-expanded',String(!!recordOpen))
    recordButton.addEventListener('click',()=>{record.hidden=!record.hidden;recordButton.setAttribute('aria-expanded',String(!record.hidden))})
    drawer.insertBefore(recordButton,drawer.children[2]??null);recordButton.after(record)
    if(exhibitSources){drawer.replaceChildren(title,make('h2','',text(exhibitSources.title)));exhibitSources.renderStation(drawer)}
    appendCertaintyLegend(drawer)
    drawer.append(make('p','vinci-door-disclosure',text(WING_TEXT.doorNote)))
    paintRoomSources()
    paintWingSources(wingCredits)
    dock.scrollTop=scroll
    if(dock.open&&focused&&!focused.isConnected){
      const replacement=focused.id?document.getElementById(focused.id):null
      if(replacement&&dock.contains(replacement))replacement.focus({preventScroll:true})
      else sources.select(sources.tab,true)
    }
  }
  return {
    stations:vinciContent.map(s=>({id:s.id,name:text(s.name),question:text(s.door)})),
    legacyStationIds:vinciLegacyStationIds,
    doorDisclosure:'first-press',
    openSources(tab='station'){if(!standing){pendingView=`sources-${tab}`;return}sources.select(tab);mode=2;paintDock()},
    setExhibitSources(exhibit){exhibitSources=exhibit;if(standing){sources.resetScroll();paintDock()}},
    // NO MACHINE ANIMATES WHILE THE VISITOR WALKS. A close look names the one
    // machine whose own clock may run; null puts every machine back at rest.
    demonstrateMachine(slug:string|null){exhibits?.demonstrate(isMachineSlug(slug??'')?slug as MachineSlug:null)},
    navigation:()=>{
      const nav=standing?rail.navigation:undefined
      return {completed:nav?.completed??vinciContent[card]!.id,target:nav?.queued[0]??nav?.active,question:text(vinciContent[card]!.door)}
    },
    pending:()=>exhibits?.pending()??0,
    errors:()=>exhibits?.pictureErrors()??[],
    manifest:()=>[...new Map((exhibits?.pictureSources()??[]).flatMap(({entry})=>[entry.preview,entry.plate]).map(entry=>[entry.id,entry])).values()],
    show(index,h){
      if(!hosts){mount(h);station=card=index;paintHeader();schedule();return}
      // A station asked for before the place is built is remembered, not lost.
      if(!standing){station=card=index;paintHeader();return}
      const closeSources=mode===2
      if(closeSources)mode=1
      // THE STATION RAIL STAYS LIVE. Pressing a station closes the exhibit and
      // the rail walks from the station eye, which is the certified pair.
      closeLook?.close()
      exhibitSources=null;endInspection();if(station!==index)sources.resetScroll();station=index;activeView='';measurement.hide()
      const s=vinciContent[index]!,cut=cutToStation()
      rail.set(s.id,stationPose(s.id,narrow()),cut,narrow())
      // On a walk the card changes when the visitor arrives, not when the
      // rail mark is pressed: a title that names the next room over the room
      // you are still standing in is a lie the frame tells.
      if(cut||rail.navigation.completed===s.id){card=index;dock.scrollTop=0;aimPrint(s.id);exposureAt=s.id;paintHeader();paintDock()}
      else if(closeSources)paintDock()
    },
    view(id){if(!standing){pendingView=id;return}showView(id)},
    look(y,p){if(standing)rail.look(y,p)},
    update(){
      if(!hosts)return
      if(!standing)return
      if(sign){
        // The hairline is a measure, not a spinner: it is the share of the
        // place's own plates that has landed.
        const left=hosts.world.stack.materials.pending()
        plates=Math.max(plates,left)
        const done=plates?1-left/plates:1
        sign.style.setProperty('--vinci-opening',String(done))
        if(!left&&railReady()){sign.remove();sign=undefined}
      }
      measurement.update();rail.update()
      if(exhibits){const now=hosts.world.clock();exhibits.update(now,Math.max(0,Math.min(.25,now-exhibitClock)),hosts.world.camera.position);exhibitClock=now}
      // THE CARD NAMES THE STATION THE WALKER IS IN. It hands over at the
      // half of the leg, by walked distance: before that the walker is still
      // in the room they left, after it they are in the one they are entering,
      // and no panel outlives the station it belongs to. The exposure still
      // changes on arrival, where the eye is at rest.
      const nav=rail.navigation
      const here=nav.active&&nav.legWalked>=CARD_HANDOVER?nav.active:nav.completed
      if(here&&here!==vinciContent[card]!.id&&!activeView){
        const arrived=vinciContent.findIndex(s=>s.id===here)
        if(arrived>=0){card=arrived;dock.scrollTop=0;paintHeader();paintDock();paintQuestion()}
      }
      if(nav.completed&&nav.completed!==exposureAt){exposureAt=nav.completed;aimPrint(nav.completed)}
      focusNearCascade();shadowBody?.update();shadowCache?.update();sky.position.copy(hosts.world.camera.position)
      // A REMOUNTED PLATE IS A NEW MESH. The registry is a read, so it is
      // taken again when a tier change has replaced what it read.
      if(picks.length&&(picksTier!==hosts.world.stack.tierName()||!picks[0]!.object.parent))refreshExhibits()
      const reading=closeLook?.id?closeLook.element.getBoundingClientRect():dock.open?dock.getBoundingClientRect():null
      labels.update(reading)
      dots?.setLimit(DOTS_PER_TIER[hosts.world.stack.tierName()]??6)
      dots?.update(reading)},
    stop(){if(scheduled)cancelAnimationFrame(scheduled);scheduled=0;standing=false;exhibits?.dispose();exhibits=undefined;sign=undefined;shadowBody?.dispose();shadowBody=undefined;shadowCache?.dispose();shadowCache=undefined;restoreEnvironmentRotation?.();restoreEnvironmentRotation=null;controller?.abort();closeLook?.dispose();closeLook=undefined;dots?.dispose();dots=undefined;picks=[];picksTier='';occluders=[];collectionRoot=undefined;welcome?.dispose();welcome=undefined;sources?.dispose();source?.remove();labels?.dispose();measurement?.dispose();water?.dispose();hosts?.world.scene.traverse(o=>{if(o instanceof DirectionalLight&&o!==key?.light)o.dispose()});key?.dispose();if(hosts){hosts.world.scene.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});hosts.world.scene.clear();delete hosts.stage.parentElement!.dataset['wing'];if(labelHostHidden===null)hosts.labels.removeAttribute('aria-hidden');else hosts.labels.setAttribute('aria-hidden',labelHostHidden)}hosts=undefined},
  }
}
