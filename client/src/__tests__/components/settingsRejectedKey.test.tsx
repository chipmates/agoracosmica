// Settings after a stored key was rejected: the card says so in its badge, its
// status line and its "currently" line, instead of "free tier, not tested".
// A key saved here also ends the free-tier state, as the key wizard does.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  meta: null as null | { valid: boolean; lastValidated?: string },
  stored: null as null | string,
}));

vi.mock('../../hooks/useTranslation', async () => {
  const de = (await import('../../assets/translations/ui-de.json')).default;
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], de);
  const t = (key: string, fallback?: unknown) => {
    const value = lookup(key);
    return typeof value === 'string' ? value : typeof fallback === 'string' ? fallback : key;
  };
  const api = { t, tString: t, tNode: t, tArray: () => [], language: 'de' };
  return { default: () => api, useTranslation: () => api };
});
vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    getKey: vi.fn(async () => h.stored),
    getKeyMetadata: vi.fn(async () => h.meta),
    hasKey: vi.fn(async () => h.stored !== null),
    hasUsableKey: vi.fn(async () => h.meta !== null && h.meta.valid !== false),
    saveKey: vi.fn(async (_provider: string, value: string) => {
      h.stored = value;
      h.meta = { valid: true };
    }),
    deleteKey: vi.fn(),
  },
}));
vi.mock('../../services/llm/llmService', () => ({ llmService: { validateKey: vi.fn(async () => true) } }));
vi.mock('../../components/settings/panels/LanguagePanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/VoicePanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/SpeechPanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/LocalModePanel', () => ({ default: () => null }));

class NoResize {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', NoResize);

import AiModelPanel from '../../components/settings/panels/AiModelPanel';
import PraeferenzenPanel from '../../components/settings/panels/PraeferenzenPanel';
import { useDomainStore } from '../../stores/domainStore';

const Card = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

describe('Settings with a rejected key', () => {
  beforeEach(() => {
    h.stored = 'sk-or-v1-rejected';
    h.meta = { valid: false, lastValidated: '2026-10-21T09:00:00' };
  });
  afterEach(() => cleanup());

  it('the key card says OpenRouter rejected the key, not "not tested" or "free tier active"', async () => {
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    await settle();

    expect(screen.getByText('Von OpenRouter abgelehnt')).toBeTruthy();
    expect(screen.queryByText('Nicht getestet')).toBeNull();
    expect(screen.queryByText(/^Kostenloser Tarif aktiv/)).toBeNull();
    expect(screen.getByText(/^Dein OpenRouter-Key wurde abgelehnt\./)).toBeTruthy();
  });

  it('a passing test of the unchanged key makes it usable again at once', async () => {
    useDomainStore.getState().setIsFreeTier(true);
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    await settle();

    fireEvent.click(screen.getByText('Key testen'));
    await settle();

    expect(h.meta).toEqual({ valid: true });
    expect(useDomainStore.getState().quota.isFreeTier).toBe(false);
    expect(screen.queryByText('Von OpenRouter abgelehnt')).toBeNull();
  });

  it('the card badge names the rejected key, not the free tier', async () => {
    render(
      <PraeferenzenPanel
        config={{ ttsEnabled: true, sttEnabled: true }}
        selectedLanguage="de"
        onChange={() => {}}
        onLanguageChange={() => {}}
        SettingCard={Card}
        OptionButtons={Card}
        CATEGORY_ICONS={{}}
      />,
    );
    await settle();

    expect(screen.getByText('Key abgelehnt')).toBeTruthy();
    expect(screen.queryByText('Kostenloser Tarif')).toBeNull();
  });
});

describe('a key saved in Settings', () => {
  beforeEach(() => {
    h.stored = null;
    h.meta = null;
    useDomainStore.getState().setIsFreeTier(true);
  });
  afterEach(() => cleanup());

  it('ends the free-tier state, as the key wizard does', async () => {
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    await settle();

    fireEvent.change(screen.getByPlaceholderText('sk-or-v1-...'), { target: { value: `sk-or-v1-${'b'.repeat(64)}` } });
    fireEvent.click(screen.getByText('Key testen'));
    await settle();
    fireEvent.click(screen.getByText('Speichern'));
    await settle();

    expect(h.stored).toBe(`sk-or-v1-${'b'.repeat(64)}`);
    expect(useDomainStore.getState().quota.isFreeTier).toBe(false);
  });
});
