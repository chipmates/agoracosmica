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
const ok=cases.every(item=>item.ok)&&linkCases.every(item=>item.ok)
console.log(JSON.stringify({ok,replacesEyes:false,cases,linkCases},null,2))
if(!ok)process.exitCode=1
