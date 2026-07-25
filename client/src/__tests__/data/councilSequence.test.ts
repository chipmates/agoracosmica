import { describe, it, expect } from 'vitest';
import {
  councilCatalog,
  COUNCIL_SEQUENCE,
  BLESSED_BY_THEME,
  THEMES,
  getNextStation,
  countCompletedInSequence,
  getInProgressCouncilId,
  getThemeCouncilsRanked,
} from '../../data/councilCatalog';

describe('COUNCIL_SEQUENCE', () => {
  it('covers every catalog council exactly once', () => {
    expect(COUNCIL_SEQUENCE.length).toBe(councilCatalog.length);
    expect(new Set(COUNCIL_SEQUENCE).size).toBe(COUNCIL_SEQUENCE.length);
    const catalogIds = new Set(councilCatalog.map(c => c.id));
    for (const id of COUNCIL_SEQUENCE) {
      expect(catalogIds.has(id)).toBe(true);
    }
  });

  it('opens with a standard-safety council', () => {
    const first = councilCatalog.find(c => c.id === COUNCIL_SEQUENCE[0]);
    expect(first?.safety).toBe('standard');
  });

  it('keeps deep-safety councils out of the first eight stations', () => {
    for (const id of COUNCIL_SEQUENCE.slice(0, 8)) {
      const c = councilCatalog.find(x => x.id === id);
      expect(c?.safety).not.toBe('deep');
    }
  });
});

describe('BLESSED_BY_THEME', () => {
  it('has exactly one pick per theme, matching the council theme', () => {
    expect(Object.keys(BLESSED_BY_THEME).sort()).toEqual(
      THEMES.map(t => t.id).sort()
    );
    for (const [theme, id] of Object.entries(BLESSED_BY_THEME)) {
      const c = councilCatalog.find(x => x.id === id);
      expect(c, `blessed pick ${id} exists`).toBeTruthy();
      expect(c?.theme).toBe(theme);
    }
  });

  it('blessed picks are exactly the first eight sequence stations', () => {
    const blessed = new Set(Object.values(BLESSED_BY_THEME));
    expect(new Set(COUNCIL_SEQUENCE.slice(0, 8))).toEqual(blessed);
  });
});

describe('getNextStation', () => {
  it('returns station 1 for a fresh visitor', () => {
    const next = getNextStation(() => false);
    expect(next?.station).toBe(1);
    expect(next?.council.id).toBe(COUNCIL_SEQUENCE[0]);
  });

  it('advances past completed stations', () => {
    const done = new Set(COUNCIL_SEQUENCE.slice(0, 3));
    const next = getNextStation(id => done.has(id));
    expect(next?.station).toBe(4);
    expect(next?.council.id).toBe(COUNCIL_SEQUENCE[3]);
  });

  it('skips non-contiguous completions', () => {
    const done = new Set([COUNCIL_SEQUENCE[0], COUNCIL_SEQUENCE[2]]);
    const next = getNextStation(id => done.has(id));
    expect(next?.station).toBe(2);
  });

  it('returns null when everything is completed', () => {
    expect(getNextStation(() => true)).toBeNull();
  });
});

describe('countCompletedInSequence', () => {
  it('counts only sequence members', () => {
    expect(countCompletedInSequence(() => false)).toBe(0);
    expect(countCompletedInSequence(() => true)).toBe(COUNCIL_SEQUENCE.length);
    const done = new Set(COUNCIL_SEQUENCE.slice(0, 5));
    expect(countCompletedInSequence(id => done.has(id))).toBe(5);
  });
});

describe('getInProgressCouncilId', () => {
  it('returns null with no progress anywhere', () => {
    expect(getInProgressCouncilId(() => false, () => false)).toBeNull();
  });

  it('returns the sequence-first in-progress council', () => {
    const progress = new Set([COUNCIL_SEQUENCE[4], COUNCIL_SEQUENCE[1]]);
    expect(getInProgressCouncilId(id => progress.has(id), () => false)).toBe(
      COUNCIL_SEQUENCE[1]
    );
  });

  it('ignores completed councils even with stale progress', () => {
    const progress = new Set([COUNCIL_SEQUENCE[1]]);
    const done = new Set([COUNCIL_SEQUENCE[1]]);
    expect(
      getInProgressCouncilId(id => progress.has(id), id => done.has(id))
    ).toBeNull();
  });
});

describe('getThemeCouncilsRanked', () => {
  it('lists every council of the theme with the blessed pick first', () => {
    for (const theme of THEMES) {
      const ranked = getThemeCouncilsRanked(theme.id);
      const expected = councilCatalog.filter(c => c.theme === theme.id);
      expect(ranked.length).toBe(expected.length);
      expect(ranked[0].id).toBe(BLESSED_BY_THEME[theme.id]);
    }
  });
});
