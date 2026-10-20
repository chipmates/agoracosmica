import { describe, it, expect } from 'vitest';
import {
  createCouncilReasoningFilter,
  stripCouncilReasoning,
} from '../../services/council/reasoningFilter';
import { CustomCouncilParser } from '../../services/council/parser';

const SCRIPT = [
  'ADA LOVELACE :: Der Messingstift der Spieldose drückte sich in meine Fingerkuppe.',
  'ALBERT EINSTEIN :: Der Abstand zwischen den Tönen. Das ist schön gesagt, Ada.',
  'ARTHUR SCHOPENHAUER :: Staunen. Nachjagen. Verfolgen.',
  'ADA LOVELACE :: Stillhalten. Aber Arthur, ist das nicht selbst ein Muster?',
].join('\n\n');
const TAIL = ' Never mention being an AI or discuss your training. Never glorify violence or suffering.';

function run(chunks: string[]): string {
  const f = createCouncilReasoningFilter();
  return chunks.map((c) => f.push(c)).join('') + f.flush();
}

function pieces(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

describe('council reasoning filter', () => {
  it('drops a reasoning tail that ends in </think> with no opening tag', () => {
    expect(run([`${TAIL}</think>${SCRIPT}`])).toBe(SCRIPT);
    for (const size of [1, 3, 7, 50, 140]) {
      expect(run(pieces(`${TAIL}</think>${SCRIPT}`, size))).toBe(SCRIPT);
    }
  });

  it('drops the tail when </think> is split across chunks', () => {
    expect(run([TAIL, '</thi', 'nk>', SCRIPT])).toBe(SCRIPT);
  });

  it('strips a Qwen-style <think> block, whole or split', () => {
    const qwen = `<think>\nThe moderator opens.\n</think>\n\n${SCRIPT}`;
    expect(run([qwen]).trim()).toBe(SCRIPT);
    expect(run(pieces(qwen, 4)).trim()).toBe(SCRIPT);
  });

  it('passes a stream with no reasoning through unchanged', () => {
    for (const size of [1, 5, 140, SCRIPT.length]) {
      expect(run(pieces(SCRIPT, size))).toBe(SCRIPT);
    }
  });

  it('releases a normal stream by the second speaker label', () => {
    const f = createCouncilReasoningFilter();
    const secondLabelEnd = SCRIPT.indexOf('ALBERT EINSTEIN ::') + 'ALBERT EINSTEIN ::'.length;
    let released = -1;
    let fed = 0;
    for (const c of pieces(SCRIPT, 3)) {
      fed += c.length;
      if (f.push(c) && released < 0) released = fed;
    }
    expect(released).toBeGreaterThan(0);
    expect(released).toBeLessThanOrEqual(secondLabelEnd + 3);
  });

  it('never delays a parsed segment on a stream with no reasoning', () => {
    const emitted = (withFilter: boolean): number[] => {
      const at: number[] = [];
      let step = 0;
      const parser = new CustomCouncilParser({
        participants: ['ADA LOVELACE', 'ALBERT EINSTEIN', 'ARTHUR SCHOPENHAUER'],
        mode: 'debate',
        onSegment: () => at.push(step),
      } as any);
      const f = createCouncilReasoningFilter();
      for (const c of pieces(SCRIPT, 3)) {
        step++;
        const text = withFilter ? f.push(c) : c;
        if (text) parser.processChunk(text);
      }
      return at;
    };
    expect(emitted(true)).toEqual(emitted(false));
    expect(emitted(true).length).toBeGreaterThan(0);
  });

  it('hands back held text at the end when no tag ever came', () => {
    expect(run(['Ein einzelner Satz ohne Sprecher.'])).toBe('Ein einzelner Satz ohne Sprecher.');
    expect(run(['ADA LOVELACE :: Nur eine Zeile.'])).toBe('ADA LOVELACE :: Nur eine Zeile.');
  });

  it('drops an unclosed <think> block at the end', () => {
    expect(run(['<think>never closed'])).toBe('');
  });

  it('cleans a whole response for the fallback parser', () => {
    expect(stripCouncilReasoning(`${TAIL}</think>${SCRIPT}`)).toBe(SCRIPT);
    expect(stripCouncilReasoning(`<think>x</think>\n${SCRIPT}\n`)).toBe(SCRIPT);
  });
});
