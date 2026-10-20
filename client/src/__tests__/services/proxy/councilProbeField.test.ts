// The council request carries the in-house probe mark the way chat does, so a
// probe browser's council row can be subtracted at query time.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/proxy/sessionManager', () => ({
  getSessionToken: vi.fn(async () => 'test-token'),
  invalidateToken: vi.fn(),
}));

function okStream(): Response {
  const body = 'data: {"choices":[{"delta":{"content":"ADA LOVELACE :: Hallo."}}]}\n\ndata: [DONE]\n\n';
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

// probeSession caches its read once per module load, so each case loads fresh modules.
async function councilBody(): Promise<Record<string, unknown>> {
  vi.resetModules();
  const { generateFreeTierCouncilResponse } = await import('../../../services/proxy/freeTierAdapter');
  vi.mocked(global.fetch).mockImplementation(async () => okStream());
  await generateFreeTierCouncilResponse({
    systemPrompt: 'council template',
    messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
    language: 'de',
  });
  const call = vi.mocked(global.fetch).mock.calls.find(([url]) => String(url).endsWith('/v1/council'));
  expect(call).toBeDefined();
  return JSON.parse(String(call![1]!.body));
}

describe('council request: probe mark', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockClear();
  });

  it('sends probe: 1 from a probe browser', async () => {
    localStorage.setItem('agc_probe', '1');
    const body = await councilBody();
    expect(body.probe).toBe(1);
    expect(body.systemPrompt).toBe('council template');
    expect(body.language).toBe('de');
  });

  it('sends no probe field from an unmarked browser', async () => {
    localStorage.removeItem('agc_probe');
    const body = await councilBody();
    expect('probe' in body).toBe(false);
  });
});
