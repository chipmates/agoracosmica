/** Original GENERATED finite slate cleavage; no sampled texture or surveyed
 * micro-dimensions. The physical 240 x 140 mm staggered tile ID/UV is retained.
 * Finite supports stay inside their tile. Filtering integrates a conservative
 * rotated UV box, not the exact projected pixel parallelogram. */
import * as TSL from 'three/tsl'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N=any
const{Fn,If,float,floor,fract,smoothstep,vec2,vec3}=TSL as unknown as Record<string,N>
export const slateFlakeRecipes=[
  {name:'layers',count:2,length:[.060,.110],width:[.018,.040],height:.00050,heightScale:[.70,1.30],inset:[.065,.041],colour:.060,roughness:.015,seed:43.17},
  {name:'flakes',count:4,length:[.020,.048],width:[.008,.022],height:.00016,heightScale:[.625,1.375],inset:[.030,.022],colour:.035,roughness:.010,seed:71.31},
] as const
const random=(base:N,salt:N):N=>fract(base.add(salt).sin().mul(43758.5453))
const kernel=Fn(([x]:N[])=>float(1).sub(x.mul(x)).max(0).pow(2)).setLayout({name:'vinciSlateKernel',type:'float',inputs:[{name:'x',type:'float'}]})
const primitive=Fn(([x]:N[])=>{const t=x.clamp(-1,1).toVar(),t2=t.mul(t).toVar();return t.mul(float(1).sub(t2.mul(2/3)).add(t2.mul(t2).mul(1/5)))}).setLayout({name:'vinciSlatePrimitive',type:'float',inputs:[{name:'x',type:'float'}]})
const wedge=Fn(([z,a]:N[])=>z.div(a).min(float(1).sub(z).div(float(1).sub(a))).max(0)).setLayout({name:'vinciSlateWedge',type:'float',inputs:[{name:'z',type:'float'},{name:'a',type:'float'}]})
const wedgePrimitive=Fn(([z,a]:N[])=>{const t=z.clamp(0,1).toVar(),v=float(1).sub(t).toVar();return t.lessThan(a).select(t.mul(t).div(a.mul(2)),float(.5).sub(v.mul(v).div(float(1).sub(a).mul(2))))}).setLayout({name:'vinciSlateWedgePrimitive',type:'float',inputs:[{name:'z',type:'float'},{name:'a',type:'float'}]})

/** A single finite tapered ledge: packed average and physical UV gradient.
 * All derivatives are supplied by the caller before branch divergence. */
export const slateFlake=Fn(([P,W,base,salt,lengths,widths,inset,amplitudes]:N[])=>{
  const result=vec3(0).toVar()
  const centre=inset.add(vec2(.24,.14).sub(inset.mul(2)).mul(vec2(random(base,salt),random(base,salt.add(11.731))))).toVar()
  const r=random(base,salt.add(23.173)).mul(lengths.y.sub(lengths.x)).add(lengths.x).mul(.5).toVar()
  const b=random(base,salt.add(37.719)).mul(widths.y.sub(widths.x)).add(widths.x).toVar()
  // The +/-0.35 rad bound is used by the conservative tile-stencil proof.
  const angle=random(base,salt.add(53.137)).sub(.5).mul(.70).toVar(),c=angle.cos().toVar(),s=angle.sin().toVar()
  const delta=P.sub(centre).toVar(),q=vec2(delta.x.mul(c).add(delta.y.mul(s)),delta.y.mul(c).sub(delta.x.mul(s))).toVar()
  const box=vec2(W.x.mul(c.abs()).add(W.y.mul(s.abs())),W.x.mul(s.abs()).add(W.y.mul(c.abs()))).max(vec2(.0000001)).toVar()
  const lo=q.sub(box.mul(.5)).toVar(),hi=q.add(box.mul(.5)).toVar()
  const overlaps=hi.x.greaterThan(r.negate()).and(lo.x.lessThan(r)).and(hi.y.greaterThan(b.mul(-.5))).and(lo.y.lessThan(b.mul(.5)))
  If(overlaps,()=>{
    const a=random(base,salt.add(67.371)).mul(.16).add(.74).toVar(),amplitude=random(base,salt.add(79.731)).mul(amplitudes.y.sub(amplitudes.x)).add(amplitudes.x).toVar()
    const xl=lo.x.div(r).toVar(),xh=hi.x.div(r).toVar(),yl=lo.y.div(b).add(.5).toVar(),yh=hi.y.div(b).add(.5).toVar()
    const k=primitive(xh).sub(primitive(xl)).mul(r).div(box.x).toVar(),t=wedgePrimitive(yh,a).sub(wedgePrimitive(yl,a)).mul(b).div(box.y).toVar()
    const ds=kernel(xh).sub(kernel(xl)).div(box.x).mul(t).toVar(),dt=wedge(yh,a).sub(wedge(yl,a)).div(box.y).mul(k).toVar()
    result.assign(vec3(k.mul(t),vec2(ds.mul(c).sub(dt.mul(s)),ds.mul(s).add(dt.mul(c)))).mul(amplitude))
  })
  return result
}).setLayout({name:'vinciSlateFiniteFlake',type:'vec3',inputs:[{name:'P',type:'vec2'},{name:'W',type:'vec2'},{name:'base',type:'float'},{name:'salt',type:'float'},{name:'lengths',type:'vec2'},{name:'widths',type:'vec2'},{name:'inset',type:'vec2'},{name:'amplitudes',type:'vec2'}]})

/** Exact average for each flake's chosen box; the support-to-DC transition is
 * held fixed in its physical derivative, as with the compact mineral field. */
