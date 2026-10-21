// The terms' version and date are typed in one file. The consent gate, the
// app's terms page and both public terms pages read them from there.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import terms from '../../utils/public/termsVersion.json';
import { formatTermsDate, termsVersionLine } from '../../utils/public/termsVersion';
import { CURRENT_AGB_VERSION } from '../../utils/userState';

const REPO = join(__dirname, '..', '..', '..', '..');
const TERMS_PAGES = [
  'client/src/pages/NutzungsbedingungenPage.tsx',
  'marketing/src/pages/terms.astro',
  'marketing/src/pages/nutzungsbedingungen.astro',
];

describe('terms version', () => {
  it('stamps the consent record with the version from the terms file', () => {
    expect(CURRENT_AGB_VERSION).toBe(terms.version);
  });

  it('formats the date the way each language writes it', () => {
    expect(formatTermsDate('de', '2026-04-27')).toBe('27. April 2026');
    expect(formatTermsDate('en', '2026-04-27')).toBe('April 27, 2026');
    expect(formatTermsDate('de', '2026-11-01')).toBe('1. November 2026');
  });

  it('builds the header line from the version and the date', () => {
    expect(termsVersionLine('de')).toBe(`Version ${terms.version} · Stand: ${formatTermsDate('de')}`);
    expect(termsVersionLine('en')).toBe(`Version ${terms.version} · Last updated: ${formatTermsDate('en')}`);
  });

  it.each(TERMS_PAGES)('%s types no version number of its own', (rel) => {
    const source = readFileSync(join(REPO, rel), 'utf8');
    expect(source).not.toMatch(/Version \d+\.\d+\.\d+/);
    expect(source).toMatch(/termsVersionLine\(/);
  });
});
