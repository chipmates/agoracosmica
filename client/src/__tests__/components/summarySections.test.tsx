// A summary header with an umlaut or an apostrophe is a section of its own, in
// the history plate and in the section toggles the modal sets up for it.
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
});
