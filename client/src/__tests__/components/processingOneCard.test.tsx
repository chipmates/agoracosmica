// A message on its way shows one waiting card: the composer's, which knows the
// stage and offers to read instead. The page's own card, for a first load,
// steps aside while a request is pending, whichever way the message came
// (typed, spoken, push-to-talk). And no card says "<name> ist <line>", which
// German does not allow ("Mark Aurel ist denkt ...").
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ lang: 'de' as 'en' | 'de', cards: [] as Array<string | undefined> }));

vi.mock('../../hooks/useTranslation', async () => {
  const bundles = {
    en: (await import('../../assets/translations/ui-en.json')).default,
    de: (await import('../../assets/translations/ui-de.json')).default,
  };
  const lookup = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
  const t = (key: string, fallback?: string) => {
    const value = lookup(bundles[h.lang], key);
    return typeof value === 'string' ? value : fallback ?? '';
  };
  const api = () => ({ tString: t, tNode: t, t, language: h.lang });
  return { default: api, useTranslation: api };
});
vi.mock('../../hooks/useLiquidGlass', () => ({ useLiquidGlass: () => ({ glassClasses: '' }) }));

import ProcessingLoader from '../../components/ProcessingLoader';
import de from '../../assets/translations/ui-de.json';
import en from '../../assets/translations/ui-en.json';

/** Every text the card shows over `seconds`, read every half second. */
function cardText(stage: 'preparing' | 'hearing' | 'contemplating' | 'shaping' | undefined, seconds: number): string[] {
  const seen = new Set<string>();
  render(<ProcessingLoader figureName={h.lang === 'de' ? 'Echo von Mark Aurel' : 'Echo of Marcus Aurelius'} stage={stage} />);
  for (let t = 0; t < seconds * 1000; t += 500) {
    act(() => { vi.advanceTimersByTime(500); });
    document.querySelectorAll('.cosmic-processing-subtitle, .cosmic-processing-quote, .cosmic-processing-note').forEach((el) => {
      if (el.textContent) seen.add(el.textContent.trim());
    });
  }
  return [...seen];
}

describe('the waiting card speaks in whole sentences', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.lang = 'de';
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  for (const lang of ['de', 'en'] as const) {
    it(`${lang}: without a stage the name stands alone and every line is a sentence of its own`, () => {
      h.lang = lang;
      const bundle = lang === 'de' ? de : en;
      const name = lang === 'de' ? 'Mark Aurel' : 'Aurelius';
      const shown = cardText(undefined, 12);

      expect(shown).toContain(name);
      for (const line of shown) {
        expect(line).not.toMatch(new RegExp(`^${name}\\s+(ist|is)\\b`));
      }
      const lines = shown.filter((line) => line !== name);
      const pools = [
        ...Object.values(bundle.processing.normal.contemplating),
        ...Object.values(bundle.processing.highDemand.contemplating),
      ];
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(pools).toContain(line);
    });
  }

  it('the old "<name> ist" pieces are gone from both languages', () => {
    for (const bundle of [de, en]) {
      const processing = bundle.processing as Record<string, unknown>;
      for (const key of ['contemplating', 'crafting', 'considering', 'exploring', 'reflecting', 'connecting']) {
        expect(typeof processing[key]).not.toBe('string');
      }
    }
  });
});
