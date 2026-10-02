/* THE INTERFACE'S FOUR CERTAINTY COLOURS. A dot or a word of the interface
   that says how sure the museum is paints one of the four --ui-sure-* tokens
   (index.html), whatever set its value came from. The picture key's own
   darker values stay what they are for their own uses; on the interface's
   sheets they fall under 3 to 1. Same four meanings, read off the key's own
   order so the two cannot drift. */
import { PICTURE_CERTAINTY_KEY } from './vinci/pictures/policy-label'

const TOKENS = ['documented', 'unknown', 'reconstructed', 'conjectural'] as const
const SURE: ReadonlyMap<string, string> = new Map(PICTURE_CERTAINTY_KEY.map((entry, at) =>
  [entry.colour.toLowerCase(), `var(--ui-sure-${TOKENS[at]})`]))

/** The interface's value for a certainty colour; any other value passes through. */
export function uiSure(colour: string): string {
  return SURE.get(colour.trim().toLowerCase()) ?? colour
}

/** Every inline certainty inside a built label, read through uiSure. */
export function uiSureWithin(root: HTMLElement): HTMLElement {
  for (const el of [root, ...root.querySelectorAll<HTMLElement>('[style*="--certainty"]')]) {
    const value = el.style.getPropertyValue('--certainty')
    if (value) el.style.setProperty('--certainty', uiSure(value))
  }
  return root
}
