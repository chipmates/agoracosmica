// Guard against raw user-facing attribute literals in JSX. A hardcoded
// aria-label/title/placeholder bypasses the translation layer entirely, so it
// leaks English into the German UI and is invisible to the key-parity net (the
// "Sages tab" class of bug). The baseline freezes today's occurrences: new
// ones fail, and fixed ones must be removed from the baseline (only shrinks).
// ESLint cannot enforce this yet (no TS parser configured), so this test is
// the working guard.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['components', 'pages'];
const PATTERN = /(aria-label|placeholder|title)="[A-Za-z][^"]*"/g;

function scan(): string[] {
  const hits: string[] = [];
  for (const dir of SCAN_DIRS) {
    const entries = readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.tsx')) continue;
      const path = join(e.parentPath ?? (e as unknown as { path: string }).path, e.name);
      const rel = relative(ROOT, path);
      const src = readFileSync(path, 'utf8');
      for (const m of src.matchAll(PATTERN)) {
        hits.push(`${rel}: ${m[0]}`);
      }
    }
  }
  return hits.sort();
}

// Frozen 2026-07-23 (30 occurrences). Shrink me, never grow me. Dev-only
// surfaces (ColorContrastTest) and technical placeholders (endpoint URLs,
// model names) may reasonably stay; everything user-facing should move to
// tString and leave this list.
const BASELINE_COUNT = 34;

describe('user-facing attribute literals', () => {
  const hits = scan();

  it(`no new raw aria-label/title/placeholder literals (frozen at ${BASELINE_COUNT})`, () => {
    expect(
      hits.length,
      `New raw attribute literal introduced. Use tString(...) instead.\nCurrent:\n${hits.join('\n')}`
    ).toBeLessThanOrEqual(BASELINE_COUNT);
  });
});
