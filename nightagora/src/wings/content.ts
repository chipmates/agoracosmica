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
    en: 'Ask the Echo about this',
    de: 'Frag das Echo danach',
  },
  /** the no-signup case, in the app's own words for its daily free messages */
  doorNote: {
    en: 'Opens the library in a new tab. 30 free messages a day. No signup needed.',
    de: 'Öffnet die Bibliothek in einem neuen Tab. 30 kostenlose Nachrichten pro Tag. Ohne Anmeldung.',
  },
  /* THE DOOR'S OWN PLATE. A first time visitor has never heard of the
     library, so the door says what it leads to before it opens. The name in
     the title is the wing's own, which is why it stands here as a mark. What
     an Echo is comes from the disclosure canon and is never written twice. */
  doorTitle: {
    en: 'Talk with the Echo of {name}',
    de: 'Sprich mit dem Echo von {name}',
  },
  /** one row on the desktop's band, German included */
  doorLead: {
    en: 'Behind this door is the Agora Cosmica library: learn from thirty lives, in chapters and conversations.',
    de: 'Die Tür führt zur Bibliothek Agora Cosmica: Lerne aus dreißig Leben, in Kapiteln und Gesprächen.',
  },
  doorTerms: {
    en: 'Nonprofit and Open Source. Opens in a new tab. 30 free messages a day. No signup needed.',
    de: 'Non-Profit und Open Source. Öffnet sich in einem neuen Tab. 30 kostenlose Nachrichten pro Tag. Ohne Anmeldung.',
  },
  /** the plate's way in, which carries the station's own question */
  doorAsk: {
    en: 'Ask the Echo',
    de: 'Frag das Echo',
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
