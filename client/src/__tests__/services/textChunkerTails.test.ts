import { describe, expect, it } from 'vitest';
import { TextChunker } from '../../services/audio/llm/llmUtils';
import { CustomCouncilParser } from '../../services/council/parser';

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

describe('TextChunker merges a short last line', () => {
  // Two lines of one sentence each, long enough to be a chunk apiece, so the
  // short last line is a chunk of its own and merges into the held one.
  const ada = 'ADA LOVELACE :: Die Maschine webt algebraische Muster, so wie der Jacquard-Webstuhl Blumen und Blätter webt, '
    + 'und doch fragt sie nie, warum ein Muster schön ist.';
  const arthur = 'ARTHUR SCHOPENHAUER :: Der Wille kennt kein Ziel, nur das nächste Verlangen, und wer das einmal gesehen hat, '
    + 'sucht kein Glück mehr, nur den Augenblick, in dem er stillhält.';
  const closing = `${ada}\n\n${arthur}\n\nADA LOVELACE :: Danke.`;

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

  async function streamed(text: string): Promise<string[]> {
    const out: string[] = [];
    const chunker = new TextChunker('de');
    for (const d of tokenDeltas(text)) await chunker.processChunk(d, async (c) => { out.push(c); });
    await chunker.finish(async (c) => { out.push(c); });
    return out;
  }

  it('keeps the line break before the next speaker\'s label', async () => {
    for (const chunks of [await chunksOf(closing), await streamed(closing)]) {
      expect(chunks.join('')).toContain('stillhält.\n\nADA LOVELACE :: Danke.');
    }
  });

  it('leaves the short last line to its own speaker', async () => {
    for (const chunks of [await chunksOf(closing), await streamed(closing)]) {
      const parser = new CustomCouncilParser({ participants: ['ARTHUR SCHOPENHAUER', 'ADA LOVELACE'], mode: 'debate' });
      for (const c of chunks) parser.processChunk(c);
      const segments = parser.complete().segments;
      expect(segments.map((s) => s.speaker)).toEqual(['ADA LOVELACE', 'ARTHUR SCHOPENHAUER', 'ADA LOVELACE']);
      expect(segments[2].content).toBe('Danke.');
    }
  });

  it('still merges a short last sentence on the same line with a space', async () => {
    const chunks = await chunksOf(`${ada} ${arthur.replace('ARTHUR SCHOPENHAUER :: ', '')} Danke.`);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[chunks.length - 1]).toMatch(/stillhält\. Danke\.$/);
  });
});
