/** A constructive closure below the retained F16/F17 wall bases.
 * The profile was extracted from the actual standard/calm terrain triangle
 * boundaries. No IGN sample, platform, wall nominal or opening is displaced.
 */
type Point2 = [number,number]
type Point3 = [number,number,number]
interface Profile { id:string;from:Point2;to:Point2;outward:Point2;knots:[number,number][] }
export interface FoundationFace { points:Point3[];uv:Point2[];tone:number;structural:boolean }
const profiles:Profile[] = [{"id":"F16","from":[-1.4088,-1.8479],"to":[-15.9107,-11.3769],"outward":[-0.5491448827350904,0.8357271670622319],"knots":[[0,-2.25],[0.01596180046922397,-2.25],[0.04076707010562283,-2.25],[0.0882985820200051,-2.25],[0.10301705447215313,-2.25],[0.12090460931068357,-2.25],[0.13945222769768614,-2.25],[0.17868003700354043,-2.25],[0.22584741815214313,-2.25],[0.2389968314749355,-2.25],[0.2476365129073706,-2.25],[0.2582973237789335,-2.25],[0.3165929963563294,-2.25],[0.43573303583506234,-2.25],[0.4545059632542471,-2.25],[0.4904783791862892,-2.25],[0.5555752850644721,-2.25],[0.5557887921057839,-2.2507390268241108],[0.5924189301521647,-2.3775294802949514],[0.6456186305525703,-2.5616733164371888],[0.6565205085119745,-2.5994087475296523],[0.6613754136011235,-2.6163918949017724],[0.6915916235402666,-2.7220924878073576],[0.7303318970500823,-2.8578403534570107],[0.7383525326306808,-2.8859450636868975],[0.7505614623594412,-2.929074178120659],[0.8149508864511014,-3.156535462743451],[0.8555042482354895,-3.3000132020508333],[0.8682448639479998,-3.345089483261108],[0.892658214408242,-3.4324631570976982],[1,-3.8166318416595457]]},{"id":"F17","from":[-15.9107,-11.3769],"to":[-6.3206,-25.7148],"outward":[-0.831206500270749,-0.5559638062928678],"knots":[[0,-3.8166318416595457],[0.022308590890801245,-3.7790389537811278],[0.04345825503515822,-3.743248987197876],[0.10589268069048108,-3.636743354797363],[0.18294867423859545,-3.5035400867462156],[0.1894767704901609,-3.4921663284301756],[0.19923669846583858,-3.475135612487793],[0.23126880778132158,-3.4190221309661863],[0.25269391457791657,-3.3813031196594237],[0.26063865002916803,-3.3671536467638568],[0.27306084507248224,-3.3453078746795653],[0.3224391241796352,-3.257477331161499],[0.3566448889172012,-3.196167755126953],[0.4077851237811365,-3.1037927150726317],[0.44022902467184194,-3.044746208190918],[0.4619295741206749,-3.005060243606567],[0.48202110791796354,-2.9681797504425047],[0.5120593364387854,-2.9127951145172117],[0.5164659186104372,-2.904580012281777],[0.5238130992541634,-2.89104323387146],[0.6014200240617147,-2.7462888240814207],[0.6073972350088042,-2.73505859375],[0.6163335490964343,-2.7182467460632322],[0.6334018158460136,-2.6859031186740823],[0.6711652336634333,-2.6145203590393065],[0.6824069400144314,-2.593040527555896],[0.690981278853523,-2.576792526245117],[0.7205957149188512,-2.520072205497564],[0.7327733620996447,-2.496804046630859],[0.7354806060220034,-2.4915632784391275],[0.740910443265152,-2.4811635494232176],[0.7745653226982419,-2.4162450313568113],[0.8248818825018104,-2.3184974670410154],[0.8581494738216838,-2.253416109085083],[0.859887619172287,-2.25],[0.8804008932061915,-2.25],[0.941733533035204,-2.25],[0.9746731535295521,-2.25],[0.9835256009125245,-2.25],[1,-2.25]]}]
const width=.60, top=-2.20
const sub=(a:Point3,b:Point3):Point3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const cross=(a:Point3,b:Point3):Point3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const dot=(a:Point3,b:Point3):number=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const lerp=(a:Point2,b:Point2,t:number):Point2=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]
const offset=(p:Point2,n:Point2,d:number):Point2=>[p[0]+n[0]*d,p[1]+n[1]*d]
function clipHeight(points:Point3[],height:number,above:boolean):Point3[]{
  const result:Point3[]=[]
  for(let i=0;i<points.length;i++){
    const a=points[i]!,b=points[(i+1)%points.length]!,da=(a[2]-height)*(above?1:-1),db=(b[2]-height)*(above?1:-1)
    if(da>=-1e-10)result.push(a)
    if((da>1e-10&&db< -1e-10)||(da< -1e-10&&db>1e-10)){
      const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,height])
    }
  }
  return result
}

