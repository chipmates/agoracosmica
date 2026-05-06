import { useEffect, useRef } from 'react';

/**
 * Hold a Screen Wake Lock while `active` is true.
 *
 * Uses the W3C Screen Wake Lock API (Chrome 84+, Safari 16.4+, Firefox 126+).
 * Silently no-ops on unsupported browsers and on permission/system denials.
 *
 * Browsers automatically release the lock when the document is hidden, so we
 * re-acquire on `visibilitychange` whenever the page becomes visible again.
 */
export function useScreenWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const acquire = async (): Promise<void> => {
      if (cancelled || sentinelRef.current) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        /* low battery, OS denial, etc. — give up silently */
      }
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      const current = sentinelRef.current;
      sentinelRef.current = null;
      if (current) void current.release().catch(() => {});
    };
  }, [active]);
}

export default useScreenWakeLock;
