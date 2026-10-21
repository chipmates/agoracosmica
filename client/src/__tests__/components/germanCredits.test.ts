// German pages print a picture's credit with a German date and rights token,
// as the German figure pages print their period lines ("ca." for "c.").
// Names and titles stay as the holding institution records them.
import { describe, it, expect } from 'vitest';
import { creditLineOf, shortRights, germanCreditDate } from '../../components/CosmicCouncil/plates/rights';
import { OIL_RECORDS } from '../../components/CosmicCouncil/oils/records';
import { PLATE_CREDITS } from '../../components/CosmicCouncil/plates/credits';

const ENGLISH = /\bc\.(?=\s*\d)|\bcentury\b|\bpublished\b|\bn\.d\.|\bdynasty\b|\bPublic domain\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;

const oilLine = (id: string, lang?: string) => {
  const oil = OIL_RECORDS[id];
  return creditLineOf({ institution: oil.institution, title: oil.title, artist: oil.artist, date: oil.year, rights: oil.rights }, lang);
};

describe('German picture credits', () => {
  it('prints the theme page credit in German', () => {
    expect(oilLine('meaning-purpose/lead', 'de')).toBe(
      'Museo del Prado, Madrid · Sisyphus · Tiziano Vecellio (Titian), ca.\u00A01548-49 · Gemeinfrei (PD-Art)',
    );
  });

  it('keeps the English credit as it was', () => {
    expect(oilLine('meaning-purpose/lead')).toBe(
      'Museo del Prado, Madrid · Sisyphus · Tiziano Vecellio (Titian), c. 1548-49 · Public domain (PD-Art)',
    );
    expect(oilLine('meaning-purpose/lead', 'en')).toBe(oilLine('meaning-purpose/lead'));
  });

  it('leaves no English date word or rights token in any German oil credit, and names and titles as recorded', () => {
    for (const [id, oil] of Object.entries(OIL_RECORDS)) {
      const line = oilLine(id, 'de');
      expect(germanCreditDate(oil.year), id).not.toMatch(ENGLISH);
      expect(line.split(' · ').pop(), id).not.toMatch(ENGLISH);
      expect(line.startsWith(`${oil.institution} · ${oil.title} · ${oil.artist}, `), id).toBe(true);
    }
  });

  it('leaves no English date word or rights token in any German engraving credit', () => {
    for (const [id, credit] of Object.entries(PLATE_CREDITS)) {
      const line = creditLineOf(
        { institution: credit.institution, title: credit.title, artist: credit.artist, date: credit.date, rights: shortRights(credit.rights) },
        'de',
      );
      expect(germanCreditDate(credit.date ?? ''), id).not.toMatch(ENGLISH);
      expect(line.split(' · ').pop(), id).not.toMatch(/Public domain/);
    }
  });

  it('writes centuries, undated works and months the German way', () => {
    expect(germanCreditDate('16th century')).toBe('16. Jahrhundert');
    expect(germanCreditDate('mid-16th century')).toBe('Mitte des 16. Jahrhunderts');
    expect(germanCreditDate('n.d. (late 15th century)')).toBe('o. J. (spätes 15. Jahrhundert)');
    expect(germanCreditDate('ca. 1526, published 1538')).toBe('ca.\u00A01526, veröffentlicht 1538');
    expect(germanCreditDate('c. 1618 - c. 1622')).toBe('ca.\u00A01618 - ca.\u00A01622');
    expect(germanCreditDate('February 1890')).toBe('Februar 1890');
    expect(germanCreditDate('Qing dynasty')).toBe('Qing-Dynastie');
  });
});