/** Return structural faces first, then the existing basement's shallow
 * .28 m coursing. Units here are east/north/height; the shell owns emission.
 */
export function foundationPlinthFaces(tier:'hero'|'standard'|'calm'):FoundationFace[]{
  const structural:FoundationFace[]=[],relief:FoundationFace[]=[]
  const n0=profiles[0]!.outward,n1=profiles[1]!.outward,corner=profiles[0]!.to
  const denominator=1+n0[0]*n1[0]+n0[1]*n1[1]
  if(denominator<.1)throw new Error('Foundation corner is not a valid inward miter')
  const innerCorner:Point2=[corner[0]-width*(n0[0]+n1[0])/denominator,corner[1]-width*(n0[1]+n1[1])/denominator]
  for(const [run,profile] of profiles.entries()){
    const length=Math.hypot(profile.to[0]-profile.from[0],profile.to[1]-profile.from[1])
    const innerA=run===0?offset(profile.from,profile.outward,-width):innerCorner
    const innerB=run===0?innerCorner:offset(profile.to,profile.outward,-width)
    const uv=(p:Point3):Point2=>[((p[0]-profile.from[0])*(profile.to[0]-profile.from[0])+(p[1]-profile.from[1])*(profile.to[1]-profile.from[1]))/length,p[2]]
    for(let part=0;part<profile.knots.length-1;part++){
      const [t0,h0]=profile.knots[part]!,[t1,h1]=profile.knots[part+1]!
      const a=lerp(profile.from,profile.to,t0),b=lerp(profile.from,profile.to,t1),c=lerp(innerA,innerB,t1),d=lerp(innerA,innerB,t0)
      const p:Point3[]=[[...a,h0],[...b,h1],[...c,h1],[...d,h0],[...a,top],[...b,top],[...c,top],[...d,top]]
      const centre=p.reduce<Point3>((v,q)=>[v[0]+q[0]/8,v[1]+q[1]/8,v[2]+q[2]/8],[0,0,0])
      const emit=(indices:number[]):void=>{
        let points=indices.map(i=>p[i]!)
        const faceCentre=points.reduce<Point3>((v,q)=>[v[0]+q[0]/points.length,v[1]+q[1]/points.length,v[2]+q[2]/points.length],[0,0,0])
        if(dot(cross(sub(points[1]!,points[0]!),sub(points[2]!,points[0]!)),sub(faceCentre,centre))<0)points=[...points].reverse()
        structural.push({points,uv:points.map(uv),tone:.76,structural:true})
      }
      emit([0,1,5,4]);emit([3,7,6,2]);emit([4,5,6,7]);emit([0,3,2,1])
      // Internal cross-sections, including the shared miter, are omitted.
      if(run===0&&part===0)emit([0,4,7,3])
      if(run===profiles.length-1&&part===profile.knots.length-2)emit([1,2,6,5])
      const outer=[p[0]!,p[1]!,p[5]!,p[4]!]
      for(let row=Math.floor(Math.min(h0,h1)/.28);row*.28<top;row++){
        const lower=Math.max(Math.min(h0,h1),row*.28+.007),upper=Math.min(top,(row+1)*.28-.007)
        if(upper<=lower)continue
        let strip=clipHeight(clipHeight(outer,lower,true),upper,false)
        if(strip.length<3)continue
        // Match the existing façade emission's outward normal.
        const normal=cross(sub(strip[1]!,strip[0]!),sub(strip[2]!,strip[0]!))
        if(normal[0]*profile.outward[0]+normal[1]*profile.outward[1]<0)strip=[...strip].reverse()
        const raised=strip.map<Point3>(q=>[q[0]+profile.outward[0]*.015,q[1]+profile.outward[1]*.015,q[2]])
        const n=Math.sin(row*127.1+length*311.7)*43758.5453123,tone=.91+(n-Math.floor(n))*.14
        relief.push({points:raised,uv:strip.map(uv),tone,structural:false})
        if(tier!=='calm')for(let edge=0;edge<strip.length;edge++){
          const q=strip[edge]!,r=strip[(edge+1)%strip.length]!
          if(Math.abs(q[2]-upper)>1e-8||Math.abs(r[2]-upper)>1e-8)continue
          const points:Point3[]=[raised[edge]!,raised[(edge+1)%strip.length]!,[r[0],r[1],r[2]+.004],[q[0],q[1],q[2]+.004]]
          const normal=cross(sub(points[1]!,points[0]!),sub(points[2]!,points[0]!))
          if(normal[2]<0)points.reverse()
          relief.push({points,uv:points.map(uv),tone,structural:false})
        }
      }
    }
  }
  return [...structural,...relief]
}

