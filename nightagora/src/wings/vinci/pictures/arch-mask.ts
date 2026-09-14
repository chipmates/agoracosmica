/**
 * Generated exhibition-mat geometry over non-painting source shoulders.
 * These measured polylines are neither inferred semicircles nor reconstructions
 * of a panel's physical support. The source bytes, colour and painted field
 * remain untouched. Each mask stops outside the inspected visible painting
 * boundary and deliberately retains an uncertain white/rebate fringe.
 *
 * Coordinates below are pixel edges in the named evidence raster, top-left
 * origin. Recipe identity is exact id + SHA-256; a replacement source never
 * inherits another reproduction's traced edge. The full source view should
 * omit this exhibition furniture so its photographic context remains visible.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu'

export const ARCH_MASK_MANIFEST_ID = 'vinci/pictures/arch-mats'
type Point = readonly [number, number]
export interface ArchMaskSource { readonly id: string; readonly sha256?: string }
export interface ArchMaskWindow {
  /** Normalized full-source coordinates with a top-left image origin. */
  readonly left: number; readonly top: number; readonly right: number; readonly bottom: number
}
export interface PictureArchMask {
  readonly id: string
  readonly sources: readonly { readonly id: string; readonly sha256: string }[]
  readonly evidence: { readonly id: string; readonly sha256: string; readonly width: number; readonly height: number }
  readonly defaultWindowPx: readonly [number, number, number, number]
  /** Observed outside edge, ordered by increasing x. Never analytically rounded. */
  readonly boundaryPx: readonly Point[]
  /** Subtracted from image y, toward the non-painted shoulder. */
  readonly retainedFringePx: number
  readonly method: string
  readonly limitation: string
  readonly physicalRegistration: false
}

const LOUVRE_EDGE: readonly Point[] = [
  [0,283],[1,277],[2,271],[4,261],[8,245],[16,219],[24,199],[32,182],
  [40,167],[48,153],[56,141],[64,130],[72,120],[80,110],[88,102],[96,94],
  [104,86],[112,79],[120,72],[128,66],[136,60],[144,54],[152,49],[160,44],
  [168,39],[176,35],[184,31],[192,28],[200,24],[208,21],[216,18],[224,15],
  [232,13],[240,11],[248,9],[256,7],[264,5],[272,4],[280,3],[288,2],
  [296,1],[304,0],[312,0],[320,0],[328,0],[336,0],[344,1],[352,2],
  [360,3],[368,4],[376,5],[384,7],[392,9],[400,11],[408,13],[416,16],
  [424,18],[432,21],[440,24],[448,28],[456,32],[464,36],[472,40],[480,45],
  [488,50],[496,55],[504,61],[512,66],[520,72],[528,79],[536,86],[544,94],
  [552,102],[560,110],[568,118],[576,128],[584,138],[592,150],[600,162],
  [608,176],[616,192],[624,210],[632,233],[640,264],[642,275],[644,288],
  [645,296],[646,296],
]
const LONDON_EDGE: readonly Point[] = [
  [774,1577],[780,1577],[805,1483],[830,1416],[855,1365],[880,1325],
  [905,1284],[930,1251],[955,1220],[980,1190],[1005,1163],[1030,1138],
  [1055,1114],[1080,1092],[1105,1074],[1130,1057],[1155,1041],[1180,1026],
  [1205,1013],[1230,1000],[1255,989],[1280,978],[1305,969],[1330,959],
  [1355,952],[1380,944],[1405,938],[1430,933],[1455,928],[1480,923],
  [1505,919],[1530,916],[1555,914],[1580,911],[1605,910],[1630,909],
  [1655,910],[1680,910],[1705,912],[1730,914],[1755,917],[1780,922],
  [1805,927],[1830,932],[1855,938],[1880,947],[1905,956],[1930,966],
  [1955,977],[1980,988],[2005,1000],[2030,1015],[2055,1029],[2080,1044],
  [2105,1062],[2130,1082],[2155,1104],[2180,1128],[2205,1153],[2230,1182],
  [2255,1211],[2280,1239],[2305,1275],[2330,1312],[2355,1358],[2380,1411],
  [2405,1476],[2410,1493],[2415,1507],[2420,1529],[2423,1538],
  [2425,1551],[2427,1561],[2429,1573],[2430,1597],[2435,1597],[2444,1597],
]
const BENOIS_EDGE: readonly Point[] = [
  [0,308],[1,298],[2,290],[4,277],[8,257],[16,229],[24,207],[32,188],
  [40,172],[48,158],[56,145],[64,134],[72,123],[80,113],[88,104],[96,96],
  [104,88],[112,80],[120,73],[128,67],[136,61],[144,55],[152,50],[160,45],
  [168,40],[176,35],[184,31],[192,28],[200,24],[208,21],[216,18],[224,15],
  [232,12],[240,10],[248,8],[256,6],[264,5],[272,3],[280,2],[288,1],
  [296,0],[304,0],[312,0],[320,0],[328,0],[336,0],[344,0],[352,1],
  [360,2],[368,3],[376,5],[384,6],[392,8],[400,10],[408,12],[416,15],
  [424,18],[432,21],[440,24],[448,28],[456,31],[464,35],[472,40],[480,45],
  [488,50],[496,55],[504,61],[512,67],[520,73],[528,80],[536,88],[544,96],
  [552,104],[560,113],[568,123],[576,133],[584,145],[592,158],[600,172],
  [608,188],[616,207],[624,229],[632,258],[633,262],[637,283],[639,298],
  [640,307],[641,307],
]

