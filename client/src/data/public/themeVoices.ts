// Curated voices per theme: the figures whose answers the theme's intro essay
// walks, listed in the order the essay presents them. The detail page renders
// one faced segment per voice, pairing this list with the essay's middle
// paragraphs. Hand-curated from the essays.
//
// Stances: where an essay closes with a recap line (meaning-purpose, who-am-i,
// mind-creativity, love-connection, faith-death-mystery) the stance is the
// essay's own word. For loss-grief, freedom-justice and moral-life the essay
// has no recap line, so those stances are drawn from the essay body and want
// a closer look. stanceDe values are drafts pending review, like all German.
// Remove this file when stripping marketing pages from a fork.

export interface ThemeVoice {
  /** Figure id, matches figuresCatalog and the image and route paths. */
  figureId: string;
  /** The essay's own short word for this voice's answer. */
  stance: string;
  /** German draft. */
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
    { figureId: 'king', stance: 'Moral imagination', stanceDe: 'Moralische Vorstellungskraft' },
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
    { figureId: 'gandhi', stance: 'Means as ends', stanceDe: 'Mittel als Zweck' },
    { figureId: 'king', stance: 'Bending the arc', stanceDe: 'Den Bogen biegen' },
    { figureId: 'plato', stance: 'Inner harmony', stanceDe: 'Innere Harmonie' },
    { figureId: 'gautama', stance: 'The Eightfold Path', stanceDe: 'Der Achtfache Pfad' },
  ],
};

export function getThemeVoices(themeId: string): ThemeVoice[] {
  return themeVoices[themeId] ?? [];
}
