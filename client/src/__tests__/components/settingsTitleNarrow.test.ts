// On the narrowest phones a card title keeps its words whole: the badge
// beside it wraps first, and under 360 px the frame around it gives up a
// little room so a two-line title is not cut. The width checks themselves run
// in a browser; here the rules that carry them.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/components/settings/CollapsibleSection.module.css'), 'utf8');
const block = (query: string) => {
  const start = css.indexOf(query);
  if (start < 0) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') { depth -= 1; if (depth === 0) return css.slice(start, i + 1); }
  }
  return '';
};
/** Every declaration block for the selector in the scope, joined. */
const rule = (scope: string, selector: string) => {
  const parts: string[] = [];
  for (let at = scope.indexOf(`${selector} {`); at >= 0; at = scope.indexOf(`${selector} {`, at + 1)) {
    parts.push(scope.slice(at, scope.indexOf('}', at)));
  }
  return parts.join('\n');
};

describe('card titles on narrow phones', () => {
  it('a title\'s longest word keeps its line, the badge gives way', () => {
    const phone = block('@media (max-width: 768px)');
    expect(phone).toMatch(/\.headerLeft,\s*\.titleWrapper\s*\{[^}]*min-width:\s*min-content/);
    expect(rule(phone, '.title')).toMatch(/word-break:\s*normal/);
    expect(rule(phone, '.headerRight')).toMatch(/min-width:\s*0/);
  });

  it('under 360 px the frame is narrower, the gap to the badge stays', () => {
    const narrow = block('@media (max-width: 359px)');
    expect(rule(narrow, '.header')).toMatch(/padding:\s*14px 12px/);
    expect(rule(narrow, '.header')).toMatch(/column-gap:\s*8px/);
  });
});
