// A reply body that stops without closing: no bytes, no close, no error. The
// header timeout no longer applies once the headers are in, so each stream
// reader has to end the reply itself, keep what arrived and drop the
// connection. The limit is pinned here on purpose.
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
    // No key stored: the free tier answers without the rejected-key question.
    getKeyMetadata: vi.fn(async () => null),
  },
}));

import { generateFreeTierResponse } from '../../services/proxy/freeTierAdapter';
import { llmService } from '../../services/llm/llmService';
import generator from '../../services/council/generator';
import type { Segment } from '../../services/council/parser';

const LIMIT_MS = 60_000;
const TAIL_END = '</think>';
const councilBody = recording.slice(recording.indexOf(TAIL_END) + TAIL_END.length).trimStart();

function tokenDeltas(text: string): string[] {
  const sizes = [3, 1, 5, 2, 7, 4, 6];
  const out: string[] = [];
  for (let i = 0, k = 0; i < text.length; k++) {
    const piece = text.slice(i, i + sizes[k % sizes.length]);
    i += piece.length;
    out.push(piece);
  }
  return out;
}

const frame = (piece: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`;

interface Stalled {
  response: Response;
  sent: string;
  /** Resolves when the reader has taken every byte and asks for more. */
  drained: Promise<void>;
  cancelled: () => boolean;
}

/** Sends the deltas covering the first `upTo` characters, then nothing, ever. */
function stalledResponse(text: string, upTo: number): Stalled {
  let sse = '';
  let sent = '';
  for (const piece of tokenDeltas(text)) {
    if (sent.length >= upTo) break;
    sse += frame(piece);
    sent += piece;
  }
  const bytes = new TextEncoder().encode(sse);
  let cancelled = false;
  let offset = 0;
  let markDrained!: () => void;
  const drained = new Promise<void>((resolve) => { markDrained = resolve; });
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset < bytes.length) {
        controller.enqueue(bytes.slice(offset, offset + 512));
        offset += 512;
        return undefined;
      }
      markDrained();
      return new Promise<void>(() => {});
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    response: new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    sent,
    drained,
    cancelled: () => cancelled,
  };
}

/** A slow but live body: one part every `gapMs`, then a clean close. */
function slowResponse(parts: string[], gapMs: number): Response {
  const encoder = new TextEncoder();
  let k = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      await new Promise((resolve) => setTimeout(resolve, gapMs));
      if (k < parts.length) {
        controller.enqueue(encoder.encode(frame(parts[k++])));
      } else {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/**
 * Whether the run has settled just before and just after the limit, counted
 * from the moment the last byte was taken (the council path loads modules
 * first, which takes real time).
 */
async function aroundLimit<T>(stalled: Stalled, run: () => Promise<T>) {
  let settled = false;
  let value: T | undefined;
  let error: unknown;
  void run().then(
    (v) => { settled = true; value = v; },
    (e) => { settled = true; error = e; },
  );
  await stalled.drained;
  await vi.advanceTimersByTimeAsync(LIMIT_MS - 1_000);
  const before = settled;
  await vi.advanceTimersByTimeAsync(2_000);
  return { before, after: settled, value, error };
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('stream readers: a body that stops without closing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (generator as any).onProgressiveSegment = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ends a free-tier chat reply after the idle limit and keeps what arrived', async () => {
    const stalled = stalledResponse(reply, 300);
    vi.mocked(global.fetch).mockImplementation(async () => stalled.response);
    const chunks: string[] = [];

    const run = await aroundLimit(stalled, () => generateFreeTierResponse({
      messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
      figureId: 'socrates',
      mode: 'free_conversation',
      language: 'de',
      streamingCallback: async (chunk: string) => { chunks.push(chunk); },
    } as any));

    expect(run.before).toBe(false);
    expect(run.after).toBe(true);
    expect(run.error).toBeUndefined();
    expect(run.value?.response).toBe(stalled.sent);
    expect(squash(chunks.join(' '))).toBe(squash(stalled.sent));
    expect(stalled.cancelled()).toBe(true);
  });

  it('ends an own-key reply after the idle limit and keeps what arrived', async () => {
    const stalled = stalledResponse(reply, 300);
    vi.mocked(global.fetch).mockImplementation(async () => stalled.response);
    const seen: string[] = [];

    const run = await aroundLimit(stalled, () => llmService.chat({
      messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
      apiKey: `sk-or-v1-${'a'.repeat(64)}`,
      streamCallback: (chunk: string) => { seen.push(chunk); },
    }));

    expect(run.before).toBe(false);
    expect(run.after).toBe(true);
    expect(run.error).toBeUndefined();
    expect(seen.join('')).toBe(stalled.sent);
    expect(stalled.cancelled()).toBe(true);
  });

  it('ends a council stream after the idle limit with the speakers it had', async () => {
    const stalled = stalledResponse(councilBody, Math.floor(councilBody.length / 2));
    vi.mocked(global.fetch).mockImplementation(async () => stalled.response);
    const streamed: Segment[] = [];
    (generator as any).onProgressiveSegment = (s: Segment) => streamed.push(s);

    const run = await aroundLimit(stalled, () => (generator as any).callLLM({
      systemMessage: 'council template',
      userMessage: 'Was macht für euch ein gutes Leben aus?',
      expectedSpeakers: ['ADA LOVELACE', 'ALBERT EINSTEIN', 'ARTHUR SCHOPENHAUER'],
      config: { provider: 'free-tier', model: 'free-tier', maxTokens: 4000, temperature: 0.8, language: 'de' },
    }));

    expect(run.before).toBe(false);
    expect(run.after).toBe(true);
    expect(run.error).toBeUndefined();
    const result = run.value as { fullResponse: string; allSegments: Segment[] };
    expect(result.fullResponse).toBe(stalled.sent);
    expect(streamed.length).toBeGreaterThan(3);
    expect(result.allSegments.length).toBeGreaterThanOrEqual(streamed.length);
    expect(result.allSegments[0].speaker).toBe('ADA LOVELACE');
    expect(stalled.cancelled()).toBe(true);
  });

  it('lets a slow body run past the limit while bytes keep coming', async () => {
    const parts = ['Ein gutes Leben, ', 'sagte er, ', 'beginnt mit einer Frage.'];
    vi.mocked(global.fetch).mockImplementation(async () => slowResponse(parts, LIMIT_MS - 10_000));
    const seen: string[] = [];

    let settled = false;
    let error: unknown;
    void llmService.chat({
      messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
      apiKey: '',
      providerConfig: (await import('../../services/llm/types')).buildCustomOpenAIConfig('http://localhost:1234/v1'),
      streamCallback: (chunk: string) => { seen.push(chunk); },
    }).then(() => { settled = true; }, (e) => { settled = true; error = e; });

    await vi.advanceTimersByTimeAsync((LIMIT_MS - 10_000) * (parts.length + 1) + 1_000);
    expect(settled).toBe(true);
    expect(error).toBeUndefined();
    expect(seen.join('')).toBe(parts.join(''));
  });
});
