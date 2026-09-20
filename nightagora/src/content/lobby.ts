import type { Bilingual } from '../wings/content'

/** The front door's words, with the museum's German beside its English. */
export const LOBBY_TEXT = {
  pageTitle: {
    en: 'Night Agora · The digital museum of thirty lives',
    de: 'Night Agora · Das digitale Museum für dreißig Leben',
  },
  searchDescription: {
    en: 'A 3D museum of thirty historical figures, each in the place they lived.',
    de: 'Ein 3D-Museum über dreißig historische Persönlichkeiten, jeweils an dem Ort, an dem sie lebten.',
  },
  tagline: {
    en: 'The digital museum of thirty lives. Walk where they lived, see what they made.',
    de: 'Das digitale Museum für dreißig Leben. Geh, wo sie lebten, sieh, was sie schufen.',
  },
  descentTitle: { en: 'The museum', de: 'Das Museum' },
  descentMuseum: {
    en: 'A digital museum of thirty lives. Each in the place they lived, at a real hour of a real day.',
    de: 'Dreißig Leben in einem digitalen Museum. Dort, wo sie lebten, zu einer bestimmten Stunde an einem wirklichen Tag.',
  },
  descentWalk: {
    en: 'Welcome to Night Agora. Walk where they lived and look closer at what they made.',
    de: 'Willkommen in der Night Agora. Geh, wo sie lebten, und schau genauer hin, was sie schufen.',
  },
  tonight: { en: 'Tonight', de: 'Heute Nacht' },
  firstLight: { en: 'First light', de: 'Das erste Licht' },
  /** the front door's one way on, and the museum's own word for it */
  enterMuseum: { en: 'Enter the museum', de: 'Museum betreten' },
  descend: { en: 'Scroll to descend', de: 'Scrolle, um hinabzugehen' },
  fireStatus: { en: 'Night Agora · scroll to look up', de: 'Night Agora · scrolle, um nach oben zu schauen' },
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
  terms: { en: 'Terms', de: 'Nutzungsbedingungen' },
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
