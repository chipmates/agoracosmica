// The Turnstile widget is a fixed overlay sitting on top of the whole app, so
// the invariant under test is pointer reachability, not the challenge itself:
// the box may only take a tap while it is actually asking for one, and when it
// asks it has to clear every control a visitor can reach on that screen (the
// consent card, the figure pick, the composer) at every width.
//
// The module injects its own <script> and reads window.turnstile, so the tests
// stub the loader by dispatching the script's load event on append, and reset
// modules per test because the module keeps script/widget state at module level.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../utils/funnelBeacon', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/funnelBeacon')>()),
  sendFunnelBeacon: vi.fn(),
  sendFunnelBeaconOnce: vi.fn(),
}));

import { sendFunnelBeacon } from '../../../utils/funnelBeacon';

type TurnstileOptions = {
  sitekey: string;
  size: string;
  appearance: string;
  retry: string;
  language?: string;
  'refresh-expired'?: string;
  'before-interactive-callback': () => void;
  callback: (token: string) => void;
  'error-callback': (code?: string) => unknown;
  'expired-callback': () => void;
};

const CONTAINER_ID = 'turnstile-container';

let renderMock: ReturnType<typeof vi.fn>;
let removeMock: ReturnType<typeof vi.fn>;
let capturedOptions: TurnstileOptions | null = null;
let originalInnerWidth: number;
let originalInnerHeight: number;

/** Make the injected script resolve, with window.turnstile in place. */
function stubScriptLoader(): void {
  const realAppend = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
    const appended = realAppend(node);
    if ((node as unknown as HTMLElement).tagName === 'SCRIPT') {
      removeMock = vi.fn();
      (window as unknown as Record<string, unknown>).turnstile = {
        render: renderMock,
        remove: removeMock,
        reset: vi.fn(),
      };
      node.dispatchEvent(new Event('load'));
    }
    return appended;
  });
}

/** Render the widget and hand back the pending token plus what it rendered. */
async function renderWidget(): Promise<{
  token: Promise<string>;
  options: TurnstileOptions;
  container: HTMLElement;
}> {
  const { getTurnstileToken } = await import('../../../services/proxy/turnstile');
  const token = getTurnstileToken();
  // Handled here so an unsettled challenge never surfaces as an unhandled
  // rejection when the test tears the widget down.
  token.catch(() => { /* asserted per test */ });
  await vi.waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));
  const container = document.getElementById(CONTAINER_ID);
  expect(container).not.toBeNull();
  return { token, options: capturedOptions as TurnstileOptions, container: container as HTMLElement };
}

function setInnerWidth(px: number): void {
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true, writable: true });
}

function setInnerHeight(px: number): void {
  Object.defineProperty(window, 'innerHeight', { value: px, configurable: true, writable: true });
}

/** A bottom control of the given height, offset up from the viewport edge. */
function mountBottomControl(className: string, heightPx: number, offsetPx = 0): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  const bottom = window.innerHeight - offsetPx;
  const top = bottom - heightPx;
  el.getBoundingClientRect = () => ({
    x: 0, y: top, top, bottom, left: 0, right: window.innerWidth,
    width: window.innerWidth, height: heightPx, toJSON: () => ({}),
  }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

/** A composer of the given height sitting on the bottom edge of the viewport. */
function mountComposer(heightPx: number): HTMLElement {
  return mountBottomControl('unified-input-container', heightPx);
}

/** Give an element a fixed viewport rect (jsdom lays nothing out). */
function setRect(el: HTMLElement, x: number, y: number, w: number, h: number): HTMLElement {
  el.getBoundingClientRect = () => ({
    x, y, top: y, left: x, bottom: y + h, right: x + w, width: w, height: h, toJSON: () => ({}),
  }) as DOMRect;
  return el;
}

/** A tappable control at a fixed spot, like the pick screen's Select. */
function mountButton(label: string, x: number, y: number, w: number, h: number): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = label;
  el.className = 'test-control';
  setRect(el, x, y, w, h);
  document.body.appendChild(el);
  return el;
}

