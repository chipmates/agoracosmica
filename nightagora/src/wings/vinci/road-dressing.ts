/** Original proposed road wear. The mapped alignment and common grade own
 * every contact; chips and straw describe use, never period evidence. */
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial, Vector3 } from 'three/webgpu'
import { float, length, mix, mx_noise_float, positionWorld, smoothstep, step, vec2, vec3 } from 'three/tsl'
import { dossier, feature, inside, polygon, type Quantity } from './site'
import { roadGradeProvenance } from './road-grade'
import { getPathCorridors } from './paths'
import type { Node } from 'three/webgpu'
import type { TierName } from '../../stack/tier'
const road=polygon('street').slice(0,6).map(p=>[p[0]!,p[1]!] as [number,number])
const width=feature('street').width_m!.value
const roadCorridors=getPathCorridors().filter(c=>c.id==='street'&&c.segment<road.length-1)
// Shared miter sections are interior to the union. Only unpaired edges
// may fade the material; cancelling exact endpoints changes no outline.
export const roadMaterialBoundary=(()=>{
  const edges=new Map<string,{a:[number,number];b:[number,number]}[]>()
  for(const corridor of roadCorridors)for(let i=0;i<corridor.points.length;i++){
    const a=corridor.points[i]!,b=corridor.points[(i+1)%corridor.points.length]!
    const key=[JSON.stringify(a),JSON.stringify(b)].sort().join('|')
    edges.set(key,[...(edges.get(key)??[]),{a,b}])
  }
  return[...edges.values()].filter(incident=>incident.length===1).map(incident=>incident[0]!)
})()
export const roadDressingProvenance={
  manifestId:'vinci/road-dressing',assetClass:'GENERATED',certainty:'conjectural',source:['OSM-AREA','A-SITE','Q019','Q134','library/earth-packed'],
  label:{
    en:'Conjectural road finish. Two worn wheel paths follow the mapped road, 1.40 m apart [1.20–1.60], with .09 m half-width [.06–.13] and up to .008 m surface relief [0–.012]. Proposed gravel spans .016–.055 m; sparse straw .07–.24 m long and 1.5–3 mm wide. A .24 m gutter [.16–.32] follows the house foot, with .014 m raised lips [.008–.02]. The proposed loose aggregate is clustered within the existing mapped width: patches have radii .30–1.05 m and the longer segments receive proportionate samples. Stones retain the same size interval, are embedded 1 mm, and rise 3–12 mm. Dust and compacted wear use the existing CC0 earth-packed grain in a grey-beige palette; 2.8 m variation, proposed 24 cm packed-mineral mottling [16–36], 7 cm aggregate and 6 mm grit are authored scales. The packed-mineral colour variation is reduced along the retained wheel bands; the slightly warmer grey-beige palette changes albedo, not illumination. Only the external boundary of the existing road union fades its material, so internal miter joins carry no false seam. No additional paving, terrain displacement or surviving road fabric from 1517 is claimed.',
    de:'Vermutete Straßenoberfläche. Zwei ausgefahrene Spuren folgen der kartierten Straße im Abstand von 1,40 m [1,20–1,60], mit .09 m Halbbreite [.06–.13] und bis .008 m Oberflächenrelief [0–.012]. Vorgeschlagener Kies misst .016–.055 m, verstreutes Stroh .07–.24 m Länge und 1,5–3 mm Breite. Eine .24 m Rinne [.16–.32] folgt dem Hausfuß, mit .014 m hohen Rändern [.008–.02]. Der vorgeschlagene lose Zuschlag liegt in Gruppen innerhalb der vorhandenen kartierten Breite: Die Gruppen haben Radien von .30–1.05 m; längere Abschnitte erhalten anteilig mehr Proben. Die Steine behalten denselben Größenbereich, sind 1 mm eingebettet und stehen 3–12 mm vor. Staub und verdichtete Fahrspuren nutzen die vorhandene CC0-Körnung earth-packed in Graubeige; Variation bei 2,8 m, vorgeschlagene mineralische Verdichtungsmuster bei 24 cm [16–36], Zuschlag bei 7 cm und Grus bei 6 mm sind gestaltete Maßstäbe. Die Farbvariation der Verdichtungsmuster nimmt in den vorhandenen Fahrspuren ab; die etwas wärmere graubeige Palette verändert die Albedo, nicht die Beleuchtung. Nur die Außengrenze der vorhandenen Straßenvereinigung blendet das Material aus; innere Gehrungsanschlüsse erhalten keine falsche Naht. Zusätzliche Pflasterung, verschobenes Gelände oder erhaltenes Straßenmaterial von 1517 wird nicht behauptet.',
  },
} as const
/** Gaussian cross-section gives continuous, derivative-filtered rut relief. */
/** A ground plane at a grazing angle has a long thin pixel footprint. Fading
 * detail by its longest side erases a road that is still perfectly resolved
 * across the view; the filter measure is the footprint's AREA. */
