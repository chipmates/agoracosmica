import catalogData from '../assets/councils/councilCatalog.json';

export type ThemeId = 'loss-grief' | 'love-connection' | 'who-am-i' | 'meaning-purpose' | 'freedom-justice' | 'faith-death-mystery' | 'moral-life' | 'mind-creativity';
export type SafetyTier = 'standard' | 'sensitive' | 'deep';

export interface CatalogTheme {
  id: ThemeId;
  labelKey: string;
  cssVar: string;
}

export interface CatalogCouncil {
  id: string;
  title: string;
  tagline: string;
  taglineDe?: string;
  hook: string;
  hookDe?: string;
  type: 'confrontational' | 'reflective';
  theme: ThemeId;
  safety: SafetyTier;
  sortOrder: number;
  question: string;
  moderator: { id: string; name: string };
  participants: { id: string; name: string }[];
  titleDe?: string;
  questionDe?: string;
  description?: string;
  descriptionDe?: string;
}

// Short display names for space-constrained UI.
// Convention: family name only. Zenji is a Zen-master title, so Dōgen
// uses the personal name (no "Echo of Zenji"). Honorifics like "Jr."
// stay attached where they are part of the canonical signature.
export const getShortDisplayName = (figureId?: string): string => {
  if (!figureId) return 'Unknown';
  const shortNames: Record<string, string> = {
    'angelou': 'Angelou',
    'aurelius': 'Aurelius',
    'austen': 'Austen',
    'beauvoir': 'de Beauvoir',
    'bingen': 'Hildegard von Bingen',
    'blake': 'Blake',
    'campbell': 'Campbell',
    'vinci': 'da Vinci',
    'dickinson': 'Dickinson',
    'zenji': 'Dōgen',
    'eckhart': 'Eckhart',
    'einstein': 'Einstein',
    'galilei': 'Galilei',
    'gandhi': 'Gandhi',
    'gautama': 'Gautama',
    'goethe': 'Goethe',
    'jung': 'Jung',
    'kahlo': 'Kahlo',
    'king': 'King Jr.',
    'laozi': 'Laozi',
    'lovelace': 'Lovelace',
    'mandela': 'Mandela',
    'mozart': 'Mozart',
    'nietzsche': 'Nietzsche',
    'plato': 'Plato',
    'rumi': 'Rumi',
    'schopenhauer': 'Schopenhauer',
    'shakespeare': 'Shakespeare',
    'tubman': 'Tubman',
    'woolf': 'Woolf'
  };
  return shortNames[figureId] || figureId;
};

// "Echo of [LastName]" / "Echo von [LastName]" — header speaker labels.
// Uses figures.echoOfName so DE renders "Echo von ...". Returns '' for
// unknown ids so callers can fall back to a sane title.
type EchoTString = (key: string, fallback?: string) => string;
export const getEchoShortName = (figureId: string | undefined, tString: EchoTString): string => {
  const shortName = getShortDisplayName(figureId);
  if (shortName === 'Unknown') return '';
  return tString('figures.echoOfName', `Echo of ${shortName}`).replace('{name}', shortName);
};

// Theme definitions in display order (8 themes)
export const THEMES: CatalogTheme[] = [
  { id: 'who-am-i', labelKey: 'cosmicCouncil.themes.whoAmI', cssVar: '--council-who-am-i' },
  { id: 'love-connection', labelKey: 'cosmicCouncil.themes.loveConnection', cssVar: '--council-love-connection' },
  { id: 'meaning-purpose', labelKey: 'cosmicCouncil.themes.meaningPurpose', cssVar: '--council-meaning-purpose' },
  { id: 'mind-creativity', labelKey: 'cosmicCouncil.themes.mindCreativity', cssVar: '--council-mind-creativity' },
  { id: 'moral-life', labelKey: 'cosmicCouncil.themes.moralLife', cssVar: '--council-moral-life' },
  { id: 'freedom-justice', labelKey: 'cosmicCouncil.themes.freedomJustice', cssVar: '--council-freedom-justice' },
  { id: 'faith-death-mystery', labelKey: 'cosmicCouncil.themes.faithDeathMystery', cssVar: '--council-faith-death-mystery' },
  { id: 'loss-grief', labelKey: 'cosmicCouncil.themes.lossGrief', cssVar: '--council-loss-grief' },
];

// Theme accent color CSS variable lookup
export const getThemeAccentVar = (themeId: ThemeId): string => {
  const theme = THEMES.find(t => t.id === themeId);
  return theme?.cssVar || '--council-who-am-i';
};

export const councilCatalog: CatalogCouncil[] = catalogData as CatalogCouncil[];

// Hero councils — one confrontational, one reflective
const defaultConfrontational: CatalogCouncil = councilCatalog.find(c => c.type === 'confrontational') ?? councilCatalog[0];
const defaultReflective: CatalogCouncil = councilCatalog.find(c => c.type === 'reflective') ?? councilCatalog[0];
export const heroConfrontational = councilCatalog.find(c => c.id === 'the-calling-that-wont-shut-up') ?? defaultConfrontational;
export const heroReflective = councilCatalog.find(c => c.id === 'the-mind-that-wont-be-quiet') ?? defaultReflective;

// Type mapping: catalog uses 'confrontational'/'reflective', internal uses 'debate'/'advisory'
export const typeToInternal = (type: CatalogCouncil['type']): 'debate' | 'advisory' =>
  type === 'confrontational' ? 'debate' : 'advisory';

