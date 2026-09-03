import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearCrisisNote, dismissCrisisNote, raiseCrisisNote, readCrisisHeaders, readCrisisNote, resetConversationCrisisNote,
} from '@/services/safety/crisisNote';

describe('crisis note store', () => {
  beforeEach(() => clearCrisisNote());

  it('shows the topical line once per conversation and not again after a dismiss', () => {
    raiseCrisisNote('topical', 'DE');
    expect(readCrisisNote()?.kind).toBe('topical');
    dismissCrisisNote();
    raiseCrisisNote('topical', 'DE');
    expect(readCrisisNote()).toBeNull();
    resetConversationCrisisNote();
    raiseCrisisNote('topical', 'DE');
    expect(readCrisisNote()?.kind).toBe('topical');
  });

  it('keeps a dismissed distress banner closed while the worker keeps flagging', () => {
    raiseCrisisNote('distress', 'DE');
    dismissCrisisNote();
    raiseCrisisNote('distress', 'DE');
    expect(readCrisisNote()).toBeNull();
  });

  it('lets distress outrank topical and survive a conversation change', () => {
    raiseCrisisNote('topical', 'DE');
    raiseCrisisNote('distress', 'DE');
    expect(readCrisisNote()?.kind).toBe('distress');
    resetConversationCrisisNote();
    expect(readCrisisNote()?.kind).toBe('distress');
    clearCrisisNote();
    expect(readCrisisNote()).toBeNull();
  });

  it('reads the headers and normalises the country', () => {
    readCrisisHeaders(new Headers({ 'X-Crisis-Resources': 'de' }));
    expect(readCrisisNote()).toEqual({ kind: 'topical', country: 'DE' });
    clearCrisisNote();
    readCrisisHeaders(new Headers({ 'X-Crisis-Resources': 'XX', 'X-Distress': 'soft' }));
    expect(readCrisisNote()).toEqual({ kind: 'distress', country: null });
    clearCrisisNote();
    readCrisisHeaders(new Headers());
    expect(readCrisisNote()).toBeNull();
  });
});
