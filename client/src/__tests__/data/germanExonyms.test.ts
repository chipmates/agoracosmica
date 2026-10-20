// German searchers use their own forms of four names (Mark Aurel, Platon,
// Buddha, Laotse). The German page title and the Person schema have to carry
// them, or the pages miss the searches that use them.
import { describe, it, expect } from 'vitest';
import { getFigureSeo } from '../../data/public/figureSeo';

describe('German exonyms', () => {
  it('names Laotse in the German Laozi title, within 60 characters', () => {
    const title = getFigureSeo('laozi', 'de')?.seoTitle ?? '';
    expect(title).toMatch(/\bLaotse\b/);
    expect(title).toMatch(/\bLaozi\b/);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it('keeps the other three exonyms in their German titles', () => {
    expect(getFigureSeo('aurelius', 'de')?.seoTitle).toMatch(/Mark Aurel/);
    expect(getFigureSeo('plato', 'de')?.seoTitle).toMatch(/\bPlaton\b/);
    expect(getFigureSeo('gautama', 'de')?.seoTitle).toMatch(/\bBuddha\b/);
  });
});
