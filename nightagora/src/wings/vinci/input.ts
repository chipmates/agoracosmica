/** Wheel thresholds are interface choices, independent of surveyed geometry. */
export function createWheelStepper(clock:()=>number) {
  let lastInput=-Infinity,lastStep=-Infinity,sum=0
  return (deltaY:number,deltaMode:number,viewportHeight:number):number=>{
    const delta=deltaY*(deltaMode===1?16:deltaMode===2?viewportHeight:1)
    if(!Number.isFinite(delta)||delta===0)return 0
    const now=clock()
    if(now-lastStep<450){sum=0;lastInput=now;return 0}
    if(now-lastInput>180||(sum!==0&&Math.sign(sum)!==Math.sign(delta)))sum=0
    lastInput=now;sum+=delta
    if(Math.abs(sum)<36)return 0
    const step=Math.sign(sum)
    sum=0;lastStep=now
    return step
  }
}

/** Interface choices in CSS pixels and milliseconds, the same in every engine. */
export const LOOK_RULE={
  /** travel under which a contact is a press and moves nothing */
  slopPx:8,
  /** a vertical swipe this long is a step */
  swipePx:65,
} as const

export type LookEnd =
  | {kind:'press';x:number;y:number}
  | {kind:'look'}
  | {kind:'step';direction:1|-1}

interface Sample {x:number;y:number;t:number}

/** One finger owns the look until it lifts or is cancelled. A press, a look
 * and a step are told apart by tracked positions and event times, never by
 * the lifting event's own coordinates, which WebKit does not promise. */
export function createLookGesture() {
  let owner:number|null=null,touch=false,spoiled=false,looking=false,far=0
  let start:Sample={x:0,y:0,t:0},last:Sample=start
  const finite=(...values:number[])=>values.every(Number.isFinite)
  return {
    get active(){return owner!==null},
    owns:(id:number)=>owner===id,
    begin(id:number,x:number,y:number,t:number,pointerType:string):boolean{
      if(owner!==null){if(id!==owner)spoiled=true;return false}
      if(!finite(id,x,y,t))return false
      owner=id;touch=pointerType==='touch';spoiled=false;looking=false;far=0
      start=last={x,y,t}
      return true
    },
    /** A second contact takes the press and the step away from the first. */
    spoil(){if(owner!==null)spoiled=true},
    move(id:number,x:number,y:number,t:number):{dx:number;dy:number}|undefined{
      if(id!==owner||!finite(x,y,t))return
      far=Math.max(far,Math.hypot(x-start.x,y-start.y))
      if(!looking&&far<=LOOK_RULE.slopPx)return
      const from=looking?last:start
      looking=true;last={x,y,t}
      const dx=x-from.x,dy=y-from.y
      return dx===0&&dy===0?undefined:{dx,dy}
    },
    end(id:number,t:number):LookEnd|undefined{
      if(id!==owner)return
      owner=null
      if(spoiled)return {kind:'look'}
      if(far<=LOOK_RULE.slopPx)return {kind:'press',x:start.x,y:start.y}
      const dx=last.x-start.x,dy=last.y-start.y
      if(!touch||Math.abs(dy)<=LOOK_RULE.swipePx||Math.abs(dy)<=Math.abs(dx)*1.3)return {kind:'look'}
      return {kind:'step',direction:dy<0?1:-1}
    },
    /** A cancelled, lost or interrupted contact ends as nothing at all. */
    cancel(id?:number){if(id===undefined||id===owner)owner=null},
  }
}
export type LookGesture=ReturnType<typeof createLookGesture>

export interface RailPointerHost {
  stage:HTMLElement
  signal:AbortSignal
  /** a contact that lands on one of these belongs to that control */
  ignores(target:Element):boolean
  /** the finger took the look */
  began?():void
  look(dx:number,dy:number,cssHeight:number):void
  step(direction:1|-1):void
  press(x:number,y:number):void
}

/** The stage's pointer, bound once per build. Orientation, blur and a hidden
 * page clear the hold, so a lifted finger the page never heard is not a look. */
export function bindRailPointer(host:RailPointerHost):LookGesture {
  const gesture=createLookGesture(),{stage,signal}=host
  const options={signal}
  const height=()=>stage.getBoundingClientRect().height
  stage.addEventListener('pointerdown',(e:PointerEvent)=>{
    if(gesture.active){if(!gesture.owns(e.pointerId))gesture.spoil();return}
    if(!e.isPrimary||e.button!==0||host.ignores(e.target as Element))return
    if(!gesture.begin(e.pointerId,e.clientX,e.clientY,e.timeStamp,e.pointerType))return
    e.preventDefault()
    host.began?.()
    // WebKit refuses capture for a pointer it no longer tracks; the stage covers the page either way.
    try{stage.setPointerCapture(e.pointerId)}catch{/* no capture */}
  },options)
  stage.addEventListener('pointermove',(e:PointerEvent)=>{
    const delta=gesture.move(e.pointerId,e.clientX,e.clientY,e.timeStamp)
    if(delta)host.look(delta.dx,delta.dy,height())
  },options)
  stage.addEventListener('pointerup',(e:PointerEvent)=>{
    const end=gesture.end(e.pointerId,e.timeStamp)
    if(end?.kind==='press')host.press(end.x,end.y)
    if(end?.kind==='step')host.step(end.direction)
  },options)
  for(const type of ['pointercancel','lostpointercapture'])
    stage.addEventListener(type,(e:Event)=>gesture.cancel((e as PointerEvent).pointerId),options)
  const view=stage.ownerDocument.defaultView
  const clear=()=>gesture.cancel()
  view?.addEventListener('blur',clear,options)
  view?.addEventListener('orientationchange',clear,options)
  view?.screen?.orientation?.addEventListener?.('change',clear,options)
  stage.ownerDocument.addEventListener('visibilitychange',()=>{if(stage.ownerDocument.visibilityState==='hidden')clear()},options)
  return gesture
}
