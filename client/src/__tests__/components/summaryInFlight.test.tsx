// A summary can take up to 90 s. Closing the history (Escape) while it runs
// and opening it again must not start a second request, which would spend the
// visitor's second daily summary: the reopened history waits for the first.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => {
  const pending: Array<(value: unknown) => void> = [];
  return { pending, finish: (value: unknown) => pending.splice(0).forEach((resolve) => resolve(value)) };
});

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
  default: {
    generateSummary: vi.fn(() => new Promise((resolve) => { h.pending.push(resolve); })),
  },
}));

const CHAT = [
  { role: 'assistant', content: 'Sei gegrüßt. Worüber möchtest du sprechen?', timestamp: '2026-10-21T05:40:00.000Z', mode: 'free_conversation' },
  { role: 'user', content: 'War mein Schweigen feige?', timestamp: '2026-10-21T05:40:10.000Z', mode: 'free_conversation' },
];

vi.mock('../../services/history/historyDataLoader', () => ({
  loadHistoryData: vi.fn(async () => ({ freetalk: { seedId: 'freetalk', messages: CHAT } })),
}));

import { useHistoryModalData } from '../../components/HistoryModal/useHistoryModalData';
import SummaryService from '../../services/SummaryService';

const SUMMARY = { content: 'KERNEINSICHTEN:\nGeduld.', metadata: { figureId: 'aurelius', seedId: 'freetalk', timestamp: '2026-10-21T05:42:00.000Z' } };

const props = (onClose = () => {}, onSummaryGenerated = () => {}) => ({
  isOpen: true,
  onClose,
  selectedFigure: { id: 'aurelius', name: 'Marcus Aurelius' } as never,
  onSummaryGenerated,
  onHistoryCleared: () => {},
});

async function openHistory(onSummaryGenerated = () => {}) {
  const view = renderHook(() => useHistoryModalData(props(() => {}, onSummaryGenerated)));
  await waitFor(() => expect(view.result.current.histories.freetalk).toBeTruthy());
  act(() => { view.result.current.setSelectedSeedId('freetalk'); });
  return view;
}

const summaryWrites = () => vi.mocked(window.localStorage.setItem).mock.calls.filter(([key]) => key === 'summary_aurelius_freetalk');

describe('closing the history while a summary runs', () => {
  let alert: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    h.pending.length = 0;
    vi.mocked(SummaryService.generateSummary).mockClear();
    alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    alert.mockRestore();
  });

  it('a second press after reopening joins the first request', async () => {
    const generated = vi.fn();
    const first = await openHistory(generated);
    let firstRun: Promise<void> = Promise.resolve();
    act(() => { firstRun = first.result.current.handleSummary(); });
    expect(first.result.current.showSpinner).toBe(true);

    // Escape: the history closes and unmounts while the request runs.
    act(() => { first.result.current.handleClose(); });
    first.unmount();

    const second = await openHistory();
    await act(async () => {
      const again = second.result.current.handleSummary();
      h.finish(SUMMARY);
      await Promise.all([firstRun, again]);
    });

    expect(vi.mocked(SummaryService.generateSummary)).toHaveBeenCalledTimes(1);
    expect(second.result.current.histories.freetalk.messages[0]).toMatchObject({ isSummary: true, content: SUMMARY.content });
    expect(summaryWrites()).toHaveLength(1);
    expect(generated).toHaveBeenCalledTimes(1);
  });

  it('the reopened history shows the wait until the first request lands', async () => {
    const first = await openHistory();
    let firstRun: Promise<void> = Promise.resolve();
    act(() => { firstRun = first.result.current.handleSummary(); });
    act(() => { first.result.current.handleClose(); });
    first.unmount();

    const second = await openHistory();
    await waitFor(() => expect(second.result.current.showSpinner).toBe(true));

    await act(async () => {
      h.finish(SUMMARY);
      await firstRun;
    });

    await waitFor(() => expect(second.result.current.showSpinner).toBe(false));
    expect(second.result.current.histories.freetalk.messages[0]).toMatchObject({ isSummary: true });
    expect(vi.mocked(SummaryService.generateSummary)).toHaveBeenCalledTimes(1);
  });

  it('after the first request lands, a new press asks again', async () => {
    const first = await openHistory();
    await act(async () => {
      const run = first.result.current.handleSummary();
      h.finish(SUMMARY);
      await run;
    });
    first.unmount();

    const second = await openHistory();
    await act(async () => {
      const run = second.result.current.handleSummary();
      h.finish(SUMMARY);
      await run;
    });

    expect(vi.mocked(SummaryService.generateSummary)).toHaveBeenCalledTimes(2);
  });
});
