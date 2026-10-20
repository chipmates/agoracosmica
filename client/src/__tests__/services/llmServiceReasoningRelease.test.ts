// When an own-key or Local Mode reply starts to show. A reply that opens on a
// word or a line break shows once the TextChunker could use it; one that opens
// with a single space, as the seen reasoning tails do, waits for a tag on
// OpenRouter but not on a local server, which can open a clean reply that way.
import { describe, it, expect, vi } from 'vitest';
import reply from '../fixtures/chat-de-reply.txt?raw';
import { llmService } from '../../services/llm/llmService';
import { buildCustomOpenAIConfig } from '../../services/llm/types';
import { FIRST_CHUNK_FLOOR, TAIL_HOLD_MAX } from '../../utils/thinkingTagStripper';

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

function sseResponse(text: string): Response {
  let sse = '';
  for (const piece of tokenDeltas(text)) {
    sse += `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`;
  }
  sse += 'data: [DONE]\n\n';
  return new Response(new TextEncoder().encode(sse), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

async function firstVisible(text: string, local = false): Promise<{ first: string; all: string }> {
  vi.mocked(global.fetch).mockImplementation(async () => sseResponse(text));
  const seen: string[] = [];
  await llmService.chat({
    messages: [{ role: 'user', content: 'Was macht ein gutes Leben aus?' }],
    apiKey: local ? '' : `sk-or-v1-${'a'.repeat(64)}`,
    streamCallback: (chunk: string) => { seen.push(chunk); },
    ...(local ? { providerConfig: buildCustomOpenAIConfig('http://localhost:1234/v1') } : {}),
  });
  return { first: seen[0] ?? '', all: seen.join('') };
}

const atFloor = (first: string) => first.length >= FIRST_CHUNK_FLOOR && first.length < FIRST_CHUNK_FLOOR + 8;

describe('llmService: when a reply starts to show', () => {
  it('shows a reply that opens on line breaks at the chunker floor', async () => {
    const { first, all } = await firstVisible(`\n\n${reply}`);
    expect(atFloor(first)).toBe(true);
    expect(all).toBe(`\n\n${reply}`);
  });

  it('shows a reply that opens on a word at the chunker floor', async () => {
    expect(atFloor((await firstVisible(reply)).first)).toBe(true);
  });

  it('holds a reply that opens with one space on OpenRouter', async () => {
    const { first } = await firstVisible(` ${reply}`);
    expect(first.length).toBeGreaterThanOrEqual(Math.min(TAIL_HOLD_MAX, reply.length + 1));
  });

  it('shows a reply that opens with one space at the chunker floor on a local server', async () => {
    const { first, all } = await firstVisible(` ${reply}`, true);
    expect(atFloor(first)).toBe(true);
    expect(all).toBe(` ${reply}`);
  });
});
