/* The riches: production assets on the R2 CDN. Plain element loads
   (img/audio) need no CORS, so the absolute origin works in dev too. */

export const MEDIA_ORIGIN = 'https://media.agoracosmica.org'

export const mediaUrl = (path: string): string => MEDIA_ORIGIN + path

/** The Marcus portrait, main crop. */
export const PORTRAIT_AURELIUS = mediaUrl('/images/figures/aurelius/main/900.webp')
export const PORTRAIT_AURELIUS_ALT =
  'AI-generated portrait of Marcus Aurelius, Roman emperor in a white toga, calm gaze under grey curls.'

/** The ambient night bed (sound pass). */
export const AUDIO_AMBIENT = mediaUrl('/trailers/experience/night-agora-ambient.webm')
