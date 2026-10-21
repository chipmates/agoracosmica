// Opens Settings at the AI model and key section from anywhere in the app.
// Settings lives in the sidebar, which claims the event; where no sidebar is
// mounted, the key setup dialog opens instead.

import { useDomainStore } from '../stores/domainStore';

export const OPEN_KEY_SETTINGS_EVENT = 'open-key-settings';

export function openKeySettings(): void {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent(OPEN_KEY_SETTINGS_EVENT, { cancelable: true });
  const claimed = !window.dispatchEvent(event);
  if (!claimed) useDomainStore.getState().openByokModal();
}
