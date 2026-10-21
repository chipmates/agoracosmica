// The German figure pages show each figure's period under the name. The line
// is built from the English voice profile, so a line with words in it needs
// its own German text, or English shows on the German page.
import { describe, it, expect } from 'vitest';
import { figuresCatalogDe, figuresCatalogEn } from '../../data/public/figuresCatalog';

const periodDe = (id: string) => figuresCatalogDe.find((f) => f.id === id)?.period ?? '';
const periodEn = (id: string) => figuresCatalogEn.find((f) => f.id === id)?.period ?? '';

// Dates, ranges and the German era marks; any word left over is not German.
const datesOnly = (line: string) =>
  line.replace(/\bca\. /g, '').replace(/ [vn]\. Chr\./g, '').replace(/[\d/-]/g, '').trim();

const WITH_WORDS: Record<string, string> = {
  laozi:
    'Späte Östliche Zhou-Zeit, etwa 6. bis 5. Jahrhundert v. Chr. (überlieferte Lebenszeit ca. 571 bis 471 v. Chr., seine Existenz ist umstritten)',
  gautama:
    'ca. 5. Jahrhundert v. Chr. (überlieferte Datierung: 563 bis 483 v. Chr., viele Fachleute datieren ihn heute später)',
  eckhart: 'ca. 1260-1327/28 (starb vor der Bulle von 1329, Sterbeort unsicher, oft wird Avignon genannt)',
};

describe('German period lines', () => {
  it('writes the three lines with words in German', () => {
    for (const [id, line] of Object.entries(WITH_WORDS)) {
      if (!periodEn(id)) continue; // a self-host build carries no periods
      expect(periodDe(id)).toBe(line);
    }
  });

  it('leaves no English word in any other German line', () => {
    for (const f of figuresCatalogDe) {
      if (f.id in WITH_WORDS) continue;
      expect({ id: f.id, rest: datesOnly(f.period) }).toEqual({ id: f.id, rest: '' });
    }
  });

  it('writes "ca." where the English line has "c."', () => {
    for (const f of figuresCatalogDe) {
      expect(f.period).not.toMatch(/\bc\./);
      if (/^c\. /.test(periodEn(f.id))) expect(f.period.startsWith('ca. ')).toBe(true);
    }
  });

  it('uses no long dash and no semicolon', () => {
    for (const f of figuresCatalogDe) expect(f.period).not.toMatch(/[–—;]/);
  });

  it('keeps the English lines in English', () => {
    for (const f of figuresCatalogEn) expect(f.period).not.toMatch(/\bca\. |[vn]\. Chr\.|Jahrhundert/);
  });
});
