import { TextureLoader, SRGBColorSpace, Texture } from 'three/webgpu'
import { loadManifest, displayable, type ManifestEntry } from '../../../../manifest'
import { ASSET_BASE } from '../../../../stack/materials'

export const PLATES={
  vespucci:'vinci/life-plate/vespucci-note-1503-heidelberg__ub-heidelberg__2500x750',
  ingres:'vinci/place-plate/jean-auguste-dominique-ingres-francois-ier-recoit-les-derniers-soupirs__petit-palais-musee-des-beaux-arts-de-la-ville-de-paris__4096x3252',
  tomb:'vinci/life-plate/tomb-of-leonardo-saint-hubert__chateau-amboise__2500x4560',
} as const
export interface LoadedPlate { texture:Texture; entry:ManifestEntry; textureMB:number; tier:'hero'|'standard'|'calm' }
export async function loadPlate(id:string,tier:'hero'|'standard'|'calm'='standard'):Promise<LoadedPlate>{
  const entry=(await loadManifest()).byId.get(id)
  if(!entry||!displayable(entry))throw new Error(`Plate is not admitted: ${id}`)
  let texture:Texture=await new TextureLoader().loadAsync(`${ASSET_BASE}${entry.wing}/${entry.path}`)
  const original=texture.image as HTMLImageElement
  if(tier==='calm'&&Math.max(original.width,original.height)>2048){
    const ratio=2048/Math.max(original.width,original.height)
    const bitmap=await createImageBitmap(original,{resizeWidth:Math.round(original.width*ratio),resizeHeight:Math.round(original.height*ratio),resizeQuality:'high',colorSpaceConversion:'none',premultiplyAlpha:'none'})
    texture.dispose();texture=new Texture(bitmap);texture.needsUpdate=true;texture.addEventListener('dispose',()=>bitmap.close())
  }
  texture.colorSpace=SRGBColorSpace;texture.anisotropy=tier==='calm'?4:8;texture.name=entry.id
  const image=texture.image as {width:number;height:number}
  let width=image.width,height=image.height,bytes=0
  for(;;){bytes+=width*height*4;if(width===1&&height===1)break;width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2))}
  return {texture,entry,tier,textureMB:bytes/(1024*1024)}
}
