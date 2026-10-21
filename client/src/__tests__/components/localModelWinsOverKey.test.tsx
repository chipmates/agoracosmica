// With Local Mode's model on, a saved OpenRouter key does not take the
// conversation away from it: the route, the Local Mode switch and the Settings
// badge agree, and the open model card says which model answers.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    getKey: vi.fn(async () => null),
    getKeyMetadata: vi.fn(async () => null),
    saveKey: vi.fn(async () => {}),
    deleteKey: vi.fn(async () => {}),
  },
}));
vi.mock('../../services/llm/llmService', () => ({ llmService: { validateKey: vi.fn(async () => true) } }));
vi.mock('../../hooks/useTranslation', () => {
  const api = () => ({
    t: (key: string) => key,
    tString: (_key: string, fallback?: string) => fallback ?? '',
    tNode: (key: string) => key,
  });
  return { default: api, useTranslation: api };
});

import AiModelPanel from '../../components/settings/panels/AiModelPanel';
import BYOKSetupModal from '../../components/BYOKSetupModal';
import { useDomainStore } from '../../stores/domainStore';
import {
  defaultConfig, saveServiceConfig, loadServiceConfig, localModeFromRaw,
} from '../../services/audio/config/serviceConfig';

const Card = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const LOCAL_LLM = { provider: 'custom-openai', kind: 'custom-openai' as const, baseURL: 'http://127.0.0.1:1234/v1', model: 'qwen3-local' };
const raw = () => useDomainStore.getState().serviceConfig.raw as string;
const saved = () => JSON.parse(raw()) as { llm: { kind?: string; provider: string; baseURL?: string; model: string; zdr?: boolean } };

function localModelOn() {
  saveServiceConfig({ ...defaultConfig, llm: { ...LOCAL_LLM }, localMode: { llmEnabled: true, ttsEnabled: false, sttEnabled: false } });
}

describe('a local model wins over a saved key', () => {
  beforeEach(() => {
    window.localStorage.clear();
    localModelOn();
  });
  afterEach(() => {
    cleanup();
    useDomainStore.getState().closeByokModal();
  });

  it('the model card saves the key and the conversation stays on the local model', async () => {
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    fireEvent.change(screen.getByPlaceholderText('sk-or-v1-...'), { target: { value: 'sk-or-v1-test' } });
    fireEvent.click(screen.getByText('settings.apiKeys.buttonTest'));
    await waitFor(() => expect(screen.getByText('settings.apiKeys.buttonSave').closest('button')?.disabled).toBe(false));
    await act(async () => { fireEvent.click(screen.getByText('settings.apiKeys.buttonSave')); });

    await waitFor(() => expect(saved().llm.kind).toBe('custom-openai'));
    expect(saved().llm).toMatchObject({ baseURL: LOCAL_LLM.baseURL, model: LOCAL_LLM.model });
    expect(localModeFromRaw(raw()).llmEnabled).toBe(true);
  });

  it('the key gate saves the key and the conversation stays on the local model', async () => {
    useDomainStore.getState().openByokModal(undefined, true);
    render(<BYOKSetupModal />);
    fireEvent.click(screen.getByText('Get Started'));
    fireEvent.change(screen.getByPlaceholderText('sk-or-v1-...'), { target: { value: 'sk-or-v1-test' } });
    await act(async () => { fireEvent.click(screen.getByText('Save & Continue')); });

    await waitFor(() => expect(saved().llm.zdr).toBe(true));
    expect(saved().llm).toMatchObject({ kind: 'custom-openai', baseURL: LOCAL_LLM.baseURL, model: LOCAL_LLM.model });
  });

  it('without the local model the key takes the conversation, as before', async () => {
    saveServiceConfig({ ...defaultConfig });
    useDomainStore.getState().openByokModal(undefined, true);
    render(<BYOKSetupModal />);
    fireEvent.click(screen.getByText('Get Started'));
    fireEvent.change(screen.getByPlaceholderText('sk-or-v1-...'), { target: { value: 'sk-or-v1-test' } });
    await act(async () => { fireEvent.click(screen.getByText('Save & Continue')); });

    await waitFor(() => expect(saved().llm.provider).toBe('openrouter'));
    expect(loadServiceConfig().llm.kind).toBe('openrouter');
  });

  it('settings an earlier save left at odds (switch on, route OpenRouter) read as they run', () => {
    saveServiceConfig({ ...defaultConfig, localMode: { llmEnabled: true, ttsEnabled: false, sttEnabled: false } });
    expect(loadServiceConfig().llm.kind).toBe('openrouter');
    expect(loadServiceConfig().localMode?.llmEnabled).toBe(false);
    expect(localModeFromRaw(raw()).llmEnabled).toBe(false);
  });

  it('the open model card names the local model, not the free tier', async () => {
    useDomainStore.setState((s) => ({ quota: { ...s.quota, freeTier: null } }));
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    expect(await screen.findByText('qwen3-local')).toBeTruthy();
    expect(screen.getByText('settings.aiModelKey.statusLocal')).toBeTruthy();
    expect(screen.queryByText('settings.aiModelKey.statusFree')).toBeNull();
    expect(screen.queryByText('settings.aiModelKey.modelTagline')).toBeNull();
  });
});
