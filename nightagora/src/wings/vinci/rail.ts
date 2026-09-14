import { Quaternion, Vector3, PerspectiveCamera, Euler } from 'three/webgpu'
import { world } from './site'
import { gradeAt as groundHeight } from './terrain-mesh'
import { roadGradeProvenance } from './road-grade'
import type { VinciStationId } from './content'
import { createRailLookSmoother, createCertifiedRailPath } from './rail-smoothing'
import { projectRailDrag } from './projection-drag'
import { carriedPace, gaitAt, gaitHeadLift, gaitLeg, gaitRhythm, strollMetresPerSecond, type GaitThreshold } from './gait'
import { collectionLayout } from './collection'
import { collectionView } from './collection/views'
import { COURT, SUPPER_WALL } from './collection/layout'
import { fittedRailFov, assertRailProjection } from './rail-projection'
import type { RailGeometryAuthority } from './rail-proof'

export interface Pose { eye: Vector3; at: Vector3; fov: number }
/** Which room view each collection station stands in. The rooms are built by
 * the collection module and these are its own compositions: the hang from
 * where a hang is read, the hall from its north door, the line down its
 * length, the court from the end a visitor arrives at. */
export const COLLECTION_STATION_ROOMS:Partial<Record<VinciStationId,string>>={
  'line-early':'collection-room-line-early',
  'line-late':'collection-room-line-late',
  'line-amboise':'collection-room-line-amboise',
  'picture-room':'collection-room-picture',
  'supper-wall':'collection-room-supper',
  'reading-table':'collection-room-reading',
  scattered:'collection-room-gallery',
  flight:'collection-room-hall-screw',
  works:'collection-room-hall',
  body:'collection-room-body',
  myths:'collection-room-corrections',
  grave:'collection-room-grave',
}
const p=(e:number,n:number,h:number,te:number,tn:number,th:number,fov=49):Pose=>({eye:world(e,n,h),at:world(te,tn,th),fov})
/** Camera poses are exhibition choices. They change no surveyed geometry. */
/** THE PHONE RESTAGES A ROOM, IT DOES NOT CLIP IT. The card takes the middle
 * band of an 844 px stage, so a room's hero is put ABOVE it: the lens opens by
 * a quarter and the aim drops by a fifth of the frame, which lifts the subject
 * out from behind the card. The eye does not move: the visitor stands where
 * the room's own view stands them. */
