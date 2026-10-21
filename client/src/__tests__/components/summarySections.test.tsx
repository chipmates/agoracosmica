// A summary header with an umlaut or an apostrophe is a section of its own, in
// the history plate and in the section toggles the modal sets up for it. So is
// one with a digit, `&`, `/` or brackets; a body line stays in its section.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SummaryContent from '../../components/HistoryModal/SummaryContent';
import { splitSummarySections } from '../../components/HistoryModal/summarySections';

const german = [
  'KERNLEHREN UND EINSICHTEN:',
  'Marc Aurel spricht über Geduld.',
  'Zentrale Metapher:',
  '"Was dem Bienenstock nicht nützt, nützt auch der Biene nicht."',
  'BEITRÄGE DES NUTZERS:',
  '- Fragte, ob Schweigen feige ist.',
  'OFFENE FÄDEN:',
  '- Wie spricht man es später an?',
  'GENUTZTE MODI:',
  'Freies Gespräch.',
].join('\n');

const english = [
  'KEY TEACHINGS AND INSIGHTS:',
  'Marcus Aurelius speaks about patience.',
  "THE SEEKER'S CONTRIBUTIONS:",
  '- Asked whether silence is cowardly.',
  'WHAT’S STILL OPEN:',
  '- How to raise it later.',
  'FOLLOW-UP QUESTIONS:',
  '- What would a Stoic say next?',
].join('\n');

const titles = (content: string) => {
  const { container, unmount } = render(
    <SummaryContent content={content} selectedSeedId="freetalk" expandedSections={{}} toggleSection={() => {}} summaryTitleLabel="Summary" />,
  );
  const found = [...container.querySelectorAll('.section-title')].map((el) => el.textContent);
  unmount();
  return found;
};

describe('summary sections', () => {
  it('splits German headers with umlauts', () => {
    expect(titles(german)).toEqual(['KERNLEHREN UND EINSICHTEN', 'BEITRÄGE DES NUTZERS', 'OFFENE FÄDEN', 'GENUTZTE MODI']);
  });

  it('splits English headers with either apostrophe and a hyphen', () => {
    expect(titles(english)).toEqual(['KEY TEACHINGS AND INSIGHTS', "THE SEEKER'S CONTRIBUTIONS", 'WHAT’S STILL OPEN', 'FOLLOW-UP QUESTIONS']);
  });

  it('keeps sub-titles, quotes and sentences inside their section', () => {
    const [first] = splitSummarySections(german);
    expect(first).toContain('Zentrale Metapher:');
    expect(first).toContain('nützt auch der Biene nicht."');
    render(
      <SummaryContent content={german} selectedSeedId="1" expandedSections={{ 'section-1-0': true }} toggleSection={() => {}} summaryTitleLabel="Summary" />,
    );
    expect(screen.getByText('Zentrale Metapher:').className).toBe('summary-subsection-title');
  });

  it('gives the modal one toggle per shown section', () => {
    expect(splitSummarySections(german)).toHaveLength(titles(german).length);
    expect(splitSummarySections(english)).toHaveLength(titles(english).length);
  });
  it('splits headers with a digit, an ampersand, a slash or brackets', () => {
    const content = [
      '3 KERNLEHREN:',
      'Marc Aurel spricht über Geduld.',
      'LEHREN & EINSICHTEN:',
      '- Geduld ist eine Wahl.',
      'FRAGEN / ANTWORTEN:',
      '- Ist Schweigen feige?',
      'OFFENE FÄDEN (FÜR SPÄTER):',
      '- Wie spricht man es an?',
      '[KEY TEACHINGS]:',
      '- Patience is a choice.',
      '1. FOLLOW-UP QUESTIONS:',
      '- What next?',
    ].join('\n');
    expect(titles(content)).toEqual([
      '3 KERNLEHREN',
      'LEHREN & EINSICHTEN',
      'FRAGEN / ANTWORTEN',
      'OFFENE FÄDEN (FÜR SPÄTER)',
      '[KEY TEACHINGS]',
      '1. FOLLOW-UP QUESTIONS',
    ]);
    expect(splitSummarySections(content)).toHaveLength(6);
  });

  it('keeps body lines in their section, however they look', () => {
    const body = [
      'Zentrale Metapher:',
      '- WICHTIG:',
      '* AMOR FATI:',
      '"CARPE DIEM:"',
      'WICHTIG: Marc Aurel nennt das Pflicht.',
      'SCHRITT 1: ZIELE:',
      '1914:',
      'A:',
      'Er sagte: TUGEND:',
      'AMOR FATI.',
    ];
    const content = ['KERNLEHREN UND EINSICHTEN:', ...body, 'OFFENE FÄDEN:', '- Später.'].join('\n');
    const sections = splitSummarySections(content);
    expect(sections).toHaveLength(2);
    for (const line of body) expect(sections[0]).toContain(line);
    expect(titles(content)).toEqual(['KERNLEHREN UND EINSICHTEN', 'OFFENE FÄDEN']);
  });

  it('takes a header with spaces after its colon or a Windows line end', () => {
    const content = 'KERNLEHREN:  \r\nGeduld.\r\nOFFENE FÄDEN: \r\n- Später.';
    expect(splitSummarySections(content)).toHaveLength(2);
  });
});
