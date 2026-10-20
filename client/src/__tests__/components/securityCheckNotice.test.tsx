// The waiting line for the invisible bot check: shown in the processing card
// when a send waits on it, shown by the page-level notice everywhere else, never
// twice, and handed over to the tap instruction once the box asks.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ waiting: false, interactive: false }));

vi.mock('../../services/proxy/sessionManager', () => ({
  SESSION_WAIT_START_EVENT: 'agc:session-wait-start',
  SESSION_WAIT_END_EVENT: 'agc:session-wait-end',
  isSessionWaitVisible: () => h.waiting,
}));
vi.mock('../../services/proxy/turnstile', () => ({
  TURNSTILE_INTERACTIVE_START_EVENT: 'agc:turnstile-interactive-start',
  TURNSTILE_INTERACTIVE_END_EVENT: 'agc:turnstile-interactive-end',
  isTurnstileInteractive: () => h.interactive,
  clearLiftPx: () => 120,
}));
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    tString: (_key: string, fallback?: string) => fallback ?? '',
    tNode: (key: string) => key,
    language: 'en',
  }),
}));
vi.mock('../../hooks/useLiquidGlass', () => ({ useLiquidGlass: () => ({ glassClasses: '' }) }));

import SecurityCheckNotice from '../../components/SecurityCheckNotice';
import ProcessingLoader from '../../components/ProcessingLoader';

const WAIT_LINE = 'One moment, a quick security check is running.';
const TAP_LINE = /Tap the box/;

function setWaiting(waiting: boolean): void {
  h.waiting = waiting;
  act(() => { window.dispatchEvent(new CustomEvent(waiting ? 'agc:session-wait-start' : 'agc:session-wait-end')); });
}

function setInteractive(interactive: boolean): void {
  h.interactive = interactive;
  act(() => {
    window.dispatchEvent(new CustomEvent(interactive ? 'agc:turnstile-interactive-start' : 'agc:turnstile-interactive-end'));
  });
}

describe('security check waiting line', () => {
  beforeEach(() => {
    h.waiting = false;
    h.interactive = false;
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('page notice appears only while a send waits on the check', () => {
    render(<SecurityCheckNotice />);
    expect(screen.queryByText(WAIT_LINE)).toBeNull();

    setWaiting(true);
    const line = screen.getByText(WAIT_LINE);
    expect(line.closest('[role="status"]')).not.toBeNull();
    expect((line.closest('.security-check-notice') as HTMLElement).style.bottom).toBe('120px');

    setWaiting(false);
    expect(screen.queryByText(WAIT_LINE)).toBeNull();
  });

  it('page notice gives way to the box once it asks for a tap', () => {
    render(<SecurityCheckNotice />);
    setWaiting(true);
    setInteractive(true);
    expect(screen.queryByText(WAIT_LINE)).toBeNull();
  });

  it('processing card shows the line in place of the quote, and the page notice steps aside', () => {
    render(
      <>
        <SecurityCheckNotice />
        <ProcessingLoader figureName="Echo of Marcus Aurelius" stage="preparing" />
      </>,
    );
    act(() => { vi.advanceTimersByTime(300); });
    setWaiting(true);

    expect(screen.getAllByText(WAIT_LINE)).toHaveLength(1);
    expect(screen.getByText(WAIT_LINE).className).toContain('cosmic-processing-security--wait');
  });

  it('processing card switches to the tap instruction when the box asks', () => {
    render(<ProcessingLoader figureName="Echo of Marcus Aurelius" stage="preparing" />);
    act(() => { vi.advanceTimersByTime(300); });
    setWaiting(true);
    setInteractive(true);

    expect(screen.queryByText(WAIT_LINE)).toBeNull();
    expect(screen.getByText(TAP_LINE)).toBeTruthy();
  });

  it('time on the check does not count toward the busy-server copy', () => {
    render(<ProcessingLoader figureName="Echo of Marcus Aurelius" stage="preparing" />);
    act(() => { vi.advanceTimersByTime(300); });
    setWaiting(true);
    act(() => { vi.advanceTimersByTime(20_000); });
    setWaiting(false);
    act(() => { vi.advanceTimersByTime(6_000); });

    // 26 s on screen, but only about 6 s of it on the server: still normal.
    const overlay = document.querySelector('.cosmic-processing-overlay') as HTMLElement;
    expect(overlay.className).toContain('capacity-normal');
  });
});