const NARROW_LENS=1.26, NARROW_AIM_SHARE=.21
function narrowRoomPose(pose:Pose):Pose {
  const fov=Math.min(104,pose.fov*NARROW_LENS)
  const reach=pose.eye.distanceTo(pose.at)
  const drop=reach*Math.tan(fov*Math.PI/180*NARROW_AIM_SHARE)
  return {eye:pose.eye.clone(),at:pose.at.clone().setY(pose.at.y-drop),fov}
}
/** The stations that stand in a built room rather than on a plate. */
export const vinciStandsInRoom=(id:VinciStationId):boolean=>COLLECTION_STATION_ROOMS[id]!==undefined
export function stationPose(id:VinciStationId, narrow:boolean):Pose {
  // The eye stood 0.26 m off the retaining wall, inside its own near plane,
  // and the wall filled the right third of the lower cone. It now stands
  // 0.86 m off it, out toward the middle of the road. The phone's lens came
  // down from 116 degrees: at that width the top of its frame looked 68
  // degrees above the gaze and nothing but sky can stand there.
  if(id==='arrival') return narrow?p(24.98,-16.13,groundHeight(24.98,-16.13)+1.65,5.032039226453499,-12.212873321666777,2.709826421638899,100):p(24.98,-16.13,groundHeight(24.98,-16.13)+1.65,8,-13.5,5,70)
  // The phone keeps its gaze on the door and opens the lens instead: at 70
  // degrees the cone's right half fell between the court corner and the east
  // range's windows and held neither.
  if(id==='courtyard') return narrow?p(10,-21,1.7,2.6,-12.5,4.8,80):p(10,-21,1.7,2.6,-12.5,4.3,60)
  if(['hall','oratory','study','chamber'].includes(id)) return p(4.4,-23.35,1.65,2,-13.8,3.5,50)
  // R19 accepted: actual apron paving +1.65 m; all eight principal windows clear vegetation.
  if(id==='garden') return p(-24.5,-31.2,-4.790000057220459,-8.7,-16.6,narrow?4.2:6.2,narrow?96:62)
  // THE COLLECTION'S NINE STAND IN THEIR OWN ROOMS, at the eye the module's
  // own room views were composed from. A room is entered through its door and
  // seen from where a visitor would stand to read it.
  // The wall that is not here is a measurement, and a measurement is read
  // square: the eye stands eleven metres off its field, which is what holds
  // all 8.8 by 4.6 m of the absence in one frame.
  if(id==='supper-wall'){
    const square=p(-33.9,SUPPER_WALL.north,COURT.level+1.66,
      SUPPER_WALL.east+SUPPER_WALL.thickness/2,SUPPER_WALL.north,COURT.level+2.95,62)
    return narrow?narrowRoomPose(square):square
  }
  const room=COLLECTION_STATION_ROOMS[id]
  if(room){const pose=collectionView(room,false);if(pose)return narrow?narrowRoomPose(pose):pose}
  // A future station without a room keeps the held terrace composition.
  return p(-12.4,-21.6,groundHeight(-12.4,-21.6)+1.65,-38,-44,-4.2,narrow?74:58)
}
export function namedPose(id:string,narrow:boolean):Pose|undefined {
  // Independent static material inspections; return explicitly to the rail.
  if(id==='material-brick-sunlit')return p(-14.34996788180643,-15.446032508323484,3.005,-13.560321684541906,-14.9178669252478,3.005,narrow?56:48)
  if(id==='material-stone-sunlit')return p(-14.34996788180643,-15.446032508323484,-0.04,-13.560321684541906,-14.9178669252478,-0.04,narrow?56:48)
  if(id==='material-brick-close')return p(11.904739878821,-6.5464285833677955,2.9986922698566905,11.117695712897879,-7.078463808598585,2.9986922698566905,narrow?56:48)
  if(id==='material-stone-close')return p(3.090790336227255,-13.298632979918613,3.6508174266979623,2.5620239275497076,-12.509388984024916,3.6508174266979623,narrow?56:48)
  if(id==='material-slate-close')return p(-10.378358866845875,-16.02626517759048,11.41133193572964,-9.782750812457085,-15.639471094269735,10.793980418697382,narrow?56:48)
  if(id==='material-oak-close')return p(16.955666858116786,-22.31176519279774,4.270000004592006,17.533634691757438,-21.916856110505716,4.270000004592006,narrow?22:9)
  if(id==='material-stone-plain')return p(3.716859082338308,-18.989185741330733,1.65,3.207569374398135,-18.204952671485792,0.833024666517249,narrow?54:44)
  // R19 accepted paired garden view; retained as an exact reproducible alias.
  if(id==='composition-garden-window-clear')return p(-24.5,-31.2,-4.790000057220459,-8.7,-16.6,narrow?4.2:6.2,narrow?96:62)
  // Rejected R19 garden trials: foliage still crosses the upper-left window.
  if(id==='composition-garden-apron-a')return narrow?p(-26,-31.2,groundHeight(-26,-31.2)+1.65,-8.7,-16.6,4.2,92):namedPose('composition-garden-clear',false)
  if(id==='composition-garden-apron-b')return narrow?p(-27,-31.2,groundHeight(-27,-31.2)+1.65,-8.7,-16.6,4.2,88):namedPose('composition-garden-clear',false)
  // R19 accepted arrival pair; phone A preserves more open court than B. Kept
  // as the reproducible record of the 116 degree lens the station left behind.
  if(id==='composition-arrival-passage-a')return narrow?p(25.2,-16.2,groundHeight(25.2,-16.2)+1.65,5.032039226453499,-12.212873321666777,2.709826421638899,116.1):namedPose('composition-arrival-centre',false)
  // Rejected phone B remains reproducible for the comparison record.
  if(id==='composition-arrival-passage-b')return narrow?p(25.2,-16.5,groundHeight(25.2,-16.5)+1.65,4.987387151716828,-11.996839722277095,2.71547864225149,114.1):namedPose('composition-arrival-centre',false)
  // Rejected phone centre: the gate view ends on lining. Its desktop branch is accepted.
  if(id==='composition-arrival-centre')return narrow?p(25.5,-20,groundHeight(25.5,-20)+1.65,8.328,-10.1321,5.5686,96):p(24.98,-16.13,groundHeight(24.98,-16.13)+1.65,8,-13.5,5,70)
  // Superseded garden pair: phone exposes the north gable/gap; desktop has window foliage.
  if(id==='composition-garden-clear')return narrow?p(-24,-6,groundHeight(-24,-6)+1.65,-5.5,-14.3,9.2,100):p(-28,-30,groundHeight(-28,-30)+1.65,-8,-17.5,5.4,56)
  // Standing inspection eyes on the supplied +0.80 m entry floor.
  if(id==='entry-structure')return p(1.6827085821,-11.1289639925,2.45,.2233233333,-7.3668775,2.50,narrow?76:64)
  if(id==='entry-plaster')return p(1.7866530846,-8.2594276119,2.45,2.2544516667,-7.4190741667,2.4,narrow?57:45)
  if(id==='entry-terracotta')return p(1.8569668657,-10.4792456716,2.45,1.4087311940,-9.6972077612,.8,narrow?58:44)
  // Review candidates retain a standing eye above the derived road grade.
  // Phone aims frame the registered gate surround, gable and chimney crowns.
  if(id==='arrival-frame-near')return narrow?p(25.5,-15.8,groundHeight(25.5,-15.8)+1.65,9.5840449817,-14.1622039639,7.5975306493,122):p(25.5,-15.8,groundHeight(25.5,-15.8)+1.65,8,-13.5,5,70)
  if(id==='arrival-frame-middle')return narrow?p(26,-16.5,groundHeight(26,-16.5)+1.65,10.2135889574,-13.8943856017,7.9236930585,116):p(26,-16.5,groundHeight(26,-16.5)+1.65,8,-13.5,5,66)
  if(id==='arrival-frame-far')return narrow?p(26.4,-17.2,groundHeight(26.4,-17.2)+1.65,10.8502800366,-13.4308874972,7.3308569180,110):p(26.4,-17.2,groundHeight(26.4,-17.2)+1.65,8,-13.5,5,62)
  if(id==='gate-axis')return p(22.4,-15.1,groundHeight(22.4,-15.1)+1.65,7,narrow?-17.5:-18,5.2,narrow?108:86)
  if(id==='gate-outer')return p(24.15,-13.69,groundHeight(24.15,-13.69)+1.65,8,-14,5.3,narrow?90:74)
  if(id==='road-near')return p(24.6,-18.6,groundHeight(24.6,-18.6)+1.65,narrow?8:3,-6,5.3,narrow?88:71)
  if(id==='road-far')return p(31,-28.8,groundHeight(31,-28.8)+1.65,narrow?9:3,-5,5.2,narrow?76:58)
  if(id==='road-north')return p(21,-13,groundHeight(21,-13)+1.65,narrow?8:3,-4,5.5,narrow?88:73)
  if(id==='entry-mouth')return p(20.2,-16.25,2.65,-1,-23,4.4,narrow?108:91)
  if(id==='street-gate')return p(26.05,-12.42,groundHeight(26.05,-12.42)+1.65,4,-19,4.4,narrow?100:74)
  if(id==='road-lower')return p(29,-29,groundHeight(29,-29)+1.65,3,-15,4.6,narrow?82:61)
  if(id==='stream')return p(-62,-28,groundHeight(-62,-28)+1.65,-73,-17,-10.4,narrow?66:54)
  // The phone stood eighty metres off and the haze ate the insertion. It
  // now looks from the terrace, at the distance the desktop sees it.
  if(id==='collection')return narrow?p(-13,-22,groundHeight(-13,-22)+1.65,-40,-46,-3.6,80):p(-17,-3,6.5,-43,-47,-2.8,58)
  if(id==='collection-apron')return p(-21,-31.4,groundHeight(-21,-31.4)+1.65,-43,-36,-4.1,narrow?72:56)
  if(id==='collection-approach')return p(-20.7,-14.5,groundHeight(-20.7,-14.5)+1.65,-20.7,-30,-5.8,narrow?76:58)
  if(id==='collection-court-access')return p(-3.811459467626,-26.308179530842,1.65,-7.459684532374,-28.677346869158,-1,narrow?76:58)
  if(id==='haze')return p(-20,-18,groundHeight(-20,-18)+1.65,-85,-38,-8,narrow?72:56)
  if(id==='valley')return p(-80,-33,groundHeight(-80,-33)+1.65,-4,-9,3.2,narrow?66:54)
  if(id==='gateway')return p(22.4,-15.1,2.65,16.6,-18.55,1.55,narrow?78:58)
  if(id==='gate-steps')return p(13.2304,-20.7402,1.65,18.2624,-17.4724,1.60,narrow?100:58)
  if(id==='arrival-road')return narrow?p(21,-8,2.65,7,-7,5.5,76):p(21,-8,2.65,3,-8,5.3,67)
  if(id==='arrival-gate')return narrow?p(22,-14,groundHeight(22,-14)+1.65,9,-12,5.2,76):p(22,-14,groundHeight(22,-14)+1.65,5,-10,4.8,65)
  if(id==='gable') return narrow?p(-30,27,groundHeight(-30,27)+1.65,-8.5,-6.5,6.5,56):p(-37,36,groundHeight(-37,36)+1.65,-6,9,7.2,49)
  // Standing inspections of the terrace head and the modern court stair.
  if(id==='terrace-head')return p(-1.5,-28.5,groundHeight(-1.5,-28.5)+1.65,-8,-26,-1.6,narrow?70:54)
  if(id==='access-underside')return p(-8.5,-30.5,-1.9+1.5,-5.4,-27.2,-1.2,narrow?70:54)
  if(id==='gutter')return p(12.021,-6.484,2.65,11.26,-6.998,1.003,narrow?66:50)
  if(id==='road-finish')return p(25.5,-15.8,groundHeight(25.5,-15.8)+1.65,17.5,-7.5,1.1,narrow?80:60)
  if(id==='step-wear')return p(4.9,-17.2,groundHeight(4.9,-17.2)+1.65,3.3,-14.1,.8,narrow?66:45)
  if(id==='retaining')return p(26,-17,2.65,29.8,-18.7,2.9,narrow?60:48)
  if(id==='court-ground')return p(10.7,-24.8,1.7,3.5,-16.8,1.1,narrow?76:58)
  if(id==='threshold')return p(6.3,-18.8,groundHeight(6.3,-18.8)+1.65,3,-13.8,1.1,narrow?68:48)
  if(id==='lancet')return p(6.2,-22.6,2.55,3.05,-18.29,2.87,narrow?57:42)
  if(id==='masonry')return p(20,-13,2.9,11,-7,3,41)
  if(id==='tuffeau'||id==='motto')return p(5.9,-15.2,2.7,2.6,-12.54,3.64,narrow?57:42)
  if(id==='slate')return p(-30,-24,5,-8,-13,11,34)
  if(id==='roof-valley')return p(-18,5,17,-8.3,-8.5,10.5,narrow?62:45)
  if(id==='slate-clear')return p(-20,-24,8,-9,-15,11,narrow?54:36)
  if(id==='oak')return p(10,-24,2.5,20,-25,4.1,36)
  if(id==='oak-junction')return p(15.672474,-22.401297,3.82,17.533635,-21.916856,3.80,narrow?58:42)
  if(id==='oak-fibres')return p(16.862376,-22.157504,4.28,17.533635,-21.916856,4.27,narrow?58:42)
  // Exposed diagonal end; actual opaque-shell clearance is 0.496 m.
  if(id==='oak-end')return p(17.010239151,-22.019393844,3.153073489,17.598307610,-21.993782043,3.229999900,narrow?58:42)
  return undefined
}

