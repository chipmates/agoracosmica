// Replays a recorded free-tier council stream through the real council path:
// SSE -> parseSSEStream -> TextChunker -> the generator's filter -> parser.
// The recording opens with a reasoning tail that closes with </think> but has
// no opening tag; the first speaker's line follows on the same line.
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

vi.mock('../../services/audio/llm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/audio/llm')>()),
  generateResponse: vi.fn(),
}));

import generator from '../../services/council/generator';
import { generateResponse } from '../../services/audio/llm';
import { keyStorage } from '../../services/storage/keyStorageService';
import type { Segment } from '../../services/council/parser';

const SPEAKERS = ['ADA LOVELACE', 'ALBERT EINSTEIN', 'ARTHUR SCHOPENHAUER'];
const TAIL_END = '</think>';
const body = recording.slice(recording.indexOf(TAIL_END) + TAIL_END.length);

// Token-sized deltas (1 to 7 characters, fixed pattern); a blank line between
// speakers is its own delta, as tokenizers emit it.
function tokenDeltas(text: string): string[] {
  const sizes = [3, 1, 5, 2, 7, 4, 6];
  const out: string[] = [];
  let k = 0;
  for (const part of text.split(/(\n\n)/)) {
    if (part === '\n\n') { out.push(part); continue; }
    for (let i = 0; i < part.length; k++) {
      const piece = part.slice(i, i + sizes[k % sizes.length]);
      i += piece.length;
      out.push(piece);
    }
  }
  return out;
}

// 512-byte network reads, so SSE lines and multi-byte umlauts cross reads.
function sseResponse(text: string): Response {
  let sse = '';
  for (const piece of tokenDeltas(text)) {
    sse += `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`;
  }
  sse += 'data: [DONE]\n\n';
  const bytes = new TextEncoder().encode(sse);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 512) controller.enqueue(bytes.slice(i, i + 512));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

type Replay = { fullResponse: string; allSegments: Segment[]; streamed: Segment[] };

async function callLLM(): Promise<Replay> {
  const streamed: Segment[] = [];
  (generator as any).onProgressiveSegment = (s: Segment) => streamed.push(s);
  const result = await (generator as any).callLLM({
    systemMessage: 'council template',
    userMessage: 'Was macht für euch ein gutes Leben aus?',
    expectedSpeakers: SPEAKERS,
    config: { provider: 'free-tier', model: 'free-tier', maxTokens: 4000, temperature: 0.8, language: 'de' },
  });
  return { ...result, streamed };
}

/** The free tier: the worker's SSE through the real adapter and its TextChunker. */
async function replayFreeTier(text: string): Promise<Replay> {
  vi.mocked(global.fetch).mockImplementation(async () => sseResponse(text));
  return callLLM();
}

/** Raw deltas straight into the council callback, the most it could be handed. */
async function replayByok(text: string): Promise<Replay> {
  vi.mocked(keyStorage.hasUsableKey).mockResolvedValueOnce(true);
  vi.mocked(generateResponse).mockImplementationOnce(async (opts: any) => {
    for (const piece of tokenDeltas(text)) await opts.streamingCallback(piece);
    return { response: text, metadata: {} } as any;
  });
  return callLLM();
}

/** BYOK as it runs: generateResponse -> llmService (its reader filter) -> llmAdapter's TextChunker -> the council. */
async function replayByokChain(text: string): Promise<Replay> {
  const actual = await vi.importActual<typeof import('../../services/audio/llm')>('../../services/audio/llm');
  vi.mocked(keyStorage.hasUsableKey).mockResolvedValueOnce(true).mockResolvedValueOnce(true);
  vi.mocked(generateResponse).mockImplementationOnce(actual.generateResponse);
  vi.mocked(global.fetch).mockImplementation(async () => sseResponse(text));
  return callLLM();
}

const speakers = (segments: Segment[]) => segments.map((s) => s.speaker);

