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
    en: 'Walk. Look closer. Ask.',
    de: 'Geh ein Stück. Schau genauer hin. Frag nach.',
  },
  tonight: { en: 'Tonight', de: 'Heute Nacht' },
  firstLight: { en: 'First light', de: 'Das erste Licht' },
  enter: { en: 'Scroll to enter', de: 'Scrolle, um einzutreten' },
  descend: { en: 'Scroll to descend', de: 'Scrolle, um hinabzugehen' },
  fireStatus: { en: 'Night Agora · scroll to look up', de: 'Night Agora · scrolle, um nach oben zu schauen' },
  fireVerse: { en: 'The museum begins at the fire', de: 'Am Feuer beginnt dein Museumsbesuch' },
  skipOverture: { en: 'Skip the overture · begin at the fire', de: 'Vorspiel überspringen · am Feuer beginnen' },
  skipDescent: { en: 'Skip to the fire', de: 'Direkt zum Feuer' },
  sky: { en: 'The Sky', de: 'Der Himmel' },
  skyReturn: { en: 'The Fire · return', de: 'Zurück zum Feuer' },
} satisfies Record<string, Bilingual>
