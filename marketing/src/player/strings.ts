// Every new displayed string of the story player, EN and DE together. These
// are placeholders for the writer: short and functional. The stories' label
// is not here, it is read unchanged from the app's helper translations
// (label.ts). Story titles, years and places come from the catalogs.

export type PlayerLang = 'en' | 'de';

export interface PlayerStrings {
  /** The hero's note under the line: how many stories, and that they are retellings. */
  heroNote: (countWord: string) => string;
  /** The reading view's note under the title. Keeps the word "retelling". */
  retellingNote: string;
  /** Under the hero portrait. */
  portraitNote: string;
  /** The hero plate's words: what a tap does, then which story. */
  playFirst: string;
  continueStory: (n: number) => string;
  fromTime: (time: string) => string;
  startOver: string;
  storyN: (n: number) => string;
  minutes: (m: number) => string;
  minutesLeft: (m: number) => string;
  /** A play button's states. */
  listen: string;
  pause: string;
  resume: string;
  loading: string;
  /** The contents. */
  tocTitle: (countWord: string) => string;
  tocLead: (firstAge: string, lastAge: string, total: string) => string;
  totalTime: (minutes: number) => string;
  ageAt: (age: string) => string;
  rowAria: (n: number, title: string, details: string[]) => string;
  /** A year as spoken: "~154 AD" reads "about 154 AD". */
  approxYear: (year: string) => string;
  playingWord: string;
  pausedWord: string;
  finishedWord: string;
  /** The ledger's existing words (the figure template's), not placeholders. */
  ledgerTitle: string;
  documented: string;
  recreated: string;
  /** The switch that plays the next story when one ends. */
  autoNext: string;
  /** The quiet link into the app, kept as a read-along backup. */
  appLink: string;
  /** The facts part. */
  aboutTitle: string;
  hearStory: (title: string) => string;
  /** Dock controls (accessible names) and states. */
  dockLabel: string;
  playAria: string;
  pauseAria: string;
  back15Aria: string;
  nextAria: string;
  readAlong: string;
  closeAria: string;
  backToAria: (name: string) => string;
  speedAria: (rate: string) => string;
  continueAt: (title: string, time: string) => string;
  continueNext: (title: string) => string;
  notNow: string;
  error: string;
  /** The reading view. */
  readerAria: string;
  readerClose: string;
  toolsAria: string;
  textSmaller: string;
  textLarger: string;
  dayView: string;
  nightView: string;
  follow: string;
  textLoading: string;
  textError: string;
  seekAria: string;
}

const en: PlayerStrings = {
  heroNote: word => `His life in ${word} stories. A retelling in the first person, from the sources, never his own words.`,
  retellingNote: 'A retelling in the first person. Never his own words.',
  portraitNote: 'Painted by AI',
  playFirst: 'Listen to the first story',
  continueStory: n => `Continue story ${n}`,
  fromTime: time => `from ${time}`,
  startOver: 'Start with story 1',
  storyN: n => `Story ${n}`,
  minutes: m => `${m}\u00a0min`,
  minutesLeft: m => `${m}\u00a0min left`,
  listen: 'Listen',
  pause: 'Pause',
  resume: 'Resume',
  loading: 'Loading',
  tocTitle: word => `The ${word} stories`,
  tocLead: (a, b, total) =>
    `In the order of his life${a && b ? `, from age ${a} to ${b}` : ''}.${total ? ` About ${total} in all.` : ''}`,
  totalTime: m => (m >= 60 ? `${Math.floor(m / 60)}\u00a0h\u00a0${m % 60}\u00a0min` : `${m}\u00a0min`),
  ageAt: age => `age ${age}`,
  rowAria: (n, title, details) => `Story ${n}: ${[title, ...details].join(', ')}`,
  approxYear: year => year.replace(/^~\s*/, 'about '),
  playingWord: 'playing',
  pausedWord: 'paused',
  finishedWord: 'finished',
  ledgerTitle: 'What the record shows, what we built',
  documented: 'Documented',
  recreated: 'Built for the scene',
  autoNext: 'Play the next story when one ends',
  appLink: 'Read along in the app',
  aboutTitle: 'Who he was',
  hearStory: title => `Listen to the story: ${title}`,
  dockLabel: 'Story player',
  playAria: 'Play',
  pauseAria: 'Pause',
  back15Aria: 'Back 15 seconds',
  nextAria: 'Next story',
  readAlong: 'Read along',
  closeAria: 'Close the player',
  backToAria: name => `Back to ${name}`,
  speedAria: rate => `Speed ${rate}`,
  continueAt: (title, time) => `Continue “${title}” at ${time}`,
  continueNext: title => `Continue with “${title}”`,
  notNow: 'Not now',
  error: 'This story could not be played. Tap to try again.',
  readerAria: 'Story text',
  readerClose: 'Close the text',
  toolsAria: 'Text and speed',
  textSmaller: 'Smaller text',
  textLarger: 'Larger text',
  dayView: 'Day view',
  nightView: 'Night view',
  follow: 'Back to the voice',
  textLoading: 'Loading the text',
  textError: 'The text could not be loaded.',
  seekAria: 'Position in the story',
};

