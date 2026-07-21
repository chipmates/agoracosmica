/* Beat 11 · the council copy. Locked lines are verbatim from the house
   canon (audio tagline, honesty wording per the site's council
   disclosure). The preview is real produced audio: four voices. */

export const COUNCIL_KICKER = 'Lives That Still Speak' // VERBATIM audio tagline
export const COUNCIL_TOPIC = "The Calling That Won't Shut Up."
export const COUNCIL_LINE = 'Four voices gather at the fire. Sit with them a while.'
export const COUNCIL_HONESTY = 'Four AI Echoes, one of them moderating · Interpretations, not recordings'
export const COUNCIL_META = 'A short preview · English'
export const COUNCIL_DONE = 'The full debate continues in the Living Library.'

/** Seat order matches the descent, left to right around the fire. */
export const COUNCIL_SEATS: Array<{ name: string; moderator?: boolean }> = [
  { name: 'Campbell' },
  { name: 'Goethe', moderator: true },
  { name: 'Lovelace' },
  { name: 'Gandhi' },
]
