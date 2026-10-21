// The question a visitor sees after a stored key is rejected: German first,
// two answers of equal weight, the server consequence named before the yes,
// and "check my key" opens Settings at the key.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import en from '../../assets/translations/ui-en.json';
import de from '../../assets/translations/ui-de.json';

const h = vi.hoisted(() => ({
  lang: 'de' as 'en' | 'de',
  key: { valid: false, timestamp: 1 } as null | { valid: boolean; timestamp: number },
  setIsFreeTier: vi.fn(),
  openByokModal: vi.fn(),
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
  return { useTranslation: () => ({ tString: t, tNode: t, t, language: h.lang }) };
});

vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    getKeyMetadata: vi.fn(async () => h.key),
  },
}));

vi.mock('../../stores/domainStore', () => ({
  useDomainStore: {
    getState: () => ({ setIsFreeTier: h.setIsFreeTier, openByokModal: h.openByokModal }),
  },
}));

import OwnKeyRejectedModal from '../../components/OwnKeyRejectedModal';
import {
  ensureFreeTierAllowed,
  OwnKeyRejectedError,
  resetOwnKeyConsentForTests,
  type FreeTierKind,
} from '../../services/llm/ownKeyConsent';
import { OPEN_KEY_SETTINGS_EVENT } from '../../utils/openKeySettings';

function outcome(task: Promise<void>): Promise<'yes' | unknown> {
  return task.then(() => 'yes', (error) => error);
}

// Wrapped, so awaiting the question on screen does not await its answer.
async function askFor(kind: FreeTierKind): Promise<{ result: Promise<'yes' | unknown> }> {
  const result = outcome(ensureFreeTierAllowed({ kind, scope: `test:${kind}` }));
  await act(async () => {});
  return { result };
}

const buttons = () => screen.getAllByRole('button').map((b) => b.textContent);

describe('the rejected-key question', () => {
  beforeEach(() => {
    h.lang = 'de';
    h.key = { valid: false, timestamp: 1 };
    h.setIsFreeTier.mockClear();
    h.openByokModal.mockClear();
    resetOwnKeyConsentForTests();
    render(<OwnKeyRejectedModal />);
  });

  afterEach(() => {
    act(() => resetOwnKeyConsentForTests());
    cleanup();
  });

  it('shows nothing until a send needs it', () => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks in German, names our servers before the yes, and offers the two answers', async () => {
    await askFor('chat');
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('OpenRouter hat deinen Schlüssel nicht angenommen');
    expect(dialog.textContent).toContain('Dann läuft dieses Gespräch über unsere Server');
    expect(buttons()).toEqual(['Ja, kostenlose Nachrichten nutzen', 'Schlüssel prüfen']);
  });

  it.each<[FreeTierKind, string]>([
    ['council', 'Ja, kostenlosen Council nutzen'],
    ['summary', 'Ja, kostenlose Zusammenfassung nutzen'],
  ])('names the %s allowance it would use', async (kind, yes) => {
    await askFor(kind);
    expect(buttons()[0]).toBe(yes);
  });

  it('speaks English on English pages', async () => {
    h.lang = 'en';
    await askFor('chat');
    expect(screen.getByRole('dialog').textContent).toContain('This conversation then goes through our servers');
    expect(buttons()).toEqual(["Yes, use today's free messages", 'Check my key']);
  });

  it('yes lets the send go on and shows the free-tier counter from then on', async () => {
    const { result } = await askFor('chat');
    fireEvent.click(screen.getByText('Ja, kostenlose Nachrichten nutzen'));
    expect(await result).toBe('yes');
    expect(h.setIsFreeTier).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('check my key opens Settings at the key, and the send stops', async () => {
    const opened = vi.fn((event: Event) => event.preventDefault());
    window.addEventListener(OPEN_KEY_SETTINGS_EVENT, opened);
    try {
      const { result } = await askFor('chat');
      fireEvent.click(screen.getByText('Schlüssel prüfen'));
      const error = await result;
      expect(error).toBeInstanceOf(OwnKeyRejectedError);
      expect((error as OwnKeyRejectedError).choice).toBe('check-key');
      expect(opened).toHaveBeenCalledTimes(1);
      expect(h.openByokModal).not.toHaveBeenCalled();
      expect(h.setIsFreeTier).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(OPEN_KEY_SETTINGS_EVENT, opened);
    }
  });

  it('with no Settings on the page, check my key opens the key dialog instead', async () => {
    const { result } = await askFor('chat');
    fireEvent.click(screen.getByText('Schlüssel prüfen'));
    await result;
    expect(h.openByokModal).toHaveBeenCalledTimes(1);
  });

  it('Escape is a no', async () => {
    const { result } = await askFor('chat');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    const error = await result;
    expect((error as OwnKeyRejectedError).choice).toBe('dismissed');
    expect(h.setIsFreeTier).not.toHaveBeenCalled();
  });

  it('both answers are full touch targets of the same weight', async () => {
    await askFor('chat');
    const [yes, check] = screen.getAllByRole('button');
    expect(yes.style.minHeight).toBe('44px');
    expect(yes.getAttribute('style')).toBe(check.getAttribute('style'));
  });
});

describe('the words', () => {
  const sets = [de.byok.rejected, en.byok.rejected];

  it('carry every key in both languages', () => {
    expect(Object.keys(de.byok.rejected).sort()).toEqual(Object.keys(en.byok.rejected).sort());
  });

  it.each(sets.flatMap((set) => Object.values(set)))('%s', (line) => {
    expect(line).not.toMatch(/[–—;]/);
    expect(line).not.toMatch(/privat/i);
    // Never a bare "free": always today's allowance of something.
    for (const m of line.matchAll(/\b(free|kostenlos\w*)\b/gi)) {
      const after = line.slice((m.index ?? 0) + m[0].length);
      expect(after).toMatch(/^ (messages|council|summar|Nachrichten|Council|Zusammenfassung)/);
    }
  });

  it('the after-the-fact banner line is gone', () => {
    expect((de.errors.network as Record<string, string>).byokFellBack).toBeUndefined();
    expect((en.errors.network as Record<string, string>).byokFellBack).toBeUndefined();
  });
});