const de: PlayerStrings = {
  heroNote: word => `Sein Leben in ${word} Geschichten. Eine Nacherzählung in der Ich-Form, nach den Quellen, nie seine eigenen Worte.`,
  retellingNote: 'Eine Nacherzählung in der Ich-Form. Nie seine eigenen Worte.',
  portraitNote: 'Von KI gemalt',
  playFirst: 'Erste Geschichte hören',
  continueStory: n => `Geschichte ${n} weiterhören`,
  fromTime: time => `ab ${time}`,
  startOver: 'Mit Geschichte 1 beginnen',
  storyN: n => `Geschichte ${n}`,
  minutes: m => `${m}\u00a0Min.`,
  minutesLeft: m => `noch ${m}\u00a0Min.`,
  listen: 'Hören',
  pause: 'Pause',
  resume: 'Weiter',
  loading: 'Lädt',
  tocTitle: word => `Die ${word} Geschichten`,
  tocLead: (a, b, total) =>
    `In der Reihenfolge seines Lebens${a && b ? `, im Alter von ${a} bis ${b} Jahren` : ''}.${total ? ` Zusammen etwa ${total}` : ''}`,
  totalTime: m => (m >= 60 ? `${Math.floor(m / 60)}\u00a0Std.\u00a0${m % 60}\u00a0Min.` : `${m}\u00a0Min.`),
  ageAt: age => `mit ${age}`,
  rowAria: (n, title, details) => `Geschichte ${n}: ${[title, ...details].join(', ')}`,
  approxYear: year => year.replace(/^~\s*/, 'um '),
  playingWord: 'läuft',
  pausedWord: 'pausiert',
  finishedWord: 'gehört',
  ledgerTitle: 'Was belegt ist, was wir gebaut haben',
  documented: 'Belegt',
  recreated: 'Für die Szene gebaut',
  autoNext: 'Danach die nächste Geschichte abspielen',
  appLink: 'In der App mitlesen',
  aboutTitle: 'Wer er war',
  hearStory: title => `Die Geschichte dazu hören: ${title}`,
  dockLabel: 'Geschichten-Player',
  playAria: 'Abspielen',
  pauseAria: 'Pause',
  back15Aria: '15 Sekunden zurück',
  nextAria: 'Nächste Geschichte',
  readAlong: 'Mitlesen',
  closeAria: 'Player schließen',
  backToAria: name => `Zurück zu ${name}`,
  speedAria: rate => `Tempo ${rate}`,
  continueAt: (title, time) => `„${title}“ ab ${time} weiterhören`,
  continueNext: title => `Weiter mit „${title}“`,
  notNow: 'Nicht jetzt',
  error: 'Diese Geschichte ließ sich nicht abspielen. Zum erneuten Versuch tippen.',
  readerAria: 'Text der Geschichte',
  readerClose: 'Text schließen',
  toolsAria: 'Schrift und Tempo',
  textSmaller: 'Kleinere Schrift',
  textLarger: 'Größere Schrift',
  dayView: 'Tagansicht',
  nightView: 'Nachtansicht',
  follow: 'Zurück zur Stimme',
  textLoading: 'Text wird geladen',
  textError: 'Der Text konnte nicht geladen werden.',
  seekAria: 'Stelle in der Geschichte',
};

export const PLAYER_STRINGS: Record<PlayerLang, PlayerStrings> = { en, de };

export function playerStrings(lang: PlayerLang): PlayerStrings {
  return PLAYER_STRINGS[lang];
}

/** A rate as the page shows it: a decimal comma in German. */
export function rateLabel(rate: number, lang: PlayerLang): string {
  const n = String(rate);
  return `${lang === 'de' ? n.replace('.', ',') : n}×`;
}
