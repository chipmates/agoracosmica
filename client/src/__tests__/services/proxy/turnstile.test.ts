// The Turnstile widget is a fixed overlay sitting on top of the whole app, so
// the invariant under test is pointer reachability, not the challenge itself:
// the box may only take a tap while it is actually asking for one, and when it
// asks it has to clear the composer and the bottom controls at every width.
//
// The module injects its own <script> and reads window.turnstile, so the tests
// stub the loader by dispatching the script's load event on append, and reset
// modules per test because the module keeps script/widget state at module level.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../utils/funnelBeacon', () => ({
  sendFunnelBeacon: vi.fn(),
  sendFunnelBeaconOnce: vi.fn(),
}));

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
    document.querySelectorAll('.unified-input-container, .stop-voice-pill').forEach((el) => el.remove());
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

  it('clears the stop-voice pill pinned above the composer', async () => {
    setInnerWidth(1440);
    setInnerHeight(900);
    mountComposer(80);
    mountBottomControl('stop-voice-pill', 44, 94);
    const { options, container } = await renderWidget();

    options['before-interactive-callback']();

    // Pill top is at 762, and it is the highest bottom control on screen.
    expect(container.style.bottom).toBe('150px');
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

  it('resolves with the token and hides the container on success', async () => {
    const { token, options, container } = await renderWidget();

    options.callback('tok');

    await expect(token).resolves.toBe('tok');
    expect(container.style.display).toBe('none');
  });
});
