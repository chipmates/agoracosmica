import { describe, it, expect } from 'vitest';
import { applyAsideRules, ASIDE_RULES } from '../../services/audio/instructionProcessor';

// The worker holds the same four rules for free-tier requests
// (workers/llm-proxy/src/services/promptLoader.ts). This file is the mirror
// BYOK requests get, so the two texts must stay identical.
describe('applyAsideRules', () => {
  const base = 'You are the Echo.';

  it('appends the four rules on a free-conversation ask', () => {
    const out = applyAsideRules(base, { aside: true, mode: 'free_conversation' });
    expect(out.startsWith(base)).toBe(true);
    expect(out).toContain('<aside-rules priority="absolute">');
    for (const rule of ASIDE_RULES) {
      expect(out).toContain(rule);
    }
  });

  it('is a no-op without the flag and on every other mode', () => {
    expect(applyAsideRules(base, {})).toBe(base);
    expect(applyAsideRules(base, { aside: true, mode: 'seed_conversation' })).toBe(base);
    expect(applyAsideRules(base, { aside: true, mode: 'story' })).toBe(base);
  });

  it('does not stack when applied twice', () => {
    const once = applyAsideRules(base, { aside: true, mode: 'free_conversation' });
    const twice = applyAsideRules(once, { aside: true, mode: 'free_conversation' });
    expect(twice).toBe(once);
  });

  it('holds the answer short and off the handover', () => {
    const rules = ASIDE_RULES.join('\n');
    expect(rules).toContain('40 to 70 words');
    expect(rules).toContain('Do not end with a question');
    expect(rules).toContain('Never mention or hint at anything past it');
  });
});
