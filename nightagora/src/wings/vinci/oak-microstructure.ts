/** UNMOUNTED GENERATED oak finish. Original finite compact fibres/pores.
 * The existing metre UVs and oakSeed are inputs, never changed. Material
 * references guide form only; no photograph or library bitmap is sampled.
 */
import * as TSL from 'three/tsl'
import {aggregateField} from './mineral-microstructure'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N=any
const{float,vec2}=TSL as unknown as Record<string,N>
export const oakFiniteRecipes=[
  {name:'fine-fibres',alongCell:.035,acrossCell:.0018,radius:[.10,.22] as [number,number],probability:.90,seed:43.173,signed:true,height:.000060,colour:.18,roughness:.022},
  {name:'torn-fibres',alongCell:.080,acrossCell:.0042,radius:[.10,.215] as [number,number],probability:.75,seed:59.719,signed:true,height:.000100,colour:.16,roughness:.028},
  {name:'open-pores',alongCell:.016,acrossCell:.0032,radius:[.075,.22] as [number,number],probability:.52,seed:71.137,signed:false,height:-.000030,colour:-.10,roughness:.035},
] as const
/** All bands use exact compact-kernel box averages in transformed UVs.
 * The derivative holds the conservative pixel box fixed, then applies the
 * actual local coordinate chain rule. The footprint itself is not relief.
 */
export function oakFiniteFinish(along:N,across:N,memberSeed:N):{colour:N;roughness:N;height:N;heightDxDy:N} {
  let colour:N=float(0),roughness:N=float(0),height:N=float(0),heightDxDy:N=vec2(0)
  for(const recipe of oakFiniteRecipes){
    const stretch=recipe.alongCell/recipe.acrossCell
    // Translate the field, not the surveyed member or its stored attributes.
    // A node seed cannot be supplied to aggregateField's numeric hash salt.
    const Q=vec2(along,across.mul(stretch)).add(vec2(memberSeed.mul(29.17),memberSeed.mul(83.71)).mul(recipe.alongCell)).toVar()
    const qx=Q.dFdx().toVar(),qy=Q.dFdy().toVar()
    const field=aggregateField(Q,qx.abs().add(qy.abs()),{
      cell:recipe.alongCell,radius:recipe.radius,probability:recipe.probability,seed:recipe.seed,signed:recipe.signed,
    })
    colour=colour.add(field.value.mul(recipe.colour))
    height=height.add(field.value.mul(recipe.height))
    roughness=roughness.add(field.value.mul(recipe.roughness))
    heightDxDy=heightDxDy.add(vec2(field.gradient.dot(qx),field.gradient.dot(qy)).mul(recipe.height))
  }
  return{colour,roughness,height,heightDxDy}
}
export const oakFiniteProvenance={
  class:'GENERATED',basis:['A-MATERIAL','brief/building/materials.csv','library/oak-beams','library/oak-beams-reference'],
  reference:'CC0 1.0 Poly Haven rough_wood preview. Appearance reference only; no texture import or photo sampling.',
  coordinates:'Existing member-local metre UV, oakSeed, transverse end-grain role and actual geometry unchanged.',
  continuousBody:{acrossScaleM:[.00055,.0012],alongScaleM:[.065,.14],heightAmplitudeM:.000025,colourAmplitude:.30},
  fineFibres:{widthRangeM:[.00036,.000792],lengthRangeM:[.007,.0154],heightAmplitudeM:.000060},
  tornFibres:{widthRangeM:[.00084,.001806],lengthRangeM:[.016,.0344],heightAmplitudeM:.000100},
  pores:{widthRangeM:[.00048,.001408],lengthRangeM:[.0024,.00704],depthAmplitudeM:.000030},
  totalHeightRangeM:[-.00035,.00018],normalSlopeLimit:.22,roughnessRange:[.60,.82],
  label:{
    en:'Proposed oak finish: a continuous fine-fibre body at 0.55 / 1.20 mm transverse and 65 / 140 mm longitudinal scales, with up to 0.025 mm relief, interrupted by finite tapered fibres 0.36–0.79 mm wide and 7–15.4 mm long, and 0.84–1.81 mm wide and 16–34.4 mm long, with 0.06 / 0.10 mm relief amplitudes. Sparse elongated pores are 0.48–1.41 mm wide, 2.4–7.04 mm long and up to 0.03 mm deep. Original procedural interpretation of the CC0 rough_wood reference; these are assumptions, not observed historic grain or tool marks.',
    de:'Vorgeschlagene Eichenoberfläche: durchgehende feine Faserstruktur mit Querskalen von 0,55 / 1,20 mm und Längsskalen von 65 / 140 mm sowie bis zu 0,025 mm Relief, unterbrochen von begrenzten, auslaufende Fasern von 0,36–0,79 mm Breite und 7–15,4 mm Länge sowie 0,84–1,81 mm Breite und 16–34,4 mm Länge mit Reliefamplituden von 0,06 / 0,10 mm. Vereinzelte längliche Poren sind 0,48–1,41 mm breit, 2,4–7,04 mm lang und bis zu 0,03 mm tief. Eigenständige prozedurale Deutung der CC0-Referenz rough_wood; dies sind Annahmen, keine beobachteten historischen Maserungen oder Werkzeugspuren.'
  }
} as const
