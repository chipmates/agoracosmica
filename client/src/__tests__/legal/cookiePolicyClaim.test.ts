// The cookie policy states a method, never an absolute "not tracked": the one
// exception (the ad click ID, kept only after a visitor's yes) is named on the
// same page. The app's German page and the public German page say the same.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import de from '../../assets/translations/ui-de.json';
import en from '../../assets/translations/ui-en.json';

const publicPage = readFileSync(resolve(process.cwd(), '../marketing/src/pages/cookie-policy.astro'), 'utf8');
const ABSOLUTE = /ohne verfolgt|nicht verfolgt|without being tracked|not tracked|never tracked|profiliert zu werden/i;

describe('the cookie policy\'s claim', () => {
  it('German: the house words, nothing absolute', () => {
    const text = de.legal.cookiePolicy.cookieFreeApproach.description;
    expect(text).toContain('Kurz gesagt: keine Tracking-Cookies, kein Profiling.');
    expect(text).not.toMatch(ABSOLUTE);
  });

  it('English: the house words, nothing absolute', () => {
    const text = en.legal.cookiePolicy.cookieFreeApproach.description;
    expect(text).toContain('In short: no tracking cookies, no profiling.');
    expect(text).not.toMatch(ABSOLUTE);
  });

  it('the public German page carries the same sentence', () => {
    expect(publicPage).toContain(de.legal.cookiePolicy.cookieFreeApproach.description);
    expect(publicPage).not.toMatch(ABSOLUTE);
  });
});
