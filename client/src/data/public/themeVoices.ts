// Curated voices per theme: the figures whose answers the theme's intro essay
// walks, listed in the order the essay presents them. The detail page renders
// one faced segment per voice, pairing this list with the essay's middle
// paragraphs. Hand-curated from the essays.
//
// Stances are the essay's own short word for each answer, so a change here
// needs the matching essay paragraph and recap line to change with it.
//
// German is not a translation of this list. Three themes are written for
// German readers and walk a different cast, so they carry their own entries in
// themeVoicesDe; the other five reuse this list and read stanceDe. Voice
// counts per theme match across languages, because the page titles count them.
// Remove this file when stripping marketing pages from a fork.

export interface ThemeVoice {
  /** Figure id, matches figuresCatalog and the image and route paths. */
  figureId: string;
  /** The essay's own short word for this voice's answer. */
  stance: string;
  /** The German essay's own short word. */
  stanceDe: string;
}

export const themeVoices: Record<string, ThemeVoice[]> = {
  'meaning-purpose': [
    { figureId: 'aurelius', stance: 'Stoic clarity', stanceDe: 'Stoische Klarheit' },
    { figureId: 'gautama', stance: 'Buddhist release', stanceDe: 'Buddhistische Befreiung' },
    { figureId: 'campbell', stance: 'Mythic narrative', stanceDe: 'Mythische Erzählung' },
    { figureId: 'rumi', stance: 'Mystical longing', stanceDe: 'Mystische Sehnsucht' },
  ],
  'loss-grief': [
    { figureId: 'mandela', stance: 'Reconciliation', stanceDe: 'Versöhnung' },
    { figureId: 'king', stance: 'Moral imagination', stanceDe: 'Trauer als Antrieb' },
    { figureId: 'jung', stance: 'Integration', stanceDe: 'Integration' },
    { figureId: 'eckhart', stance: 'Detachment', stanceDe: 'Gelassenheit' },
  ],
  'who-am-i': [
    { figureId: 'beauvoir', stance: 'Becoming', stanceDe: 'Werden' },
    { figureId: 'jung', stance: 'Integrating', stanceDe: 'Integrieren' },
    { figureId: 'kahlo', stance: 'Painting', stanceDe: 'Malen' },
    { figureId: 'woolf', stance: 'Observing', stanceDe: 'Beobachten' },
  ],
  'mind-creativity': [
    { figureId: 'einstein', stance: 'Imagination', stanceDe: 'Vorstellungskraft' },
    { figureId: 'vinci', stance: 'Observation', stanceDe: 'Beobachtung' },
    { figureId: 'mozart', stance: 'Play', stanceDe: 'Spiel' },
    { figureId: 'woolf', stance: 'Attention', stanceDe: 'Aufmerksamkeit' },
    { figureId: 'blake', stance: 'Vision', stanceDe: 'Vision' },
  ],
  'love-connection': [
    { figureId: 'rumi', stance: 'Yearning', stanceDe: 'Sehnsucht' },
    { figureId: 'austen', stance: 'Perception', stanceDe: 'Wahrnehmung' },
    { figureId: 'eckhart', stance: 'Mutuality', stanceDe: 'Gegenseitigkeit' },
    { figureId: 'bingen', stance: 'Vitality', stanceDe: 'Lebenskraft' },
  ],
  'freedom-justice': [
    { figureId: 'mandela', stance: 'Two freedoms', stanceDe: 'Zwei Freiheiten' },
    { figureId: 'king', stance: 'Love as strategy', stanceDe: 'Liebe als Strategie' },
    { figureId: 'gandhi', stance: 'Truth-force', stanceDe: 'Wahrheitskraft' },
    { figureId: 'tubman', stance: 'Freedom for others', stanceDe: 'Freiheit für andere' },
    { figureId: 'beauvoir', stance: 'Freedom as practice', stanceDe: 'Freiheit als Praxis' },
  ],
  'faith-death-mystery': [
    { figureId: 'aurelius', stance: 'Stoic clarity', stanceDe: 'Stoische Klarheit' },
    { figureId: 'gautama', stance: 'Buddhist insight', stanceDe: 'Buddhistische Einsicht' },
    { figureId: 'laozi', stance: 'Taoist flow', stanceDe: 'Taoistischer Fluss' },
    { figureId: 'bingen', stance: 'Visionary witness', stanceDe: 'Visionäres Zeugnis' },
    { figureId: 'eckhart', stance: 'Mystical union', stanceDe: 'Mystische Einung' },
  ],
  'moral-life': [
    { figureId: 'aurelius', stance: 'The four virtues', stanceDe: 'Die vier Tugenden' },
    { figureId: 'gandhi', stance: 'Means as ends', stanceDe: 'Die Mittel zählen' },
    { figureId: 'king', stance: 'Bending the arc', stanceDe: 'Niemand ist neutral' },
    { figureId: 'plato', stance: 'Inner harmony', stanceDe: 'Innere Harmonie' },
    { figureId: 'gautama', stance: 'The Eightfold Path', stanceDe: 'Der Achtfache Pfad' },
  ],
};

// The German cast for the three themes written for German readers. Each voice
// is a figure the theme's own debates already cast, and each answer is drawn
// from that figure's German seed material, so the walk changes without any
// claim changing. The voices these replace stay reachable through the debate
// rail on the same page. `stance` is carried for type parity and is not
// rendered on a German page.
export const themeVoicesDe: Record<string, ThemeVoice[]> = {
  'meaning-purpose': [
    { figureId: 'nietzsche', stance: 'Make your own', stanceDe: 'Sinn selbst machen' },
    { figureId: 'schopenhauer', stance: 'Want less', stanceDe: 'Weniger wollen' },
    { figureId: 'goethe', stance: 'Keep striving', stanceDe: 'Weiter streben' },
    { figureId: 'aurelius', stance: 'Do right today', stanceDe: 'Heute richtig handeln' },
  ],
  'faith-death-mystery': [
    { figureId: 'aurelius', stance: 'Death as teacher', stanceDe: 'Der Tod als Lehrer' },
    { figureId: 'gautama', stance: 'What dies', stanceDe: 'Was da stirbt' },
    { figureId: 'nietzsche', stance: 'No afterlife', stanceDe: 'Ohne Jenseits leben' },
    { figureId: 'bingen', stance: 'The living light', stanceDe: 'Das lebendige Licht' },
    { figureId: 'eckhart', stance: 'No boundary', stanceDe: 'Keine Grenze' },
  ],
  'love-connection': [
    { figureId: 'rumi', stance: 'Yearning', stanceDe: 'Sehnsucht' },
    { figureId: 'austen', stance: 'Clear sight', stanceDe: 'Klarer Blick' },
    { figureId: 'schopenhauer', stance: 'The wall falls', stanceDe: 'Die Wand fällt' },
    { figureId: 'eckhart', stance: 'Nothing between', stanceDe: 'Kein Dazwischen' },
  ],
};

export function getThemeVoices(themeId: string, lang: 'en' | 'de' = 'en'): ThemeVoice[] {
  if (lang === 'de') return themeVoicesDe[themeId] ?? themeVoices[themeId] ?? [];
  return themeVoices[themeId] ?? [];
}
