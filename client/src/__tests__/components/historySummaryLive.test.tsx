// A summary of the conversation that is still open in the app shows in the
// history and stays there. The modal mirrors the live conversation into its
// list; it must not lay the chat back over a summary the visitor just made.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../hooks/useTranslation', () => {
  const t = (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key);
  const api = { t, tString: t, tNode: t, tArray: () => [] };
  return { default: () => api, useTranslation: () => api };
});
vi.mock('../../hooks/useSeedTranslation', () => ({ default: () => ({ getTranslatedSeedTitle: () => null }) }));
vi.mock('../../hooks/useHapticFeedback', () => ({ useHapticFeedback: () => ({ triggerHaptic: () => {} }) }));
vi.mock('../../stores/uiStore', () => ({
  useUIStore: (pick: (s: unknown) => unknown) => pick({ shouldShowHelp: () => false, dismissHelp: () => {} }),
}));
vi.mock('../../services/SummaryService', () => ({
  default: { generateSummary: vi.fn(async () => ({ content: 'KERNEINSICHTEN:\nGeduld.', metadata: { figureId: 'aurelius', seedId: 'freetalk' } })) },
}));

const LIVE = [
  { role: 'assistant', content: 'Sei gegrüßt. Worüber möchtest du sprechen?', timestamp: '2026-10-21T05:40:00.000Z' },
  { role: 'user', content: 'War mein Schweigen feige?', timestamp: '2026-10-21T05:40:10.000Z' },
  { role: 'assistant', content: 'Schweigen ist nicht immer Feigheit.', timestamp: '2026-10-21T05:40:15.000Z' },
];

vi.mock('../../services/history/historyDataLoader', () => ({
  loadHistoryData: vi.fn(async () => ({
    freetalk: { seedId: 'freetalk', messages: LIVE.map((m) => ({ ...m, mode: 'free_conversation' })) },
  })),
}));

import { useHistoryModalData } from '../../components/HistoryModal/useHistoryModalData';
import { useDomainStore } from '../../stores/domainStore';

const props = {
  isOpen: true,
  onClose: () => {},
  selectedFigure: { id: 'aurelius', name: 'Marcus Aurelius' } as never,
  onSummaryGenerated: () => {},
  onHistoryCleared: () => {},
};

describe('the history modal and a summary of the live Free Talk', () => {
  beforeEach(() => {
    useDomainStore.setState((s) => ({ conversation: { ...s.conversation, historyKey: 'freetalk_aurelius', messages: LIVE as never } }));
  });
  afterEach(() => {
    cleanup();
    useDomainStore.setState((s) => ({ conversation: { ...s.conversation, historyKey: null, messages: [] } }));
  });

  it('shows the summary and keeps it when the app state changes afterwards', async () => {
    const { result } = renderHook(() => useHistoryModalData(props));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.setSelectedSeedId('freetalk'); });

    await act(async () => { await result.current.handleSummary(); });
    expect(result.current.histories.freetalk.messages[0]).toMatchObject({ isSummary: true });

    // Any later store update (a quota line, a voice state) calls the modal's mirror again.
    act(() => { useDomainStore.setState({}); });

    expect(result.current.histories.freetalk.messages).toHaveLength(1);
    expect(result.current.histories.freetalk.messages[0]).toMatchObject({ isSummary: true });
  });

  it('still mirrors a new message of the live conversation', async () => {
    const { result } = renderHook(() => useHistoryModalData(props));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const next = [...LIVE, { role: 'user', content: 'Und jetzt?', timestamp: '2026-10-21T05:41:00.000Z' }];
    act(() => { useDomainStore.setState((s) => ({ conversation: { ...s.conversation, messages: next as never } })); });

    expect(result.current.histories.freetalk.messages.map((m) => m.content)).toEqual(next.map((m) => m.content));
  });
});
