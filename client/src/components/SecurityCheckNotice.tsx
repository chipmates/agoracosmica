// The calm line a visitor sees while a send waits on the invisible bot check.
// Surfaces with their own waiting card (ProcessingLoader) host the line
// themselves; this fallback covers the rest (council, summary, ask while
// listening) and steps aside while any host is mounted.
import { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from '../hooks/useTranslation';
import {
  SESSION_WAIT_END_EVENT,
  SESSION_WAIT_START_EVENT,
  isSessionWaitVisible,
} from '../services/proxy/sessionManager';
import {
  TURNSTILE_INTERACTIVE_END_EVENT,
  TURNSTILE_INTERACTIVE_START_EVENT,
  clearLiftPx,
  isTurnstileInteractive,
} from '../services/proxy/turnstile';
import './SecurityCheckNotice.css';

const HOSTS_CHANGED_EVENT = 'agc:security-notice-hosts';
const PLACEMENT_RECHECK_MS = 400;
let inlineHosts = 0;

/** What the bot check asks of the visitor right now, seeded from the module snapshots. */
export function useSecurityCheckState(): { waiting: boolean; interactive: boolean } {
  const [waiting, setWaiting] = useState(isSessionWaitVisible);
  const [interactive, setInteractive] = useState(isTurnstileInteractive);
  useEffect(() => {
    const sync = (): void => {
      setWaiting(isSessionWaitVisible());
      setInteractive(isTurnstileInteractive());
    };
    const events = [
      SESSION_WAIT_START_EVENT, SESSION_WAIT_END_EVENT,
      TURNSTILE_INTERACTIVE_START_EVENT, TURNSTILE_INTERACTIVE_END_EVENT,
    ];
    events.forEach((e) => window.addEventListener(e, sync));
    // Catch a change that slipped between the seeded state and here.
    sync();
    return () => events.forEach((e) => window.removeEventListener(e, sync));
  }, []);
  return { waiting, interactive };
}

/** Mark the calling surface as the one that shows the waiting line. */
export function useSecurityNoticeHost(): void {
  useEffect(() => {
    inlineHosts += 1;
    window.dispatchEvent(new CustomEvent(HOSTS_CHANGED_EVENT));
    return () => {
      inlineHosts = Math.max(0, inlineHosts - 1);
      window.dispatchEvent(new CustomEvent(HOSTS_CHANGED_EVENT));
    };
  }, []);
}

function useInlineHostCount(): number {
  const [count, setCount] = useState(inlineHosts);
  useEffect(() => {
    const sync = (): void => setCount(inlineHosts);
    window.addEventListener(HOSTS_CHANGED_EVENT, sync);
    sync();
    return () => window.removeEventListener(HOSTS_CHANGED_EVENT, sync);
  }, []);
  return count;
}

const SecurityCheckNotice: FC = () => {
  const { tString } = useTranslation();
  const { waiting, interactive } = useSecurityCheckState();
  const hosts = useInlineHostCount();
  const show = waiting && !interactive && hosts === 0;
  const ref = useRef<HTMLDivElement>(null);
  const [liftPx, setLiftPx] = useState<number | null>(null);

  // Placed like the asking box: clear of every control on screen.
  useLayoutEffect(() => {
    if (!show) {
      setLiftPx(null);
      return;
    }
    let current: number | null = null;
    const place = (): void => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      current = clearLiftPx(rect.width, rect.height, el, current);
      setLiftPx(current);
    };
    place();
    const timer = setInterval(place, PLACEMENT_RECHECK_MS);
    return () => clearInterval(timer);
  }, [show]);

  if (!show) return null;

  return ReactDOM.createPortal(
    <div
      ref={ref}
      className="security-check-notice"
      role="status"
      aria-live="polite"
      style={{ bottom: liftPx === null ? undefined : `${liftPx}px`, visibility: liftPx === null ? 'hidden' : undefined }}
    >
      <span className="security-check-notice__dot" aria-hidden="true" />
      <span>{tString('processing.securityWait', 'One moment, a quick security check is running.')}</span>
    </div>,
    document.body,
  );
};

export default SecurityCheckNotice;
