// The verdict word for a week's count against the week before.
//
// Under eight weeks of history: the exact two-sided test of two counts. If the
// rate did not change, this week's count a, given the total a + b, is binomial
// with p = 1/2; a change is called at 5%. From eight weeks on: a process band
// (an XmR chart): the mean of the last eight weeks, plus and minus 2.66 times
// their mean moving range. Both assume the weeks differ by chance alone, and
// our days swing more than that, so "up" or "down" means beyond chance, not
// proven.
//
// This file imports nothing and uses only erasable syntax, so scripts outside
// the Worker can load it as plain JavaScript.

export type VerdictWord = 'up' | 'down' | 'within noise' | 'too few to call' | 'no verdict';

export interface Verdict {
  word: VerdictWord;
  test: 'two counts' | 'process band' | 'none';
  // The two-sided p of the two-count test.
  p?: number;
  band?: { mean: number; low: number; high: number };
  why?: string;
}

export const ALPHA = 0.05;
// Below this many in both weeks together no call is made.
export const FLOOR = 20;
export const BAND_WEEKS = 8;
const XMR = 2.66;

// P(X <= k) for X binomial(n, 1/2), summed in log space so large n cannot underflow.
function lowerTail(k: number, n: number): number {
  if (k < 0) return 0;
  if (k >= n) return 1;
  const logs: number[] = [];
  let lp = -n * Math.LN2;
  for (let i = 0; i <= k; i++) {
    logs.push(lp);
    lp += Math.log(n - i) - Math.log(i + 1);
  }
  const top = Math.max(...logs);
  let sum = 0;
  for (const l of logs) sum += Math.exp(l - top);
  return Math.min(1, Math.exp(top) * sum);
}

// The exact two-sided p for two counts under one rate. With p = 1/2 the
// distribution is symmetric, so twice the smaller tail is exact.
export function twoCountP(a: number, b: number): number {
  const n = a + b;
  if (n === 0) return 1;
  return Math.min(1, 2 * lowerTail(Math.min(a, b), n));
}

export interface WeekInput {
  a: number;
  b: number;
  // Counted days in each week (7 for a whole week); a week before with fewer gets no verdict.
  daysA?: number;
  daysB?: number;
  // Whole weeks before this one, oldest first; the last is b.
  history?: number[];
}

export function verdict(input: WeekInput): Verdict {
  const { a, b } = input;
  if (![a, b].every((x) => Number.isInteger(x) && x >= 0)) throw new Error('counts must be whole numbers');
  const daysA = input.daysA ?? 7;
  const daysB = input.daysB ?? 7;
  if (daysB < daysA) return { word: 'no verdict', test: 'none', why: 'the week before had ' + daysB + ' counted days' };
  if (a + b < FLOOR) return { word: 'too few to call', test: 'none', why: 'fewer than ' + FLOOR + ' in both weeks together' };
  const history = input.history || [];
  if (history.length >= BAND_WEEKS) {
    const last = history.slice(-BAND_WEEKS);
    const mean = last.reduce((s, x) => s + x, 0) / last.length;
    let moving = 0;
    for (let i = 1; i < last.length; i++) moving += Math.abs(last[i] - last[i - 1]);
    const spread = XMR * (moving / (last.length - 1));
    const band = { mean, low: Math.max(0, mean - spread), high: mean + spread };
    const word: VerdictWord = a > band.high ? 'up' : a < band.low ? 'down' : 'within noise';
    return { word, test: 'process band', band };
  }
  const p = twoCountP(a, b);
  const word: VerdictWord = p >= ALPHA ? 'within noise' : a > b ? 'up' : 'down';
  return { word, test: 'two counts', p };
}
