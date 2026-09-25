/* THE WING'S PRINT AND ITS LIGHT RIG, one source for the live rooms and for
   the machine's live island the film opens, so a machine lent to the turntable
   stands under the hour and the print it stands under in the room. */

import { GRADES } from '../../stack/grade'
import { hourKey } from './site'
import type { VinciStationId } from './content'

/** The wing's own print. A court under its own walls at this hour stands
 * two thirds of a stop below the garden front, so the aperture opens where
 * the visitor stands, exactly as a camera's would. No light in the scene
 * moves; this is the print, not the sun. */
// A COURT UNDER ITS OWN WALLS. Most of this wing stands in the building's own
// shade at this hour, and an eye standing there opens on the shade, not on the
// sky. The black is lifted a little, cool, the way shade is; the toe then bends
// everything under a mid-grey down, so a shade deepens as its light falls away
// while a sunlit face or a lit work keeps its value. It is the print, and no
// light in the scene moves.
export const PRINT={...GRADES['first-station'],name:'clos-luce-1517',exposure:.94,lift:[.012,.014,.018] as [number,number,number],toe:.06,split:.055,saturation:.9,vignette:.15,grain:.007,bloom:{strength:0,radius:.1,threshold:10,warmth:1}}
// The court used to open two thirds of a stop, which warmed the tuffeau toward
// grey-gold and lifted the plaster's mottling into view. One print holds the
// whole wing now, and the court is lit rather than exposed.
/** A ROOM IS NOT THE STREET. The stations in the insertion stand indoors,
 * under a clerestory and two fittings, and the outdoor exposure left them a
 * stop and a half under. The eye opens at the door, as a camera does. */
export const STATION_EXPOSURE:Partial<Record<VinciStationId,number>>={courtyard:1.0,oratory:1.5,hall:2.2,
  'picture-room':1.34,'picture-room-west':1.34,'reading-table':0.4,'line-early':1.3,flight:1.55,works:1.55,body:1.4,'supper-wall':1.85,
  // the grave court stands in its walls' shade: the eye opens on the shade
  grave:1.36}
/** THE TOE WHERE A ROOM IS ALL SHADE. The reading booth has one lamp and one
 * pool; under the wing's toe everything off the pool fell to black. The toe
 * eases over the last third of a leg, as the exposure does. */
export const STATION_TOE:Partial<Record<VinciStationId,number>>={'reading-table':.02}
/** THE WING'S ONE LIGHT RIG, which the vitrine's turntable stands under too:
 * the key and fill of the hour, and the hall's own fittings. */
export const KEY_RIG={
  key:{azimuth:hourKey.sun_azimuth_deg.value,elevation:hourKey.sun_elevation_deg.value,kelvin:4700,lux:320,ambient:.35,sky:{zenith:'#8dabc0',horizon:'#d8cbb1',ground:'#514d3b',stars:0}},
  fill:{color:'#a5b5bb',groundColor:'#736550',intensity:.48},
  environmentIntensity:.28,
  fitting:{color:'#f4e6cc',intensity:9.5,distance:15,decay:2,height:4.6},
}
