// src/utils/inputMethodDetection.ts

/**
 * Utility functions for input method detection and management
 */

/**
 * Input toggle callback function type
 */
export type InputToggleCallback = () => void;

/**
 * Cleanup function type for event listeners
 */
export type CleanupFunction = () => void;

/**
 * Whether the composer should open on the keyboard. With no stored preference
 * the answer is yes: arriving on an open microphone asks for a decision nobody
 * came to make. Only an explicit saved choice can select voice.
 */
export const preferTextInput = (): boolean => {
  try {
    const stored = localStorage.getItem('preferTextInput');
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
};

/**
 * Whether the visitor ever chose an input method themselves. Callers that want
 * to open the composer on text for a reason of their own must not override a
 * real preference, only the absence of one.
 */
export const hasExplicitInputPreference = (): boolean => {
  try {
    return localStorage.getItem('preferTextInput') !== null;
  } catch {
    return false;
  }
};

/**
 * Save user's preference for input method
 * @param useText - Whether the user prefers text input over speech
 */
export const saveInputPreference = (useText: boolean): void => {
  localStorage.setItem('preferTextInput', useText.toString());
};

/**
 * Get the appropriate keyboard shortcut hint based on platform
 */
export const getInputToggleShortcut = (): string => {
  const isMac: boolean = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  return isMac ? '⌘+Shift+M' : 'Ctrl+Shift+M';
};

/**
 * Register global keyboard shortcut for toggling input method
 * @param toggleCallback - Callback to execute when shortcut is pressed
 * @returns Cleanup function to remove the event listener
 */
export const registerInputToggleShortcut = (toggleCallback: InputToggleCallback): CleanupFunction => {
  const handler = (e: KeyboardEvent): void => {
    // Ctrl/Cmd+Shift+M for mic toggle (Ctrl+T conflicts with browser "new tab")
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      toggleCallback();
    }
  };
  
  window.addEventListener('keydown', handler);
  
  // Return cleanup function
  return (): void => {
    window.removeEventListener('keydown', handler);
  };
};

