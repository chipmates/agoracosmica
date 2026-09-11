/** UNMOUNTED original material microstructure. No bitmap or measured historic
 * damage is used. Compact pores/grains are integrated over a conservative UV
 * pixel box; derivatives hold that box fixed, so footprint changes are never
 * differentiated as physical relief. All UV coordinates and radii are metres.
 */
import * as TSL from 'three/tsl'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N=any
const{Fn,If,float,floor,fract,smoothstep,vec2,vec3}=TSL as unknown as Record<string,N>
export interface AggregateRecipe {
  cell:number;radius:[number,number];probability:number;seed:number;signed?:boolean
  /** A fixed anisotropy; the support remains inside its actual cell. */
  aspect?:number
}
export interface MicroField {value:N;gradient:N;mean:number}
const random=(base:N,seed:number):N=>fract(base.add(seed*73.17).sin().mul(43758.5453))
/** Integral and value of compact (1-t²)², |t|<1. Its integral is16/15. */
const kernelFn=Fn(([x]:N[])=>float(1).sub(x.mul(x)).max(0).pow(2)).setLayout({name:'vinciCompactKernel',type:'float',inputs:[{name:'x',type:'float'}]})
const kernel=(x:N):N=>kernelFn(x)
const primitiveFn=Fn(([x]:N[])=>{const t=x.clamp(-1,1).toVar(),t2=t.mul(t).toVar();return t.mul(float(1).sub(t2.mul(2/3)).add(t2.mul(t2).mul(1/5)))}).setLayout({name:'vinciCompactPrimitive',type:'float',inputs:[{name:'x',type:'float'}]})
const primitive=(x:N):N=>primitiveFn(x)
export function aggregateField(U:N,footprint:N,recipe:AggregateRecipe):MicroField {
  const L=recipe.cell,rlo=recipe.radius[0],rhi=recipe.radius[1],aspect=recipe.aspect??1
  if(rlo<=0||rhi>=.245||aspect<=0||aspect>1)throw Error('Aggregate support must stay inside its cell')
  const q=U.div(L).toVar(),width=footprint.div(L).max(vec2(.000001,.000001)).toVar()
  // A 3×3 neighborhood completely covers this box through two cell widths.
  // Return its actual stationary mean as that finite support is approached.
  const supported=width.min(vec2(2,2)).toVar(),half=supported.mul(.5).toVar()
  const support=float(1).sub(smoothstep(1.5,2,width.x.max(width.y)))
  const mean=recipe.signed?0:(16/15)**2*((rlo+rhi)/2)**2*aspect*recipe.probability
  const packed=Fn(()=>{
    const result=vec3(0).toVar()
    // Derivative footprint is evaluated before this branch. The integrated
    // profiles themselves contain no derivative operation. This skips all
    // fine-cell work once its supported stationary mean is exactly reached.
    If(width.x.max(width.y).lessThan(2),()=>{
    const home=floor(q).toVar(),boxLo=q.sub(half).toVar(),boxHi=q.add(half).toVar()
  let value:N=float(0),gradient:N=vec2(0,0)
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
    const cell=home.add(vec2(i,j)).toVar(),contribution=vec3(0).toVar()
    // Pad rejection only; never alter the actual field coordinates or radii.
    // Eight-ish Float32 ULPs of the global cell coordinate is conservative
    // against roundoff in centre+radius and q-centre arithmetic.
    const pad=cell.abs().max(vec2(1,1)).mul(2**-20).toVar()
    const boundLo=cell.add(.25-rhi).sub(pad),boundHi=cell.add(.75+rhi).add(pad)
    const overlaps=boxHi.x.greaterThan(boundLo.x).and(boxLo.x.lessThan(boundHi.x)).and(boxHi.y.greaterThan(boundLo.y)).and(boxLo.y.lessThan(boundHi.y))
    If(overlaps,()=>{
    const hashBase=cell.x.mul(127.1).add(cell.y.mul(311.7)).toVar()
    const integrate=()=>{
    const a=random(hashBase,recipe.seed),b=random(hashBase,recipe.seed+1.73)
    const centre=cell.add(vec2(a,b).mul(.5).add(.25)).toVar()
    const rx=random(hashBase,recipe.seed+3.17).mul(rhi-rlo).add(rlo).toVar()
    const ry=random(hashBase,recipe.seed+5.71).mul(rhi-rlo).add(rlo).mul(aspect).toVar()
    const delta=q.sub(centre).toVar(),lower=delta.sub(half).toVar(),upper=delta.add(half).toVar()
    const xl=lower.x.div(rx).toVar(),xh=upper.x.div(rx).toVar(),yl=lower.y.div(ry).toVar(),yh=upper.y.div(ry).toVar()
    const Kx=primitive(xh).sub(primitive(xl)).mul(rx).div(supported.x).toVar()
    const Ky=primitive(yh).sub(primitive(yl)).mul(ry).div(supported.y).toVar()
    const Dx=kernel(xh).sub(kernel(xl)).div(supported.x).div(L).toVar()
    const Dy=kernel(yh).sub(kernel(yl)).div(supported.y).div(L).toVar()
    const sign=recipe.signed?random(hashBase,recipe.seed+11.37).lessThan(.5).select(float(-1),float(1)):float(1)
    const amplitude=sign.toVar()
    contribution.assign(vec3(Kx.mul(Ky).mul(amplitude),vec2(Dx.mul(Ky),Kx.mul(Dy)).mul(amplitude)))
    }
    if(recipe.probability===1)integrate()
    else If(random(hashBase,recipe.seed+8.13).lessThan(recipe.probability),integrate)
    })
    value=value.add(contribution.x)
    gradient=gradient.add(contribution.yz)
  }
      result.assign(vec3(value.sub(mean).mul(support),gradient.mul(support)))
    })
    return result
  })()
  return{value:packed.x,gradient:packed.yz,mean}
}
/** Periodic shallow tilted facets with a narrow, smooth cleft return.
 * The zero-mean primitive gives an exact 1-D box integral at every footprint.
 * The return fraction is physical, not tied to pixels or a camera distance.
 */
export function cleftField(phase:N,phaseFootprint:N,returnFraction:number):{value:N;derivative:N} {
  const width=phaseFootprint.max(.00001),half=width.mul(.5),mean=.5-returnFraction/2
  const physical=(q:N):N=>{const v=fract(q),t=v.sub(1-returnFraction).div(returnFraction).clamp(0,1);return v.sub(t.mul(t).mul(float(3).sub(t.mul(2)))).sub(mean)}
  const integral=(q:N):N=>{const v=fract(q),t=v.sub(1-returnFraction).div(returnFraction).clamp(0,1),t2=t.mul(t);return v.mul(v).mul(.5).sub(v.mul(mean)).sub(t2.mul(t).sub(t2.mul(t2).mul(.5)).mul(returnFraction))}
  const lo=phase.sub(half),hi=phase.add(half)
  return{value:integral(hi).sub(integral(lo)).div(width),derivative:physical(hi).sub(physical(lo)).div(width)}
}
