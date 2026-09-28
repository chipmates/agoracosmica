// The museum's station doors. A door in a wing of the museum names the
// station it stands at with w:{figure}:{station}, and this table turns that
// name into the question the visitor read beside the door, in the app's
// language. It mirrors the wing's own door catalogue
// (nightagora/src/wings/vinci/data/doors.json, including its closing question
// 'farewell'); wingDoors.test.ts fails when the two drift.

export interface WingDoorQuestion {
  en: string;
  de: string;
}

// Lowercase ids only, the same shape the museum's door builder sends.
export const WING_ASK_TAG = /^w:([a-z]+):([a-z0-9-]{1,40})$/;

const vinciDoors: Record<string, WingDoorQuestion> = {
  arrival: {
    en: 'You came to France past sixty. Why leave Italy so late in life?',
    de: 'Du kamst mit über sechzig nach Frankreich. Warum hast du Italien so spät noch verlassen?',
  },
  courtyard: {
    en: 'A visitor called you the best painter of your time. Did such praise still matter to you?',
    de: 'Ein Gast nannte dich den besten Maler deiner Zeit. Bedeutete dir solches Lob noch etwas?',
  },
  hall: {
    en: 'When a guest came to this house, what did you show them first?',
    de: 'Wenn ein Gast in dieses Haus kam, was hast du ihm zuerst gezeigt?',
  },
  oratory: {
    en: 'Your pupils may have painted this chapel. What did you want a pupil to learn from you?',
    de: 'Deine Schüler haben diese Kapelle vielleicht ausgemalt. Was sollten sie von dir lernen?',
  },
  study: {
    en: 'A visitor wrote of a paralysis in your right hand. How did you keep working?',
    de: 'Ein Besucher schrieb von einer Lähmung deiner rechten Hand. Wie hast du weitergemacht?',
  },
  chamber: {
    en: 'You left your books to Melzi, and he called you the best of fathers. What was he to you?',
    de: 'Melzi bekam deine Bücher und nannte dich den besten Vater. Was war er für dich?',
  },
  garden: {
    en: 'You wanted to see everything yourself. Did your eyes ever fool you?',
    de: 'Du wolltest alles mit eigenen Augen sehen. Haben sie dich je getäuscht?',
  },
  'line-early': {
    en: 'At five a tax return lists you as born outside marriage. What did that mean back then?',
    de: 'Eine Steuererklärung führt dich mit fünf als unehelich. Was hieß das damals für ein Kind?',
  },
  'line-late': {
    en: 'What were you looking for in all those cities?',
    de: 'Was hast du in all diesen Städten gesucht?',
  },
  'line-amboise': {
    en: 'What could you do with a king behind you that you could not do before?',
    de: 'Was konntest du mit einem König im Rücken tun, was vorher nicht ging?',
  },
  'picture-room': {
    en: "They say your angel here outdid your master's. What did you learn from Verrocchio?",
    de: 'Dein Engel hier soll den Meister übertroffen haben. Was hast du von Verrocchio gelernt?',
  },
  'supper-wall': {
    en: 'Why did you choose such a fragile way to paint the Last Supper?',
    de: 'Warum hast du das Abendmahl mit einer so empfindlichen Technik gemalt?',
  },
  'reading-table': {
    en: 'Why did you write your notes from right to left?',
    de: 'Warum hast du deine Notizen von rechts nach links geschrieben?',
  },
  scattered: {
    en: 'If you could keep only one page, which would it be?',
    de: 'Wenn du nur ein Blatt behalten könntest, welches wäre es?',
  },
  flight: {
    en: 'Did you really believe people could fly?',
    de: 'Hast du wirklich geglaubt, dass Menschen fliegen können?',
  },
  works: {
    en: 'The bronze for your horse went to cannon instead. How did you take that?',
    de: 'Die Bronze für dein Pferd wurde zu Kanonen. Wie hast du das verkraftet?',
  },
  body: {
    en: 'You told a visitor you had opened over thirty bodies. What were you looking for inside?',
    de: 'Über dreißig Tote hast du geöffnet, sagtest du einem Besucher. Was hast du darin gesucht?',
  },
  myths: {
    en: 'People quote sentences as yours that you never wrote. Does that bother you?',
    de: 'Man zitiert Sätze als deine, die du nie geschrieben hast. Stört dich das?',
  },
  grave: {
    en: 'Nobody is sure these bones are yours. Does it matter to you where you lie?',
    de: 'Ob diese Knochen deine sind, weiß niemand sicher. Ist es dir wichtig, wo du liegst?',
  },
  'picture-room-west': {
    en: 'Your paintings fit on one wall, and some are unfinished. Why so few?',
    de: 'Deine Gemälde passen an eine Wand, manche blieben unvollendet. Warum so wenige?',
  },
  farewell: {
    en: 'I have just walked through your whole life. What should I take with me?',
    de: 'Ich bin gerade durch dein ganzes Leben gegangen. Was soll ich mitnehmen?',
  },
};

// The teaching that grounds a station's question, only where the question is
// squarely that teaching's subject. Every other door opens plain Free Talk
// with the question staged: no anchor beats a wrong one.
const vinciAnchors: Record<string, number> = {
  garden: 2, // The Art of Seeing
  'picture-room': 8, // Integration of Knowledge, as the figure page's "why so much unfinished"
  works: 10, // Engineering and Mechanical Innovation
  body: 11, // Human Form Integration
};

// Lookups run against untrusted URL input, so they go through Maps: a plain
// object would report inherited keys ("constructor") as present.
const doorsByFigure = new Map<string, Map<string, WingDoorQuestion>>([
  ['vinci', new Map(Object.entries(vinciDoors))],
]);
const anchorsByFigure = new Map<string, Map<string, number>>([
  ['vinci', new Map(Object.entries(vinciAnchors))],
]);

/** The station's question in the visitor's language, or null for an unknown
 *  figure, station or language (the caller falls back to the hero question). */
export const getWingDoorQuestion = (
  figureId: string,
  station: string,
  lang: string
): string | null => {
  const door = doorsByFigure.get(figureId)?.get(station);
  if (!door || (lang !== 'en' && lang !== 'de')) return null;
  return door[lang];
};

/** True for a station door the table knows, for a figure it knows. */
export const hasWingDoor = (figureId: string, station: string): boolean =>
  doorsByFigure.get(figureId)?.has(station) ?? false;

/** The anchor seed of a station's question, or null when it has none. */
export const getWingDoorSeedId = (figureId: string, station: string): number | null =>
  anchorsByFigure.get(figureId)?.get(station) ?? null;

/** Every station door of a figure, for the drift check. */
export const listWingDoors = (figureId: string): ReadonlyMap<string, WingDoorQuestion> =>
  doorsByFigure.get(figureId) ?? new Map();