export const PICTURE_ARCH_MASKS: readonly PictureArchMask[] = [
  {
    id: 'virgin-of-the-rocks-louvre',
    sources: [
      { id: 'vinci/painting-plate/virgin-of-the-rocks-louvre', sha256: '7a316d609a7b60bbf78c060eac1780ec3651e2e1ce95d6f4f4f8723f90d94b37' },
      { id: 'vinci/painting-preview/virgin-of-the-rocks-louvre', sha256: '57e9c8b2386058caa70d09a686905d9fed6e2844217294fe8923284b09f16175' },
    ],
    evidence: { id: 'vinci/painting-preview/virgin-of-the-rocks-louvre', sha256: '57e9c8b2386058caa70d09a686905d9fed6e2844217294fe8923284b09f16175', width: 646, height: 1024 },
    defaultWindowPx: [0,0,646,1024], boundaryPx: LOUVRE_EDGE, retainedFringePx: 5,
    method: 'Inspected source-white shoulders; first significant non-white pixel from each sampled top column, retaining five preview pixels outside the edge. Every covered preview pixel is independently checked to remain near white.',
    limitation: 'Preview-derived display mask, normalized onto the corresponding full plate. The narrow white fringe is retained for resampling uncertainty. This neither authenticates the physical arch nor alters its source aspect ratio.',
    physicalRegistration: false,
  },
  {
    id: 'virgin-of-the-rocks-london',
    sources: [
      { id: 'vinci/painting-plate/virgin-of-the-rocks-london', sha256: '1c84b73ff94b3ef2b04a217b5484a7f287c11ec7089b8c20966210ceeae0bc25' },
      { id: 'vinci/painting-preview/virgin-of-the-rocks-london', sha256: 'c9acb2f1d6f7454936fb13a65b90327f20fbf8ff4625b5679a57a101e94a5379' },
    ],
    evidence: { id: 'vinci/painting-plate/virgin-of-the-rocks-london', sha256: '1c84b73ff94b3ef2b04a217b5484a7f287c11ec7089b8c20966210ceeae0bc25', width: 3244, height: 4096 },
    defaultWindowPx: [774,912,2444,3483], boundaryPx: LONDON_EDGE, retainedFringePx: 24,
    method: 'Full-source inspection and sampled gold-to-dark-rebate transitions along both irregular arch halves. The mask remains twenty-four source pixels toward the gilded spandrel, outside the observed dark rebate.',
    limitation: 'A thin photographed gilt/rebate fringe is intentionally retained. The apparent apex and spring are not treated as a circle, and the hidden panel perimeter is not reconstructed. The lower and vertical photographic edges remain the separate display-window decision.',
    physicalRegistration: false,
  },
  {
    id: 'benois-madonna',
    sources: [
      { id: 'vinci/painting-plate/benois-madonna', sha256: '1e755d96419091ae77a4b2d9ea4ca734d06240fe5a1822dd34c6adf7c08c85e3' },
      { id: 'vinci/painting-preview/benois-madonna', sha256: '182a4959936320e86ab0fe28aad1aeb9363b87c2d0c7d4ee9f4c30d873691040' },
    ],
    evidence: { id: 'vinci/painting-preview/benois-madonna', sha256: '182a4959936320e86ab0fe28aad1aeb9363b87c2d0c7d4ee9f4c30d873691040', width: 641, height: 1024 },
    defaultWindowPx: [0,0,641,1024], boundaryPx: BENOIS_EDGE, retainedFringePx: 7,
    method: 'Inspected source-white shoulders; first significant non-white pixel from sampled top columns, retaining seven preview pixels outside the measured edge. Every covered preview pixel is independently checked to remain near white.',
    limitation: 'Preview-derived exhibition mat normalized onto the exact corresponding full plate, whose source pixels remain untouched. Seven preview pixels retain a narrow fringe for boundary interpolation and resampling uncertainty; the physical support outline is not authenticated or reconstructed.',
    physicalRegistration: false,
  },
]

