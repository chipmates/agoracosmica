// Every displayed string of the story player, EN and DE together. These are
// placeholders for the writer: short and functional. The stories' label and
// the facts' words are not here, they are read unchanged from the app's own
// translations (label.ts, factWords.ts). Story titles, years and places come
// from the catalogs.

import { PORTRAIT_CREDIT } from '../lib/portraitCredit';

export type PlayerLang = 'en' | 'de';

export interface PlayerStrings {
  /** The hero's note under the line: how many stories, and that they are retellings. */
  heroNote: (countWord: string, she: boolean) => string;
  /** The reading view's note under the title. Keeps the word "retelling". */
  retellingNote: (she: boolean) => string;
  /** The story door under a poem: its heading and the link to the figure page. English takes 's after a final s too (the site's "Aurelius's"). */
  doorTitle: (name: string, countWord: string) => string;
  allStories: (countWord: string) => string;
  /** The credit under the hero portrait: short, so it never outweighs the picture. */
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
  read: string;
  share: string;
  playingWord: string;
  pausedWord: string;
  startedWord: string;
  finishedWord: string;
  /** The reader's end: the figure template's existing heading. */
  ledgerTitle: string;
  /** The quiet link into the app's story mode. */
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
  /** The open player's steps once the story's timing is in: by sentence, held for a paragraph. */
  sentenceBack: string;
  sentenceOn: string;
  stepHold: string;
  nextAria: string;
  prevAria: string;
  readAlong: string;
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
  /** The sleep timer in the open player: its name, the five choices, what is left; the dock's moon says it too. */
  sleepTitle: string;
  sleepChoices: [string, string, string, string, string];
  sleepLeft: (clock: string) => string;
  sleepToEnd: string;
  sleepAria: (what: string) => string;
  close: string;
  /** The end card. */
  ended: (n: number) => string;
  endedIntro: string;
  soon: (n: number, title: string) => string;
  stay: string;
  listenNow: string;
  /** The reading view. */
  readerAria: string;
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
  /** The map of the text: a scene's name in the drag bubble, and the range's value for screen readers. */
  mapScene: (n: number) => string;
  mapValue: (time: string, total: string, scene: number | null) => string;
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
  /** The switch that brings the wash back behind the spoken sentence, and its help line. */
  strongMark: string;
  strongMarkHelp: string;
  followVoice: string;
  followHelp: string;
  sizeValue: (px: number) => string;
  /** The keys, listed in the display sheet on a device with a mouse: a heading, then each key and what it does. */
  keysTitle: string;
  keys: [string, string][];
  /** Under "after this story" in the open player: the story that comes next. */
  afterNextTitle: (n: number, title: string) => string;
  /** The save toast's second button: the saved list. */
  showSaved: string;
  /** The facts and saved sheets. */
  factsLoading: string;
  factsError: string;
  savedTitle: string;
  savedNote: (she: boolean) => string;
  showInText: string;
  remove: string;
}