/** The figure pick at 390x844, as measured on 18 Oct: Select and See all 30 on one row. */
function mountPickScreen(): void {
  mountButton('Select', 20, 708, 178, 46);
  mountButton('See all 30', 216, 709, 154, 44);
}

describe('turnstile widget placement', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    capturedOptions = null;
    renderMock = vi.fn((_el: HTMLElement, options: TurnstileOptions) => {
      capturedOptions = options;
      return 'widget-1';
    });
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    stubScriptLoader();
  });

  afterEach(() => {
    // Clears the challenge timeout the module armed at render.
    try { capturedOptions?.['error-callback']?.(); } catch { /* already settled */ }
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    setInnerWidth(originalInnerWidth);
    setInnerHeight(originalInnerHeight);
    document.querySelectorAll('.unified-input-container, .test-control').forEach((el) => el.remove());
    document.getElementById(CONTAINER_ID)?.remove();
    document.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((s) => s.remove());
    delete (window as unknown as Record<string, unknown>).turnstile;
  });

  it('renders the managed check invisible until a tap is required', async () => {
    const { options } = await renderWidget();

    expect(options.appearance).toBe('interaction-only');
    expect(options.size).toBe('normal');
    expect(options.sitekey).toBe('test-site-key');
  });

  it('parks the box in the corner where it cannot take a tap', async () => {
    const { container } = await renderWidget();

    expect(container.style.pointerEvents).toBe('none');
    expect(container.style.position).toBe('fixed');
    expect(container.style.bottom).toBe('0px');
    expect(container.style.right).toBe('0px');
  });

  it('makes the box tappable and centred when the challenge escalates', async () => {
    setInnerWidth(1440);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    expect(container.style.pointerEvents).toBe('auto');
    expect(container.style.left).toBe('50%');
    expect(container.style.bottom).toBe('16px');
  });

  it('lifts the escalated box clear of the bottom controls on a narrow screen', async () => {
    setInnerWidth(390);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    expect(container.style.pointerEvents).toBe('auto');
    expect(container.style.bottom).toBe('96px');
  });

  it('lifts the escalated box above the composer on a wide screen', async () => {
    setInnerWidth(1440);
    setInnerHeight(900);
    mountComposer(80);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    // Composer top is at 820, so the box sits 92px up: clear of it, not at 16.
    expect(container.style.bottom).toBe('92px');
  });

  it('lifts the escalated box above a grown composer on a narrow screen', async () => {
    setInnerWidth(390);
    setInnerHeight(844);
    mountComposer(155);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    expect(container.style.bottom).toBe('167px');
  });

  it('re-lifts the escalated box when the composer mounts after the challenge', async () => {
    setInnerWidth(1440);
    setInnerHeight(900);
    const { options, container } = await renderWidget();

    // The challenge escalates at the consent gate, where no composer exists yet.
    options['before-interactive-callback']();
    expect(container.style.bottom).toBe('16px');

    mountComposer(80);
    await vi.waitFor(() => expect(container.style.bottom).toBe('92px'), { timeout: 3000 });
  });

  it('keeps the escalated box on screen when the composer fills the viewport', async () => {
    setInnerWidth(390);
    setInnerHeight(844);
    mountComposer(844);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    // Clamped to the widget height plus its gap, so the box never leaves the top.
    expect(container.style.bottom).toBe('760px');
  });

  it('lifts the asking box off the Select button of the figure pick', async () => {
    setInnerWidth(390);
    setInnerHeight(844);
    mountPickScreen();
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    // Select's top is at 708: the box sits a gap above it, not over it at 96.
    expect(container.style.bottom).toBe('148px');
  });

  it('climbs past stacked controls to the first clear gap', async () => {
    setInnerWidth(390);
    setInnerHeight(844);
    mountPickScreen();
    mountButton('Play intro', 157, 637, 130, 34);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    // Above Select (148) the box would still touch Play intro, so it clears that too.
    expect(container.style.bottom).toBe('219px');
  });

  it('keeps the consent line clear along with the Terms link inside it', async () => {
    setInnerWidth(390);
    setInnerHeight(844);
    const line = setRect(document.createElement('p'), 40, 690, 310, 40);
    line.className = 'test-control';
    line.append('By continuing you agree to the ');
    const link = setRect(document.createElement('a'), 105, 702, 119, 19);
    link.setAttribute('href', '/terms');
    link.textContent = 'Terms of Service';
    line.appendChild(link);
    document.body.appendChild(line);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    expect(container.style.bottom).toBe('166px');
  });

  it('keeps off a marked disclosure when the screen has room above it', async () => {
    setInnerWidth(390);
    setInnerHeight(844);
    const notice = setRect(document.createElement('div'), 25, 410, 340, 195);
    notice.className = 'test-control';
    notice.setAttribute('data-keep-clear', '');
    document.body.appendChild(notice);
    const line = setRect(document.createElement('p'), 40, 650, 310, 70);
    line.className = 'test-control';
    const link = setRect(document.createElement('a'), 105, 680, 119, 19);
    link.setAttribute('href', '/terms');
    line.appendChild(link);
    document.body.appendChild(line);
    mountButton('Start exploring', 95, 755, 200, 44);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    // Above the button, the consent line and the notice: over the quote instead.
    expect(container.style.bottom).toBe('446px');
  });

  it('counts only the part of a disclosure its scrolling panel shows', async () => {
    setInnerWidth(375);
    setInnerHeight(667);
    const panel = setRect(document.createElement('div'), 0, 0, 375, 380);
    panel.className = 'test-control';
    panel.style.overflowY = 'auto';
    const notice = setRect(document.createElement('div'), 20, 300, 335, 400);
    notice.setAttribute('data-keep-clear', '');
    panel.appendChild(notice);
    document.body.appendChild(panel);
    mountButton('Consent line', 30, 480, 315, 40);
    mountButton('Start exploring', 90, 560, 200, 40);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    // The notice shows only 300 to 380, so the box fits between it and the line.
    expect(container.style.bottom).toBe('199px');
  });

  it('lets a control outrank a marked disclosure on a short screen', async () => {
    setInnerWidth(375);
    setInnerHeight(667);
    const notice = setRect(document.createElement('div'), 20, 60, 335, 500);
    notice.className = 'test-control';
    notice.setAttribute('data-keep-clear', '');
    document.body.appendChild(notice);
    mountButton('Consent line', 30, 580, 315, 40);
    mountButton('Start exploring', 90, 630, 200, 30);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    // No room around the notice: the box covers part of it, never the controls.
    expect(container.style.bottom).toBe('99px');
  });

  it('may sit over a control that a modal backdrop already covers', async () => {
    setInnerWidth(390);
    setInnerHeight(844);
    mountPickScreen();
    const backdrop = document.createElement('div');
    document.body.appendChild(backdrop);
    const realHitTest = document.elementFromPoint;
    document.elementFromPoint = () => backdrop;
    try {
      const { options, container } = await renderWidget();
      options['before-interactive-callback']();
      expect(container.style.bottom).toBe('96px');
    } finally {
      document.elementFromPoint = realHitTest;
      backdrop.remove();
    }
  });

  it('leaves controls outside its own column alone', async () => {
    setInnerWidth(390);
    setInnerHeight(844);
    // The box spans 45 to 345 at this width; a corner icon at 350 is beside it.
    mountButton('Menu', 350, 700, 40, 40);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    expect(container.style.bottom).toBe('96px');
  });

  it('moves when a control lands under it, and holds a clear spot after', async () => {
    setInnerWidth(390);
    setInnerHeight(844);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();
    expect(container.style.bottom).toBe('96px');

    // The consent card closes and the pick screen arrives under the box.
    mountPickScreen();
    await vi.waitFor(() => expect(container.style.bottom).toBe('148px'), { timeout: 3000 });

    // Gone again: the spot is still clear, so the box does not hop back.
    document.querySelectorAll('.test-control').forEach((el) => el.remove());
    await new Promise((r) => setTimeout(r, 900));
    expect(container.style.bottom).toBe('148px');
  });

  it('drops back down when a new screen opens room far below it', async () => {
    setInnerWidth(390);
    setInnerHeight(844);
    // A stack of controls up to y 420 pushes the box high, as on a busy screen.
    for (let y = 420; y < 760; y += 60) mountButton(`Row ${y}`, 60, y, 270, 44);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();
    expect(container.style.bottom).toBe('436px');

    // The next screen has only a composer at the bottom: the box follows it down.
    document.querySelectorAll('.test-control').forEach((el) => el.remove());
    mountComposer(130);
    await vi.waitFor(() => expect(container.style.bottom).toBe('142px'), { timeout: 3000 });
  });

  it('measures the same way at 768 and 1280', async () => {
    for (const [width, floor] of [[768, 96], [1280, 16]] as const) {
      setInnerWidth(width);
      setInnerHeight(800);
      const select = mountButton('Select', width / 2 - 60, 800 - floor - 40, 120, 46);
      const { options, container } = await renderWidget();
      options['before-interactive-callback']();
      // The box clears the button's top by the gap, whatever the floor.
      expect(container.style.bottom).toBe(`${800 - (800 - floor - 40) + 12}px`);
      options['error-callback']();
      select.remove();
      container.remove();
      renderMock.mockClear();
    }
  });

  it('resolves with the token and hides the container on success', async () => {
    const { token, options, container } = await renderWidget();

    options.callback('tok');

    await expect(token).resolves.toBe('tok');
    expect(container.style.display).toBe('none');
  });
});

