// How a story's year, place and age show on the page: display rules over the facts' own fields, which stay as
// they are. Build time only (the contents, the hero, the map); nothing here ships to the browser.
import type { PlayerLang } from './strings';

// Advances in px, measured in both engines (letter-spacing in): the year column's small line (the UI face at
// 11 px) and its large year (the text face at 24 px, lining figures).
const SMALL: Record<string, number> = {
  '0': 7.27, '1': 4.82, '2': 6.85, '3': 6.87, '4': 7.09, '5': 6.81, '6': 6.96, '7': 6.42, '8': 7.07, '9': 6.96,
  a: 6.55, b: 7.3, c: 6.8, d: 7.3, e: 6.73, f: 3.83, g: 7.29, h: 6.97, i: 2.91, j: 2.93, k: 6.14, l: 2.91, m: 9.68,
  n: 6.97, o: 7.02, p: 7.3, q: 7.3, r: 4.37, s: 6.02, t: 3.84, u: 6.96, v: 6.16, w: 9.03, x: 6.75, y: 6.96, z: 5.95,
  'ä': 6.55, 'ö': 7.02, 'ü': 6.96, 'ß': 7.12, A: 7.15, B: 7.49, C: 7.28, D: 7.26, E: 6.42, F: 6.16, G: 7.48, H: 7.44,
  I: 2.91, J: 6.49, K: 6.93, L: 6.22, M: 9.74, N: 7.52, O: 7.58, P: 6.83, Q: 7.58, R: 7.17, S: 6.97, T: 6.69, U: 7.55,
  V: 7.03, W: 9.85, X: 7.23, Y: 6.93, Z: 6.57, 'Ä': 7.15, 'Ö': 7.58, 'Ü': 7.55, ' ': 3.05, '.': 3, ',': 2.99,
  '-': 5.22, '/': 4.29, '+': 7.04, '(': 4.39, ')': 4.36,
};
const BIG: Record<string, number> = {
  '0': 15.36, '1': 10.08, '2': 13.9, '3': 13.3, '4': 13.97, '5': 13.13, '6': 14.16, '7': 11.83, '8': 14.28, '9': 14.19,
  e: 13.44, r: 9.96, s: 10.44,
};
// The column is 54 px on a phone; a line keeps a px clear on each side.
const COLUMN = 52;
const smallWidth = (s: string) => [...s].reduce((w, ch) => w + (SMALL[ch] ?? 7.6), 0);
const bigWidth = (s: string, decade: boolean) => [...s].reduce((w, ch) => w + (BIG[ch] ?? 14), 0) * (decade ? 0.7 : 1);

const MONTHS: Record<PlayerLang, [string, string][]> = {
  de: [['Januar', 'Jan.'], ['Februar', 'Feb.'], ['April', 'Apr.'], ['August', 'Aug.'], ['September', 'Sept.'],
    ['Oktober', 'Okt.'], ['November', 'Nov.'], ['Dezember', 'Dez.']],
  en: [['January', 'Jan.'], ['February', 'Feb.'], ['March', 'Mar.'], ['April', 'Apr.'], ['August', 'Aug.'],
    ['September', 'Sept.'], ['October', 'Oct.'], ['November', 'Nov.'], ['December', 'Dec.']],
};
const shortMonths = (s: string, lang: PlayerLang) =>
  MONTHS[lang].reduce((t, [full, short]) => t.replace(new RegExp(`\\b${full}\\b`, 'g'), short), s);
const hasMonth = (s: string, lang: PlayerLang) => MONTHS[lang].some(([full]) => new RegExp(`\\b${full}\\b`).test(s));

export interface YearSet {
  /** The small line over the year ("um", "Herbst", "17. Dez."). */
  pre: string;
  /** The year or the decade, large; empty where the field holds no year. */
  main: string;
  /** The small line under it ("bis 1779", "v. Chr."). */
  post: string;
  decade: boolean;
  /** The large figure is wider than the column at its size: set a little tighter. */
  tight: boolean;
  /** What the column cannot hold, at the front of the row's line ("Spätfrühling", "einige Berichte 1934-35"). */
  lead: string;
  /** A month's name stood in a line too wide for the column. */
  monthTooWide: boolean;
}

const ERA = /\s+(v\. Chr\.|n\. Chr\.|BCE|BC|AD|CE)$/;

/**
 * A year field as the column sets it: the first year large, the words before it on a small line above, a span's end
 * or the era on a small line below; a line too wide for the column moves to the row's line, a remark in brackets
 * too. `short` sets the months short (a page sets all its months short once one of them does not fit).
 */
