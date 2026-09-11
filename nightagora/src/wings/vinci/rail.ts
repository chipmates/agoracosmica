import { Quaternion, Vector3, PerspectiveCamera, Euler } from 'three/webgpu'
import { world } from './site'
import { gradeAt as groundHeight } from './terrain-mesh'
import { roadGradeProvenance } from './road-grade'
import type { VinciStationId } from './content'

export interface Pose { eye: Vector3; at: Vector3; fov: number }
const p=(e:number,n:number,h:number,te:number,tn:number,th:number,fov=49):Pose=>({eye:world(e,n,h),at:world(te,tn,th),fov})
/** Camera poses are exhibition choices. They change no surveyed geometry. */
export function stationPose(id:VinciStationId, narrow:boolean):Pose {
  if(id==='arrival') return narrow?p(25.5,-15.8,groundHeight(25.5,-15.8)+1.65,9.5840449817,-13.37,3,122):p(25.5,-15.8,groundHeight(25.5,-15.8)+1.65,8,-13.5,5,70)
  if(id==='courtyard') return narrow?p(10,-21,1.7,2.6,-12.5,4.8,70):p(10,-21,1.7,2.6,-12.5,4.3,60)
  if(['hall','oratory','study','chamber'].includes(id)) return p(4.4,-23.35,1.65,2,-13.8,3.5,50)
  if(id==='garden') return narrow?p(-33,-44,groundHeight(-33,-44)+1.65,-5,-12,5.1,62):p(-32,-38,groundHeight(-32,-38)+1.65,-3,-8,5,52)
  // W1 construction plates remain at the garden threshold, while the
  // researched collection reserves are kept untouched for their windows.
  return p(-28,-41,groundHeight(-28,-41)+1.65,-7,-13,4.6,54)
}
export function namedPose(id:string,narrow:boolean):Pose|undefined {
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
  if(id==='valley')return p(-80,-33,groundHeight(-80,-33)+1.65,-4,-9,3.2,narrow?66:54)
  if(id==='gateway')return narrow?p(20.6107,-15.9474,2.65,10,-14,5.9,89):p(20.6107,-15.9474,2.65,5,-12,5.2,77)
  if(id==='arrival-road')return narrow?p(21,-8,2.65,7,-7,5.5,76):p(21,-8,2.65,3,-8,5.3,67)
  if(id==='arrival-gate')return narrow?p(22,-14,groundHeight(22,-14)+1.65,9,-12,5.2,76):p(22,-14,groundHeight(22,-14)+1.65,5,-10,4.8,65)
  if(id==='gable') return narrow?p(-49,53,groundHeight(-49,53)+1.65,-4,7,5.9,78):p(-37,36,groundHeight(-37,36)+1.65,-6,9,7.2,49)
  if(id==='masonry')return p(20,-13,2.9,11,-7,3,41)
  if(id==='tuffeau'||id==='motto')return p(5.9,-15.2,2.7,2.6,-12.54,3.64,narrow?57:42)
  if(id==='slate')return p(-30,-24,5,-8,-13,11,34)
  if(id==='slate-clear')return p(-20,-24,8,-9,-15,11,narrow?54:36)
  if(id==='oak')return p(10,-24,2.5,20,-25,4.1,36)
  if(id==='oak-junction')return p(15.672474,-22.401297,3.82,17.533635,-21.916856,3.80,narrow?58:42)
  if(id==='oak-fibres')return p(16.862376,-22.157504,4.28,17.533635,-21.916856,4.27,narrow?58:42)
  // Exposed diagonal end; actual opaque-shell clearance is 0.496 m.
  if(id==='oak-end')return p(17.010239151,-22.019393844,3.153073489,17.598307610,-21.993782043,3.229999900,narrow?58:42)
  return undefined
}

