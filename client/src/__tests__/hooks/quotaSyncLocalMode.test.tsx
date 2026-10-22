// The quota fetch at app start takes a free-tier session (the bot check and the
// browser ID). A visitor whose messages go to Local Mode's model is not on the
// free tier, so with that model on nothing is fetched, with or without a key;
// switched off, a visitor without a key is on the free tier again.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ keyStored: false, fetched: 0 }));

vi.mock('../../config/deployment', () => ({ isSelfHost: false }));
vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: { hasKey: vi.fn(async () => h.keyStored) },
}));
vi.mock('../../services/proxy/freeTierAdapter', () => ({
  fetchQuota: vi.fn(async () => { h.fetched += 1; }),
}));

import { useQuotaSync } from '../../hooks/useQuotaSync';
import { useDomainStore } from '../../stores/domainStore';
import { defaultConfig, saveServiceConfig } from '../../services/audio/config/serviceConfig';

const LOCAL_LLM = { provider: 'custom-openai', kind: 'custom-openai' as const, baseURL: 'http://127.0.0.1:1234/v1', model: 'qwen3-local' };

function localModel(on: boolean) {
  saveServiceConfig(on
    ? { ...defaultConfig, llm: { ...LOCAL_LLM }, localMode: { llmEnabled: true, ttsEnabled: true, sttEnabled: true } }
    : { ...defaultConfig, localMode: { llmEnabled: false, ttsEnabled: true, sttEnabled: true } });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const isFreeTier = () => useDomainStore.getState().quota.isFreeTier;

describe('the quota fetch and Local Mode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    h.fetched = 0;
    h.keyStored = false;
    useDomainStore.getState().setIsFreeTier(false);
  });
  afterEach(cleanup);

  it('without a key and without Local Mode\'s model: free tier, the quota is fetched', async () => {
    localModel(false);
    renderHook(() => useQuotaSync());
    await settle();
    expect(isFreeTier()).toBe(true);
    expect(h.fetched).toBe(1);
  });

  it('without a key, Local Mode\'s model on: no free tier, nothing fetched', async () => {
    localModel(true);
    renderHook(() => useQuotaSync());
    await settle();
    expect(isFreeTier()).toBe(false);
    expect(h.fetched).toBe(0);
  });

  it('a stored key, Local Mode\'s model on: nothing fetched', async () => {
    h.keyStored = true;
    localModel(true);
    renderHook(() => useQuotaSync());
    await settle();
    expect(isFreeTier()).toBe(false);
    expect(h.fetched).toBe(0);
  });

  it('Local Mode\'s model switched off without a key: free tier again, the quota is fetched then', async () => {
    localModel(true);
    renderHook(() => useQuotaSync());
    await settle();
    expect(h.fetched).toBe(0);
    await act(async () => {
      localModel(false);
      await settle();
    });
    expect(isFreeTier()).toBe(true);
    expect(h.fetched).toBe(1);
  });

  it('Local Mode\'s model switched on during a free-tier visit: the free tier ends', async () => {
    localModel(false);
    renderHook(() => useQuotaSync());
    await settle();
    expect(isFreeTier()).toBe(true);
    await act(async () => {
      localModel(true);
      await settle();
    });
    expect(isFreeTier()).toBe(false);
    expect(h.fetched).toBe(1);
  });

  it('a save that leaves Local Mode\'s model as it was fetches nothing more', async () => {
    localModel(true);
    renderHook(() => useQuotaSync());
    await settle();
    await act(async () => {
      saveServiceConfig({ ...defaultConfig, llm: { ...LOCAL_LLM }, ttsEnabled: false, localMode: { llmEnabled: true, ttsEnabled: false, sttEnabled: true } });
      await settle();
    });
    expect(h.fetched).toBe(0);
    expect(isFreeTier()).toBe(false);
  });
});