/** Exact identity gate, also usable for a same-source preview. */
export function pictureArchMask(source: ArchMaskSource): PictureArchMask | null {
  return PICTURE_ARCH_MASKS.find(recipe => recipe.sources.some(candidate =>
    candidate.id === source.id && candidate.sha256 === source.sha256)) ?? null
}
export function archMaskDefaultWindow(recipe: PictureArchMask): ArchMaskWindow {
  const [x0,y0,x1,y1] = recipe.defaultWindowPx
  return { left:x0/recipe.evidence.width,top:y0/recipe.evidence.height,
    right:x1/recipe.evidence.width,bottom:y1/recipe.evidence.height }
}
/** Topmost image rows which the mat may cover at this evidence x coordinate. */
export function archMaskBoundaryY(recipe: PictureArchMask, x: number): number | null {
  if (!Number.isFinite(x)) throw new RangeError('Arch-mask coordinate must be finite')
  const points=recipe.boundaryPx
  if (x<points[0]![0] || x>points[points.length-1]![0]) return null
  for (let i=0;i+1<points.length;i++) {
    const a=points[i]!,b=points[i+1]!
    if (x>b[0]) continue
    return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])-recipe.retainedFringePx
  }
  return points[points.length-1]![1]-recipe.retainedFringePx
}

/**
 * Two triangulated spandrels in the displayed plate's local XY plane, z=0.
 * Parent them at the plate's centre, a fraction of a millimetre in front, with
 * the SAME generated mat material as its surrounding mount. No raster or
 * material is created, sampled or owned here. Caller owns/disposes geometry.
 * Supply the plate's actual normalized source window if it differs from the
 * default crop; widthM/heightM must be the displayed raster dimensions.
 */
export function buildArchShoulderGeometry(recipe: PictureArchMask, options: {
  widthM: number; heightM: number; window?: ArchMaskWindow
}): BufferGeometry {
  const {widthM,heightM}=options,window=options.window ?? archMaskDefaultWindow(recipe)
  if (![widthM,heightM,window.left,window.top,window.right,window.bottom].every(Number.isFinite)
    || widthM<=0 || heightM<=0 || window.left<0 || window.top<0 || window.right>1 || window.bottom>1
    || window.right<=window.left || window.bottom<=window.top)
    throw new RangeError('Arch-mask dimensions and source window must be finite, positive and contained')
  const image=recipe.evidence
  const left=window.left*image.width,right=window.right*image.width
  const top=window.top*image.height,bottom=window.bottom*image.height
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[]
  const points=recipe.boundaryPx
  const vertex=(x:number,y:number):[number,number]=>[(x-left)/(right-left)*widthM-widthM/2,heightM/2-(y-top)/(bottom-top)*heightM]
  const addTriangle=(a:Point,b:Point,c:Point)=>{
    const pa=vertex(...a),pb=vertex(...b),pc=vertex(...c)
    const area=(pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0])
    if (Math.abs(area)<1e-15) return
    const triangle=area>0 ? [pa,pb,pc] : [pa,pc,pb]
    for(const p of triangle){positions.push(p[0],p[1],0);normals.push(0,0,1);uvs.push(p[0],p[1])}
  }
  for(let i=0;i+1<points.length;i++) {
    const a=points[i]!,b=points[i+1]!
    let x0=Math.max(left,a[0]),x1=Math.min(right,b[0])
    if(x1<=x0)continue
    let y0=archMaskBoundaryY(recipe,x0)!,y1=archMaskBoundaryY(recipe,x1)!
    if(y0<=top && y1<=top)continue
    // Insert the exact intersection with the window top; no triangle bridges
    // the unmasked crown where retained-fringe values lie above the image.
    if(y0<top){x0+=(x1-x0)*(top-y0)/(y1-y0);y0=top}
    else if(y1<top){x1=x0+(x1-x0)*(top-y0)/(y1-y0);y1=top}
    y0=Math.min(bottom,y0);y1=Math.min(bottom,y1)
    addTriangle([x0,top],[x1,top],[x1,y1])
    addTriangle([x0,top],[x1,y1],[x0,y0])
  }
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
  geometry.setAttribute('normal',new Float32BufferAttribute(normals,3))
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2))
  geometry.setAttribute('tone',new Float32BufferAttribute(new Float32Array(positions.length/3).fill(1),1))
  geometry.computeBoundingBox();geometry.computeBoundingSphere()
  geometry.userData['manifestId']=ARCH_MASK_MANIFEST_ID
  geometry.userData['recipe']={id:recipe.id,evidence:recipe.evidence,retainedFringePx:recipe.retainedFringePx,
    sourceWindow:window,physicalRegistration:false,sourcePixelsEdited:false}
  return geometry
}