export function groundPixel(p:ReturnType<typeof vec2>){
  const dx=p.dFdx(),dy=p.dFdy()
  const area=dx.x.mul(dy.y).sub(dx.y.mul(dy.x)).abs()
  return area.sqrt().max(length(dx).add(length(dy)).mul(.14)).max(.00001)
}
export function roadWearNode(){
  const p=vec2(positionWorld.x,positionWorld.z.negate()),pixel=groundPixel(p)
  let wear:Node<'float'>=float(0)
  for(let i=1;i<road.length;i++){
    const a=road[i-1]!,b=road[i]!,dx=b[0]-a[0],dn=b[1]-a[1],span=Math.hypot(dx,dn)
    const v=p.sub(vec2(...a)),along=v.dot(vec2(dx/span,dn/span)),across=v.dot(vec2(-dn/span,dx/span))
    const ends=smoothstep(0,.3,along).mul(float(1).sub(smoothstep(span-.3,span,along)))
    const wander=mx_noise_float(vec3(along.mul(.32),float(i),0)).mul(.028)
    const distance=across.sub(wander).abs().sub(.70).abs(),sigma=pixel.mul(.5).add(.12)
    const rut=distance.div(sigma).pow(2).negate().exp().mul(ends).mul(smoothstep(.7,2,float(.18).div(pixel)))
    wear=wear.max(rut)
  }
  return wear
}
/** Surface response only, clipped to the existing mitered street corridors.
 * The terrain retains every vertex; this field cannot bridge a cut or bank. */
