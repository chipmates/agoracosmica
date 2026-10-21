// A no to the own-key question before a summary: the chat's key line inside
// the history, never a browser alert, and nothing at all after "check my key"
// (Settings is open then).
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
  default: { generateSummary: vi.fn() },
}));
vi.mock('../../services/history/historyDataLoader', () => ({
  loadHistoryData: vi.fn(async () => ({
    freetalk: {
      seedId: 'freetalk',
      messages: [
        { role: 'assistant', content: 'Sei gegrüßt.', timestamp: '2026-10-21T05:40:00.000Z', mode: 'free_conversation' },
        { role: 'user', content: 'War mein Schweigen feige?', timestamp: '2026-10-21T05:40:10.000Z', mode: 'free_conversation' },
      ],
    },
  })),
}));

import { useHistoryModalData } from '../../components/HistoryModal/useHistoryModalData';
import SummaryService from '../../services/SummaryService';
import { OwnKeyRejectedError, OwnKeyRefusedError } from '../../services/llm/ownKeyConsent';

async function openHistory() {
  const view = renderHook(() => useHistoryModalData({
    isOpen: true,
    onClose: () => {},
    selectedFigure: { id: 'aurelius', name: 'Marcus Aurelius' } as never,
    onSummaryGenerated: () => {},
    onHistoryCleared: () => {},
  }));
  await waitFor(() => expect(view.result.current.histories.freetalk).toBeTruthy());
  act(() => { view.result.current.setSelectedSeedId('freetalk'); });
  return view;
}

describe('a summary after a rejected own key', () => {
  let alert: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(SummaryService.generateSummary).mockReset();
    alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    alert.mockRestore();
  });

  it.each([
    ['dismissed', 'errors.conversation.byokInvalidKey'],
    ['check-key', null],
  ] as const)('a %s answer shows no alert and the chat key line or nothing', async (choice, note) => {
    vi.mocked(SummaryService.generateSummary).mockRejectedValueOnce(new OwnKeyRejectedError(choice));
    const view = await openHistory();
    await act(async () => { await view.result.current.handleSummary(); });

    expect(alert).not.toHaveBeenCalled();
    expect((view.result.current as { summaryNote?: string | null }).summaryNote ?? null).toBe(note);
  });

  it('the line goes when the next summary starts', async () => {
    vi.mocked(SummaryService.generateSummary).mockRejectedValueOnce(new OwnKeyRejectedError('dismissed'));
    const view = await openHistory();
    await act(async () => { await view.result.current.handleSummary(); });
    expect(view.result.current.summaryNote).toBe('errors.conversation.byokInvalidKey');

    let finish: (value: unknown) => void = () => {};
    vi.mocked(SummaryService.generateSummary).mockReturnValueOnce(
      new Promise((resolve) => { finish = resolve; }) as never,
    );
    let run: Promise<void> = Promise.resolve();
    act(() => { run = view.result.current.handleSummary(); });
    expect(view.result.current.summaryNote).toBeNull();

    // Let it end, so no summary stays in flight for the next test.
    await act(async () => {
      finish({ content: 'KERNEINSICHTEN:\nGeduld.', metadata: { figureId: 'aurelius', seedId: 'freetalk', timestamp: '2026-10-21T05:42:00.000Z' } });
      await run;
    });
  });

  it('a summary OpenRouter refused (403) says why in the history, never an alert', async () => {
    vi.mocked(SummaryService.generateSummary).mockRejectedValueOnce(new OwnKeyRefusedError('moderation'));
    const view = await openHistory();
    await act(async () => { await view.result.current.handleSummary(); });

    expect(alert).not.toHaveBeenCalled();
    expect(view.result.current.summaryNote).toBe('errors.conversation.byokRefused.moderation');
  });

  it('any other failure keeps its alert', async () => {
    vi.mocked(SummaryService.generateSummary).mockRejectedValueOnce(new Error('upstream is down'));
    const view = await openHistory();
    await act(async () => { await view.result.current.handleSummary(); });
    expect(alert).toHaveBeenCalledTimes(1);
  });
});
