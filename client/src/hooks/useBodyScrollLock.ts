import { useEffect } from 'react';

let lockCount = 0;
const originalOverflow = { value: '' };

/**
 * Lock body scroll when enabled. Uses ref counting so multiple
 * simultaneous modals don't conflict — scroll only restores
 * when the last lock is released.
 */
export function useBodyScrollLock(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    if (lockCount === 0) {
      originalOverflow.value = document.body.style.overflow;
    }
    lockCount++;
    document.body.style.overflow = 'hidden';

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow.value;
      }
    };
  }, [enabled]);
}
