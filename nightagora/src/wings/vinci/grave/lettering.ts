/* THE GRAVE'S WORDS, without the stones they stand on. The stones cut what
   reads the same in every language (the name, the years, the painter and the
   holder); every word in a language is set here, in the grave's own frame, and
   the page draws it over the picture in the visitor's language, so one film
   serves them all. The factory places its stones from the same numbers. */
import { Matrix4, Quaternion, Vector3 } from 'three/webgpu'
import { textAdvance } from '../words/font'
import { textOutline, type TextOutline } from '../words/outline'
import words from '../line/data/never-said.json'
import { GRAVE_DEATHBED, GRAVE_FRAME } from './placement'

export const GRAVE_EVIDENCE = {
  slab: 'LEONARDO DA VINCI',
  presumption: 'presumed remains',
  plaque: 'The chapel’s own plaque says presumed remains. Its wording belongs to a separate plaque, not to the slab.',
  dig: 'Arsène Houssaye excavated the former Saint-Florentin church in 1863 and reported a nearly complete skeleton. The identification remains presumed.',
  transfer: 'The château describes a nineteenth-century transfer to Saint-Hubert. The precise 1874 date and the letter-fragment account need the historical excavation and transfer record.',
  frame: 'Computed light · 2 May 1519 · 18:50 UT. A chosen minute, not a witnessed moment.',
} as const

/** EVERY WORD OF THE GRAVE'S STONES, in both languages. The stones are
 * the atmosphere and the card is the reading, so the close look repeats these
 * in its record rather than asking a visitor to read them off the floor. */
export const GRAVE_WORDS = {
  slab: GRAVE_EVIDENCE.slab,
  presumption: { en: 'presumed remains', de: 'mutmaßliche Überreste' },
  dig: '1863',
  identification: { en: 'The identification remains presumed.', de: 'Die Identifizierung bleibt unbewiesen.' },
  /** What the setting on the real slab holds. An absence is a sentence in
   * the record and never a piece of furniture, so nothing of it is built.
   * The bronze is a 2004 sculpture
   * whose copyright runs, so no photograph of it is admissible and the record
   * carries the fact in words. */
  medallionRecord: {
    en: 'A bronze medallion with his profile was set into the slab in 2004. It is modern work, so the museum shows the words and not the picture.',
    de: 'Ein Bronzemedaillon mit seinem Profil kam 2004 in die Grabplatte. Es ist ein modernes Werk, darum zeigt das Museum die Worte und nicht das Bild.',
  },
  diagram: { en: 'CHOSEN LIGHT · A MODEL', de: 'GEWÄHLTES LICHT · EIN MODELL' },
  diagramDate: { en: '2 MAY 1519 · JULIAN CALENDAR', de: '2. MAI 1519 · JULIANISCH' },
  disclosure: {
    en: 'The slab and the gable model are made for this exhibition. The slab is pale limestone with the name cut on two lines. Their sizes and lettering are interpretive, not a measured copy of the tomb or the chapel. The portrait medallion is not reproduced.',
    de: 'Grabplatte und Giebelmodell sind für diese Ausstellung gemacht. Die Platte ist heller Kalkstein, der Name ist auf zwei Zeilen eingeschnitten. Maße und Schrift beruhen auf einer Interpretation und sind keine vermessene Nachbildung von Grab oder Kapelle. Das Porträtmedaillon wird nicht wiedergegeben.',
  },
  painter: 'INGRES · 1818',
  holder: 'Paris Musées',
  enlarged: { en: 'A small painting enlarged for this room', de: 'Ein kleines Gemälde für diesen Raum vergrößert' },
} as const

type Language = 'en' | 'de'
/** the leading `Construction.text` sets every line of the grave at */
const LEADING = 1.45

/** Where the presumed plaque stands in the grave's frame. */
export const graveMarker = (mobile = false): { x: number; z: number } =>
  mobile ? { x: 1.50, z: 1.62 } : { x: 1.44, z: 1.45 }

/** The gable model's reading ledge: its place under the frame, its rake and its face. */
export function graveLedge(mobile = false): { position: [number, number, number]; rotationX: number; width: number; height: number; inner: number } {
  const width = mobile ? 2.62 : 2.36
  return { position: [GRAVE_FRAME.x, mobile ? 1.00 : .95, GRAVE_FRAME.z + (mobile ? .34 : .32)], rotationX: -.44,
    width, height: mobile ? .58 : .50, inner: width - .26 }
}
/** The phone restaging moves and scales the gable model and its ledge together. */
export const graveGable = (mobile = false): { scale: number; shift: [number, number, number] } =>
  mobile ? { scale: .84, shift: [-1.26, 0, -1.55] } : { scale: 1, shift: [0, 0, 0] }

