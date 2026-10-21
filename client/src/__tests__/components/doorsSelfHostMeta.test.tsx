// The Free Talk door's small print. The hosted build has a daily free quota and
// names it; a self-host build has none, so its door names what answers there:
// the visitor's own key or own model.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ lang: 'de' as 'en' | 'de', selfHost: true }));

vi.mock('../../config/deployment', () => ({
  get isSelfHost() {
    return h.selfHost;
  },
}));
vi.mock('../../hooks/useTranslation', async () => {
  const bundles = {
    en: (await import('../../assets/translations/ui-en.json')).default,
    de: (await import('../../assets/translations/ui-de.json')).default,
  };
  const lookup = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
  const t = (key: string, fallback?: string) => {
    const value = lookup(bundles[h.lang], key);
    return typeof value === 'string' ? value : fallback ?? key;
  };
  const api = () => ({ tString: t, tNode: t, t, language: h.lang });
  return { default: api, useTranslation: api };
});
vi.mock('../../components/OptimizedFigureImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));

import ModeSelectorMini from '../../components/ModeSelectorMini';
import type { Figure } from '../../types/global';

const figure = { id: 'aurelius', name: 'Echo von Mark Aurel', about: '' } as unknown as Figure;

const talkMeta = (): string | null => {
  render(<ModeSelectorMini isOpen onClose={() => {}} onModeSelect={() => {}} selectedFigure={figure} selectedSeed={null} />);
  return document.querySelector('.doors-door--talk .doors-door-meta')?.textContent ?? null;
};

describe('the Free Talk door', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(global.fetch).mockImplementation(async () => new Response('{}', { status: 404 }));
  });
  afterEach(() => cleanup());

  it.each([
    ['de', 'Sofort. Mit deinem eigenen Key oder Modell.'],
    ['en', 'Right now. With your own key or model.'],
  ] as const)('self-host, %s: names the own key or model, and no free quota', (lang, line) => {
    h.selfHost = true;
    h.lang = lang;
    const meta = talkMeta();
    expect(meta).toBe(line);
    expect(meta).not.toMatch(/kostenlos|free|30/i);
  });

  it.each([
    ['de', 'Sofort. 30 kostenlose Nachrichten pro Tag.'],
    ['en', 'Right now. 30 free messages a day.'],
  ] as const)('hosted, %s: the daily free quota as before', (lang, line) => {
    h.selfHost = false;
    h.lang = lang;
    expect(talkMeta()).toBe(line);
  });
});
