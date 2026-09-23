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
    en:'Conjectural road finish. Two worn wheel paths follow the mapped road, 1.40 m apart [1.20–1.60], with .09 m half-width [.06–.13] and up to .008 m surface relief [0–.012]. A second pair turns through the gate on a 4.50 m arc [3.50–6.00], the turning radius assumed for a loaded two-wheeled cart. Proposed gravel spans .016–.055 m; sparse straw .07–.24 m long and 1.5–3 mm wide. A .24 m gutter [.16–.32] follows the house foot and the east edge of the road at the retaining bank, with .014 m raised lips [.008–.02]. At that edge a .42 m band [.30–.55] of silt is darker, rougher and up to .010 m lower. Straw lies in wisps of three to five stalks within .03 m, denser within 9 m of the gate crossing. The proposed loose aggregate is clustered within the existing mapped width: patches have radii .30–1.05 m and the longer segments receive proportionate samples. Stones retain the same size interval, are embedded 1 mm, and rise 3–12 mm. Dust and compacted wear use the existing CC0 earth-packed grain in a grey-beige palette; 2.8 m variation, proposed 24 cm packed-mineral mottling [16–36], 7 cm aggregate, 2.1 cm chip bed and 6 mm grit are authored scales. The packed-mineral colour variation is reduced along the retained wheel bands; the slightly warmer grey-beige palette changes albedo, not illumination. Only the external boundary of the existing road union fades its material, so internal miter joins carry no false seam. No additional paving, terrain displacement or surviving road fabric from 1517 is claimed.',
    de:'Vermutete Straßenoberfläche. Zwei ausgefahrene Spuren folgen der kartierten Straße im Abstand von 1,40 m [1,20–1,60], mit .09 m Halbbreite [.06–.13] und bis .008 m Oberflächenrelief [0–.012]. Ein zweites Paar biegt auf einem Bogen von 4,50 m [3,50–6,00] durch das Tor, dem angenommenen Wenderadius eines beladenen zweirädrigen Karrens. Vorgeschlagener Kies misst .016–.055 m, verstreutes Stroh .07–.24 m Länge und 1,5–3 mm Breite. Eine .24 m Rinne [.16–.32] folgt dem Hausfuß und der Ostkante der Straße an der Stützmauer, mit .014 m hohen Rändern [.008–.02]. An dieser Kante liegt ein .42 m breites Schlickband [.30–.55], dunkler, rauer und bis .010 m tiefer. Stroh liegt in Büscheln von drei bis fünf Halmen innerhalb .03 m, dichter im Umkreis von 9 m um die Toreinfahrt. Der vorgeschlagene lose Zuschlag liegt in Gruppen innerhalb der vorhandenen kartierten Breite: Die Gruppen haben Radien von .30–1.05 m; längere Abschnitte erhalten anteilig mehr Proben. Die Steine behalten denselben Größenbereich, sind 1 mm eingebettet und stehen 3–12 mm vor. Staub und verdichtete Fahrspuren nutzen die vorhandene CC0-Körnung earth-packed in Graubeige; Variation bei 2,8 m, vorgeschlagene mineralische Verdichtungsmuster bei 24 cm [16–36], Zuschlag bei 7 cm, Splittbett bei 2,1 cm und Grus bei 6 mm sind gestaltete Maßstäbe. Die Farbvariation der Verdichtungsmuster nimmt in den vorhandenen Fahrspuren ab; die etwas wärmere graubeige Palette verändert die Albedo, nicht die Beleuchtung. Nur die Außengrenze der vorhandenen Straßenvereinigung blendet das Material aus; innere Gehrungsanschlüsse erhalten keine falsche Naht. Zusätzliche Pflasterung, verschobenes Gelände oder erhaltenes Straßenmaterial von 1517 wird nicht behauptet.',
  },
} as const
/** The turning radius of a loaded two-wheeled cart, an exhibition choice. */
const TURN_RADIUS_M=4.5
/** Gaussian cross-section gives continuous, derivative-filtered rut relief. */
/** A ground plane at a grazing angle has a long thin pixel footprint. Fading
 * detail by its longest side erases a road that is still perfectly resolved
 * across the view; the filter measure is the footprint's AREA. */
