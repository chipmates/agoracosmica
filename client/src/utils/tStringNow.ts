import { useDomainStore } from '../stores/domainStore';

/**
 * `tString` for code outside React (controllers, services): reads the UI
 * translations loaded at call time, so the line follows the page's language.
 */
export function tStringNow(key: string, fallback?: string): string {
  let node: unknown = useDomainStore.getState().language?.uiTranslations;
  for (const part of key.split('.')) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
  }
  return typeof node === 'string' && node !== '' ? node : fallback ?? key;
}
