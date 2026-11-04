// Which text of a story the player plays: a label on the content, never on the
// listener. 'lu2' for a story whose text was rewritten in the second level-up
// pass, 'orig' for every other, the introduction included. A unit whose new
// text goes live is added here in the same deploy, or its rows read 'orig'.

export type TextVersion = 'orig' | 'lu2';

// Live LU2 texts by figure and story number, in both languages.
const LU2: Readonly<Record<string, readonly number[]>> = {
  aurelius: [1, 2, 3, 4],
  campbell: [1],
  gautama: [1],
  jung: [1],
  kahlo: [1],
  laozi: [1, 2],
  nietzsche: [1, 2],
  rumi: [1],
  vinci: [1],
};

/** The version of a figure's story `n` (0 the introduction). */
export function textVersion(figureId: string, n: number): TextVersion {
  return (LU2[figureId] ?? []).includes(n) ? 'lu2' : 'orig';
}
