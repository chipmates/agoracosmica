// The history replay dates each message in the app's language, not the
// browser's: a German app in an English browser reads "21.10.2026, 01:08:18".
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import HistoryMessage from '../../components/HistoryModal/HistoryMessage';
import { useDomainStore } from '../../stores/domainStore';
import { formatDateTime } from '../../utils/formatDateTime';

const STAMP = '2026-10-21T01:08:18';

function stampIn(appLanguage: 'en' | 'de'): string {
  useDomainStore.setState((s) => ({ language: { ...s.language, current: appLanguage } }));
  const view = render(
    <HistoryMessage
      entry={{ role: 'assistant', content: 'Die Tinte gefriert.', mode: 'free_conversation', timestamp: STAMP }}
      index={0}
      selectedFigureName="Mark Aurel"
      seekerLabel="Suchender"
      formatSummary={() => null}
    />,
  );
  return view.container.querySelector('.message-timestamp')?.textContent ?? '';
}

describe('history timestamps', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useDomainStore.setState((s) => ({ language: { ...s.language, current: 'en' } }));
  });

  it('reads German in a German app with an English browser', () => {
    expect(navigator.language.toLowerCase().startsWith('en')).toBe(true);
    expect(stampIn('de')).toBe(new Date(STAMP).toLocaleString('de'));
    expect(stampIn('de')).toMatch(/^21\.10\.2026, 01:08:18$/);
  });

  it('reads English in an English app with a German browser', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'de-DE' });
    expect(stampIn('en')).toBe(new Date(STAMP).toLocaleString('en'));
    expect(stampIn('en')).toMatch(/^10\/21\/2026, 1:08:18\sAM$/);
  });

  it('keeps the regional form of a browser in the same language', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'en-GB' });
    expect(formatDateTime(STAMP, 'en')).toBe(new Date(STAMP).toLocaleString('en-GB'));
    vi.stubGlobal('navigator', { ...navigator, language: 'de-AT' });
    expect(formatDateTime(STAMP, 'de')).toBe(new Date(STAMP).toLocaleString('de-AT'));
  });
});
