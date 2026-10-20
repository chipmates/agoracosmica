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

describe('TextChunker splits an over-long sentence', () => {
  const words = (s: string) => s.trim().split(/\s+/);

  it('keeps the space at a clause split, so joined chunks keep their words apart', async () => {
    const closing = 'Ich nehme von diesem Gespräch mit, dass ein gutes Leben kein Zustand ist, den man erreicht, '
      + 'sondern ein Muster, das man webt, Faden für Faden, mit den Löchern, die man nicht füllen kann, '
      + 'und den Tönen, die zwischen den Tönen liegen, und mit allem, was wir einander heute gesagt haben. Danke.';
    const chunks = await chunksOf(closing);
    expect(chunks.length).toBeGreaterThan(1);
    expect(words(chunks.join(''))).toEqual(words(closing));
  });

  it('keeps the space at a split on a plain space', async () => {
    const long = `${'Das ist ein sehr langer Satz ohne jede Pause '.repeat(8).trim()}.`;
    const chunks = await chunksOf(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(words(chunks.join(''))).toEqual(words(long));
  });

  it('keeps the space after a long English chunk that ends a sentence', async () => {
    const text = `${'This clause runs on, '.repeat(16)}and then it stops. The next sentence follows here and ends.`;
    const chunks = await chunksOf(text, 'en');
    expect(words(chunks.join(''))).toEqual(words(text));
  });
});
