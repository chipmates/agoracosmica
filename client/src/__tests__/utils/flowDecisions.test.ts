import { describe, it, expect, beforeEach } from 'vitest';
import {
  isFirstContactForFigure,
  reachedDeepenedTurns,
  resolveNodeState,
  resolveRestoreAction,
  type NodeStateSnapshot,
} from '../../utils/flowDecisions';
import { getStorageKeyForMode, parseHistoryKey } from '../../utils/storageKeysV2';
import {
  captureEntryIntentFromUrl,
  readFigureIntent,
  clearFigureIntent,
  readCouncilIntent,
  clearCouncilIntent,
  readAskIntent,
} from '../../utils/public/entryIntent';

describe('isFirstContactForFigure', () => {
  it('is first contact when no keys and no free talk exist', () => {
    expect(isFirstContactForFigure('aurelius', [], false)).toBe(true);
  });

  it('free talk history alone ends first contact', () => {
    expect(isFirstContactForFigure('aurelius', [], true)).toBe(false);
  });

  it.each([
    'visitedModes_aurelius_stoic-way',
    'starseed_aurelius_42',
    'challenge_aurelius_42',
    'story_aurelius_42_completed',
    'prism_aurelius_42_completed',
  ])('engagement key %s ends first contact', (key) => {
    expect(isFirstContactForFigure('aurelius', [key], false)).toBe(false);
  });

  it('ignores other figures keys', () => {
    const keys = ['story_kahlo_1_completed', 'freetalk_kahlo', 'starseed_jung_3'];
    expect(isFirstContactForFigure('aurelius', keys, false)).toBe(true);
  });

  it('does not match figure ids sharing a prefix', () => {
    // story_jung_ must not match story_jung2_...
    expect(isFirstContactForFigure('jung', ['story_jung2_1'], false)).toBe(true);
    expect(isFirstContactForFigure('jung', ['story_jung_1'], false)).toBe(false);
  });

  it('ignores unrelated storage keys', () => {
    const keys = ['selectedLanguage', 'agc_theme', 'freetalk_aurelius_unrelated'];
    // freetalk keys are figure-global and signaled via hasFreeTalkHistory, not the scan
    expect(isFirstContactForFigure('aurelius', keys, false)).toBe(true);
  });
});

describe('resolveNodeState', () => {
  const base: NodeStateSnapshot = {
    selectedMode: null,
    hasSelection: true,
    storyCompleted: false,
    prismCompleted: false,
    wisdomEngaged: false,
    challengeEngaged: false,
    visitedModes: [],
  };

  it('active wins over everything', () => {
    expect(
      resolveNodeState('introduction', { ...base, selectedMode: 'introduction', storyCompleted: true })
    ).toBe('active');
  });

  it('is dormant without a full figure+seed selection', () => {
    expect(resolveNodeState('introduction', { ...base, hasSelection: false, storyCompleted: true })).toBe('dormant');
  });

  it.each([
    ['introduction', { storyCompleted: true }],
    ['prism', { prismCompleted: true }],
    ['seed_conversation', { wisdomEngaged: true }],
    ['challenge', { challengeEngaged: true }],
  ] as const)('%s completes from its own signal', (modeId, patch) => {
    expect(resolveNodeState(modeId, { ...base, ...patch })).toBe('completed');
  });

  it('completion signals do not leak across modes', () => {
    expect(resolveNodeState('prism', { ...base, storyCompleted: true })).toBe('dormant');
  });

  it('falls back to visited, then dormant', () => {
    expect(resolveNodeState('challenge', { ...base, visitedModes: ['challenge'] })).toBe('visited');
    expect(resolveNodeState('challenge', base)).toBe('dormant');
  });
});

describe('resolveRestoreAction (Effect #14 decision core)', () => {
  it('selects the stored mode when it differs from the current one', () => {
    expect(resolveRestoreAction('introduction', 'free_conversation', 'aurelius', 42)).toEqual({
      kind: 'selectStoredMode',
      mode: 'introduction',
    });
  });

  it('opens the mode selector for a new figure+seed with no stored mode', () => {
    expect(resolveRestoreAction(null, 'introduction', 'aurelius', 42)).toEqual({
      kind: 'openModeSelector',
    });
  });

  it('only marks started on a prism refresh (prism has no conversation storage)', () => {
    expect(resolveRestoreAction('prism', 'prism', 'aurelius', 42)).toEqual({
      kind: 'markConversationStarted',
    });
  });

  it.each([
    ['introduction', 'story_content_aurelius_42'],
    ['seed_conversation', 'starseed_aurelius_42'],
    ['challenge', 'challenge_aurelius_42'],
  ])('presets the %s history key on refresh', (mode, expectedKey) => {
    expect(resolveRestoreAction(mode, mode, 'aurelius', 42)).toEqual({
      kind: 'presetKeyAndSelect',
      mode,
      historyKey: expectedKey,
    });
  });

  it('free talk ignores the seed for its history key', () => {
    expect(resolveRestoreAction('free_conversation', 'free_conversation', 'aurelius', 42)).toEqual({
      kind: 'presetKeyAndSelect',
      mode: 'free_conversation',
      historyKey: 'freetalk_aurelius',
    });
  });
});

