import { Quaternion, Vector3, PerspectiveCamera, Euler } from 'three/webgpu'
import { world } from './site'
import { gradeAt as groundHeight } from './terrain-mesh'
import { roadGradeProvenance } from './road-grade'
import { vinciStationIds, type VinciStationId } from './content'
import { createRailLookSmoother, createCertifiedRailPath } from './rail-smoothing'
import { projectRailDrag } from './projection-drag'
import { carriedPace, gaitAt, gaitHeadLift, gaitLeg, gaitRhythm, gaitSecondsAt, strollMetresPerSecond, type GaitThreshold } from './gait'
import { filmLensPixels, planCalmGaze, type CalmGazePlan, type GazeCourse } from './rail-gaze'
import { collectionLayout } from './collection'
import { collectionView } from './collection/views'
import { vinciWallEndVertex, vinciWallIsEnd, vinciWallNearerEnd, vinciWallOfStation, type VinciWall } from './collection/wall'
import { vinciApproachesAreNeighbours } from './collection/approaches'
import { COURT, FLOOR, SUPPER_WALL } from './collection/layout'
import { fittedRailFov, assertRailProjection } from './rail-projection'
import type { RailGeometryAuthority } from './rail-proof'
import { hallView } from './house-hall'

export interface Pose { eye: Vector3; at: Vector3; fov: number }
/** Which room view each collection station stands in. The rooms are built by
 * the collection module and these are its own compositions: the hang from
 * where a hang is read, the hall from its north door, the line down its
 * length, the court from the end a visitor arrives at. */
