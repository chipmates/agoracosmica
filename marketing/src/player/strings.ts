// Every displayed string of the story player, EN and DE together. These are
// placeholders for the writer: short and functional. The stories' label and
// the facts' words are not here, they are read unchanged from the app's own
// translations (label.ts, factWords.ts). Story titles, years and places come
// from the catalogs.

export type PlayerLang = 'en' | 'de';

export interface PlayerStrings {
  /** The hero's note under the line: how many stories, and that they are retellings. */
  heroNote: (countWord: string, she: boolean) => string;
  /** The reading view's note under the title. Keeps the word "retelling". */
  retellingNote: (she: boolean) => string;
  /** The story door under a poem: its heading and the link to the figure page. */
  doorTitle: (name: string, countWord: string) => string;
  allStories: (countWord: string) => string;
  /** Under the hero portrait. */
  portraitNote: string;
  /** The plate: what a tap does, then what plays. */
  begin: string;
  beginSub: (introMinutes: number) => string;
  /** The same, naming story 1, where the page shows no contents (the poem door). */
  beginSubWith: (introMinutes: number, title: string) => string;
  continueStory: (n: number) => string;
  continueWith: (n: number) => string;
  fromTime: (time: string) => string;
  startOver: string;
  storyN: (n: number) => string;
  minutes: (m: number) => string;
  minutesLeft: (m: number) => string;
  /** Under a minute left, as a clock. */
  timeLeft: (clock: string) => string;
  /** The quiet line under the plate. */
  readInstead: string;
  /** A play button's states. */
  listen: string;
  continueFrom: string;
  pause: string;
  resume: string;
  loading: string;
  /** The introduction, item 0. */
  introTitle: string;
  introRowSub: (m: number) => string;
  /** The contents. */
  tocTitle: (countWord: string) => string;
  tocLead: (firstAge: string, lastAge: string, total: string, she: boolean) => string;
  totalTime: (minutes: number) => string;
  ageAt: (age: string) => string;
  rowAria: (n: number, title: string, details: string[]) => string;
  /** An uncertain year in words: "~154" never shows. */
  approxYear: (year: string) => string;
  listView: string;
  mapView: string;
  viewAria: string;
  savedCount: (n: number) => string;
  opens: string;
  opensIntro: string;
  read: string;
  share: string;
  playingWord: string;
  pausedWord: string;
  startedWord: string;
  finishedWord: string;
  /** The reader's end: the figure template's existing heading. */
  ledgerTitle: string;
  /** The quiet link into the app, kept as a read-along backup. */
  appLink: string;
  /** The facts part. */
  aboutTitle: (she: boolean) => string;
  hearStory: (title: string) => string;
  /** The map. */
  mapBy: (name: string) => string;
  nextTag: string;
  mapNote: (she: boolean) => string;
  /** Dock controls (accessible names) and states. */
  dockLabel: string;
  playAria: string;
  pauseAria: string;
  back15Aria: string;
  fwd15Aria: string;
  nextAria: string;
  prevAria: string;
  readAlong: string;
  closeAria: string;
  backToAria: (name: string) => string;
  speedAria: (rate: string) => string;
  openPlayer: string;
  continueAt: (title: string, time: string) => string;
  continueNext: (title: string) => string;
  notNow: string;
  error: string;
  /** The full player. */
  speed: string;
  slower: string;
  faster: string;
  after: string;
  afterNext: string;
  afterStop: string;
  stopAll: string;
  close: string;
  /** The end card. */
  ended: (n: number) => string;
  endedIntro: string;
  soon: (n: number, title: string) => string;
  stay: string;
  listenNow: string;
  /** The reading view. */
  readerAria: string;
  readerClose: string;
  bookmark: string;
  display: string;
  follow: string;
  fromHere: string;
  keep: string;
  kept: string;
  undo: string;
  nextUp: string;
  shareStory: string;
  copied: string;
  afterLast: string;
  textLoading: string;
  textError: string;
  seekAria: string;
  /** The display sheet. */
  light: string;
  lights: [string, string, string, string];
  textSize: string;
  smaller: string;
  larger: string;
  face: string;
  faces: [string, string];
  spacing: string;
  spacings: [string, string, string];
  highlight: string;
  highlights: [string, string, string];
  followVoice: string;
  followHelp: string;
  sizeValue: (px: number) => string;
  /** The facts and saved sheets. */
  factsLoading: string;
  factsError: string;
  savedTitle: string;
  savedNote: (she: boolean) => string;
  showInText: string;
  remove: string;
}

