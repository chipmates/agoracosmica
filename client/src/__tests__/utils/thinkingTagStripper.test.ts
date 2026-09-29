import { describe, expect, it } from 'vitest';
import {
  createThinkingTagFilter,
  stripThinkingTagsFromText,
} from '../../utils/thinkingTagStripper';

// Feed chunks through a fresh filter the way a stream would, then flush.
function streamThrough(chunks: string[]): { outputs: string[]; flushed: string; text: string } {
  const f = createThinkingTagFilter();
  const outputs = chunks.map((c) => f.filter(c));
  const flushed = f.flush();
  return { outputs, flushed, text: outputs.join('') + flushed };
}

describe('stripThinkingTagsFromText', () => {
  it('returns empty input unchanged', () => {
    expect(stripThinkingTagsFromText('')).toBe('');
  });

  it('leaves text without a block as it is, apart from trimming', () => {
    expect(stripThinkingTagsFromText('The unexamined life is not worth living.'))
      .toBe('The unexamined life is not worth living.');
    expect(stripThinkingTagsFromText('  padded  \n')).toBe('padded');
  });

  it('removes a leading block and the whitespace after it', () => {
    const input = '<think>The user asks about virtue.\nKeep it short.</think>\n\nVirtue is its own reward.';
    expect(stripThinkingTagsFromText(input)).toBe('Virtue is its own reward.');
  });

  it('removes every block when there is more than one', () => {
    const input = 'A<think>first</think>B<think>second</think>C';
    expect(stripThinkingTagsFromText(input)).toBe('ABC');
  });

  it('keeps the text between two blocks (the match is not greedy)', () => {
    const input = '<think>one</think>kept<think>two</think>';
    expect(stripThinkingTagsFromText(input)).toBe('kept');
  });

  it('leaves an unclosed block in place', () => {
    // Only complete blocks are removed; the streaming filter handles truncation.
    const input = 'Answer <think>never closed';
    expect(stripThinkingTagsFromText(input)).toBe('Answer <think>never closed');
  });
});

describe('createThinkingTagFilter', () => {
  it('passes text without a block straight through', () => {
    const { outputs, flushed } = streamThrough(['Know ', 'thyself', '.']);
    expect(outputs).toEqual(['Know ', 'thyself', '.']);
    expect(flushed).toBe('');
  });

  it('returns an empty string for an empty chunk', () => {
    const f = createThinkingTagFilter();
    expect(f.filter('')).toBe('');
    expect(f.isStripping()).toBe(false);
  });

  it('strips a block contained in a single chunk', () => {
    const { text } = streamThrough(['Before<think>hidden</think>After']);
    expect(text).toBe('BeforeAfter');
  });

  it('strips a block whose opening tag is split across two chunks', () => {
    const f = createThinkingTagFilter();
    // `<thi` could be the start of an opener, so it is held back.
    expect(f.filter('Hello <thi')).toBe('Hello ');
    expect(f.isStripping()).toBe(false);
    expect(f.filter('nk>secret</think>world')).toBe('world');
    expect(f.flush()).toBe('');
  });

  it('strips a block whose closing tag is split across two chunks', () => {
    const f = createThinkingTagFilter();
    expect(f.filter('<think>reasoning</th')).toBe('');
    expect(f.isStripping()).toBe(true);
    expect(f.filter('ink>answer')).toBe('answer');
    expect(f.isStripping()).toBe(false);
  });

  it('strips a block streamed one character at a time', () => {
    const input = 'Hi <think>scratchpad</think>there';
    const { text } = streamThrough(input.split(''));
    expect(text).toBe('Hi there');
  });

  it('strips several blocks in the same chunk', () => {
    const { text } = streamThrough(['A<think>1</think>B<think>2</think>C']);
    expect(text).toBe('ABC');
  });

  it('strips several blocks spread across chunks', () => {
    const { text } = streamThrough(['A<think>1</thi', 'nk>B<th', 'ink>2</think>C']);
    expect(text).toBe('ABC');
  });

  it('drops an unclosed block at the end of the stream', () => {
    const f = createThinkingTagFilter();
    expect(f.filter('Answer <think>truncated')).toBe('Answer ');
    expect(f.filter(' reasoning')).toBe('');
    expect(f.isStripping()).toBe(true);
    expect(f.flush()).toBe('');
  });

  it('releases a held-back fragment that turns out not to be a tag', () => {
    const f = createThinkingTagFilter();
    expect(f.filter('a <')).toBe('a ');
    expect(f.filter('b')).toBe('<b');
    expect(f.filter('the <think')).toBe('the ');
    expect(f.filter('er')).toBe('<thinker');
    expect(f.isStripping()).toBe(false);
  });

  it('returns a held-back fragment on flush when the stream ends on it', () => {
    const { outputs, flushed, text } = streamThrough(['ends with <thi']);
    expect(outputs).toEqual(['ends with ']);
    expect(flushed).toBe('<thi');
    expect(text).toBe('ends with <thi');
  });

  it('keeps separate state for each filter', () => {
    const a = createThinkingTagFilter();
    const b = createThinkingTagFilter();
    a.filter('<think>open');
    expect(a.isStripping()).toBe(true);
    expect(b.isStripping()).toBe(false);
    expect(b.filter('plain')).toBe('plain');
  });
});
