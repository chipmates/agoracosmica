// "Show in the text" from the saved sheet: the reader scrolls there once its text is in. A module of its own, so the
// sheets reach the reader without loading it.

let pending: { n: number; si: number } | null = null;

export function focusSentence(n: number, si: number): void {
  pending = { n, si };
}

/** The sentence waiting to be shown in story n, once; null when none waits. */
export function takeFocus(n: number): number | null {
  if (!pending || pending.n !== n) return null;
  const si = pending.si;
  pending = null;
  return si;
}