export const foundationPlinthProvenance={
  id:'vinci/foundation-plinth',assetClass:'GENERATED',certainty:'assumed',facades:['F16','F17'],
  source:['OSM','IGN','A-SITE','A-HEIGHT','A-MASONRY','Q127','Q131'],
  top_m:top,width_m:width,widthRange_m:[.45,.80],embed_m:.050,embedRange_m:[.025,.100],
  profileHash:'90adb04ace7f9d039d1affc0a1ececeb148eb3d69e510a13af1166af11143782',terrainBoundarySourceHashes:{"src/wings/vinci/site.ts":"822208275842339612fe809afc681f25de67faac90588a0200aab72f53394f2d","src/wings/vinci/data/closluce.json":"041d87fdecfd60a9efe7d8e9444433ec6c4983114b661c2671852a5aff824952","src/wings/vinci/data/terrain.json":"97fedd27a0ed7a7aa106154d8dca2b689b6ea822da0ddd075d8233cfb44840da","src/wings/vinci/data/light-rig.json":"3f66431df7086ae2b0cfb67640cecf44cb2d43425e6f8832b79bed9d53b48c1c","src/wings/vinci/terrain-mesh.ts":"ba828209a6d08d58677b00707bc0570bba41497ff861e0ac0a126f73c0f48fed","src/wings/vinci/water.ts":"faf1a13aac6bff76ceaf50a68c4e91852669214f7ea34fcbf7ac5443cd64d0e4","src/wings/vinci/paths.ts":"a45da1af84d17e26d8fe52e9ccd7c0a057da17801c91ce54516e4701ccb1c60e","src/wings/vinci/road-grade.ts":"57fc88f77c39f0b0fb846006b7fb26a0161809d5f8f4ab179c8a05410dc8d137","src/wings/vinci/apron.ts":"b73e3de8b90fcbfa229a461a0ee2d99ed07343d5382a8ce77e58fd23c1422122","src/wings/vinci/inner-court.ts":"23f1a34a007bd1af0e42a1b9d4a23751824c80668965f75b3c5210c405717d90","src/wings/vinci/collection.ts":"6c72dc31d51dd6e7b932836fabcb0b7fdd7937a4b95cd526592d1e158eb84d87","src/wings/vinci/collection-access.ts":"8ce5deb22c6d72e4758287a155ce8cbb8d217fd9053aa216d3f193ef7b8e2d51","src/wings/vinci/gate-passage.ts":"c24a5c746d47ec7c51340c68e0a34d0713cd13a3ada5c6dde63c0b4dc5450ee4","src/wings/vinci/surface.ts":"f045fa6a6110c6c326c7fac1ac23684f714dd1ee0387de736287113db2e11eb9","src/wings/vinci/timber.ts":"43c3bc35eb2844d4aa2d6cc92454794f67ca3e2f450858eb85fa51992c89ac16"},
  derivation:'Connected inward masonry below the retained F16/F17 wall bottom. The lower envelope of both actual standard and calm terrain boundary profiles is embedded 50 mm; high-grade spans retain a 50 mm buried connection. One common inward miter, top, bottom and terminal caps form a physical volume. Original façade positions, basement apertures, IGN samples and platform levels remain unchanged. Surface relief continues the existing .28 m basement courses and stone shader. Constructive geometry is assumed, not a surveyed historic foundation.',
  label:{
    en:'The rear foundation is reconstructed masonry, not a surveyed historic footing. It continues the retained walls below −2.20 m, 0.60 m inward [0.45–0.80], to the retained ground with a proposed 50 mm embedment [25–100]. Its profile follows the two terrain meshes; the IGN samples, platform levels and basement openings are unchanged.',
    de:'Das rückwärtige Fundament ist rekonstruiertes Mauerwerk, kein vermessenes historisches Fundament. Es führt die bestehenden Wände unter −2,20 m um 0,60 m nach innen [0,45–0,80] bis zum erhaltenen Gelände mit vorgeschlagenen 50 mm Einbindung [25–100]. Sein Profil folgt beiden Geländenetzen; IGN-Höhen, Plattformniveaus und Kelleröffnungen bleiben unverändert.',
  },
} as const
