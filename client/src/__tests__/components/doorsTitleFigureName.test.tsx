// The doors title names the figure in the page language. On a cold German deep
// link the selected figure still carries the English placeholder name; the
// title takes the German name once the figure's translation has landed.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ lang: 'de' as 'en' | 'de' }));

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

const NAMES: Record<string, string> = { de: 'Echo von Mark Aurel', en: 'Echo of Marcus Aurelius' };

/** The content host answers each figure translation after a short delay, as on a cold page. */
function serveTranslations(): void {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    const match = url.match(/figure-translations\/(\w+)\/aurelius\.json/);
    if (!match) return new Response('{}', { status: 404 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response(JSON.stringify({ name: NAMES[match[1]], about: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

// The English placeholder a cold German deep link leaves on the selected figure.
const placeholder = { id: 'aurelius', name: 'Echo of Marcus Aurelius', about: '' } as unknown as Figure;

const openDoors = () => render(
  <ModeSelectorMini isOpen onClose={() => {}} onModeSelect={() => {}} selectedFigure={placeholder} selectedSeed={null} />,
);

describe('the doors title', () => {
  beforeEach(() => {
    h.lang = 'de';
    window.localStorage.clear();
    serveTranslations();
  });
  afterEach(() => cleanup());

  it('German: the German name, not the English placeholder', async () => {
    openDoors();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Wie möchtest du mit Echo von Mark Aurel beginnen?');
    });
    expect(document.body.textContent).not.toContain('Echo of Marcus Aurelius');
  });

  it('English: the English name', async () => {
    h.lang = 'en';
    openDoors();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('How do you want to start with Echo of Marcus Aurelius?');
    });
  });
});