describe('turnstile beacons', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    capturedOptions = null;
    renderMock = vi.fn((_el: HTMLElement, options: TurnstileOptions) => {
      capturedOptions = options;
      return 'widget-1';
    });
    vi.mocked(sendFunnelBeacon).mockClear();
    stubScriptLoader();
  });

  afterEach(() => {
    try { capturedOptions?.['error-callback']?.(); } catch { /* already settled */ }
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    document.getElementById(CONTAINER_ID)?.remove();
    document.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((s) => s.remove());
    delete (window as unknown as Record<string, unknown>).turnstile;
  });

  const steps = (): string[] => vi.mocked(sendFunnelBeacon).mock.calls.map((c) => c[0] as string);

  it('keeps the old sequence for an invisible pass and adds one timing row', async () => {
    const { token, options } = await renderWidget();
    options.callback('tok');
    await token;

    expect(steps()).toEqual(['turnstile_started', 'turnstile_token']);
    expect(vi.mocked(sendFunnelBeacon).mock.calls[1][1]).toEqual({ bucket: 0, mode: 'ahead' });
  });

  it('keeps the old sequence for a solved checkbox', async () => {
    const { token, options } = await renderWidget();
    options['before-interactive-callback']();
    options.callback('tok');
    await token;

    expect(steps()).toEqual(['turnstile_started', 'turnstile_interactive', 'turnstile_solved', 'turnstile_token']);
  });

  it('labels the timing row waited when a send was waiting on the check', async () => {
    const { markTurnstileAwaited } = await import('../../../services/proxy/turnstile');
    const { token, options } = await renderWidget();
    markTurnstileAwaited();
    options.callback('tok');
    await token;

    const calls = vi.mocked(sendFunnelBeacon).mock.calls;
    expect(calls[calls.length - 1]).toEqual(['turnstile_token', { bucket: 0, mode: 'waited' }]);
  });

  it('writes no timing row for a failed check', async () => {
    const { token, options } = await renderWidget();
    options['error-callback']();
    await expect(token).rejects.toThrow();

    expect(steps()).toEqual(['turnstile_started', 'turnstile_failed']);
  });
});

