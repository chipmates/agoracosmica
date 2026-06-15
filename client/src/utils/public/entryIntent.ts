// Entry intent — carries a visitor's choices across the hard <a href="/">
// navigation from a public /figures or /themes page into the app.
//
// Figure: stored in sessionStorage (tab-scoped, transient session intent),
// consumed once after the welcome step.
// Language: written to the app's own 'selectedLanguage' key, so the existing
// boot-time detectBrowserLanguage() opens the app in the page's language.
// Language is a real preference and is meant to persist.

import { LocalStorageAdapter } from '../../storage/localAdapter';
import { figureSlugToId } from '../../data/public/slugMap';

const SS_FIGURE_KEY = 'agc_intended_figure';
const SS_COUNCIL_KEY = 'agc_intended_council';

/**
 * Called from the "Start Exploring" CTA, just before navigating into the app.
 * Records the figure the visitor picked (if any) and the page language.
 */
export function captureEntryIntent(figureId: string | undefined, lang: 'en' | 'de'): void {
  try {
    LocalStorageAdapter.setString('selectedLanguage', lang);
  } catch {
    // storage blocked — the app falls back to browser-locale detection
  }
  try {
    if (typeof sessionStorage !== 'undefined' && figureId && figureId.length < 64) {
      sessionStorage.setItem(SS_FIGURE_KEY, figureId);
    }
  } catch {
    // sessionStorage unavailable (private mode) — no deep-link, normal flow
  }
}

/** Returns the figure id the visitor picked on a public page, or null. */
export function readFigureIntent(): string | null {
  try {
    return typeof sessionStorage === 'undefined'
      ? null
      : sessionStorage.getItem(SS_FIGURE_KEY);
  } catch {
    return null;
  }
}

/** Clears the figure intent. Call once it has been consumed. */
export function clearFigureIntent(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SS_FIGURE_KEY);
    }
  } catch {
    // no-op
  }
}

/**
 * Called from a theme page's council CTA, just before navigating into the
 * app. Records the council the visitor picked and the page language. Mirrors
 * the figure intent: consumed once after the welcome step in
 * routeAfterOnboarding, which opens that council instead of the gallery.
 */
export function captureCouncilIntent(councilId: string | undefined, lang: 'en' | 'de'): void {
  try {
    LocalStorageAdapter.setString('selectedLanguage', lang);
  } catch {
    // storage blocked — the app falls back to browser-locale detection
  }
  try {
    if (typeof sessionStorage !== 'undefined' && councilId && councilId.length < 64) {
      sessionStorage.setItem(SS_COUNCIL_KEY, councilId);
    }
  } catch {
    // sessionStorage unavailable (private mode) — no deep-link, normal flow
  }
}

/** Returns the council id the visitor picked on a public page, or null. */
export function readCouncilIntent(): string | null {
  try {
    return typeof sessionStorage === 'undefined'
      ? null
      : sessionStorage.getItem(SS_COUNCIL_KEY);
  } catch {
    return null;
  }
}

/** Clears the council intent. Call once it has been consumed. */
export function clearCouncilIntent(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SS_COUNCIL_KEY);
    }
  } catch {
    // no-op
  }
}

/**
 * Robust, shareable deep-link reader. Run once at app boot (index.tsx), before
 * React renders. Reads ?figure={slug|id} / ?council={id} from the landing URL
 * and writes the same sessionStorage keys the click delegate uses, so the
 * SINGLE consumer (routeAfterOnboarding for first-timers, the returning-visitor
 * branch in HomePage's init effect) handles all three sources uniformly:
 * same-tab CTA click, new tab / opened-in-background, and a pasted/shared link.
 * Unlike the sessionStorage-only click path, this survives no-JS-at-click,
 * new-tab opens, and copy-paste. The figure param accepts either the public
 * slug (marcus-aurelius) or the internal id (aurelius). Params are stripped
 * with replaceState so a reload doesn't re-fire the deep-link. The optional
 * lang param mirrors the click path (agc-public.js writes selectedLanguage from
 * the page lang on click): a shared or new-tab DE link carries ?lang=de so the
 * app opens in the link's language instead of falling back to browser locale.
 */
export function captureEntryIntentFromUrl(): void {
  try {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const figureParam = params.get('figure');
    const councilParam = params.get('council');
    const langParam = params.get('lang');
    if (!figureParam && !councilParam && !langParam) return;
    if (figureParam) {
      const id = figureSlugToId[figureParam] || figureParam;
      if (id.length < 64) sessionStorage.setItem(SS_FIGURE_KEY, id);
    }
    if (councilParam && councilParam.length < 64) {
      sessionStorage.setItem(SS_COUNCIL_KEY, councilParam);
    }
    if (langParam === 'en' || langParam === 'de') {
      try {
        LocalStorageAdapter.setString('selectedLanguage', langParam);
      } catch {
        // storage blocked — the app falls back to browser-locale detection
      }
    }
    params.delete('figure');
    params.delete('council');
    params.delete('lang');
    const qs = params.toString();
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
    );
  } catch {
    // sessionStorage / history unavailable — fall back to the normal flow
  }
}
