// A reply whose last `data:` line ends without a line break (a proxy that drops
// the final newline, a stream that closes early) keeps that line, in the shown
// text, the saved reply and its tool call, as the own-key reader already does.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/proxy/sessionManager', () => ({
  getSessionToken: vi.fn(async () => 'test-token'),
  invalidateToken: vi.fn(),
}));

import { generateFreeTierResponse, generateFreeTierSummary } from '../../services/proxy/freeTierAdapter';

const frame = (delta: Record<string, unknown>) => `data: ${JSON.stringify({ choices: [{ delta }] })}`;
const FIRST = 'Erster Satz ist hier, und er ist lang genug für den Filter. ';
const LAST = 'Letzter Satz über die Größe der Welt.';

/** Every piece is one network read; nothing is added after the last one. */
function serve(pieces: string[]): void {
  const encoder = new TextEncoder();
  vi.mocked(global.fetch).mockImplementation(async () => {
    let k = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (k < pieces.length) controller.enqueue(encoder.encode(pieces[k++]));
        else controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  });
}

const chat = (onToolCall?: (tc: { name: string; arguments: string; id?: string }) => void) => {
  const shown: string[] = [];
  const run = generateFreeTierResponse({
    messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
    figureId: 'aurelius',
    mode: 'free_conversation',
    language: 'de',
    streamingCallback: async (chunk: string) => { shown.push(chunk); },
    onToolCall,
  } as Parameters<typeof generateFreeTierResponse>[0]);
  return { run, shown };
};

const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('the free-tier reader at the end of the body', () => {
  it('keeps a last content line that has no line break', async () => {
    serve([`${frame({ content: FIRST })}\n\n`, frame({ content: LAST })]);

    const { run, shown } = chat();
    const result = await run;

    expect(flat(result.response)).toBe(flat(FIRST + LAST));
    expect(flat(shown.join(''))).toBe(flat(FIRST + LAST));
  });

  it('keeps a last tool-call line that has no line break', async () => {
    const calls: Array<{ name: string; arguments: string }> = [];
    serve([
      `${frame({ content: FIRST })}\n\n`,
      frame({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'award_seed', arguments: '{"seed":3}' } }] }),
    ]);

    const { run } = chat((tc) => calls.push(tc));
    await run;

    expect(calls).toEqual([{ name: 'award_seed', arguments: '{"seed":3}', id: 'call_1' }]);
  });

  it('keeps the last line of a summary that has no line break', async () => {
    serve([`${frame({ content: 'GESPRÄCHSÜBERBLICK:\nEin kurzes Gespräch. ' })}\n\n`, frame({ content: 'KERNEINSICHTEN:\nGeduld.' })]);

    const result = await generateFreeTierSummary({
      figureId: 'aurelius',
      seedTitle: 'Free Talk',
      language: 'de',
      history: 'Suchender: Hallo\nMarc Aurel: Sei gegrüßt.',
    } as Parameters<typeof generateFreeTierSummary>[0]);

    expect(result.response).toContain('KERNEINSICHTEN:\nGeduld.');
  });

  it('still ignores an unterminated [DONE] and an unterminated broken line', async () => {
    serve([`${frame({ content: FIRST })}\n\n`, 'data: [DONE]']);
    expect(flat((await chat().run).response)).toBe(flat(FIRST));

    serve([`${frame({ content: FIRST })}\n\n`, 'data: {"choices": [{"del']);
    expect(flat((await chat().run).response)).toBe(flat(FIRST));
  });
});
