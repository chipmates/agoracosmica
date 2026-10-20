// Replays a chat reply that opens with a reasoning tail through the real chat
// path: the stream driver's callback (the bubble and the voice), generateResponse,
// and either the free tier (worker SSE -> parseSSEStream -> TextChunker) or BYOK
// (llmService -> llmAdapter's TextChunker). Only the network, the session token,
// the key store, the store state and the TTS call are stand-ins.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import councilRecording from '../fixtures/council-de-reasoning-tail.txt?raw';
import reply from '../fixtures/chat-de-reply.txt?raw';

const harness = vi.hoisted(() => ({
  byok: false,
  spoken: [] as string[],
  urls: [] as string[],
  state: {} as Record<string, unknown>,
}));

vi.mock('../../services/proxy/sessionManager', () => ({
  getSessionToken: vi.fn(async () => 'test-token'),
  invalidateToken: vi.fn(),
}));

vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    hasUsableKey: vi.fn(async () => harness.byok),
    getKey: vi.fn(async () => `sk-or-v1-${'a'.repeat(64)}`),
    markInvalid: vi.fn(async () => {}),
  },
}));

vi.mock('../../services/audio/instructionProcessor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/audio/instructionProcessor')>()),
  fetchInstructions: vi.fn(async () => 'system prompt'),
}));

vi.mock('../../services/audio/tts', () => ({
  convertTextToSpeech: vi.fn(async (text: string, index: string) => {
    harness.spoken.push(text);
    return { url: `blob:${index}`, name: index };
  }),
}));

vi.mock('../../services/audio/tts/ttsSessions', () => ({
  getOrRollConversationSessionId: () => 'session-1',
  touchConversationSession: () => {},
}));

vi.mock('../../services/audio/audioQueueManager', () => ({
  addToAudioQueue: vi.fn(),
  setCurrentSession: vi.fn(),
  cleanupAudioResources: vi.fn(),
  getBufferDurationSeconds: () => 0,
}));

vi.mock('../../stores/domainStore', () => ({
  useDomainStore: { getState: () => harness.state },
}));

vi.mock('../../stores', () => ({
  useDomainStore: { getState: () => harness.state },
}));

import { createLegacyConversationStream } from '../../controllers/conversationStreamDriver';
import type { StreamConversationParams } from '../../controllers/conversationController';

const TAIL_END = '</think>';
const tail = councilRecording.slice(0, councilRecording.indexOf(TAIL_END) + TAIL_END.length);

function resetState() {
  harness.state = {
    figures: { selectedId: 'aurelius' },
    mode: { selected: 'free_conversation' },
    seeds: { selectedId: null, byFigure: { aurelius: [] } },
    language: { current: 'de' },
    conversation: { historyKey: 'thread-1', messages: [] },
    setProcessingStage: () => {},
    setQuota: () => {},
    setEndpointQuota: () => {},
    setFreeTierState: () => {},
    openRateLimitModal: () => {},
  };
}

// Token-sized deltas (1 to 7 characters, fixed pattern), as the model streams.
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

type Replay = { shown: string; spoken: string; urls: string[] };

/** One chat turn through the stream driver, the way the composer's send runs it. */
async function replayChat(streamText: string, byok: boolean): Promise<Replay> {
  harness.byok = byok;
  harness.spoken = [];
  harness.urls = [];
  vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL) => {
    harness.urls.push(String(input));
    return sseResponse(streamText);
  });
  const shown: string[] = [];
  const stream = createLegacyConversationStream();
  await stream({
    requestId: `r-${Math.random()}`,
    threadKey: 'thread-1',
    messages: [{ role: 'user', content: 'Was macht für dich ein gutes Leben aus?' }] satisfies StreamConversationParams['messages'],
    signal: new AbortController().signal,
    pushAssistantText: (chunk: string) => shown.push(chunk),
  });
  // The scheduler speaks asynchronously; let its queue drain.
  for (let i = 0; i < 20 && harness.spoken.length < shown.length; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
  return { shown: shown.join(' '), spoken: harness.spoken.join(' '), urls: harness.urls };
}

const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

function expectCleanReply({ shown, spoken }: Replay) {
  for (const text of [shown, spoken]) {
    expect(text).not.toContain('think');
    expect(text).not.toContain('Never');
    expect(flat(text).startsWith('Der Kaffee danach. Ja.')).toBe(true);
    expect(flat(text).endsWith('das bin ich nicht.')).toBe(true);
  }
}

describe('chat replay: a reasoning tail without an opening tag', () => {
  beforeEach(() => {
    resetState();
  });

  it('runs the free tier through the worker route', async () => {
    const { urls } = await replayChat(reply, false);
    expect(urls.some((u) => u.endsWith('/v1/chat'))).toBe(true);
  });

  it('runs BYOK through the provider route', async () => {
    const { urls } = await replayChat(reply, true);
    expect(urls.some((u) => u.endsWith('/chat/completions'))).toBe(true);
  });

  it('keeps the tail off the bubble and the voice on the free tier', async () => {
    expectCleanReply(await replayChat(tail + reply, false));
  });

  it('keeps the tail off the bubble and the voice on BYOK', async () => {
    expectCleanReply(await replayChat(tail + reply, true));
  });

  it('strips a <think> block on the free tier', async () => {
    expectCleanReply(await replayChat(`<think>\nThe visitor asks. Never lecture.\n</think>\n\n${reply}`, false));
  });

  it('strips a <think> block on BYOK', async () => {
    expectCleanReply(await replayChat(`<think>\nThe visitor asks. Never lecture.\n</think>\n\n${reply}`, true));
  });

  it('shows and speaks a clean reply whole on both paths', async () => {
    for (const byok of [false, true]) {
      const { shown, spoken } = await replayChat(reply, byok);
      expect(flat(shown)).toBe(flat(reply));
      expect(flat(spoken)).toBe(flat(reply));
    }
  });
});
