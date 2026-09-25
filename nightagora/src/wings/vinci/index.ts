import { createStaticShadowCache } from './static-shadow-cache'
import { warmWalk, WARM_EXTRA_FRAMES, type WarmWalk } from '../../stack/warm-up'
import { applyDisplayedHorizonHaze, displayedHorizonHazeProvenance } from './display-sky-haze'
import { mineralSurfaceProvenance, closeSurfaceProvenance } from './surface'
import { entryMineralSurfaceProvenance } from './entry-mineral-surface'
import { foundationPlinthProvenance } from './foundation-plinth'
import { Box3, Color, FogExp2, DirectionalLight, Group, Mesh, Raycaster, Vector2, Vector3 } from 'three/webgpu'
import { float, mix, vec3, vec4, dot as nodeDot, positionWorld, cameraPosition, smoothstep, mx_fractal_noise_float } from 'three/tsl'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import { setRegister, type WingHosts, type WingModule, type WingProgress, type WingReport, type WingStage, type WingStation } from '../frame'
import { beginVisit, type Visit } from '../visit'
import { createWingPlan, type WingPlan } from '../plan'
import { PLAN_WORDS } from '../plan/words'
import { createWingRecap } from '../plan/recap'
import type { PlanHighlight, PlanPoint, PlanRoom, PlanShape, PlanSite, PlanStation } from '../plan/types'
import { createWingLife, type WingLife } from '../life'
import { LIFE_WORDS, capitalise, fill, spokenCount } from '../life/words'
import type { LifeBand, LifeEvent, LifePerson, LifeRecord, LifeWork, MuseumDate, Sure } from '../life/types'
import { dateYears } from '../life/scale'
import { constructionRecords, evidenceWords } from './evidence-copy'
import { lang, WING_TEXT } from '../content'
import { createVinciSourcesWindow, type VinciSourcesTab, type VinciExhibitSources } from './sources'
import { createVinciWelcome, vinciWelcomeSeen } from './welcome'
import { KEY_RIG, PRINT, STATION_EXPOSURE } from './print'
import { createShell } from './shell'
import { createHouseHall, houseHallProvenance, type HouseHall } from './house-hall'
import { createShellShadowDouble } from './shadow-shell'
import { createWingShadowBody, type WingShadowBody } from './shadow-body'
import { createCollection, collectionProvenance } from './collection'
import { COURT, GRAVE_ORIGIN, LINE_FIELD, ROOMS, SUPPER_WALL } from './collection/layout'
import { collectionView } from './collection/views'
import { mountCollectionExhibits, type CollectionExhibits } from './collection/exhibits'
import { isMachineSlug, type MachineSlug } from './machines'
import { createPictureRecord, createPolicyWorkLabel, createWindowWorkLabel, holderLine, policyLabelText, PICTURE_CERTAINTY_KEY } from './pictures/policy-label'
import { hangCatalogue } from './collection/catalogue'
import { frameKey, hangNumber } from './collection/picture-room-plan'
import { MAIN_HANG, REGISTER, type PictureRights } from './pictures/register'
import { MACHINE_SLUGS, machineCatalog } from './machines/catalog'
import { validatePaintingRecord } from './pictures/policy'
import { validateSheetRecord } from './pictures/sheet-record'
import { pictureDisplayUV, pictureDisplayWindow } from './pictures/registration'
import { assetAddress } from '../../stack/materials'
import { createCollectionReceiverPlaneShadowFilter } from './receiver-plane-shadow'
import { createCollectionAccess, collectionAccessPoint, collectionAccessProvenance } from './collection-access'
import { createRoadDressing, roadDressingProvenance } from './road-dressing'
import { createCourtObjects, createInnerCourtDressing, courtObjectsProvenance, innerCourtProvenance, courtDressingProvenance } from './inner-court'
import { createGatePassage, gatePassageProvenance } from './gate-passage'
import { createStudySheet, type StudySheet } from './study-sheet'
import { createEntryPassage, createLedgeMount, entryPassageProvenance, hallLedge, hallLedgeProvenance, LEDGE_FINISH_PROUD_M } from './entry-passage'
import { mountBoxes } from './machines/bench/mounts'
import { createGround } from './ground'
import { planVegetation, VEGETATION_STEPS } from './vegetation'
import { windClock } from './wind'
import { createRail, stationPose, namedPose, vinciStandsInRoom } from './rail'
import { vinciWalk, vinciLifeOrderAsked, vinciWalkPose, vinciReadingSeconds, type VinciWalkCut, type VinciWalkStop } from './walk'
import { collectRailSolids, createRailGeometryAuthority } from './rail-proof'
import { bindRailPointer, createWheelStepper } from './input'
import { dossier, world, type Quantity } from './site'
import { gradeAt as groundHeight, galleryBankCapProvenance } from './terrain-mesh'
import { GROUND_DRESSING_STEPS, planGroundDressing } from './ground-dressing'
import { createWater, type WaterGroup } from './water'
import { createMeasurement, type VinciMeasurement } from './measurement'
import { collectVinciLabelOccluders, createVinciExhibitDots, createVinciLabelAnchor, vinciSightBlocked, type VinciExhibitDots, type VinciExhibitMark, type VinciLabelAnchor, type VinciLabelMode, type VinciLabelRect } from './labels'
import { pickVinciExhibit, readVinciExhibits, vinciMachineRoom, type VinciPickEntry } from './collection/pick'
import { LINE_FLOOR_PICK, VINCI_STUDY_LEAF, vinciApproachPose, vinciApproachStation, vinciStudIndex } from './collection/approaches'
import { createVinciCloseLook, createVinciMachinePayload, fillVinciLimitSlots, renderVinciMachineRecord, vinciDeathbedCard, vinciLimits, vinciLine, vinciMachineCard, vinciPlaceCard, vinciPlaceTitle, vinciManuscriptWords, VINCI_EXHIBIT_CARD, VINCI_PAGE_HONESTY, VINCI_VITRINE_WORDS, type VinciPlaceCard, type VinciPlaceCertainty, type VinciPlaceId } from './collection/close-look'
import { createPlacePayload } from '../vitrine/place'
import { readingTableOf } from './table'
import { CODEX_ABSENCES, CODEX_ENTRIES, EDITION_EXHIBIT, SHELF_BOOKS, isCollectionBook, shelfBook, shelfPlate } from './table/codex-shelf'
import { createCodexReaderPayload, type CodexReaderPayload } from './table/codex-reader'
import type { ReadingTable } from './table'
import { FAMOUS_FOLIOS, SHELF_UI, TABLE_UI, type PageRecord } from './table/content'
import { vinciLeafSource } from './collection/deep-plate'
import studyPageMap from './table/data/msb-pages.json?raw'
import { createReaderPayload, type ReaderPayload } from './table/reader'
import { createReaderPayload as createVitrineReaderPayload, type ReaderPayload as ReaderPayloadOfWall } from '../vitrine/reader'
import { LINE_SECTIONS, LINE_STUDS, type Stud } from './line/studs'
import { CIRCA_YEARS, ageAt, studBounds, studEdtf, studLimits } from './line/edtf'
import { SOURCE_READINGS } from './line/bench/visitor-sources'
import cardsSource from './data/cards.json?raw'
import { CERTAINTY as LINE_CERTAINTY } from './line'
import { GRAVE_DEATHBED } from './grave/placement'
import { loadManifest, type ManifestIndex } from '../../manifest'
import { createPlatePayload } from '../vitrine/picture'
import { createVinciWholePlate, isWholePlate, vinciPlateDescription } from './collection/deep-plate'
import type { VitrineRect } from '../vitrine'
import { buildMachine, machineBuildOf, machinesStanding, onMachineStanding } from './machines'
import { createVinciHangStrip, vinciSheetTitle, type VinciStripEntry } from './collection/strip'
import { vinciWallById, vinciWallEndVertex, vinciWallIsEnd, vinciWallOrderOf, VINCI_PICTURE_WALL, vinciWallNearerEnd, vinciWallOfExhibit, vinciWallOfStation, vinciWallStops, vinciWallVertex, VINCI_WALL_ENDS, type VinciWall } from './collection/wall'
import { pathSpecifications } from './paths'
import { roadGradeProvenance } from './road-grade'
import { apronProvenance } from './apron'
import { vinciContent, vinciPlanRooms, vinciThroughLine, vinciLifeBands, vinciLifePeople, vinciLifeSecondLine, vinciLifeCut, vinciLifeWorksRow, vinciLifeWorksCount, vinciLifeWorksEmpty, vinciLifeCertaintyCounted, vinciLifeHourMark, vinciLifeFloorCount, vinciHourValues, vinciWelcomeText, vinciLegacyStationIds, vinciConstructionStatus, vinciReconstruction, vinciCollectionThreshold, vinciRoomStationIds, vinciHourArithmetic, vinciHourSpoken, vinciViewNames, vinciHourLabel, vinciHourIntegrity, vinciCertaintyWords, vinciPlantingAssumptions, vinciWeatherAssumptions, vinciAbsences, vinciGrounds, vinciRightsPolicy, vinciWingCounts, vinciSourcesHeadings, type VinciCertainty, type VinciStatement, type VinciStationContent, type VinciStationId, type VinciText } from './content'
import wingCss from './wing.css?inline'
import { applyDeskSteps, deskOn } from '../desk-switches'
import { deskStageHeight } from '../desk-stage'
import { createDeskChrome, type DeskChrome, type DeskStation } from '../desk-chrome'
import deskCss from '../desk-chrome.css?inline'
import deskTypeCss from '../desk-type.css?inline'
import deskCloseLookCss from '../desk-closelook.css?inline'

import deskPanelCss from '../desk-panel.css?inline'

// desk.marks: its stylesheet import stands here
import deskMarksCss from '../desk-marks.css?inline'
import { deskControl } from '../desk-story'

// desk.overview: its stylesheet import stands here
import deskOverviewCss from '../overview/desk-overview.css?inline'

// desk.sheet: its stylesheet import stands here

// desk.opening: its stylesheet import stands here

const text=(value:VinciText):string=>value[lang()]
/** The painting at the grave: read by its own record, not the hang's register. */
const DEATHBED_WORK='deathbed-painting', GRAVE_PAINTING_ASPECT=GRAVE_DEATHBED.imageWidth/GRAVE_DEATHBED.imageHeight
const sourcesWord=()=>lang()==='de'?'Quellen':'Sources'
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
// The print, the station exposures and the light rig live in `print.ts`, one
// source for the rooms and for the machine island the film opens.
/** THE HALL IS PRINTED ON A SHOULDER: its spots are the hottest light in the
 * wing, and a linear print clips a lit sail to one flat white. */
const STATION_SHOULDER:Partial<Record<VinciStationId,number>>={flight:1,works:1,hall:1,'supper-wall':1}
const exposureOf=(id?:string):number=>STATION_EXPOSURE[id as VinciStationId]??PRINT.exposure
/** THE EYE THAT STEPS INTO A ROOM OF THE HOUSE opens as it does at a door:
 * the house's close looks stand indoors, a stop over the landing's print. */
const VIEW_EXPOSURE:Readonly<Record<string,number>>={'great-hall':2.2,'great-hall-door':2.2}
/** and prints on the shoulder: the sun's patch and the lit glass stand four
 * stops over the room, and a linear print clips them to one flat white; the
 * shoulder's toe takes a little from the mid-tones, which the exposure gives
 * back */
const VIEW_SHOULDER:Readonly<Record<string,number>>={'great-hall':1,'great-hall-door':1}
const shoulderOf=(id?:string):number=>STATION_SHOULDER[id as VinciStationId]??0
/** THE EYE OPENS OVER THE LAST THIRD OF A LEG, so the leg lands on the
 * station's own print: a stop has one picture whichever way it was reached,
 * live and filmed, and no ease is left to run after the arrival. */
const EXPOSURE_OPENS=2/3
function legExposure(nav:{completed?:string,active?:string,legWalked:number}):number {
  const from=exposureOf(nav.completed)
  if(!nav.active)return from
  const t=Math.max(0,Math.min(1,(nav.legWalked-EXPOSURE_OPENS)/(1-EXPOSURE_OPENS)))
  return from+(exposureOf(nav.active)-from)*t*t*(3-2*t)
}
/** The shoulder rolls in on the same third of the leg as the exposure. */
function legShoulder(nav:{completed?:string,active?:string,legWalked:number}):number {
  const from=shoulderOf(nav.completed)
  if(!nav.active)return from
  const t=Math.max(0,Math.min(1,(nav.legWalked-EXPOSURE_OPENS)/(1-EXPOSURE_OPENS)))
  return from+(shoulderOf(nav.active)-from)*t*t*(3-2*t)
}
const SHADOW={nearHalfM:20,nearMapPx:1024,aheadM:10,refocusM:3,lightDistanceM:80} as const
/** THE SUN'S THREE SWITCHES, off unless an address asks for them. A flicker
 * is separated by taking one thing away at a time, and a seat that has to
 * patch the wing to do it measures a tree nobody else can rebuild. */