export function slateFlakeField(U:N,footprint:N,recipe:typeof slateFlakeRecipes[number]):{value:N;gradient:N;mean:number}{
  const W=footprint.max(vec2(.0000001)).toVar()
  // Re-projecting any flake box (|angle|<=.35) to UV inflates its full widths
  // by at most |sin(2 angle)|<=.644218 times the opposite width. .65 is a
  // strict conservative bound, also used for early rejection, not geometry.
  const scan=vec2(W.x.add(W.y.mul(.65)),W.y.add(W.x.mul(.65))).toVar(),extent=scan.div(vec2(.24,.14)).toVar()
  const support=float(1).sub(smoothstep(1.5,2,extent.x.max(extent.y))).toVar()
  const mean=recipe.count*(8/15)*((recipe.length[0]+recipe.length[1])/4)*((recipe.width[0]+recipe.width[1])/2)*((recipe.heightScale[0]+recipe.heightScale[1])/2)/(.24*.14)
  const tile=Fn(([P,tileID,W]:N[])=>{
    const base=tileID.x.mul(127.1).add(tileID.y.mul(311.7)).toVar()
    let result:N=vec3(0)
    for(let k=0;k<recipe.count;k++)result=result.add(slateFlake(P,W,base,float((recipe.seed+k*17.137)*73.17),vec2(...recipe.length),vec2(...recipe.width),vec2(...recipe.inset),vec2(...recipe.heightScale)))
    return result
  }).setLayout({name:'vinciSlateTile_'+recipe.name,type:'vec3',inputs:[{name:'P',type:'vec2'},{name:'tileID',type:'vec2'},{name:'W',type:'vec2'}]})
  const packed=Fn(()=>{
    const total=vec3(0).toVar()
    If(extent.x.max(extent.y).lessThan(2),()=>{
      const row=floor(U.y.div(.14)).toVar(),half=scan.mul(.5).toVar()
      for(let j=-1;j<=1;j++){
        const r=row.add(j).toVar(),offset=fract(r.mul(.5)).toVar(),column=floor(U.x.div(.24).add(offset)).toVar()
        for(let i=-1;i<=1;i++){
          const c=column.add(i).toVar(),origin=vec2(c.sub(offset).mul(.24),r.mul(.14)).toVar(),P=U.sub(origin).toVar()
          const pad=origin.abs().max(vec2(1)).mul(2**-20).toVar(),lo=P.sub(half),hi=P.add(half)
          const overlaps=hi.x.greaterThan(pad.negate().x).and(lo.x.lessThan(pad.x.add(.24))).and(hi.y.greaterThan(pad.negate().y)).and(lo.y.lessThan(pad.y.add(.14)))
          If(overlaps,()=>{total.assign(total.add(tile(P,vec2(c,r),W)))})
        }
      }
      total.assign(vec3(total.x.sub(mean),total.yz).mul(support))
    })
    return total
  })()
  return{value:packed.x,gradient:packed.yz,mean}
}
export function slateFiniteFinish(U:N):{dx:N;dy:N;signal:N;colour:number;roughness:number}[]{
  const dx=U.dFdx().toVar(),dy=U.dFdy().toVar(),footprint=dx.abs().add(dy.abs()).toVar()
  return slateFlakeRecipes.map(recipe=>{const field=slateFlakeField(U,footprint,recipe);return{dx:field.gradient.dot(dx).mul(recipe.height),dy:field.gradient.dot(dy).mul(recipe.height),signal:field.value,colour:recipe.colour,roughness:recipe.roughness}})
}
export const slateFiniteProvenance={
  classification:'GENERATED exhibition finish, not measured historic cleavage',
  tileMetres:[.24,.14],broadFlakes:2,smallFlakes:4,
  countAssumedRanges:{layers:[1,3],flakes:[2,6]},
  rotationRadians:[-.35,.35],returnPeakFraction:[.74,.90],normalSlopeCap:.24,
  recipes:slateFlakeRecipes,
  retainedGrain:{diameterM:[.00096,.00176],heightCoefficientM:.000035,heightAssumedRangeM:[.000015,.000060]},
  filter:'Finite quartic times asymmetric wedge; analytic conservative rotated-box integral and held-box gradient; neighbouring physical staggered tiles included; declared ensemble DC transition at scan widths1.5–2 tiles',
  reference:'CC0 ambientCG RoofingTiles003 preview and Q018/Q019/Q134 are uncalibrated, read-only appearance guidance; no image sample. Feature ranges and counts are assumed design choices, not measured uncertainty or historic measurements.',
  label:{
    en:'Generated slate finish: nominal two broad layers per tile [assumed count 1–3], each 60–110 by 18–40 mm with peak 0.35–0.65 mm, and nominal four small flakes [2–6], each 20–48 by 8–22 mm with peak 0.10–0.22 mm. Separately filtered grain spans 1.0–1.8 mm with height coefficient 0.035 mm [0.015–0.060]. Counts, dimensions and ranges are design assumptions guided by uncalibrated RoofingTiles003 and Q018/Q019/Q134 appearances, not measured historic cleavage or measured uncertainty. No photograph is sampled.',
    de:'Generierte Schieferoberfläche: nominal zwei breite Lagen je Platte [angenommene Anzahl 1–3], jeweils 60–110 mal 18–40 mm mit Spitzenhöhe 0,35–0,65 mm, und nominal vier kleine Schuppen [2–6], jeweils 20–48 mal 8–22 mm mit Spitzenhöhe 0,10–0,22 mm. Separat gefiltertes Korn umfasst 1,0–1,8 mm mit Höhenkoeffizient 0,035 mm [0,015–0,060]. Anzahlen, Maße und Bereiche sind Gestaltungsannahmen nach unkalibrierten Ansichten von RoofingTiles003 und Q018/Q019/Q134, keine vermessene historische Spaltung oder gemessene Unsicherheit. Kein Foto wird abgetastet.'
  }
} as const
