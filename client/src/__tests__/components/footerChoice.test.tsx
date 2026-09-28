// The footer's ad-measurement switch: shows the stored state when opened, and
// "Turn off" runs the same withdrawal as the app. Nothing is read before it is
// opened, and nothing is written except by the button.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const CLICK = 'TESTCLICKID0001';
const YES = JSON.stringify({ granted: true, version: '1.1.0', timestamp: Date.now() });
const NO = JSON.stringify({ granted: false, version: '1.1.0', timestamp: Date.now() });

function storageKeys(store: Storage): string[] {
  return Array.from({ length: store.length }, (_, i) => store.key(i) as string);
}

async function mount(lang: 'en' | 'de' = 'en', url = '/seneca/') {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  const { default: FooterChoice } = await import('../../../../marketing/src/islands/FooterChoice');
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<FooterChoice lang={lang} />);
  });
  return view;
}

async function open(container: HTMLElement): Promise<HTMLDetailsElement> {
  const details = container.querySelector('details')!;
  await act(async () => {
    details.open = true;
    fireEvent(details, new Event('toggle'));
  });
  return details;
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('FooterChoice', () => {
  it('renders a closed disclosure with the label and reads the answer only when opened', async () => {
    const { container } = await mount();
    // Module load already checked the stored yes/no status (the consent record);
    // the switch itself reads nothing more until it is opened.
    const getItem = vi.mocked(localStorage.getItem);
    getItem.mockClear();
    const summary = container.querySelector('summary')!;
    expect(summary.textContent).toBe('Ad measurement');
    expect(container.querySelector('details')!.open).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(getItem).not.toHaveBeenCalled();
    await open(container);
    const keys = getItem.mock.calls.map((c) => c[0]);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys)).toEqual(new Set(['agc_ad_consent']));
  });

  it('shows "on" with one button when a yes is stored, and turning off withdraws', async () => {
    localStorage.setItem('agc_ad_consent', YES);
    sessionStorage.setItem('agc_gclid', CLICK);
    sessionStorage.setItem('agc_conv_fired_start_exploring', '1');
    sessionStorage.setItem('agc_listened_seconds', '10.00');
    const { container } = await mount();
    await open(container);
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Ad measurement is on for this browser.');
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe('Turn off');
    await act(async () => { fireEvent.click(buttons[0]); });
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Ad measurement is off.');
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('agc_ad_consent')!).granted).toBe(false);
    expect(storageKeys(sessionStorage)).toEqual([]);
  });

  it('shows "off" and no button after a no, and after no answer at all, writing nothing', async () => {
    for (const stored of [NO, null]) {
      localStorage.clear();
      if (stored) localStorage.setItem('agc_ad_consent', stored);
      const { container, unmount } = await mount();
      await open(container);
      expect(container.querySelector('[role="status"]')!.textContent).toBe('Ad measurement is off.');
      expect(container.querySelectorAll('button')).toHaveLength(0);
      expect(storageKeys(localStorage)).toEqual(stored ? ['agc_ad_consent'] : []);
      unmount();
    }
  });

  it('speaks German on German pages', async () => {
    localStorage.setItem('agc_ad_consent', YES);
    const { container } = await mount('de', '/de/');
    expect(container.querySelector('summary')!.textContent).toBe('Werbe-Messung');
    await open(container);
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Werbe-Messung ist für diesen Browser an.');
    expect(container.querySelector('button')!.textContent).toBe('Ausschalten');
  });

  it('shows "off" for a yes older than a year', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version: '1.1.0', timestamp: Date.now() - 366 * 86_400_000 }));
    const { container } = await mount();
    await open(container);
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Ad measurement is off.');
  });
});

describe('FooterChoice and the earlier card text', () => {
  it('shows off for a yes given under version 1.0.0', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version: '1.0.0', timestamp: Date.now() }));
    const { container } = await mount();
    await open(container);
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Ad measurement is off.');
  });
});
