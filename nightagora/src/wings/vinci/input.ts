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