// After a check settles, the widget may still act on its own: Cloudflare's
// retry re-runs a failed check, its refresh re-issues a token after about five
// minutes. None of that may ask the visitor again, leave a box on screen or
// count a second time.
describe('turnstile after the check settles', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    capturedOptions = null;
    renderMock = vi.fn((_el: HTMLElement, options: TurnstileOptions) => {
      capturedOptions = options;
      return 'widget-1';
    });
    vi.mocked(sendFunnelBeacon).mockClear();
    setInnerWidth(390);
    setInnerHeight(844);
    stubScriptLoader();
  });

  afterEach(() => {
    try { capturedOptions?.['error-callback']?.(); } catch { /* already settled */ }
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    setInnerWidth(originalInnerWidth);
    setInnerHeight(originalInnerHeight);
    document.querySelectorAll('.unified-input-container, .test-control').forEach((el) => el.remove());
    document.getElementById(CONTAINER_ID)?.remove();
    document.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((s) => s.remove());
    delete (window as unknown as Record<string, unknown>).turnstile;
  });

  const steps = (): string[] => vi.mocked(sendFunnelBeacon).mock.calls.map((c) => c[0] as string);
  const failures = (): unknown[] => vi.mocked(sendFunnelBeacon).mock.calls
    .filter((c) => c[0] === 'turnstile_failed').map((c) => c[1]);

  it('asks Cloudflare not to retry a failed check by itself', async () => {
    const { options } = await renderWidget();

    expect(options.retry).toBe('never');
  });

  it('takes the failed box off the screen when the check errors', async () => {
    mountComposer(120);
    const { token, options, container } = await renderWidget();
    options['before-interactive-callback']();
    expect(container.style.pointerEvents).toBe('auto');

    options['error-callback']();

    await expect(token).rejects.toThrow('Turnstile challenge failed');
    // Removed, so Cloudflare's "verification failed" box cannot sit over the
    // composer's mic and send, nor over the error toast's close button.
    expect(removeMock).toHaveBeenCalledWith('widget-1');
    expect(container.style.display).toBe('none');
    expect(container.style.pointerEvents).toBe('none');
  });

  it('tells Cloudflare the error is handled, so it schedules no retry of its own', async () => {
    const { token, options } = await renderWidget();

    // Anything but true makes Cloudflare log the code and, for crash-class
    // codes, re-run the check even with retry set to never.
    expect(options['error-callback']('300030')).toBe(true);
    await expect(token).rejects.toThrow();
    expect(options['error-callback']('300030')).toBe(true);
  });

  it('starts no new ask after an error when the widget re-asks by itself', async () => {
    const { isTurnstileInteractive, TURNSTILE_INTERACTIVE_START_EVENT } = await import('../../../services/proxy/turnstile');
    const { token, options, container } = await renderWidget();
    options['error-callback']();
    await expect(token).rejects.toThrow();
    const started = vi.fn();
    window.addEventListener(TURNSTILE_INTERACTIVE_START_EVENT, started);

    try {
      // A late escalation from the failed widget: nothing waits on it.
      options['before-interactive-callback']();

      expect(container.style.pointerEvents).toBe('none');
      expect(isTurnstileInteractive()).toBe(false);
      expect(started).not.toHaveBeenCalled();
      expect(steps()).toEqual(['turnstile_started', 'turnstile_failed']);
    } finally {
      window.removeEventListener(TURNSTILE_INTERACTIVE_START_EVENT, started);
    }
  });

  it('counts a failed check once: no later timeout, no second error', async () => {
    vi.useFakeTimers();
    const { token, options } = await renderWidget();
    options['before-interactive-callback']();
    options['error-callback']();
    await expect(token).rejects.toThrow();

    // What the widget's own retry did: ask again, fail again, then the timer.
    options['before-interactive-callback']();
    options['error-callback']();
    await vi.advanceTimersByTimeAsync(130_000);

    expect(steps()).toEqual(['turnstile_started', 'turnstile_interactive', 'turnstile_failed']);
    expect(failures()).toEqual([{ outcome: 'error' }]);
  });

  it('counts a timed-out check once, even if the widget errors after it', async () => {
    vi.useFakeTimers();
    const { token, options } = await renderWidget();
    await vi.advanceTimersByTimeAsync(31_000);
    await expect(token).rejects.toThrow('timed out');

    options['error-callback']();

    expect(failures()).toEqual([{ outcome: 'timeout' }]);
  });

  it('writes no row for a token that arrives after the check failed', async () => {
    const { token, options } = await renderWidget();
    options['before-interactive-callback']();
    options['error-callback']();
    await expect(token).rejects.toThrow();

    options.callback('late-token');

    expect(steps()).toEqual(['turnstile_started', 'turnstile_interactive', 'turnstile_failed']);
  });

  it("writes one token row per token handed out, none on Cloudflare's refresh", async () => {
    const { token, options } = await renderWidget();
    options.callback('tok');
    await expect(token).resolves.toBe('tok');

    // About five minutes later: the token ages out and Cloudflare re-issues one.
    options['expired-callback']();
    options.callback('tok-refreshed');
    options['expired-callback']();
    options.callback('tok-refreshed-again');

    expect(steps().filter((s) => s === 'turnstile_token')).toHaveLength(1);
    // The aged-token counter keeps its meaning: one row per expiry, as before.
    expect(steps()).toEqual([
      'turnstile_started', 'turnstile_token', 'turnstile_token_aged', 'turnstile_token_aged',
    ]);
  });

  it('keeps a refresh that asks for a tap hidden and uncounted', async () => {
    const { isTurnstileInteractive } = await import('../../../services/proxy/turnstile');
    const { token, options, container } = await renderWidget();
    options.callback('tok');
    await token;

    options['expired-callback']();
    options['before-interactive-callback']();

    expect(isTurnstileInteractive()).toBe(false);
    expect(container.style.display).toBe('none');
    expect(container.style.pointerEvents).toBe('none');
    expect(steps()).not.toContain('turnstile_interactive');
  });

  it('writes no failure for a refresh that errors after a success', async () => {
    const { token, options } = await renderWidget();
    options.callback('tok');
    await token;

    options['error-callback']();

    expect(steps()).toEqual(['turnstile_started', 'turnstile_token']);
  });
});

