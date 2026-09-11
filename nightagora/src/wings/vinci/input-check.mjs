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
const ok=cases.every(item=>item.ok)
console.log(JSON.stringify({ok,replacesEyes:false,cases},null,2))
if(!ok)process.exitCode=1
