import { describe, expect, it } from 'vitest';
import { normalizeFigureName } from '@/utils/nameUtils';

describe('normalizeFigureName', () => {
  it.each([null, undefined, '', '   ', '\t\n'])('returns an empty ID for %j', (name) => {
    expect(normalizeFigureName(name)).toBe('');
  });

  it.each([
    'Martin Luther King Jr.',
    'Martin Luther King Jr',
    'Echo of Martin Luther King Jr.',
    'Echo von Martin Luther King Jr',
  ])('normalizes %s to king rather than the suffix', (name) => {
    expect(normalizeFigureName(name)).toBe('king');
  });

  // Aurel maps to aurelius, so these fail if the prefix reaches surname extraction.
  it.each(['of', 'von', 'de', 'del', 'di', 'des'])('strips the Echo %s prefix before lookup', (prefix) => {
    expect(normalizeFigureName(`Echo ${prefix} Mark Aurel`)).toBe('aurelius');
  });

  it('ignores prefix case and accepts whitespace after the connector', () => {
    expect(normalizeFigureName('  eChO DeS\t Mark Aurel \n')).toBe('aurelius');
  });

  it.each([
    ['Meister Eckhart', 'eckhart'],
    ['Ada Lovelace', 'lovelace'],
    ['Simone de Beauvoir', 'beauvoir'],
    ['Hildegard von Bingen', 'bingen'],
    ['Mark Aurel', 'aurelius'],
  ])('maps the bare figure name %s to %s', (name, expected) => {
    expect(normalizeFigureName(name)).toBe(expected);
  });

  it.each(['of', 'von', 'de', 'del', 'di', 'des'])('keeps a bare %s connector without Echo', (prefix) => {
    expect(normalizeFigureName(`${prefix} Mark Aurel`)).toBe('aurel');
  });

  it('only strips an Echo prefix at the start of the name', () => {
    expect(normalizeFigureName('Before Echo of Mark Aurel')).toBe('aurel');
  });

  it.each([
    ['Galileo Galilei', 'galilei'],
    ['Echo of Galileo GALILEI', 'galilei'],
    ['Plato', 'plato'],
    ['  Mary Wollstonecraft \n', 'wollstonecraft'],
  ])('extracts and lowercases the last name of %s', (name, expected) => {
    expect(normalizeFigureName(name)).toBe(expected);
  });
});