// === The Programme (2026-07 council revision) ===
// Curated listening order over all 55 councils. Stations 1-8 are the blessed
// per-theme picks (the "Acht Lebensfragen" rows, one per life theme, chosen
// from a full-script audit of all 55 councils); stations 9+ follow the
// audit's quality ranking, weakest scripts last. Station 1 is standard
// safety tier by design; deep-tier councils never appear before station 9.
export const COUNCIL_SEQUENCE: string[] = [
  'the-life-you-think-you-want',
  'the-mind-that-wont-be-quiet',
  'the-fear-you-feed',
  'alone-in-the-room-full-of-people',
  'the-problem-of-evil',
  'the-virtue-of-surrender',
  'the-story-you-keep-telling',
  'laughing-at-the-abyss',
  'how-do-you-forgive',
  'the-stain-that-stays',
  'why-do-i-keep-going-back',
  'what-does-your-anger-want',
  'the-calling-that-wont-shut-up',
  'the-meaning-of-pain',
  'the-serious-work-of-play',
  'when-silence-becomes-complicity',
  'the-discipline-of-seeing',
  'the-blank-page',
  'raising-the-next-one',
  'the-ghost-in-the-engine',
  'the-gilded-cage-you-built-yourself',
  'where-do-you-belong',
  'the-uninvited-guest',
  'the-mask-that-speaks',
  'four-freedoms',
  'the-god-after-god',
  'the-mask-behind-the-face',
  'the-empty-room',
  'the-unfinished-life',
  'the-green-eyed-god',
  'what-carried-you-through',
  'becoming-the-parent',
  'the-trouble-with-desire',
  'the-debt-you-didnt-sign',
  'the-vessel-and-the-flame',
  'the-body-that-carried-you',
  'the-silent-altar',
  'the-undoing-of-two',
  'the-question-behind-every-question',
  'the-public-wreckage',
  'choosing-to-be-alone',
  'the-emperor-and-the-fugitive',
  'the-examined-life',
  'the-weight-of-things',
  'the-intelligence-of-wounds',
  'the-price-of-everything',
  'is-this-all-there-is',
  'the-cathedral-without-walls',
  'the-inner-citadel',
  'the-freedom-of-less',
  'the-letting-go',
  'what-you-leave-behind',
  'the-self-that-isnt-there',
  'when-words-arent-enough',
  'right-here-right-now',
];

// One blessed council per theme — the theme rows show exactly these eight.
export const BLESSED_BY_THEME: Record<ThemeId, string> = {
  'who-am-i': 'the-story-you-keep-telling',
  'love-connection': 'alone-in-the-room-full-of-people',
  'meaning-purpose': 'the-life-you-think-you-want',
  'mind-creativity': 'the-mind-that-wont-be-quiet',
  'moral-life': 'the-fear-you-feed',
  'freedom-justice': 'the-virtue-of-surrender',
  'faith-death-mystery': 'the-problem-of-evil',
  'loss-grief': 'laughing-at-the-abyss',
};

export interface NextStation {
  council: CatalogCouncil;
  station: number; // 1-based position in COUNCIL_SEQUENCE
}

// The featured slot: the first council in the sequence the visitor has not
// completed. Pure — the completion probe is injected so tests need no
// localStorage. Returns null only when every council is completed.
export const getNextStation = (
  isCompleted: (councilId: string) => boolean
): NextStation | null => {
  for (let i = 0; i < COUNCIL_SEQUENCE.length; i++) {
    const id = COUNCIL_SEQUENCE[i];
    if (isCompleted(id)) continue;
    const council = councilCatalog.find(c => c.id === id);
    if (council) return { council, station: i + 1 };
  }
  return null;
};

export const countCompletedInSequence = (
  isCompleted: (councilId: string) => boolean
): number => COUNCIL_SEQUENCE.filter(id => isCompleted(id)).length;

// Resume state for the featured slot: the sequence-first council that has
// saved listening progress but no completion flag.
export const getInProgressCouncilId = (
  hasProgress: (councilId: string) => boolean,
  isCompleted: (councilId: string) => boolean
): string | null => {
  for (const id of COUNCIL_SEQUENCE) {
    if (!isCompleted(id) && hasProgress(id)) return id;
  }
  return null;
};

// Theme councils in programme order (blessed pick first, then by audit
// rank) — the "Alle Räte" browse list ordering.
export const getThemeCouncilsRanked = (themeId: ThemeId): CatalogCouncil[] => {
  const pos = (id: string): number => {
    const i = COUNCIL_SEQUENCE.indexOf(id);
    return i === -1 ? COUNCIL_SEQUENCE.length : i;
  };
  return councilCatalog
    .filter(c => c.theme === themeId)
    .sort((a, b) => pos(a.id) - pos(b.id));
};

export const ESTIMATED_DURATION = '~14 min';

// Localized field accessors
export const getLocalizedTitle = (council: CatalogCouncil, lang: string): string =>
  lang === 'de' ? (council.titleDe || council.title) : council.title;

export const getLocalizedQuestion = (council: CatalogCouncil, lang: string): string =>
  lang === 'de' ? (council.questionDe || council.question) : council.question;

export const getLocalizedDescription = (council: CatalogCouncil, lang: string): string | undefined =>
  lang === 'de' ? (council.descriptionDe || council.description) : council.description;

export const getLocalizedTagline = (council: CatalogCouncil, lang: string): string =>
  lang === 'de' ? (council.taglineDe || council.tagline) : council.tagline;

export const getLocalizedHook = (council: CatalogCouncil, lang: string): string =>
  lang === 'de' ? (council.hookDe || council.hook) : council.hook;