export function yearSet(year: string, lang: PlayerLang, short = false): YearSet {
  const de = lang === 'de';
  const to = (t: string) => (de ? `bis\u00a0${t}` : `to\u00a0${t}`);
  let s = year.replace(/–/g, '-').trim();
  let remark = '';
  const br = s.match(/^(.*?)\s*\(([^()]*)\)$/);
  if (br) { s = br[1]!.trim(); remark = br[2]!.replace(/;\s*/g, ', '); }
  let era = '';
  const em = s.match(ERA);
  if (em) { era = em[1]!; s = s.slice(0, em.index).trim(); }
  const m = s.match(/(?<!\d)(\d{3,4})(er|s)?(?!\d)/);
  if (!m) {
    return { pre: '', main: '', post: '', decade: false, tight: false, lead: year.replace(/;\s*/g, ', '), monthTooWide: false };
  }
  const main = m[1]! + (m[2] ?? '');
  const decade = !!m[2];
  let pre = s.slice(0, m.index).trim().replace(/[,-]$/, '').trim();
  let rest = s.slice(m.index! + m[0].length).trim();
  let post = '';
  if (pre === '~' || pre === '') pre = pre === '~' ? (de ? 'um' : 'c.') : '';
  else if (/^~/.test(pre)) pre = `${de ? 'um' : 'c.'} ${pre.slice(1).trim()}`;
  if (rest === '+') { pre = pre || (de ? 'ab' : 'from'); rest = ''; }
  const span = rest.match(/^-\s*(\d{2,4})(er|s)?$/);
  const slash = rest.match(/^\/(\d{2,4})$/);
  const second = rest.match(/^[-,]\s*(.+)$/);
  // a short end year takes the first year's century ("1903-04" ends in 1904)
  const full = (y: string) => (y.length < 4 && m[1]!.length === 4 ? m[1]!.slice(0, 4 - y.length) + y : y);
  if (span) post = to(full(span[1]!) + (span[2] ?? ''));
  else if (slash) post = slash[1]!.length < 4 ? to(full(slash[1]!)) : `${de ? 'oder' : 'or'} ${slash[1]}`;
  else if (second) post = to(second[1]!);
  else post = rest;
  if (era) post = post ? `${post} ${era}` : era;
  if (short) { pre = shortMonths(pre, lang); post = shortMonths(post, lang); }
  const lead: string[] = [];
  let monthTooWide = false;
  if (pre && smallWidth(pre) > COLUMN) { monthTooWide ||= hasMonth(pre, lang); lead.push(pre); pre = ''; }
  if (post && smallWidth(post) > COLUMN) { monthTooWide ||= hasMonth(post, lang); lead.push(post); post = ''; }
  if (remark) lead.push(remark);
  return { pre, main, post, decade, tight: bigWidth(main, decade) > COLUMN + 1, lead: lead.join(' '), monthTooWide };
}

/** The year as a number for the life's order, a year before Christ below zero; NaN where there is none. */
export function yearValue(year: string | undefined): number {
  const y = (year ?? '').match(/(?<!\d)(\d{3,4})(?!\d)/);
  if (!y) return NaN;
  return /v\. Chr\.|\bBCE?\b/.test(year ?? '') ? -Number(y[1]) : Number(y[1]);
}

/** A place with a remark in brackets reads as a list: "Vindobona (Wien)" becomes "Vindobona, Wien". */
export function placeShown(place: string): string {
  if (place.includes('/') || !/\([^()]*\)/.test(place)) return place;
  return place.replace(/\s*\(([^()]*)\)/g, ', $1').replace(/,\s*,/g, ',');
}

/** The hero's years: the period without a note in brackets after it (the note stays in the catalog). */
export function periodShown(period: string): string {
  return period.replace(/\s*\([^()]*\)$/, '').trim();
}

/** Whether a period's birth year is approximate ("ca. 1260-1327", "c. 5th century BCE", "Späte ..."). */
export function approxBirth(period: string): boolean {
  return /^(ca\.|c\.|~|um |etwa |about |roughly |late |späte )/i.test(period.trim()) || /Jahrhundert|century/i.test(period);
}

/**
 * An age as an age: "59+" from 59, "80er" in the decade, "Kind" as a child, "etwa" where the birth year is
 * approximate; a phrase without a number as it is.
 */
export function ageShown(age: string, lang: PlayerLang, she: boolean, roughBirth = false): string {
  const de = lang === 'de';
  let a = age.replace(/–/g, '-').trim();
  const approx = roughBirth || /^(~|etwa |about |ca\. |c\. )/.test(a);
  a = a.replace(/^(~\s*|etwa |about |ca\. |c\. )/, '');
  if (/^\d{1,3}(-\d{1,3})?$/.test(a)) return de ? `mit ${approx ? 'etwa ' : ''}${a} Jahren` : `age ${approx ? 'about ' : ''}${a}`;
  const from = a.match(/^(\d{1,3})\+$/);
  if (from) return de ? `ab ${from[1]} Jahren` : `from age ${from[1]}`;
  const dec = a.match(/^(\d)0(er|s)$/);
  if (dec) return de ? `${approx ? 'etwa ' : ''}in ${she ? 'ihren' : 'seinen'} ${dec[1]}0ern` : `${approx ? 'roughly ' : ''}in ${she ? 'her' : 'his'} ${dec[1]}0s`;
  if (de && /^(Anfang|Mitte|Ende) \d0$/.test(a)) return `mit ${a}`;
  const part = a.match(/^(early|mid|late) (\d)0s$/i);
  if (!de && part) return `in ${she ? 'her' : 'his'} ${part[1]!.toLowerCase()} ${part[2]}0s`;
  if (/^(Kind|child)$/i.test(a)) return de ? 'als Kind' : 'as a child';
  return age;
}

/** An age's lower or upper bound as a number for the contents' lead ("etwa 8"), or '' where it has none. */
export function ageBound(age: string | undefined, lang: PlayerLang, end: 'first' | 'last', roughBirth = false): string {
  const a = (age ?? '').replace(/–/g, '-').trim();
  const approx = roughBirth || /^(~|etwa |about )/.test(a);
  const core = a.replace(/^(~\s*|etwa |about )/, '');
  const m = core.match(/^(\d{1,3})(?:-(\d{1,3}))?$/);
  if (!m) return '';
  const n = end === 'first' || !m[2] ? m[1]! : m[2];
  return approx ? `${lang === 'de' ? 'etwa' : 'about'} ${n}` : n;
}

/** A text in parts, each range of numbers ("1934-35", "121-180", "2.-3.") a part that never breaks. */
export function keepRanges(text: string): { text: string; keep: boolean }[] {
  const out: { text: string; keep: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(/\S*\d[-–]\d\S*/g)) {
    if (m.index! > at) out.push({ text: text.slice(at, m.index), keep: false });
    out.push({ text: m[0], keep: true });
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), keep: false });
  return out;
}
