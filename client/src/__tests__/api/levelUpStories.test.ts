// The swipe shows the figures with a Level Up 2 story first in each category;
// everything else keeps its order behind them.
import { describe, it, expect } from 'vitest';
import { historicalFiguresBase, type FigureCategory } from '../../api/figures';
import { LEVEL_UP_2_FIGURES, hasLevelUp2Story, levelUp2First } from '../../api/levelUpStories';

const CATEGORIES: FigureCategory[] = ['sages', 'reformers', 'creators'];
const ids = (list: readonly { id: string }[]) => list.map((f) => f.id);
const inCategory = (list: readonly (typeof historicalFiguresBase)[number][], category: FigureCategory) =>
  list.filter((f) => f.category === category);

describe('LEVEL_UP_2_FIGURES', () => {
  it('names only known figures, each once', () => {
    const known = new Set(ids(historicalFiguresBase));
    for (const id of LEVEL_UP_2_FIGURES) expect(known.has(id), id).toBe(true);
    expect(new Set(LEVEL_UP_2_FIGURES).size).toBe(LEVEL_UP_2_FIGURES.length);
  });

  it('answers by id', () => {
    expect(hasLevelUp2Story('aurelius')).toBe(true);
    expect(hasLevelUp2Story('plato')).toBe(false);
  });
});

describe('levelUp2First', () => {
  it('puts the story figures first and keeps both groups in their order', () => {
    const input = [{ id: 'plato' }, { id: 'laozi' }, { id: 'bingen' }, { id: 'aurelius' }, { id: 'zenji' }];
    expect(ids(levelUp2First(input))).toEqual(['laozi', 'aurelius', 'plato', 'bingen', 'zenji']);
  });

  it('returns a new array and leaves the input alone', () => {
    const input = Object.freeze([{ id: 'plato' }, { id: 'laozi' }]);
    const out = levelUp2First(input);
    expect(out).not.toBe(input);
    expect(ids(input)).toEqual(['plato', 'laozi']);
  });

  it('orders every carousel category story-first without dropping or adding a figure', () => {
    const ordered = levelUp2First(historicalFiguresBase);
    for (const category of CATEGORIES) {
      const base = ids(inCategory(historicalFiguresBase, category));
      const after = ids(inCategory(ordered, category));
      expect([...after].sort()).toEqual([...base].sort());

      const firstRest = after.findIndex((id) => !hasLevelUp2Story(id));
      const story = firstRest === -1 ? after : after.slice(0, firstRest);
      const rest = firstRest === -1 ? [] : after.slice(firstRest);
      expect(rest.some(hasLevelUp2Story), category).toBe(false);
      expect(story).toEqual(base.filter(hasLevelUp2Story));
      expect(rest).toEqual(base.filter((id) => !hasLevelUp2Story(id)));
    }
  });

  it('keeps the figure the carousel opens on', () => {
    const sages = inCategory(levelUp2First(historicalFiguresBase), 'sages');
    expect(sages[0]?.id).toBe(inCategory(historicalFiguresBase, 'sages')[0]?.id);
  });
});
