/* The riches: production assets on the R2 CDN. Plain element loads
   (img/audio) need no CORS, so the absolute origin works in dev too. */

export const MEDIA_ORIGIN = 'https://media.agoracosmica.org'

export const mediaUrl = (path: string): string => MEDIA_ORIGIN + path

/** The ambient night bed (sound pass). */
export const AUDIO_AMBIENT = mediaUrl('/trailers/experience/night-agora-ambient.webm')