/** Piecewise exterior clearances; no spline can bow through a wall. */
const gateRoute=[world(...roadGradeProvenance.crossing,2.65),world(20.6107,-15.9474,2.48),world(18.2624,-17.4724,2.48),world(15.9141,-18.9974,1.65),world(13.5658,-20.5224,1.65)]
const gardenRoute=[world(4.234136,-28.251774,1.65),world(4,-33.5,1.435625),world(0,-34.3,1.1355),world(-6,-35.5,-.4104375),world(-18,-40,-3.63)]
export function createRail(camera:PerspectiveCamera,clock:()=>number) {
  interface Request { id:VinciStationId; pose:Pose }
  let completed:Request|undefined, active:Request|undefined, pending:Request|undefined
  let path:Vector3[]=[], lengths:number[]=[], total=0, started=0
  const duration=1.12, fromQ=new Quaternion(), toQ=new Quaternion()
  let fromFov=49,targetFov=49
  let yaw=0,pitch=0
  const base=new Quaternion(), euler=new Euler(0,0,0,'YXZ'), forward=new Vector3()
  function poseQuaternion(pose:Pose) { const copy=new PerspectiveCamera();copy.position.copy(pose.eye);copy.lookAt(pose.at);return copy.quaternion.clone() }
  function samePose(a:Pose,b:Pose) { return a.eye.distanceToSquared(b.eye)<1e-18&&a.at.distanceToSquared(b.at)<1e-18&&Math.abs(a.fov-b.fov)<1e-9 }
  function isGarden(id:VinciStationId) { return !['arrival','courtyard','hall','oratory','study','chamber'].includes(id) }
  function matrices() { camera.updateProjectionMatrix();camera.updateMatrixWorld() }
  function land(request:Request) {
    completed=request;active=pending=undefined;yaw=pitch=0
    camera.position.copy(request.pose.eye);base.copy(poseQuaternion(request.pose))
    camera.quaternion.copy(base);camera.fov=request.pose.fov;matrices()
  }
  function begin(request:Request,now:number) {
    // Adjacent construction stations share one physical threshold. Updating
    // their semantic station must not reset a visitor's settled gaze.
    if(completed&&samePose(completed.pose,request.pose)){completed=request;return}
    path=[camera.position.clone()]
    if(completed) {
      if(completed.id==='arrival'&&request.id!=='arrival')path.push(...gateRoute)
      const a=isGarden(completed.id),b=isGarden(request.id)
      if(a!==b)path.push(...(b?gardenRoute:[...gardenRoute].reverse()))
      if(request.id==='arrival'&&completed.id!=='arrival')path.push(...[...gateRoute].reverse())
    }
    path.push(request.pose.eye)
    lengths=path.slice(1).map((v,i)=>v.distanceTo(path[i]!));total=lengths.reduce((a,b)=>a+b,0)
    // The displayed quaternion includes drag; the undragged base does not.
    fromQ.copy(camera.quaternion);base.copy(fromQ);toQ.copy(poseQuaternion(request.pose))
    fromFov=camera.fov;targetFov=request.pose.fov;yaw=pitch=0
    started=now;active=request
  }
  return {
    set(id:VinciStationId,pose:Pose,instant=false) {
      const request={id,pose:{eye:pose.eye.clone(),at:pose.at.clone(),fov:pose.fov}}
      // Named views and resize explicitly replace both the route and queue.
      if(instant||!completed){land(request);return}
      if(!active&&samePose(completed.pose,request.pose)){completed=request;return}
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){land(request);return}
      if(active) {
        // A boundary repeat must not restart the active leg. It can still be
        // the latest intention and cancel an older queued destination.
        pending=active.id===id&&samePose(active.pose,request.pose)?undefined:request
        return
      }
      begin(request,clock())
    },
    look(y:number,pit:number){yaw=Math.max(-.6,Math.min(.6,y));pitch=Math.max(-.32,Math.min(.32,pit))},
    drag(dx:number,dy:number){yaw=Math.max(-.6,Math.min(.6,yaw-dx*.003));pitch=Math.max(-.32,Math.min(.32,pitch-dy*.0025))},
    update(){
      if(!completed)return
      const now=clock(),t=active?Math.max(0,Math.min(1,(now-started)/duration)):1,s=t*t*(3-2*t)
      if(active) {
        let travel=total*s
        for(let i=0;i<lengths.length;i++){const len=lengths[i]!;if(travel<=len||i===lengths.length-1){camera.position.lerpVectors(path[i]!,path[i+1]!,len?Math.min(1,travel/len):1);break}travel-=len}
        base.slerpQuaternions(fromQ,toQ,s);camera.fov=fromFov+(targetFov-fromFov)*s
      }
      forward.set(0,0,-1).applyQuaternion(base)
      const heading=Math.atan2(-forward.x,-forward.z),elevation=Math.asin(Math.max(-1,Math.min(1,forward.y)))
      euler.set(elevation+pitch,heading+yaw,0,'YXZ');camera.quaternion.setFromEuler(euler)
      matrices()
      if(active&&t===1) {
        completed=active;active=undefined
        // Finish at this endpoint even after a delayed frame. A pending leg
        // gets its own clock origin and never consumes hidden-tab catch-up.
        if(pending){const request=pending;pending=undefined;begin(request,now)}
      }
    },
  }
}
