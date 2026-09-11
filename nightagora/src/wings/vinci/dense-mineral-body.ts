/** Original GENERATED dense mineral body. Random lattice coefficients are
 * reconstructed with overlapping quadratic B-splines: no untextured gaps.
 * Exact axis-box filtering and held-footprint gradient; no bitmap/geometry. */
import * as TSL from 'three/tsl'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N=any
const{Fn,If,float,floor,fract,smoothstep,vec2,vec3}=TSL as unknown as Record<string,N>
export const denseMineralRecipes={
  brick:[{cell:.0024,angle:.37,seed:43.173,height:.00011,colour:.11,roughness:.025},{cell:.00070,angle:-.71,seed:67.319,height:.000035,colour:.055,roughness:.015}],
  stone:[{cell:.0018,angle:.53,seed:83.137,height:.000065,colour:.085,roughness:.025},{cell:.00055,angle:-.83,seed:107.719,height:.000022,colour:.040,roughness:.015}],
} as const
const basis=Fn(([x]:N[])=>{const a=x.abs().min(1.5).toVar();return a.lessThan(.5).select(float(.75).sub(a.mul(a)),float(1.5).sub(a).pow(2).mul(.5))}).setLayout({name:'vinciDenseB2',type:'float',inputs:[{name:'x',type:'float'}]})
const primitive=Fn(([x]:N[])=>{const a=x.abs().min(1.5).toVar(),s=x.greaterThanEqual(0).select(float(1),float(-1));return a.lessThan(.5).select(a.mul(.75).sub(a.pow(3).div(3)),float(.5).sub(float(1.5).sub(a).pow(3).div(6))).mul(s)}).setLayout({name:'vinciDenseB2Integral',type:'float',inputs:[{name:'x',type:'float'}]})
/** Packed mean-zero value, d/dq.x and d/dq.y. The phase-space footprint
 * is supplied, contains no derivatives, and is held fixed for the gradient. */
export const denseQuadraticField=Fn(([q,footprint,salt]:N[])=>{
  const total=vec3(0).toVar(),w=footprint.max(vec2(.000001)).toVar(),extent=w.x.max(w.y).toVar()
  If(extent.lessThan(2),()=>{
    const home=floor(q.add(.5)).toVar(),half=w.mul(.5).toVar(),lo=q.sub(half).toVar(),hi=q.add(half).toVar()
    const x:N[]=[],y:N[]=[],dx:N[]=[],dy:N[]=[]
    for(let i=-2;i<=2;i++){
      const xx=home.x.add(i),yy=home.y.add(i)
      x.push(primitive(hi.x.sub(xx)).sub(primitive(lo.x.sub(xx))).div(w.x).max(0).toVar())
      y.push(primitive(hi.y.sub(yy)).sub(primitive(lo.y.sub(yy))).div(w.y).max(0).toVar())
      dx.push(basis(hi.x.sub(xx)).sub(basis(lo.x.sub(xx))).div(w.x).toVar())
      dy.push(basis(hi.y.sub(yy)).sub(basis(lo.y.sub(yy))).div(w.y).toVar())
    }
    // Nearest-integer home plus support1.5 and half-width<1 requires only
    // offsets -2..2. Averaged B2 weights form a partition of unity.
    for(let j=0;j<5;j++)for(let i=0;i<5;i++)If(x[i].greaterThan(0).and(y[j].greaterThan(0)),()=>{
      const cell=home.add(vec2(i-2,j-2)),coefficient=fract(cell.x.mul(127.1).add(cell.y.mul(311.7)).add(salt).sin().mul(43758.5453)).mul(2).sub(1).toVar()
      total.assign(total.add(vec3(x[i].mul(y[j]),dx[i].mul(y[j]),x[i].mul(dy[j])).mul(coefficient)))
    })
    total.assign(total.mul(float(1).sub(smoothstep(1.5,2,extent))))
  })
  return total
}).setLayout({name:'vinciDenseQuadraticField',type:'vec3',inputs:[{name:'q',type:'vec2'},{name:'footprint',type:'vec2'},{name:'salt',type:'float'}]})
export function denseMineralBody(U:N,footprint:N,clay:boolean):{gradient:N;colour:N;roughness:N}{
  let gradient:N=vec2(0),colour:N=float(0),roughness:N=float(0)
  for(const r of clay?denseMineralRecipes.brick:denseMineralRecipes.stone){
    const c=Math.cos(r.angle),s=Math.sin(r.angle),Q=vec2(U.x.mul(c).add(U.y.mul(s)),U.y.mul(c).sub(U.x.mul(s))).div(r.cell).toVar()
    const W=vec2(footprint.x.mul(Math.abs(c)).add(footprint.y.mul(Math.abs(s))),footprint.x.mul(Math.abs(s)).add(footprint.y.mul(Math.abs(c)))).div(r.cell).toVar()
    const f=denseQuadraticField(Q,W,float(r.seed*73.17)),g=vec2(f.y.mul(c).sub(f.z.mul(s)),f.y.mul(s).add(f.z.mul(c))).div(r.cell)
    gradient=gradient.add(g.mul(r.height));colour=colour.add(f.x.mul(r.colour));roughness=roughness.add(f.x.mul(r.roughness))
  }
  return{gradient,colour,roughness}
}
/** Assumed visual proposal ranges, not measured uncertainty intervals.
 * Values in denseMineralRecipes remain the selected rendering nominals.
 * Previews and photographs have no calibrated millimetre surface scale. */
