// The free-tier state the AI model panel renders. What matters here is that a
// wrong or missing answer never turns into a model name on screen: the panel
// would then be claiming a model and a country that are not serving.
import { describe, expect, it } from 'vitest';

import { describeFreeTier, parseFreeTierState } from '@/utils/freeTierState';

const QWEN = { key: 'qwen3-235b', label: 'qwen3-235b', region: 'eu-north1' };
const DEEPSEEK = { key: 'dsv4-pro', label: 'deepseek-v4-pro', region: 'uk-south1' };

const unarmed = {
  primary: QWEN,
  fallback: null,
  governor: { armed: false, tripped: false, resetsAt: '2026-09-04T00:00:00.000Z' },
  serving: QWEN,
};

const armed = {
  primary: DEEPSEEK,
  fallback: QWEN,
  governor: { armed: true, tripped: false, resetsAt: '2026-09-04T00:00:00.000Z' },
  serving: DEEPSEEK,
};

const spent = {
  ...armed,
  governor: { armed: true, tripped: true, resetsAt: '2026-09-04T00:00:00.000Z' },
  serving: QWEN,
};

describe('parseFreeTierState', () => {
  it('reads a full state', () => {
    expect(parseFreeTierState(armed)).toEqual(armed);
  });

  it('keeps an absent fallback absent', () => {
    expect(parseFreeTierState(unarmed)?.fallback).toBeNull();
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', 'qwen3-235b'],
    ['no serving model', { primary: QWEN, fallback: null, governor: { armed: false } }],
    ['a half-named model', { primary: { key: 'x', label: 'x' }, serving: QWEN, governor: {} }],
    ['no governor', { primary: QWEN, serving: QWEN }],
  ])('returns null for %s, so the panel names no model', (_case, raw) => {
    expect(parseFreeTierState(raw)).toBeNull();
  });

  it('treats a missing flag as false rather than true', () => {
    const state = parseFreeTierState({ primary: QWEN, fallback: null, governor: {}, serving: QWEN });
    expect(state?.governor).toEqual({ armed: false, tripped: false, resetsAt: '' });
  });
});

describe('describeFreeTier', () => {
  it('unarmed: one model, nothing after it, no budget line', () => {
    expect(describeFreeTier(unarmed)).toEqual({ now: QWEN, after: null, budget: null });
  });

  it('armed and inside the budget: names the successor and says so', () => {
    expect(describeFreeTier(armed)).toEqual({ now: DEEPSEEK, after: QWEN, budget: 'within' });
  });

  it('armed and spent: the fallback is the model answering now', () => {
    expect(describeFreeTier(spent)).toEqual({ now: QWEN, after: null, budget: 'reached' });
  });

  it('a trip without an armed budget reports no budget at all', () => {
    const odd = { ...unarmed, governor: { ...unarmed.governor, tripped: true } };
    expect(describeFreeTier(odd)).toEqual({ now: QWEN, after: null, budget: null });
  });
});
