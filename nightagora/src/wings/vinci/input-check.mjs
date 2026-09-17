// Deterministic wheel gestures against the actual input helper; no browser substitute.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source=readFileSync(new URL('./input.ts',import.meta.url),'utf8')
const context={exports:{}}
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context)
const cases=[
  {name:'pixel notches',events:[[0,120,0],[500,-120,0]],expected:[1,-1]},
  {name:'cooldown momentum followed by reversal',events:[[0,120,0],[100,120,0],[200,120,0],[1000,-120,0]],expected:[1,0,0,-1]},
  {name:'opposed partial gestures',events:[[0,25,0],[50,-25,0],[100,-15,0]],expected:[0,0,-1]},
  {name:'idle partial gestures do not accumulate',events:[[0,25,0],[500,25,0],[550,12,0]],expected:[0,0,1]},
  {name:'line wheel notches',events:[[0,3,1],[500,-3,1]],expected:[1,-1]},
  {name:'page wheel notches',events:[[0,1,2],[500,-1,2]],expected:[1,-1]},
  {name:'small trackpad deltas accumulate within gesture',events:[[0,12,0],[40,12,0],[80,12,0]],expected:[0,0,1]},
  {name:'invalid and zero deltas are ignored',events:[[0,0,0],[1,NaN,0],[2,Infinity,0],[3,120,0]],expected:[0,0,0,1]},
]
for(const item of cases){
  let now=0
  const step=context.exports.createWheelStepper(()=>now)
  item.actual=item.events.map(([time,delta,mode])=>{now=time;return step(delta,mode,844)})
  item.ok=JSON.stringify(item.actual)===JSON.stringify(item.expected)
}
const frameSource=readFileSync(new URL('../frame.ts',import.meta.url),'utf8')
const address={hash:''},frame={exports:{},location:address,require:()=>({})}
vm.runInNewContext(ts.transpileModule(frameSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,frame)
const old=['arrival','courtyard','picture-room'],reordered=['picture-room','arrival','courtyard'].map(id=>({id,name:id,question:''}))
const linkCases=[
  {name:'missing hash opens current first station',hash:'',expected:0},
  {name:'legacy zero still names original arrival',hash:'#s=0',expected:1},
  {name:'legacy position survives a reorder',hash:'#s=2',expected:0},
  {name:'named station survives a reorder',hash:'#s=courtyard',expected:2},
  {name:'unknown station falls back to current first',hash:'#s=missing',expected:0},
  {name:'unknown legacy position falls back to current first',hash:'#s=99',expected:0},
].map(item=>{
  address.hash=item.hash
  const actual=frame.exports.resolveWingStationIndex(frame.exports.stationFromHash(),reordered,old)
  return {...item,actual,ok:actual===item.expected}
})
linkCases.push({name:'numeric API uses current order',actual:frame.exports.resolveWingStationIndex(2,reordered,old),expected:2,ok:frame.exports.resolveWingStationIndex(2,reordered,old)===2})
linkCases.push({name:'wings without legacy maps keep numeric hashes',actual:frame.exports.resolveWingStationIndex('1',reordered),expected:1,ok:frame.exports.resolveWingStationIndex('1',reordered)===1})
// THE ONE-FINGER LOOK: the pure machine, then the binder on a stage that is only an event target.
const {createLookGesture,bindRailPointer}=context.exports
const drive=(steps,{type='touch',lift=0,id=1}={})=>{
  // steps: [[x,y,t],...] with the down first; lift is the delay after the last move
  const g=createLookGesture(),sum={dx:0,dy:0};let emitted=0
  g.begin(id,steps[0][0],steps[0][1],steps[0][2],type)
  for(const [x,y,t] of steps.slice(1)){const d=g.move(id,x,y,t);if(d){sum.dx+=d.dx;sum.dy+=d.dy;emitted++}}
  return {sum,emitted,end:g.end(id,steps.at(-1)[2]+lift)}
}
const line=(x0,y0,x1,y1,ms,n,t0=1000)=>[[x0,y0,t0],...Array.from({length:n},(_,i)=>[x0+(x1-x0)*(i+1)/n,y0+(y1-y0)*(i+1)/n,t0+ms*(i+1)/n])]
const close=(a,b,e=1e-9)=>Math.abs(a-b)<=e
const gestureCases=[]
const gcase=(name,body)=>{try{const values=body();gestureCases.push({name,ok:true,...values})}catch(error){gestureCases.push({name,ok:false,error:String(error)})}}
const must=(v,m)=>{if(!v)throw new Error(m)}
gcase('a press inside the slop moves nothing and presses where the finger landed',()=>{
  const r=drive([[200,400,0],[203,404,40],[205,399,90]],{lift:30})
  must(r.emitted===0&&r.end.kind==='press'&&r.end.x===200&&r.end.y===400,JSON.stringify(r));return {end:r.end}
})
gcase('a slow pan is batching independent',()=>{
  const a=drive(line(120,420,280,420,1000,20)),b=drive(line(120,420,280,420,1000,5)),c=drive(line(120,420,280,420,1000,160))
  must(close(a.sum.dx,160)&&close(b.sum.dx,160)&&close(c.sum.dx,160),JSON.stringify([a.sum,b.sum,c.sum]));return {lookPx:a.sum.dx}
})
gcase('a vertical swipe on touch is a step, a mouse drag and a pan are looks',()=>{
  const up=drive(line(195,520,195,370,300,10)),mouse=drive(line(195,520,195,370,300,10),{type:'mouse'}),pan=drive(line(80,420,320,420,300,10))
  must(up.end.kind==='step'&&up.end.direction===1&&mouse.end.kind==='look'&&pan.end.kind==='look'&&close(pan.sum.dx,240),JSON.stringify([up.end,mouse.end,pan]))
})
gcase('a second finger takes the press and the step away, and cannot take the look',()=>{
  const g=createLookGesture();g.begin(1,200,400,0,'touch')
  must(g.begin(2,100,100,5,'touch')===false&&g.owns(1)&&!g.owns(2),'second finger took the look')
  must(g.move(2,300,300,20)===undefined,'second finger moved the look')
  must(g.end(1,40).kind==='look','a pinch pressed')
  const f=createLookGesture();f.begin(1,195,520,0,'touch');f.spoil();for(const [x,y,t] of line(195,520,195,370,60,5,0).slice(1))f.move(1,x,y,t)
  must(f.end(1,64).kind==='look','a pinch stepped')
})
gcase('cancel, a duplicate end and a late lost capture are harmless, and a fresh contact starts fresh',()=>{
  const g=createLookGesture();g.begin(7,90,600,0,'touch');g.move(7,160,560,100);g.cancel()
  must(g.move(7,1000,1000,120)===undefined&&g.end(7,130)===undefined&&!g.active,'cancel left a hold')
  g.begin(7,30,40,200,'touch');must(g.move(7,31,38,210)===undefined,'fresh contact inherited the old look')
  must(g.end(7,220).kind==='press'&&g.end(7,221)===undefined,'duplicate end');g.cancel(7);must(!g.active,'late cancel')
})
gcase('the binder presses, looks, steps and survives refused capture',()=>{
  const calls=[];const doc=new EventTarget(),view=new EventTarget();view.screen={orientation:new EventTarget()}
  doc.defaultView=view;doc.visibilityState='visible'
  const stage=new EventTarget();Object.assign(stage,{ownerDocument:doc,getBoundingClientRect:()=>({height:844}),setPointerCapture(){throw new Error('NotFoundError')}})
  const controller=new AbortController()
  bindRailPointer({stage,signal:controller.signal,ignores:t=>t.control===true,began:()=>calls.push(['began']),
    look:(dx,dy,h)=>calls.push(['look',dx,dy,h]),step:d=>calls.push(['step',d]),press:(x,y)=>calls.push(['press',x,y])})
  const fire=(type,props,on=stage)=>{const e=new Event(type,{cancelable:true});for(const [k,v] of Object.entries({isPrimary:true,button:0,pointerType:'touch',pointerId:1,...props}))Object.defineProperty(e,k,{value:v});on.dispatchEvent(e);return e}
  fire('pointerdown',{clientX:200,clientY:400,timeStamp:0});fire('pointerup',{clientX:0,clientY:0,timeStamp:50})
  must(JSON.stringify(calls)===JSON.stringify([['began'],['press',200,400]]),'press '+JSON.stringify(calls));calls.length=0
  const down=fire('pointerdown',{clientX:195,clientY:520,timeStamp:1000});must(down.defaultPrevented,'down not taken')
  for(const [x,y,t] of line(195,520,195,370,60,5).slice(1))fire('pointermove',{clientX:x,clientY:y,timeStamp:t})
  fire('pointerup',{clientX:0,clientY:0,timeStamp:1064})
  const looked=calls.filter(c=>c[0]==='look')
  must(calls.at(-1)[0]==='step'&&calls.at(-1)[1]===1&&close(looked.reduce((a,c)=>a+c[2],0),-150)&&looked.every(c=>c[3]===844),'step '+JSON.stringify(calls));calls.length=0
  fire('pointerdown',{clientX:100,clientY:100,timeStamp:2000});fire('pointermove',{clientX:160,clientY:100,timeStamp:2100})
  view.dispatchEvent(new Event('orientationchange'));fire('pointermove',{clientX:260,clientY:100,timeStamp:2200});fire('pointerup',{timeStamp:2210})
  must(calls.filter(c=>c[0]==='look').length===1&&!calls.some(c=>c[0]==='press'||c[0]==='step'),'orientation kept the hold '+JSON.stringify(calls));calls.length=0
  const control=new EventTarget();control.control=true;stage.addEventListener('probe',()=>{})
  const e=new Event('pointerdown',{cancelable:true});for(const [k,v] of Object.entries({isPrimary:true,button:0,pointerType:'touch',pointerId:3,clientX:5,clientY:5,timeStamp:3000,target:control}))Object.defineProperty(e,k,{value:v})
  stage.dispatchEvent(e);must(!e.defaultPrevented&&calls.length===0,'a control press was taken')
  controller.abort();fire('pointerdown',{clientX:1,clientY:1,timeStamp:4000});fire('pointerup',{timeStamp:4010});must(calls.length===0,'abort left listeners')
})
const ok=cases.every(item=>item.ok)&&linkCases.every(item=>item.ok)&&gestureCases.every(item=>item.ok)
console.log(JSON.stringify({ok,replacesEyes:false,cases,linkCases,gestureCases},null,2))
if(!ok)process.exitCode=1