const SHADOW_OFF=(name:string):boolean=>typeof location!=='undefined'&&new URLSearchParams(location.search).has(name)

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
  // frame keeps the card of the place it is still in. Both count stops of the
  // WALK, which is the order the wing is walked in and not the order its
  // rooms were built: off the life switch the two are the same list.
  let station=0, card=0, activeView='', mode:VinciLabelMode=1, controller:AbortController|undefined
  const LIFE=vinciLifeOrderAsked()
  const WALK=vinciWalk(LIFE)
  const stopAt=(index:number):VinciWalkStop=>WALK.stops[Math.max(0,Math.min(WALK.stops.length-1,index))]!
  const stationOf=(id:string):VinciStationContent=>vinciContent.find(station=>station.id===id)??vinciContent[0]!
  const contentAt=(index:number):VinciStationContent=>stationOf(stopAt(index).station)
  /** The station standing, as its own card reads it. */
  const hereContent=():VinciStationContent=>contentAt(card)
  /** Where a stop of the walk stands on its wall, for the run that reaches it. */
  const walkVertex=(stop:VinciWalkStop):number|undefined=>{
    const wall=stop.wall?vinciWallById(stop.wall):undefined
    return wall&&stop.exhibit?vinciWallVertex(wall,stop.exhibit):undefined
  }
  /** THE STOP OF THE WALK THE EYE IS AT. Two stops may stand in one station's
   * room, so the vertex of the wall decides between them where there is one. */
  function walkIndexAt(id:string,vertex?:number):number {
    const here=WALK.stops.findIndex(stop=>stop.station===id&&walkVertex(stop)===vertex)
    return here>=0?here:WALK.stops.findIndex(stop=>stop.station===id&&stop.exhibit===undefined)
  }
  /** The chapter boundary between two stops, which is crossed and never walked. */
  const walkCut=(from:number,to:number):VinciWalkCut|undefined=>
    WALK.cuts.find(cut=>cut.from===stopAt(from).id&&cut.to===stopAt(to).id)
  const walkCutBoundary=(from:number,to:number):boolean=>
    Boolean(walkCut(from,to))||Boolean(walkCut(to,from))
  /** One entry of the bar: the stop's own name where it has one, and the
   * question of the room it stands in, which is what the door asks. */
  const walkStation=(stop:VinciWalkStop):WingStation=>{
    const s=stationOf(stop.station)
    return {id:stop.id,name:text(stop.name??s.name),question:text(s.door)}
  }
  /** THE VERTEX A RUN ALONG THE WALL WOULD LAND ON, from where the eye
   * stands. Only the life's order walks a wall between its stations: in the
   * order the rooms were built the two ends are joined by their own route. */
  function walkRunVertex(stop:VinciWalkStop):number|undefined {
    if(!LIFE||!standing)return undefined
    const nav=rail.navigation, wall=nav.wallId?vinciWallById(nav.wallId):undefined
    if(!wall||nav.wall===undefined)return undefined
    const target=stop.wall===wall.id?walkVertex(stop)
      :vinciWallIsEnd(wall,nav.wall)?undefined:vinciWallEndVertex(wall,stop.station)
    return target===nav.wall?undefined:target
  }
  /** A stop of a wall the eye is not on yet: the walk goes to the wall's
   * nearer end first and runs the wall from there, as one journey. */
  let walkOnwards=-1
  function walkOnToWall(index:number):void {
    const stop=stopAt(index), wall=stop.wall?vinciWallById(stop.wall):undefined
    const vertex=walkVertex(stop)
    if(!wall||vertex===undefined){walkOnwards=-1;return}
    const end=vinciWallNearerEnd(wall,vertex)
    walkOnwards=index
    rail.set(end,stationPose(end,narrow()),false,narrow())
  }
  /** THE CHAPTER CARD. The picture dips, the chapter's title stands on the
   * dip, and the visitor arrives at the next stop without walking the leg
   * under it. The title stands for one reading of its own words at the pace
   * the visitor set, and any press moves it on; where the design would rather
   * have it wait, it waits for that press alone. */
  const CUT_CARD_WAITS_FOR_PRESS=false
  const CUT_DIP_SECONDS=.45
  let cutCard:HTMLElement|undefined, cutTimers:ReturnType<typeof setTimeout>[]=[], cutPress:(()=>void)|undefined
  const wingElement=():HTMLElement|undefined=>hosts?.stage.parentElement??undefined
  function endChapterCard():void {
    for(const timer of cutTimers)clearTimeout(timer)
    cutTimers=[]
    if(cutPress){window.removeEventListener('pointerdown',cutPress,true);window.removeEventListener('keydown',cutPress,true);cutPress=undefined}
    const wing=wingElement()
    if(wing)delete wing.dataset['cut']
    if(cutCard){delete cutCard.dataset['on'];cutCard.hidden=true;cutCard.textContent=''}
  }
  function crossChapter(to:number):void {
    if(!hosts)return
    const cut=walkCut(card,to), stop=stopAt(to), s=stationOf(stop.station)
    const title=cut?text(cut.title):''
    const still=matchMedia('(prefers-reduced-motion: reduce)').matches
    const dip=still?0:CUT_DIP_SECONDS*1000
    cutCard??=make('div','vinci-cut')
    cutCard.setAttribute('role','status')
    cutCard.textContent=''
    if(title)cutCard.append(make('p','vinci-cut-title',title))
    cutCard.hidden=false
    // OVER THE WING'S OWN WORDS, UNDER THE BAR: the room's card, its row and
    // its question go with the picture, and the way out stays where it is,
    // which is what standing the dip before the bar in the page does.
    const wingEl=hosts.stage.parentElement
    if(wingEl&&barEl&&barEl.parentElement===wingEl)wingEl.insertBefore(cutCard,barEl)
    else wingEl?.append(cutCard)
    const wing=wingElement()
    if(wing)wing.dataset['cut']=''
    // the element is in the page before the dip is asked for, so the dip is a
    // transition and not a jump
    void cutCard.offsetWidth
    cutCard.dataset['on']='1'
    const land=():void=>{
      rail.set(s.id,vinciWalkPose(stop,narrow()),true,narrow(),walkVertex(stop))
      card=station=to;dock.scrollTop=0;aimPrint(s.id);exposureAt=s.id
      paintHeader();paintHeaderVisibility();paintDock();paintQuestion();standHere()
      cutPress=()=>moveOn()
      window.addEventListener('pointerdown',cutPress,true);window.addEventListener('keydown',cutPress,true)
      if(!CUT_CARD_WAITS_FOR_PRESS)cutTimers.push(setTimeout(moveOn,Math.round(vinciReadingSeconds(title.length)*1000)))
    }
    const moveOn=():void=>{
      for(const timer of cutTimers)clearTimeout(timer)
      cutTimers=[]
      if(cutPress){window.removeEventListener('pointerdown',cutPress,true);window.removeEventListener('keydown',cutPress,true);cutPress=undefined}
      if(cutCard)delete cutCard.dataset['on']
      const wing=wingElement()
      if(wing)delete wing.dataset['cut']
      cutTimers.push(setTimeout(()=>{if(cutCard){cutCard.hidden=true;cutCard.textContent=''}},dip))
    }
    if(dip)cutTimers.push(setTimeout(land,dip)); else land()
  }
  let header:HTMLElement,dock:HTMLDialogElement,drawer:HTMLElement,record:HTMLElement,source:HTMLButtonElement,sky:SkyMesh
  let sources:ReturnType<typeof createVinciSourcesWindow>
  let welcome:ReturnType<typeof createVinciWelcome>|undefined
  /** THE NIGHT ON THE DEVICE: ids only, opened by the vitrine's own door. */
  let visit:Visit|undefined
  /** THE PLAN, and the one case where it takes an entry instead of pushing
   * its own: a close look that stood down for it already pushed one. */
  let plan:WingPlan|undefined, planControl:HTMLButtonElement|undefined, planAdopt=false
  /** THE LIFE VIEW, and the same one case: an exhibit that stood down for it
   * already pushed the entry this sheet would push. */
  let life:WingLife|undefined, lifeControl:HTMLButtonElement|undefined, lifeAdopt=false
  let exhibitSources:VinciExhibitSources|null=null
  let labelHostHidden:string|null=null
  // THE WAIT AT THE STREET SHOWS ITSELF. The heading is painted and the frame
  // is given to the browser before the place is built, so the visitor stands
  // at a named station instead of at nothing; a measured hairline says how
  // much of the stone has landed, and a station asked for before the rail's
  // own proof is verified is placed rather than queued and lost.
  let standing=false, scheduled=0
  /* THE ENTRY PAYS FOR THE WALK. `build` runs two frames after the first
   * `show`, and every material it makes compiles its pipeline the first time
   * a frame draws it. The caller holds its loading field until both are done,
   * so no compile lands inside a stride. */
  let warm:WarmWalk|undefined, warmed:Promise<void>|undefined
  /** whether the warm up began under the entry's gold field */
  let warmUnderField=false
  /* THE ENTRY REPORTS TWO COUNTS AND NOTHING ELSE: the bodies this entry
   * builds, and the poses its warm up draws. Both totals are known before the
   * first one is paid, every unit weighs the same, and each half is held at
   * its own high water mark, so a total that grows when the walls' pictures
   * are named holds the share where it stands instead of dropping it. */
  const ENTRY_STAGES:readonly WingStage[]=['house','exhibits','walk']
  const posesAsked=WALK.stops.length+WARM_EXTRA_FRAMES
  /** THE HOUSE STAGE IS COUNTED TOO. The wing used to be built in ONE task of
   * about six seconds, of which the two ground sowings were four: the stage
   * was named but nothing in it could be counted, so the field's rule
   * travelled through the longest part of the entry without a number. The
   * build is dealt into steps, five for the bodies the rooms are made of, the
   * two sowings' own seams, and two for what is welded and hung at the end.
   * The total is a constant, so it is known before the first step. */
  const HOUSE_STEPS=5+VEGETATION_STEPS+GROUND_DRESSING_STEPS+2
  let tell:WingReport|undefined, toldAt=0, stageAt=0
  let posesUp=0, setsAsked=0, setsUp=0, shareUp=0, houseUp=0
  let house:Generator<void,void,void>|undefined
  let announceBuilt:()=>void=()=>{}
  const built=new Promise<void>(resolve=>{announceBuilt=resolve})
  let authority:ReturnType<typeof createRailGeometryAuthority>|undefined
  let shadowCache:ReturnType<typeof createStaticShadowCache>|undefined
  /** the great hall's own sun shadow, redrawn when the cache's casters change */
  let hallSun:HouseHall['refreshSun'], hallSunSeen=-1
  let shadowBody:WingShadowBody|undefined
  /** The share of a leg after which the card names the station ahead. */
  const CARD_HANDOVER=.5
  let exposureAt:VinciStationId|undefined, exposureShown=Number.NaN, shoulderShown=Number.NaN
  let exhibits:CollectionExhibits|undefined, exhibitClock=0
  /** THE CLOSE LOOK. The registry is a read over the collection's own group,
   * the dots live in the label layer, and one owner holds the open exhibit. */
  let collectionRoot:Group|undefined, houseRoot:Group|undefined, courtRoot:Group|undefined, occluders:readonly Mesh[]=[]
  let dots:VinciExhibitDots|undefined, closeLook:ReturnType<typeof createVinciCloseLook>|undefined
  let strip:ReturnType<typeof createVinciHangStrip>|undefined
  /** THE STORE'S OWN INDEX, held: a row is painted synchronously and every
   * exhibit without a plate of its own takes its preview by address. */
  let assets:ManifestIndex|undefined
  let studySheet:StudySheet|undefined, releaseSheetMemory:(()=>void)|undefined
  let quiet:HTMLElement|undefined, quietDot:HTMLElement|undefined, quietName:HTMLElement|undefined, quietYear:HTMLElement|undefined
  /** The vertex the eye last stood at, so the marks and the row are taken
   * again the moment it arrives at another stop. */
  let wallWas:number|undefined
  /** Whether the body stood still when the marks were last taken: the sign a
   * mark wears is about the body, so it is taken again when that changes. */
  let marksStill=false
  /** Whether a leg is under way, so the frame's one attribute is written on
   * the edge and not in every frame. */
  let legUnderWay=false
  /** the frame's own bar, which a mark may not stand on either */
  let barEl:HTMLElement|null=null
  let picks:VinciPickEntry[]=[], picksTier=''
  const pickRay=new Raycaster(), sightRay=new Raycaster(), sightHits:Parameters<typeof vinciSightBlocked>[4]=[]
  /** Three on calm, six on standard, eight on hero: what is in front of the
   * visitor carries a mark, and the rest of the room does not. */
  const DOTS_PER_TIER:Record<string,number>={hero:8,standard:6,calm:3}
  /** The one mode a press opens in, set by the caller the press came from. */
  let openMode:'auto'|'walk'|'cut'='auto', exhibitAway=false
  /** THE ADDRESS OF ONE DATE. `#s=<station>&d=<date>` opens the life view at
   * that date once the station carrying its floor is stood in. */
  let pendingDate=/(?:^|[#&])d=(life-\d{2})(?:&|$)/.exec(location.hash)?.[1]??null
  /** THE LEAF A DOOR NAMES. A folio beside a machine opens the reading at
   * that side rather than at the leaf the book lies open on. */
  let leafAt:string|null=null
  /** A BOOK CHOSEN FROM THE RECORD OPENS WITH ITS OWN RECORD: the reading of
   * the sources goes on with the book the visitor turned to. */
  let recordNext=false
  const openFromRecord=(id:string):void=>{recordNext=mode===2;openExhibit(id,null)}
  /** THE STATION CARD IS A SHEET ON THE PHONE. Peeked or opened belongs to
   * the walk, so it is held here and never written down. */
  let sheetOpen=false
  /** The sheet's foot, where the frame stands the question, the door and the
   * bar's own words while the stage is narrow. */
  let sheetFoot:HTMLElement|undefined
  /** The desktop's new chrome, while one of its switches stands. */
  let desk:DeskChrome|undefined
  /** How far down the screen a panel of this wing may stand. */
  let panelFloor:()=>number=()=>innerHeight
  let restoreEnvironmentRotation:(()=>void)|null=null
  const narrow=()=>innerWidth/innerHeight<=.9
  const shadowFocus=new Vector3(NaN,NaN,NaN), focusAhead=new Vector3()
  /** THE LATTICE MAY NOT MOVE BY A FRACTION OF ITS OWN TEXEL. The near
   * cascade follows the visitor, and every time it moves, its map is redrawn
   * from a new origin: landed at an arbitrary fraction of a texel, the whole
   * shadow pattern shifts under every surface it falls on, which is one frame
   * of flicker on a wall a visitor is walking past. Snapping the focus to the
   * map's own grid, in the plane the light looks down, keeps the pattern on
   * the same texels whatever the eye does. */
  const lightUp=new Vector3(0,1,0), lightX=new Vector3(), lightY=new Vector3(), lightZ=new Vector3()
  function snapToShadowTexel(point:Vector3):void {
    // the texel of the map standing now: the film's tier draws a finer one
    const texel=2*SHADOW.nearHalfM/key.light.shadow.mapSize.x
    lightZ.copy(key.direction).normalize()
    lightX.crossVectors(lightUp,lightZ)
    // a sun straight overhead leaves no horizontal axis to snap along
    if(lightX.lengthSq()<1e-8)return
    lightX.normalize();lightY.crossVectors(lightZ,lightX)
    for(const axis of [lightX,lightY]){
      const along=point.dot(axis)
      point.addScaledVector(axis,Math.round(along/texel)*texel-along)
    }
  }
  /** THE FILM HAS NO WAY IN. Under the export the near box follows the eye in
   * every frame, so the shadow a stop shows is a function of its pose and
   * never of the leg that reached it; the live walk keeps its three metres. */
  const FILM_EXPORT=typeof location!=='undefined'&&new URLSearchParams(location.search).has('export')
  function focusNearCascade(force=false):void {
    if(!hosts)return
    const camera=hosts.world.camera
    camera.getWorldDirection(focusAhead)
    focusAhead.multiplyScalar(SHADOW.aheadM).add(camera.position)
    if(!force&&!FILM_EXPORT&&focusAhead.distanceToSquared(shadowFocus)<SHADOW.refocusM*SHADOW.refocusM)return
    snapToShadowTexel(focusAhead)
    shadowFocus.copy(focusAhead)
    key.light.target.position.copy(shadowFocus)
    key.light.position.copy(key.direction).multiplyScalar(SHADOW.lightDistanceM).add(shadowFocus)
    key.light.target.updateMatrixWorld();key.light.updateMatrixWorld()
  }
  /** The heading, the hairline and nothing else: cheap enough to paint in the
   * frame the visitor arrives in. */
  function mount(h:WingHosts) {
    visit=beginVisit('vinci')
    // Vinci's interactive source cards need an accessible host only while mounted.
    labelHostHidden=h.labels.getAttribute('aria-hidden');h.labels.removeAttribute('aria-hidden')
    hosts=h;h.stage.textContent='';h.labels.textContent='';h.stage.parentElement!.dataset['wing']='vinci';const style=make('style','');style.textContent=wingCss;h.stage.append(style)
    // THE DESKTOP'S NEW CHROME, behind its own switches: the attribute is
    // written once and the stylesheet branches on it, so with every switch
    // off nothing below this line paints.
    const wing=h.stage.parentElement!
    // THE PHONE KEEPS ITS OWN CHROME. The desktop's steps stand only on a stage
    // that is wide when the visit begins, and the word stays off a narrow one.
    const deskStage=!narrow()
    if(deskStage)applyDeskSteps(wing);else delete wing.dataset['desk']
    /* HOW FAR DOWN A PANEL MAY STAND. Today that is the top of the bar; where
       the desktop's words stand, it is the top of their own band. */
    panelFloor=()=>desk?.floor()??wing.querySelector('.wing-rail-group')?.getBoundingClientRect().top??deskStageHeight()
    const deskStyle=make('style','');deskStyle.textContent=[deskTypeCss,deskCss,deskCloseLookCss,
      // desk.panel
      deskPanelCss,

      // desk.marks
      deskMarksCss,

      // desk.overview
      deskOverviewCss,

      // desk.sheet
      '',

      // desk.opening
      '',
    ].filter(Boolean).join('\n');h.stage.append(deskStyle)
    if(deskStage&&(deskOn('words')||deskOn('ways')))desk=createDeskChrome({
      stage:h.stage,wing,lang,
      standing:()=>deskStationAt(card),
      next:()=>card+1<WALK.stops.length?deskStationAt(card+1):null,
      order:()=>WALK.stops.map(stop=>stop.id),
      stood:()=>visit?.stood??[],
      // a stop of a wall carries the work's own name; a station carries its
      // room's, which is what the walk list already decided
      name:id=>WALK.stops.find(stop=>stop.id===id)?.name
        ??vinciContent.find(s=>s.id===id)?.name??{en:'',de:''},
      door:()=>wing.querySelector<HTMLElement>('.wing-door'),
      sources:()=>source??null,
      question:()=>vinciContent[card]?.door[lang()]??'',
      words:{next:LIFE_CARDS.controls.date.next,back:LIFE_CARDS.controls.date.previous,rail:WING_TEXT.rail},
      go:index=>h.navigate(index),
      leg:()=>{const nav=standing?rail.navigation:undefined;return nav?.active?nav.legWalked:null},

      // desk.panel: its host fields

      // desk.marks: its host fields

      // desk.overview: its host fields
      overview:{cells:()=>stationExhibits().map(cell=>({id:cell.id,title:cell.title,short:exhibitShort(cell.id),openable:cell.openable,
        sub:shelfBook(cell.id)?text(shelfBook(cell.id)!.official):null,
        certainty:pictureCertainty(cell.colour),kind:picks.find(pick=>pick.id===cell.id)?.kind??'picture',
        preview:cell.preview===null?null:strip?.thumb(cell.preview)??cell.preview})),
        open:id=>openExhibit(id,null),room:roomName,
        // THE SHELF NAMES ITSELF, and the books it cannot show stand on it by
        // name with the reason, never opened
        name:()=>hereContent().id==='reading-table'?{en:SHELF_UI.en.shelf,de:SHELF_UI.de.shelf}:null,
        // the shelf's eight books stand in two rows of four, none alone
        columns:()=>hereContent().id==='reading-table'?4:null,
        absent:()=>hereContent().id!=='reading-table'?null:{heading:TABLE_UI[lang()].absent,
          items:CODEX_ABSENCES.map(absence=>({title:lang()==='de'?absence.de:absence.en,
            reason:lang()==='de'?absence.reason_de:absence.reason_en}))},
        // the three rooms whose set the card data measures: the hang, the
        // machine hall, and the leaves
        measure:()=>{const here=hereContent().id
          const key=here==='picture-room'||here==='picture-room-west'?'measure_wall'
            :here==='flight'||here==='works'?'measure_hall':here==='body'?'measure_book':''
          if(here==='reading-table')return {en:SHELF_UI.en.measure,de:SHELF_UI.de.measure}
          return key?deskControl('overview',key):null}},

      // desk.sheet: its host fields

      // desk.opening: its host fields
      hurry:()=>{if(standing)rail.stride(1)}})
    header=make('div','vinci-heading');header.id='vinci-station-card';h.stage.append(header)
    // THE NAME UNDER THE PAINTING. Standing at a stop with no card, the work
    // carries two sealed words of its own: the title and the year, with the
    // certainty dot the museum owes every reproduction. Nothing is written
    // here that the register does not already say.
    quiet=make('p','vinci-quiet');quiet.hidden=true
    quietDot=make('span','vinci-quiet-dot');quietName=make('span','vinci-quiet-name');quietYear=make('span','vinci-quiet-year')
    quiet.append(quietDot,quietName,quietYear);h.stage.append(quiet)
  }
  function schedule() { scheduled=requestAnimationFrame(()=>{scheduled=requestAnimationFrame(build)}) }
  function build() {
    scheduled=0
    houseUp=0
    house=buildTheHouse()
    houseStep()
  }
  /** A frame's worth of the house, and the line counts every step of it.
   * One step a frame would pay a whole frame for a seam that costs a
   * millisecond, and the frames themselves are what the entry grew by, so a
   * frame takes steps until it has spent its budget. The last step drains
   * whatever is left: a seam the build never reaches cannot leave the wing
   * half standing. */
  const HOUSE_FRAME_MS=18
  function houseStep():void {
    scheduled=0
    if(!house)return
    const began=performance.now()
    let done=false
    do {
      done=house.next().done===true
      houseUp=Math.min(HOUSE_STEPS,houseUp+1)
      if(houseUp>=HOUSE_STEPS-1)while(!done)done=house.next().done===true
    } while(!done&&performance.now()-began<HOUSE_FRAME_MS)
    if(done){house=undefined;houseUp=HOUSE_STEPS;return}
    scheduled=requestAnimationFrame(houseStep)
  }
  function* buildTheHouse():Generator<void,void,void> {
    const h=hosts!
    const {scene,camera,stack,clock}=h.world
    camera.near=.25;camera.updateProjectionMatrix()
    scene.clear();scene.background=new Color('#b3b7ac');scene.fog=new FogExp2('#c0bba9',.0075)
    stack.setScene(scene,camera,{...PRINT})
    key=stack.light({...KEY_RIG.key,reach:100,cascades:[SHADOW.nearHalfM,90]})
    key.fill.color.set(KEY_RIG.fill.color);key.fill.groundColor.set(KEY_RIG.fill.groundColor);key.fill.intensity=KEY_RIG.fill.intensity;scene.environmentIntensity=KEY_RIG.environmentIntensity
    // The procedural probe paints azimuth from north; r185 samples longitude
    // from +X. Its inverse environment matrix needs this quarter-turn so the
    // probe disc and the measured key share the same physical sun direction.
    const priorEnvironmentRotation=scene.environmentRotation.clone()
    restoreEnvironmentRotation=()=>{scene.environmentRotation.copy(priorEnvironmentRotation)}
    scene.environmentRotation.set(0,-Math.PI/2,0)
    key.light.shadow.bias=-.00008;key.light.shadow.normalBias=.012;key.light.shadow.mapSize.setScalar(stack.film?stack.tierConfig().shadow.mapSize:SHADOW.nearMapPx)
    focusNearCascade(true)
    // r185 implements filterNode; the installed LightShadow type predates it.
    if(!SHADOW_OFF('noplanefilter'))Object.assign(key.light.shadow,{filterNode:createCollectionReceiverPlaneShadowFilter()})
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
    yield
    const entry=createEntryPassage(stack.tierName())
    shell=createShell(stack.tierName(),stack.materials)
    // The great hall and its passage stand behind the shell's opened windows,
    // at every tier: the hall's stop stands in its door, and the walk to it
    // crosses the service passage's floor.
    const greatHall=createHouseHall(stack.tierName(),stack.materials)
    yield
    const ground=createGround(stack.tierName(),stack.materials)
    yield
    // The collection is built after the house has asked the library for its
    // own sets, so the machines' smaller requests never arrive first.
    const collection=createCollection()
    yield
    // THE TWO SOWINGS ARE THE LONG HALF OF THE BUILD. Their groups stand in
    // the scene from here and are filled a seam at a time, so the order the
    // wing is welded and identified in below is the one it always had.
    const wood=planVegetation(groundHeight,stack.tierName())
    const dressing=planGroundDressing(groundHeight,stack.tierName())
    const courtDressing=createInnerCourtDressing(groundHeight,stack.tierName())
    courtRoot=courtDressing
    studySheet?.dispose();releaseSheetMemory?.()
    studySheet=createStudySheet(courtDressing)
    { const sheet=studySheet;releaseSheetMemory=stack.registerTextureMemory(()=>sheet.textureMB(),'study sheet') }
    if(assets)supplyStudySheet()
    if(greatHall){scene.add(greatHall.group);hallSun=greatHall.refreshSun;hallSunSeen=-1}
    scene.add(ground,shell,entry,createGatePassage(stack.tierName()),courtDressing,createCourtObjects(groundHeight,stack.models),createRoadDressing(groundHeight,stack.tierName()),collection,createCollectionAccess(),wood.group,dressing.group)
    yield
    for(const step of wood.steps){step();yield}
    for(const step of dressing.steps){step();yield}
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
      if(SHADOW_OFF('nocast'))scene.traverse(o=>{if(o instanceof DirectionalLight)o.castShadow=false})
      if(SHADOW_OFF('nonormalbias'))key.light.shadow.normalBias=0
    }
    water=createWater(scene,stack);scene.add(water)
    // THE EXHIBITS ARE ASKED FOR IN THE SAME STEP THE RAIL READS THE SCENE
    // IN. The stands under them are a rail solid and the certificate is
    // written with them standing, while the bodies themselves arrive on
    // their own time and are certified from their placement table instead.
    // While the build was one blocked task no body could land between the
    // two; dealing it into frames opened twenty frames in which one did, and
    // the rail then found the parachute twice.
    exhibits=mountCollectionExhibits(collection,stack)
    void exhibits.ready.then(()=>{if(!hosts||!standing)return;if(!warm)standShadowCache();if(mode===2)paintDock()})
    // The cache proves the scene's casters are the ones it snapshotted, so it
    // is taken at the end of the warm up with every static caster standing,
    // and not on the first leg. The court's exhibit brings its own materials
    // from the library a moment later, so the snapshot is taken again once
    // they have arrived; without it the whole shadow map is re-rendered on
    // every frame of the walk.
    for(const root of scene.children){const id=root===shell?'vinci/shell':root.name==='vinci/shell-shadow'?'vinci/shell-shadow':root.name==='wing-vinci/gate-passage'?'vinci/gate-passage':root===water?'vinci/water':root===sky?'vinci/sky':root.name.includes('landscape trees')?'vinci/vegetation':root.name==='vinci/collection-modern-insertion'?'vinci/collection':root.name==='vinci generated road dressing'?'vinci/road-dressing':root.name==='vinci generated inner court dressing'?'vinci/inner-court':root.name.includes('dressing')?'vinci/ground-dressing':'vinci/terrain';root.traverse(o=>{if(o instanceof Mesh){const assetId=typeof o.userData['manifestId']==='string'?o.userData['manifestId']:id;o.userData['manifestId']=assetId;o.userData['asset']=assetId}})}
    // The ids above are what the shadow body folds by, so it is welded
    // after them and before the rail reads the scene.
    shadowBody=createWingShadowBody(scene);scene.add(shadowBody.group)
    authority=createRailGeometryAuthority(collectRailSolids(scene))
    rail=createRail(camera,clock,authority);measurement=createMeasurement(h.labels,stack)
    // the film's hand on the rail, fetched only by the export's own address
    if(FILM_EXPORT)void import('./film').then(m=>m.installFilm({rail:()=>rail,walk:WALK,narrow,walkPose:vinciWalkPose,approachPose:vinciApproachPose}))
    yield
    source=make('button','vinci-source',sourcesWord());source.type='button';source.setAttribute('aria-keyshortcuts','l');source.setAttribute('aria-controls','vinci-source-card');source.addEventListener('click',()=>{mode=mode===2?1:2;paintDock()});barEl=h.stage.parentElement!.querySelector('.wing-rail-group');barEl!.append(source)
    // THE PLAN STANDS IN THE BAR'S OWN GROUP, beside the sources of the
    // station: the group is the frame's one persistent mark, so the plan
    // adds no second one.
    planControl=make('button','wing-plan-open',text(PLAN_WORDS.plan));planControl.type='button'
    planControl.setAttribute('aria-keyshortcuts','p');planControl.setAttribute('aria-controls','wing-plan')
    planControl.addEventListener('click',()=>openPlan())
    h.stage.parentElement!.querySelector('.wing-rail-group')!.append(planControl)
    plan=createWingPlan({host:h.labels,lang,narrow,
      floor:panelFloor,
      title:()=>text(vinciWelcomeText.title),site:planSite,
      standing:()=>hereContent().id,stood:()=>visit?.stood??[],
      // THE QUICK SELECT IS THE PRESS THE BAR ALREADY MAKES: every pair is
      // certified, so the museum walks there and nothing is cut.
      station:id=>{const index=walkIndexAt(id);if(index>=0)h.navigate(index)},
      highlight:openFromPlan,
      // THE OTHER WAY THROUGH THIS WING, from the sheet that draws the place:
      // the word and the press are the wing's, the plan only stands them.
      life:()=>({word:text(LIFE_WORDS.life),open:()=>openLife()}),
      returnFocus:focusTheBar,adopt:()=>planAdopt})
    // THE LIFE STANDS IN THE SAME GROUP, after the plan: the place and the
    // years are the two ways through this wing, so they are two words in one
    // bar and not two marks on the frame.
    lifeControl=make('button','wing-life-open',text(LIFE_WORDS.door));lifeControl.type='button'
    lifeControl.setAttribute('aria-keyshortcuts','e');lifeControl.setAttribute('aria-controls','wing-life')
    lifeControl.addEventListener('click',()=>openLife())
    h.stage.parentElement!.querySelector('.wing-rail-group')!.append(lifeControl)
    life=createWingLife({host:h.labels,lang,narrow,
      floor:panelFloor,
      record:lifeRecord,walk:id=>openFromPlan(id),openRecord:openLifeRecord,
      returnFocus:focusTheBar,adopt:()=>lifeAdopt})
    // The window hands the focus back to the control that opened it; on the
    // phone that control stands inside the card's sheet, and a peeked sheet
    // has no word to hand it to, so the sheet's own control takes it.
    sources=createVinciSourcesWindow(h.labels,source,()=>{mode=1;paintDock();sourceControl().focus({preventScroll:true})});dock=sources.element;drawer=sources.panels.station
    occluders=collectVinciLabelOccluders(scene)
    labels=createVinciLabelAnchor({host:h.labels,camera,occluders,onOpen:()=>{mode=2;paintDock()}})
    collectionRoot=collection
    // THE HOUSE'S ONE EXHIBIT, on the hall's ledge: the compass the machine
    // catalogue held back for it. It stands where the ledge's own record puts
    // it, is stamped like every other machine, and is read by the registry
    // beside the collection's, because a press has to reach it from the hall.
    {
      const compass=buildMachine('proportional-compass',stack)
      // Its tips stand clear of the shelf, so it is held as the exhibition
      // holds it everywhere: a plate on the ledge's finished top, a stem, a
      // collar at the pivot.
      // The bench's mount lets the lowest moving tip clear its plate by 48 mm;
      // on a shelf that reads as floating, so here the instrument sits 40 mm
      // lower on a shorter stem and its tips still clear the plate by 8 mm.
      const lift=hallLedge.top+LEDGE_FINISH_PROUD_M-compass.bounds.min.y,drop=.04
      compass.object.position.set(hallLedge.stand.east,lift-drop,-hallLedge.stand.north)
      compass.object.rotation.y=hallLedge.facing*Math.PI/180
      compass.object.updateMatrixWorld(true)
      houseRoot=new Group();houseRoot.name='vinci/house-exhibits'
      houseRoot.add(compass.object)
      const held=mountBoxes('proportional-compass').map(box=>box.centre[1]>.3
        ?{...box,centre:[box.centre[0],box.centre[1]-drop,box.centre[2]] as [number,number,number]}
        :box.size[1]>.1?{size:[box.size[0],box.size[1]-drop,box.size[2]] as [number,number,number],centre:[box.centre[0],box.centre[1]-drop/2,box.centre[2]] as [number,number,number]}:box)
      houseRoot.add(createLedgeMount(held,
        {east:hallLedge.stand.east,north:hallLedge.stand.north,height:lift,bearingRad:compass.object.rotation.y},stack.tierName()!=='calm'))
      scene.add(houseRoot)
    }
    dots=createVinciExhibitDots({host:h.labels,camera,occluders,limit:DOTS_PER_TIER[stack.tierName()]??6,controls:VINCI_EXHIBIT_CARD,
      onOpen:(id,dot)=>openExhibit(id,dot),
      // the word a pressed walking mark takes, and the leg its ring counts
      pressedWord:()=>text(deskControl('walk','walking')),
      leg:()=>{const nav=standing?rail.navigation:undefined;return nav?.active?nav.legWalked:null}})
    closeLook=createVinciCloseLook({host:h.labels,narrow,
      // the one step back of a close look names the room it goes back to
      room:roomName,
      // A mark stands down while its exhibit is open, so the hand comes back
      // to the row's own button for it, or to the bar.
      returnFocus:id=>strip?.element.querySelector<HTMLElement>(`[data-exhibit="${id}"]`)??hosts?.stage.parentElement?.querySelector<HTMLElement>('.wing-step[aria-current="true"]')??null,
      floor:panelFloor,
      onOpen:(id,from)=>{
        // ONE EXHIBIT AT A TIME: the room's marks stand down before the
        // stage may be held, so none is left standing on a still frame.
        dots?.setOpen(id);dots?.setLimit(0);paintExhibitTitle();paintHeaderVisibility();paintStrip()
        yieldEye()
        // ON THE WALL A PRESS IS A RUN. A stop is a vertex of the room's own
        // certified line, so the eye slides along the hang to the work asked
        // for instead of returning to a station between two neighbours. It
        // runs at every tier and on the phone: the wall is what the room is,
        // and the run carries one plate request, for the stop it lands on.
        // A sheet opens in the reader, and the reader's id carries the leaf
        // door: the run is asked for with the stop's own id under it.
        if(!isWholePlate(id)&&wallRun(isLeafDoor(id)?id.slice(0,-LEAF_DOOR.length):id))return true
        // THE WHOLE PLATE IS THE SAME PLACE: the visitor already stands where
        // the work hangs, so the eye neither walks out to it nor back from it.
        if(isWholePlate(id)||isWholePlate(from)||isLeafDoor(id)||isLeafDoor(from))return false
        // A LEG LEAVES FROM ITS OWN STATION ONLY: a hall machine opened from the
        // hall's other station opens where the visitor stands.
        const pose=vinciApproachStation(id)===hereContent().id?vinciApproachPose(id,narrow()):undefined
        // ON CALM, ON THE PHONE AND UNDER REDUCED MOTION THE EYE DOES NOT MOVE:
        // the vitrine opens where the visitor stands. Where it may move, the
        // eye walks; a rig composing a still cuts to the same certified eye.
        if(!pose){if(from!==null&&rail.navigation.exhibit)rail.returnToStation();return false}
        // WALKING ON IS ONE MOTION: the certified return and the certified
        // approach out, with nothing standing still at the station.
        if(from!==null)return proved(()=>exhibitWalks(true)?rail.chain(id,pose,narrow()):rail.returnToStation())
        if(!exhibitWalks())return false
        return proved(()=>rail.approach(id,pose,narrow(),openMode==='walk'?false:openMode==='cut'||cutToStation()))
      },
      onClose:()=>{
        if(exhibitSources){exhibitSources=null;if(mode===2)mode=1;paintDock()}
        // THE CLOSE LEAVES THE EYE WHERE IT STANDS on the wall: a visitor who
        // shut the card is still standing in front of that painting, with its
        // name under it and the arrows stepping on from there.
        if(!onWallStop())rail.returnToStation()
        dots?.setOpen(null);dots?.invalidate();paintExhibitTitle();paintHeaderVisibility();paintStrip();refreshRecap()
      }})
    strip=createVinciHangStrip({host:h.labels,onOpen:(id,button)=>openExhibit(id,button)})
    void loadManifest().then(index=>{assets=index;supplyStudySheet();if(hosts&&standing)refreshExhibits()})
    void exhibits?.picturesReady.then(()=>{if(hosts&&standing)refreshExhibits()})
    // THE REGISTRY IS A READ, and the court's own exhibits land after the
    // plates do: the row of a station that stands over them is empty until
    // the ground it names has arrived.
    void exhibits?.ready.then(()=>{if(hosts&&standing)refreshExhibits()})
    welcome=createVinciWelcome(h.labels,route=>{if(route==='life'){openLife();return}if(route==='collection')enterCollection();focusTheBar()})
    controller=new AbortController();const options={signal:controller.signal}
    // A MACHINE'S MARK IS READ OFF ITS PARTS, and they land after the room
    // does: the registry is read again each time a machine stands.
    let marksQueued=0
    const offMachines=onMachineStanding(()=>{if(marksQueued)return;marksQueued=window.setTimeout(()=>{marksQueued=0;if(hosts&&standing)refreshExhibits()},60)})
    controller.signal.addEventListener('abort',()=>{offMachines();clearTimeout(marksQueued)})
    const wheelStep=createWheelStepper(()=>performance.now())
    // A notch asks for the next station AND walks a stride along the leg that
    // is under way, so a visitor who keeps scrolling keeps moving instead of
    // waiting the walk out, and the station asked for is never lost.
    h.stage.addEventListener('wheel',(e)=>{if(e.ctrlKey||e.defaultPrevented||(e.target as Element).closest('.vinci-dock,.wing-rail-group,.vinci-exhibit-card,.vinci-strip,.vinci-heading'))return;e.preventDefault();const step=wheelStep(e.deltaY,e.deltaMode,innerHeight);if(!step)return;rail.stride(1);h.navigate(station+step)},{...options,passive:false})
    // A PRESS IS A PRESS, NOT A DRAG AND NOT A SWIPE. A flick on the phone is
    // still a station, a drag is still a look, and what is left is one ray.
    bindRailPointer({stage:h.stage,signal:controller.signal,
      ignores:target=>Boolean(target?.closest?.('button,a,input,textarea,select,.vinci-dock,.wing-rail-group,.vinci-exhibit-card,.vinci-heading,.vinci-strip')),
      began:()=>{if(sheetOpen){sheetOpen=false;paintSheet()}},
      look:(dx,dy,height)=>rail.drag(dx,dy,height),
      step:direction=>h.navigate(station+direction),
      press:(x,y)=>pressExhibit(x,y)})
    window.addEventListener('keydown',(e)=>{
      if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey)return
      const target=e.target instanceof Element?e.target:document.body
      if(document.querySelector('dialog[open]'))return
      if(target.closest('input,textarea,select,[contenteditable="true"]'))return
      // THE PAYLOAD TAKES ITS OWN KEYS FIRST: a machine's arrows turn its
      // crank and, with Shift, its table. The wall is walked up and down.
      if(closeLook?.id&&closeLook.key(e)){e.preventDefault();return}
      if(e.shiftKey)return
      // THE READER OWNS ITS OWN KEYS. Nothing typed inside an open exhibit
      // walks the rail or cycles the label layer, and Escape is one step back.
      if(closeLook?.id&&(e.key==='Escape'||e.key.startsWith('Arrow')||closeLook.owns(target))){
        // ONE SURFACE BACK, EXACTLY ONE. The record a close look opened stands
        // over its label, so Escape puts the record away before the window.
        if(e.key==='Escape'&&deskOn('closelook')&&!narrow()&&mode===2&&exhibitSources){e.preventDefault();mode=1;paintDock();return}
        if(e.key==='Escape'){e.preventDefault();closeLook.close();return}
        // THE ARROWS WALK THE WALL while an exhibit stands: the station rail
        // is what the visitor left to come here.
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();stepExhibit(1)}
        if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();stepExhibit(-1)}
        return
      }
      // THE DEEPEST SURFACE ANSWERS ESCAPE FIRST. The desktop's drawer is one
      // step back from wherever the hand is inside it, and it stands under
      // the reader, which is why it is asked after the reader and before the
      // room's own three answers.
      if(e.key==='Escape'&&desk?.key(e)){e.preventDefault();return}
      if(e.key==='Escape'&&sheetOpen&&narrow()){e.preventDefault();sheetOpen=false;paintSheet();return}
      // ESCAPE CLOSES THE CARD FIRST (above), then stands the visitor off the
      // wall at the nearer of the room's two ends.
      if(e.key==='Escape'&&onWallStop()){e.preventDefault();mode=1;rail.look(0,0);paintDock();leaveWall();return}
      if(e.key==='Escape'){e.preventDefault();mode=1;rail.look(0,0);paintDock();sourceControl().focus({preventScroll:true});return}
      if(e.key.toLowerCase()==='l'&&!e.repeat){e.preventDefault();mode=((mode+1)%3) as VinciLabelMode;paintDock();if(mode!==2&&target.closest('.vinci-dock'))sourceControl().focus({preventScroll:true});return}
      if(e.key.toLowerCase()==='p'&&!e.repeat){e.preventDefault();openPlan();return}
      if(e.key.toLowerCase()==='e'&&!e.repeat){e.preventDefault();openLife();return}
      if(target.closest('.vinci-dock'))return
      // THE ARROWS STEP THE WALL, with or without a card. Left and right are
      // the hang's own order, which is the way each end's frame reads it: at
      // the east end the wall runs away to the right and at the west end back
      // to the left, so one rule agrees with both. Up and down stay the
      // station rail, except at a stop, where they are the wall too.
      if(wallAt()!==undefined&&!target.closest('.vinci-strip')){
        const step=e.key==='ArrowRight'||(onWallStop()&&e.key==='ArrowDown')?1
          :e.key==='ArrowLeft'||(onWallStop()&&e.key==='ArrowUp')?-1:0
        if(step){e.preventDefault();stepWall(step);return}
        const stops=wallRow()
        if((e.key==='Home'||e.key==='End')&&stops.length){e.preventDefault();wallRun(stops[e.key==='Home'?0:stops.length-1]!.exhibit);return}
      }
      // SPACE IS THE GOLD CONTROL, which the right arrow already presses: one
      // meaning everywhere. The way back is the left arrow, as it is today.
      if(desk?.key(e)){e.preventDefault();return}
      if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();h.navigate(station+1)}
      if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();h.navigate(station-1)}
    },options)
    // The instruments panel of the museum opens the plan of the wing standing.
    window.addEventListener('na-wing-plan',()=>openPlan(),options)
    // THE SHEET TAKES ITS OWN GESTURE: a drag up opens it, a drag down or a
    // tap on the peek closes or opens it, and the card itself outlives every
    // repaint, so this is bound once.
    let sheetFrom=0,sheetHeld=false
    header.addEventListener('pointerdown',(e)=>{if(!narrow()||!e.isPrimary)return;sheetHeld=true;sheetFrom=e.clientY},options)
    header.addEventListener('pointerup',(e)=>{
      if(!sheetHeld||!narrow())return
      sheetHeld=false
      if((e.target as Element).closest('.vinci-sheet-grab'))return
      const dy=e.clientY-sheetFrom
      const want=dy<-24?true:dy>24?false:Math.abs(dy)<=8?!sheetOpen:sheetOpen
      if(want!==sheetOpen){sheetOpen=want;paintSheet()}
    },options)
    header.addEventListener('pointercancel',()=>{sheetHeld=false},options)
    window.addEventListener('resize',()=>{placeCanonicalStation();paintDock()},options)
    standing=true
    card=station
    const stop=stopAt(card),s=stationOf(stop.station)
    aimPrint(s.id);exposureAt=s.id;rail.set(s.id,vinciWalkPose(stop,narrow()),true,narrow(),walkVertex(stop));paintHeader();paintDock();standHere()
    if(pendingView){const id=pendingView;pendingView='';showView(id)}
    announceBuilt()
  }
  function standShadowCache():void {
    if(!hosts||!standing)return
    const {scene,camera,stack}=hosts.world
    shadowCache?.dispose()
    shadowCache=createStaticShadowCache(scene,camera,stack.renderer,()=>stack.materials.pending())
  }
  /** The one measure the field shows. Counted, never timed: it may not run
   * backwards and it may not stand at 1 while a body or a pose is unpaid. */
  function entryShare():WingProgress {
    if(!hosts)return {stage:'house',share:null}
    // the house's own library sets: what is still in flight, against the most
    // that was ever in flight at once
    const left=hosts.world.stack.materials.pending()
    setsAsked=Math.max(setsAsked,setsUp+left)
    setsUp=Math.max(setsUp,setsAsked-left)
    // A SET IS TENS OF MEGABYTES ON A PHONE, and counted whole it is a line
    // that cannot move until the file lands. What is already over the wire
    // counts too, in sets, so the wait is measured rather than waited out.
    const wire=hosts.world.stack.materials.paid?.()??0
    const bodies=exhibits?.bodies()??{done:0,total:0}
    const done=bodies.done+setsUp+wire+posesUp+houseUp
    const asked=bodies.total+setsAsked+posesAsked+HOUSE_STEPS
    shareUp=Math.max(shareUp,Math.min(1,asked>0?done/asked:0))
    // the poses hold at their last one until every body stands, so the stage
    // that gates is the one named; it only ever moves forward
    stageAt=Math.max(stageAt,bodies.done<bodies.total||setsUp<setsAsked?1:2)
    return {stage:ENTRY_STAGES[stageAt]!,share:shareUp}
  }
  /** Every station's own eye, drawn once behind the loading field, so the
   * first leg meets pipelines that already exist. The near cascade travels
   * with the eye, so it is re-aimed at each pose: a caster warmed outside it
   * never compiles its depth pass. */
  async function warmUp():Promise<void> {
    if(!hosts||!standing)return
    // one ordinary frame first: the rail places the station's eye, and the
    // pose the warm up restores at the end is the one the visitor arrives at
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
    if(!hosts||!standing)return
    const {scene,camera,stack}=hosts.world
    const wide=narrow()
    // a warm frame draws the shadow map too, which is where the depth
    // pipelines are built; the cache takes over once they exist
    key.light.shadow.autoUpdate=true
    warmUnderField=document.body.classList.contains('entering')
    warm=warmWalk(stack,scene,camera,WALK.stops.map(stop=>vinciWalkPose(stop,wide)),done=>{posesUp=Math.max(posesUp,done)},()=>focusNearCascade(true))
    await warm.done
    warm=undefined
    focusNearCascade(true)
    standShadowCache()
    // THE PANEL IS FOR A VISITOR, and a visitor cannot see it until the
    // entry's own field lifts: a modal sheet is drawn in the top layer, over
    // the field and its backdrop over the gold. The eyes arrive through the
    // forge marker, and a sheet over the arrival frame would stand in every
    // frame they shoot.
    if(!document.body.classList.contains('forge')&&!vinciWelcomeSeen()&&card===0)welcome?.open()
  }
  /** THE EYE IS THE VISITOR'S ONCE THEY CAN USE IT. The warm up parks the
   * camera on the walk's poses, and on a slow device the entry's field lifts
   * on its own cap while it still runs. A leg leaves only from the eye the
   * rail placed, so a press, or the field lifting, ends the warm up first. */
  function yieldEye():void{if(warm){warm.abort();warm=undefined}}
  /** A LEG THE RAIL CANNOT PROVE IS NOT WALKED: the look still opens where
   * the visitor stands, and the refusal is said on the console. */
  const proved=(leg:()=>boolean):boolean=>{try{return leg()}catch(error){console.error(error);return false}}
  /** AN EXHIBIT'S NAME IN BOTH LANGUAGES, from the module that owns its kind.
   * Two kinds publish one language only, and there their own record is the
   * title in both columns rather than a second one being invented. */
  /** THE CODEX A PICK STANDS FOR: the shelf's own record, whether the pick is
   * the bound book or one admitted leaf of it. A leaf carries its codex in its
   * own stem, `leaf/paris-B-83v`, so one lookup names both. */
  function pickCodex(id:string) {
    const stem=id.startsWith('leaf/')?id.slice('leaf/'.length).replace(/-\d+[rv]$/,'')
      :id.startsWith('codex/')?id.slice('codex/'.length):''
    return stem?CODEX_ENTRIES.find(entry=>entry.id===stem):undefined
  }
  function exhibitTitleBi(pick:VinciPickEntry):VinciText|null {
    if(pick.kind==='machine'){const slug=pick.id.slice('machine/'.length);return isMachineSlug(slug)?machineCatalog[slug].title:null}
    if(pick.id===LINE_FLOOR_PICK){const here=vinciContent.find(entry=>entry.id===pick.station);return here?here.name:null}
    if(pick.kind==='stud'){const stud=LINE_STUDS[vinciStudIndex(pick.id)];return stud?{en:stud.date_label_en,de:stud.date_label_de}:null}
    if(pick.kind==='manuscript'){const codex=pickCodex(pick.id);return codex?{en:codex.en,de:codex.de}:null}
    if(pick.kind==='place'||pick.workId===DEATHBED_WORK){const named=namedExhibit(pick);return named?{en:named.title,de:named.title}:null}
    const found=(exhibits?.pictureSources()??[]).find(source=>source.work.id===pick.workId)
    if(!found)return null
    return workTitle(found.work,pick.face)
  }
  /** TWO FACES OF ONE PANEL ARE TWO EXHIBITS, and the register names the
   * reverse as its own, so a list that holds both never says one name twice.
   * A short name stands where a cell has two rows for it. */
  interface WorkNames {title_en:string;title_de:string;short_title_en?:string;short_title_de?:string
    reverse_title_en?:string;reverse_title_de?:string;reverse_short_title_en?:string;reverse_short_title_de?:string}
  function workTitle(work:WorkNames,face:'front'|'reverse'|null|undefined):VinciText {
    if(face!=='reverse')return {en:work.title_en,de:work.title_de}
    return {en:work.reverse_title_en??work.title_en,de:work.reverse_title_de??work.title_de}
  }
  function exhibitShort(id:string):string|null {
    const pick=picks.find(entry=>entry.id===id)
    const work=pick?.workId?(exhibits?.pictureSources()??[]).find(source=>source.work.id===pick.workId)?.work:undefined
    if(!pick||!work)return null
    const names:WorkNames=work
    const short=pick.face==='reverse'?{en:names.reverse_short_title_en,de:names.reverse_short_title_de}
      :{en:names.short_title_en,de:names.short_title_de}
    return short.en&&short.de?text({en:short.en,de:short.de}):null
  }
  /** THE WORKS THE PLAN OFFERS: the registry's own openable exhibits, each
   * under the station it hangs in, in that wall's own order. */
  function planHighlights():PlanHighlight[] {
    const row:{order:number;entry:PlanHighlight}[]=[]
    for(const pick of picks){
      if(!pick.openable||!pick.station)continue
      const title=exhibitTitleBi(pick)
      if(!title)continue
      row.push({order:pick.order,entry:{id:pick.id,station:pick.station,title,kind:pick.kind}})
    }
    return row.sort((a,b)=>a.order-b.order).map(item=>item.entry)
  }
  /** The recap names what the night holds, so it is composed again whenever
   * that changed: a work opened and closed, and the registry read that lets
   * an id be named at all. */
  function refreshRecap():void {
    if(standing&&hosts&&hereContent().id==='grave')paintHeader()
  }
  /** THE RECAP AT THE EXIT. The night holds ids, so every title and every
   * line is resolved here from the wing's own registers, the way the card
   * resolves them, and an id the registry cannot name is simply not shown. */
  function recapAtTheGrave():HTMLElement {
    const frame=hosts?.stage.parentElement
    return createWingRecap({lang,narrow,throughLine:()=>text(vinciThroughLine),
      opened:()=>visit?.opened??[],
      resolve:id=>{
        const pick=picks.find(entry=>entry.id===id)
        const title=pick?exhibitTitleBi(pick):null
        return title&&pick?{id,title:text(title),line:vinciLine(id),station:pick.station??''}:null
      },
      onLobby:()=>frame?.querySelector<HTMLElement>('.wing-lobby')?.click(),
      // THE DOOR IS THE FRAME'S OWN, pressed from here: a second link would
      // walk past the disclosure the frame puts in front of the first press.
      door:()=>({word:text(WING_TEXT.door),press:()=>frame?.querySelector<HTMLElement>('.wing-door')?.click()}),
      // The card is composed again, so the hand keeps the control it pressed.
      onForget:()=>{visit?.forget();paintHeader();header.querySelector<HTMLElement>('.wing-recap-forget')?.focus({preventScroll:true})}})
  }
  /** A WORK CHOSEN ON THE PLAN. The visitor is walked to the station the work
   * hangs in and the work opens when that walk ends, so the plan uses the
   * museum's own grammar and adds no cut of its own. */
  function openFromPlan(id:string):void {
    if(!hosts)return
    const station=vinciApproachStation(id)??picks.find(pick=>pick.id===id)?.station
    const index=station?walkIndexAt(station):-1
    if(index<0)return
    pendingExhibit=`walk:${id}`
    if(index!==card)hosts.navigate(index)
  }
  /** THE WING AS A PLAN, from the geometry the site and the collection have
   * already declared: the pavilion's three rooms, the court with its parapet,
   * the grave's floor, the field the dates are cut into, the wall that is not
   * here, the house footprint, and every station at its own certified eye.
   * Nothing in here measures the scene, so the plan costs no draw. */
  function planSite():PlanSite {
    const box=(west:number,east:number,south:number,north:number):PlanPoint[]=>
      [[west,south],[east,south],[east,north],[west,north]]
    const rooms:PlanRoom[]=[
      {id:'court',name:vinciPlanRooms.court,kind:'court',west:COURT.west,east:COURT.east,south:COURT.south,north:COURT.north,built:true},
      // The grave's floor is the west half of the court's paving, at the
      // offsets the room module builds it from.
      {id:'grave',name:vinciPlanRooms.grave,kind:'court',west:GRAVE_ORIGIN.east-4,east:GRAVE_ORIGIN.east+9,south:GRAVE_ORIGIN.north-6,north:GRAVE_ORIGIN.north+6,built:true},
      {id:ROOMS.picture.id,name:vinciPlanRooms['picture-room'],kind:'room',west:ROOMS.picture.west,east:ROOMS.picture.east,south:ROOMS.picture.south,north:ROOMS.picture.north,built:true},
      {id:ROOMS.hall.id,name:vinciPlanRooms['mechanism-hall'],kind:'room',west:ROOMS.hall.west,east:ROOMS.hall.east,south:ROOMS.hall.south,north:ROOMS.hall.north,built:true},
      {id:ROOMS.gallery.id,name:vinciPlanRooms['long-gallery'],kind:'room',west:ROOMS.gallery.west,east:ROOMS.gallery.east,south:ROOMS.gallery.south,north:ROOMS.gallery.north,built:true},
      // The cut field is drawn where the floor is cut, which is the declared
      // field clipped to the room that carries it.
      {id:'line-field',name:null,kind:'field',west:LINE_FIELD.west,east:LINE_FIELD.east,
        south:Math.max(LINE_FIELD.south,ROOMS.gallery.south),north:Math.min(LINE_FIELD.north,ROOMS.gallery.north),built:true},
    ]
    const shapes:PlanShape[]=[
      // THE HOUSE IS NOT OPEN. Its rooms are shown from outside, so its
      // footprint is an outline and never a fill.
      {id:'house',name:vinciPlanRooms.house,points:dossier.site.footprint.map(point=>[point.value[0]!,point.value[1]!] as PlanPoint),closed:true,fill:false,built:false},
      {id:'supper-wall',points:box(SUPPER_WALL.east-SUPPER_WALL.thickness/2,SUPPER_WALL.east+SUPPER_WALL.thickness/2,
        SUPPER_WALL.north-SUPPER_WALL.length/2,SUPPER_WALL.north+SUPPER_WALL.length/2),closed:true,fill:true,built:true},
      {id:'parapet-north',points:box(COURT.west,COURT.east,COURT.north-COURT.parapetThickness,COURT.north),closed:true,fill:true,built:true},
      {id:'parapet-west',points:box(COURT.west,COURT.west+COURT.parapetThickness,COURT.south,COURT.north),closed:true,fill:true,built:true},
      {id:'parapet-east',points:box(COURT.east-COURT.parapetThickness,COURT.east,COURT.south,COURT.north),closed:true,fill:true,built:true},
    ]
    const eyes=vinciContent.map(station=>{const eye=stationPose(station.id,false).eye;return {east:eye.x,north:-eye.z}})
    const stations:PlanStation[]=vinciContent.map((station,index)=>{
      const here=eyes[index]!
      return {id:station.id,number:Math.max(0,walkIndexAt(station.id))+1,name:station.name,group:station.group,east:here.east,north:here.north,
        // FOUR ROOMS ENTERED FROM ONE PLACE ARE ONE MARK. The rail's own
        // poses say which stations share a standing place, so the drawing
        // carries the standstill instead of explaining it.
        sharesPoseWith:vinciContent.flatMap((other,at)=>at===index||eyes[at]!.east!==here.east||eyes[at]!.north!==here.north?[]:[other.id])}
    })
    return {rooms,shapes,stations,highlights:planHighlights()}
  }
  /** One sheet at a time: a close look stands down for the plan and the plan
   * takes the history entry it pushed, so Back is one press either way. */
  function openPlan():void {
    if(!plan||!standing)return
    if(plan.standing){plan.close();return}
    planAdopt=Boolean(closeLook?.id)
    if(planAdopt)closeLook?.close(false)
    plan.show()
    planAdopt=false
  }
  /** ONE SHEET AT A TIME, the way the plan is one: a close look stands down
   * for the life and takes the entry it already pushed. Opened from a date,
   * the view stands at that date. */
  function openLife(at?:string):void {
    if(!life||!standing)return
    if(life.standing){life.close();return}
    lifeAdopt=Boolean(closeLook?.id)
    if(lifeAdopt)closeLook?.close(false)
    life.show(at)
    lifeAdopt=false
  }
  /** THE RECORD BEHIND ONE DATE, opened from the life view. The reader that
   * stands at the floor renders the same chain from its own list; the two
   * stand side by side until that reader retires with the four stations. */
  function renderLifeRecord(stud:Stud,host:HTMLElement):void {
    const page=host.ownerDocument,here=lang()
    /* THE HEADING SAYS HOW SURE THIS DATE'S EVENT IS, in the word the floor
       and the life view use: the window's own four classes are the house's,
       and a timeline row is none of them. */
    const heading=host.querySelector<HTMLElement>('.vinci-certainty')
    const sure=LINE_CERTAINTY[stud.certainty as keyof typeof LINE_CERTAINTY]
    if(heading&&sure){heading.textContent=sure[here];heading.dataset['certainty']=stud.certainty;heading.style.color=sure.colour}
    const full=page.createElement('div');full.className='vinci-record';full.dataset['register']='record'
    const add=(text:string|null|undefined):void=>{
      if(!text)return
      const line=page.createElement('p');line.className='vinci-statement';line.textContent=text;full.append(line)}
    add(here==='de'?stud.date_label_de:stud.date_label_en)
    add(here==='de'?stud.date_note_de:stud.date_note_en)
    add(SOURCE_READINGS[stud.id]?.[here])
    add(stud.document);add(stud.holder)
    add(here==='de'?stud.qualifications_de:stud.qualifications_en)
    for(const gap of here==='de'?stud.gaps_de:stud.gaps)add(gap)
    // A link names the source as a person would, never the field it filled.
    for(const source of stud.sources){
      const link=page.createElement('a');link.className='vinci-picture-source'
      link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=here==='de'?source.name_de:source.name_en
      full.append(link)}
    add(stud.licence_line)
    const limits=studLimits(stud)
    const data=page.createElement('pre');data.className='vinci-arithmetic'
    data.textContent=JSON.stringify({edtf:studEdtf(stud),calendar:stud.calendar,earliest:limits.earliest,latest:limits.latest,
      ...(stud.date_precision==='circa'?{about_years:CIRCA_YEARS}:{}),date_original:stud.date_original,
      date_certainty:stud.date_certainty??stud.certainty,date_alternatives:stud.date_alternatives,
      date_note_source:stud.date_note_source,document_status:stud.document_status},null,1)
    full.append(data)
    host.append(full)
  }
  /** The same window the close look opens, over the life's own sheet. The
   * sheet under it is inert while it stands, so the hand is handed back to
   * the door it was opened from. */
  function openLifeRecord(event:LifeEvent,back:()=>void):void {
    const stud=LINE_STUDS.find(entry=>entry.id===event.id)
    if(!stud||!sources)return
    // The window's type admits only its own classes; the heading is rewritten
    // in the row's own word as the record renders.
    exhibitSources={id:`stud/${stud.id}`,title:{en:stud.date_label_en,de:stud.date_label_de},
      certainty:stud.certainty==='documented'?'documented':'conjectural',
      renderStation(host){renderLifeRecord(stud,host)}}
    sources.resetScroll();sources.select('station');mode=2;paintDock()
    sources.element.addEventListener('close',()=>{exhibitSources=null;paintDock();back()},{once:true})
  }
  /** THE TWELVE DATES THE FLOOR CUTS. The gallery lays three rows of four, so
   * these twelve carry the walk and the other forty four say so instead. */
  const LIFE_CUT=new Set(LINE_SECTIONS.flatMap(section=>[0,1,2,3].map(offset=>LINE_STUDS[section.selected+offset]?.id??'')))
  const LIFE_BIRTH=LINE_STUDS.find(stud=>stud.id==='life-01')!,LIFE_DEATH=LINE_STUDS.find(stud=>stud.id==='life-41')!
  /** Both age forms come from the card models, so the reader that stands at a
   * date and this view say them from one place and neither keeps a copy. */
  const LIFE_CARDS=JSON.parse(cardsSource) as {floor_honesty:VinciText
    controls:{shared:{back:VinciText};date:{age:VinciText;age_about:VinciText;next:VinciText;previous:VinciText}}}
  /** THE ROOM'S SHORT NAME, for a control that names the room it leads back
   * to: the full name is a chapter title and runs too long for one. */
  const ROOM_SHORT=(JSON.parse(cardsSource) as {station_short_names?:Record<string,VinciText>}).station_short_names??{}
  const roomName=():string=>{const here=hereContent();return text(ROOM_SHORT[here.id]??here.name)}
  const LIFE_AGE_WORDS={exact:LIFE_CARDS.controls.date.age,about:LIFE_CARDS.controls.date.age_about}
  const SURE_RANK:Record<string,number>={documented:2,inferred:1,tradition:0}
  /** A key the wing does not rank stands under every one it does. */
  const sureRank=(key:string):number=>SURE_RANK[key]??-1
  /** A day and a year apart, in milliseconds: the widest span an age may be
   * said about. */
  const LIFE_YEAR_MS=366*864e5
  function lifeDate(stud:Stud):MuseumDate {
    const bounds=studBounds(stud),limits=studLimits(stud)
    return {edtf:studEdtf(stud),calendar:stud.calendar,earliest:bounds.earliest,latest:bounds.latest,
      label:{en:stud.date_label_en,de:stud.date_label_de},
      // the date's own certainty, where the record says it differs from the event's
      certainty:(stud.date_certainty??stud.certainty) as Sure,
      ...(stud.date_precision==='circa'?{approximate:true,limits}:{}),
      ...(stud.date_precision==='disputed'?{disputed:true}:{}),
      ...(stud.date_note_en&&stud.date_note_de?{note:{en:stud.date_note_en,de:stud.date_note_de}}:{})}
  }
  /** THE AGE BESIDE A YEAR. Exact where every day the date can mean gives the
   * same one. About where the date is a year or a season and the two ends
   * differ, counted at the last day it can mean, which is the age the record's
   * own sentences use. Nothing at all where the span is wider than a year or
   * the life has ended by it. */
  function lifeAge(stud:Stud):{age:number|null;about:boolean} {
    const exact=ageAt(stud,LIFE_BIRTH,LIFE_DEATH)
    if(exact!==null)return{age:exact,about:false}
    const {earliest,latest}=studBounds(stud)
    if(!earliest||!latest||stud.calendar!==LIFE_BIRTH.calendar||earliest<LIFE_BIRTH.date||latest>LIFE_DEATH.date)return{age:null,about:false}
    if(Date.parse(`${latest}T00:00:00Z`)-Date.parse(`${earliest}T00:00:00Z`)>LIFE_YEAR_MS)return{age:null,about:false}
    const [by,bm,bd]=LIFE_BIRTH.date.split('-').map(Number),[y,m,d]=latest.split('-').map(Number)
    const years=y!-by!-(m!<bm!||(m===bm&&d!<bd!)?1:0)
    return years>0?{age:years,about:true}:{age:null,about:false}
  }
  /** THE LIFE THIS WING HOLDS, from the records it already carries: the 56
   * dates with their own calendar and their own sentences, the register's
   * painted works by the years it dates them to, and the people those dates
   * name. Nothing here is scraped and no sentence is retyped. */
  function lifeRecord():LifeRecord {
    const events:LifeEvent[]=[]
    for(const band of vinciLifeBands){
      const first=LINE_STUDS.findIndex(stud=>stud.id===band.from),last=LINE_STUDS.findIndex(stud=>stud.id===band.to)
      if(first<0||last<first)continue
      for(const stud of LINE_STUDS.slice(first,last+1)){
        const {age,about}=lifeAge(stud)
        events.push({id:stud.id,band:band.id,date:lifeDate(stud),certainty:stud.certainty as Sure,
          line:{en:stud.line_en,de:stud.line_de},source:SOURCE_READINGS[stud.id]??null,age,ageApproximate:about,
          walk:LIFE_CUT.has(stud.id)?{stud:`stud/${stud.id}`}:{station:stud.station},exhibit:null,
          people:vinciLifePeople.filter(person=>person.events.includes(stud.id)).map(person=>person.id)})
      }
    }
    const bands:LifeBand[]=[]
    for(const band of vinciLifeBands){
      const own=events.filter(event=>event.band===band.id)
      if(!own.length)continue
      const from=own[0]!.date,to=own[own.length-1]!.date
      // A PERIOD IS DECLARED, NOT MEASURED: the years the wing names it
      // between are what the ribbon draws it to. The rows after the death are
      // on their own clock, so those take the years their own dates fall in.
      const reach=own.map(event=>dateYears(event.date)).filter(Boolean) as {from:number;to:number}[]
      const years=band.years??{from:Math.min(...reach.map(span=>span.from)),to:Math.max(...reach.map(span=>span.to))}
      bands.push({id:band.id,name:band.name,place:band.place,line:band.line,from,to,years,
        ...(band.afterlife?{afterlife:true as const}:{})})
    }
    const people:LifePerson[]=vinciLifePeople.map(person=>({id:person.id,name:person.name,role:person.role,
      events:person.events,
      certainty:person.events.reduce<Sure>((best,id)=>{
        const stud=LINE_STUDS.find(entry=>entry.id===id)
        const kind=(stud?.certainty??'tradition') as Sure
        return sureRank(kind)>sureRank(best)?kind:best},'tradition')}))
    // THE WING NAMES ITS OWN CERTAINTIES: the view holds no word of them, so
    // the key set, the words and the counted clauses all come from here.
    const sure=Object.fromEntries((Object.keys(vinciLifeCertaintyCounted) as (keyof typeof vinciLifeCertaintyCounted)[]).map(key=>
      [key,{word:{en:LINE_CERTAINTY[key].en,de:LINE_CERTAINTY[key].de},
        counted:vinciLifeCertaintyCounted[key],colour:LINE_CERTAINTY[key].colour}])) as LifeRecord['sure']
    const span={from:Number(LIFE_BIRTH.date.slice(0,4)),to:Number(LIFE_DEATH.date.slice(0,4))}
    /* THE FLOOR'S COUNT IS READ FROM THE FLOOR, and names the room it stands
       in, because the sheet opens from every station and not only there. */
    const counted=(language:'en'|'de'):string=>capitalise(fill(vinciLifeFloorCount[language],
      {cut:spokenCount(LIFE_CUT.size,language),total:spokenCount(LINE_STUDS.length,language)}))
    return {bands,events,works:lifeWorks(),people,sure,
      here:LINE_STUDS.find(stud=>stud.date===vinciHourValues.julianDate)?.id,
      words:{throughLine:vinciThroughLine,secondLine:{en:fill(vinciLifeSecondLine.en,span),de:fill(vinciLifeSecondLine.de,span)},
        honesty:{en:counted('en'),de:counted('de')},cut:vinciLifeCut,
        worksRow:vinciLifeWorksRow,worksCount:vinciLifeWorksCount,worksEmpty:vinciLifeWorksEmpty,age:LIFE_AGE_WORDS,back:LIFE_CARDS.controls.shared.back,
        provenance:VINCI_VITRINE_WORDS.provenance,hour:vinciLifeHourMark},
      span}
  }
  /** THE WORKS ROW. The register dates its paintings to a span of years and
   * says how sure that span is; the three it cannot date at all stand apart
   * rather than at a guess. The wing's machines, sheets and codices carry no
   * date in the registers they publish, so they are not on this row. */
  function lifeWorks():LifeWork[] {
    return REGISTER.map(work=>{
      const from=work.date_from,to=work.date_to??work.date_from
      const sure:Sure=work.date_certainty==='documented'?'documented':'inferred'
      const mark=work.date_certainty==='documented'?'':work.date_certainty==='disputed'?'?':'~'
      // A WORK THAT HANGS CAN BE WALKED TO from inside the life: the hang's
      // own exhibit id, where the room has one, and nothing where it has not.
      const front=`picture/${work.id}/front`
      return {id:work.id,title:{en:work.title_en,de:work.title_de},domain:'painting',
        state:work.rights_class==='DG'?'reproduction':'absent',
        exhibit:vinciApproachStation(front)?front:null,
        date:from===null||to===null?null:{edtf:from===to?`${from}${mark}`:`${from}${mark}/${to}${mark}`,
          calendar:'Gregorian',earliest:`${from}-01-01`,latest:`${to}-12-31`,
          label:{en:work.date_label_en,de:work.date_label_de},certainty:sure}}
    })
  }
  /** The station the visitor is standing in, written to the night's record. */
  function standHere():void { visit?.stand(hereContent().id) }
  /** WHERE SOURCES STANDS RIGHT NOW. On a narrow stage its word sits in the
   * card's own sheet, so the hand lands on the sheet's control instead of on
   * a word no eye can see. */
  function sourceControl():HTMLElement {
    if(!narrow()||!header||header.hidden)return source
    return header.querySelector<HTMLElement>('.vinci-sheet-grab')??source
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
    // THE WAY IN IS THE WALK'S OWN OPENING: the collection's first room
    // where the rooms are walked in the order they were built, and the life's
    // first stop where the life is walked.
    const index=WALK.cuts.length?0:vinciContent.findIndex(station=>station.group==='collection')
    if(index<0||!hosts)return
    const id=contentAt(index).id
    hosts.navigate(index)
    exhibits?.warm()
    rail.set(id,vinciWalkPose(stopAt(index),narrow()),true,narrow(),walkVertex(stopAt(index)))
    station=card=index;activeView='';aimPrint(id);exposureAt=id;paintHeader();paintHeaderVisibility();paintDock();paintQuestion()
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
  let pendingView='', pendingExhibit=''
  function showView(id:string) {
    if(id==='welcome'){welcome?.open();return}
    if(id.startsWith('sources-')){const tab=id.slice(8);if(tab==='station'||tab==='room'||tab==='wing'){sources.select(tab);mode=2;paintDock();return}}
    const inspectCost=id.endsWith('-cost')&&id!=='audit-cost';if(inspectCost)id=id.slice(0,-5);const s=hereContent();
    // ANY EXHIBIT BY ITS REGISTRY ID: `open:` cuts to it, `walk:` walks the
    // certified leg where the stage walks.
    const named=/^(open|walk):(.+)$/.exec(id)
    if(named){
      if(!picks.length)refreshExhibits()
      const target=picks.find(pick=>pick.openable&&pick.id===named[2])
      if(!target){pendingExhibit=id;return}
      pendingExhibit=''
      placeCanonicalStation()
      openExhibit(target.id,null,named[1]==='walk'?'walk':'cut')
      return
    }
    // THE EYES REACH ONE EXHIBIT BY NAME: the arrival, the leg on the way to
    // it, and the return. A still is a cut; the leg and the return are walked.
    if(id.startsWith('exhibit-')){
      let work=id.slice(8),how:'walk'|'cut'='cut',back=false
      if(work.endsWith('-leg')){work=work.slice(0,-4);how='walk'}
      else if(work.endsWith('-return')){work=work.slice(0,-7);back=true}
      if(!picks.length)refreshExhibits()
      const target=picks.find(pick=>pick.openable&&pick.workId===work&&pick.face==='front')
      if(!target){pendingExhibit=inspectCost?`${id}-cost`:id;return}
      pendingExhibit=''
      // The previous card is replaced by the owner itself, so this never walks
      // the browser's own history back while a new exhibit is opening.
      placeCanonicalStation()
      openExhibit(target.id,null,how)
      if(back)closeLook?.close(false)
      if(inspectCost)measurement.show(`${s.id} / ${id}`)
      return
    }if(id==='scene')endInspection();if(id==='scene'||id.startsWith('audit-'))rail.look(0,0);if(id==='scene'||id==='audit-cost'){mode=1;paintDock()}if(id==='audit-cost')measurement.show(s.id);if(id==='audit-ui'){mode=1;paintDock();measurement.show(s.id,'ui')}if(id==='audit-ui-labels'){mode=2;paintDock();measurement.show(s.id,'ui')}if(id.startsWith('collection-room')||id.startsWith('collection-hang'))exhibits?.warm()
    const pose=namedPose(id,narrow())??collectionView(id,narrow());if(pose){activeView=id;mode=1;paintDock();paintHeaderVisibility();rail.set(s.id,pose,true,narrow());header.querySelector('.vinci-insertion')?.remove();titleForView(id);if(id.startsWith('collection')&&!s.built&&!vinciStandsInRoom(s.id))header.append(make('p','vinci-insertion',lang()==='de'?'Museumseinbau der Gegenwart · Räume im Bau':'Modern museum insertion · Rooms in construction'))}const cone=/(?:^|-)cone-(ul|ur|dl|dr)$/.exec(id);if(cone){placeCanonicalStation();rail.look(cone[1]!.includes('l')?.6:-.6,cone[1]!.startsWith('u')?.32:-.32)}if(id==='labels'||id==='hour'||id==='record'){sources.select(id==='hour'?'wing':'station');mode=2;paintDock();if(id==='record'){if(record.hidden)dock.querySelector<HTMLButtonElement>('.vinci-record-toggle')?.click();dock.scrollTop=record.offsetTop-(dock.querySelector('.vinci-sources-toolbar')?.getBoundingClientRect().height??0)-18}}if(inspectCost&&(pose||cone))measurement.show(`${s.id} / ${id}`)
  }
  /** ONE ENTRY PER EXHIBIT ID. One exhibit of this museum can stand as more
   * than one body in the scene, and the registry is what the row, the marks
   * and a press read: it keeps the body this exhibit's own certified eye is
   * aimed at, so one thing is one cell and the press walks the leg the
   * certificate holds. */
  function oneBodyPerExhibit(entries:VinciPickEntry[]):VinciPickEntry[] {
    const kept=new Map<string,VinciPickEntry>()
    for(const entry of entries) {
      const held=kept.get(entry.id)
      if(!held){kept.set(entry.id,entry);continue}
      const aim=vinciApproachPose(entry.id,false)?.at
      if(aim&&entry.centre.distanceTo(aim)<held.centre.distanceTo(aim))kept.set(entry.id,entry)
    }
    return [...kept.values()]
  }
  /** THE REGISTRY IS A READ, so it is taken again whenever the scene it reads
   * could have changed: when the room's own sources have landed, and when a
   * tier change remounts the plates under new meshes. */
  function refreshExhibits():void {
    if(!hosts||!collectionRoot)return
    picks=oneBodyPerExhibit([...readVinciExhibits(collectionRoot),...(houseRoot?readVinciExhibits(houseRoot):[]),...(courtRoot?readVinciExhibits(courtRoot):[])])
    picksTier=hosts.world.stack.tierName()
    paintExhibitMarks();paintStrip();refreshRecap();plan?.repaint()
    if(pendingExhibit){const id=pendingExhibit;pendingExhibit='';showView(id)}
    openPendingDate()
  }
  /** A date named in the address opens the life view at that date, once the
   * station whose floor carries the line is the one stood in. */
  function openPendingDate():void {
    if(!pendingDate||!standing)return
    const index=LINE_STUDS.findIndex(stud=>stud.id===pendingDate)
    const station=LINE_STUDS[index]?.station
    if(index<0||station!==hereContent().id){if(index<0)pendingDate=null;return}
    const at=pendingDate
    pendingDate=null
    openLife(at)
  }
  /** WHAT A PRESS ON THIS MARK DOES TO THE BODY, asked of the same two
   * answers the close look asks at the press itself, so a mark can never
   * promise a walk the rail then refuses: a run along the hang to a frame the
   * eye does not stand at, or a certified approach from the standing station.
   * Where neither holds, the press opens a label where the visitor stands. */
  function markWalks(id:string):boolean {
    if(isWholePlate(id)||isLeafDoor(id)||activeView||!railReady())return false
    const wall=vinciWallOfExhibit(id), at=wallAt()
    if(wall&&wall===wallOn()&&at!==undefined&&vinciWallVertex(wall,id)!==undefined){
      const stops=wallRow()
      return !(onWallStop()&&at>0&&at<=stops.length&&stops[at-1]!.exhibit===id)
    }
    return vinciApproachStation(id)===hereContent().id&&Boolean(vinciApproachPose(id,narrow()))&&exhibitWalks()
  }
  /** THE WALKING MARK'S OWN WORD, from the card data by key: a walk that
   * crosses into another place is walked into, a walk inside the room the
   * visitor stands in is walked to. */
  const markWord=(station:string|null):string=>
    text(deskControl('walk',station===hereContent().id?'walk_there':'walk_in'))
  /** What each exhibit's mark says and what colour it carries: its own name
   * and its own certainty, both off the picture module's register. */
  function paintExhibitMarks():void {
    const sources=exhibits?.pictureSources()??[]
    const marks:VinciExhibitMark[]=[]
    // the two kinds of mark, decided per exhibit and never by colour alone
    const sign=(entry:{id:string;station:string|null}):{walks:boolean;word:string}=>
      ({walks:markWalks(entry.id),word:markWord(entry.station)})
    for(const entry of picks){
      if(!entry.openable)continue
      /* ONE MARK FOR THE WHOLE LINE. Twelve dots over eighteen metres of floor
         would be the room's loudest thing and say one word twelve times; the
         field carries the mark, the sockets keep their places in the row. */
      if(entry.kind==='stud'&&entry.id!==LINE_FLOOR_PICK)continue
      if(entry.kind==='machine'){
        const slug=entry.id.slice('machine/'.length)
        if(isMachineSlug(slug))marks.push({id:entry.id,anchor:entry.anchor,object:entry.object,label:machineCatalog[slug].title[lang()],colour:PICTURE_CERTAINTY_KEY[2]!.colour,...sign(entry)})
        continue
      }
      const named=namedExhibit(entry)
      if(named){marks.push({id:entry.id,anchor:entry.anchor,object:entry.object,label:named.title,colour:named.colour,...sign(entry)});continue}
      const found=sources.find(source=>source.work.id===entry.workId)
      if(!found)continue
      const entries=sources.filter(source=>source.work.id===entry.workId).map(source=>source.entry)
      marks.push({id:entry.id,anchor:entry.anchor,object:entry.object,
        label:text(workTitle(found.work,entry.face)),
        colour:policyLabelText(found.work,entries).colour,...sign(entry)})
    }
    // THREE MARKS AT A STOP, AND WHICH THREE: this work and its two
    // neighbours. Standing in front of one painting, what a hand wants is the
    // one it is looking at and the two it can step to.
    const at=wallAt(), stops=wallRow()
    if(onWallStop()&&at!==undefined&&at>0&&at<=stops.length){
      const near=new Set([stops[at-2]?.exhibit,stops[at-1]!.exhibit,stops[at]?.exhibit].filter(Boolean) as string[])
      dots?.setExhibits(marks.filter(entry=>near.has(entry.id)))
      return
    }
    dots?.setExhibits(marks)
  }
  /** THE NAME UNDER THE PAINTING, at a stop with no card over it. Both words
   * are the register's own, sealed: the title and the year. It leaves with the
   * card, with the marks and while a leg is under way. */
  function paintQuietLabel():void {
    if(!quiet||!quietName||!quietYear||!quietDot||!hosts)return
    const at=wallAt(), stops=wallRow()
    const stop=onWallStop()&&at!==undefined&&at>0&&at<=stops.length?stops[at-1]:undefined
    const pick=stop?picks.find(entry=>entry.id===stop.exhibit):undefined
    const sources=stop?exhibits?.pictureSources()??[]:[]
    const found=stop?sources.find(source=>source.work.id===stop.workId&&source.entry.face===stop.face):undefined
    // A SHEET CARRIES ONE LINE, NOT TWO. The register gives a drawing its
    // holder's own words and no dated title, so the year line stands down.
    const sheet=stop&&!found?exhibits?.sheetSources().find(source=>`sheet/${source.sheet.id}`===stop.exhibit):undefined
    const rect=pick&&(found||sheet)&&!closeLook?.id&&mode!==0&&!activeView?workRect(pick.object):null
    quiet.hidden=!rect
    if(!rect)return
    if(sheet&&!found){
      quietName.textContent=vinciSheetTitle(lang()==='de'?sheet.page.honesty_de:sheet.page.honesty_en)
      quietYear.textContent=''
      quietDot.style.setProperty('--certainty',certaintyColour('documented'))
    }else{
    if(!found)return
    const entries=sources.filter(source=>source.work.id===found.work.id).map(source=>source.entry)
    // the number cast on the frame stands before the name it answers to
    const numbered=hangNumber(frameKey(found.work.id,found.entry.face))
    quietName.replaceChildren(...(numbered===null?[]:[make('span','vinci-quiet-number',String(numbered))]),text(workTitle(found.work,found.entry.face)))
    quietYear.textContent=lang()==='de'?found.work.date_label_de:found.work.date_label_en
    quietDot.style.setProperty('--certainty',policyLabelText(found.work,entries).colour)
    }
    // THE NAME NEVER STANDS IN THE ROW. A work at its own viewing eye fills
    // the frame to the foot, so the label takes the last clear band above the
    // wall's own instrument instead of standing behind it.
    const floor=markFloor()-12
    quiet.style.left=`${Math.round(rect.left+rect.width/2)}px`
    quiet.style.top=`${Math.round(Math.min(rect.top+rect.height+12,floor-quiet.offsetHeight))}px`
  }
  /** WHAT STANDS AT THE FOOT OF THE FRAME. The row at rest, measured where
   * it is, or the frame's own foot where no row stands: both the quiet label
   * and the marks are held above it. */
  function markFloor():number {
    const row=strip?.element.getBoundingClientRect()
    return row&&row.height>0?row.top:deskStageHeight()
  }
  /** THE BAND EVERY WINDOW KEEPS. A window wider than the picture crops its
   * top and foot, down to 21:9, and the old chrome's row held every mark
   * above that crop's foot. Where the desktop's chrome stands, a mark's
   * whole target stays inside what that crop keeps. */
  function markSafeFoot():number {
    if(!desk)return 0
    const height=deskStageHeight(), kept=Math.min(height,innerWidth/(21/9))
    return Math.ceil((height-kept)/2)+22
  }
  /** THE ROW UNDER THE CARD. It stands wherever a station holds more than
   * one exhibit: docked under the station card on the wide stage, above the
   * bar on the narrow one, and down while a card covers that row. */
  function paintStrip():void {
    if(!strip||!hosts||!standing)return
    strip.setEntries(stationExhibits(),text(hereContent().name))
    const open=closeLook?.id??null
    const stops=wallRow(), at=wallAt()
    // ON A WALL THE ROW IS THE WALL'S INSTRUMENT: it says where along the hang
    // the eye stands and carries the way back to the end it came in by.
    strip.setWall(at===undefined||!stops.length?null:{place:onWallStop()&&at<=stops.length?at:0,total:stops.length,
      hang:wallOn()?.id===VINCI_PICTURE_WALL,whole:()=>wholeWall()})
    strip.setHidden(mode===2||(narrow()&&Boolean(open)))
    // ONE SELECTOR PER VIEW. A leaf opens in the reader, which brings its own
    // strip of the same set of sides; the one reader that stands without a
    // strip opens at a station that holds no row of its own.
    strip.setViewSelector(Boolean(open?.endsWith(LEAF_DOOR)||open?.startsWith('codex/')))
    // THE ROW NEVER STANDS OVER A WORK. On the wide stage it runs along the
    // foot of the frame above the bar, which is where a row of twenty five
    // can be large enough to recognise; while a window holds the stage the
    // row goes under that window's own words, a work's and a machine's alike,
    // so it covers neither the work nor the controls beneath it; the phone
    // keeps it above the bar and stands it down while a window is open.
    if(narrow())strip.dock(null,hosts.labels)
    else if(open&&closeLook)strip.dock('inline',closeLook.foot)
    else strip.dock('foot',hosts.labels)
    strip.setOpen(open)
  }
  /** THE WHOLE WALL: back to the end the visitor came in by. From a stop the
   * rail runs off the wall at its nearer end first, which is the line it is
   * certified on, and the walk to the east end goes on from there. */
  function wholeWall():void {
    const wall=wallOn(), at=wallAt()
    const end=wall?vinciWallNearerEnd(wall,at??0):VINCI_WALL_ENDS[0]
    const index=walkIndexAt(end)
    if(index>=0)hosts?.navigate(index)
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
  function exhibitWalks(chained=false):boolean {
    if(!hosts||activeView||!railReady())return false
    if(hosts.world.stack.tierName()==='calm'||narrow())return false
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return false
    const nav=rail.navigation
    // A chain leaves FROM a standing viewing eye, which is the one state an
    // approach may not begin in.
    return chained?Boolean(nav.exhibit)&&!nav.active:!nav.active&&!nav.exhibit
  }
  /** WHAT NO MARK OF THE ROOM MAY STAND UNDER: the vitrine, the sources
   * window, and on the phone the station's own sheet, edge included. */
  function readingRect():{left:number;top:number;right:number;bottom:number}|null {
    const open=closeLook?.id?closeLook.reading():null
    if(open)return {left:open.left,top:open.top,right:open.left+open.width,bottom:open.top+open.height}
    if(dock.open)return dock.getBoundingClientRect()
    if(narrow()&&header&&!header.hidden&&header.dataset['sheet'])return header.getBoundingClientRect()
    return null
  }
  /** EVERY PANEL STANDING OVER THE ROOM. A mark stands in none of them: the
   * reading, the station's own card, the hang strip and the bar are read, and
   * a 44 px target on their words is drawn across a sentence or buried under
   * one. The boxes are taken fresh each frame, so a mark returns the moment
   * its panel leaves. */
  function standingPanels(reading:VinciLabelRect|null):VinciLabelRect[] {
    // the words are a panel too, once the free area is a contract: no mark of
    // either kind may stand under them
    const panels:VinciLabelRect[]=reading?[reading,...(desk?.panels()??[])]:[...(desk?.panels()??[])]
    for(const node of [header,strip?.element,barEl]){
      if(!node||node.hidden)continue
      const box=node.getBoundingClientRect()
      if(box.width>0&&box.height>0)panels.push({left:box.left,top:box.top,right:box.right,bottom:box.bottom})
    }
    return panels
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
  function showExhibitRecord(id:string,work:Parameters<typeof createPictureRecord>[0],entries:Parameters<typeof createPictureRecord>[1],
    evidence:Parameters<typeof createPictureRecord>[1]=[]):void {
    const record=createPictureRecord(work,entries,evidence)
    record.hidden=false
    exhibitSources={id,title:{en:work.title_en,de:work.title_de},
      certainty:pictureCertainty(policyLabelText(work,entries).colour),
      renderStation(host){
        host.append(record)
        // What the evidence does not say and what the view invents: two slots
        // a text seat fills, empty until it does.
        for(const slot of ['limit','visual_note']){const empty=make('p','vinci-statement');empty.dataset['slot']=slot;empty.hidden=true;record.append(empty)}
        fillVinciLimitSlots(id,record)
      }}
    sources.resetScroll();sources.select('station');mode=2;paintDock()
  }
  /** The colour of the wing's own certainty word, off the picture module's key. */
  function certaintyColour(key:VinciCertainty):string {
    const order:VinciCertainty[]=['documented','unknown','reconstructed','conjectural']
    return PICTURE_CERTAINTY_KEY[order.indexOf(key)]!.colour
  }
  const placeCertainty=(key:VinciPlaceCertainty)=>({word:text(vinciCertaintyWords[key]),colour:certaintyColour(key)})
  /** THE KINDS WHOSE NAME IS THEIR OWN RECORD'S: the grave's places, the plaque
   * and the painting at the grave. */
  function namedExhibit(pick:VinciPickEntry):{title:string;colour:string}|null {
    // THE FLOOR CARRIES THE STATION'S OWN NAME: it is the whole line, so the
    // one mark over it says what the station says and opens the whole life.
    if(pick.id===LINE_FLOOR_PICK){const here=vinciContent.find(entry=>entry.id===pick.station)
      return here?{title:text(here.name),colour:certaintyColour('documented')}:null}
    if(pick.kind==='stud'){const stud=LINE_STUDS[vinciStudIndex(pick.id)];return stud?{title:lang()==='de'?stud.date_label_de:stud.date_label_en,colour:LINE_CERTAINTY[stud.certainty as keyof typeof LINE_CERTAINTY].colour}:null}
    if(pick.kind==='manuscript'){const codex=pickCodex(pick.id);return codex?{title:lang()==='de'?codex.de:codex.en,colour:certaintyColour('documented')}:null}
    if(pick.kind!=='place'&&pick.workId!==DEATHBED_WORK)return null
    const named=vinciPlaceTitle(pick.id as VinciPlaceId)
    return {title:named.title,colour:certaintyColour(named.certainty)}
  }
  /** THE ROOM WHOSE WALL IS WALKED. Its two end stations are the ends of one
   * certified line and the twenty five stops stand between them, so both ends
   * hold the same row and the same works. */
  /** Two stations share a row where they end the same wall, which is what
   * makes both ends of the hang hold all twenty five. */
  const sameWall=(a:string|null,b:string|null):boolean=>{
    const wall=vinciWallOfStation(a)
    return Boolean(wall&&wall===vinciWallOfStation(b))
  }
  /** The wall the eye stands on, and where along it. Vertex 0 and, on a wall
   * with two ends, the last are station eyes; a stop stands between them. */
  const wallOn=():VinciWall|undefined=>standing?vinciWallById(rail.navigation.wallId??''):undefined
  const wallAt=():number|undefined=>standing?rail.navigation.wall:undefined
  const wallRow=():readonly{index:number;exhibit:string;workId:string|null;face:'front'|'reverse'|null}[]=>{
    const wall=wallOn()
    return wall?vinciWallStops(wall):[]
  }
  const onWallStop=():boolean=>{const wall=wallOn(),at=wallAt();return Boolean(wall&&at!==undefined&&!vinciWallIsEnd(wall,at)&&at>0&&at<=wall.stops().length)}
  /** A RUN ALONG THE WALL. The eye leaves the stop it stands at, slides past
   * every frame between here and there and stops square in front of the one
   * asked for. A second press is queued by the rail, never cut. */
  function wallRun(exhibit:string):boolean {
    const wall=vinciWallOfExhibit(exhibit)
    if(!wall||wall!==wallOn())return false
    const vertex=vinciWallVertex(wall,exhibit)
    if(vertex===undefined||wallAt()===undefined||!railReady()||activeView)return false
    const pose=vinciApproachPose(exhibit,narrow())
    if(!pose)return false
    yieldEye()
    return proved(()=>rail.along(vertex,hereContent().id,pose,exhibit))
  }
  /** One stop along the wall, with or without a card. Right runs on to the
   * later work and left back to the earlier, which is the way each end's own
   * frame reads it: at the east end the wall runs away to the right, at the
   * west end back to the left. */
  function stepWall(step:number):void {
    const at=wallAt(), wall=wallOn()
    if(at===undefined||!wall)return
    const stops=vinciWallStops(wall)
    const want=Math.max(1,Math.min(stops.length,at+step))
    if(want===at)return
    const stop=stops[want-1]!
    if(closeLook?.id){openExhibit(stop.exhibit,null);return}
    wallRun(stop.exhibit)
  }
  /** Off the wall at the nearer of the room's two ends, which is where a walk
   * that leaves the wall begins. */
  function leaveWall():void {
    const at=wallAt(), wall=wallOn()
    if(at===undefined||!wall||vinciWallOfStation(hereContent().id)&&!onWallStop())return
    const end=vinciWallNearerEnd(wall,at)
    const index=walkIndexAt(end)
    if(index>=0)hosts?.navigate(index)
  }
  /** THE STANDING STATION'S OWN ROW: every exhibit it holds, in the order its
   * wall hangs them, with the name and the certainty the module that owns
   * each kind gives it. The strip paints this and the close look walks it. */
  function stationExhibits():VinciStripEntry[] {
    const here=hereContent().id
    const pictures=exhibits?.pictureSources()??[]
    const sheets=exhibits?.sheetSources()??[]
    const row:{order:number;entry:VinciStripEntry}[]=[]
    for(const pick of picks){
      // The hall is one room under two stations, and both walk its one row.
      // The picture room is one WALL under two: the hang belongs to the line
      // between them, so each end holds all twenty five.
      if(pick.station!==here&&!(pick.kind==='machine'&&vinciMachineRoom(pick.station).includes(here))
        &&!sameWall(here,pick.station))continue
      if((pick.kind==='picture'||pick.kind==='mural')&&pick.workId!==DEATHBED_WORK){
        const found=pictures.find(source=>source.work.id===pick.workId&&source.entry.face===pick.face)
        if(!found)continue
        const entries=pictures.filter(source=>source.work.id===pick.workId).map(source=>source.entry)
        row.push({order:pick.order,entry:{id:pick.id,openable:pick.openable,
          title:text(workTitle(found.work,pick.face)),
          colour:policyLabelText(found.work,entries).colour,
          preview:assetAddress(validatePaintingRecord(found.entry.preview,'painting-preview').entry)}})
      }else if(pick.kind==='sheet'){
        const found=sheets.find(source=>`sheet/${source.sheet.id}`===pick.id)
        if(!found)continue
        row.push({order:pick.order,entry:{id:pick.id,openable:true,
          title:vinciSheetTitle(lang()==='de'?found.page.honesty_de:found.page.honesty_en),
          colour:PICTURE_CERTAINTY_KEY[0]!.colour,
          preview:assetAddress(validateSheetRecord(found.preview,'sheet-thumb').entry)}})
      }else if(pick.kind==='machine'){
        const slug=pick.id.slice('machine/'.length)
        if(!isMachineSlug(slug))continue
        row.push({order:pick.order,entry:{id:pick.id,openable:pick.openable,
          title:machineCatalog[slug].title[lang()],colour:PICTURE_CERTAINTY_KEY[2]!.colour,preview:exhibitPreview(pick)}})
      }else{
        const named=namedExhibit(pick)
        // A DATE KEEPS ITS YEAR. Its cell is the numeral the record gives it,
        // and a picture there would take the one thing that cell says.
        const plate=pick.workId?pictures.find(source=>source.work.id===pick.workId):undefined
        // A DATE KEEPS ITS YEAR, THE FLOOR DOES NOT HAVE ONE: the whole line
        // is one exhibit with a name and no numeral, so its cell takes the
        // picture the other nameless kinds take.
        const numeral=pick.kind==='stud'&&pick.id!==LINE_FLOOR_PICK
        if(named)row.push({order:pick.order,entry:{id:pick.id,openable:pick.openable,title:named.title,colour:named.colour,
          preview:numeral?null:plate?assetAddress(validatePaintingRecord(plate.entry.preview,'painting-preview').entry):exhibitPreview(pick)}})
      }
    }
    // THE SHELF IS THE READING TABLE'S SET: the volume on the table under its
    // plain title, then every book of the collection, each opened on the table
    if(here==='reading-table')for(const [at,book] of SHELF_BOOKS.entries()){
      // the volume stands on the shelf by the page it lies open at, as every
      // other book there stands by one of its pages
      const own=row.find(item=>item.entry.id===book.id), cover=studyLeafPage()
      const thumb=cover?assets?.byId.get(`vinci/ms-thumb/${leafStem(cover)}`):undefined
      if(own){own.entry={...own.entry,title:text(book.title),preview:thumb?assetAddress(thumb):own.entry.preview};continue}
      if(book.entry)row.push({order:1+at,entry:{id:book.id,openable:true,title:text(book.title),
        colour:certaintyColour('documented'),preview:shelfPlate(book.entry)}})
    }
    return row.sort((a,b)=>a.order-b.order).map(item=>item.entry)
  }
  /** THE PLATE AT REST FOR AN EXHIBIT THAT HAS NO PLATE OF ITS OWN: a machine,
   * a plaque, the grave and its diagram, the book. Each is rendered once from
   * the pose its own approach leaves the eye in, and stands in the store under
   * the folder of its kind, so no cell of any row in this wing is blank. */
  function exhibitPreview(pick:VinciPickEntry):string|null {
    // A LEAF'S CELL IS THE PAGE. An admitted sheet has its own thumb in the
    // store, so the cell shows the manuscript and not the fitting it lies on.
    if(pick.id.startsWith('leaf/')) {
      // The store's own file, not the record's source: that address is the
      // holder's page for the sheet and not the picture of it.
      const folio=assets?.byId.get(`vinci/folio-thumb/${pick.id.slice('leaf/'.length).toLowerCase()}`)
      if(folio)return assetAddress(folio)
    }
    const name=pick.id.startsWith(`${pick.kind}/`)?pick.id.slice(pick.kind.length+1):pick.id
    const entry=assets?.byId.get(`vinci/exhibit-preview/${pick.kind}/${name.replace(/\//g,'-')}`)
    return entry?assetAddress(entry):null
  }
  /** The next or the previous work of this wall, skipping what the spine
   * cannot open yet. The ends are ends: a wall does not wrap. */
  function exhibitStep(id:string,step:number):VinciStripEntry|undefined {
    const row=stationExhibits(), at=row.findIndex(item=>item.id===id)
    if(at<0)return undefined
    for(let i=at+step;i>=0&&i<row.length;i+=step)if(row[i]!.openable)return row[i]
    return undefined
  }
  function stepExhibit(step:number):void {
    const open=closeLook?.id
    const target=open?exhibitStep(open,step):undefined
    if(target)openExhibit(target.id,null)
  }
  /** One control of the vitrine that walks to a named work. It carries a
   * mark and not a word: its name is the work it opens. */
  function stepControl(glyph:string,target:VinciStripEntry|undefined):HTMLElement {
    const button=make('button','vitrine-control vitrine-step',glyph)
    button.type='button'
    button.disabled=!target
    if(target){
      button.setAttribute('aria-label',target.title)
      button.setAttribute('aria-controls',VINCI_EXHIBIT_CARD)
      button.addEventListener('click',()=>openExhibit(target.id,button))
    }
    return button
  }
  function control(words:VinciText,run:()=>void):HTMLButtonElement {
    const button=make('button','vitrine-control',text(words))
    button.type='button'
    button.addEventListener('click',run)
    // WHAT A CONTROL IS FOR, not what it says: a label that stands the
    // controls in places of its own asks for the role and never for the word.
    const role=words===VINCI_VITRINE_WORDS.provenance?'record'
      :words===VINCI_VITRINE_WORDS.close?'close'
      :words===VINCI_VITRINE_WORDS.wholePlate?'zoom'
      :words===VINCI_VITRINE_WORDS.back?'back':''
    if(role)button.dataset['role']=role
    return button
  }
  /** WHERE A WORK STANDS IN THE SET ITS STATION HOLDS, and the museum's own
   * mark for it: both are the row's, so the label and the row cannot drift. */
  function exhibitStand(id:string):{set:{at:number;of:number}|null;certainty:VinciCertainty|null} {
    const row=stationExhibits(), at=row.findIndex(item=>item.id===id)
    if(at<0)return {set:null,certainty:null}
    return {set:{at:at+1,of:row.length},certainty:pictureCertainty(row[at]!.colour)}
  }
  /** WHERE A WORK STANDS ON THE FRAME the room holds: its own plate's
   * corners through the camera, so a payload can stand exactly on it. */
  function workRect(object:VinciPickEntry['object']):VitrineRect|null {
    if(!hosts)return null
    const camera=hosts.world.camera, box=new Box3().setFromObject(object), corner=new Vector3()
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      corner.set(x,y,z).project(camera)
      if(corner.z<=-1||corner.z>=1)return null
      const px=(corner.x*.5+.5)*innerWidth,py=(-corner.y*.5+.5)*deskStageHeight()
      left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py)
    }
    return {left,top,width:right-left,height:bottom-top}
  }
  /** A place's own region on the held frame: the box around its proxy. */
  function sphereRect(centre:Vector3,radius:number):VitrineRect|null {
    if(!hosts)return null
    const camera=hosts.world.camera, corner=new Vector3()
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
      corner.set(centre.x+x*radius,centre.y+y*radius,centre.z+z*radius).project(camera)
      if(corner.z<=-1||corner.z>=1)return null
      const px=(corner.x*.5+.5)*innerWidth,py=(-corner.y*.5+.5)*deskStageHeight()
      left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py)
    }
    return {left,top,width:right-left,height:bottom-top}
  }
  /** The room draws again under its own print, at the same camera. */
  function restoreRoom():void {
    if(!hosts)return
    aimPrint(exposureAt??hereContent().id)
  }
  /** A DOOR INTO A READING stands where the visitor already is: a sheet on
   * the body wall and a folio beside a machine each open their page in the
   * reader over the held frame, with no walk out and none back. */
  const LEAF_DOOR='/leaf'
  /** The one admitted leaf the study's support is read at, in the table's own
   * key: manuscript B, folio 83 verso, the sheet the screw was read from. */
  const STUDY_LEAF_KEY='B:83v'
  const isLeafDoor=(id:string|null):boolean=>Boolean(id?.endsWith(LEAF_DOOR))
  /** The reading table of this collection, wherever the visitor stands. */
  function theBook():ReadingTable|undefined {
    // The house's support is a manuscript too, and it is not a table: the
    // book is the one exhibit whose own object carries a reading.
    for(const pick of picks){
      if(pick.kind!=='manuscript')continue
      const table=readingTableOf(pick.object)
      if(table)return table
    }
    return undefined
  }
  /** THE FOLIO BESIDE A MACHINE opens that leaf, with its three ways and the
   * strip of the manuscript it stands in. Back returns to the machine. */
  function openFolioDoor(slug:MachineSlug,base:string,back:()=>void):void {
    const table=theBook()
    openLeafReading(table?.pages.find(page=>page.page_kind==='facsimile'&&page.machine_slugs.includes(slug)),base,back)
  }
  /** THE PAGE THE STUDY'S SUPPORT IS READ AT. Read from the edition's own
   * record and not from the reading table, because the table is built when a
   * visitor reaches the gallery and this support stands in the house. */
  let studyLeaf:PageRecord|undefined|null=null
  function studyLeafPage():PageRecord|undefined {
    if(studyLeaf!==null)return studyLeaf
    const pages=(JSON.parse(studyPageMap) as {pages:PageRecord[]}).pages
    studyLeaf=pages.find(page=>page.page_kind==='facsimile'&&page.codex==='B'&&page.folio===83&&page.side==='verso')
    return studyLeaf
  }
  /** THE LEAF ON THE SUPPORT, from the same record the reader opens: the
   * display scan on the live tiers, its thumb where the budget is calm. */
  function supplyStudySheet():void {
    const leaf=studyLeafPage()
    if(!studySheet||!assets)return
    const stem=leaf?leafStem(leaf):''
    const calm=hosts?.world.stack.tierName()==='calm'
    studySheet.supply(leaf?assets.byId.get(`vinci/${calm?'ms-thumb':'ms-page'}/${stem}`):undefined)
  }
  /** The stem the store keys this leaf's records by. */
  const leafStem=(page:PageRecord):string=>page.file.replace(/^.*\//,'').replace(/\.[a-z]+$/,'')
  /** ONE ADMITTED LEAF, OPENED WHERE THE VISITOR STANDS. The reading is the
   * table module's own: its pages, its pyramids, its three ways. */
  function openLeafReading(leaf:PageRecord|undefined,base:string,back:()=>void):void {
    const table=theBook()
    if(!table||!leaf||!closeLook)return
    const codex=CODEX_ENTRIES.find(record=>record.id===`paris-${leaf.codex}`)
    const id=`${base}${LEAF_DOOR}`
    let reader:ReaderPayload|undefined
    const openRecord=()=>{
      exhibitSources={id,title:{en:codex?.en??'',de:codex?.de??''},certainty:'documented',renderStation(host){reader?.renderRecord(host)}}
      sources.resetScroll();sources.select('station');mode=2;paintDock()
    }
    reader=createReaderPayload({table,manifest:loadManifest(),
      walked:()=>false,standing:()=>true,
      more:text(VINCI_VITRINE_WORDS.more),honesty:text(VINCI_PAGE_HONESTY),
      words:vinciManuscriptWords(),colour:certaintyColour('documented'),
      tier:()=>hosts?.world.stack.tierName()??'standard',start:`edition:${leaf.edition_index}`,
      changed:()=>{if(exhibitSources?.id===id&&mode===2)paintDock()}})
    closeLook.open({id,title:lang()==='de'?codex?.de??'':codex?.en??'',line:null,card:[],payload:reader,
      controls:[control(VINCI_VITRINE_WORDS.provenance,openRecord),control(VINCI_VITRINE_WORDS.back,back),
        control(VINCI_VITRINE_WORDS.close,()=>closeLook?.close())],...exhibitStand(base)},null,'advance')
  }
  /** A BOOK OF THE SHELF, OPENED ON THE TABLE in the reader where the visitor
   * stands: no walk, the reader takes the window at once, and the record
   * holds the whole shelf. */
  function openCodexBook(id:string,from:HTMLElement|null,how:'auto'|'walk'|'cut'):void {
    const book=shelfBook(id)
    if(!book?.entry||!closeLook||!hosts)return
    let reader:CodexReaderPayload|undefined
    const openRecord=()=>{
      exhibitSources={id,title:{en:book.title.en,de:book.title.de},certainty:'documented',renderStation(host){reader?.renderRecord(host)}}
      sources.resetScroll();sources.select('station');mode=2;paintDock()
    }
    reader=createCodexReaderPayload({book,manifest:loadManifest(),words:vinciManuscriptWords(),
      more:text(VINCI_VITRINE_WORDS.more),colour:certaintyColour('documented'),
      tier:()=>hosts?.world.stack.tierName()??'standard',
      changed:()=>{if(exhibitSources?.id===id&&mode===2)paintDock()},
      openBook:openFromRecord,openLeaf:key=>{leafAt=key;openFromRecord(EDITION_EXHIBIT)}})
    const how_=closeLook.id&&closeLook.id!==id?'advance':'enter'
    openMode=how
    // the name row carries the book's official name and the side; the line
    // under it is the shelf's plain title, what the book is about
    closeLook.open({id,title:text(book.title),line:text(book.title),card:[],payload:reader,
      controls:[control(VINCI_VITRINE_WORDS.provenance,openRecord),control(VINCI_VITRINE_WORDS.close,()=>closeLook?.close())],
      ...exhibitStand(id)},from,how_)
    openMode='auto'
    if(recordNext){recordNext=false;openRecord()}
  }
  /** THE PAGE ON THE SUPPORT, OPENED WHERE THE VISITOR STANDS. One side, the
   * admitted leaf's own, read from its pyramid where the store has cut one.
   * Its words are the edition's own record and the sheet's licence line. */
  function openStudyLeaf(from:HTMLElement|null,how:'enter'|'advance'):void {
    const leaf=studyLeafPage()
    if(!leaf||!assets||!closeLook)return
    const stem=leafStem(leaf)
    const near=assets.byId.get(`vinci/ms-page-near/${stem}`)??assets.byId.get(`vinci/ms-page/${stem}`)
    const thumb=assets.byId.get(`vinci/ms-thumb/${stem}`)
    if(!near)return
    const scan=near as typeof near&{width?:number;height?:number;licence?:string}
    const named=FAMOUS_FOLIOS.find(folio=>folio.folio==='83v')
    const title=lang()==='de'?named?.de??'':named?.en??''
    const shows=lang()==='de'?leaf.what_it_shows_de:leaf.what_it_shows_en
    const source=vinciLeafSource(assets,leaf.file,{file:assetAddress(near),
      width:scan.width??0,height:scan.height??0})
    const door=`${VINCI_STUDY_LEAF}${LEAF_DOOR}`
    const openRecord=()=>{
      exhibitSources={id:door,title:{en:named?.en??'',de:named?.de??''},certainty:'documented',renderStation(host){
        const block=make('div','vinci-record');block.dataset['register']='record'
        for(const line of [shows,scan.licence??''])if(line)block.append(make('p','vinci-statement',line))
        host.append(block)
      }}
      sources.resetScroll();sources.select('station');mode=2;paintDock()
    }
    const reader=createVitrineReaderPayload({
      book:Promise.resolve({sides:[{id:'study-leaf',label:title,shows,source,
        thumb:thumb?assetAddress(thumb):null,ways:[],colour:certaintyColour('documented'),
        head:null,holder:''}],
        stripLabel:()=>text(hereContent().name),holder:'',honesty:text(VINCI_PAGE_HONESTY)}),
      start:'study-leaf',words:vinciManuscriptWords(),
      tier:()=>hosts?.world.stack.tierName()??'standard'})
    closeLook.open({id:door,title,line:null,card:[],payload:reader,
      controls:[control(VINCI_VITRINE_WORDS.provenance,openRecord),control(VINCI_VITRINE_WORDS.close,()=>closeLook?.close())],
      ...exhibitStand(VINCI_STUDY_LEAF)},from,how)
  }
  /** THE BODY WALL IS ONE BOOK. A press on any sheet opens the whole wall in
   * the reader at that sheet, in the order the wall hangs them: the arrows,
   * the keys and the swipe walk the wall itself, and the card, the strip and
   * the record follow the sheet standing. One way, because a drawn sheet has
   * no second face and no printed page beside it. */
  function openSheetDoor(id:string,from:HTMLElement|null,how:'enter'|'advance'):void {
    // THE BOOK'S ORDER IS THE WALL'S. The sheets are read in the order the
    // wall is walked, so the arrows in the reader and the arrows in the room
    // step the same way.
    const wall=[...exhibits?.sheetSources()??[]]
      .sort((a,b)=>(vinciWallOrderOf(`sheet/${a.sheet.id}`)??0)-(vinciWallOrderOf(`sheet/${b.sheet.id}`)??0))
    const opened=wall.find(source=>`sheet/${source.sheet.id}`===id)
    if(!opened||!closeLook)return
    const named=(source:typeof opened):string=>vinciSheetTitle(lang()==='de'?source.page.honesty_de:source.page.honesty_en)
    const door=`${id}${LEAF_DOOR}`
    let reader:ReaderPayloadOfWall|undefined
    const standing=()=>{const here=reader?.current();return wall.find(source=>source.sheet.id===here?.id)??opened}
    // The record is the sheet's, so it is composed again at every step and
    // repainted where the window beside it is open.
    const record=()=>{
      const source=standing(), title=named(source)
      exhibitSources={id:door,title:{en:title,de:title},certainty:'documented',renderStation(host){
        const at=standing()
        const block=make('div','vinci-record');block.dataset['register']='record'
        for(const line of [lang()==='de'?at.page.honesty_de:at.page.honesty_en,at.page.licence])
          block.append(make('p','vinci-statement',line))
        host.append(block)
      }}
    }
    const openRecord=()=>{record();sources.resetScroll();sources.select('station');mode=2;paintDock()}
    const sides=wall.map(source=>{
      const page=validateSheetRecord(source.page,'sheet-page')
      const thumb=validateSheetRecord(source.preview,'sheet-thumb')
      const record=source.page as typeof source.page&{holder?:string}
      return {id:source.sheet.id,label:named(source),shows:'',head:vinciLine(`sheet/${source.sheet.id}`),
        source:{pyramid:null,file:assetAddress(page.entry),width:page.pixels.width,height:page.pixels.height},
        thumb:assetAddress(thumb.entry),ways:[],colour:certaintyColour('documented'),holder:record.holder??''}
    })
    reader=createVitrineReaderPayload({
      book:Promise.resolve({sides,
        // The row of a station is named by the station, as the wall's own
        // strip beside it is.
        stripLabel:()=>text(hereContent().name),
        holder:'',honesty:text(VINCI_PAGE_HONESTY)}),
      start:opened.sheet.id,words:vinciManuscriptWords(),
      tier:()=>hosts?.world.stack.tierName()??'standard',
      changed:()=>{if(exhibitSources?.id===door&&mode===2){record();paintDock()}}})
    closeLook.open({id:door,title:named(opened),line:vinciLine(id),card:[],payload:reader,
      controls:[control(VINCI_VITRINE_WORDS.provenance,openRecord),control(VINCI_VITRINE_WORDS.close,()=>closeLook?.close())],
      ...vinciLimits(id),...exhibitStand(id)},from,how)
  }
  /** THE VITRINE, for every kind this wing can open: the line at its head,
   * the module's own card in the page's language only, the payload, the
   * record behind one control, Close, and the wall walked from inside it. */
  function openExhibit(id:string,from:HTMLElement|null,how:'auto'|'walk'|'cut'='auto'):void {
    if(isCollectionBook(id)){openCodexBook(id,from,how);return}
    const entry=picks.find(pick=>pick.id===id)
    if(!entry||!hosts||!closeLook)return
    if(!entry.openable)return
    const here=hereContent().id
    /* A WORK OF ANOTHER STATION, SEEN FROM HERE, OPENS HERE. Its mark stands
       in this room's picture, and no leg leaves from here to it, so its label
       opens where the visitor stands; it is not in this room's set, so it
       carries no count and its certainty is its own register's. */
    const stand=exhibitStand(id)
    const own=(certainty:VinciCertainty|null)=>stand.set?stand:{set:null,certainty:stand.certainty??certainty}
    const walk=[stepControl('\u2039',exhibitStep(id,-1)),stepControl('\u203a',exhibitStep(id,1))]
    const how_=closeLook.id&&closeLook.id!==id?'advance':'enter'
    const shut=control(VINCI_VITRINE_WORDS.close,()=>closeLook?.close())
    if(entry.kind==='sheet'){openMode=how;openSheetDoor(id,from,how_);openMode='auto';return}
    // THE PAGE ON THE COURT'S SUPPORT. The eye has already walked to the
    // board; the reading opens over the frame it stands in.
    if(id===VINCI_STUDY_LEAF){openMode=how;openStudyLeaf(from,how_);openMode='auto';return}
    if(entry.kind==='machine'){
      const slug=id.slice('machine/'.length)
      if(!isMachineSlug(slug))return
      const body=machineBuildOf(entry.object)
      // A machine whose body has not been built yet cannot be lent.
      if(!body||rail.navigation.active)return
      const title=machineCatalog[slug].title[lang()]
      const openRecord=()=>{
        exhibitSources={id,title:machineCatalog[slug].title,certainty:'reconstructed',renderStation(host){renderVinciMachineRecord(slug,host)}}
        sources.resetScroll();sources.select('station');mode=2;paintDock()
      }
      const words=vinciMachineCard(slug,narrow(),{word:text(vinciCertaintyWords.reconstructed),colour:PICTURE_CERTAINTY_KEY[2]!.colour})
      // THE WALK TO THE PLINTH IS DRAWN BY THE ROOM; the turntable takes the
      // stage once the eye stands, and on the phone that is at once.
      const payload=createVinciMachinePayload({stack:hosts.world.stack,slug,body,
        grade:{...PRINT,exposure:STATION_EXPOSURE[here]??PRINT.exposure},light:KEY_RIG,openRecord,
        // THE STATION'S OWN MARK stands down while a machine holds the stage:
        // the frame that places it rests until the room is handed back
        restore:()=>{restoreRoom();labels.setMode(mode)},
        // THE FOLIO BESIDE THE MODEL IS A DOOR: the leaf the machine was read
        // from opens in the reader, and Back stands the machine up again.
        openFolio:theBook()?.pages.some(page=>page.page_kind==='facsimile'&&page.machine_slugs.includes(slug))
          ?()=>openFolioDoor(slug,id,()=>openExhibit(id,null)):undefined,
        standing:()=>{const nav=rail.navigation;return !nav.active&&!nav.approaching}})
      labels.setMode(0)
      openMode=how
      closeLook.open({id,title,line:vinciLine(id),card:words.card,after:words.after,payload,
        controls:[control(VINCI_VITRINE_WORDS.provenance,openRecord),shut],walk,...vinciLimits(id),...own('reconstructed')},from,how_)
      openMode='auto'
      return
    }
    /* THE FLOOR IS THE DOOR INTO THE LIFE. There is one station for the whole
       cut line and the visitor is standing on it, so a press on a socket
       opens the life view at that date and a press on the floor opens it
       whole. Nothing is walked to and nothing is climbed back from. */
    if(entry.kind==='stud'){
      const stud=id===LINE_FLOOR_PICK?null:LINE_STUDS[vinciStudIndex(id)]
      openLife(stud?.id)
      return
    }
    if(entry.kind==='manuscript'){
      const table=readingTableOf(entry.object), codex=CODEX_ENTRIES.find(record=>`codex/${record.id}`===id)
      if(!table||!codex)return
      const title=lang()==='de'?codex.de:codex.en
      // THE BOOK IS READ WHERE IT LIES when the eye was walked to it, and in the
      // viewport where it was not; the record follows the page open now.
      let reader:ReaderPayload|undefined
      const openRecord=()=>{
        exhibitSources={id,title:{en:codex.en,de:codex.de},certainty:'documented',renderStation(host){reader?.renderRecord(host)}}
        sources.resetScroll();sources.select('station');mode=2;paintDock()
      }
      reader=createReaderPayload({table,manifest:loadManifest(),
        walked:()=>{const nav=rail.navigation;return nav.approaching===id||nav.exhibit===id},
        standing:()=>{const nav=rail.navigation;return !nav.active&&!nav.approaching},
        more:text(VINCI_VITRINE_WORDS.more),honesty:text(VINCI_PAGE_HONESTY),
        words:vinciManuscriptWords(),colour:certaintyColour('documented'),
        tier:()=>hosts?.world.stack.tierName()??'standard',start:leafAt??undefined,
        changed:()=>{if(exhibitSources?.id===id&&mode===2)paintDock()},openBook:openFromRecord})
      leafAt=null
      openMode=how
      // A BOOK TURNS ITS OWN PAGES: the shelf is chosen at the table, so the
      // band's two ways stay the book's own steps and never walk the shelf
      closeLook.open({id,title,line:vinciLine(id),card:[],payload:reader,
        controls:[control(VINCI_VITRINE_WORDS.provenance,openRecord),shut],...vinciLimits(id),...own('documented'),
        work:()=>{const nav=rail.navigation;return nav.exhibit===id&&!nav.active?sphereRect(entry.centre,entry.radiusM):null}},from,how_)
      openMode='auto'
      if(recordNext){recordNext=false;openRecord()}
      return
    }
    if(entry.kind==='place'||entry.workId===DEATHBED_WORK){
      const standing=()=>{const nav=rail.navigation;return !nav.active&&!nav.approaching}
      const plate=entry.object instanceof Mesh?entry.object:null
      const manifestId=plate?String(plate.userData['manifestId']):''
      const place:VinciPlaceCard=entry.kind==='place'?vinciPlaceCard(id as VinciPlaceId,placeCertainty)
        :vinciDeathbedCard(placeCertainty('conjectural'),null)
      const openRecord=()=>{void loadManifest().then(index=>{
        if(closeLook?.id!==id)return
        const record=entry.kind==='place'?place:vinciDeathbedCard(placeCertainty('conjectural'),index.byId.get(manifestId)?.licence??null)
        exhibitSources={id,title:{en:place.title,de:place.title},certainty:place.certainty,renderStation(host){record.record(host)}}
        sources.resetScroll();sources.select('station');mode=2;paintDock()
      })}
      // A place is its own stones: the room dims around the object where the
      // eye walked to it. The painting is shown whole in the viewport, drawn
      // from the pixels the room already holds, because no eye sees it square.
      const payload=entry.kind==='place'?createPlacePayload({title:place.title,standing})
        :createPlatePayload({title:place.title,aspect:GRAVE_PAINTING_ASPECT,window:null,standing,
          pixels:()=>{const map=(plate?.material as {map?:{image?:unknown}}|undefined)?.map?.image;return map instanceof HTMLImageElement||map instanceof ImageBitmap||map instanceof HTMLCanvasElement?map:null}})
      openMode=how
      closeLook.open({id,title:place.title,line:vinciLine(id),card:place.card,after:place.after,payload,
        controls:[control(VINCI_VITRINE_WORDS.provenance,openRecord),shut],walk,...vinciLimits(id),...own(pictureCertainty(namedExhibit(entry)?.colour??'')),
        work:entry.kind==='place'?()=>{const nav=rail.navigation;return nav.exhibit===id&&!nav.active?sphereRect(entry.centre,entry.radiusM):null}:undefined},from,how_)
      openMode='auto'
      return
    }
    const sources_=exhibits?.pictureSources()??[]
    const found=sources_.find(source=>source.work.id===entry.workId)
    if(!found)return
    const work=found.work
    const entries=sources_.filter(source=>source.work.id===entry.workId).map(source=>source.entry)
    const evidence=sources_.filter(source=>source.work.id===entry.workId).flatMap(source=>source.evidence??[])
    const plate=entries.find(source=>source.face===entry.face)??entries[0]
    // THE PAGE'S LANGUAGE ONLY. The module writes both columns for the wall's
    // own record; the vitrine keeps the one the visitor reads.
    // THE NUMBER ON ITS FRAME: a work of the hang is read as its catalogue entry
    const catalogue=hangCatalogue(work,entry.face,entries,lang())
    const label=createWindowWorkLabel(work,entries,lang(),narrow(),Boolean(catalogue?.kind))
    const controls:HTMLElement[]=[]
    const workRectNow=():VitrineRect|null=>{const nav=rail.navigation;return nav.exhibit===id&&!nav.active?workRect(entry.object):null}
    if(plate){
      // THE WHOLE PLATE stands in the same window, one press on from the
      // close look: the source itself, as deeply as the store holds it. The
      // rectangle is taken here, where the room's own frame still shows the
      // work, so the deep view opens on it without a jump.
      const whole=control(VINCI_VITRINE_WORDS.wholePlate,()=>{
        if(!closeLook||!plate)return
        const seat=workRectNow()
        closeLook.open(createVinciWholePlate({id,title,line:vinciLine(id),work,entries,plate,...vinciLimits(id),
          controls:[control(VINCI_VITRINE_WORDS.provenance,()=>showExhibitRecord(id,work,entries,evidence)),
            control(VINCI_VITRINE_WORDS.close,()=>closeLook?.close())],
          back:()=>openExhibit(id,null),from:()=>seat,narrow:narrow(),catalogue,
          tier:()=>hosts?.world.stack.tierName()??'standard'}),whole,'advance')
      })
      controls.push(whole)
    }
    controls.push(control(VINCI_VITRINE_WORDS.provenance,()=>showExhibitRecord(id,work,entries,evidence)),shut)
    const title=text(workTitle(work,entry.face))
    // The room cuts its plate to the source's approved display window, and
    // the payload shows the same share of the same file.
    const registration=plate?pictureDisplayWindow(plate.plate):null
    const cut=registration?pictureDisplayUV(registration):null
    const payload=plate?createPlatePayload({src:assetAddress(validatePaintingRecord(plate.preview,'painting-preview').entry),title,
      description:vinciPlateDescription(id),aspect:plate.pixels.width/plate.pixels.height,window:cut,
      standing:()=>{const nav=rail.navigation;return !nav.active&&!nav.approaching}}):null
    openMode=how
    closeLook.open({id,title,line:vinciLine(id),card:[label],payload,controls,walk,...vinciLimits(id),...own(pictureCertainty(policyLabelText(work,entries).colour)),
      catalogue,work:workRectNow},from,how_)
    openMode='auto'
  }
  /** The door asks about the place the visitor is standing in, so the
   * question travels with the card and not with the rail mark. */
  function paintQuestion() {
    const q=hosts?.stage.parentElement?.querySelector('.wing-question')
    if(q)q.textContent=text(hereContent().door)
  }
  function paintHeader() {
    const index=card,s=hereContent()
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
    // A ROOM THAT IS NOT OPEN STILL SAYS SO. The centred panel is for a
    // station that is still one plate; the word stands under the title
    // wherever the room behind the frame is not built.
    if(!s.outdoor){header.classList.toggle('vinci-construction',!standing&&!s.built);if(!s.built)header.append(make('p','vinci-status',text(vinciConstructionStatus)))}
    else header.classList.remove('vinci-construction')
    // THE CARD SPEAKS AT EVERY STATION, indoors and out. The three outdoor
    // stations used to carry a title and the hour and nothing that said what
    // the visitor was looking at.
    header.append(make('p','vinci-promise',text(s.promise)))
    // THE EXIT OF THE WING. The station card stands as it is, and the night
    // the visitor had stands under it.
    if(s.id==='grave'&&standing)header.append(recapAtTheGrave())
    // The sheet's own control, at the top of the card where a thumb finds it.
    if(standing){
      const grab=make('button','vinci-sheet-grab')
      grab.type='button'
      grab.setAttribute('aria-label',text(WING_TEXT.sheet))
      grab.setAttribute('aria-controls','vinci-station-card')
      grab.addEventListener('click',()=>{sheetOpen=!sheetOpen;paintSheet()})
      header.prepend(grab)
      // THE FOOT OF THE SHEET. One node for the whole visit, so what the
      // frame stands in it survives every repaint of the card above it.
      sheetFoot??=make('div','wing-sheet-foot')
      header.append(sheetFoot)
    }
    paintSheet()
    paintExhibitTitle();paintStrip()
    desk?.paint()
  }
  /** The card names what the frame holds: a sub-view carries its own title.
   * THE NUMBER COUNTS STATIONS. Two frames could otherwise read the same
   * count under two titles, so a named sub-view drops the count and says
   * which station it is a view from. */
  function titleForView(viewId:string) {
    const s=hereContent()
    const name=vinciViewNames[viewId]??(viewId.startsWith('collection')?vinciViewNames['collection']:undefined)
    const h1=header.querySelector('.vinci-title-name')
    if(h1)h1.textContent=text(name??s.name)
    const kicker=header.querySelector('.vinci-kicker')
    if(kicker)kicker.textContent=name?viewKicker():stationKicker()
  }
  /** THE SHEET'S TWO STATES. Peeked, the card is the room's name and one
   * line; opened, it is the whole card scrolling inside itself. The door
   * line, the bar and the wall's own row stand under it in both. */
  function paintSheet():void {
    if(!header)return
    const sheet=narrow()&&header.classList.contains('vinci-standing')&&!header.hidden
    // THE PHONE'S BAR KEEPS ONE LINE: the question, the door and the bar's
    // three words stand in this sheet while it is the card of the station,
    // and go back to the frame the moment it is not.
    hosts?.barFoot(sheet&&sheetFoot?sheetFoot:null)
    if(!sheet){delete header.dataset['sheet'];return}
    header.dataset['sheet']=sheetOpen?'open':'peek'
    const grab=header.querySelector('.vinci-sheet-grab')
    grab?.setAttribute('aria-expanded',String(sheetOpen))
    if(!sheetOpen)header.scrollTop=0
  }
  /** ONE CARD AT A TIME ON A NARROW STAGE. The room's card stands beside the
   * exhibit's on the wide one and would cover it on the phone. */
  function paintHeaderVisibility():void {
    if(!header)return
    // A CARD THAT SAYS A ROOM IS NOT OPEN CANNOT STAND WHILE THE VISITOR IS
    // INSIDE IT. An approach and a named view both leave the station's frame,
    // which is the frame every word of this card is about, so at a station
    // whose room is not built the card stands down while the eye is away and
    // comes back with it.
    const nav=standing?rail.navigation:undefined
    const away=Boolean(nav?.exhibit??nav?.approaching)||Boolean(activeView)
    header.hidden=mode===2||Boolean(closeLook?.id)||(away&&!hereContent().built)
    paintSheet()
  }
  /** AN APPROACH EYE IS NEVER A STATION. It stands in the station's own room
   * and carries the sub-view kicker the wing already writes for a view. */
  function paintExhibitTitle():void {
    const kicker=header?.querySelector('.vinci-kicker')
    if(!kicker)return
    // Only an eye that actually left the station is a view from it: on calm
    // the card rises where the visitor already stands, so the station keeps
    // its own number.
    const nav=standing?rail.navigation:undefined
    const away=Boolean(nav?.exhibit??nav?.approaching)
    kicker.textContent=away||activeView?viewKicker():stationKicker()
  }
  /** A STOP AS THE DESKTOP'S CHROME ADDRESSES IT: the walk's own id, never
   * the station's place in the order the rooms were built. Under the life's
   * order the two differ at every stop, and the words would read the wrong
   * station's chapter, line and clock. */
  const deskStationAt=(index:number):DeskStation=>
    ({id:stopAt(index).id,index,count:WALK.stops.length})
  const stationNumber=()=>String(card+1).padStart(2,'0')
  const stationKicker=()=>`CLOS LUCÉ, 1517 · ${stationNumber()} / ${WALK.stops.length}`
  const viewKicker=()=>`CLOS LUCÉ, 1517 · ${lang()==='de'?'BLICK VON STATION':'A VIEW FROM STATION'} ${stationNumber()}`
  /** THE PRINT STANDS AT ITS EXPOSURE AT ONCE: the walk eases it itself
   * (`legExposure`, `legShoulder`), and a cut is a cut. */
  function aimPrint(id:VinciStationId,exposure=exposureOf(id),shoulder=shoulderOf(id)):void {
    if(!hosts)return
    const {scene,camera,stack}=hosts.world
    exposureShown=exposure;shoulderShown=shoulder
    stack.setScene(scene,camera,{...PRINT,exposure,shoulder},true)
  }
  function placeCanonicalStation() {
    const stop=stopAt(card),id=stationOf(stop.station).id
    activeView='';measurement.hide();header.querySelector('.vinci-insertion')?.remove();titleForView('')
    rail.set(id,vinciWalkPose(stop,narrow()),true,narrow(),walkVertex(stop))
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
    const carrier=label.carrier??(label.id==='planting-assumptions'?'vinci/vegetation':label.id==='weather-assumptions'?'vinci/sky':'vinci/shell')
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
    // THE BODY WALL NAMES EVERY SHEET: the holder's own title for the side that
    // hangs, its RCIN, the holder's size where one is recorded, and its line.
    const sheets=id==='body'?exhibits?.sheetSources()??[]:[]
    if(!works.length&&!machines.length&&!sheets.length)return
    host.append(make('h3','',text(vinciSourcesHeadings.inThisRoom)))
    const list=make('ul','vinci-room-list')
    for(const work of works)list.append(make('li','',`${lang()==='de'?work.title_de:work.title_en} · ${holderLine(work,lang())} · ${text(ROOM_CLASS_WORD[work.rights_class])}`))
    for(const slug of machines){const machine=machineCatalog[slug];list.append(make('li','',`${text(machine.title)} · ${text(machine.label)}`))}
    const centimetres=(value:number)=>lang()==='de'?String(value).replace('.',','):String(value)
    for(const {sheet,page} of sheets){
      const size=sheet.measured?` · ${centimetres(sheet.measured.heightCm)} × ${centimetres(sheet.measured.widthCm)} cm`:''
      const item=make('li','')
      item.append(make('span','vinci-absence-work',`${vinciSheetTitle(lang()==='de'?page.honesty_de:page.honesty_en)} · RCIN ${sheet.id.replace(/^rcin-/,'')}${size}`))
      const said=vinciLine(`sheet/${sheet.id}`)
      if(said)item.append(document.createTextNode(' '+said))
      list.append(item)
    }
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
    for(const id of vinciRoomStationIds(hereContent().id)){
      const station=vinciContent.find(s=>s.id===id)!
      const section=make('section','vinci-room-source')
      section.append(make('h2','',text(station.name)),make('p','vinci-promise',text(station.promise)))
      const full=make('div','vinci-record');setRegister(full,'record')
      for(const label of station.labels)appendSourceStatement(section,label,full)
      full.append(make('p','vinci-statement',text(station.record??station.promise)),make('small','vinci-citation',station.promiseSource))
      const sources=exhibits?.pictureSources()??[]
      if(id==='picture-room'||id==='supper-wall'){
        const works=new Map(sources.filter(({work})=>(work.id==='last-supper')===(id==='supper-wall')).map(({work})=>[work.id,work]))
        for(const work of works.values()){const own=sources.filter(source=>source.work.id===work.id)
          full.append(createPolicyWorkLabel(work,own.map(source=>source.entry),true,[],false,own.flatMap(source=>source.evidence??[])))}
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
  /** THE BAR'S THREE WORDS FOLLOW THE PAGE. They were painted with the dock
   * alone, which runs when a visitor arrives somewhere, so a language chosen
   * while a wing stands reached the bar only at the next station. */
  function paintBarWords() {
    if(source&&source.textContent!==sourcesWord())source.textContent=sourcesWord()
    if(planControl&&planControl.textContent!==text(PLAN_WORDS.plan))planControl.textContent=text(PLAN_WORDS.plan)
    if(lifeControl&&lifeControl.textContent!==text(LIFE_WORDS.door))lifeControl.textContent=text(LIFE_WORDS.door)
  }
  function paintDock() {
    if(!hosts)return
    const s=hereContent(),scroll=dock.scrollTop
    const focused=dock.contains(document.activeElement)?document.activeElement as HTMLElement:null
    const recordOpen=dock.dataset['station']===s.id&&record?.isConnected&&!record.hidden
    paintHeaderVisibility()
    const camera=hosts.world.camera
    paintBarWords()
    dock.dataset['station']=s.id
    // Opening Sources changes presentation only, inside the same proven lens.
    camera.zoom=1;camera.clearViewOffset();camera.updateProjectionMatrix()
    sources.setOpen(mode===2)
    labels.setMode(mode);dots?.setMode(mode);paintStrip()
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
        const label=createPolicyWorkLabel(work,entries,true,[],false,sources.filter(source=>source.work.id===work.id).flatMap(source=>source.evidence??[]))
        setRegister(label,'record')
        for(const entry of entries){
          const complete=make('a','vinci-picture-source',lang()==='de'
            ? entry.face==='reverse'?'Vollständige Reproduktion der Rückseite öffnen':'Vollständige Reproduktion öffnen'
            : entry.face==='reverse'?'Open the complete reverse reproduction':'Open the complete reproduction')
          complete.href=assetAddress(validatePaintingRecord(entry.plate,'painting-plate').entry)
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
    // The court's own four stand in every frame that holds the court.
    if(s.id==='arrival'||s.id==='courtyard'||['hall','oratory','study','chamber'].includes(s.id)){
      appendEvidence('courtObjects',courtObjectsProvenance.record,'conjectural',courtObjectsProvenance.manifestId,courtObjectsProvenance.source.join(' · '))
      // The licence line of a lent body is the store's own, printed as it stands.
      const licences=courtObjectsProvenance.slugs.map(slug=>assets?.byId.get(`models/${slug}`)?.licence).filter(Boolean)
      if(licences.length===courtObjectsProvenance.slugs.length)record.append(make('small','vinci-citation',[...new Set(licences)].join(' · ')))
    }
    if(s.id==='courtyard'||['hall','oratory','study','chamber'].includes(s.id)||activeView.startsWith('entry-')){
      appendEvidence('entry',entryPassageProvenance.label,'reconstructed','vinci/entry-passage',entryPassageProvenance.source.join(' · '))
      appendEvidence('entryFinish',entryMineralSurfaceProvenance.label,'reconstructed','vinci/entry-mineral-surface',entryMineralSurfaceProvenance.source.join(' · '))
      appendRecord({en:hallLedgeProvenance.recipe,de:hallLedgeProvenance.recipeDe},hallLedgeProvenance.source.join(' · '),'reconstructed',hallLedgeProvenance.manifestId,'GENERATED')
    }
    // The great hall behind the passage, and the few things of the period in it.
    if(s.id==='hall'&&hosts?.world.stack.tierName()!=='calm'){
      appendEvidence('greatHall',houseHallProvenance.record,'reconstructed',houseHallProvenance.manifestId,houseHallProvenance.source.join(' · '))
      appendEvidence('hallThings',houseHallProvenance.thingsRecord,'conjectural',houseHallProvenance.manifestId,houseHallProvenance.source.join(' · '))
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
  const wingModule:VinciWingModule={
    stations:WALK.stops.map(walkStation),
    legacyStationIds:vinciLegacyStationIds,
    doorDisclosure:'first-press',
    // THE SOURCES WINDOW OPENS ON THE ROOM. A visitor who presses it is asking
    // what the room they stand in is made of, and a room's sources are the
    // sources of every station in it; the station's own tab is one press away.
    openSources(tab='room'){if(!standing){pendingView=`sources-${tab}`;return}sources.select(tab);mode=2;paintDock()},
    setExhibitSources(exhibit){exhibitSources=exhibit;if(standing){sources.resetScroll();paintDock()}},
    // NO MACHINE ANIMATES WHILE THE VISITOR WALKS. A close look names the one
    // machine whose own clock may run; null puts every machine back at rest.
    demonstrateMachine(slug:string|null){exhibits?.demonstrate(isMachineSlug(slug??'')?slug as MachineSlug:null)},
    navigation:()=>{
      const nav=standing?rail.navigation:undefined
      return {completed:nav?.completed??hereContent().id,target:nav?.queued[0]??nav?.active,question:text(hereContent().door)}
    },
    // A MACHINE NOT YET WHOLE IS STILL IN FLIGHT, and one that cannot be is an error.
    pending:()=>(exhibits?.pending()??0)+machinesStanding().outstanding+(studySheet?.pending()??0),
    errors:()=>[...(exhibits?.pictureErrors()??[]),...machinesStanding().errors,...(studySheet?.errors()??[])],
    manifest:()=>[...new Map((exhibits?.pictureSources()??[]).flatMap(({entry})=>[entry.preview,entry.plate]).map(entry=>[entry.id,entry])).values()],
    /* EVERY WORD OF THIS WING, READ AGAIN. The frame hands the language over
       before it repaints its own chrome, so the rail's names are the wing's
       own and the card, the row and the bar change together in one frame. */
    language(){
      wingModule.stations=WALK.stops.map(walkStation)
      if(!hosts||!standing)return
      paintBarWords();paintHeader();paintDock();paintQuestion();paintExhibitTitle();paintExhibitMarks();paintStrip()
    },
    show(index,h){
      if(!hosts){mount(h);station=card=index;paintHeader();schedule();return}
      // A station asked for before the place is built is remembered, not lost.
      if(!standing){station=card=index;paintHeader();return}
      const closeSources=mode===2
      if(closeSources)mode=1
      // A WORK QUEUED FROM THE PLAN BELONGS TO THE WALK THE PLAN BEGAN. A
      // station the visitor asks for instead cancels it.
      if(pendingExhibit&&vinciApproachStation(pendingExhibit.replace(/^(?:open|walk):/,''))!==contentAt(index).id)pendingExhibit=''
      // THE STATION RAIL STAYS LIVE. Pressing a station closes the exhibit and
      // the rail walks from the station eye, which is the certified pair.
      closeLook?.close()
      exhibitSources=null;endInspection();if(station!==index)sources.resetScroll();station=index;activeView='';measurement.hide()
      endChapterCard()
      const stop=stopAt(index),s=stationOf(stop.station),cut=cutToStation()
      // A CHAPTER BOUNDARY IS CROSSED, NEVER WALKED. The leg under it exists
      // and is certified; what the story says is that the visitor is somewhere
      // else now, which is a title and a new place and no walk between them.
      if(!cut&&walkCutBoundary(card,index)){crossChapter(index);return}
      // A STOP THAT IS NOT REACHABLE FROM HERE ON ITS OWN WALL is walked to in
      // two legs: the wall's nearer end, and the wall's own run from there.
      const vertex=walkRunVertex(stop)
      if(!cut&&vertex===undefined&&stop.exhibit){walkOnToWall(index);return}
      rail.set(s.id,vinciWalkPose(stop,narrow()),cut,narrow(),vertex)
      // On a walk the card changes when the visitor arrives, not when the
      // rail mark is pressed: a title that names the next room over the room
      // you are still standing in is a lie the frame tells.
      if(cut||walkIndexAt(rail.navigation.completed??'',rail.navigation.wall)===index){card=index;dock.scrollTop=0;aimPrint(s.id);exposureAt=s.id;paintHeader();paintDock();standHere()}
      else if(closeSources)paintDock()
    },
    async ready(report){
      tell=report
      // the module is here and the place is being built, which is a stage a
      // visitor can be told about even though nothing in it can be counted
      report?.({stage:'house',share:null})
      await built
      warmed??=warmUp()
      await warmed
      report?.({stage:'walk',share:1})
      tell=undefined
    },
    view(id){if(!standing){pendingView=id;return}showView(id)},
    look(y,p){if(standing)rail.look(y,p)},
    held:()=>(closeLook?.held()??false)||(plan?.held()??false)||(life?.held()??false),
    update(dt=0){
      if(!hosts)return
      if(tell){
        // ten readings a second: the field writes no faster, and the count
        // itself may not be taken in every frame of a wing being built
        const at=performance.now()
        if(at-toldAt>=100){toldAt=at;tell(entryShare())}
      }
      if(!standing)return
      // the trees' wind runs on the wing's own clock, which a film's harness owns
      windClock.value=hosts.world.clock()
      // THE WARM UP OWNS THE EYE. While it steps through the walk's poses
      // the rail may not put the camera back, or half the walk is compiled
      // from the seat of one station, and nothing is being looked at yet.
      if(warm&&warmUnderField&&!document.body.classList.contains('entering'))yieldEye()
      if(warm){if(!warm.frame())warm=undefined;return}
      // THE ROOM HOLDS STILL WHILE A PAYLOAD HOLDS THE STAGE: nothing of it
      // walks, streams or is drawn until the vitrine hands it back.
      closeLook?.update(dt)
      const payload=Boolean(closeLook?.id&&closeLook.surface!=='room')||Boolean(plan?.held())||Boolean(life?.held())
      exhibits?.holdPlates(payload)
      if(payload)return
      measurement.update();rail.update()
      // THE ROOM'S ONE FULL PLATE DOES NOT CHASE A RUN. While the eye slides
      // along the wall the near rule measures from the stop it will land on,
      // so a run past twenty-five works costs one request and not twenty-five.
      exhibits?.aimPlates(rail.navigation.aimEye??null)
      if(exhibits){const now=hosts.world.clock();exhibits.update(now,Math.max(0,Math.min(.25,now-exhibitClock)),hosts.world.camera.position);exhibitClock=now}
      // THE CARD NAMES THE STATION THE WALKER IS IN. It hands over at the
      // half of the leg, by walked distance: before that the walker is still
      // in the room they left, after it they are in the one they are entering,
      // and no panel outlives the station it belongs to. The exposure still
      // changes on arrival, where the eye is at rest.
      const nav=rail.navigation
      // THE CARD NAMES THE STOP OF THE WALK, not the room: two stops of the
      // life stand in one room, so the vertex of the wall the leg is walking
      // to decides which of them the card belongs to.
      const arriving=Boolean(nav.active&&nav.legWalked>=CARD_HANDOVER)
      const here=arriving?nav.active:nav.completed
      const arrived=here?walkIndexAt(here,arriving?nav.wallTo:nav.wall):-1
      if(arrived>=0&&arrived!==card&&!activeView){card=arrived;dock.scrollTop=0;paintHeader();paintDock();paintQuestion();standHere()}
      if(nav.completed&&nav.completed!==exposureAt)exposureAt=nav.completed
      const opening=activeView&&VIEW_EXPOSURE[activeView]!==undefined?VIEW_EXPOSURE[activeView]!:legExposure(nav), rolling=activeView&&VIEW_SHOULDER[activeView]!==undefined?VIEW_SHOULDER[activeView]!:legShoulder(nav)
      if(nav.completed&&(opening!==exposureShown||rolling!==shoulderShown))aimPrint(nav.completed,opening,rolling)
      // A JOURNEY ONTO A WALL IS TWO LEGS AND ONE ASKING: the run along the
      // wall leaves as soon as the leg to its end has landed.
      if(walkOnwards>=0&&!nav.active&&!nav.exhibit&&!nav.approaching){
        const want=walkOnwards, stop=stopAt(want), vertex=walkRunVertex(stop)
        walkOnwards=-1
        if(vertex!==undefined)rail.set(stop.station,vinciWalkPose(stop,narrow()),false,narrow(),vertex)
      }
      // A WORK CHOSEN ON THE PLAN OPENS WHEN ITS WALK ENDS: the rail at rest,
      // the card already the work's own station, and the registry read.
      if(pendingExhibit&&picks.length&&!closeLook?.id&&!nav.active&&!nav.approaching&&!nav.exhibit){
        const named=/^(?:open|walk):(.+)$/.exec(pendingExhibit)
        if(named&&vinciApproachStation(named[1]!)===hereContent().id){const id=pendingExhibit;pendingExhibit='';showView(id)}
      }
      // The kicker follows the body: it says a view only while the eye stands
      // away from its station.
      if(closeLook?.id||exhibitAway!==Boolean(nav.exhibit??nav.approaching)){exhibitAway=Boolean(nav.exhibit??nav.approaching);paintExhibitTitle();paintHeaderVisibility()}
      focusNearCascade();shadowBody?.update();shadowCache?.update();sky.position.copy(hosts.world.camera.position)
      if(hallSun){const seen=shadowCache?.state().invalidations??0,eye=hosts.world.camera.position;hallSun([eye.x,-eye.z,eye.y],seen!==hallSunSeen);hallSunSeen=seen}
      // A REMOUNTED PLATE IS A NEW MESH. The registry is a read, so it is
      // taken again when a tier change has replaced what it read.
      if(picks.length&&(picksTier!==hosts.world.stack.tierName()||!picks[0]!.object.parent))refreshExhibits()
      // NOTHING ON SCREEN MOVES WITH THE WALKER. The frame takes one attribute
      // for the length of a leg and CSS alone takes the chrome of the place
      // being left; the bar stays. Written on the edge, never every frame.
      const underWay=Boolean(nav.active)
      if(underWay!==legUnderWay){legUnderWay=underWay;hosts.walking(underWay)}
      desk?.update()
      // THE MARKS AND THE ROW BELONG TO THE STOP THE EYE STANDS AT, so both
      // are taken again the moment it arrives at another one.
      const atWall=wallAt()
      if(atWall!==wallWas){wallWas=atWall;paintExhibitMarks();paintStrip()}
      // A MARK PROMISES WHAT THE BODY WILL DO, so its kind is taken again the
      // moment the body's own state changes: at a viewing eye a press opens
      // where the visitor stands, at a station it walks.
      const still=!nav.active&&!nav.exhibit&&!nav.approaching
      if(still!==marksStill){marksStill=still;paintExhibitMarks()}
      const reading=readingRect()
      const panels=standingPanels(reading)
      labels.update(panels,reading)
      paintQuietLabel()
      // ONE EXHIBIT AT A TIME: while one is open the other marks stand down,
      // and at a stop the three that stand are this work and its neighbours.
      // THE MARKS STAND ABOVE WHAT THE FOOT OF THE FRAME CARRIES. At a
      // viewing eye a work fills the frame and its own mark hangs under it,
      // so the reserve is the row's own top edge and not a fixed band.
      dots?.setFoot(Math.max(0,deskStageHeight()-markFloor()+12,markSafeFoot()))
      dots?.setLimit(closeLook?.id?0:onWallStop()?3:DOTS_PER_TIER[hosts.world.stack.tierName()]??6)
      dots?.update(panels)},
    stop(){studySheet?.dispose();studySheet=undefined;releaseSheetMemory?.();releaseSheetMemory=undefined;desk?.dispose();desk=undefined;visit?.close();visit=undefined;plan?.dispose();plan=undefined;planControl?.remove();planControl=undefined;life?.dispose();life=undefined;lifeControl?.remove();lifeControl=undefined;closeLook?.dispose();closeLook=undefined;if(scheduled)cancelAnimationFrame(scheduled);scheduled=0;house=undefined;houseUp=0;standing=false;warm?.abort();warm=undefined;announceBuilt();exhibits?.dispose();exhibits=undefined;shadowBody?.dispose();shadowBody=undefined;shadowCache?.dispose();shadowCache=undefined;hallSun=undefined;restoreEnvironmentRotation?.();restoreEnvironmentRotation=null;controller?.abort();strip?.dispose();strip=undefined;dots?.dispose();dots=undefined;picks=[];picksTier='';occluders=[];collectionRoot=undefined;welcome?.dispose();welcome=undefined;sources?.dispose();source?.remove();labels?.dispose();measurement?.dispose();water?.dispose();hosts?.world.scene.traverse(o=>{if(o instanceof DirectionalLight&&o!==key?.light)o.dispose()});key?.dispose();if(hosts){hosts.world.scene.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});hosts.world.scene.clear();delete hosts.stage.parentElement!.dataset['wing'];if(labelHostHidden===null)hosts.labels.removeAttribute('aria-hidden');else hosts.labels.setAttribute('aria-hidden',labelHostHidden)}hosts=undefined},
  }
  return wingModule
}
