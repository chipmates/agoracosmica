import { Color, FogExp2, DirectionalLight, Mesh, type Vector3, type Group } from 'three/webgpu'
import { mix, vec3, vec4, dot as nodeDot } from 'three/tsl'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import type { WingHosts, WingModule } from '../frame'
import { lang } from '../content'
import { GRADES } from '../../stack/grade'
import { createShell } from './shell'
import { createGround } from './ground'
import { createVegetation } from './vegetation'
import { createRail, stationPose, namedPose } from './rail'
import { createWheelStepper } from './input'
import { dossier, world, hourKey, type Quantity } from './site'
import { gradeAt as groundHeight } from './terrain-mesh'
import { createGroundDressing } from './ground-dressing'
import { createWater, type WaterGroup } from './water'
import { createMeasurement, type VinciMeasurement } from './measurement'
import { collectVinciLabelOccluders, createVinciLabelAnchor, type VinciLabelAnchor, type VinciLabelMode } from './labels'
import { pathSpecifications } from './paths'
import { roadGradeProvenance } from './road-grade'
import { apronProvenance } from './apron'
import { vinciContent, vinciConstructionStatus, vinciThreshold, vinciHourArithmetic, vinciCertaintyWords, vinciPlantingAssumptions, vinciWeatherAssumptions, type VinciCertainty, type VinciStatement, type VinciStationId, type VinciText } from './content'
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

