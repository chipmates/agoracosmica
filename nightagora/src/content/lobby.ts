import type { Bilingual } from '../wings/content'

/* THE MUSEUM'S NAME, ITS DESCRIPTOR AND ITS LINE. Decided words: the name is
   the same in both languages, the descriptor stands beside it wherever the
   name first appears, and the line is two sentences that break between them. */
const NAME = 'Museum of Ages'
/** inside a running sentence the name keeps to one line (no-break spaces) */
const NAME_SET = NAME.replaceAll(' ', '\u00a0')
const LINE_FIRST: Bilingual = { en: 'We rebuild what was.', de: 'Wir bauen nach, was war.' }
const LINE_SECOND: Bilingual = { en: 'You walk through it.', de: 'Du gehst hinein.' }
const LINE: Bilingual = {
  en: `${LINE_FIRST.en} ${LINE_SECOND.en}`,
  de: `${LINE_FIRST.de} ${LINE_SECOND.de}`,
}
/** the name with its descriptor inside a title or a sentence of its own */
const NAME_IN_TITLE: Bilingual = {
  en: `${NAME}, a digital museum`,
  de: `${NAME}, ein digitales Museum`,
}

/** The front door's words, with the museum's German beside its English. */
export const LOBBY_TEXT = {
  name: { en: NAME, de: NAME },
  descriptor: { en: 'Digital museum', de: 'Digitales Museum' },
  lineFirst: LINE_FIRST,
  lineSecond: LINE_SECOND,
  pageTitle: {
    en: `${NAME}: a digital museum of historical figures`,
    de: `${NAME}: digitales Museum für historische Persönlichkeiten`,
  },
  /** what follows a wing's own name in the tab while that wing stands */
  titleInside: NAME_IN_TITLE,
  searchDescription: {
    en: `${NAME_IN_TITLE.en}. ${LINE.en}`,
    de: `${NAME_IN_TITLE.de}. ${LINE.de}`,
  },
  tagline: LINE,
  shareLocale: { en: 'en_GB', de: 'de_DE' },
  descentTitle: { en: 'The museum', de: 'Das Museum' },
  descentMuseum: {
    en: 'A digital museum of thirty lives. Each in the place they lived, at a real hour of a real day.',
    de: 'Dreißig Leben in einem digitalen Museum. Dort, wo sie lebten, zu einer bestimmten Stunde an einem wirklichen Tag.',
  },
  descentWalk: {
    en: `Welcome to ${NAME_SET}. Walk where they lived and look closer at what they made.`,
    de: `Willkommen im ${NAME_SET}. Geh, wo sie lebten, und schau genauer hin, was sie schufen.`,
  },
  tonight: { en: 'Tonight', de: 'Heute Nacht' },
  firstLight: { en: 'First light', de: 'Das erste Licht' },
  /** the front door's one way on, and the museum's own word for it */
  enterMuseum: { en: 'Enter the museum', de: 'Museum betreten' },
  descend: { en: 'Scroll to descend', de: 'Scrolle, um hinabzugehen' },
  fireStatus: { en: `${NAME_SET} · scroll to look up`, de: `${NAME_SET} · scrolle, um nach oben zu schauen` },
  /* THE ONE SENTENCE AT THE FIRE. It is the museum's whole instruction to a
     visitor who has just arrived: one string per language, changed here. */
  fireLine: {
    en: 'Look up. Each lit name opens a wing of the museum.',
    de: 'Schau nach oben. Jeder leuchtende Name öffnet einen Flügel des Museums.',
  },
  skipDescent: { en: 'Skip to the fire', de: 'Direkt zum Feuer' },
  sky: { en: 'The Sky', de: 'Der Himmel' },
  skyReturn: { en: 'The Fire · return', de: 'Zurück zum Feuer' },
  instruments: { en: 'Instruments', de: 'Instrumente' },
  instrumentsTitle: { en: 'The instruments of the museum', de: 'Die Instrumente des Museums' },
  soundOn: { en: 'Sound · On', de: 'Ton · An' },
  soundOff: { en: 'Sound · Off', de: 'Ton · Aus' },
  language: { en: 'Language', de: 'Sprache' },
  tier: { en: 'Detail', de: 'Detailstufe' },
  calm: { en: 'Calm', de: 'Ruhig' },
  calmCost: {
    en: 'Less detail. Lower graphics and memory use.',
    de: 'Weniger Details. Braucht weniger Grafikleistung und Speicher.',
  },
  standard: { en: 'Standard', de: 'Standard' },
  standardCost: {
    en: 'More detail. Moderate graphics and memory use.',
    de: 'Mehr Details. Braucht mehr Grafikleistung und Speicher.',
  },
  hero: { en: 'Hero', de: 'Detailreich' },
  heroCost: {
    en: 'Finest detail. Highest graphics and memory use.',
    de: 'Die feinsten Details. Braucht am meisten Grafikleistung und Speicher.',
  },
  pace: { en: 'Pace', de: 'Gangart' },
  paceStroll: { en: 'Stroll', de: 'Schlendern' },
  paceWalk: { en: 'Walk', de: 'Gehen' },
  paceBrisk: { en: 'Brisk', de: 'Zügig' },
  paceCost: {
    en: 'How fast you walk between stations. It stays on this device.',
    de: 'Wie schnell du zwischen den Stationen gehst. Es bleibt auf diesem Gerät.',
  },
  plan: { en: 'The plan', de: 'Der Plan' },
  labelsTitle: {
    en: 'How this museum labels what it shows',
    de: 'So kennzeichnet das Museum, was es zeigt',
  },
  labels: {
    en: 'The label names what you see. The drawer explains the evidence. The record gives the full sources, measurements and licences. Certainty words distinguish documented, reconstructed, conjectural and not known. The museum labels the reproduction, not the painting.',
    de: 'Die Beschriftung nennt, was du siehst. Die Schublade erklärt die Belege. Im Nachweis stehen alle Quellen, Maße und Lizenzen. Die Wörter dokumentiert, rekonstruiert, vermutet und nicht bekannt zeigen, wie sicher eine Aussage ist. Das Museum kennzeichnet die Reproduktion, nicht das Gemälde.',
  },
  library: { en: 'Agora Cosmica, the library', de: 'Agora Cosmica, die Bibliothek' },
  aboutMuseum: { en: 'What this museum is', de: 'Was dieses Museum ist' },
  legalNotice: { en: 'Legal notice', de: 'Impressum' },
  privacy: { en: 'Privacy', de: 'Datenschutz' },
  close: { en: 'Close', de: 'Schließen' },
  paneEnter: { en: 'Enter the museum', de: 'Das Museum betreten' },
  /* WHAT THE GOLD FIELD SAYS WHILE A WING IS BEING BUILT. One line per stage
     of the entry, and the stage that is really running is the one shown. The
     first is the fallback: the wing's own module is still arriving, so
     nothing under the field has said anything yet. */
  entryOpening: { en: 'Opening the wing', de: 'Der Flügel wird geöffnet' },
  entryHouse: {
    en: 'Building the house and its rooms',
    de: 'Das Haus und seine Räume entstehen',
  },
  entryExhibits: {
    en: 'Hanging the pictures and setting up the machines',
    de: 'Die Bilder werden gehängt, die Maschinen aufgestellt',
  },
  entryWalk: {
    en: 'Walking through every room once, so your walk runs smoothly',
    de: 'Ein Gang durch alle Räume, damit dein Rundgang ruhig läuft',
  },
} satisfies Record<string, Bilingual>

/* THE MUSEUM'S OWN PAGES. They stand on the same site as the lobby, one path
   per language, so the legal notice and the privacy page are one press from
   the panel in the visitor's language. */
export const LOBBY_LINKS = {
  aboutMuseum: { en: '/what-this-museum-is/', de: '/de/was-dieses-museum-ist/' },
  legalNotice: { en: '/imprint/', de: '/de/impressum/' },
  privacy: { en: '/privacy/', de: '/de/datenschutz/' },
} satisfies Partial<Record<keyof typeof LOBBY_TEXT, Bilingual>>
