// A summary is stored twice: as the seed's history (a summary message) and as
// its own record. Reopened, the history shows it once, as the summary plate,
// never a second time as a plain reply bubble.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const data: Record<string, string> = {};
vi.mock('../../storage/localAdapter', () => ({
  LocalStorageAdapter: {
    keys: () => Object.keys(data),
    getString: (key: string) => data[key] ?? null,
    getJSON: (key: string) => (data[key] ? JSON.parse(data[key]) : null),
  },
}));
vi.mock('../../services/history/historyStorageUtils', () => ({ readIndexedDbConversationEntries: async () => [] }));

import { loadHistoryData } from '../../services/history/historyDataLoader';

const SUMMARY = 'KERNEINSICHTEN:\n- Geduld.\n\nBEITRÄGE DES NUTZERS:\n- Eine Frage zum Schweigen.';
const STAMP = '2026-10-21T06:00:00.000Z';

const store = (seedId: string, history: unknown[]) => {
  data[`starseed_aurelius_${seedId}`] = JSON.stringify(history);
  data[`summary_aurelius_${seedId}`] = JSON.stringify({ content: SUMMARY, metadata: { figureId: 'aurelius', seedId, timestamp: STAMP } });
};

const summaries = (messages: Array<{ content: string; isSummary?: boolean; mode?: string }>) =>
  messages.filter((m) => m.content === SUMMARY);

describe('a stored summary in the reopened history', () => {
  beforeEach(() => { for (const key of Object.keys(data)) delete data[key]; });

  it('shows once, as the plate, for a seed and for Free Talk', async () => {
    store('3', [{ role: 'assistant', content: SUMMARY, isSummary: true, timestamp: STAMP }]);
    store('freetalk', [{ role: 'assistant', content: SUMMARY, isSummary: true, timestamp: STAMP }]);

    const histories = await loadHistoryData({ id: 'aurelius' } as never);

    for (const seedId of ['3', 'freetalk']) {
      const found = summaries(histories[seedId].messages);
      expect(found, seedId).toHaveLength(1);
      expect(found[0].isSummary, seedId).toBe(true);
    }
  });

  it('shows as the plate when only the summary record is left', async () => {
    data.summary_aurelius_5 = JSON.stringify({ content: SUMMARY, metadata: { figureId: 'aurelius', seedId: '5', timestamp: STAMP } });

    const histories = await loadHistoryData({ id: 'aurelius' } as never);

    const found = summaries(histories['5'].messages);
    expect(found).toHaveLength(1);
    expect(found[0].isSummary).toBe(true);
  });
});
