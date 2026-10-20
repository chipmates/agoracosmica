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
  'before-interactive-callback': () => void;
  callback: (token: string) => void;
  'error-callback': () => void;
  'expired-callback': () => void;
};

const CONTAINER_ID = 'turnstile-container';

let renderMock: ReturnType<typeof vi.fn>;
let capturedOptions: TurnstileOptions | null = null;
let originalInnerWidth: number;
let originalInnerHeight: number;

/** Make the injected script resolve, with window.turnstile in place. */
function stubScriptLoader(): void {
  const realAppend = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
    const appended = realAppend(node);
    if ((node as unknown as HTMLElement).tagName === 'SCRIPT') {
      (window as unknown as Record<string, unknown>).turnstile = {
        render: renderMock,
        remove: vi.fn(),
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

    expect(vi.mocked(sendFunnelBeacon).mock.calls.at(-1)).toEqual(['turnstile_token', { bucket: 0, mode: 'waited' }]);
  });

  it('writes no timing row for a failed check', async () => {
    const { token, options } = await renderWidget();
    options['error-callback']();
    await expect(token).rejects.toThrow();

    expect(steps()).toEqual(['turnstile_started', 'turnstile_failed']);
  });
});
