import { describe, expect, it } from 'vitest';
import councilRecording from '../fixtures/council-de-reasoning-tail.txt?raw';
import reply from '../fixtures/chat-de-reply.txt?raw';
import {
  createReasoningFilter,
  stripReasoningFromText,
  releaseChatStart,
  FIRST_CHUNK_FLOOR,
  TAIL_HOLD_MAX,
} from '../../utils/thinkingTagStripper';
import { TextChunker, getLanguageParameters } from '../../services/audio/llm/llmUtils';

const TAIL_END = '</think>';
const tail = councilRecording.slice(0, councilRecording.indexOf(TAIL_END) + TAIL_END.length);

const ENGLISH_REPLY =
  'Anger at yourself is the heaviest kind. It sits in the stomach and whispers that you failed. ' +
  'I knew that voice on the Danube, night after night. What quieted it was not a better plan. ' +
  'It was the plain work of the next morning, done without a speech to myself. Start there.';

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

function through(chunks: string[]): string {
  const f = createReasoningFilter();
  return chunks.map((c) => f.push(c)).join('') + f.flush();
}

/** Delta index at which each TextChunker chunk comes out, with or without the filter. */
async function chunkTimeline(deltas: string[], language: string, filtered: boolean) {
  const chunker = new TextChunker(language);
  const filter = createReasoningFilter();
  const emitted: { at: number; text: string }[] = [];
  for (let i = 0; i < deltas.length; i++) {
    const text = filtered ? filter.push(deltas[i]) : deltas[i];
    await chunker.processChunk(text, async (c) => { emitted.push({ at: i, text: c }); });
  }
  const end = deltas.length;
  if (filtered) {
    await chunker.processChunk(filter.flush(), async (c) => { emitted.push({ at: end, text: c }); });
  }
  await chunker.finish(async (c) => { emitted.push({ at: end, text: c }); });
  return emitted;
}

describe('createReasoningFilter: a tail with no opening tag', () => {
  it('drops the recorded tail streamed in token deltas', () => {
    expect(through(tokenDeltas(tail + reply))).toBe(reply);
  });

  it('drops the recorded tail when it arrives in one piece', () => {
    expect(through([tail + reply])).toBe(reply);
  });

  it('drops a closing tag that opens the stream, split across deltas', () => {
    expect(through(['</', 'thi', 'nk>', 'Der Kaffee ', 'danach.'])).toBe('Der Kaffee danach.');
  });

  it('drops a short tail that opens on a word', () => {
    expect(through(tokenDeltas(`Keep it short.</think>${reply}`))).toBe(reply);
  });

  it('keeps every tail seen so far inside the hold', () => {
    expect(tail.length - TAIL_END.length).toBe(182);
    expect(tail.length).toBeLessThan(TAIL_HOLD_MAX);
    expect(tail.startsWith(' ')).toBe(true);
  });
});

describe('createReasoningFilter: <think> blocks', () => {
  it('strips a leading block', () => {
    expect(through(tokenDeltas(`<think>\nThe visitor asks.\n</think>\n\n${reply}`)).trim()).toBe(reply);
  });

  it('strips a block in the middle of a reply', () => {
    const text = `${ENGLISH_REPLY.slice(0, 160)}<think>aside</think>${ENGLISH_REPLY.slice(160)}`;
    expect(through(tokenDeltas(text))).toBe(ENGLISH_REPLY);
  });

  it('drops an unclosed block at the end', () => {
    expect(through(tokenDeltas(`${ENGLISH_REPLY}<think>cut off`))).toBe(ENGLISH_REPLY);
  });
});

describe('createReasoningFilter: after the start', () => {
  it('turns a stray closing tag split across deltas into a line break', () => {
    const f = createReasoningFilter();
    const out = [ENGLISH_REPLY.slice(0, 150), ' more</th', 'ink> words.'].map((c) => f.push(c)).join('') + f.flush();
    expect(out).toBe(`${ENGLISH_REPLY.slice(0, 150)} more\n words.`);
  });

  it('passes an angle bracket that is not a tag', () => {
    expect(through(tokenDeltas('Less is more: 3 < 4, and a <b> is no tag.'))).toBe('Less is more: 3 < 4, and a <b> is no tag.');
  });

  it('returns a short reply whole at the end of the stream', () => {
    expect(through(['Ja.'])).toBe('Ja.');
    expect(through([' Ja.'])).toBe(' Ja.');
  });

  it('returns nothing for an empty stream', () => {
    expect(through([])).toBe('');
    expect(through(['', ''])).toBe('');
  });
});

describe('createReasoningFilter: when the start is released', () => {
  it('releases a stream that opens on a word at the chunker floor', () => {
    expect(releaseChatStart('x'.repeat(FIRST_CHUNK_FLOOR - 1))).toBe(false);
    expect(releaseChatStart('x'.repeat(FIRST_CHUNK_FLOOR))).toBe(true);
  });

  it('holds a stream that opens on whitespace up to the tail hold', () => {
    expect(releaseChatStart(` ${'x'.repeat(FIRST_CHUNK_FLOOR)}`)).toBe(false);
    expect(releaseChatStart(`\n${'x'.repeat(TAIL_HOLD_MAX - 1)}`)).toBe(true);
  });

  it('holds no longer than the chunker would before its first chunk', () => {
    for (const language of ['en', 'de']) {
      const { minChars } = getLanguageParameters(language).params;
      expect(FIRST_CHUNK_FLOOR).toBeLessThanOrEqual(minChars + 60);
    }
  });

  it('shows a clean reply at the same delta as without the filter', async () => {
    for (const [text, language] of [[reply, 'de'], [ENGLISH_REPLY, 'en'], [reply.slice(0, 120), 'de']] as const) {
      const deltas = tokenDeltas(text);
      const today = await chunkTimeline(deltas, language, false);
      const filtered = await chunkTimeline(deltas, language, true);
      expect(filtered).toEqual(today);
    }
  });

  it('bounds the wait for a clean reply that opens on whitespace', async () => {
    const text = `\n\n${reply}`;
    const deltas = tokenDeltas(text);
    const filtered = await chunkTimeline(deltas, 'de', true);
    let sent = 0;
    let holdEnd = deltas.length;
    for (let i = 0; i < deltas.length; i++) {
      sent += deltas[i].length;
      if (sent >= TAIL_HOLD_MAX) { holdEnd = i; break; }
    }
    expect(filtered[0].at).toBeLessThanOrEqual(holdEnd);
    expect(filtered.map((c) => c.text).join(' ')).toContain('Der Kaffee danach.');
  });
});

describe('stripReasoningFromText', () => {
  it('cleans a whole response by the same rules', () => {
    expect(stripReasoningFromText(tail + reply)).toBe(reply);
    expect(stripReasoningFromText(`<think>a</think>\n${ENGLISH_REPLY}`)).toBe(ENGLISH_REPLY);
    expect(stripReasoningFromText(`  ${ENGLISH_REPLY}  `)).toBe(ENGLISH_REPLY);
    expect(stripReasoningFromText('')).toBe('');
  });
});
