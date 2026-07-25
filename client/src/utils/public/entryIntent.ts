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
const SS_ASK_KEY = 'agc_intended_ask';
const SS_ASK_PREFILL_KEY = 'agc_ask_prefill';
const SS_COUNCIL_PREFILL_KEY = 'agc_council_prefill';

// Allowlisted ask tags. A tag names a curated starter question that lives in
// the app's translations (entry.heroAskQuestion), so no free text ever rides
// the URL and the prefill is always language-correct at render time.
const ASK_TAGS = new Set(['hero']);

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
 * Ask intent — the marketing hero's "Ask him yourself" link. The visitor
 * already chose the talk door on the public page, so figure selection skips
 * the mode choice and opens Free Talk with the promised question staged in
 * the composer. Routing consumes the intent (read + clear), then stashes the
 * tag as a prefill for the composer to pick up once Free Talk renders.
 */
export function readAskIntent(): string | null {
  try {
    return typeof sessionStorage === 'undefined'
      ? null
      : sessionStorage.getItem(SS_ASK_KEY);
  } catch {
    return null;
  }
}

/** Clears the ask intent. Call once routing has consumed it. */
export function clearAskIntent(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SS_ASK_KEY);
    }
  } catch {
    // no-op
  }
}

/** Stash the consumed ask tag for the composer prefill. */
export function stashAskPrefill(tag: string): void {
  try {
    if (typeof sessionStorage !== 'undefined' && ASK_TAGS.has(tag)) {
      sessionStorage.setItem(SS_ASK_PREFILL_KEY, tag);
    }
  } catch {
    // no-op — the visitor just types the question themselves
  }
}

/** One-shot read of the staged prefill tag (clears on read). */
export function consumeAskPrefill(): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const tag = sessionStorage.getItem(SS_ASK_PREFILL_KEY);
    if (tag !== null) sessionStorage.removeItem(SS_ASK_PREFILL_KEY);
    return tag;
  } catch {
    return null;
  }
}

/**
 * Council end-state handoff — "talk to a figure about this". Stages the ask
 * intent (so figure selection skips the mode choice and opens Free Talk, the
 * same rails as the homepage ask-link) plus the council's question as a
 * free-text composer prefill. Unlike ask tags this text never rides a URL:
 * it is written by the player from bundled catalog data, so free text is
 * safe here. Length-capped to the composer's own limit.
 */
export function stageCouncilHandoff(question: string): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SS_ASK_KEY, 'council');
      sessionStorage.setItem(SS_COUNCIL_PREFILL_KEY, question.slice(0, 500));
    }
  } catch {
    // no-op — the visitor just types the question themselves
  }
}

/** One-shot read of the staged council question prefill (clears on read). */
export function consumeCouncilPrefill(): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const text = sessionStorage.getItem(SS_COUNCIL_PREFILL_KEY);
    if (text !== null) sessionStorage.removeItem(SS_COUNCIL_PREFILL_KEY);
    return text;
  } catch {
    return null;
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
    const askParam = params.get('ask');
    if (!figureParam && !councilParam && !langParam && !askParam) return;
    if (figureParam) {
      const id = figureSlugToId[figureParam] || figureParam;
      if (id.length < 64) sessionStorage.setItem(SS_FIGURE_KEY, id);
    }
    if (councilParam && councilParam.length < 64) {
      sessionStorage.setItem(SS_COUNCIL_KEY, councilParam);
    }
    if (askParam && ASK_TAGS.has(askParam)) {
      sessionStorage.setItem(SS_ASK_KEY, askParam);
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
    params.delete('ask');
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