export function createWing():WingModule {
  let hosts:WingHosts|undefined, shell:Group, water:WaterGroup, measurement:VinciMeasurement, labels:VinciLabelAnchor
  let rail:ReturnType<typeof createRail>, key:ReturnType<WingHosts['world']['stack']['light']>
  let station=0, mode:VinciLabelMode=1, controller:AbortController|undefined
  let header:HTMLElement,dock:HTMLElement,source:HTMLButtonElement,sky:SkyMesh
  let labelHostHidden:string|null=null
  const narrow=()=>innerWidth/innerHeight<=.9
  function init(h:WingHosts) {
    // Vinci's interactive source cards need an accessible host only while mounted.
    labelHostHidden=h.labels.getAttribute('aria-hidden');h.labels.removeAttribute('aria-hidden')
    hosts=h;h.stage.textContent='';h.labels.textContent='';h.stage.parentElement!.dataset['wing']='vinci';const style=make('style','');style.textContent=wingCss;h.stage.append(style)
    const {scene,camera,stack,clock}=h.world
    camera.near=.25;camera.updateProjectionMatrix()
    scene.clear();scene.background=new Color('#b3b7ac');scene.fog=new FogExp2('#b8b7a6',.0035)
    stack.setScene(scene,camera,{...GRADES['first-station'],name:'clos-luce-1517',exposure:.94,split:.055,saturation:.9,vignette:.15,grain:.007,bloom:{strength:0,radius:.1,threshold:10,warmth:1}})
    key=stack.light({azimuth:hourKey.sun_azimuth_deg.value,elevation:hourKey.sun_elevation_deg.value,kelvin:4700,lux:320,ambient:.35,reach:100,cascades:[46,90],sky:{zenith:'#8dabc0',horizon:'#d8cbb1',ground:'#514d3b',stars:0}})
    key.fill.color.set('#a5b5bb');key.fill.groundColor.set('#736550');key.fill.intensity=.65;scene.environmentIntensity=.35
    sky=new SkyMesh();sky.material.fog=false;const skyRGB=(sky.material.colorNode as ReturnType<typeof vec4>).rgb;sky.material.colorNode=vec4(mix(vec3(nodeDot(skyRGB,vec3(.2126,.7152,.0722))),skyRGB,.48),1);sky.scale.setScalar(1800);sky.sunPosition.value.copy(key.direction).multiplyScalar(450000);sky.turbidity.value=4;sky.rayleigh.value=1.4;sky.cloudScale.value=.0006;sky.cloudCoverage.value=.28;sky.cloudDensity.value=.42;sky.cloudElevation.value=.35;sky.cloudSpeed.value=0;scene.add(sky)
    shell=createShell(stack.tierName(),stack.materials);scene.add(createGround(stack.tierName(),stack.materials),shell,createVegetation(groundHeight,stack.tierName()),createGroundDressing(groundHeight,stack.tierName()))
    water=createWater(scene,stack);scene.add(water)
    for(const root of scene.children){const id=root===shell?'vinci/shell':root===water?'vinci/water':root===sky?'vinci/sky':root.name.includes('landscape trees')?'vinci/vegetation':root.name.includes('dressing')?'vinci/ground-dressing':'vinci/terrain';root.traverse(o=>{if(o instanceof Mesh){o.userData['manifestId']=id;o.userData['asset']=id}})}
    rail=createRail(camera,clock);measurement=createMeasurement(h.labels,stack)
    header=make('div','vinci-heading');h.stage.append(header)
    source=make('button','vinci-source',lang()==='de'?'Quellen · L':'Sources · L');source.type='button';source.setAttribute('aria-controls','vinci-source-card');source.addEventListener('click',()=>{mode=mode===2?1:2;paintDock();if(mode===2)dock.focus({preventScroll:true})});h.stage.parentElement!.querySelector('.wing-rail-group')!.append(source)
    dock=make('aside','vinci-dock');dock.id='vinci-source-card';dock.tabIndex=0;dock.setAttribute('aria-label',lang()==='de'?'Quellen und Rekonstruktion':'Sources and reconstruction');h.labels.append(dock)
    labels=createVinciLabelAnchor({host:h.labels,camera,occluders:collectVinciLabelOccluders(scene),onOpen:()=>{mode=2;paintDock();dock.focus({preventScroll:true})}})
    controller=new AbortController();const options={signal:controller.signal}
    let touchX=0,touchY=0,lastX=0,lastY=0,dragging=false,pointer=-1
    const wheelStep=createWheelStepper(()=>performance.now())
    h.stage.addEventListener('wheel',(e)=>{if(e.ctrlKey||e.defaultPrevented||(e.target as Element).closest('.vinci-dock,.wing-rail-group'))return;e.preventDefault();const step=wheelStep(e.deltaY,e.deltaMode,innerHeight);if(step)h.navigate(station+step)},{...options,passive:false})
    h.stage.addEventListener('pointerdown',(e)=>{if(!e.isPrimary||e.button!==0)return;dragging=true;pointer=e.pointerId;touchX=lastX=e.clientX;touchY=lastY=e.clientY;h.stage.setPointerCapture(e.pointerId)},options)
    h.stage.addEventListener('pointermove',(e)=>{if(!dragging||pointer!==e.pointerId)return;rail.drag(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY},options)
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
    window.addEventListener('resize',()=>{rail.set(vinciContent[station]!.id,stationPose(vinciContent[station]!.id,narrow()),true);paintDock()},options)
  }
  function appendStatement(value:VinciText,certainty:VinciCertainty,anchorId:string,anchorClass:'GENERATED'|'procedural',citation:string):void {
    const p=make('p','vinci-statement')
    p.dataset['certainty']=certainty
    // The shared label graph has no unknown category. An empty claim reads
    // as null; the visible grey word and local certainty retain the absence.
    p.dataset['naClaim']=certainty==='documented'?'documented':certainty==='conjectural'?'tradition':certainty==='unknown'?'':'inferred'
    p.dataset['naAnchor']=anchorId;p.dataset['naAnchorClass']=anchorClass
    p.append(make('span','vinci-certainty-word',text(vinciCertaintyWords[certainty])),document.createTextNode(' '+text(value)))
    dock.append(p,make('small','vinci-citation',citation))
  }
  function appendLabel(label:VinciStatement):void {
    const carrier=label.id==='planting-assumptions'?'vinci/vegetation':label.id==='weather-assumptions'?'vinci/sky':'vinci/shell'
    appendStatement(label,label.certainty,label.target==='carrier'?carrier:`vinci/source/${label.id}`,label.target==='carrier'?'GENERATED':'procedural',label.source)
  }
  function paintDock() {
    if(!hosts)return
    const s=vinciContent[station]!,scroll=dock.scrollTop
    header.hidden=mode===2
    const camera=hosts.world.camera
    dock.dataset['station']=s.id
    camera.zoom=mode===2&&narrow()&&s.id==='arrival'?.65:1
    if(mode===2&&narrow())camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*(s.id==='arrival'?.29:.20),innerWidth,innerHeight)
    else camera.clearViewOffset()
    dock.hidden=mode!==2;source.setAttribute('aria-expanded',String(mode===2))
    labels.setMode(mode)
    labels.setAnchor(s.outdoor?anchors[s.id]??null:null,`${text(vinciCertaintyWords.reconstructed)} · ${text(s.name)}`)
    dock.textContent=''
    const title=make('p','vinci-certainty',text(s.outdoor?vinciCertaintyWords.reconstructed:vinciConstructionStatus))
    title.dataset['certainty']=s.outdoor?'reconstructed':'unknown'
    if(s.outdoor){title.dataset['naClaim']='inferred';title.dataset['naAnchor']='vinci/shell';title.dataset['naAnchorClass']='GENERATED'}
    dock.append(title,make('h2','',text(s.name)))
    if(!s.outdoor)dock.append(make('p','vinci-promise',text(s.promise)),make('small','vinci-citation',s.promiseSource))
    if(s.id==='arrival'||s.id==='garden')dock.append(make('pre','vinci-arithmetic',text(vinciHourArithmetic)))
    for(const label of s.labels)appendLabel(label)
    if(s.id==='hall'&&!s.labels.some(label=>label.id===vinciThreshold.id))appendLabel(vinciThreshold)
    if(s.id==='arrival'||s.id==='garden'){
      appendLabel(vinciPlantingAssumptions)
      appendLabel(vinciWeatherAssumptions)
      const path=pathSpecifications[s.id==='arrival'?0:1]!
      appendStatement(path.sourceLabel,'conjectural','vinci/path-surfaces','GENERATED',path.alignmentSource.join(' · '))
    }
    if(s.id==='arrival'){
      appendStatement(roadGradeProvenance.label,'reconstructed','vinci/road-grade','GENERATED',roadGradeProvenance.source.join(' · '))
      appendStatement(apronProvenance.label,'reconstructed','vinci/house-side-apron','GENERATED',apronProvenance.source.join(' · '))
    }
    dock.append(make('p','vinci-citation',lang()==='de'?'OSM-Mitwirkende · ODbL 1.0. IGN · Licence Ouverte 2.0. Geometrie und Oberflächen: prozedurale Rekonstruktion.':'© OpenStreetMap contributors · ODbL 1.0. IGN · Licence Ouverte 2.0. Geometry and surfaces: procedural reconstruction.'))
    dock.append(make('p','vinci-citation',lang()==='de'?'CC0 1.0 · ambientCG · stone-tuffeau, earth-packed, grass-short. Materialersatz aus der Bibliothek. Keine Standortfotografie als Textur verwendet.':'CC0 1.0 · ambientCG · stone-tuffeau, earth-packed, grass-short. Library material surrogates; no site photography sampled.'))
    dock.append(make('p','vinci-citation',lang()==='de'?'Angenommene Maße: Ziegel 0.22–0.27 × 0.035–0.055 m; Mauer 0.45–0.80 m; Haupttraufe 7.0–8.4 m. Grundlage: BUILDING-DOSSIER, Q001/Q124/Q127.':'Assumed dimensions: brick 0.22–0.27 × 0.035–0.055 m; wall 0.45–0.80 m; main eaves 7.0–8.4 m. Basis: BUILDING-DOSSIER, Q001/Q124/Q127.'))
    dock.scrollTop=scroll
  }
  return {
    stations:vinciContent.map(s=>({id:s.id,name:text(s.name),question:text(s.door)})),
    show(index,h){const first=!hosts;if(first)init(h);if(station!==index)dock.scrollTop=0;station=index;measurement.hide();const s=vinciContent[index]!;rail.set(s.id,stationPose(s.id,narrow()),first);header.textContent='';header.append(make('p','vinci-kicker',`CLOS LUCE, 1517 · ${String(index+1).padStart(2,'0')} / 19`),make('h1','vinci-title',text(s.name)));if(s.id==='arrival'||s.id==='garden')header.append(make('p','vinci-hour',text(vinciHourArithmetic)));if(!s.outdoor){header.classList.add('vinci-construction');header.append(make('p','vinci-status',text(vinciConstructionStatus)),make('p','vinci-promise',text(s.promise)));if(s.id==='hall')header.append(make('p','vinci-threshold',text(vinciThreshold)))}else header.classList.remove('vinci-construction');paintDock()},
    view(id){const s=vinciContent[station]!;if(id==='scene'||id.startsWith('audit-'))rail.look(0,0);if(id==='scene'||id==='audit-cost'){mode=1;paintDock()}if(id==='audit-cost')measurement.show(s.id);if(id==='audit-ui'){mode=1;paintDock();measurement.show(s.id,'ui')}if(id==='audit-ui-labels'){mode=2;paintDock();measurement.show(s.id,'ui')}const pose=namedPose(id,narrow());if(pose){mode=1;paintDock();rail.set(s.id,pose,true)}const cone=/(?:^|-)cone-(ul|ur|dl|dr)$/.exec(id);if(cone)rail.look(cone[1]!.includes('l')?.6:-.6,cone[1]!.startsWith('u')?.32:-.32);if(id==='labels'||id==='hour'){mode=2;paintDock()}},
    look(y,p){rail?.look(y,p)},
    update(){if(!hosts)return;measurement.update();rail.update();sky.position.copy(hosts.world.camera.position);labels.update(dock.hidden?null:dock.getBoundingClientRect())},
    stop(){controller?.abort();source?.remove();labels?.dispose();measurement?.dispose();water?.dispose();hosts?.world.scene.traverse(o=>{if(o instanceof DirectionalLight&&o!==key?.light)o.dispose()});key?.dispose();if(hosts){hosts.world.scene.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});hosts.world.scene.clear();delete hosts.stage.parentElement!.dataset['wing'];if(labelHostHidden===null)hosts.labels.removeAttribute('aria-hidden');else hosts.labels.setAttribute('aria-hidden',labelHostHidden)}hosts=undefined},
  }
}
