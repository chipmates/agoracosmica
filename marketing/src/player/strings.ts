// Every new displayed string of the story player, EN and DE together. These
// are placeholders for the writer: short and functional. The stories' label
// is not here, it is read unchanged from the app's helper translations
// (label.ts). Story titles, years and places come from the catalogs.

export type PlayerLang = 'en' | 'de';

export interface PlayerStrings {
  /** The retelling note above the play button. Keeps the word "retelling". */
  retellingNote: string;
  /** The hero's play button for story 1. */
  playFirst: string;
  /** Under the hero button: "Story 1: {title}". */
  storyN: (n: number) => string;
  minutes: (m: number) => string;
  /** A list row's play button, and its states. */
  listen: string;
  pause: string;
  resume: string;
  loading: string;
  /** Accessible name of a list row's button. */
  listenAria: (n: number, title: string) => string;
  /** The switch that plays the next story when one ends. */
  autoNext: string;
  /** The quiet link into the app, kept as a read-along backup. */
  appLink: string;
  /** Dock controls (accessible names) and states. */
  dockLabel: string;
  playAria: string;
  pauseAria: string;
  back15Aria: string;
  nextAria: string;
  readAlong: string;
  closeAria: string;
  continueAt: (n: number, time: string) => string;
  continueNext: (n: number) => string;
  notNow: string;
  error: string;
  /** The reading view. */
  readerAria: string;
  readerClose: string;
  textSize: string;
  textSmaller: string;
  textLarger: string;
  speed: string;
  textLoading: string;
  textError: string;
  seekAria: string;
}

const en: PlayerStrings = {
  retellingNote: 'A retelling in the first person, written with AI from the sources.',
  playFirst: 'Listen to story 1',
  storyN: n => `Story ${n}`,
  minutes: m => `${m} min`,
  listen: 'Listen',
  pause: 'Pause',
  resume: 'Resume',
  loading: 'Loading',
  listenAria: (n, title) => `Listen to story ${n}: ${title}`,
  autoNext: 'Play the next story when one ends',
  appLink: 'Read along in the app',
  dockLabel: 'Story player',
  playAria: 'Play',
  pauseAria: 'Pause',
  back15Aria: 'Back 15 seconds',
  nextAria: 'Next story',
  readAlong: 'Read along',
  closeAria: 'Close the player',
  continueAt: (n, time) => `Continue story ${n} at ${time}`,
  continueNext: n => `Continue with story ${n}`,
  notNow: 'Not now',
  error: 'This story could not be played. Tap to try again.',
  readerAria: 'Story text',
  readerClose: 'Close the text',
  textSize: 'Text size',
  textSmaller: 'Smaller text',
  textLarger: 'Larger text',
  speed: 'Speed',
  textLoading: 'Loading the text',
  textError: 'The text could not be loaded.',
  seekAria: 'Position in the story',
};

const de: PlayerStrings = {
  retellingNote: 'Eine Nacherzählung in der Ich-Form, mit KI nach den Quellen geschrieben.',
  playFirst: 'Geschichte 1 hören',
  storyN: n => `Geschichte ${n}`,
  minutes: m => `${m} Min.`,
  listen: 'Hören',
  pause: 'Pause',
  resume: 'Weiter',
  loading: 'Lädt',
  listenAria: (n, title) => `Geschichte ${n} hören: ${title}`,
  autoNext: 'Danach die nächste Geschichte abspielen',
  appLink: 'In der App mitlesen',
  dockLabel: 'Geschichten-Player',
  playAria: 'Abspielen',
  pauseAria: 'Pause',
  back15Aria: '15 Sekunden zurück',
  nextAria: 'Nächste Geschichte',
  readAlong: 'Mitlesen',
  closeAria: 'Player schließen',
  continueAt: (n, time) => `Geschichte ${n} ab ${time} fortsetzen`,
  continueNext: n => `Mit Geschichte ${n} weitermachen`,
  notNow: 'Nicht jetzt',
  error: 'Diese Geschichte ließ sich nicht abspielen. Zum erneuten Versuch tippen.',
  readerAria: 'Text der Geschichte',
  readerClose: 'Text schließen',
  textSize: 'Schriftgröße',
  textSmaller: 'Kleinere Schrift',
  textLarger: 'Größere Schrift',
  speed: 'Tempo',
  textLoading: 'Text wird geladen',
  textError: 'Der Text konnte nicht geladen werden.',
  seekAria: 'Stelle in der Geschichte',
};

export const PLAYER_STRINGS: Record<PlayerLang, PlayerStrings> = { en, de };

export function playerStrings(lang: PlayerLang): PlayerStrings {
  return PLAYER_STRINGS[lang];
}
