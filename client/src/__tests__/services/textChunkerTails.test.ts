import { describe, expect, it } from 'vitest';
import { TextChunker } from '../../services/audio/llm/llmUtils';

async function chunksOf(text: string, lang = 'de'): Promise<string[]> {
  const out: string[] = [];
  const chunker = new TextChunker(lang);
  await chunker.processChunk(text, async (c) => { out.push(c); });
  await chunker.finish(async (c) => { out.push(c); });
  return out;
}

describe('TextChunker holds non-terminal periods', () => {
  it('keeps a German date together', async () => {
    const text = 'Wir treffen uns am 13. Mai in Rom, wenn die Tage länger werden und die Stadt wieder atmet. Das ist alles, was ich weiß.';
    const chunks = await chunksOf(text);
    expect(chunks.join(' ')).toContain('am 13. Mai');
    expect(chunks.some((c) => /am 13\.\s*$/.test(c))).toBe(false);
  });

  it('keeps a regnal numeral with its verb', async () => {
    const text = 'Ludwig XIV. baute Versailles in einem Jahrhundert, das nichts Kleines kannte und alles vergoldete. Danach kam die Stille.';
    const chunks = await chunksOf(text);
    expect(chunks.some((c) => /XIV\.\s*$/.test(c))).toBe(false);
  });

  it('keeps a title with its name in English', async () => {
    const text = 'I read the letter from Dr. Miller twice before I understood what he was asking of me that winter. Then I burned it.';
    const chunks = await chunksOf(text, 'en');
    expect(chunks.some((c) => /Dr\.\s*$/.test(c))).toBe(false);
  });

  it('still ends a real sentence on a year', async () => {
    const text = 'Sie starb 1954. Danach war das Haus leer, und niemand kam mehr die Treppe herauf, um nach dem Garten zu sehen.';
    const chunks = await chunksOf(text);
    expect(chunks.join(' ')).toContain('1954.');
  });

  it('flushes a held tail at the end of the stream', async () => {
    const chunks = await chunksOf('Es war der 3.', 'de');
    expect(chunks.join(' ').trim()).toBe('Es war der 3.');
  });
});
