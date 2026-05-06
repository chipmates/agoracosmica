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
 * Check if user prefers text input based on stored preferences
 */
export const preferTextInput = (): boolean => {
  return localStorage.getItem('preferTextInput') === 'true';
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

