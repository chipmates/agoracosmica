/* The museum's own words. The night has no translation layer of its own,
   so every displayed string carries its German beside it and the page's
   own lang attribute picks. Displayed text follows the house writing
   rules: no em or en dashes, no semicolons, short sentences. */

export type Lang = 'en' | 'de'

/** The page's language is also the language the door hands the library.
    The lobby switch and shared links use the same query parameter. */
export function lang(): Lang {
  const asked = new URLSearchParams(location.search).get('lang')
  if (asked === 'de' || asked === 'en') {
    document.documentElement.lang = asked
    return asked
  }
  return document.documentElement.lang.slice(0, 2) === 'de' ? 'de' : 'en'
}

export interface Bilingual {
  en: string
  de: string
}

export const say = (s: Bilingual): string => s[lang()]

/** The lobby's own plate: how much of the museum stands today. */
export function wingCount(open: number, preparing: number): string {
  const plural = (n: number, one: Bilingual, many: Bilingual): string =>
    say(n === 1 ? one : many)
  const o = plural(
    open,
    { en: `${open} wing open`, de: `${open} Flügel offen` },
    { en: `${open} wings open`, de: `${open} Flügel offen` }
  )
  const p = plural(
    preparing,
    { en: `${preparing} in preparation`, de: `${preparing} in Vorbereitung` },
    { en: `${preparing} in preparation`, de: `${preparing} in Vorbereitung` }
  )
  return `${o} · ${p}`
}

export const WING_TEXT = {
  /** the plate a wing shows before it is built */
  preparing: {
    en: 'In preparation',
    de: 'In Vorbereitung',
  },
  preparingLine: {
    en: 'This wing is being researched and built. Its rooms open when the evidence does.',
    de: 'Dieser Flügel wird recherchiert und gebaut. Seine Räume öffnen, wenn die Belege es tun.',
  },
  /** the door at every station */
  door: {
    en: 'Ask them about this',
    de: 'Danach fragen',
  },
  /** the no-key case: the app's free tier is a daily quota, not a key */
  doorNote: {
    en: 'Opens the library in a new tab. It has a free daily quota and needs no key for it.',
    de: 'Öffnet die Bibliothek in einem neuen Tab. Sie hat ein freies Tageskontingent und braucht dafür keinen Schlüssel.',
  },
  /* THE DOOR'S OWN PLATE. A first time visitor has never heard of the
     library, so the door says what it leads to before it opens. The name in
     the title is the wing's own, which is why it stands here as a mark. What
     an Echo is comes from the disclosure canon and is never written twice. */
  doorTitle: {
    en: 'Talk with {name}',
    de: 'Sprich mit {name}',
  },
  doorLead: {
    en: 'This door leads to Agora Cosmica, the library this museum belongs to. There you learn from thirty lives by talking with them.',
    de: 'Diese Tür führt zu Agora Cosmica, der Bibliothek, zu der dieses Museum gehört. Dort lernst du von dreißig Leben, indem du mit ihnen sprichst.',
  },
  doorTerms: {
    en: 'Nonprofit and open source. It opens in a new tab, with free turns every day and no key needed.',
    de: 'Gemeinnützig und Open Source. Öffnet in einem neuen Tab, mit freien Gesprächsrunden an jedem Tag und ohne Schlüssel.',
  },
  /** the plate's way in, which carries the station's own question */
  doorAsk: {
    en: 'Ask about this',
    de: 'Danach fragen',
  },
  doorStay: {
    en: 'Stay in the museum',
    de: 'Im Museum bleiben',
  },
  /** the way back to the lobby, which never replays the overture */
  lobby: {
    en: 'Lobby',
    de: 'Lobby',
  },
  /** the rail's own label, read by assistive technology */
  rail: {
    en: 'Stations of this wing',
    de: 'Stationen dieses Flügels',
  },
  station: {
    en: 'Station',
    de: 'Station',
  },
  /** the grabber of a station card that opens as a sheet on the phone */
  sheet: {
    en: 'More about this place',
    de: 'Mehr über diesen Ort',
  },
} satisfies Record<string, Bilingual>