/** Retained gate waypoints; every rounded control hull needs its own proof. */
const gateRoute=[world(...roadGradeProvenance.crossing,2.65),world(20.6107,-15.9474,2.48),world(18.2624,-17.4724,2.48),world(15.9141,-18.9974,1.65),world(13.5658,-20.5224,1.65)]
/** What a walker looks up at on this rail: the gallery mouth on the street,
 * the step down out of the court, and the stair head to the terrace. */
const headLifts:readonly GaitThreshold[]=[
  {east:roadGradeProvenance.crossing[0],north:roadGradeProvenance.crossing[1],radiusM:5,radians:.05},
  {east:13.2304,north:-20.7402,radiusM:3.5,radians:.032},
  {east:collectionLayout.stair.east,north:collectionLayout.stair.north,radiusM:4,radians:.042},
]
/** The walk between two stations is timed at a stroll and shaped as a walk:
 * gait.ts owns the profile, this is the seconds it asks for. */
export const railWalkMetresPerSecond = strollMetresPerSecond
export function railMoveSeconds(lengthM:number):number { return gaitLeg(lengthM).seconds }
/** One notch of the wheel is one stride along the path being walked. */
export const railStrideMetres = .78
/** What an offline checker waits for ANY certified leg to complete. */
export const railMoveDurationSeconds = 20
/** The gaze leads the walk: it leaves the old composition inside this much of
 * the leg, holds the path's own heading sampled six metres ahead of the body,
 * and turns into the new composition over the last third. The look-ahead is
 * what keeps a corner from filling the frame: the eye is already round it
 * while the body is still passing the jamb. */
