// src/hooks/useFocusTrap.ts
// Reusable focus trap for modals/dialogs — handles Tab cycling, Escape, scroll lock, focus restoration

import { useEffect, useRef, RefObject } from 'react';
import { useBodyScrollLock } from './useBodyScrollLock';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  onClose?: () => void;
  enabled?: boolean;
  restoreFocus?: boolean;
  lockScroll?: boolean;
}

/**
 * Traps focus within a container element while active.
 *
 * - Cycles Tab/Shift+Tab within focusable children
 * - Closes on Escape (if onClose provided)
 * - Locks body scroll while active
 * - Restores focus to previously active element on cleanup
 *
 * @returns A ref to attach to the modal container element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions = {}
): RefObject<T> {
  const { onClose, enabled = true, restoreFocus = true, lockScroll = true } = options;
  const containerRef = useRef<T>(null);
  const previousActiveRef = useRef<Element | null>(null);

  // Delegate scroll lock to ref-counted hook
  useBodyScrollLock(enabled && lockScroll);

  useEffect(() => {
    if (!enabled) return;

    previousActiveRef.current = document.activeElement;

    // Focus first focusable element (or container itself)
    const container = containerRef.current;
    if (container) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (first) {
        first.focus();
      } else {
        container.focus();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (!container) return;

      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      if (restoreFocus && previousActiveRef.current instanceof HTMLElement) {
        previousActiveRef.current.focus();
      }
    };
  }, [enabled, onClose, restoreFocus, lockScroll]);

  return containerRef;
}
