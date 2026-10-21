// German searchers use their own forms of four names (Mark Aurel, Platon,
// Buddha, Laotse). The German page title and the Person schema have to carry
// them, or the pages miss the searches that use them. The lead paragraph
// names the form once, as the Mark Aurel lead does.
import { describe, it, expect } from 'vitest';
import { getFigureSeo } from '../../data/public/figureSeo';
import { getFigureQA } from '../../data/public/figureQA';
import { personSchema } from '../../../../marketing/src/lib/schemas';

const person = (slug: string, name: string, lang: 'de' | 'en') =>
  personSchema({ name, about: '', period: '', tradition: '', slug, lang });

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

  it('gives the German Person schema the other searched names', () => {
    expect(person('laozi', 'Laozi', 'de').alternateName).toEqual(['Laotse']);
    expect(person('siddhartha-gautama', 'Siddhartha Gautama', 'de').alternateName).toEqual(['Buddha']);
    expect(person('marcus-aurelius', 'Mark Aurel', 'de').alternateName).toEqual(['Marc Aurel', 'Marcus Aurelius']);
    expect(person('plato', 'Platon', 'de').alternateName).toEqual(['Plato']);
  });

  it('names Laotse once in the German Laozi lead, right after the first Laozi', () => {
    const lead = getFigureQA('laozi', 'de')?.pairs[0].a ?? '';
    expect(lead.startsWith('Laozi (auch Laotse) ist der chinesische Denker')).toBe(true);
    expect(lead.match(/Laotse/g)).toHaveLength(1);
    expect(getFigureQA('aurelius', 'de')?.pairs[0].a).toMatch(/^Mark Aurel \(auch Marc Aurel, /);
    expect(getFigureQA('laozi', 'en')?.pairs[0].a).not.toMatch(/Laotse/);
  });

  it('leaves English pages and figures without an exonym alone', () => {
    expect(person('laozi', 'Laozi', 'en').alternateName).toBeUndefined();
    expect(person('albert-einstein', 'Albert Einstein', 'de').alternateName).toBeUndefined();
  });
});