/** A leg shorter than this is one step of a walk, not a walk: the visitor is
 * already looking at what they are arriving at, and leading the gaze down a
 * six-metre path only turns it into the wall the path runs at. */
const GAZE_LEAVES = .16, GAZE_ARRIVES = .66, GAZE_AHEAD_M = 6, WALKED_LEG_M = 10
const wrap=(a:number):number=>Math.atan2(Math.sin(a),Math.cos(a))
const turn=(from:number,to:number,t:number):number=>from+wrap(to-from)*t
const ramp=(edge0:number,edge1:number,x:number):number=>{const t=Math.max(0,Math.min(1,(x-edge0)/(edge1-edge0)));return t*t*(3-2*t)}
export function createRail(camera:PerspectiveCamera,clock:()=>number,authority:RailGeometryAuthority) {
  interface Request { id:VinciStationId; pose:Pose; phone:boolean }
  let completed:Request|undefined, active:Request|undefined
  const queue:Request[]=[]
  let path:ReturnType<typeof createCertifiedRailPath>|undefined, placementNeedsFrame=false
  let duration=1.1, leg=gaitLeg(0), strideM=0, strideTarget=0, strideAt=0
  /** The leg's own clock. It runs at the stroll the leg was timed at, and
   * faster while stations are already waiting behind it. */
  let legClock=0, legClockAt=0, pace=1
  /** The share of the leg under way the body has covered, for the overlay. */
  let walkedShare=1
  const fromQ=new Quaternion(), toQ=new Quaternion()
  let fromFov=49,targetFov=49
  let fromHeading=0,fromElevation=0,toHeading=0,toElevation=0,walked=false
  const ahead=new Vector3(), behind=new Vector3()
  const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches
  const look=createRailLookSmoother(clock,reducedMotion,.1)
  const base=new Quaternion(), euler=new Euler(0,0,0,'YXZ'), forward=new Vector3()
  function poseQuaternion(pose:Pose) { const copy=new PerspectiveCamera();copy.position.copy(pose.eye);copy.lookAt(pose.at);return copy.quaternion.clone() }
  /** The heading and elevation a quaternion is already looking along. No roll
   * is read back, because none is ever written. */
  function angles(q:Quaternion):{heading:number;elevation:number} {
    forward.set(0,0,-1).applyQuaternion(q)
    return {heading:Math.atan2(-forward.x,-forward.z),elevation:Math.asin(Math.max(-1,Math.min(1,forward.y)))}
  }
  /** WHERE A WALKER IS LOOKING. Not the tangent under the far foot: the line
   * from the body to the place it is walking to, which settles through a bend
   * instead of swinging with it. Under half a metre of chord the path has run
   * out and the tangent at the body is all there is. */
  function pathAngles(bodyMetres:number,aheadMetres:number):{heading:number;elevation:number} {
    const total=path!.length,at=Math.max(0,Math.min(total,bodyMetres))
    path!.pointAtDistance(at,behind);path!.pointAtDistance(Math.min(total,at+aheadMetres),ahead)
    ahead.sub(behind)
    if(ahead.lengthSq()<.25){
      path!.pointAtDistance(Math.max(0,at-.25),behind);path!.pointAtDistance(Math.min(total,at+.25),ahead)
      ahead.sub(behind)
    }
    const flat=Math.hypot(ahead.x,ahead.z)
    if(flat<1e-9)return {heading:fromHeading,elevation:fromElevation}
    return {heading:Math.atan2(-ahead.x,-ahead.z),elevation:Math.max(-.20,Math.min(.13,Math.atan2(ahead.y,flat)))}
  }
  function samePose(a:Pose,b:Pose) { return a.eye.distanceToSquared(b.eye)<1e-18&&a.at.distanceToSquared(b.at)<1e-18&&Math.abs(a.fov-b.fov)<1e-9 }
  function sameRequest(a:Request,b:Request) { return a.id===b.id&&a.phone===b.phone&&samePose(a.pose,b.pose) }
  function matrices() { camera.updateProjectionMatrix();camera.updateMatrixWorld() }
  function placeEndpoint(request:Request) {
    completed=request;active=undefined;path=undefined;look.snap();strideM=strideTarget=0
    camera.position.copy(request.pose.eye);base.copy(poseQuaternion(request.pose))
    camera.quaternion.copy(base);camera.fov=fittedRailFov(request.pose.fov,camera.aspect,request.phone);matrices()
  }
  function begin(request:Request,carried:number,now:number) {
    if(!completed)throw new Error('Rail needs an explicit initial placement')
    // Exact eyes, aims, authored FOV and actual mounted solids must match
    // the offline proof. An inspection eye cannot borrow a station proof.
    path=authority.route(completed.pose,request.pose,request.phone,camera)
    // Route orientation stays separate from the bounded visitor look.
    fromQ.copy(base);toQ.copy(poseQuaternion(request.pose))
    const from=angles(fromQ),to=angles(toQ)
    fromHeading=from.heading;fromElevation=from.elevation;toHeading=to.heading;toElevation=to.elevation
    walked=path.length>=WALKED_LEG_M
    leg=gaitLeg(path.length);duration=leg.seconds;legClock=0;legClockAt=now;pace=carriedPace(carried);strideM=strideTarget=0;strideAt=now
    fromFov=completed.pose.fov;targetFov=request.pose.fov;look.recenter()
    active=request
  }
  function render(now:number) {
    const offset=look.sample(now)
    forward.set(0,0,-1).applyQuaternion(base)
    const heading=Math.atan2(-forward.x,-forward.z),elevation=Math.asin(Math.max(-1,Math.min(1,forward.y)))
    euler.set(elevation+offset.pitch,heading+offset.yaw,0,'YXZ');camera.quaternion.setFromEuler(euler)
    matrices()
  }
  /** The eye rides the body. The rhythm is written on the certified path
   * point, never integrated, so it cannot drift and both ends are exact. */
  function carry(metres:number,heading:number) {
    const step=gaitRhythm(leg,metres,reducedMotion()||pace>1)
    camera.position.y+=step.height
    camera.position.x+=Math.cos(heading)*step.sway
    camera.position.z+=-Math.sin(heading)*step.sway
  }
  return {
    /** Physical scheduler state, separate from the shared selected destination. */
    get navigation() { return { completed:completed?.id, active:active?.id, queued:queue.map(request=>request.id), legSeconds:active?duration:0, legMetres:active&&path?path.length:0, legWalked:active?walkedShare:1, legPace:active?pace:1 } },
    set(id:VinciStationId,pose:Pose,instant=false,phone=camera.aspect<=.9) {
      const request={id,pose:{eye:pose.eye.clone(),at:pose.at.clone(),fov:pose.fov},phone}
      // Initial/named placement, explicit inspection return and resize are
      // deliberate placement boundaries. Ordinary reduced motion stays FIFO.
      if(instant||!completed){queue.length=0;placeEndpoint(request);placementNeedsFrame=true;return}
      // Compare only the latest accepted command. B,C,B is a real reversal;
      // different semantic stations sharing a pose remain distinct requests.
      const tail=queue.at(-1)??active??completed
      if(sameRequest(tail,request))return
      queue.push(request)
    },
    look(y:number,pit:number){look.snap(y,pit)},
    /** Walk on by hand. True when a leg was actually walking and took it. */
    stride(count:number){
      if(!active||!path||count<=0)return false
      strideTarget=Math.min(strideTarget+count*railStrideMetres,path.length)
      return true
    },
    drag(dx:number,dy:number,cssViewportHeight:number){
      const delta=projectRailDrag(dx,dy,camera.getEffectiveFOV(),cssViewportHeight)
      look.dragRadians(delta.yaw,delta.pitch)
    },
    update(){
      if(!completed)return
      const now=clock()
      // An explicit cut gets one rendered update before any queued movement.
      if(placementNeedsFrame){placementNeedsFrame=false;render(now);return}
      if(!active&&queue.length&&authority.status==='verified') {
        const request=queue[0]!
        if(samePose(completed.pose,request.pose)) {
          // Preserve settled gaze at a shared construction threshold, while
          // completing only this semantic request during the current update.
          queue.shift();completed=request;render(now);return
        }
        // What is still waiting behind this leg is the visitor asking to be
        // carried on, and the leg is walked at that pace from the start.
        begin(request,queue.length-1,now)
        queue.shift()
      }
      if(active&&reducedMotion()) {
        // One genuine endpoint per update; all later accepted requests remain.
        placeEndpoint(active);render(now);return
      }
      if(active&&path&&strideTarget>strideM) {
        // A wheel notch during a leg is a stride, not a new destination: the
        // visitor walks on rather than waiting the leg out.
        const step=Math.max(0,Math.min(.25,now-strideAt))
        strideM+=(strideTarget-strideM)*-Math.expm1(-step/.28)
      }
      strideAt=now
      // THE PROFILE, NOT A SMOOTHSTEP OVER THE LEG. The body leans into the
      // walk over the first ramp, strolls, and leans out of it at the station.
      // A wheel notch adds its stride to the same distance.
      // THE WALK YOU ARE ON DOES NOT SPEED UP UNDER YOU. The pace is read
      // once, when the leg begins, from what is already waiting behind it.
      if(active)legClock+=Math.max(0,now-legClockAt)*pace
      legClockAt=now
      const walk=active&&path?gaitAt(leg,legClock):undefined
      const metres=walk?Math.min(path!.length,walk.metres+strideM):path?path.length:0
      const s=active&&path&&path.length>0?Math.max(0,Math.min(1,metres/path.length)):1
      walkedShare=s
      if(active&&path) {
        assertRailProjection(camera)
        path.pointAtDistance(metres,camera.position)
        // THE GAZE LEADS THE WALK. The camera turns out of the station it is
        // leaving, looks at the place it is walking to (a point ahead on the
        // path, so a corner is seen before it is reached), lifts a little to
        // what stands over the way, and turns into the next station's
        // composition only on arrival.
        const leaves=walked?ramp(0,GAZE_LEAVES,s):0,arrives=walked?ramp(GAZE_ARRIVES,1,s):s
        const along=walked?pathAngles(metres,GAZE_AHEAD_M):{heading:toHeading,elevation:toElevation}
        const heading=turn(turn(fromHeading,along.heading,leaves),toHeading,arrives)
        const lift=walked?gaitHeadLift(headLifts,camera.position.x,-camera.position.z):0
        const led=fromElevation+(along.elevation+lift-fromElevation)*leaves
        euler.set(led+(toElevation-led)*arrives,heading,0,'YXZ');base.setFromEuler(euler)
        camera.fov=fittedRailFov(fromFov+(targetFov-fromFov)*s,camera.aspect,active.phone)
        carry(metres,heading)
      }
      render(now)
      if(active&&s===1) {
        completed=active;active=undefined;path=undefined
        // Do not drain the queue or consume catch-up time after a delayed
        // frame. The next update starts the next leg at its own clock origin.
      }
    },
  }
}