// The box speaks the app's language: a German app in an English browser asks
// in German, so the box matches the line above it that says what to tap.
describe('turnstile language', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    capturedOptions = null;
    renderMock = vi.fn((_el: HTMLElement, options: TurnstileOptions) => {
      capturedOptions = options;
      return 'widget-1';
    });
    stubScriptLoader();
  });

  afterEach(() => {
    try { capturedOptions?.['error-callback']?.(); } catch { /* already settled */ }
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    document.documentElement.lang = '';
    document.getElementById(CONTAINER_ID)?.remove();
    document.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((s) => s.remove());
    delete (window as unknown as Record<string, unknown>).turnstile;
  });

  it("renders in German when the app is German and the browser is English", async () => {
    expect(navigator.language.toLowerCase().startsWith('en')).toBe(true);
    const { noteShownLanguage } = await import('../../../utils/shownLanguage');
    noteShownLanguage('de');

    const { options } = await renderWidget();

    expect(options.language).toBe('de');
  });

  it('renders in English when the app is English', async () => {
    const { noteShownLanguage } = await import('../../../utils/shownLanguage');
    noteShownLanguage('en');

    const { options } = await renderWidget();

    expect(options.language).toBe('en');
  });

  it('follows a language switch on the next check', async () => {
    const { noteShownLanguage } = await import('../../../utils/shownLanguage');
    const { getTurnstileToken } = await import('../../../services/proxy/turnstile');
    noteShownLanguage('en');
    const first = await renderWidget();
    first.options.callback('tok');
    await first.token;

    noteShownLanguage('de');
    const second = getTurnstileToken();
    second.catch(() => { /* settled in afterEach */ });
    await vi.waitFor(() => expect(renderMock).toHaveBeenCalledTimes(2));

    expect((capturedOptions as TurnstileOptions).language).toBe('de');
  });

  it('falls back to the page language before the app has reported one', async () => {
    document.documentElement.lang = 'de';

    const { options } = await renderWidget();

    expect(options.language).toBe('de');
  });
});