export function roadSurfaceNode(){
  const P=positionWorld,p=vec2(P.x,P.z.negate())
  const pixel=groundPixel(p)
  let distance:Node<'float'>=float(10000),crossings:Node<'float'>=float(0)
  for(const {a,b} of roadMaterialBoundary){
    const de=b[0]-a[0],dn=b[1]-a[1],span2=de*de+dn*dn,v=p.sub(vec2(...a))
    const t=v.dot(vec2(de,dn)).div(span2).clamp(0,1)
    distance=distance.min(length(v.sub(vec2(de,dn).mul(t))))
    // Boundary-only parity classifies the actual non-convex union. There
    // is no internal quad seam and no feather outside the mapped road.
    if(dn!==0){
      const yBand=step(Math.min(a[1],b[1]),p.y).sub(step(Math.max(a[1],b[1]),p.y))
      const crossingX=p.y.sub(a[1]).mul(de/dn).add(a[0])
      crossings=crossings.add(yBand.mul(float(1).sub(step(crossingX,p.x))))
    }
  }
  const mask=crossings.mod(2).mul(smoothstep(0,pixel.mul(1.5),distance))
  const resolved=(metres:number)=>smoothstep(2,4,float(metres).div(pixel))
  const drift=mx_noise_float(P.mul(.36)).mul(resolved(2.8))
  const packed=mx_noise_float(P.mul(1/.24)).mul(resolved(.24))
  const aggregate=mx_noise_float(P.mul(14)).mul(resolved(.07))
  const grit=mx_noise_float(P.mul(167)).mul(resolved(.006))
  const wear=roadWearNode().mul(mx_noise_float(P.mul(.7)).mul(.22).add(.78).clamp(.45,1))
  // Where every cart turns in through the gate the road is churned and damp.
  const gate=vec2(roadGradeProvenance.crossing[0],roadGradeProvenance.crossing[1])
  const churnEdge=mx_noise_float(P.mul(1.6)).mul(.55)
  const churn=float(1).sub(smoothstep(1.1,3.1,length(p.sub(gate)).add(churnEdge))).mul(.9)
  const dark=new Color('#94866e'),pale=new Color('#b1a084')
  const colour=mix(vec3(dark.r,dark.g,dark.b),vec3(pale.r,pale.g,pale.b),drift.mul(.30).add(.5))
    .mul(packed.mul(.18).add(aggregate.mul(.14)).mul(float(1).sub(wear.mul(.65))).add(grit.mul(.035)).add(1)).mul(float(1).sub(wear.mul(.34))).mul(float(1).sub(churn.mul(.30)))
  return {mask,colour,wear,height:aggregate.mul(.00065).add(grit.mul(.00012)).sub(wear.mul(.008)).sub(churn.mul(.004)).clamp(-.012,.002),
    roughness:float(.94).sub(wear.mul(.10)).sub(churn.mul(.22)).add(grit.mul(.02)).clamp(.62,.98)}
}
interface Batch {p:number[];c:number[]}
const batch=():Batch=>({p:[],c:[]})
export function createRoadDressing(heightAt:(e:number,n:number)=>number,tier:TierName):Group {
  const gravel=batch(),straw=batch(),gutter=batch();let seed=15171019
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  const point=(e:number,n:number,lift=0)=>new Vector3(e,heightAt(e,n)+lift,-n)
  function tri(b:Batch,a:Vector3,c:Vector3,d:Vector3,colour:Color){for(const p of[a,c,d]){b.p.push(p.x,p.y,p.z);b.c.push(colour.r,colour.g,colour.b)}}
  const footprint=dossier.site.build_envelope.map(p=>p.value),court=polygon('courtyard')
  const safe=(e:number,n:number)=>!inside(e,n,footprint)&&!inside(e,n,court)&&Math.hypot(e-roadGradeProvenance.crossing[0],n-roadGradeProvenance.crossing[1])>1.5
  const inRoad=(e:number,n:number,margin=.002)=>roadCorridors.some(c=>
    e>=c.bounds.minE&&e<=c.bounds.maxE&&n>=c.bounds.minN&&n<=c.bounds.maxN&&
    c.points.every((a,i)=>{const b=c.points[(i+1)%c.points.length]!,de=b[0]-a[0],dn=b[1]-a[1]
      return(de*(n-a[1])-dn*(e-a[0]))/Math.hypot(de,dn)>=margin}))
  const pieces=road.slice(1).map((b,i)=>{const a=road[i]!,span=Math.hypot(b[0]-a[0],b[1]-a[1]);return{a,b,span}})
  const totalLength=pieces.reduce((sum,p)=>sum+p.span,0)
  // Sample by length, not by segment index: the 30 m arrival stretch must
  // not get the same number of candidates as the 1.5 m terminal segment.
  const locate=()=>{
    let along=random()*totalLength,piece=pieces[pieces.length-1]!
    for(const candidate of pieces){piece=candidate;if(along<=candidate.span)break;along-=candidate.span}
    const across=(random()-.5)*(width-.12),dx=(piece.b[0]-piece.a[0])/piece.span,dn=(piece.b[1]-piece.a[1])/piece.span
    return{e:piece.a[0]+dx*along-dn*across,n:piece.a[1]+dn*along+dx*across,across}
  }
  const clusters=Array.from({length:54},()=>({...locate(),radius:.30+random()*.75}))
  const acrossAt=(e:number,n:number)=>{
    let nearest=Infinity,result=0
    for(const piece of pieces){const dx=(piece.b[0]-piece.a[0])/piece.span,dn=(piece.b[1]-piece.a[1])/piece.span
      const along=Math.max(0,Math.min(piece.span,(e-piece.a[0])*dx+(n-piece.a[1])*dn))
      const distance=Math.hypot(e-piece.a[0]-dx*along,n-piece.a[1]-dn*along)
      if(distance<nearest){nearest=distance;result=(n-piece.a[1])*dx-(e-piece.a[0])*dn}}
    return result
  }
  for(let i=0;i<(tier==='calm'?4200:7600);i++){
    let {e,n}=locate()
    if(random()<.68){const patch=clusters[Math.floor(random()*clusters.length)]!,angle=random()*Math.PI*2,radius=Math.sqrt(random())*patch.radius
      e=patch.e+Math.cos(angle)*radius;n=patch.n+Math.sin(angle)*radius}
    const across=acrossAt(e,n),shoulder=Math.min(1,Math.abs(across)/(width/2))
    const wheel=Math.exp(-Math.pow((Math.abs(across)-.70)/.16,2))
    if(random()>(.38+.55*Math.pow(shoulder,1.3))*(1-wheel*.82)||!safe(e,n)||!inRoad(e,n))continue
    const size=.016+Math.pow(random(),1.7)*.039,angle=random()*Math.PI*2,count=5
    const colour=new Color(['#aea798','#958f80','#b9b19d','#7f7d72'][Math.floor(random()*4)]!).multiplyScalar(.90+random()*.17)
    const rise=Math.min(.012,Math.max(.003,size*(.12+random()*.1)))
    const coordinates=Array.from({length:count},(_,j)=>{const a=angle+(j+(random()-.5)*.22)*Math.PI*2/count,r=size*(.38+random()*.16)
      return[e+Math.cos(a)*r,n+Math.sin(a)*r] as [number,number]})
    if(!coordinates.every(p=>safe(...p)&&inRoad(...p)))continue
    const levels=coordinates.map(p=>heightAt(...p))
    // A loose chip cannot conceal a grade seam or span a retaining face.
    if(Math.max(...levels)-Math.min(...levels)>.04)continue
    const corners=coordinates.map(p=>point(...p,-.001)),crest=point(e,n,rise)
    for(let j=0;j<count;j++)tri(gravel,corners[j]!,corners[(j+1)%count]!,crest,colour.clone().multiplyScalar(.90+random()*.14))
    if(random()<.055){const span=.07+random()*.17,a=angle+.4,ex=Math.cos(a)*span/2,nx=Math.sin(a)*span/2,w=.0015+random()*.0015
      const coordinates=[[e-ex,n-nx],[e+ex,n+nx],[e+ex+Math.sin(a)*w,n+nx-Math.cos(a)*w]] as [number,number][]
      if(coordinates.every(p=>safe(...p)&&inRoad(...p))){const levels=coordinates.map(p=>heightAt(...p))
        if(Math.max(...levels)-Math.min(...levels)<.04)tri(straw,point(...coordinates[0]!, .001),point(...coordinates[1]!, .0015),point(...coordinates[2]!, .0015),new Color('#938365'))}}
  }
  const facades=(dossier as unknown as {facades:{id:string;from:Quantity<number[]>;to:Quantity<number[]>}[]}).facades
  for(const f of facades.filter(f=>['F01','F02'].includes(f.id))){
    const a=f.from.value,b=f.to.value,span=Math.hypot(b[0]!-a[0]!,b[1]!-a[1]!),dx=(b[0]!-a[0]!)/span,dn=(b[1]!-a[1]!)/span
    const at=(s:number,out:number,lift:number)=>point(a[0]!+dx*s+dn*out,a[1]!+dn*s-dx*out,lift)
    for(let s=.1;s<span-.1;s+=.45){const end=Math.min(span-.1,s+.446)
      if(random()<.38){
        const along=s+random()*.32,out=.32+random()*.14,span=.07+random()*.17,angle=random()*Math.PI*2
        const a=at(along-span*.5*Math.cos(angle),out-span*.5*Math.sin(angle),.004)
        const b=at(along+span*.5*Math.cos(angle),out+span*.5*Math.sin(angle),.006)
        const c=b.clone().add(new Vector3(dn*.002,0,dx*.002))
        tri(straw,a,b,c,new Color('#998666'))
      }
      for(const [left,right,l0,l1]of[[.06,.18,.014,.001],[.18,.30,.001,.014]] as const){const p=at(s,left,l0),q=at(end,left,l0),r=at(end,right,l1),t=at(s,right,l1),c=new Color('#857d68');tri(gutter,p,q,r,c);tri(gutter,p,r,t,c)}
    }
  }
  const group=new Group();group.name='vinci generated road dressing';group.userData={...roadDressingProvenance,seed:15171019,triangles:(gravel.p.length+straw.p.length+gutter.p.length)/9}
  for(const [b,name]of[[gravel,'gravel'],[straw,'straw'],[gutter,'gutter']] as const){
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(b.p,3));geometry.setAttribute('color',new Float32BufferAttribute(b.c,3));geometry.computeVertexNormals();geometry.computeBoundingSphere()
    const material=new MeshStandardNodeMaterial({vertexColors:true,roughness:.92,side:DoubleSide})
    const p=positionWorld,pixel=length(p.dFdx()).add(length(p.dFdy())).max(.00001)
    const mid=mx_noise_float(p.mul(25)).mul(smoothstep(2,4,float(.04).div(pixel)))
    const fine=mx_noise_float(p.mul(180)).mul(smoothstep(2,4,float(.0055).div(pixel)))
    material.colorNode=vec3(1,1,1).mul(mx_noise_float(p.mul(.4)).mul(.08).add(mid.mul(.055)).add(fine.mul(.035)).add(1))
    material.roughnessNode=float(.91).add(fine.mul(.025)).clamp(.87,.95)
    material.userData['basis']='GENERATED conjectural road detail: finite clustered aggregate, 2.5 m drift, 4 cm body and 5.5 mm grain. Retained stone, straw and gutter dimensions; no reference image sampled.'
    const mesh=new Mesh(geometry,material);mesh.name='vinci/road-dressing/'+name;mesh.receiveShadow=true;mesh.castShadow=false;mesh.userData={manifestId:'vinci/road-dressing',labelOccluder:false};group.add(mesh)
  }
  return group
}
