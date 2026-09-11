/** Visitor copy for the reading table. Source text stays in the collection map. */
export type Language = 'en' | 'de';

/** The two historical source languages; these names do not follow UI language. */
export const SOURCE_READINGS = [
  { key: 'it', label: 'Italiano' },
  { key: 'fr', label: 'Français' },
] as const;

export interface PageRecord {
  file: string;
  edition_index: number;
  codex: string | null;
  folio: number | null;
  side: string | null;
  page_kind: string;
  transcription_it: string | null;
  translation_fr: string | null;
  ocr_confidence: string;
  transcription_status: string;
  translation_status: string;
  what_it_shows_en: string;
  what_it_shows_de: string;
  ocr_note_en: string | null;
  ocr_note_de: string | null;
  machine_slug: string | null;
  machine_slugs: string[];
  machine_sources: Array<{
    slug: string;
    relation: string;
    dossier?: string;
    folio_source_url?: string;
    verification?: string;
  }>;
  paired_file: string | null;
  transcription_source_file: string | null;
  translation_source_file: string | null;
  source_url: string;
  licence_line: string;
  plate_pixels: { width: number; height: number };
  sha256: string;
  printed_header?: string | null;
  edition_text_ocr?: string | null;
  gaps?: string[];
}

export const TABLE_UI = {
  en: {
    title: 'The reading table', manuscript: 'Paris manuscript', edition: 'The 1883 edition',
    editionPage: 'Edition page', manuscriptLeaf: 'Manuscript leaf', editionMatter: 'Edition matter',
    browse: 'Browse the edition', documentedFolio: 'Documented folio', catalogueDescription: 'Collection catalogue',
    readingLanguage: 'Interface language', sourceReading: 'Source text', italian: 'Italian transcription', french: 'French translation',
    italianDetail: 'As printed in the 1883 edition', frenchDetail: 'Facing text, with the editor’s notes',
    unavailable: 'transcription not aligned', frenchUnavailable: 'French translation not aligned',
    facsimile: 'Facsimile', translation: 'Facing French', titlePage: 'Title page',
    editorial: 'Editorial matter', blank: 'Blank page', endMatter: 'End matter', missingNotice: 'Missing-leaf notice',
    recto: 'recto', verso: 'verso', documented: 'Documented', related: 'Related study',
    source: 'Edition and sources', sourceImage: 'The 1883 source page', folioSource: 'Folio record',
    reproduction: 'Reproduction of the complete printed page. The facsimile’s paper tone is retained.',
    ocr: 'Printed OCR, uncorrected', lowOcr: 'Incomplete OCR. Read alongside the facsimile.',
    famous: 'A shelf of named leaves', shelfIntro: 'Eight studies in Paris manuscript B',
    shelfSource: 'Names and descriptions follow the verified local collection catalogue.',
    birds: 'Codex on the Flight of Birds', birdsHolder: 'Biblioteca Reale, Turin',
    absent: 'Not on display', birdsAbsence: 'The held facsimile has not been cleared for this museum.',
    inscription: 'A collection without order', quotationSource: 'Richter 4 · Codex Arundel 1r',
    englishWitness: 'Richter’s English translation. The supplied text follows the 1888 edition, with numbering from 1883.',
    germanWitness: 'Marie Herzfeld’s source translation, 1906, pp. XCVII–XCVIII.',
    previous: 'Previous page', next: 'Next page', shelf: 'Named leaves', mirror: 'Mirror hand',
    close: 'Close', openBook: 'Open the book', readingCopy: 'Mirrored reading copy',
    imageUnavailable: 'The page image could not be loaded. The edition text remains available below.',
  },
  de: {
    title: 'Der Lesetisch', manuscript: 'Pariser Manuskript', edition: 'Die Ausgabe von 1883',
    editionPage: 'Druckseite', manuscriptLeaf: 'Manuskriptblatt', editionMatter: 'Text der Ausgabe',
    browse: 'Ausgabe durchblättern', documentedFolio: 'Dokumentiertes Blatt', catalogueDescription: 'Sammlungskatalog',
    readingLanguage: 'Sprache der Oberfläche', sourceReading: 'Quellentext', italian: 'Italienische Transkription', french: 'Französische Übersetzung',
    italianDetail: 'Wie in der Ausgabe von 1883 gedruckt', frenchDetail: 'Gegenüberstehender Text mit Anmerkungen des Herausgebers',
    unavailable: 'Transkription nicht zugeordnet', frenchUnavailable: 'Französische Übersetzung nicht zugeordnet',
    facsimile: 'Faksimile', translation: 'Französische Gegenseite', titlePage: 'Titelblatt',
    editorial: 'Text des Herausgebers', blank: 'Leere Seite', endMatter: 'Nachspann', missingNotice: 'Hinweis auf fehlende Blätter',
    recto: 'recto', verso: 'verso', documented: 'Dokumentiert', related: 'Verwandte Studie',
    source: 'Ausgabe und Quellen', sourceImage: 'Die Druckseite von 1883', folioSource: 'Blattnachweis',
    reproduction: 'Wiedergabe der vollständigen Druckseite. Der Papierton des Faksimiles bleibt erhalten.',
    ocr: 'Drucktext-OCR, unkorrigiert', lowOcr: 'Unvollständige OCR. Zusammen mit dem Faksimile lesen.',
    famous: 'Ein Regal benannter Blätter', shelfIntro: 'Acht Studien im Pariser Manuskript B',
    shelfSource: 'Namen und Beschreibungen folgen dem geprüften lokalen Sammlungskatalog.',
    birds: 'Kodex über den Vogelflug', birdsHolder: 'Biblioteca Reale, Turin',
    absent: 'Nicht ausgestellt', birdsAbsence: 'Das vorhandene Faksimile ist für dieses Museum nicht freigegeben.',
    inscription: 'Eine Sammlung ohne Folge', quotationSource: 'Richter 4 · Codex Arundel 1r',
    englishWitness: 'Richters englische Übersetzung. Der bereitgestellte Text folgt der Ausgabe von 1888 mit der Nummerierung von 1883.',
    germanWitness: 'Quellenübersetzung von Marie Herzfeld, 1906, S. XCVII–XCVIII.',
    previous: 'Vorherige Seite', next: 'Nächste Seite', shelf: 'Benannte Blätter', mirror: 'Spiegelschrift',
    close: 'Schließen', openBook: 'Buch öffnen', readingCopy: 'Gespiegelte Lesekopie',
    imageUnavailable: 'Das Seitenbild konnte nicht geladen werden. Der Text der Ausgabe bleibt unten zugänglich.',
  },
} as const;