export function groundPixel(p:ReturnType<typeof vec2>){
  const dx=p.dFdx(),dy=p.dFdy()
  const area=dx.x.mul(dy.y).sub(dx.y.mul(dy.x)).abs()
  return area.sqrt().max(length(dx).add(length(dy)).mul(.14)).max(.00001)
}
export function roadWearNode(side=0){
  const p=vec2(positionWorld.x,positionWorld.z.negate()),pixel=groundPixel(p)
  let wear:Node<'float'>=float(0)
  for(let i=1;i<road.length;i++){
    const a=road[i-1]!,b=road[i]!,dx=b[0]-a[0],dn=b[1]-a[1],span=Math.hypot(dx,dn)
    const v=p.sub(vec2(...a)),along=v.dot(vec2(dx/span,dn/span)),across=v.dot(vec2(-dn/span,dx/span))
    const ends=smoothstep(0,.3,along).mul(float(1).sub(smoothstep(span-.3,span,along)))
    const wander=mx_noise_float(vec3(along.mul(.32),float(i),0)).mul(.028)
    const distance=across.sub(wander).abs().sub(.70).abs().sub(side).abs(),sigma=pixel.mul(.5).add(side?.07:.12)
    const rut=distance.div(sigma).pow(2).negate().exp().mul(ends).mul(smoothstep(.7,2,float(.18).div(pixel)))
    wear=wear.max(rut)
  }
  // A CART DOES NOT GO STRAIGHT PAST A GATE. Every load for this house turned
  // here, and a turning pair of wheels leaves an arc, not a line. The centre
  // is the road's own crossing carried in on its west normal at the turning
  // radius a two-wheeled cart needs.
  const crossing=roadGradeProvenance.crossing
  const centre=vec2(crossing[0]-.8468*TURN_RADIUS_M,crossing[1]-.5317*TURN_RADIUS_M)
  const radius=length(p.sub(centre))
  const arc=radius.sub(TURN_RADIUS_M).abs().sub(.70).abs().sub(side).abs()
  const sigma=pixel.mul(.5).add(.13)
  const near=smoothstep(9,3,length(p.sub(vec2(crossing[0],crossing[1]))))
  wear=wear.max(arc.div(sigma).pow(2).negate().exp().mul(near).mul(smoothstep(.7,2,float(.18).div(pixel))))
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
  // Between the seven centimetre aggregate and the six millimetre grit the
  // road had nothing, and two metres from the eye that is the scale the eye
  // is reading. This is the chip bed itself, not a new claim about the road.
  const chips=mx_noise_float(P.mul(48)).mul(resolved(.021))
  const grit=mx_noise_float(P.mul(167)).mul(resolved(.006))
  const wear=roadWearNode().mul(mx_noise_float(P.mul(.7)).mul(.22).add(.78).clamp(.45,1))
  // At the foot of the retaining wall the road never sees the sun and the
  // silt that washes off the bank stays there.
  let foot:Node<'float'>=float(0)
  for(let i=1;i<road.length;i++){
    const a=road[i-1]!,b=road[i]!,dx=b[0]-a[0],dn=b[1]-a[1],span=Math.hypot(dx,dn)
    if(dx<=0)continue
    const v=p.sub(vec2(...a)),along=v.dot(vec2(dx/span,dn/span)),across=v.dot(vec2(-dn/span,dx/span))
    const ends=smoothstep(0,.6,along).mul(float(1).sub(smoothstep(span-.6,span,along)))
    const edge=float(width/2).sub(across)
    const silt=mx_noise_float(vec3(along.mul(1.7),float(i),0)).mul(.09)
    foot=foot.max(float(1).sub(smoothstep(0,.42,edge.sub(silt).abs())).mul(ends))
  }
  // Where every cart turns in through the gate the road is churned and damp.
  const gate=vec2(roadGradeProvenance.crossing[0],roadGradeProvenance.crossing[1])
  const churnEdge=mx_noise_float(P.mul(1.6)).mul(.55)
  const churn=float(1).sub(smoothstep(1.1,3.1,length(p.sub(gate)).add(churnEdge))).mul(.9)
  // The two ends of a packed earth road in October: the damp margin and the
  // dried crown. They were four per cent apart, which is why it read as one
  // grey; a road that is walked and carted is not one tone.
  const dark=new Color('#7e7159'),pale=new Color('#bcae92')
  // A RUT HOLDS WATER AND FINES. Its floor is darker and smoother than the
  // crown beside it, and the wheels have pressed a low lip up at its sides.
  const lip=roadWearNode(.22).mul(float(1).sub(wear)).mul(.6)
  const colour=mix(vec3(dark.r,dark.g,dark.b),vec3(pale.r,pale.g,pale.b),drift.mul(.42).add(.5).sub(foot.mul(.24)))
    .mul(packed.mul(.20).add(aggregate.mul(.15)).add(chips.mul(.11)).mul(float(1).sub(wear.mul(.65))).add(grit.mul(.035)).add(1)).mul(float(1).sub(wear.mul(.48))).mul(float(1).sub(churn.mul(.30))).mul(float(1).sub(foot.mul(.22))).mul(lip.mul(.06).add(1))
  return {mask,colour,wear,height:aggregate.mul(.00065).add(chips.mul(.00042)).add(grit.mul(.00012)).sub(wear.mul(.024)).add(lip.mul(.008)).sub(churn.mul(.004)).sub(foot.mul(.010)).clamp(-.03,.01),
    roughness:float(.94).sub(wear.mul(.10)).sub(churn.mul(.22)).add(grit.mul(.02)).add(foot.mul(.03)).clamp(.62,.99)}
}
interface Batch {p:number[];c:number[]}
const batch=():Batch=>({p:[],c:[]})
export function createRoadDressing(heightAt:(e:number,n:number)=>number,tier:TierName):Group {
  const gravel=batch(),straw=batch(),gutter=batch();let seed=15171019
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  const point=(e:number,n:number,lift=0)=>new Vector3(e,heightAt(e,n)+lift,-n)
  function tri(b:Batch,a:Vector3,c:Vector3,d:Vector3,colour:Color){for(const p of[a,c,d]){b.p.push(p.x,p.y,p.z);b.c.push(colour.r,colour.g,colour.b)}}
  const footprint=dossier.site.build_envelope.map(p=>p.value),court=polygon('courtyard')
  const safe=(e:number,n:number)=>!inside(e,n,footprint)&&!inside(e,n,court)&&Math.hypot(e-roadGradeProvenance.crossing[0],n-roadGradeProvenance.crossing[1])>1.15
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
  // The stretch at the gate is the one a visitor stands on. It gets its own
  // candidates rather than its share of a thirty metre average.
  const gateCrossing=roadGradeProvenance.crossing
  const nearGate=Array.from({length:tier==='calm'?9:14},()=>{
    const angle=random()*Math.PI*2,radius=1.6+Math.sqrt(random())*8.4
    return{e:gateCrossing[0]+Math.cos(angle)*radius,n:gateCrossing[1]+Math.sin(angle)*radius,radius:.34+random()*.62}
  })
  for(let i=0;i<(tier==='calm'?6400:12600);i++){
    let {e,n}=locate()
    if(random()<.30){const patch=nearGate[Math.floor(random()*nearGate.length)]!,angle=random()*Math.PI*2,radius=Math.sqrt(random())*patch.radius
      e=patch.e+Math.cos(angle)*radius;n=patch.n+Math.sin(angle)*radius}
    else if(random()<.68){const patch=clusters[Math.floor(random()*clusters.length)]!,angle=random()*Math.PI*2,radius=Math.sqrt(random())*patch.radius
      e=patch.e+Math.cos(angle)*radius;n=patch.n+Math.sin(angle)*radius}
    const across=acrossAt(e,n),shoulder=Math.min(1,Math.abs(across)/(width/2))
    const wheel=Math.exp(-Math.pow((Math.abs(across)-.70)/.16,2))
    // Loose stone gathers at the gutter line as well as off the wheel bands.
    const gutterEdge=Math.exp(-Math.pow((Math.abs(across)-(width/2-.20))/.22,2))
    if(random()>(.38+.55*Math.pow(shoulder,1.3))*(1-wheel*.82)*(1-gutterEdge*.55)||!safe(e,n)||!inRoad(e,n))continue
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
    // A single stalk is under a pixel at three metres, which is why the last
    // attempt at this could not be seen. Straw lies in wisps, so the wisp is
    // what is drawn: the same stalk, three to five of them inside 30 mm.
    const gateward=1-Math.min(1,Math.hypot(e-roadGradeProvenance.crossing[0],n-roadGradeProvenance.crossing[1])/9)
    if(random()<.05+.11*gateward){
      const lie=random()*Math.PI*2,stalks=3+Math.floor(random()*3)
      for(let k=0;k<stalks;k++){
        const ce=e+(random()-.5)*.03,cn=n+(random()-.5)*.03
        const span=.07+random()*.17,a=lie+(random()-.5)*.7,ex=Math.cos(a)*span/2,nx=Math.sin(a)*span/2,w=.0015+random()*.0015
        const coordinates=[[ce-ex,cn-nx],[ce+ex,cn+nx],[ce+ex+Math.sin(a)*w,cn+nx-Math.cos(a)*w]] as [number,number][]
        if(!coordinates.every(p=>safe(...p)&&inRoad(...p)))continue
        const levels=coordinates.map(p=>heightAt(...p))
        if(Math.max(...levels)-Math.min(...levels)>.04)continue
        tri(straw,point(...coordinates[0]!, .0012),point(...coordinates[1]!, .0018),point(...coordinates[2]!, .0018),new Color('#b8a27a').multiplyScalar(.84+random()*.28))
      }
    }
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
  // The same gutter section the house foot carries, on the other side of the
  // street, where the road meets the retaining bank.
  for(let i=1;i<road.length;i++){
    const a=road[i-1]!,b=road[i]!,dx=b[0]-a[0],dn=b[1]-a[1],span=Math.hypot(dx,dn)
    if(dx<=0)continue
    const ux=dx/span,un=dn/span
    const at=(along:number,inward:number,lift:number)=>point(a[0]+ux*along-un*(width/2-inward),a[1]+un*along+ux*(width/2-inward),lift)
    for(let along=.4;along<span-.4;along+=.45){
      const end=Math.min(span-.4,along+.446)
      for(const [near,far,l0,l1]of[[.05,.17,.014,.001],[.17,.29,.001,.013]] as const){
        const p0=at(along,near,l0),p1=at(end,near,l0),p2=at(end,far,l1),p3=at(along,far,l1)
        if(![p0,p1,p2,p3].every(v=>inRoad(v.x,-v.z,-.05)))continue
        const c=new Color('#7d7460').multiplyScalar(.92+random()*.14)
        tri(gutter,p0,p1,p2,c);tri(gutter,p0,p2,p3,c)
      }
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