/** The label under the deathbed painting, on the backdrop wall. Its title's
 * slot is the English title's height, so the lines cut under it stand at one
 * place whatever language the page reads. */
const DEATHBED = words.deathbed_label
export const DEATHBED_LABEL = (() => {
  const width = 1.55, top = 1.22, x = GRAVE_DEATHBED.centreX, z = GRAVE_DEATHBED.faceZ
  const titleSize = .115
  const slot = textOutline(DEATHBED.title_en, { size: titleSize, maxWidth: width, lineHeight: LEADING }).height
  return { width, left: x - width / 2, top, face: z + .085, titleSize, slot }
})()

/** One run of words in the grave's frame: its setting, and the matrix that
 * lays the outline's XY (top-left at the origin, running down -Y) onto the
 * stone it belongs to. */
export interface GraveLetters {
  id: string
  text: string
  /** the setting asked for, as `Construction.text` takes it */
  size: number
  maxWidth: number
  outline: TextOutline
  matrix: Matrix4
  /** the stone's own ink, or its bronze */
  finish: 'ink' | 'bronze'
}

function run(id: string, text: string, size: number, maxWidth: number, at: [number, number, number], frame?: Matrix4): GraveLetters {
  const outline = textOutline(text, { size, maxWidth, lineHeight: LEADING })
  const matrix = new Matrix4().makeTranslation(...at)
  return { id, text, size, maxWidth, outline, matrix: frame ? frame.clone().multiply(matrix) : matrix, finish: 'ink' }
}
const composed = (position: readonly [number, number, number], rotationX = 0, scale = 1): Matrix4 =>
  new Matrix4().compose(new Vector3(...position), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rotationX), new Vector3().setScalar(scale))

/** The words of the plaque and of the gable model's ledge, in the grave's frame. */
export function graveLettering(language: Language, mobile = false): GraveLetters[] {
  const say = (value: { en: string; de: string }): string => value[language]
  const marker = graveMarker(mobile)
  const out: GraveLetters[] = []
  const presumed = mobile ? (language === 'de' ? .135 : .16) : (language === 'de' ? .102 : .13)
  out.push(run('grave-presumption', say(GRAVE_WORDS.presumption), presumed, 1.40, [marker.x - .70, .98, marker.z + .05]))
  if (!mobile) out.push(run('grave-identification', say(GRAVE_WORDS.identification), .070, 1.4, [marker.x - .70, .51, marker.z + .05]))
  // Each ledge line takes the largest cap height that keeps it ON one line:
  // caps run wider than a lowercase sentence and German runs wider again.
  const ledge = graveLedge(mobile), gable = graveGable(mobile)
  const frame = composed(gable.shift, 0, gable.scale).multiply(composed(ledge.position, ledge.rotationX))
  const fit = (value: string, cap: number): number => Math.min(cap, ledge.inner / Math.max(1e-6, textAdvance(value, 1)) * .985)
  const first = say(GRAVE_WORDS.diagram), second = say(GRAVE_WORDS.diagramDate)
  out.push(run('grave-diagram', first, fit(first, mobile ? .155 : .118), ledge.inner, [-ledge.inner / 2, ledge.height / 2 - .085, .042], frame))
  out.push(run('grave-diagram-date', second, fit(second, mobile ? .115 : .082), ledge.inner, [-ledge.inner / 2, -.075, .042], frame))
  return out
}

/** The words of the deathbed painting's label, in the grave's frame. */
export function graveDeathbedLettering(language: Language): GraveLetters[] {
  const L = DEATHBED_LABEL
  const title = language === 'en' ? DEATHBED.title_en : DEATHBED.title_de
  // one line in any language: a longer title takes a smaller cap, never a second line
  const size = Math.min(L.titleSize, L.width / Math.max(1e-6, textAdvance(title, 1)) * .985)
  return [
    run('grave-deathbed-title', title, size, L.width, [L.left, L.top, L.face]),
    run('grave-deathbed-enlarged', language === 'en' ? GRAVE_WORDS.enlarged.en : GRAVE_WORDS.enlarged.de, .058, L.width, [L.left, L.top - L.slot - .40, L.face]),
  ]
}