/** English names follow CONCEPT-GPT6's verified-leaf register and page descriptions.
 * German names are interface translations, never translations of the manuscript. */
export const FAMOUS_FOLIOS = [
  { folio: '74r', en: 'Wing components', de: 'Flügelteile' },
  { folio: '75r', en: 'Wing and tail control', de: 'Flügel- und Schwanzsteuerung' },
  { folio: '79r', en: 'Prone winch apparatus', de: 'Windenapparat für einen liegenden Piloten' },
  { folio: '80r', en: 'Standing four-wing apparatus', de: 'Vierflügelapparat für einen stehenden Piloten' },
  { folio: '83v', en: 'Aerial screw', de: 'Luftschraube' },
  { folio: '88v', en: 'Weighted wing test', de: 'Flügelversuch mit Gewichten' },
  { folio: '89r', en: 'Take-off ladders and trials over water', de: 'Startleitern und Versuche über Wasser' },
  { folio: '33r', en: 'Steam cannon', de: 'Dampfkanone' },
] as const;

/** Evidence: refs/MINING-CATALOG-MANUSCRIPTS.md §7; refs/RIGHTS-CROSSCHECK.md §21.
 * The citations below are the supplied secondary sources, not fresh verification. */
export const MIRROR_EXPLANATION = {
  en: {
    title: 'The mirror hand',
    copyLabel: 'Mirrored reading copy',
    documented: 'Leonardo was left-handed. When he wrote for other people, he wrote from left to right.',
    hypothesis: 'Hypothesis: writing from right to left may have kept his hand away from wet ink. Secrecy, slower thought and childhood habit are other unproved explanations.',
    unknown: 'No surviving note of his says why he reversed his private hand.',
  },
  de: {
    title: 'Die Spiegelschrift',
    copyLabel: 'Gespiegelte Lesekopie',
    documented: 'Leonardo war Linkshänder. Wenn er für andere schrieb, schrieb er von links nach rechts.',
    hypothesis: 'Hypothese: Beim Schreiben von rechts nach links blieb seine Hand möglicherweise von der nassen Tinte fern. Geheimhaltung, langsameres Denken und eine Gewohnheit aus der Kindheit sind weitere unbewiesene Erklärungen.',
    unknown: 'Keine erhaltene Notiz von ihm erklärt, warum er seine private Schrift spiegelte.',
  },
  sources: [
    { title: 'Museum of Science · Mirror writing', url: 'https://www.mos.org/leonardo/activities/mirror-writing.html' },
    { title: 'Artnet · Leonardo’s mirror writing', url: 'https://news.artnet.com/art-world/art-bites-leonardo-mirror-writing-2473530' },
  ],
} as const;

export function folioKey(page: PageRecord): string {
  return page.codex && page.folio !== null && page.side
    ? `${page.codex}:${page.folio}${page.side === 'recto' ? 'r' : 'v'}`
    : `edition:${page.edition_index}`;
}

export function hasItalian(page: PageRecord): boolean {
  return Boolean(page.transcription_it) && page.ocr_confidence !== 'unusable'
    && page.transcription_status !== 'ocr_unusable';
}
