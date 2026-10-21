// A caller's abort that comes after the headers. The request's own listener is
// gone by then, so each stream reader has to watch the signal itself: stop
// reading, drop the connection and end with an AbortError, also while a read
// is waiting on a body that sends nothing.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import reply from '../fixtures/chat-de-reply.txt?raw';
import recording from '../fixtures/council-de-reasoning-tail.txt?raw';

vi.mock('../../services/proxy/sessionManager', () => ({
  getSessionToken: vi.fn(async () => 'test-token'),
  invalidateToken: vi.fn(),
}));

vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    hasUsableKey: vi.fn(async () => false),
    getKey: vi.fn(async () => `sk-or-v1-${'a'.repeat(64)}`),
    markInvalid: vi.fn(async () => {}),
  },
}));

import { generateFreeTierResponse } from '../../services/proxy/freeTierAdapter';
import { llmService } from '../../services/llm/llmService';
import generator from '../../services/council/generator';
import type { Segment } from '../../services/council/parser';

/** The generator's private seams this test drives. */
const gen = generator as unknown as {
  signal?: AbortSignal;
  onProgressiveSegment: ((s: Segment) => void) | null;
  callLLM: (request: unknown) => Promise<unknown>;
};

const TAIL_END = '</think>';
const councilBody = recording.slice(recording.indexOf(TAIL_END) + TAIL_END.length).trimStart();
const frame = (piece: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`;

function pieces(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

interface Body {
  response: Response;
  /** How many parts the reader has pulled so far. */
  pulled: () => number;
  cancelled: () => boolean;
}

/**
 * A live body: one part every `gapMs`, then a clean close. With `stallAfter`,
 * it sends that many parts and then nothing, ever.
 */
function liveBody(parts: string[], gapMs: number, stallAfter = Infinity): Body {
  const encoder = new TextEncoder();
  let k = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (k >= stallAfter) return new Promise<void>(() => {});
      await new Promise((resolve) => setTimeout(resolve, gapMs));
      if (cancelled) return undefined;
      if (k < parts.length) {
        controller.enqueue(encoder.encode(frame(parts[k++])));
      } else {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
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

/** Answers every request with the body and resolves once the first one went out. */
function serve(body: Body): Promise<void> {
  let sent!: () => void;
  const out = new Promise<void>((resolve) => { sent = resolve; });
  vi.mocked(global.fetch).mockImplementation(async () => { sent(); return body.response; });
  return out;
}

const isAbort = (e: unknown) => (e as { name?: string } | undefined)?.name === 'AbortError';

describe('stream readers: an abort after the headers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    gen.onProgressiveSegment = null;
    gen.signal = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    gen.signal = undefined;
  });

  it('ends a free-tier read that waits on a silent body, at once', async () => {
    const body = liveBody(pieces(reply, 40), 10, 4);
    const sent = serve(body);
    const controller = new AbortController();
    const run = track(generateFreeTierResponse({
      messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
      figureId: 'aurelius',
      mode: 'free_conversation',
      language: 'de',
      streamingCallback: async () => {},
      signal: controller.signal,
    } as Parameters<typeof generateFreeTierResponse>[0]));

    await sent;
    await vi.advanceTimersByTimeAsync(100);
    expect(body.pulled()).toBe(4);
    expect(run.settled).toBe(false);
    controller.abort();
    await vi.advanceTimersByTimeAsync(50);

    expect(run.settled).toBe(true);
    expect(isAbort(run.error)).toBe(true);
    expect(body.cancelled()).toBe(true);
  });

  it('ends an own-key read that waits on a silent body, at once', async () => {
    const body = liveBody(pieces(reply, 40), 10, 4);
    const sent = serve(body);
    const controller = new AbortController();
    const run = track(llmService.chat({
      messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
      apiKey: `sk-or-v1-${'a'.repeat(64)}`,
      streamCallback: () => {},
      signal: controller.signal,
    }));

    await sent;
    await vi.advanceTimersByTimeAsync(100);
    expect(run.settled).toBe(false);
    controller.abort();
    await vi.advanceTimersByTimeAsync(50);

    expect(run.settled).toBe(true);
    expect(isAbort(run.error)).toBe(true);
    expect(body.cancelled()).toBe(true);
  });

  it('stops a closed council from reading the rest of its body', async () => {
    const parts = pieces(councilBody, 60);
    const body = liveBody(parts, 100);
    const sent = serve(body);
    const controller = new AbortController();
    gen.signal = controller.signal;
    const streamed: Segment[] = [];
    gen.onProgressiveSegment = (s: Segment) => streamed.push(s);

    const run = track(gen.callLLM({
      systemMessage: 'council template',
      userMessage: 'Was macht für euch ein gutes Leben aus?',
      expectedSpeakers: ['ADA LOVELACE', 'ALBERT EINSTEIN', 'ARTHUR SCHOPENHAUER'],
      config: { provider: 'free-tier', model: 'free-tier', maxTokens: 4000, temperature: 0.8, language: 'de' },
    }));

    // Ten parts in, the reader is waiting on the eleventh.
    await sent;
    await vi.advanceTimersByTimeAsync(100 * 10 + 50);
    expect(body.pulled()).toBe(10);
    expect(run.settled).toBe(false);
    controller.abort();
    const pulledAtAbort = body.pulled();
    const streamedAtAbort = streamed.length;
    await vi.advanceTimersByTimeAsync(100 * (parts.length + 5));

    expect(run.settled).toBe(true);
    expect(run.error).toBeInstanceOf(Error);
    expect(String((run.error as Error).message)).toMatch(/abort/i);
    expect(body.pulled()).toBe(pulledAtAbort);
    expect(body.pulled()).toBeLessThan(parts.length);
    expect(streamed.length).toBe(streamedAtAbort);
    expect(body.cancelled()).toBe(true);
  });

  it('does not start another read once the signal has fired between reads', async () => {
    const parts = pieces(reply, 30);
    const body = liveBody(parts, 10);
    const sent = serve(body);
    const controller = new AbortController();
    const seen: string[] = [];
    let shownAtAbort = -1;
    const run = track(llmService.chat({
      messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
      apiKey: `sk-or-v1-${'a'.repeat(64)}`,
      // Like the council's callback: it notes the text and never throws.
      streamCallback: (chunk: string) => {
        seen.push(chunk);
        if (!controller.signal.aborted) {
          shownAtAbort = seen.join('').length;
          controller.abort();
        }
      },
      signal: controller.signal,
    }));

    await sent;
    await vi.advanceTimersByTimeAsync(10 * (parts.length + 5));

    expect(run.settled).toBe(true);
    expect(isAbort(run.error)).toBe(true);
    expect(shownAtAbort).toBeGreaterThan(0);
    expect(seen.join('').length).toBe(shownAtAbort);
    expect(body.pulled()).toBeLessThan(parts.length);
    expect(body.cancelled()).toBe(true);
  });

  it('leaves a read without a signal to run to its end', async () => {
    const parts = pieces(reply, 60);
    const body = liveBody(parts, 10);
    const sent = serve(body);
    const seen: string[] = [];
    const run = track(llmService.chat({
      messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
      apiKey: `sk-or-v1-${'a'.repeat(64)}`,
      streamCallback: (chunk: string) => { seen.push(chunk); },
    }));

    await sent;
    await vi.advanceTimersByTimeAsync(10 * (parts.length + 5));

    expect(run.settled).toBe(true);
    expect(run.error).toBeUndefined();
    expect(seen.join('')).toBe(reply);
    expect(body.cancelled()).toBe(false);
  });
});
