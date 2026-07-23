// EN/DE translation key parity net. A key present in one language and missing
// in the other renders the tString English fallback silently, which is how
// English leaks into the German UI. The baseline below freezes today's known
// gaps: this test fails on any NEW gap, and the baseline may only ever shrink.
import { describe, it, expect } from 'vitest';
import uiEn from '../../assets/translations/ui-en.json';
import uiDe from '../../assets/translations/ui-de.json';
import seedsEn from '../../assets/translations/seedsdata/ui-en.json';
import seedsDe from '../../assets/translations/seedsdata/ui-de.json';

const BASELINE = {
  ui: {
    missingInDe: ['common.welcome', 'common.help', 'quickLinks.freeConversation', 'quickLinks.freetalk'],
    missingInEn: [
      'messages.voiceInputToggle',
      'messages.textInputToggle',
      'messages.pressToSpeak',
      'messages.releaseToSend',
      'messages.spaceToRecord',
      'messages.clickToRecord',
    ],
  },
  seedsdata: { missingInDe: [] as string[], missingInEn: [] as string[] },
};

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return [prefix.slice(0, -1)];
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

function gaps(en: unknown, de: unknown) {
  const enKeys = new Set(flatKeys(en));
  const deKeys = new Set(flatKeys(de));
  return {
    missingInDe: [...enKeys].filter((k) => !deKeys.has(k)).sort(),
    missingInEn: [...deKeys].filter((k) => !enKeys.has(k)).sort(),
  };
}

describe('translation key parity (EN/DE)', () => {
  it.each([
    ['ui', uiEn, uiDe, BASELINE.ui],
    ['seedsdata', seedsEn, seedsDe, BASELINE.seedsdata],
  ] as const)('%s: no gaps beyond the frozen baseline', (_name, en, de, baseline) => {
    const g = gaps(en, de);
    const newInDe = g.missingInDe.filter((k) => !baseline.missingInDe.includes(k));
    const newInEn = g.missingInEn.filter((k) => !baseline.missingInEn.includes(k));
    expect(newInDe, 'new keys missing in DE (would render English in the German UI)').toEqual([]);
    expect(newInEn, 'new keys missing in EN').toEqual([]);
  });

  it.each([
    ['ui', uiEn, uiDe, BASELINE.ui],
    ['seedsdata', seedsEn, seedsDe, BASELINE.seedsdata],
  ] as const)('%s: baseline entries that got fixed are removed from the baseline', (_name, en, de, baseline) => {
    const g = gaps(en, de);
    const staleDe = baseline.missingInDe.filter((k) => !g.missingInDe.includes(k));
    const staleEn = baseline.missingInEn.filter((k) => !g.missingInEn.includes(k));
    expect(staleDe, 'fixed keys still listed in the DE baseline — shrink it').toEqual([]);
    expect(staleEn, 'fixed keys still listed in the EN baseline — shrink it').toEqual([]);
  });
});