function expectCleanOpening({ allSegments, streamed, fullResponse }: Replay) {
  expect(allSegments[0].speaker).toBe('ADA LOVELACE');
  expect(allSegments[0].content.startsWith('Der Messingstift der Spieldose')).toBe(true);
  expect(streamed[0].speaker).toBe('ADA LOVELACE');
  for (const s of allSegments) {
    expect(s.content).not.toContain('think>');
    expect(s.content).not.toContain('Never mention');
    expect(s.content).not.toContain('::');
  }
  // The fallback parser reads fullResponse, so it must be clean too.
  expect(fullResponse.startsWith('ADA LOVELACE :: Der Messingstift')).toBe(true);
}

describe('council replay: reasoning tail without an opening tag', () => {
  beforeEach(() => {
    (generator as any).onProgressiveSegment = null;
  });

  it('keeps the first speaker\'s opening on the free tier', async () => {
    const replay = await replayFreeTier(recording);
    expectCleanOpening(replay);
    const clean = await replayFreeTier(body);
    expect(speakers(replay.allSegments)).toEqual(speakers(clean.allSegments));
  });

  it('keeps the opening and every speaker change with raw BYOK deltas', async () => {
    const replay = await replayByok(recording);
    expectCleanOpening(replay);
    const clean = await replayFreeTier(body);
    expect(speakers(replay.allSegments)).toEqual(speakers(clean.allSegments));
  });

  it('keeps a blank-line delta between speakers with no reasoning at all', async () => {
    const replay = await replayByok(body);
    const clean = await replayFreeTier(body);
    expect(speakers(replay.allSegments)).toEqual(speakers(clean.allSegments));
    for (const s of replay.allSegments) expect(s.content).not.toContain('::');
  });

  it('parses a stream with no reasoning the same way', async () => {
    const { allSegments } = await replayFreeTier(body);
    expect(allSegments[0].speaker).toBe('ADA LOVELACE');
    expect(allSegments.length).toBeGreaterThanOrEqual(16);
  });

  it('strips a Qwen-style <think> block before the council', async () => {
    const qwen = `<think>\nThe moderator opens. Keep it short.\n</think>\n\n${body}`;
    const replay = await replayFreeTier(qwen);
    expectCleanOpening(replay);
    expect(replay.fullResponse).not.toContain('moderator opens');
  });
});

describe('council replay: a tail that opens on a word', () => {
  // The recording without its leading space: 181 characters, past the chat
  // reader's 140-character hold, so the reader releases it before </think>.
  const wordTail = recording.slice(1);

  beforeEach(() => {
    (generator as any).onProgressiveSegment = null;
  });

  it('keeps the first speaker\'s opening on the free tier', async () => {
    expect(wordTail.startsWith('Never')).toBe(true);
    const replay = await replayFreeTier(wordTail);
    expectCleanOpening(replay);
    expect(replay.allSegments).toHaveLength(17);
  });

  it('keeps the first speaker\'s opening through the real BYOK chain', async () => {
    const replay = await replayByokChain(wordTail);
    expectCleanOpening(replay);
    expect(replay.allSegments).toHaveLength(17);
  });

  it('keeps the recorded council whole through the real BYOK chain', async () => {
    const replay = await replayByokChain(recording);
    expectCleanOpening(replay);
    expect(replay.allSegments).toHaveLength(17);
  });
});

describe('council replay: the closing line', () => {
  it('keeps the last speaker\'s line when the stream ends without a newline', async () => {
    expect(recording.endsWith('\n')).toBe(false);
    const { allSegments, streamed } = await replayFreeTier(recording);
    expect(allSegments).toHaveLength(17);
    const counts: Record<string, number> = {};
    for (const s of allSegments) counts[s.speaker] = (counts[s.speaker] ?? 0) + 1;
    expect(counts).toEqual({ 'ADA LOVELACE': 6, 'ALBERT EINSTEIN': 6, 'ARTHUR SCHOPENHAUER': 5 });
    const last = allSegments[allSegments.length - 1];
    expect(last.speaker).toBe('ADA LOVELACE');
    expect(last.content.startsWith('Ein Geschenk, das wir weitergeben können.')).toBe(true);
    expect(last.content.endsWith('Danke, Albert. Danke, Arthur.')).toBe(true);
    // The TextChunker splits this over-long sentence after "kann,".
    expect(last.content).toContain('die man nicht füllen kann, und den Tönen');
    expect(streamed).toHaveLength(17);
  });
});
