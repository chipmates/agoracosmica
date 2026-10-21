// The settings line under a working OpenRouter key shows when the key was last
// tested, in the app's language: a German app in an English browser reads
// "15:08:18", not "3:08:18 PM".
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';

const STAMP = '2026-10-21T15:08:18';

vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    getKey: vi.fn(async () => 'sk-or-v1-probe'),
    getKeyMetadata: vi.fn(async () => ({ lastValidated: STAMP, valid: true })),
    saveKey: vi.fn(),
    deleteKey: vi.fn(),
  },
}));
vi.mock('../../services/llm/llmService', () => ({ llmService: { validateKey: vi.fn() } }));
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    tString: (_key: string, fallback?: string) => fallback ?? '',
    tNode: (key: string) => key,
  }),
}));

import AiModelPanel from '../../components/settings/panels/AiModelPanel';
import { useDomainStore } from '../../stores/domainStore';
import { formatTime } from '../../utils/formatDateTime';

const Card = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

async function testedLine(appLanguage: 'en' | 'de'): Promise<string> {
  useDomainStore.setState((s) => ({ language: { ...s.language, current: appLanguage } }));
  render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
  return (await screen.findByText(/^Valid \(/)).textContent ?? '';
}

describe('key test time', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useDomainStore.setState((s) => ({ language: { ...s.language, current: 'en' } }));
  });

  it('reads German in a German app with an English browser', async () => {
    expect(navigator.language.toLowerCase().startsWith('en')).toBe(true);
    expect(await testedLine('de')).toBe('Valid (15:08:18)');
  });

  it('reads English in an English app with a German browser', async () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'de-DE' });
    expect(await testedLine('en')).toMatch(/^Valid \(3:08:18\sPM\)$/);
  });

  it('keeps the regional form of a browser in the same language', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'en-GB' });
    expect(formatTime(STAMP, 'en')).toBe(new Date(STAMP).toLocaleTimeString('en-GB'));
    vi.stubGlobal('navigator', { ...navigator, language: 'de-AT' });
    expect(formatTime(STAMP, 'de')).toBe(new Date(STAMP).toLocaleTimeString('de-AT'));
  });
});
