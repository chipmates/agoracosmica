// A self-host build asks for an OpenRouter key before the app opens. With Local
// Mode's model on, that model answers without one, so the key screen lets the
// visitor through: with no key, with a working key, or with a key OpenRouter
// rejected (the card's way out, "turn on your own model in Local Mode", holds
// after a reload).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
  key: null as null | { valid: boolean },
}));

vi.mock('../../config/deployment', () => ({ isSelfHost: true }));
vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    hasKey: vi.fn(async () => h.key !== null),
    hasUsableKey: vi.fn(async () => h.key !== null && h.key.valid),
  },
}));

import { useSelfHostKeyGate } from '../../hooks/useSelfHostKeyGate';
import { useDomainStore } from '../../stores/domainStore';
import { defaultConfig, saveServiceConfig } from '../../services/audio/config/serviceConfig';

const LOCAL_LLM = { provider: 'custom-openai', kind: 'custom-openai' as const, baseURL: 'http://192.168.1.20:11434/v1', model: 'qwen3-local' };

function localModel(on: boolean) {
  saveServiceConfig(on
    ? { ...defaultConfig, llm: { ...LOCAL_LLM }, localMode: { llmEnabled: true, ttsEnabled: false, sttEnabled: false } }
    : { ...defaultConfig });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const gate = () => useDomainStore.getState().byokModal;

describe('the self-host key screen and Local Mode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useDomainStore.getState().closeByokModal();
  });
  afterEach(() => {
    cleanup();
    useDomainStore.getState().closeByokModal();
  });

  it('without a key and without Local Mode: the key screen opens and holds', async () => {
    h.key = null;
    localModel(false);
    renderHook(() => useSelfHostKeyGate(true));
    await settle();
    expect(gate()).toMatchObject({ isOpen: true, required: true });
  });

  it('a rejected key without Local Mode: the key screen opens and holds, as before', async () => {
    h.key = { valid: false };
    localModel(false);
    renderHook(() => useSelfHostKeyGate(true));
    await settle();
    expect(gate()).toMatchObject({ isOpen: true, required: true });
  });

  it('without a key, Local Mode\'s model on: no key screen', async () => {
    h.key = null;
    localModel(true);
    renderHook(() => useSelfHostKeyGate(true));
    await settle();
    expect(gate().isOpen).toBe(false);
  });

  it('a rejected key, Local Mode\'s model on: no key screen after the reload', async () => {
    h.key = { valid: false };
    localModel(true);
    renderHook(() => useSelfHostKeyGate(true));
    await settle();
    expect(gate().isOpen).toBe(false);
  });

  it('a working key, Local Mode\'s model on: no key screen', async () => {
    h.key = { valid: true };
    localModel(true);
    renderHook(() => useSelfHostKeyGate(true));
    await settle();
    expect(gate().isOpen).toBe(false);
  });

  it('a working key, no Local Mode: no key screen', async () => {
    h.key = { valid: true };
    localModel(false);
    renderHook(() => useSelfHostKeyGate(true));
    await settle();
    expect(gate().isOpen).toBe(false);
  });

  it('Local Mode\'s switch on while the route is OpenRouter\'s counts as off', async () => {
    h.key = null;
    saveServiceConfig({ ...defaultConfig, localMode: { llmEnabled: true, ttsEnabled: false, sttEnabled: false } });
    renderHook(() => useSelfHostKeyGate(true));
    await settle();
    expect(gate()).toMatchObject({ isOpen: true, required: true });
  });
});