export const COLLECTION_STATION_ROOMS:Partial<Record<VinciStationId,string>>={
  'line-early':'collection-room-line',
  'picture-room':'collection-room-picture',
  'picture-room-west':'collection-room-picture-west',
  'supper-wall':'collection-room-supper',
  'reading-table':'collection-room-reading',
  flight:'collection-room-hall-screw',
  works:'collection-room-hall',
  body:'collection-room-body',
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
/** THE HALL IS STAGED FOR THE PHONE, NOT CROPPED FROM ITS WIDE VIEW. A 390 px
 * stage has under half the wide frame's width, so the aerial screw's sail is
 * centred by yaw before anything else: the flight station turns seven degrees
 * south of its room's aim, which stands the whole sail inside the frame and
 * the water screw's platform under the sheet, and lifts four so the deck
 * stands just above the sheet rather than over a band of bare floor. The
 * works station holds the aerial screw's whole sail behind the water screw:
 * the sail is 9.4 m across and stands seven metres beyond the screw, so any
 * narrower lens slices it at the left edge or the rolling mill at the right;
 * it looks down only as far as puts the plinths' feet on the sheet's edge.
 * Both lenses open until the sail's lower blade stands whole inside the
 * edge it reached. Both keep the room's own eye. Heading from north and
 * pitch, in degrees. */
const HALL_PHONE:Partial<Record<VinciStationId,{heading:number;pitch:number;fov:number}>>={
  flight:{heading:-77.5,pitch:5,fov:88},
  works:{heading:-70,pitch:-10,fov:104},
}
/** THE HALL'S WIDE FRAMES. From the room's eye the water screw's crank
 * frame stood cut at the flight frame's right edge, and no turn cleared it
 * that did not bring the sail to that edge: the flight eye stands a metre
 * further in and half a metre south, where the near screw parts from the far
 * sail, and the screw leaves the frame. The works station keeps its eye and
 * opens until the lock gates' platform and the rolling mill's plinth both
 * stand inside its edges, the sail still at its middle. */
const HALL_DESK:Partial<Record<VinciStationId,{heading:number;pitch:number;fov:number;eye?:readonly [east:number,north:number]}>>={
  flight:{heading:-87,pitch:11,fov:60,eye:[-47.5,-49.3]},
  works:{heading:-76.5,pitch:-3,fov:59},
}
const headingOf=(pose:Pose):number=>{const v=pose.at.clone().sub(pose.eye);return Math.atan2(v.x,-v.z)*180/Math.PI}
function aimedFrom(pose:Pose,heading:number,pitch:number,fov:number):Pose {
  const h=heading*Math.PI/180,t=pitch*Math.PI/180
  const along=new Vector3(Math.sin(h)*Math.cos(t),Math.sin(t),-Math.cos(h)*Math.cos(t))
  return {eye:pose.eye.clone(),at:pose.eye.clone().addScaledVector(along,10),fov}
}
/** An eye standing on the ground at east, north; aimedFrom gives its gaze. */
const standing=(e:number,n:number):Pose=>{const h=groundHeight(e,n)+1.65;return p(e,n,h,e,n,h)}
/** The eye in the great hall's door, on the axis of the three doors. */
const HALL_DOOR=p(-4.2388,-11.0992,2.45,-4.2388,-11.0992,2.45)
/** The body wall's phone eye, 5.5 m off the linen and eighty centimetres
 * north of the hang's axis: the nearest place a 390 px stage holds the whole
 * recess and the niche beside it, whose sheet opens the glass heart's film. */
const BODY_PHONE=p(-33.2,-51.8,FLOOR+1.62,-33.2,-51.8,FLOOR+1.62)
/** THE DISPLAY WALL'S DESKTOP EYE STANDS UNDER THE NAVE'S WEST END. From
 * eleven metres the nave's north beam, its foot 3.2 m over the floor, stood
 * across the field's upper north corner. From 6.4 m, forty centimetres south
 * of the axis, the line to that corner passes beyond the beam's west end and
 * under the bay's step, and the eye still faces the wall square. The phone's
 * eye stands further back, where its lens can hold the field's width. */
const SUPPER_DESK_EYE={east:-38.4,north:SUPPER_WALL.north-.4}
/** The chamber's eye, on the lawn under the court's south-west corner. */
const CHAMBER_LAWN=standing(-4,-38)
function narrowRoomPose(pose:Pose,share=NARROW_AIM_SHARE):Pose {
  const fov=Math.min(104,pose.fov*NARROW_LENS)
  const reach=pose.eye.distanceTo(pose.at)
  const drop=reach*Math.tan(fov*Math.PI/180*share)
  return {eye:pose.eye.clone(),at:pose.at.clone().setY(pose.at.y-drop),fov}
}
/** THE HOUSE'S FOUR STAND IN A PLACE OF THEIR OWN. Their rooms are not open
 * and stay named as in construction, but each of them is now an eye a visitor
 * is stood at, not one plate shared by four marks, so the frame is the room
 * and the card docks beside it like every other station's. */
export const HOUSE_STATIONS_IN_PLACE:readonly VinciStationId[]=['hall','oratory','study','chamber']
/** The stations whose frame is a place, not a plate the card may cover. */
export const vinciStandsInRoom=(id:VinciStationId):boolean=>
  COLLECTION_STATION_ROOMS[id]!==undefined||HOUSE_STATIONS_IN_PLACE.includes(id)
export function stationPose(id:VinciStationId, narrow:boolean):Pose {
  // The eye stood 0.26 m off the retaining wall, inside its own near plane,
  // and the wall filled the right third of the lower cone. It now stands
  // 0.86 m off it, out toward the middle of the road. The phone's lens came
  // down from 116 degrees: at that width the top of its frame looked 68
  // degrees above the gaze and nothing but sky can stand there.
  // The phone turns fifteen degrees up the street and lifts eleven: level at
  // a hundred degrees, the lower half of its frame was the road, and turned
  // less far the gate's jamb stood cut at the left edge. The walnut over the
  // street takes the sky's corner.
  // The desktop holds the house front as its one hero: at 70 degrees the road
  // took the lower two fifths, so it closes to 54 on the dormer gable and
  // lifts ten degrees, the gate whole at the left and the road a strip under
  // the house. Turned further up the street the gate's jamb left the frame.
  if(id==='arrival') return narrow?aimedFrom(standing(24.98,-16.13),-63.5,11,88):aimedFrom(standing(24.98,-16.13),-80,10,54)
  // The phone keeps its gaze on the door and opens the lens instead: at 70
  // degrees the cone's right half fell between the court corner and the east
  // range's windows and held neither.
  // The desktop stands 1.5 m further back on the same gaze and lifts a degree
  // and a half: from the old eye the chimney stack stood cut by the top edge.
  if(id==='courtyard') return narrow?p(10,-21,1.7,2.6,-12.5,4.8,80):aimedFrom(p(10.98,-22.13,1.7,10.98,-22.13,1.7),-41.04,14.5,60)
  // THE FOUR HOUSE ROOMS ARE NOT OPEN, so three of the stations stand on built
  // ground at the one thing of their room a visitor can see from outside: the
  // chapel's window, the court under the study's window, and the court's west
  // end on the castle's own line. THE HALL IS SEEN FROM ITS OWN DOOR. The
  // passage's side door, the service passage and the hall's door stand on one
  // axis, and the eye stands forty centimetres inside the last of them, looking
  // down it at the west windows the hour's sun comes through; the wide frame
  // turns four degrees onto the table and holds the whole west wall.
  if(id==='hall') return narrow?aimedFrom(HALL_DOOR,-123,-11,74):aimedFrom(HALL_DOOR,-119,-4,52)
  // THE CHAPEL IS THE ONE HERO. Square on from the court it was a wall of
  // ashlar in the house's shadow with nothing behind it; from the foot of the
  // raised lawn the gable took the left half of the frame, the gable the study
  // and the chamber show too. The desktop stands on the court's paving south
  // of the chapel and looks north-north-west: its lancet in the middle, the
  // stair turret whole to its cone over it, the house door's steps at the
  // right.
  // The phone keeps the chapel in the middle of its stage from a stride west.
  if(id==='oratory') return narrow?aimedFrom(standing(5.5,-25),-18,10,72):aimedFrom(standing(7.5,-25),-32,13,56)
  // The study holds two things at once now: the window of the room the visit
  // was written in, and the support under it the page is read at. The phone
  // stands 2.8 m east of the desktop's eye, where its frame holds the whole
  // gable and the trees past the house's west corner instead of brick alone,
  // turned onto the gable until both its slopes stand inside the frame, and
  // lifted so the house stands in the middle of it rather than high at its
  // right over a third of cobble. The desktop steps down off the terrace's
  // edge, twelve metres from the gable, which is as far back as a straight
  // walk in from the gate stays clear of the raised lawn east of it. It lifts
  // sixteen degrees at seventy: the finial stays whole, the quoins lean less
  // than at the old twenty-one, and the gravel in front of the plinth is a
  // fifth of the frame, not a third. At 80 degrees the walk in from the gate
  // carried a lens too wide for the meadow beside the bank.
  if(id==='study') return narrow?aimedFrom(p(5.2,-29.8,1.65,5.2,-29.8,1.65),-49,18,86):aimedFrom(standing(.5,-34),-14,16,70)
  // THE HOUSE HE DIED IN, SEEN WHOLE. From the court's west end the chamber
  // showed the gable the study stands square to, with the same windows and
  // plaque. It steps down onto the lawn under the court's south-west corner
  // and looks up the length of the house: the sunlit long front running to
  // the north end at the left, the gable's corner at the right, the chapel's
  // roofs beyond. The north gable itself stands behind a tree on ground the
  // walk does not reach. The desktop lifts fourteen degrees at seventy, which
  // keeps the finial whole; the phone turns five degrees further onto the
  // long front.
  if(id==='chamber') return narrow?aimedFrom(CHAMBER_LAWN,0,14,96):aimedFrom(CHAMBER_LAWN,5,14,70)
  // R19 accepted: actual apron paving +1.65 m; all eight principal windows clear vegetation.
  // The phone looks up eleven degrees, not twenty-three: a third of its frame
  // was sky and the house stood low, where the card is. The lens is opened
  // until the whole front stands clear of both edges. The desktop looks up
  // eighteen, not twenty-seven, so the steps climb into the house and the sky
  // no longer takes a third of the frame.
  if(id==='garden') return narrow?p(-24.5,-31.2,-4.790000057220459,-17.1936,-24.6444,-2.8819,92):p(-24.5,-31.2,-4.790000057220459,-17.5105,-24.7503,-1.6998,62)
  // THE COLLECTION'S NINE STAND IN THEIR OWN ROOMS, at the eye the module's
  // own room views were composed from. A room is entered through its door and
  // seen from where a visitor would stand to read it.
  // The wall that is not here is a measurement, and a measurement is read
  // square, or as near square as a stage can hold it: the desktop's eye stands
  // at the bay's mouth (SUPPER_DESK_EYE), the phone's 9.3 m off the field.
  if(id==='supper-wall'){
    const face=SUPPER_WALL.east+SUPPER_WALL.thickness/2
    if(!narrow){const {east,north}=SUPPER_DESK_EYE;return p(east,north,COURT.level+1.66,face,north,COURT.level+1.66+Math.tan(8*Math.PI/180)*(east-face),62)}
    // THE MEASUREMENT IS WHAT THE PHONE HOLDS. A 390 px stage takes the whole
    // 8.8 m field with a margin at a lens under a hundred degrees only from
    // nine metres or more, and on the axis at that reach the nave's north beam
    // crossed the field's upper north corner. The phone's eye stands 1.5 m
    // south of the axis, where the line to that corner passes the beam's west
    // end, and turns seven and a half degrees off square onto the field: its
    // far end stands about a tenth shorter than its near end, and the whole
    // outline stands above the sheet.
    return aimedFrom(p(-35.5,-31,COURT.level+1.66,-35.5,-31,COURT.level+1.66),-82.5,-2,100)
  }
  // THE BODY WALL'S PHONE STANDS SQUARE ON THE HANG. From the room's own eye
  // the portrait stage took the recess at its top and bare floor for its
  // lower half; here the recess spans the stage and the drawers under it end
  // where the card begins.
  if(id==='body'&&narrow) return aimedFrom(BODY_PHONE,-90,-6,100)
  const room=COLLECTION_STATION_ROOMS[id]
  // Floor subjects and the wall read end-on have a measured phone composition
  // of their own; the generic room adjustment below is for upright exhibits
  // and architecture, and a subject that runs away from the eye is neither.
  if(room?.startsWith('collection-room-line')||room?.startsWith('collection-room-picture')){const pose=collectionView(room,narrow);if(pose)return pose}
  // THE GRAVE'S PHONE LOOKS LESS FAR DOWN than the generic lift asks: the
  // sheet takes the lower third, so the slab and the board stand just above
  // it and the boardwalk runs on under it.
  if(id==='grave'&&narrow){const pose=collectionView(room!,false);if(pose)return aimedFrom(pose,headingOf(pose),-6,72)}
  if(room){const pose=collectionView(room,false),hall=HALL_PHONE[id],desk=HALL_DESK[id]
    if(pose)return narrow?hall?aimedFrom(pose,hall.heading,hall.pitch,hall.fov):narrowRoomPose(pose)
      :desk?aimedFrom(desk.eye?{...pose,eye:world(desk.eye[0],desk.eye[1],pose.eye.y)}:pose,desk.heading,desk.pitch,desk.fov):pose}
  // A future station without a room keeps the held terrace composition.
  return p(-12.4,-21.6,groundHeight(-12.4,-21.6)+1.65,-38,-44,-4.2,narrow?74:58)
}
/** THE CLOSE LOOKS THE HOUSE ALREADY HOLDS, proposed as the eleven of its four
 * stations. Every one is an authored inspection eye this table already stands,
 * so a close look here adds no pose and no geometry. An architecture close
 * look is an AUTHORED VIEW and never a pickable object: there is no body to
 * press, only a composition to be stood in. */
export const HOUSE_CLOSE_LOOKS:Partial<Record<VinciStationId,readonly string[]>>={
  hall:['motto','threshold','entry-terracotta','entry-plaster','step-wear','great-hall','great-hall-door'],
  oratory:['lancet','material-stone-close'],
  study:['masonry','gutter'],
  chamber:['material-brick-sunlit','slate-clear'],
}
export function namedPose(id:string,narrow:boolean):Pose|undefined {
  if(id==='great-hall'||id==='great-hall-door'){const v=hallView(id,narrow);return p(v.eye[0],v.eye[1],v.eye[2],v.at[0],v.at[1],v.at[2],v.fov)}
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
  // The house stations' trials, kept reproducible beside the eyes that were
  // taken. The hall was composed from outside twice before it was built: at
  // the door on the landing, where it stood until then, and back at the foot
  // of the steps, which holds the whole opening and the carving over it but
  // repeats the court's own subject.
  if(id==='composition-hall-steps')return p(4.212,-14.942,1.65,2.487,-12.367,2.05,narrow?70:55)
  if(id==='composition-hall-door')return narrow?p(3.0959,-13.0423,2.45,-1.301,-6.4787,.72,72):p(3.0959,-13.0423,2.45,-1.301,-6.4787,2.25,46)
  // The two the house walks up to, from the eyes their approaches certify.
  if(id==='composition-hall-ledge')return p(1.3707,-10.4668,2.45,.2059,-9.8828,2.035,narrow?56:44)
  if(id==='composition-study-support')return p(-.67,-24.737,1.65,-1.283,-23.824,1.04,narrow?58:46)
  // Where the court's own four stand, from the walk that passes them.
  if(id==='composition-court-objects')return p(9.4,-20.2,1.65,11.9,-16.1,.5,narrow?76:58)
  if(id==='composition-study-near')return p(.55,-26.6,1.65,-1.94,-22.848,6.05,narrow?66:52)
  if(id==='composition-chamber-corner')return p(-5,-31,1.65,-6.32,-25.71,7,narrow?76:60)
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
/** The gaze leads the walk: between the view it leaves and the composition it
 * arrives in it follows the path's own heading sampled six metres ahead of the
 * body, planned as one calm curve (`rail-gaze.ts`). The look-ahead is what
 * keeps a corner from filling the frame: the eye is already round it while
 * the body is still passing the jamb. */
/** A leg this short is one step, not a walk: there is no way to lead a gaze
 * down and the visitor is already looking at what they are arriving at. Above
 * it every route between two stations leads its own way, because a gaze that
 * swings from the eye it leaves to the eye it arrives at crosses whatever
 * stands between them, and what stands between two rooms is a wall. A leg
 * inside one room (to an object, back from it, along a wall) keeps its eye
 * on the room: it crabs and pulls back as a camera does, never turning round
 * to face its own few metres of floor. */
const GAZE_AHEAD_M = 6, WALKED_LEG_M = 3
/** Over the last metres the way ahead runs out and the arriving composition
 * takes the gaze. */
const GAZE_ARRIVAL_M = 4
/** A run along a wall this long leads its gaze down the gallery. */
const GALLERY_WALK_M = 8
/** How far the line of sight may stand off the way it leads down, how short
 * the lead may be pulled, and in what steps. Half a metre is inside the
 * envelope the certificate proves around the path, so a chord that holds it
 * runs where the body itself is about to go. */
const GAZE_CORRIDOR_M = .5, GAZE_AHEAD_LEAST_M = 1.5, GAZE_AHEAD_STEP_M = .75, GAZE_CHORD_SAMPLES = 4
/** How many stations of the walk lie between two of them. A visitor pressing
 * on asks for one further along; a visitor changing their mind asks for one
 * the same distance off. */
const stationsApart=(a:VinciStationId,b:VinciStationId):number=>{
  const from=vinciStationIds.indexOf(a), to=vinciStationIds.indexOf(b)
  return from<0||to<0?0:Math.abs(to-from)
}
const ramp=(edge0:number,edge1:number,x:number):number=>{const t=Math.max(0,Math.min(1,(x-edge0)/(edge1-edge0)));return t*t*(3-2*t)}
/** THE WALL A STATION ENDS, where it ends one. Vertex 0 and, on a wall with
 * two ends, the last are station eyes; the stops stand between them in that
 * wall's own order. */
const wallOfStation=(id:VinciStationId):VinciWall|undefined=>vinciWallOfStation(id)
export function createRail(camera:PerspectiveCamera,clock:()=>number,authority:RailGeometryAuthority) {
  /** A request that carries a wall vertex is walked on the wall's own line,
   * whether it ends at a stop of the hang or at one of its two end stations. */
  interface Request { id:VinciStationId; pose:Pose; phone:boolean; exhibit?:string; wall?:number; wallOn?:VinciWall; link?:boolean }
  let completed:Request|undefined, active:Request|undefined, pending:Request|undefined
  /** THE STATION AN APPROACH LEFT FROM, and the exhibit eye standing in front
   * of one object. A viewing eye is never a station: it carries its station's
   * id so the card keeps naming the room, and it is not on the rail. */
  let standing:Request|undefined, viewing:Request|undefined, wantsReturn=false
  /** THE NEXT EXHIBIT, WAITING ON THE WAY BACK. The certificate holds no leg
   * from one viewing eye to another, so a chain is the certified return and
   * the certified approach out, begun in the same update the return lands in:
   * one motion, with no standing at the station between them. */
  let chained:Request|undefined
  /** THE VERTEX OF THE WALL THE EYE STANDS ON, and the end vertex a walk that
   * leaves the wall runs back to first. Off the wall both are undefined. */
  let wallAt:number|undefined, wallReturn:number|undefined, wallOn:VinciWall|undefined
  let path:ReturnType<typeof createCertifiedRailPath>|undefined, placementNeedsFrame=false
  let duration=1.1, leg=gaitLeg(0), strideM=0, strideTarget=0, strideAt=0
  /** The leg's own clock retains its measured pace when the target changes.
   * A VISITOR WHO KEEPS PRESSING ON THE WALL IS NOT STROLLING: each stop
   * pressed while a run is under way speeds that run. The station rail keeps
   * its own law, that replacing the next target changes neither this leg nor
   * its landing time, because it holds one pending slot and cannot tell a
   * visitor pressing on from one changing their mind. */
  let legClock=0, legClockAt=0, pace=1, waiting=0
  /** The share of the leg under way the body has covered, for the overlay. */
  let walkedShare=1
  const fromQ=new Quaternion(), toQ=new Quaternion()
  let fromFov=49,targetFov=49
  let fromHeading=0,fromElevation=0,gaze:CalmGazePlan|undefined
  const view={heading:0,elevation:0}
  const ahead=new Vector3(), behind=new Vector3(), lead=new Vector3(), probe=new Vector3(), span=new Vector3()
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
  /** HOW FAR OFF THE WAY A CHORD RUNS. The certificate proves the path, not
   * the line of sight over it, so a chord that leaves the way the body walks
   * is a chord through whatever the way turns around. */
  function chordLeavesTheWay(at:number,aheadMetres:number):boolean {
    const total=path!.length
    path!.pointAtDistance(at,behind);path!.pointAtDistance(Math.min(total,at+aheadMetres),lead)
    span.subVectors(lead,behind)
    const length=span.lengthSq()
    if(length<1e-9)return false
    for(let sample=1;sample<GAZE_CHORD_SAMPLES;sample++){
      path!.pointAtDistance(Math.min(total,at+aheadMetres*sample/GAZE_CHORD_SAMPLES),probe)
      probe.sub(behind)
      const along=Math.max(0,Math.min(1,probe.dot(span)/length))
      if(probe.addScaledVector(span,-along).lengthSq()>GAZE_CORRIDOR_M*GAZE_CORRIDOR_M)return true
    }
    return false
  }
  /** THE LOOK AHEAD FOLLOWS THE WAY IT LEADS. Six metres on is the place the
   * walk is going only while the way runs straight at it; through a bend that
   * chord cuts the corner, and the corner is a wall. The lead is pulled back
   * to the last chord the way itself still lies under. */
  function leadMetres(bodyMetres:number):number {
    const room=Math.max(0,path!.length-bodyMetres)
    for(let metres=Math.min(GAZE_AHEAD_M,room);metres>GAZE_AHEAD_LEAST_M;metres-=GAZE_AHEAD_STEP_M){
      if(!chordLeavesTheWay(bodyMetres,metres))return metres
    }
    return Math.min(GAZE_AHEAD_LEAST_M,room)
  }
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
    completed=request;active=undefined;path=undefined;look.snap();strideM=strideTarget=0;chained=undefined
    wallOn=request.wallOn??wallOfStation(request.id)
    wallAt=request.wall??(wallOn?vinciWallEndVertex(wallOn,request.id):undefined);wallReturn=undefined
    if(!request.exhibit){viewing=undefined;standing=request;wantsReturn=false}
    camera.position.copy(request.pose.eye);base.copy(poseQuaternion(request.pose))
    camera.quaternion.copy(base);camera.fov=fittedRailFov(request.pose.fov,camera.aspect,request.phone);matrices()
  }
  /** The one certified path this request is allowed to move on: a station pair
   * for a station, the exhibit's own leg for an approach, and that same leg
   * reversed for the return, which is why the return lands on the exact eye
   * the certificate holds. */
  /** The certified path, and whether it is a route between two stations: the
   * one kind of leg whose gaze follows its way. */
  function certifiedPath(request:Request):{path:ReturnType<typeof createCertifiedRailPath>;route:boolean} {
    // A run along the wall is the sub-path of the wall's own certified line
    // between the vertex the eye stands on and the one it is asked for.
    // A run the length of a hang is a walk down the gallery, not a step to
    // the next frame: seen side on at a metre, the wall would stream past.
    if(request.wall!==undefined&&wallAt!==undefined&&request.wallOn){
      const run=authority.wall(request.wallOn.id,wallAt,request.wall,request.phone,camera)
      return {path:run,route:run.length>=GALLERY_WALK_M}
    }
    // TWO NEIGHBOURS ARE JOINED BY THEIR OWN LEG. Standing at one object and
    // asking for the one beside it walks the line between the two eyes, not
    // the way out to the station and in again.
    if(request.exhibit&&request.link&&viewing?.exhibit)
      return {path:authority.link(viewing.exhibit,request.exhibit,completed!.pose,request.pose,request.phone,camera),route:false}
    if(request.exhibit)return {path:authority.approach(completed!.pose,request.pose,request.phone,camera),route:false}
    if(viewing&&standing&&request.id===standing.id&&samePose(request.pose,standing.pose))
      return {path:authority.approach(standing.pose,viewing.pose,request.phone,camera,true),route:false}
    return {path:authority.route(completed!.pose,request.pose,request.phone,camera),route:true}
  }
  /** Where the way leads from a body position on the leg under way. */
  function course(metres:number):GazeCourse {
    const along=pathAngles(metres,leadMetres(metres))
    path!.pointAtDistance(metres,probe)
    const lift=gaitHeadLift(headLifts,probe.x,-probe.z)
    return {heading:along.heading,elevation:along.elevation+lift,weight:ramp(0,GAZE_ARRIVAL_M,path!.length-metres)}
  }
  const scaleOf=(fov:number):number=>Math.log(Math.tan(fov*Math.PI/360))
  function begin(request:Request,now:number) {
    if(!completed)throw new Error('Rail needs an explicit initial placement')
    // Exact eyes, aims, authored FOV and actual mounted solids must match
    // the offline proof. An inspection eye cannot borrow a station proof.
    const certified=certifiedPath(request)
    path=certified.path
    // THE LEG LEAVES FROM THE VIEW ON SCREEN. A look the visitor dragged is
    // taken into the leg's first view rather than sprung back in a tenth of
    // a second, so the first frame of the walk is the last frame of the stop.
    fromQ.copy(camera.quaternion);toQ.copy(poseQuaternion(request.pose))
    base.copy(fromQ);look.snap()
    const from=angles(fromQ),to=angles(toQ)
    fromHeading=from.heading;fromElevation=from.elevation
    fromFov=completed.pose.fov;targetFov=request.pose.fov
    const length=path.length
    gaze=planCalmGaze({from,to,lengthM:length,lensPixels:filmLensPixels(Math.min(fromFov,targetFov),request.phone),
      zoom:scaleOf(fittedRailFov(targetFov,camera.aspect,request.phone))-scaleOf(fittedRailFov(fromFov,camera.aspect,request.phone)),
      timed:seconds=>gaitLeg(length,seconds),
      course:certified.route&&length>=WALKED_LEG_M?course:null})
    leg=gaze.leg;duration=leg.seconds;legClock=0;legClockAt=now;pace=1;waiting=0;strideM=strideTarget=0;strideAt=now
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
    get navigation() { return { completed:completed?.id, active:active?.id, queued:pending?[pending.id]:[], legSeconds:active?duration:0, legMetres:active&&path?path.length:0, legWalked:active?walkedShare:1, legPace:active?pace:1, legGaze:active?gaze?.kind:undefined,
      exhibit:viewing?.exhibit, approaching:active?.exhibit??chained?.exhibit, returning:wantsReturn||wallReturn!==undefined||Boolean(viewing&&active&&!active.exhibit),
      /** where on the wall the eye stands, and the eye a run will land on: the
       * room's one full plate is streamed against that eye and not against the
       * body, so a run past every work carries a single request */
      wall:wallAt, wallId:wallOn?.id, running:active?.wall!==undefined, aimEye:active?.wall!==undefined?active.pose.eye:undefined,
      /** the vertex the leg under way is walking to, so a surface can name
       *  the stop being arrived at before the eye stands on it */
      wallTo:active?.wall } },
    /** A target that names a vertex of a wall is walked on that wall's own
     * line, so a stop of the walk may stand at a certified vertex without
     * being a station with a route of its own. */
    set(id:VinciStationId,pose:Pose,instant=false,phone=camera.aspect<=.9,vertex?:number) {
      const onWall=vertex!==undefined?wallOfStation(id):undefined
      const request:Request={id,pose:{eye:pose.eye.clone(),at:pose.at.clone(),fov:pose.fov},phone,
        ...(onWall?{wall:vertex,wallOn:onWall}:{})}
      // Initial/named placement, explicit inspection return and resize are
      // deliberate placement boundaries, including during reduced motion.
      if(instant||!completed){pending=undefined;placeEndpoint(request);placementNeedsFrame=true;return}
      // A certified leg finishes at its station before the newest target can
      // begin. Asking for that active endpoint cancels an older pending target.
      pending=sameRequest(active??completed,request)?undefined:request
      // A VISITOR WHO KEEPS PRESSING ON IS NOT STROLLING. Asking for a
      // station further along the walk than the one being walked to speeds
      // the leg under way, as a second press on the wall does. Asking for one
      // the same distance off is a change of mind, and leaves the pace alone.
      if(active&&pending&&!active.exhibit&&pending.wall===undefined){
        const step=stationsApart(active.id,pending.id)
        if(step>waiting){waiting=step;pace=carriedPace(waiting)}
      }
      chained=undefined
      // WHILE AN APPROACH STANDS THE RAIL TAKES THE RETURN AND A STATION, and
      // a station is walked from the station eye, which is the pair the
      // certificate holds: so the visitor comes back first, then walks on.
      if(viewing)wantsReturn=true
      // ON THE WALL THE WAY OFF IT IS THE WALL. A stop is a vertex of one
      // certified line whose ends are the room's two stations, so the eye
      // runs to the nearer of them and the walk goes on from there. A target
      // on the same line is not a way off it: that run is the line itself.
      if(wallOn&&wallAt!==undefined&&!vinciWallIsEnd(wallOn,wallAt)&&request.wall===undefined){wantsReturn=false;wallReturn=vinciWallEndVertex(wallOn,vinciWallNearerEnd(wallOn,wallAt))}
    },
    /** A RUN ALONG THE WALL, from the vertex the eye stands on to another. A
     * second press while one runs is queued, not cut: it leaves in the update
     * the current run lands in, so the eye never stands still between them. */
    along(vertex:number,id:VinciStationId,pose:Pose,exhibit?:string,phone=camera.aspect<=.9):boolean {
      if(!completed||wallOn===undefined||wallAt===undefined||vertex===wallAt||wallReturn!==undefined)return false
      const request:Request={id,pose:{eye:pose.eye.clone(),at:pose.at.clone(),fov:pose.fov},phone,exhibit,wall:vertex,wallOn}
      if(active){pending=request;pace=carriedPace(++waiting);return true}
      begin(request,clock())
      return true
    },
    /** A LEG TO ONE EXHIBIT'S OWN VIEWING EYE. It throws on an uncertified
     * approach instead of moving, exactly as a route does, and it refuses a
     * second exhibit while one is open. */
    approach(exhibit:string,pose:Pose,phone=camera.aspect<=.9,instant=false):boolean {
      if(!completed||active||viewing||pending)return false
      const request:Request={id:completed.id,pose:{eye:pose.eye.clone(),at:pose.at.clone(),fov:pose.fov},phone,exhibit}
      standing=completed
      if(instant) {
        // An eye placed on a leg is still an eye on a certified leg: the proof
        // runs whether the visitor walks it or the rig cuts to it.
        authority.approach(completed.pose,request.pose,phone,camera)
        placeEndpoint(request);viewing=request;placementNeedsFrame=true
        return true
      }
      begin(request,clock())
      return true
    },
    /** The way back is the way it came. */
    returnToStation():boolean {
      if(!viewing||!standing)return false
      wantsReturn=true
      return true
    },
    /** ONE EXHIBIT TO THE NEXT, as one motion: the return this leaves on and
     * the approach it walks out again, both certified, with nothing standing
     * still at the station between them. */
    chain(exhibit:string,pose:Pose,phone=camera.aspect<=.9):boolean {
      if(!viewing||!standing||active)return false
      const request:Request={id:standing.id,pose:{eye:pose.eye.clone(),at:pose.at.clone(),fov:pose.fov},phone,exhibit}
      // THE NEIGHBOUR IS ONE LEG AWAY. Where the room certifies the line
      // between these two eyes the walk takes it and the station is never
      // stood at; anywhere else the chain is still the return and the
      // approach out, begun in the same update.
      if(viewing.exhibit&&vinciApproachesAreNeighbours(viewing.exhibit,exhibit)&&authority.status==='verified'){
        begin({...request,link:true},clock())
        return true
      }
      chained=request
      wantsReturn=true
      return true
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
      // A QUEUED RUN LEAVES AS THE CURRENT ONE LANDS. The wall is one line and
      // a second press is the next leg of the same walk, not a new journey.
      if(!active&&pending&&pending.wall!==undefined&&wallAt!==undefined&&authority.status==='verified') {
        const request=pending
        pending=undefined
        if(request.wall!==wallAt)begin(request,now)
      }
      // OFF THE WALL BY THE WALL: the run back to the nearer end station is a
      // sub-path of the same line, and the queued station leaves from there.
      if(!active&&wallReturn!==undefined&&wallAt!==undefined&&authority.status==='verified') {
        const vertex=wallReturn
        wallReturn=undefined
        if(vertex!==wallAt&&wallOn) {
          const id=vinciWallNearerEnd(wallOn,vertex)
          begin({id,pose:stationPose(id,completed.phone),phone:completed.phone,wall:vertex,wallOn},now)
        }
      }
      // THE RETURN IS THE ONLY LEG THAT LEAVES A VIEWING EYE. Its own path is
      // the approach reversed, so its endpoint is the certified station eye.
      if(!active&&viewing&&wantsReturn&&standing&&authority.status==='verified') {
        wantsReturn=false
        begin({...standing,pose:{eye:standing.pose.eye.clone(),at:standing.pose.at.clone(),fov:standing.pose.fov}},now)
        if(pending&&samePose(pending.pose,standing.pose))pending=undefined
      }
      if(!active&&!viewing&&pending&&authority.status==='verified') {
        const request=pending
        if(samePose(completed.pose,request.pose)) {
          // Preserve settled gaze at a shared construction threshold, while
          // completing only this semantic request during the current update.
          pending=undefined;completed=request;render(now);return
        }
        // Route directly from the completed station to the newest target.
        // Retain that target if its proof rejects the route.
        begin(request,now)
        pending=undefined
      }
      if(active&&reducedMotion()) {
        // One genuine endpoint per update; the newest pending target remains.
        const arrived=active
        placeEndpoint(arrived);viewing=arrived.exhibit?arrived:undefined;render(now);return
      }
      // A chain whose return has already landed leaves in this same update.
      if(!active&&!viewing&&chained&&authority.status==='verified'){const next=chained;chained=undefined;begin(next,now)}
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
      // THE WALK YOU ARE ON DOES NOT SPEED UP UNDER YOU. Replacing the next
      // target changes neither this leg's certified route nor its pace.
      if(active)legClock+=Math.max(0,now-legClockAt)*pace
      legClockAt=now
      const walk=active&&path?gaitAt(leg,legClock):undefined
      const metres=walk?Math.min(path!.length,walk.metres+strideM):path?path.length:0
      const s=active&&path&&path.length>0?Math.max(0,Math.min(1,metres/path.length)):1
      walkedShare=s
      if(active&&path&&gaze) {
        assertRailProjection(camera)
        path.pointAtDistance(metres,camera.position)
        // THE GAZE LEADS THE WALK, on the curve planned when the leg began.
        // It is read where the body is: a stride taken by hand carries the
        // view on with it, and the arrival is the arriving view exactly.
        const tau=s>=1?leg.seconds:strideM>0?Math.max(legClock,gaitSecondsAt(leg,metres)):Math.min(legClock,leg.seconds)
        gaze.at(tau,view)
        euler.set(view.elevation,view.heading,0,'YXZ');base.setFromEuler(euler)
        camera.fov=fittedRailFov(fromFov+(targetFov-fromFov)*gaze.lens(tau),camera.aspect,active.phone)
        carry(metres,view.heading)
      }
      render(now)
      if(active&&s===1) {
        const arrived=active
        wallOn=arrived.wallOn??wallOfStation(arrived.id)
        wallAt=arrived.wall??(wallOn?vinciWallEndVertex(wallOn,arrived.id):undefined)
        // An end of the wall is a station, so a walk that leaves from there
        // leaves from the eye the certificate holds for it.
        if(!arrived.exhibit&&arrived.wall!==undefined)standing=arrived
        completed=active;viewing=active.exhibit?active:undefined;active=undefined;path=undefined
        // THE CHAIN DOES NOT STOP AT THE STATION: the outward leg begins in
        // the update the return lands in, so the eye never stands still.
        if(chained&&!viewing&&authority.status==='verified'){const next=chained;chained=undefined;begin(next,now)}
        // Do not drain the queue or consume catch-up time after a delayed
        // frame. The next update starts the next leg at its own clock origin.
      }
    },
  }
}
