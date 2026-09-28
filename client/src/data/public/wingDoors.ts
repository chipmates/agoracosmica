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
    en: 'Why did you leave Italy for a house in France?',
    de: 'Warum hast du Italien für ein Haus in Frankreich verlassen?',
  },
  courtyard: {
    en: 'What did you owe the men who paid you?',
    de: 'Was warst du den Männern schuldig, die dich bezahlten?',
  },
  hall: {
    en: 'How did you speak to people who wanted a spectacle from you?',
    de: 'Wie hast du mit Menschen gesprochen, die von dir ein Schauspiel erwarteten?',
  },
  oratory: {
    en: 'What lasts longer, a wall painting or a page?',
    de: 'Was hält länger, ein Wandgemälde oder ein Blatt Papier?',
  },
  study: {
    en: 'A visitor wrote of a paralysis in your right hand, and that you still drew and taught. Which mattered more to you, the drawing or the teaching?',
    de: 'Ein Besucher schrieb von einer Lähmung deiner rechten Hand und dass du noch zeichnest und andere lehrst. Was war dir wichtiger, das Zeichnen oder das Lehren?',
  },
  chamber: {
    en: 'Why did painters keep returning to the story of your death?',
    de: 'Warum haben Maler die Geschichte deines Todes immer wieder dargestellt?',
  },
  garden: {
    en: 'How did you decide when to trust what your eyes showed you?',
    de: 'Wie hast du entschieden, wann du deinen Augen vertrauen konntest?',
  },
  'line-early': {
    en: 'How much did being listed as illegitimate at seventeen shape your choices?',
    de: 'Wie sehr hat es deine Entscheidungen geprägt, mit siebzehn als unehelich verzeichnet zu sein?',
  },
  'line-late': {
    en: 'What were you looking for in all those cities?',
    de: 'Was hast du in all diesen Städten gesucht?',
  },
  'line-amboise': {
    en: "What did a king's support let you do freely?",
    de: 'Welche Freiheiten gab dir die Unterstützung eines Königs?',
  },
  'picture-room': {
    en: 'Why did you leave so few paintings?',
    de: 'Warum hast du so wenige Gemälde hinterlassen?',
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
    en: 'How did you decide whether to keep working on flight?',
    de: 'Wie hast du entschieden, ob du am Fliegen weiterarbeiten solltest?',
  },
  works: {
    en: 'When does a drawing become a machine?',
    de: 'Wann wird aus einer Zeichnung eine Maschine?',
  },
  body: {
    en: 'What could a drawing show that a dissection could not?',
    de: 'Was konnte eine Zeichnung zeigen, was eine Sektion nicht zeigen konnte?',
  },
  myths: {
    en: 'How would you feel about words being quoted as yours that you never wrote?',
    de: 'Wie wäre es für dich, wenn man Worte als deine zitiert, die du nie geschrieben hast?',
  },
  grave: {
    en: 'What should a grave say when the remains are only presumed to be yours?',
    de: 'Was sollte auf einem Grab stehen, wenn die Überreste nur vermutlich deine sind?',
  },
  'picture-room-west': {
    en: 'What were you still trying to do in your last paintings?',
    de: 'Was wolltest du in deinen letzten Gemälden noch erreichen?',
  },
  farewell: {
    en: 'Looking back over your whole life, what mattered most to you?',
    de: 'Wenn du auf dein ganzes Leben zurückblickst, was war dir am wichtigsten?',
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
