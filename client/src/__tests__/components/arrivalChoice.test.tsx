// The consent card on the public pages, rendered: when it shows, what each
// answer stores and sends, and what a paid arrival gets (nothing at all).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const CLICK = 'TESTCLICKID0001';
const YES = JSON.stringify({ granted: true, version: '1.2.0', timestamp: Date.now() });

let sent: { url: string; body: Record<string, unknown> }[] = [];

function storageKeys(store: Storage): string[] {
  return Array.from({ length: store.length }, (_, i) => store.key(i) as string);
}

async function mountAt(url: string, lang: 'en' | 'de' = 'en') {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  const { default: ArrivalChoice } = await import('../../../../marketing/src/islands/ArrivalChoice');
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<ArrivalChoice lang={lang} />);
  });
  return view;
}

beforeEach(() => {
  sent = [];
  sessionStorage.clear();
  localStorage.clear();
  global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : {} });
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as unknown as typeof fetch;
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: vi.fn((url: string, blob: Blob) => {
      void blob.text().then((t) => sent.push({ url, body: JSON.parse(t) }));
      return true;
    }),
  });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'sendBeacon');
  window.history.replaceState({}, '', '/');
});

const conversions = () => sent.filter((s) => s.url.endsWith('/api/conversions'));

describe('ArrivalChoice', () => {
  it('shows on a grant landing and stores nothing before the answer', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(container.querySelector('.agc-consent')).not.toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('yes stores the click ID and the yes, and reports the yes with the click ID', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    await new Promise((r) => setTimeout(r, 0));
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
    expect(JSON.parse(localStorage.getItem('agc_ad_consent')!).granted).toBe(true);
    expect(conversions()).toHaveLength(1);
    expect(conversions()[0].body.gclid).toBe(CLICK);
    expect(container.querySelector('.agc-consent')).toBeNull();
    const counts = sent.filter((s) => s.url.endsWith('/v1/funnel'));
    expect(counts.map((c) => c.body.step)).toContain('ad_consent_accepted');
    for (const c of counts) expect(JSON.stringify(c.body)).not.toContain(CLICK);
    expect(storageKeys(sessionStorage).filter((k) => k.startsWith('agc_funnel_fired_'))).toEqual([]);
  });

  it('no stores only the no and sends no conversion', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    const [, no] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(no); });
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual(['agc_ad_consent']);
    expect(conversions()).toHaveLength(0);
  });

  it('never shows on a paid arrival, even with an old yes and an old click ID stored', async () => {
    localStorage.setItem('agc_ad_consent', YES);
    sessionStorage.setItem('agc_gclid', 'OLDCLICKID00001');
    const { container } = await mountAt(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    expect(container.querySelector('.agc-consent')).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
  });

  it('never shows on a paid arrival without any answer on record', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?p=1&gclid=${CLICK}`, 'de');
    expect(container.querySelector('.agc-consent')).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('does not show on the next page of the visit', async () => {
    await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    const { container } = await mountAt('/seneca/');
    expect(container.querySelector('.agc-consent')).toBeNull();
  });
});

describe('heard seconds', () => {
  async function loadHeard(url: string) {
    window.history.replaceState({}, '', url);
    vi.resetModules();
    const capture = await import('@client/utils/public/gclidCapture');
    const heard = await import('../../../../marketing/src/utils/heardSeconds');
    return { capture, heard };
  }

  it('counts and writes nothing without a yes, and reads nothing either', async () => {
    const { capture, heard } = await loadHeard(`/marcus-aurelius/?gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    for (let i = 0; i < 40; i++) heard.addHeardSeconds(1);
    expect(getItem.mock.calls.map((c) => c[0])).not.toContain('agc_listened_seconds');
    getItem.mockRestore();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
  });

  it('counts after a yes and sends listened once at 30 seconds', async () => {
    const { capture, heard } = await loadHeard(`/marcus-aurelius/?gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    capture.grantAdConsent();
    for (let i = 0; i < 40; i++) heard.addHeardSeconds(1, 'aurelius');
    expect(conversions()).toHaveLength(1);
    expect(conversions()[0].body.event).toBe('listened');
    expect(Number(sessionStorage.getItem('agc_listened_seconds'))).toBeGreaterThanOrEqual(30);
  });

  it('counts nothing on a paid arrival with an old yes', async () => {
    localStorage.setItem('agc_ad_consent', YES);
    sessionStorage.setItem('agc_gclid', 'OLDCLICKID00001');
    const { capture, heard } = await loadHeard(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    for (let i = 0; i < 40; i++) heard.addHeardSeconds(1);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
  });
});

describe('ArrivalChoice after a year', () => {
  it('asks again when the stored answer is older than 365 days', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: false, version: '1.2.0', timestamp: Date.now() - 366 * 86_400_000 }));
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(container.querySelector('.agc-consent')).not.toBeNull();
  });
  it('does not ask within the year', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: false, version: '1.2.0', timestamp: Date.now() - 100 * 86_400_000 }));
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(container.querySelector('.agc-consent')).toBeNull();
  });
});

describe('ArrivalChoice copy and version', () => {
  it('names each step, the year, the footer switch, and links Google’s page', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    const fine = container.querySelector('.agc-consent__fine')!.textContent!;
    expect(fine).toContain('this yes, opening the app, listening, starting a conversation, a third message, a council');
    expect(fine).toContain('for a year');
    expect(fine).toContain('at the foot of every page');
    const google = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'How Google uses this')!;
    expect(google.getAttribute('href')).toBe('https://business.safety.google/privacy');
    expect(google.getAttribute('rel')).toContain('noopener');
  });

  it('speaks German, with the same three links', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`, 'de');
    expect(container.querySelector('.agc-consent__fine')!.textContent).toContain('diesem Ja, dem Öffnen der App');
    const labels = Array.from(container.querySelectorAll('.agc-consent__link')).map((a) => a.textContent);
    expect(labels).toEqual(['Code ansehen', 'Datenschutzerklärung', 'Wie Google das nutzt']);
  });

  it('names the Google account, the USA and no personalised ads right after the steps', async () => {
    const en = (await mountAt(`/marcus-aurelius/?gclid=${CLICK}`)).container;
    expect(en.querySelector('.agc-consent__fine')!.textContent).toContain(
      'a council. Google can link it to your Google account and may process it in the USA. We don’t allow it for personalised ads. Nothing else about you.'
    );
    const de = (await mountAt(`/marcus-aurelius/?gclid=${CLICK}`, 'de')).container;
    expect(de.querySelector('.agc-consent__fine')!.textContent).toContain(
      'einem Council. Google kann sie deinem Google-Konto zuordnen und auch in den USA verarbeiten. Für personalisierte Werbung geben wir sie nicht frei. Sonst nichts über dich.'
    );
  });

  it('carries the age line on its own, between the words and the answers', async () => {
    for (const [lang, line] of [['en', 'If you’re under 16, please say no.'], ['de', 'Bist du unter 16, sag bitte Nein.']] as const) {
      const { container, unmount } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`, lang);
      const age = container.querySelector('.agc-consent__age')!;
      expect(age.textContent).toBe(line);
      expect(age.previousElementSibling!.classList.contains('agc-consent__words')).toBe(true);
      expect(age.nextElementSibling!.classList.contains('agc-consent__actions')).toBe(true);
      unmount();
    }
  });
});

describe('ArrivalChoice close control', () => {
  const closeOf = (container: HTMLElement) => container.querySelector('button.agc-consent__x') as HTMLButtonElement;

  it('is a named button, last in the tab order, after both answers', async () => {
    const en = (await mountAt(`/marcus-aurelius/?gclid=${CLICK}`)).container;
    const buttons = Array.from(en.querySelectorAll('button'));
    expect(buttons.map((b) => b.className)).toEqual(['agc-consent__btn', 'agc-consent__btn', 'agc-consent__x']);
    expect(closeOf(en).getAttribute('aria-label')).toBe('Close. This counts as no.');
    expect(en.querySelector('.agc-consent')!.lastElementChild).toBe(closeOf(en));
    const de = (await mountAt(`/marcus-aurelius/?gclid=${CLICK}`, 'de')).container;
    expect(closeOf(de).getAttribute('aria-label')).toBe('Schließen. Das zählt als Nein.');
  });

  it('drops the click ID, stores nothing, sends one keyless count and nothing to Google', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`, 'de');
    // The shown count belongs to the card's arrival, not to the close.
    await new Promise((r) => setTimeout(r, 0));
    sent = [];
    const capture = await import('@client/utils/public/gclidCapture');
    expect(capture.getGclid()).toBe(CLICK);
    await act(async () => { fireEvent.click(closeOf(container)); });
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('.agc-consent')).toBeNull();
    expect(capture.getGclid()).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://llm.agoracosmica.org/v1/funnel');
    const { step, path, language, bucket, ...rest } = sent[0].body;
    expect(step).toBe('ad_consent_dismissed');
    expect(path).toBe('/marcus-aurelius/');
    expect(language).toBe('de');
    expect([0, 1, 2, 3]).toContain(bucket);
    expect(rest).toEqual({});
    expect(JSON.stringify(sent[0].body)).not.toContain(CLICK);
  });

  it('is not remembered: the next ad arrival asks again', async () => {
    const first = (await mountAt(`/marcus-aurelius/?gclid=${CLICK}`)).container;
    await act(async () => { fireEvent.click(closeOf(first)); });
    const next = (await mountAt(`/seneca/?gclid=${CLICK}`)).container;
    expect(next.querySelector('.agc-consent')).not.toBeNull();
  });

  it('a yes or a no after the close cannot happen: the card stays gone on this page', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await act(async () => { fireEvent.click(closeOf(container)); });
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  // 1.1.0 is the card before the Google account and USA sentence.
  it('asks again when the stored yes was given under the earlier text', async () => {
    for (const version of ['1.1.0', '1.0.0']) {
      localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version, timestamp: Date.now() }));
      const { container, unmount } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
      expect(container.querySelector('.agc-consent')).not.toBeNull();
      expect(storageKeys(sessionStorage)).toEqual([]);
      unmount();
    }
  });

  it('does not ask again after a no given under the earlier text', async () => {
    for (const version of ['1.1.0', '1.0.0']) {
      localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: false, version, timestamp: Date.now() }));
      const { container, unmount } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
      expect(container.querySelector('.agc-consent')).toBeNull();
      expect(storageKeys(sessionStorage)).toEqual([]);
      unmount();
    }
  });

  it('still never shows on a paid arrival, whatever version is stored', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version: '1.0.0', timestamp: Date.now() }));
    const { container } = await mountAt(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    expect(container.querySelector('.agc-consent')).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
  });
});