const en: PlayerStrings = {
  heroNote: (word, she) => `${she ? 'Her' : 'His'} life in ${word} stories. A retelling in the first person, from the sources, never ${she ? 'her' : 'his'} own words.`,
  retellingNote: she => `A retelling in the first person. Never ${she ? 'her' : 'his'} own words.`,
  doorTitle: (name, word) => `${name}'s life, told in ${word} stories`,
  allStories: word => `All ${word} stories`,
  portraitNote: 'Painted by AI',
  begin: 'Begin',
  beginSub: m => `Introduction, ${m} min · then story 1`,
  beginSubWith: (m, title) => `Introduction, ${m} min · then story 1, ${title}`,
  continueStory: n => `Continue story ${n}`,
  continueWith: n => `On to story ${n}`,
  fromTime: time => `from ${time}`,
  startOver: 'Start over',
  storyN: n => `Story ${n}`,
  minutes: m => `${m} min`,
  minutesLeft: m => `${m} min left`,
  timeLeft: clock => `${clock} left`,
  readInstead: 'Read instead',
  listen: 'Listen',
  continueFrom: 'Continue',
  pause: 'Pause',
  resume: 'Resume',
  loading: 'Loading',
  introTitle: 'Introduction',
  introRowSub: m => `${m} min · before story 1`,
  tocTitle: word => `The ${word} stories`,
  tocLead: (a, b, total, she) =>
    `In the order of ${she ? 'her' : 'his'} life${a && b ? `, from age ${a} to ${b}` : ''}.${total ? ` About ${total} in all.` : ''}`,
  totalTime: m => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`),
  ageAt: age => `age ${age}`,
  rowAria: (n, title, details) => `${n === 0 ? 'Introduction' : `Story ${n}`}: ${[title, ...details].join(', ')}`,
  approxYear: year => year.replace(/^~\s*/, 'c. '),
  listView: 'List',
  mapView: 'Map',
  viewAria: 'How to show the stories',
  savedCount: n => `Saved (${n})`,
  opens: 'The story opens:',
  opensIntro: 'The introduction opens:',
  read: 'Read',
  share: 'Share',
  playingWord: 'playing',
  pausedWord: 'paused',
  startedWord: 'started',
  finishedWord: 'finished',
  ledgerTitle: 'What the record shows, what we built',
  appLink: 'Read along in the app',
  aboutTitle: she => (she ? 'Who she was' : 'Who he was'),
  hearStory: title => `Listen to the story: ${title}`,
  mapBy: name => `after ${name}`,
  nextTag: 'Up next',
  mapNote: she => `Each star is one story, in the order of ${she ? 'her' : 'his'} life. Tap a star.`,
  dockLabel: 'Story player',
  playAria: 'Play',
  pauseAria: 'Pause',
  back15Aria: 'Back 15 seconds',
  fwd15Aria: 'Forward 15 seconds',
  nextAria: 'Next story',
  prevAria: 'Previous story',
  readAlong: 'Read',
  closeAria: 'Close the player',
  backToAria: name => `Back to ${name}`,
  speedAria: rate => `Speed ${rate}, open the player`,
  openPlayer: 'Open the player',
  continueAt: (title, time) => `Continue “${title}” at ${time}`,
  continueNext: title => `Continue with “${title}”`,
  notNow: 'Not now',
  error: 'This story could not be played. Tap to try again.',
  speed: 'Speed',
  slower: 'Slower',
  faster: 'Faster',
  after: 'After this story',
  afterNext: 'Next',
  afterStop: 'Stop',
  stopAll: 'Stop playing',
  close: 'Close',
  ended: n => `Story ${n} has ended.`,
  endedIntro: 'The introduction has ended.',
  soon: (n, title) => `Next: story ${n} · ${title}`,
  stay: 'Stay here',
  listenNow: 'Listen now',
  readerAria: 'Story text',
  readerClose: 'Back',
  bookmark: 'Save this sentence',
  display: 'Display',
  follow: 'To the voice',
  fromHere: 'Listen from here',
  keep: 'Save',
  kept: 'Saved',
  undo: 'Undo',
  nextUp: 'Up next',
  shareStory: 'Share this story',
  copied: 'Link copied',
  afterLast: 'Two lives that come up often here',
  textLoading: 'Loading the text',
  textError: 'The text could not be loaded.',
  seekAria: 'Position in the story',
  light: 'Light',
  lights: ['Auto', 'Day', 'Vellum', 'Night'],
  textSize: 'Text size',
  smaller: 'Smaller text',
  larger: 'Larger text',
  face: 'Typeface',
  faces: ['Book', 'Clear'],
  spacing: 'Line spacing',
  spacings: ['Tight', 'Normal', 'Airy'],
  highlight: 'Highlight',
  highlights: ['Word', 'Sentence', 'Off'],
  followVoice: 'Follow the voice',
  followHelp: 'The text scrolls with the voice. Scroll yourself to read freely.',
  sizeValue: px => `${px} px`,
  factsLoading: 'Loading the facts',
  factsError: 'The facts could not be loaded.',
  savedTitle: 'Saved',
  savedNote: she => `Kept on this device only. Saved sentences are part of the retelling, not quotes of ${she ? 'hers' : 'his'}.`,
  showInText: 'Show in the text',
  remove: 'Remove',
};

const de: PlayerStrings = {
  heroNote: (word, she) => `${she ? 'Ihr' : 'Sein'} Leben in ${word} Geschichten. Eine Nacherzählung in der Ich-Form, nach den Quellen, nie ${she ? 'ihre' : 'seine'} eigenen Worte.`,
  retellingNote: she => `Eine Nacherzählung in der Ich-Form. Nie ${she ? 'ihre' : 'seine'} eigenen Worte.`,
  doorTitle: (name, word) => `${name}s Leben, erzählt in ${word} Geschichten`,
  allStories: word => `Alle ${word} Geschichten`,
  portraitNote: 'Von KI gemalt',
  begin: 'Beginnen',
  beginSub: m => `Einführung, ${m} Min. · dann Geschichte 1`,
  beginSubWith: (m, title) => `Einführung, ${m} Min. · dann Geschichte 1, ${title}`,
  continueStory: n => `Geschichte ${n} weiterhören`,
  continueWith: n => `Weiter mit Geschichte ${n}`,
  fromTime: time => `ab ${time}`,
  startOver: 'Von vorn beginnen',
  storyN: n => `Geschichte ${n}`,
  minutes: m => `${m} Min.`,
  minutesLeft: m => `noch ${m} Min.`,
  timeLeft: clock => `noch ${clock}`,
  readInstead: 'Lieber lesen',
  listen: 'Hören',
  continueFrom: 'Weiterhören',
  pause: 'Pause',
  resume: 'Weiter',
  loading: 'Lädt',
  introTitle: 'Einführung',
  introRowSub: m => `${m} Min. · vor Geschichte 1`,
  tocTitle: word => `Die ${word} Geschichten`,
  tocLead: (a, b, total, she) =>
    `In der Reihenfolge ${she ? 'ihres' : 'seines'} Lebens${a && b ? `, im Alter von ${a} bis ${b} Jahren` : ''}.${total ? ` Zusammen etwa ${total}` : ''}`,
  totalTime: m => (m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m} Min.`),
  ageAt: age => `mit ${age}`,
  rowAria: (n, title, details) => `${n === 0 ? 'Einführung' : `Geschichte ${n}`}: ${[title, ...details].join(', ')}`,
  approxYear: year => year.replace(/^~\s*/, 'um '),
  listView: 'Liste',
  mapView: 'Karte',
  viewAria: 'Ansicht der Geschichten',
  savedCount: n => `Gemerkt (${n})`,
  opens: 'So beginnt die Geschichte:',
  opensIntro: 'So beginnt die Einführung:',
  read: 'Lesen',
  share: 'Teilen',
  playingWord: 'läuft',
  pausedWord: 'pausiert',
  startedWord: 'angefangen',
  finishedWord: 'gehört',
  ledgerTitle: 'Was belegt ist, was wir gebaut haben',
  appLink: 'In der App mitlesen',
  aboutTitle: she => (she ? 'Wer sie war' : 'Wer er war'),
  hearStory: title => `Die Geschichte dazu hören: ${title}`,
  mapBy: name => `nach ${name}`,
  nextTag: 'Als Nächstes',
  mapNote: she => `Jeder Stern ist eine Geschichte, in der Reihenfolge ${she ? 'ihres' : 'seines'} Lebens. Tippe einen Stern an.`,
  dockLabel: 'Geschichten-Player',
  playAria: 'Abspielen',
  pauseAria: 'Pause',
  back15Aria: '15 Sekunden zurück',
  fwd15Aria: '15 Sekunden vor',
  nextAria: 'Nächste Geschichte',
  prevAria: 'Vorige Geschichte',
  readAlong: 'Lesen',
  closeAria: 'Player schließen',
  backToAria: name => `Zurück zu ${name}`,
  speedAria: rate => `Tempo ${rate}, Player öffnen`,
  openPlayer: 'Player öffnen',
  continueAt: (title, time) => `„${title}“ ab ${time} weiterhören`,
  continueNext: title => `Weiter mit „${title}“`,
  notNow: 'Nicht jetzt',
  error: 'Diese Geschichte ließ sich nicht abspielen. Zum erneuten Versuch tippen.',
  speed: 'Tempo',
  slower: 'Langsamer',
  faster: 'Schneller',
  after: 'Nach dieser Geschichte',
  afterNext: 'Nächste',
  afterStop: 'Stopp',
  stopAll: 'Beenden',
  close: 'Schließen',
  ended: n => `Geschichte ${n} ist zu Ende.`,
  endedIntro: 'Die Einführung ist zu Ende.',
  soon: (n, title) => `Gleich: Geschichte ${n} · ${title}`,
  stay: 'Hierbleiben',
  listenNow: 'Jetzt hören',
  readerAria: 'Text der Geschichte',
  readerClose: 'Zurück',
  bookmark: 'Satz merken',
  display: 'Darstellung',
  follow: 'Zur Stimme',
  fromHere: 'Ab hier hören',
  keep: 'Merken',
  kept: 'Gemerkt',
  undo: 'Rückgängig',
  nextUp: 'Als Nächstes',
  shareStory: 'Diese Geschichte teilen',
  copied: 'Link kopiert',
  afterLast: 'Zwei Leben, die hier oft vorkommen',
  textLoading: 'Text wird geladen',
  textError: 'Der Text konnte nicht geladen werden.',
  seekAria: 'Stelle in der Geschichte',
  light: 'Licht',
  lights: ['Auto', 'Tag', 'Pergament', 'Nacht'],
  textSize: 'Schriftgröße',
  smaller: 'Kleinere Schrift',
  larger: 'Größere Schrift',
  face: 'Schrift',
  faces: ['Buch', 'Klar'],
  spacing: 'Zeilenabstand',
  spacings: ['Eng', 'Normal', 'Weit'],
  highlight: 'Markierung',
  highlights: ['Wort', 'Satz', 'Aus'],
  followVoice: 'Der Stimme folgen',
  followHelp: 'Der Text scrollt mit der Stimme. Scrollst du selbst, liest du frei.',
  sizeValue: px => `${px} px`,
  factsLoading: 'Fakten werden geladen',
  factsError: 'Die Fakten konnten nicht geladen werden.',
  savedTitle: 'Gemerkt',
  savedNote: she => `Nur auf diesem Gerät gespeichert. Gemerkte Sätze sind Teil der Nacherzählung, keine Zitate von ${she ? 'ihr' : 'ihm'}.`,
  showInText: 'Im Text zeigen',
  remove: 'Entfernen',
};

export const PLAYER_STRINGS: Record<PlayerLang, PlayerStrings> = { en, de };

export function playerStrings(lang: PlayerLang): PlayerStrings {
  return PLAYER_STRINGS[lang];
}

/** A rate as the player shows it: two places, a decimal comma in German. */
export function rateLabel(rate: number, lang: PlayerLang): string {
  const n = rate.toFixed(2);
  return `${lang === 'de' ? n.replace('.', ',') : n}×`;
}

/** A clock: 2:05. */
export function clockLabel(seconds: number): string {
  const v = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}