export const denseMineralAssumedRanges={
  brick:[
    {cellM:{nominal:.0024,range:[.0018,.0032]},heightCoefficientM:{nominal:.000110,range:[.000070,.000160]}},
    {cellM:{nominal:.00070,range:[.00045,.00100]},heightCoefficientM:{nominal:.000035,range:[.000020,.000055]}},
  ],
  stone:[
    {cellM:{nominal:.0018,range:[.0012,.0026]},heightCoefficientM:{nominal:.000065,range:[.000040,.000100]}},
    {cellM:{nominal:.00055,range:[.00035,.00080]},heightCoefficientM:{nominal:.000022,range:[.000012,.000035]}},
  ],
} as const
export const denseMineralProvenance={
  class:'GENERATED',
  basis:'Uncalibrated visual appearance proposal from the CC0 Poly Haven medieval_red_brick and ambientCG Tiles143 supplier previews plus site photographs Q124/Q127/Q130/Q132. These inputs document appearance, not millimetre grain measurements. Nominals and ranges are assumed design choices; ranges are not measured uncertainty or authentic historic dimensions. No reference image is sampled.',
  recipes:denseMineralRecipes,assumedRanges:denseMineralAssumedRanges,
  poreColourCoefficients:{brick:-.12,stone:-.10},
  replaces:'The isolated 4mm-cell signed compact grain only; existing finite pores, actual geometry and broad80–180/120–280mm fields retain their original settings.',
  filter:'Overlapping quadratic B-spline lattice, exact conservative rotated-box integral and held-footprint gradient. Statistical zero mean; complete5x5 neighbourhood to two cells; fade to DC over1.5–2 cell widths. Not an all-view alias-free theorem.',
  label:{
    en:'Generated continuous mineral grain. Brick: lattice interval 2.4 mm [1.8–3.2], height coefficient 0.110 mm [0.070–0.160]; fine interval 0.70 mm [0.45–1.00], height 0.035 mm [0.020–0.055]. Pale limestone: interval 1.8 mm [1.2–2.6], height 0.065 mm [0.040–0.100]; fine interval 0.55 mm [0.35–0.80], height 0.022 mm [0.012–0.035]. Nominals and ranges are assumed appearance choices based on uncalibrated supplier previews and site photographs, not measured historic grain or measured uncertainty. Kernels span three intervals; intervals are not grain diameters. Existing finite pores retain their depth with reduced colour contrast. No photograph is sampled.',
    de:'Generiertes zusammenhängendes mineralisches Korn. Ziegel: Gitterabstand 2,4 mm [1,8–3,2], Höhenkoeffizient 0,110 mm [0,070–0,160]; feiner Abstand 0,70 mm [0,45–1,00], Höhe 0,035 mm [0,020–0,055]. Heller Kalkstein: Abstand 1,8 mm [1,2–2,6], Höhe 0,065 mm [0,040–0,100]; feiner Abstand 0,55 mm [0,35–0,80], Höhe 0,022 mm [0,012–0,035]. Nennwerte und Bereiche sind angenommene Gestaltungswerte nach unkalibrierten Anbieteransichten und Ortsfotos, keine historischen Kornmaße oder gemessenen Unsicherheiten. Profile umfassen drei Abstände; Abstände sind keine Korndurchmesser. Die endlichen Poren behalten ihre Tiefe bei geringerem Farbkontrast. Kein Foto wird abgetastet.'
  }
}
