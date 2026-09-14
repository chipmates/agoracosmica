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
} satisfies Record<string, Bilingual>
