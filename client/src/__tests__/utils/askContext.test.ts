import { describe, it, expect } from 'vitest';
import { buildChapterWindow, indexWithoutTimestamps } from '../../utils/askContext';

const paragraph = (label: string, chars: number): string =>
  `${label} ${'word '.repeat(Math.max(1, Math.ceil(chars / 5)))}`.slice(0, chars).trim();

describe('buildChapterWindow', () => {
  const chapter = ['One.', 'Two.', '---', 'Three.', 'Four.', 'Five.'];

  it('runs backward from the paused paragraph and stops there', () => {
    const window = buildChapterWindow(chapter, 3, 7000);
    expect(window).toBe('One.\n\nTwo.\n\nThree.');
    expect(window).not.toContain('Four.');
    expect(window).not.toContain('Five.');
  });

  it('drops separator lines', () => {
    expect(buildChapterWindow(chapter, 5, 7000)).not.toContain('---');
  });

  it('keeps the paused paragraph when only one fits', () => {
    const window = buildChapterWindow(chapter, 3, 6);
    expect(window).toBe('Three.');
  });

  it('holds a 15k chapter to the 7000 cap, whole paragraphs only', () => {
    const long = Array.from({ length: 30 }, (_, i) => paragraph(`P${i}`, 500));
    const window = buildChapterWindow(long, 29, 7000);

    expect(window.length).toBeLessThanOrEqual(7000);
    expect(window.length).toBeGreaterThan(6000);
    // The paused paragraph survives, the front is what gets cut.
    expect(window.endsWith(long[29])).toBe(true);
    expect(window).not.toContain('P0 ');
    for (const part of window.split('\n\n')) {
      expect(long).toContain(part);
    }
  });

  it('falls back to the tail of a paragraph wider than the budget', () => {
    const huge = paragraph('P', 9000);
    const window = buildChapterWindow([huge], 0, 7000);
    expect(window.length).toBe(7000);
    expect(huge.endsWith(window)).toBe(true);
  });

  it('clamps an out-of-range index and survives empty input', () => {
    expect(buildChapterWindow(chapter, 99, 7000)).toContain('Five.');
    expect(buildChapterWindow(chapter, -4, 7000)).toBe('One.');
    expect(buildChapterWindow([], 0, 7000)).toBe('');
    expect(buildChapterWindow(chapter, 2, 0)).toBe('');
  });
});

describe('indexWithoutTimestamps', () => {
  it('reads the elapsed fraction one paragraph back', () => {
    expect(indexWithoutTimestamps(50, 100, 20)).toBe(9);
    expect(indexWithoutTimestamps(30, 60, 10)).toBe(4);
  });

  it('clamps both ends', () => {
    expect(indexWithoutTimestamps(0, 100, 20)).toBe(0);
    expect(indexWithoutTimestamps(1, 100, 20)).toBe(0);
    expect(indexWithoutTimestamps(100, 100, 20)).toBe(19);
    expect(indexWithoutTimestamps(400, 100, 20)).toBe(19);
  });

  it('returns the first paragraph when there is nothing to divide by', () => {
    expect(indexWithoutTimestamps(10, 0, 20)).toBe(0);
    expect(indexWithoutTimestamps(10, NaN, 20)).toBe(0);
    expect(indexWithoutTimestamps(10, 100, 0)).toBe(0);
  });
});
