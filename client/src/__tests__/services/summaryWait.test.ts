// The worker counts a summary before it asks the model, and the recap model can
// take over 30 s to its first byte. A summary whose answer starts late still
// lands instead of failing at the 30 s cap the chat uses.
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../services/proxy/sessionManager', () => ({
  getSessionToken: vi.fn(async () => 'test-token'),
  invalidateToken: vi.fn(),
}));

import { generateFreeTierSummary } from '../../services/proxy/freeTierAdapter';

const frame = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

/** The worker answers after `delayMs`, or never stops waiting when the caller's signal aborts. */
function answerAfter(delayMs: number): void {
  vi.mocked(global.fetch).mockImplementation((_input, init) => new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => resolve(new Response(
      `${frame('KERNEINSICHTEN:\nGeduld.')}data: [DONE]\n\n`,
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    )), delayMs);
    init?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
  }));
}

const summarize = () => generateFreeTierSummary({
  figureId: 'aurelius', seedTitle: 'Free Talk', language: 'de', history: 'Human: Hallo\n\nAssistant: Sei gegrüßt.',
} as Parameters<typeof generateFreeTierSummary>[0]);

describe('a free-tier summary that starts late', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('lands when the first byte comes after 45 s', async () => {
    vi.useFakeTimers();
    answerAfter(45_000);

    const settled = summarize().then((r) => r, (e: unknown) => e);
    await vi.advanceTimersByTimeAsync(46_000);

    expect(await settled).toMatchObject({ response: 'KERNEINSICHTEN:\nGeduld.' });
  });

  it('still gives up when nothing comes for 90 s', async () => {
    vi.useFakeTimers();
    answerAfter(600_000);

    const settled = summarize().then((r) => r, (e: unknown) => e);
    await vi.advanceTimersByTimeAsync(91_000);

    expect(String(await settled)).toMatch(/timed out after 90000ms/);
  });
});
