/* THE CITATION A VISITOR READS. A record cites its source by a raw string
   that names the museum's working files; this module gives each raw its line
   in plain words, in both languages, and keeps every outside source by name.
   It imports nothing and is imported only by the display sites, so a word
   here moves no film key. The check beside it (`citations-check.mjs`) fails
   when a raw source in the content has no line. */
export interface ShownCitation { readonly en: string; readonly de: string }

const NOTES: ShownCitation = { en: 'The museum’s unpublished research notes.', de: 'Die unveröffentlichten Forschungsnotizen des Museums.' }

export const CITATIONS: Readonly<Record<string, ShownCitation>> = {
  'brief/CONCEPT-OPUS.md §3 S1': NOTES,
  'brief/CONCEPT-OPUS.md §3 S2': NOTES,
  'brief/CONCEPT-OPUS.md §3 S4': NOTES,
  'brief/CONCEPT-OPUS.md §3 S5': NOTES,
  'brief/CONCEPT-OPUS.md §3 S6': NOTES,
  'brief/CONCEPT-OPUS.md §3 S7': NOTES,
  'brief/CONCEPT-OPUS.md §3 S10': NOTES,
  'brief/CONCEPT-OPUS.md §3 S11': NOTES,
  'brief/CONCEPT-OPUS.md §3 S12': NOTES,
  'brief/CONCEPT-OPUS.md §3 S14': NOTES,
  'brief/CONCEPT-OPUS.md §3 S15': NOTES,
  'brief/CONCEPT-OPUS.md §3 S16': NOTES,
  'brief/CONCEPT-OPUS.md §3 S17': NOTES,
  'brief/CONCEPT-OPUS.md §3 S19': NOTES,
  'brief/CONCEPT-OPUS.md §3.4': NOTES,
  'brief/CONCEPT.md §1': NOTES,
  'brief/CONCEPT-GPT6.md Station 02; brief/CONCEPT-OPUS.md §3 S8': NOTES,
  'brief/CONCEPT-GPT6.md Station 10; brief/CONCEPT-OPUS.md §3 S13': NOTES,
  'brief/CONCEPT-OPUS.md §3 S2; Q015': {
    en: 'The museum’s unpublished research notes and its reference photographs.',
    de: 'Die unveröffentlichten Forschungsnotizen des Museums und seine Referenzfotografien.' },
  'brief/CONCEPT-OPUS.md §3 S3; house-hall.ts, the great hall as built': {
    en: 'The museum’s unpublished research notes, and the hall as the museum built it.',
    de: 'Die unveröffentlichten Forschungsnotizen des Museums und der Saal, wie das Museum ihn gebaut hat.' },
  'brief/CONCEPT-OPUS.md §3 S3; brief/building/closluce.json room hall': {
    en: 'The museum’s unpublished research notes and its building record of the house, its entry for the hall.',
    de: 'Die unveröffentlichten Forschungsnotizen des Museums und seine Baubeschreibung des Hauses, sein Eintrag zum Saal.' },
  'brief/CONCEPT-OPUS.md §3 S4; certainty qualified by brief/BUILDING-DOSSIER.md § Roof and chapel, oratory paragraph': {
    en: 'The museum’s unpublished research notes. Its research dossier on the building, the section on the roof and chapel, limits the certainty.',
    de: 'Die unveröffentlichten Forschungsnotizen des Museums. Sein Forschungsdossier zum Gebäude, der Abschnitt zu Dach und Kapelle, schränkt die Gewissheit ein.' },
  'brief/BUILDING-DOSSIER.md § Roof and chapel, oratory paragraph beginning “The oratory is a small single-height stone projection”': {
    en: 'The museum’s research dossier on the building, the section on the roof and chapel, its paragraph on the oratory.',
    de: 'Das Forschungsdossier des Museums zum Gebäude, der Abschnitt zu Dach und Kapelle, sein Absatz zum Oratorium.' },
  'brief/BUILDING-DOSSIER.md §Period labels': {
    en: 'The museum’s research dossier on the building, its period labels.',
    de: 'Das Forschungsdossier des Museums zum Gebäude, seine Angaben zu den Bauzeiten.' },
  'brief/SITE-HOUR.md § Sky and exposure; brief/building/SOURCES.md A-LIGHT.': {
    en: 'The museum’s notes on the hour at the site, the section on sky and exposure, and its list of sources for the light.',
    de: 'Die Notizen des Museums zur Stunde am Ort, der Abschnitt zu Himmel und Belichtung, und seine Quellenliste zum Licht.' },
  'brief/CONCEPT-OPUS.md §3.4, corrected by brief/SITE-HOUR.md and brief/building/light-rig.json': {
    en: 'The museum’s unpublished research notes, corrected by its notes on the hour at the site and its light rig.',
    de: 'Die unveröffentlichten Forschungsnotizen des Museums, berichtigt nach seinen Notizen zur Stunde am Ort und seinem Lichtaufbau.' },
  'Yale Bright Star Catalogue, 5th revised ed. (Hoffleit and Warren 1991), CDS V/50, sha256 69797549…9afd; forge/night/real-sky.mjs; farewell-night.ts': {
    en: 'Yale Bright Star Catalogue, 5th revised edition (Hoffleit and Warren 1991), CDS V/50. The stars of this evening were computed from it by the museum’s own night sky tool.',
    de: 'Yale Bright Star Catalogue, 5. überarbeitete Ausgabe (Hoffleit und Warren 1991), CDS V/50. Die Sterne dieses Abends hat das eigene Nachthimmel-Werkzeug des Museums daraus berechnet.' },
  'Flora card FLORA.md §1 and §6 (species and their state about 20 October, types for Cloux, none documented there); brief/BUILDING-DOSSIER.md § Terrain and ground work, § Honesty labels and period variants; Q119, Q128, Q178; A-SITE. The grave court’s maples: grave/court-plan.ts and the manifest record vinci/grave-court-planting. Dimensional ranges: the vegetation, leaf-litter and ground-dressing recipes as built at the Hero, Standard and Calm detail levels, not measurements from the photographs.': {
    en: 'The museum’s own planting notes: the species and their state about 20 October, chosen as types for Cloux, none documented there. Its research dossier on the building, the sections on terrain and ground work and on how the uncertain parts are marked, with their period variants. Its reference photographs and site sources. For the maples of the grave court, its plan of that court and its record of that planting. The sizes are those of the planting as built at the three detail levels, not measurements from the photographs.',
    de: 'Die eigenen Pflanznotizen des Museums: die Arten und ihr Zustand um den 20. Oktober, als Typen für Cloux gewählt, keine dort belegt. Sein Forschungsdossier zum Gebäude, die Abschnitte zu Gelände und Erdarbeiten und zur Kennzeichnung des Unsicheren, mit den Bauzeitvarianten. Seine Referenzfotografien und Quellen zum Gelände. Für die Ahorne des Grabhofs sein Plan dieses Hofs und sein Eintrag zu dieser Bepflanzung. Die Maße sind die der Bepflanzung, wie sie in den drei Detailstufen gebaut ist, keine Messungen aus den Fotografien.' },
  'The room hang and the picture register': {
    en: 'The room hang and the picture register.',
    de: 'Die Hängung des Raums und das Bilderverzeichnis.' },
  'The picture register and the displayed reproduction source record': {
    en: 'The picture register and the source record of the reproduction shown.',
    de: 'Das Bilderverzeichnis und der Quellennachweis der gezeigten Reproduktion.' },
  'brief/CONCEPT-GPT6.md Station 10; brief/collection/msb-pages.json': {
    en: 'The museum’s unpublished research notes and its page map of Manuscript B.',
    de: 'Die unveröffentlichten Forschungsnotizen des Museums und seine Seitenübersicht des Manuskripts B.' },
  'collection/reading-room-plan.ts, the studiolo and its place in the gallery bay; collection/layout.ts, VINCI_READING_TABLE on the joint of the line’s field': {
    en: 'The museum’s own plan of the reading room, the studiolo and its place in the gallery bay, and its layout of the collection, the table where the floor’s timeline is joined.',
    de: 'Der eigene Plan des Museums für das Lesezimmer, das Studiolo und seinen Platz im Galerieabschnitt, und sein Grundriss der Sammlung, der Tisch an der Fuge der Zeitleiste im Boden.' },
  'brief/CONCEPT-OPUS.md §3 S17; the rights review of 2026-09-14': {
    en: 'The museum’s unpublished research notes and its rights review of 14 September 2026.',
    de: 'Die unveröffentlichten Forschungsnotizen des Museums und seine Rechteprüfung vom 14. September 2026.' },
  'collection/body-wall-cabinet.ts and body-wall-plan.ts, the cabinet; data/sheet-sizes.json, the three sheets without a size; refs/push-research-2026-09-22/MUSEUM-ARCH.md, the light levels for paper': {
    en: 'The museum’s own plan of the cabinet of drawings. Its list of sheet sizes, with the three sheets without a size. Its research notes on museum architecture, the light levels for paper.',
    de: 'Der eigene Plan des Museums für das Zeichnungskabinett. Seine Liste der Blattmaße, mit den drei Blättern ohne Maß. Seine Forschungsnotizen zur Museumsarchitektur, die Lichtwerte für Papier.' },
  'The tracing record of the deathbed painting and of what the accounts of the death say': {
    en: 'The tracing record of the deathbed painting and of what the accounts of the death say.',
    de: 'Der Nachweis zum Sterbebett-Gemälde und zu dem, was die Berichte vom Tod sagen.' },
  'brief/CONCEPT-OPUS.md §3 S19; verification qualified in brief/collection/timeline.json': {
    en: 'The museum’s unpublished research notes. Its timeline says how far the verification reached.',
    de: 'Die unveröffentlichten Forschungsnotizen des Museums. Seine Zeitleiste sagt, wie weit die Prüfung reicht.' },
  // the provenance objects the live wing cites by their joined source codes, and one literal
  'A-SITE · A-LAYOUT · OSM-AREA': {
    en: 'The museum’s own site notes and layout, and the OpenStreetMap area.',
    de: 'Die Geländenotizen und der Grundriss des Museums sowie die OpenStreetMap-Fläche.' },
  'brief/COMMISSION.md § Judges list 10 · brief/maquette/maquette.ts COLLECTION, collectionCut and garden approach · brief/CONCEPT.md §2 two grounds': {
    en: 'The museum’s commission notes, its maquette of the collection and the garden approach, and its unpublished research notes on the two grounds.',
    de: 'Die Auftragsnotizen des Museums, seine Maquette der Sammlung und des Gartenzugangs und seine unveröffentlichten Forschungsnotizen zu den beiden Geländeebenen.' },
  'COMMISSION § Judges list10 · maquette.ts COLLECTION': {
    en: 'The museum’s commission notes and its maquette of the collection.',
    de: 'Die Auftragsnotizen des Museums und seine Maquette der Sammlung.' },
  'maquette.ts garden approach · A-SITE terrace · modern exhibition design': {
    en: 'The museum’s maquette of the garden approach and its site notes on the terrace. A modern exhibition design.',
    de: 'Die Maquette des Museums für den Gartenzugang und seine Geländenotizen zur Terrasse. Ein moderner Ausstellungsentwurf.' },
  'brief/COMMISSION.md § Judges list 10 · src/wings/vinci/data/closluce.json retained courtyard and terrace platforms': {
    en: 'The museum’s commission notes and its building record of the house, the retained courtyard and terrace platforms.',
    de: 'Die Auftragsnotizen des Museums und seine Baubeschreibung des Hauses, die erhaltenen Hof- und Terrassenebenen.' },
  'A-SITE retained court and terrace · modern museum access proposal': {
    en: 'The museum’s site notes on the retained court and terrace. A modern museum access proposal.',
    de: 'Die Geländenotizen des Museums zum erhaltenen Hof und zur Terrasse. Ein Vorschlag für einen modernen Museumszugang.' },
  'A-LAYOUT · modern museum fitting': {
    en: 'The museum’s layout notes. A modern museum fitting.',
    de: 'Die Grundrissnotizen des Museums. Ein moderner Einbau des Museums.' },
  'brief/BUILDING-DOSSIER.md': {
    en: 'The museum’s research dossier on the building.',
    de: 'Das Forschungsdossier des Museums zum Gebäude.' },
}

/** The public line for a raw source. An unknown raw that names a file (a
 * path, .md, .ts, .mjs or .json) never reaches a visitor: it reads as the
 * museum's own notes. Any other unknown raw is plain already and shows as it is. */
export function shownCitation(raw: string): ShownCitation {
  const known = CITATIONS[raw]
  if (known) return known
  return /\/|\.md\b|\.ts\b|\.mjs\b|\.json\b/.test(raw) ? NOTES : { en: raw, de: raw }
}
