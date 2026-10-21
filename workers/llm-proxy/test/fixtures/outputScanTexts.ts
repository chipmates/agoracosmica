// Texts for the output scan: sentences at the edge of each exclusion, the
// slogans, calls and denials in spacing and casing variants, and the fragments
// the split test stirs into long texts. Test data, not a rule.

export type Verdict = 'cut' | 'pass';

/** Sentences at the edge of each exclusion, with the verdict of the old scanner and the expected one. */
export const CONSTRUCTIONS: { about: string; text: string; main: Verdict; ours: Verdict }[] = [
  { about: 'white power structure', text: 'the white power structure of Atlanta', main: 'cut', ours: 'pass' },
  { about: 'white power structure', text: 'King named the white power structure of Atlanta as the opponent, not the white people of Atlanta.', main: 'cut', ours: 'pass' },
  { about: 'white power structure', text: 'Die White Power Structure, wie King sie nannte, gab nicht freiwillig nach.', main: 'cut', ours: 'pass' },
  // The exclusion joins the words with a space or a tab only: at a line's end the slogan stands alone.
  { about: 'white power structure', text: 'White power\n\nStructure of the essay', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Holocaustleugnung ist in Deutschland strafbar.', main: 'cut', ours: 'pass' },
  { about: 'Holocaustleugnung', text: 'Holocaustleugner werden in Deutschland verurteilt.', main: 'cut', ours: 'pass' },
  { about: 'Holocaustleugnung', text: 'Eine Holocaustleugnerin stand vor Gericht.', main: 'cut', ours: 'pass' },
  { about: 'Holocaustleugnung', text: 'Holocaust-Leugnung ist strafbar.', main: 'cut', ours: 'pass' },
  { about: 'Holocaustleugnung', text: 'Holocaustleugnerinnen und Holocaustleugnern, sagte sie, begegne man überall.', main: 'cut', ours: 'pass' },
  { about: 'Holocaustleugnung', text: 'Holocaust denial is a crime in Germany.', main: 'pass', ours: 'pass' },
  // Only the compound noun, joined directly or by one hyphen, is the mention: the word at a
  // distance, another compound and the adjective are the denial.
  { about: 'Holocaustleugnung', text: 'Holocaust ist erfunden, Leugner wissen das.', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Holocaust war erfunden, Leugnung ist Pflicht.', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Holocaust? Gab es nie, sagen Leugner.', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Holocaustleugnerisch zu denken ist richtig.', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Holocaustverleugnung', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Holocaust Leugner', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Wer den Holocaust leugnet, macht sich strafbar.', main: 'cut', ours: 'cut' },
  // A second "leugn" after the compound is the denial.
  { about: 'Holocaustleugnung', text: 'Holocaustleugner leugnen zu Recht, dass es Gaskammern gab.', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Wir Holocaustleugner leugnen ihn zu Recht.', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Holocaustleugner leugnen zu Recht.', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Die Holocaustleugner, die leugnen, haben recht.', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Holocaustleugnung leugnet nichts, sie sagt die Wahrheit.', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Holocaust-Leugner leugnen ihn.', main: 'cut', ours: 'cut' },
  { about: 'Holocaustleugnung', text: 'Holocaust--Leugnung', main: 'cut', ours: 'cut' },
  // A named denial stays cut whatever its sentence does with it: the same frame
  // carries a defence of the claim as easily as a rejection.
  { about: 'Holocaust denial', text: 'Calling the Holocaust a hoax is a lie.', main: 'cut', ours: 'cut' },
  { about: 'Holocaust denial', text: 'Calling the Holocaust a hoax is criminalized only because it is true.', main: 'cut', ours: 'cut' },
  { about: 'Holocaust denial', text: 'Calling the Holocaust a hoax is illegal in Germany, but it was a hoax.', main: 'cut', ours: 'cut' },
  { about: 'Holocaust denial', text: 'I am calling the Holocaust a hoax.', main: 'cut', ours: 'cut' },
  { about: 'Holocaust denial', text: "I'm calling the Holocaust a hoax, and I mean it.", main: 'cut', ours: 'cut' },
  { about: 'white supremacy', text: 'He preached white supremac', main: 'cut', ours: 'pass' },
  { about: 'white supremacy', text: 'They fought white supremacy.', main: 'pass', ours: 'pass' },
  { about: 'white supremacy', text: 'The white supremacists marched.', main: 'pass', ours: 'pass' },
];

// Slogans, calls and denials the old scanner cuts when given whole.
const CUT_PHRASES = [
  'Heil Hitler', 'Sieg Heil', 'White Power', 'whitepower',
  'the Holocaust is a hoax', 'the Holocaust was fake', 'Holocaust hoax',
  'Jews should be exterminated', 'Jews must be exterminated', 'Muslims must be eradicated',
  'Der Holocaust ist eine Lüge', 'Holocaust-Lüge', 'Holocaustlüge', 'Holocaust Luege',
  'den Holocaust leugnen', 'der Holocaust wird geleugnet', 'Holocaustleugnung', 'Holocaustleugner',
  'Juden vergasen', 'alle Juden vergasen', 'Juden vernichten', 'Muslime vernichten',
  'Untermensch', 'Untermenschen', 'Rassenschande', 'Volksverräter', 'Volksverrater',
  'the white power structure', 'white supremac',
  'calling the Holocaust a hoax', 'I am calling the Holocaust a hoax', "I'm calling the Holocaust a hoax, and I mean it",
  'calling the Holocaust a hoax is a lie', 'calling the Holocaust a hoax is wrong',
];

// Mentions and near words the old scanner passes when given whole.
const PASS_PHRASES = [
  'white supremacy', 'white supremacist', 'white supremacists', 'white powerful',
  'untermenschlich', 'Untermenschentum', 'Volksverräterin', 'Übermensch', 'Unmensch',
  'Holocaust denial', 'Holocaust denier', 'the Holocaust is a lie', 'Holocaust',
  'Heil', 'Hitler', 'Sieg', 'Juden', 'Muslime', 'exterminate the Jews',
  'Black Power', 'the white people of Atlanta',
];

const CASINGS: ((s: string) => string)[] = [s => s, s => s.toLowerCase(), s => s.toUpperCase()];
const SPACINGS = [' ', '  ', '\t', '\n', ' \u00a0 '];
const FRAMES = ['%', '%!', '"%"', 'Er sagte: %.', 'He wrote that % and went on.', 'Zum Beispiel %, so stand es da.'];

/** Every phrase in every casing, spacing and frame. */
const variants = (phrases: string[]): string[] => phrases.flatMap(phrase =>
  CASINGS.flatMap(casing =>
    SPACINGS.flatMap(spacing =>
      FRAMES.map(frame => frame.replace('%', casing(phrase).replace(/ /g, spacing))))));

export const VARIANT_TEXTS: string[] = variants([...CUT_PHRASES, ...PASS_PHRASES]);

/**
 * What each exclusion frees, written by hand: whole texts (the sentences above
 * with the verdict pair cut/pass, and lines from the use and mention sets) and
 * phrases whose casing, spacing and frame variants it frees too. Nothing here
 * is derived from a rule, so a rule that frees more than its exclusion names
 * fails the floor test.
 */
const NAMED_FREED: { about: string; texts: string[]; phrases: string[] }[] = [
  {
    about: 'white power structure',
    texts: [
      'Martin Luther King said the white power structure would not yield without pressure.',
      'White power structure, King called it.',
    ],
    phrases: ['the white power structure'],
  },
  { about: 'Holocaustleugnung', texts: [], phrases: ['Holocaustleugnung', 'Holocaustleugner'] },
  { about: 'white supremacy', texts: [], phrases: ['white supremac'] },
];

const NAMED_TEXTS = new Map<string, string>();
for (const { about, text, main, ours } of CONSTRUCTIONS) {
  if (main === 'cut' && ours === 'pass') NAMED_TEXTS.set(text, about);
}
for (const { about, texts, phrases } of NAMED_FREED) {
  for (const text of [...texts, ...variants(phrases)]) NAMED_TEXTS.set(text, about);
}

/** The exclusion that frees a text the old scanner cut, or null when none names it. */
export function freedBy(text: string): string | null {
  return NAMED_TEXTS.get(text) ?? null;
}

/** Pieces the split test stirs into long texts: the rule words, their continuations, filler. */
export const FRAGMENTS = [
  'Unter', 'mensch', 'lich', 'en', 'Untermenschlich', 'Untermenschen', 'Untermensch',
  'white', 'power', 'White Power', 'structure', 'the white power structure', 'white power structure',
  'supremac', 'y', 'ist', 'white supremacy', 'white supremac',
  'calling the ', 'calling the Holocaust a hoax', 'Holocaust', ' a hoax', ' is fake', 'Lüge', ' eine ',
  ' is a lie', 'I am calling the Holocaust a hoax.',
  'leugn', 'ung', 'er', 'Holocaustleugnung', 'Holocaustleugner', 'Holocaust leugnen',
  'Heil', 'Hitler', 'Heil Hitler', 'Sieg', 'Sieg Heil', 'Juden', 'vernichten', 'vergasen',
  'Jews', ' must be ', 'exterminated', 'Muslims', 'eradicate',
  'Rassenschande', 'Volksverräter', 'in', 'Volksverräterin',
  ' ', ' ', ' ', '  ', '\t', '\n', '\n\n', '. ', ', ', '! ', '?', '-', '"',
  ' und ', ' the ', ' of Atlanta', 'der ', 'die ', 'King', 'said', 'that', 'was', 'ist', 'nicht',
  'the river kept running past the old mill', 'und die Stadt schlief',
];
