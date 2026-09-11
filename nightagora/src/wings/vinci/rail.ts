import { Quaternion, Vector3, PerspectiveCamera, Euler } from 'three/webgpu'
import { world } from './site'
import { gradeAt as groundHeight } from './terrain-mesh'
import { roadGradeProvenance } from './road-grade'
import type { VinciStationId } from './content'
import { createRailLookSmoother, createCertifiedRailPath } from './rail-smoothing'
import { projectRailDrag } from './projection-drag'
import { fittedRailFov, assertRailProjection } from './rail-projection'
import type { RailGeometryAuthority } from './rail-proof'

export interface Pose { eye: Vector3; at: Vector3; fov: number }
const p=(e:number,n:number,h:number,te:number,tn:number,th:number,fov=49):Pose=>({eye:world(e,n,h),at:world(te,tn,th),fov})
/** Camera poses are exhibition choices. They change no surveyed geometry. */
export function stationPose(id:VinciStationId, narrow:boolean):Pose {
  // R19 accepted: phone passage-A retains the court and leaf; desktop keeps its corrected road eye.
  if(id==='arrival') return narrow?p(25.2,-16.2,groundHeight(25.2,-16.2)+1.65,5.032039226453499,-12.212873321666777,2.709826421638899,116.1):p(25.49153163196192,-15.805318528252403,groundHeight(25.49153163196192,-15.805318528252403)+1.65,8,-13.5,5,70)
  // The phone keeps its gaze on the door and opens the lens instead: at 70
  // degrees the cone's right half fell between the court corner and the east
  // range's windows and held neither.
  if(id==='courtyard') return narrow?p(10,-21,1.7,2.6,-12.5,4.8,80):p(10,-21,1.7,2.6,-12.5,4.3,60)
  if(['hall','oratory','study','chamber'].includes(id)) return p(4.4,-23.35,1.65,2,-13.8,3.5,50)
  // R19 accepted: actual apron paving +1.65 m; all eight principal windows clear vegetation.
  if(id==='garden') return p(-24.5,-31.2,-4.790000057220459,-8.7,-16.6,narrow?4.2:6.2,narrow?96:62)
  // Later construction plates stand on the terrace above the collection
  // ground, outside every room. On the apron the eye stood two metres from
  // the pavilion and its roof filled the near plane; from here the whole
  // ground is the backdrop. No exhibit is implied by either.
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
  // R19 accepted arrival pair; phone A preserves more open court than B.
  if(id==='composition-arrival-passage-a')return narrow?p(25.2,-16.2,groundHeight(25.2,-16.2)+1.65,5.032039226453499,-12.212873321666777,2.709826421638899,116.1):namedPose('composition-arrival-centre',false)
  // Rejected phone B remains reproducible for the comparison record.
  if(id==='composition-arrival-passage-b')return narrow?p(25.2,-16.5,groundHeight(25.2,-16.5)+1.65,4.987387151716828,-11.996839722277095,2.71547864225149,114.1):namedPose('composition-arrival-centre',false)
  // Rejected phone centre: the gate view ends on lining. Its desktop branch is accepted.
  if(id==='composition-arrival-centre')return narrow?p(25.5,-20,groundHeight(25.5,-20)+1.65,8.328,-10.1321,5.5686,96):p(25.49153163196192,-15.805318528252403,groundHeight(25.49153163196192,-15.805318528252403)+1.65,8,-13.5,5,70)
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
/** Scripted exhibition move; this duration is not a human walking-speed claim. */
export const railMoveDurationSeconds = 1.12
export function createRail(camera:PerspectiveCamera,clock:()=>number,authority:RailGeometryAuthority) {
  interface Request { id:VinciStationId; pose:Pose; phone:boolean }
  let completed:Request|undefined, active:Request|undefined
  const queue:Request[]=[]
  let path:ReturnType<typeof createCertifiedRailPath>|undefined, started=0, placementNeedsFrame=false
  const duration=railMoveDurationSeconds, fromQ=new Quaternion(), toQ=new Quaternion()
  let fromFov=49,targetFov=49
  const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches
  const look=createRailLookSmoother(clock,reducedMotion,.1)
  const base=new Quaternion(), euler=new Euler(0,0,0,'YXZ'), forward=new Vector3()
  function poseQuaternion(pose:Pose) { const copy=new PerspectiveCamera();copy.position.copy(pose.eye);copy.lookAt(pose.at);return copy.quaternion.clone() }
  function samePose(a:Pose,b:Pose) { return a.eye.distanceToSquared(b.eye)<1e-18&&a.at.distanceToSquared(b.at)<1e-18&&Math.abs(a.fov-b.fov)<1e-9 }
  function sameRequest(a:Request,b:Request) { return a.id===b.id&&a.phone===b.phone&&samePose(a.pose,b.pose) }
  function matrices() { camera.updateProjectionMatrix();camera.updateMatrixWorld() }
  function placeEndpoint(request:Request) {
    completed=request;active=undefined;path=undefined;look.snap()
    camera.position.copy(request.pose.eye);base.copy(poseQuaternion(request.pose))
    camera.quaternion.copy(base);camera.fov=fittedRailFov(request.pose.fov,camera.aspect,request.phone);matrices()
  }
  function begin(request:Request,now:number) {
    if(!completed)throw new Error('Rail needs an explicit initial placement')
    // Exact eyes, aims, authored FOV and actual mounted solids must match
    // the offline proof. An inspection eye cannot borrow a station proof.
    path=authority.route(completed.pose,request.pose,request.phone,camera)
    // Route orientation stays separate from the bounded visitor look.
    fromQ.copy(base);toQ.copy(poseQuaternion(request.pose))
    fromFov=completed.pose.fov;targetFov=request.pose.fov;look.recenter()
    started=now;active=request
  }
  function render(now:number) {
    const offset=look.sample(now)
    forward.set(0,0,-1).applyQuaternion(base)
    const heading=Math.atan2(-forward.x,-forward.z),elevation=Math.asin(Math.max(-1,Math.min(1,forward.y)))
    euler.set(elevation+offset.pitch,heading+offset.yaw,0,'YXZ');camera.quaternion.setFromEuler(euler)
    matrices()
  }
  return {
    /** Physical scheduler state, separate from the shared selected destination. */
    get navigation() { return { completed:completed?.id, active:active?.id, queued:queue.map(request=>request.id) } },
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
        begin(request,now)
        queue.shift()
      }
      if(active&&reducedMotion()) {
        // One genuine endpoint per update; all later accepted requests remain.
        placeEndpoint(active);render(now);return
      }
      const t=active?Math.max(0,Math.min(1,(now-started)/duration)):1,s=t*t*(3-2*t)
      if(active&&path) {
        assertRailProjection(camera)
        path.pointAtDistance(path.length*s,camera.position)
        base.slerpQuaternions(fromQ,toQ,s)
        camera.fov=fittedRailFov(fromFov+(targetFov-fromFov)*s,camera.aspect,active.phone)
      }
      render(now)
      if(active&&t===1) {
        completed=active;active=undefined;path=undefined
        // Do not drain the queue or consume catch-up time after a delayed
        // frame. The next update starts the next leg at its own clock origin.
      }
    },
  }
}
