// An error the caller's callback throws mid-body. The parsers' catch is there
// for a malformed line, so it must not swallow the callback: a stop (the chat
// driver throws an AbortError once its signal fired) or a real fault ends the
// read, drops the connection and reaches the caller as it was thrown.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import reply from '../fixtures/chat-de-reply.txt?raw';

vi.mock('../../services/proxy/sessionManager', () => ({
  getSessionToken: vi.fn(async () => 'test-token'),
  invalidateToken: vi.fn(),
}));

import { generateFreeTierResponse } from '../../services/proxy/freeTierAdapter';
import { llmService } from '../../services/llm/llmService';

const KEY = `sk-or-v1-${'a'.repeat(64)}`;
// The free tier's chunker holds early text back; a longer reply gives it
// several emissions before the body ends.
const longReply = [reply, reply, reply].join('\n\n');
const frame = (piece: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`;

function pieces(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

interface Body {
  response: Response;
  /** How many network chunks the reader has pulled so far. */
  pulled: () => number;
  cancelled: () => boolean;
}

/** One network chunk per `gapMs`; each chunk is a string of raw SSE text. */
function liveBody(chunks: string[], gapMs: number, close = 'data: [DONE]\n\n'): Body {
  const encoder = new TextEncoder();
  let k = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      await new Promise((resolve) => setTimeout(resolve, gapMs));
      if (cancelled) return undefined;
      if (k < chunks.length) {
        controller.enqueue(encoder.encode(chunks[k++]));
      } else {
        if (close) controller.enqueue(encoder.encode(close));
        controller.close();
      }
      return undefined;
    },
    cancel() {
      cancelled = true;
    },
  }, { highWaterMark: 0 });
  return {
    response: new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    pulled: () => k,
    cancelled: () => cancelled,
  };
}

function track<T>(run: Promise<T>) {
  const state: { settled: boolean; value?: T; error?: unknown } = { settled: false };
  run.then(
    (v) => { state.settled = true; state.value = v; },
    (e) => { state.settled = true; state.error = e; },
  );
  return state;
}

function serve(body: Body): void {
  vi.mocked(global.fetch).mockImplementation(async () => body.response);
}

/** The chat driver's stop: thrown by the callback once its signal fired. */
const driverStop = () => new DOMException('Streaming aborted', 'AbortError');

const ownKey = (streamCallback: (chunk: string) => void | Promise<void>, signal?: AbortSignal) =>
  llmService.chat({
    messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
    apiKey: KEY,
    streamCallback,
    signal,
  });

const freeTier = (streamingCallback: (chunk: string) => Promise<void>, signal?: AbortSignal) =>
  generateFreeTierResponse({
    messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
    figureId: 'aurelius',
    mode: 'free_conversation',
    language: 'de',
    streamingCallback,
    signal,
  } as Parameters<typeof generateFreeTierResponse>[0]);

describe('stream readers: an error the callback throws', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('own key: a fault in the callback ends the read and reaches the caller', async () => {
    const parts = pieces(reply, 30).map(frame);
    const body = liveBody(parts, 10);
    serve(body);
    const fault = new Error('the voice queue broke');
    let calls = 0;
    const run = track(ownKey(() => {
      calls += 1;
      if (calls === 3) throw fault;
    }));

    await vi.advanceTimersByTimeAsync(10 * (parts.length + 5));

    expect(run.settled).toBe(true);
    expect(run.error).toBe(fault);
    expect(calls).toBe(3);
    expect(body.pulled()).toBeLessThan(parts.length);
    expect(body.cancelled()).toBe(true);
  });

  it('own key: an AbortError from a stop the reader does not hold ends the read', async () => {
    const parts = pieces(reply, 30).map(frame);
    const body = liveBody(parts, 10);
    serve(body);
    const stop = driverStop();
    let calls = 0;
    const run = track(ownKey(() => {
      calls += 1;
      if (calls === 3) throw stop;
    }));

    await vi.advanceTimersByTimeAsync(10 * (parts.length + 5));

    expect(run.error).toBe(stop);
    expect(calls).toBe(3);
    expect(body.pulled()).toBeLessThan(parts.length);
    expect(body.cancelled()).toBe(true);
  });

  it('own key: the driver stop inside one network chunk is the error the caller gets', async () => {
    // The whole reply in one network chunk: the stop lands while the callback
    // runs on its second piece, the callback throws on the third, and no later
    // line of the same chunk may reach it.
    const chunk = pieces(reply, 20).map(frame).join('');
    const body = liveBody([chunk], 10);
    serve(body);
    const controller = new AbortController();
    const stop = driverStop();
    let calls = 0;
    const run = track(ownKey(() => {
      calls += 1;
      if (controller.signal.aborted) throw stop;
      if (calls === 2) controller.abort();
    }, controller.signal));

    await vi.advanceTimersByTimeAsync(100);

    expect(run.error).toBe(stop);
    expect(calls).toBe(3);
    expect(body.pulled()).toBe(1);
    expect(body.cancelled()).toBe(true);
  });

  it('own key: a fault on the last line, sent without a line end, reaches the caller', async () => {
    const parts = pieces(reply, 200);
    const chunks = [...parts.slice(0, -1).map(frame), frame(parts[parts.length - 1]).trimEnd()];
    const body = liveBody(chunks, 10, '');
    serve(body);
    const fault = new Error('the last chunk broke');
    const run = track(ownKey((chunk) => {
      if (chunk === parts[parts.length - 1]) throw fault;
    }));

    await vi.advanceTimersByTimeAsync(10 * (chunks.length + 5));

    expect(run.settled).toBe(true);
    expect(run.error).toBe(fault);
  });

  it('own key: still skips a malformed line, a null line and an error payload', async () => {
    const parts = pieces(reply, 60);
    const chunks = [
      frame(parts[0]),
      'data: {"choices":[{"delta":{"content":"cut\n\n',
      'data: null\n\n',
      'data: {"error":{"message":"model busy"}}\n\n',
      ...parts.slice(1).map(frame),
    ];
    const body = liveBody(chunks, 10);
    serve(body);
    const seen: string[] = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const run = track(ownKey((chunk) => { seen.push(chunk); }));

    await vi.advanceTimersByTimeAsync(10 * (chunks.length + 5));
    warn.mockRestore();

    expect(run.error).toBeUndefined();
    expect(seen.join('')).toBe(reply);
    expect(body.cancelled()).toBe(false);
  });

  it('free tier: a fault in the callback ends the read and reaches the caller', async () => {
    const parts = pieces(longReply, 30).map(frame);
    const body = liveBody(parts, 10);
    serve(body);
    const fault = new Error('the voice queue broke');
    let calls = 0;
    const run = track(freeTier(async () => {
      calls += 1;
      if (calls === 2) throw fault;
    }));

    await vi.advanceTimersByTimeAsync(10 * (parts.length + 5));

    expect(run.settled).toBe(true);
    expect(run.error).toBe(fault);
    expect(calls).toBe(2);
    expect(body.pulled()).toBeLessThan(parts.length);
    expect(body.cancelled()).toBe(true);
  });

  it('free tier: the driver stop inside one network chunk is the error the caller gets', async () => {
    const chunk = pieces(longReply, 20).map(frame).join('');
    const body = liveBody([chunk], 10);
    serve(body);
    const controller = new AbortController();
    const stop = driverStop();
    let calls = 0;
    const run = track(freeTier(async () => {
      calls += 1;
      if (controller.signal.aborted) throw stop;
      controller.abort();
    }, controller.signal));

    await vi.advanceTimersByTimeAsync(100);

    expect(run.error).toBe(stop);
    expect(calls).toBe(2);
    expect(body.pulled()).toBe(1);
    expect(body.cancelled()).toBe(true);
  });

  it('free tier: still skips a malformed line and a null line', async () => {
    const parts = pieces(reply, 60);
    const chunks = [
      frame(parts[0]),
      'data: {"choices":[{"delta":{"content":"cut\n\n',
      'data: null\n\n',
      ...parts.slice(1).map(frame),
    ];
    const body = liveBody(chunks, 10);
    serve(body);
    const seen: string[] = [];
    const run = track(freeTier(async (chunk) => { seen.push(chunk); }));

    await vi.advanceTimersByTimeAsync(10 * (chunks.length + 5));

    expect(run.error).toBeUndefined();
    expect((run.value as { response: string }).response).toBe(reply);
    expect(seen.length).toBeGreaterThan(0);
    expect(body.cancelled()).toBe(false);
  });
});