const en: PlayerStrings = {
  heroNote: (word, she) => `${she ? 'Her' : 'His'} life in ${word} stories. A retelling in the first person, from the sources. Never ${she ? 'her' : 'his'} own words.`,
  retellingNote: she => `A retelling in the first person. Never ${she ? 'her' : 'his'} own words.`,
  doorTitle: (name, word) => `${name}'s life, told in ${word} stories`,
  allStories: word => `All ${word} stories`,
  portraitNote: PORTRAIT_CREDIT.en,
  begin: 'Begin',
  // The line wraps at its comma (no-break spaces hold the rest), never with a dot at a line's end.
  beginSub: m => `Introduction (${m} min), then story 1`,
  beginSubWith: (m, title) => `Introduction (${m} min), then story 1, ${title}`,
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
  totalTime: m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`),
  ageAt: age => `age ${age}`,
  rowAria: (n, title, details) => (n === 0 ? ['Introduction', ...details] : [`Story ${n}: ${title}`, ...details]).join(', '),
  approxYear: year => year.replace(/^~\s*/, 'c. '),
  listView: 'List',
  mapView: 'Map',
  viewAria: 'List or map',
  savedCount: n => `Saved (${n})`,
  read: 'Read',
  share: 'Share',
  playingWord: 'playing',
  pausedWord: 'paused',
  startedWord: 'started',
  finishedWord: 'finished',
  ledgerTitle: 'The facts',
  appLink: 'The stories in the app →',
  aboutTitle: she => (she ? 'Who she was' : 'Who he was'),
  hearStory: title => `Listen to the story “${title}”`,
  mapBy: name => `for ${name}`,
  nextTag: 'Up next',
  mapNote: she => `Each star is one story, in the order of ${she ? 'her' : 'his'} life. Choose a star and the story opens.`,
  dockLabel: 'Story player',
  playAria: 'Play',
  pauseAria: 'Pause',
  back15Aria: 'Back 15 seconds',
  fwd15Aria: 'Forward 15 seconds',
  sentenceBack: 'Previous sentence',
  sentenceOn: 'Next sentence',
  stepHold: 'Hold for a paragraph',
  nextAria: 'Next story',
  prevAria: 'Previous story',
  readAlong: 'Read',
  backToAria: name => `Back to ${name}`,
  speedAria: rate => `Speed ${rate}, open the player`,
  openPlayer: 'Open the player',
  continueAt: (title, time) => `${title} · from ${time}`,
  continueNext: title => `Continue with “${title}”`,
  notNow: 'Not now',
  error: 'Could not play this story. Try again.',
  speed: 'Speed',
  slower: 'Slower',
  faster: 'Faster',
  after: 'After this story',
  afterNext: 'Next',
  afterStop: 'Stop',
  stopAll: 'Stop playing',
  sleepTitle: 'Sleep timer',
  sleepChoices: ['Off', '10 min', '20 min', '30 min', 'End'],
  sleepLeft: clock => `${clock} left`,
  sleepToEnd: 'Stops when this story ends',
  sleepAria: what => `Sleep timer: ${what}`,
  close: 'Close',
  ended: n => `Story ${n} has ended.`,
  endedIntro: 'The introduction has ended.',
  soon: (n, title) => `Next: story ${n} · ${title}`,
  stay: 'Stay here',
  listenNow: 'Listen now',
  readerAria: 'Story text',
  bookmark: 'Save this sentence',
  display: 'Display',
  follow: 'Read along',
  fromHere: 'Listen from here',
  keep: 'Save',
  kept: 'Saved',
  undo: 'Undo',
  nextUp: 'Up next',
  shareStory: 'Share this story',
  copied: 'Link copied',
  afterLast: 'Other lives that connect to these stories',
  textLoading: 'Loading the text',
  textError: 'The text could not be loaded.',
  seekAria: 'Position in the story',
  mapScene: n => `Scene ${n}`,
  mapValue: (time, total, scene) => `${time} of ${total}${scene ? `, scene ${scene}` : ''}`,
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
  strongMark: 'Stronger highlight',
  strongMarkHelp: 'A soft tint behind the spoken sentence.',
  followVoice: 'Follow the voice',
  followHelp: 'The text scrolls with the voice. Scroll yourself to read freely.',
  sizeValue: px => `${px} px`,
  keysTitle: 'Keys',
  keys: [['Space', 'Play or pause'], ['← →', 'Sentence back or on'], ['Shift ← →', 'Paragraph back or on'], ['+ −', 'Faster or slower'], ['M', 'Save the sentence'], ['Esc', 'Close the text']],
  afterNextTitle: (n, title) => `Next: ${n}. ${title}`,
  showSaved: 'See all',
  factsLoading: 'Loading the facts',
  factsError: 'The facts could not be loaded.',
  savedTitle: 'Saved',
  savedNote: she => `Kept on this device only. Saved sentences are part of the retelling, not quotes of ${she ? 'hers' : 'his'}.`,
  showInText: 'Show in the text',
  remove: 'Remove',
};

const de: PlayerStrings = {
  heroNote: (word, she) => `${she ? 'Ihr' : 'Sein'} Leben in ${word} Geschichten. Eine Nacherzählung in der Ich-Form, nach den Quellen. Nie ${she ? 'ihre' : 'seine'} eigenen Worte.`,
  retellingNote: she => `Eine Nacherzählung in der Ich-Form. Nie ${she ? 'ihre' : 'seine'} eigenen Worte.`,
  doorTitle: (name, word) => `Das Leben von ${name} in ${word} Geschichten`,
  allStories: word => `Alle ${word} Geschichten`,
  portraitNote: PORTRAIT_CREDIT.de,
  begin: 'Beginnen',
  beginSub: m => `Einführung (${m} Min.), dann Geschichte 1`,
  beginSubWith: (m, title) => `Einführung (${m} Min.), dann Geschichte 1, ${title}`,
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
  pause: 'Pausieren',
  resume: 'Weiter',
  loading: 'Wird geladen',
  introTitle: 'Einführung',
  introRowSub: m => `${m} Min. · vor Geschichte 1`,
  tocTitle: word => `Die ${word} Geschichten`,
  tocLead: (a, b, total, she) =>
    `In der Reihenfolge ${she ? 'ihres' : 'seines'} Lebens${a && b ? `, im Alter von ${a} bis ${b} Jahren` : ''}.${total ? ` Zusammen etwa ${total}` : ''}`,
  totalTime: m => (m >= 60 ? `${Math.floor(m / 60)} Std.${m % 60 ? ` ${m % 60} Min.` : ''}` : `${m} Min.`),
  ageAt: age => `mit ${age} Jahren`,
  rowAria: (n, title, details) => (n === 0 ? ['Einführung', ...details] : [`Geschichte ${n}: ${title}`, ...details]).join(', '),
  approxYear: year => year.replace(/^~\s*/, 'um '),
  listView: 'Liste',
  mapView: 'Karte',
  viewAria: 'Liste oder Karte',
  savedCount: n => `Gemerkt (${n})`,
  read: 'Lesen',
  share: 'Teilen',
  playingWord: 'läuft',
  pausedWord: 'pausiert',
  startedWord: 'angefangen',
  finishedWord: 'zu Ende gehört',
  ledgerTitle: 'Die Fakten',
  appLink: 'Die Geschichten in der App →',
  aboutTitle: she => (she ? 'Wer sie war' : 'Wer er war'),
  hearStory: title => `Die Geschichte „${title}“ hören`,
  mapBy: name => `für ${name}`,
  nextTag: 'Als Nächstes',
  mapNote: she => `Jeder Stern ist eine Geschichte, in der Reihenfolge ${she ? 'ihres' : 'seines'} Lebens. Wähle einen Stern, und die Geschichte öffnet sich.`,
  dockLabel: 'Geschichten-Player',
  playAria: 'Abspielen',
  pauseAria: 'Pause',
  back15Aria: '15 Sekunden zurück',
  fwd15Aria: '15 Sekunden vor',
  sentenceBack: 'Satz zurück',
  sentenceOn: 'Nächster Satz',
  stepHold: 'Halten für einen Absatz',
  nextAria: 'Nächste Geschichte',
  prevAria: 'Vorherige Geschichte',
  readAlong: 'Lesen',
  backToAria: name => `Zurück zu ${name}`,
  speedAria: rate => `Tempo ${rate}, Player öffnen`,
  openPlayer: 'Player öffnen',
  continueAt: (title, time) => `${title} · ab ${time}`,
  continueNext: title => `Weiter mit „${title}“`,
  notNow: 'Jetzt nicht',
  error: 'Abspielen nicht möglich. Noch mal versuchen.',
  speed: 'Tempo',
  slower: 'Langsamer',
  faster: 'Schneller',
  after: 'Nach dieser Geschichte',
  afterNext: 'Weiter',
  afterStop: 'Stopp',
  stopAll: 'Beenden',
  sleepTitle: 'Schlaftimer',
  sleepChoices: ['Aus', '10 Min.', '20 Min.', '30 Min.', 'Ende'],
  sleepLeft: clock => `noch ${clock}`,
  sleepToEnd: 'Hält am Ende dieser Geschichte an',
  sleepAria: what => `Schlaftimer: ${what}`,
  close: 'Schließen',
  ended: n => `Geschichte ${n} ist zu Ende.`,
  endedIntro: 'Die Einführung ist zu Ende.',
  soon: (n, title) => `Gleich: Geschichte ${n} · ${title}`,
  stay: 'Hierbleiben',
  listenNow: 'Jetzt hören',
  readerAria: 'Text der Geschichte',
  bookmark: 'Diesen Satz merken',
  display: 'Darstellung',
  follow: 'Mitlesen',
  fromHere: 'Ab hier hören',
  keep: 'Merken',
  kept: 'Gemerkt',
  undo: 'Rückgängig',
  nextUp: 'Als Nächstes',
  shareStory: 'Diese Geschichte teilen',
  copied: 'Link kopiert',
  afterLast: 'Andere Leben, die mit diesen Geschichten verbunden sind',
  textLoading: 'Text wird geladen',
  textError: 'Der Text konnte nicht geladen werden.',
  seekAria: 'Stelle in der Geschichte',
  mapScene: n => `Szene ${n}`,
  mapValue: (time, total, scene) => `${time} von ${total}${scene ? `, Szene ${scene}` : ''}`,
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
  strongMark: 'Stärker markieren',
  strongMarkHelp: 'Ein leichter Grund hinter dem gesprochenen Satz.',
  followVoice: 'Der Stimme folgen',
  followHelp: 'Der Text scrollt mit der Stimme. Scrollst du selbst, liest du frei.',
  sizeValue: px => `${px} px`,
  keysTitle: 'Tasten',
  keys: [['Leertaste', 'Abspielen oder anhalten'], ['← →', 'Satz zurück oder weiter'], ['Umschalt ← →', 'Absatz zurück oder weiter'], ['+ −', 'Schneller oder langsamer'], ['M', 'Satz merken'], ['Esc', 'Text schließen']],
  afterNextTitle: (n, title) => `Danach: ${n}. ${title}`,
  showSaved: 'Alle ansehen',
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

/** A list's separator: the no-break space keeps the dot at the end of a line when a list wraps. */
export const LIST_SEP = '\u00a0· ';

/** The dock's hidden "Synthetic voice": every control that starts a story is described by it. */
export const VOICE_DESC_ID = 'story-voice-desc';

/** The label's halves as shown, each kept whole where it fits: its dot stays at the end of the first half. */
export function labelHalves(brief: string): string[] {
  const halves = brief.split(' · ');
  return halves.map((half, i) => (i < halves.length - 1 ? `${half}\u00a0·` : half));
}

/** A clock: 2:05. */
export function clockLabel(seconds: number): string {
  const v = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}
