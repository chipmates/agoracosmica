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

// Group councils by theme
export const councilsByTheme: Record<ThemeId, CatalogCouncil[]> = THEMES.reduce(
  (acc, theme) => {
    acc[theme.id] = councilCatalog.filter(c => c.theme === theme.id);
    return acc;
  },
  {} as Record<ThemeId, CatalogCouncil[]>
);

// Hero councils — one confrontational, one reflective (updated for revised canon)
const defaultConfrontational: CatalogCouncil = councilCatalog.find(c => c.type === 'confrontational') ?? councilCatalog[0];
const defaultReflective: CatalogCouncil = councilCatalog.find(c => c.type === 'reflective') ?? councilCatalog[0];
export const heroConfrontational = councilCatalog.find(c => c.id === 'the-calling-that-wont-shut-up') ?? defaultConfrontational;
export const heroReflective = councilCatalog.find(c => c.id === 'the-mind-that-wont-be-quiet') ?? defaultReflective;

// Type mapping: catalog uses 'confrontational'/'reflective', internal uses 'debate'/'advisory'
export const typeToInternal = (type: CatalogCouncil['type']): 'debate' | 'advisory' =>
  type === 'confrontational' ? 'debate' : 'advisory';

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