describe('getStorageKeyForMode', () => {
  it.each([
    ['introduction', 'aurelius', '42', 'story_content_aurelius_42'],
    ['story', 'aurelius', '42', 'story_content_aurelius_42'],
    ['seed_conversation', 'aurelius', '42', 'starseed_aurelius_42'],
    ['challenge', 'aurelius', '42', 'challenge_aurelius_42'],
    ['free_conversation', 'aurelius', undefined, 'freetalk_aurelius'],
  ])('%s → %s', (mode, figureId, seedId, expected) => {
    expect(getStorageKeyForMode(mode, figureId as string, seedId as string | undefined)).toBe(expected);
  });

  it('returns null for seed-scoped modes without a seed', () => {
    expect(getStorageKeyForMode('introduction', 'aurelius')).toBeNull();
    expect(getStorageKeyForMode('seed_conversation', 'aurelius')).toBeNull();
    expect(getStorageKeyForMode('challenge', 'aurelius')).toBeNull();
  });

  it('prism has no conversation storage', () => {
    expect(getStorageKeyForMode('prism', 'aurelius', '42')).toBeNull();
  });
});

describe('parseHistoryKey (inverse of the key generators)', () => {
  it.each([
    ['seed_conversation', '42'],
    ['challenge', '42'],
    ['free_conversation', null],
  ] as const)('%s keys round-trip', (mode, seedId) => {
    const key = getStorageKeyForMode(mode, 'aurelius', seedId ?? undefined)!;
    expect(parseHistoryKey(key, 'aurelius')).toEqual({ mode, seedId });
  });

  it('recognizes prism content keys', () => {
    expect(parseHistoryKey('prism_content_aurelius_42', 'aurelius')).toEqual({
      mode: 'prism',
      seedId: '42',
    });
  });

  it('rejects other figures and unrelated keys', () => {
    expect(parseHistoryKey('starseed_kahlo_42', 'aurelius')).toBeNull();
    expect(parseHistoryKey('selectedLanguage', 'aurelius')).toBeNull();
    expect(parseHistoryKey('story_content_aurelius_42', 'aurelius')).toBeNull();
  });
});

describe('entryIntent URL capture round-trip', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, '', '/app');
  });

  it('captures figure slug, maps it to the internal id, and strips params', () => {
    window.history.replaceState({}, '', '/app?figure=marcus-aurelius&lang=de');
    captureEntryIntentFromUrl();
    expect(readFigureIntent()).toBe('aurelius');
    expect(localStorage.getItem('selectedLanguage')).toBe('de');
    expect(window.location.search).toBe('');
  });

  it('accepts the internal id form directly', () => {
    window.history.replaceState({}, '', '/app?figure=aurelius');
    captureEntryIntentFromUrl();
    expect(readFigureIntent()).toBe('aurelius');
  });

  it('captures council intent and clears it after consumption', () => {
    window.history.replaceState({}, '', '/app?council=the-calling-that-wont-shut-up');
    captureEntryIntentFromUrl();
    expect(readCouncilIntent()).toBe('the-calling-that-wont-shut-up');
    clearCouncilIntent();
    expect(readCouncilIntent()).toBeNull();
  });

  it('only allowlisted ask tags survive', () => {
    window.history.replaceState({}, '', '/app?ask=hero');
    captureEntryIntentFromUrl();
    expect(readAskIntent()).toBe('hero');

    sessionStorage.clear();
    window.history.replaceState({}, '', '/app?ask=javascript%3Aalert(1)');
    captureEntryIntentFromUrl();
    expect(readAskIntent()).toBeNull();
  });

  it('clearFigureIntent consumes the intent once', () => {
    window.history.replaceState({}, '', '/app?figure=aurelius');
    captureEntryIntentFromUrl();
    clearFigureIntent();
    expect(readFigureIntent()).toBeNull();
  });

  it('preserves unrelated query params and the hash', () => {
    window.history.replaceState({}, '', '/app?figure=aurelius&utm_keep=x#section');
    captureEntryIntentFromUrl();
    expect(window.location.search).toBe('?utm_keep=x');
    expect(window.location.hash).toBe('#section');
  });
});

describe('reachedDeepenedTurns', () => {
  const user = { role: 'user' as const };
  const assistant = { role: 'assistant' as const };
  const council = { role: 'council' as const };

  it('is false below three user messages', () => {
    expect(reachedDeepenedTurns([])).toBe(false);
    expect(reachedDeepenedTurns([user, assistant, user, assistant])).toBe(false);
  });

  it('is true at the third user message', () => {
    expect(reachedDeepenedTurns([user, assistant, user, assistant, user])).toBe(true);
  });

  it('ignores assistant, council and greeting messages', () => {
    const greeting = [assistant, assistant, council, assistant];
    expect(reachedDeepenedTurns(greeting)).toBe(false);
    expect(reachedDeepenedTurns([...greeting, user, user])).toBe(false);
    expect(reachedDeepenedTurns([...greeting, user, user, user])).toBe(true);
  });

  it('stays true past the third user message', () => {
    expect(reachedDeepenedTurns([user, user, user, user, user])).toBe(true);
  });
});
