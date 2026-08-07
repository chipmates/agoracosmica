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
import { getHeroEntryQuestion, hasHeroEntry } from '../../data/public/heroEntry';
import { getFigurePageContent } from '../../data/public/figurePageContent';

const SS_FIGURE_KEY = 'agc_intended_figure';
const SS_COUNCIL_KEY = 'agc_intended_council';
const SS_ASK_KEY = 'agc_intended_ask';
const SS_ASK_PREFILL_KEY = 'agc_ask_prefill';
const SS_COUNCIL_PREFILL_KEY = 'agc_council_prefill';
const SS_MODE_KEY = 'agc_intended_mode';
const SS_CHAPTER_KEY = 'agc_intended_chapter';
const SS_TEXT_FIRST_KEY = 'agc_entry_text_first';

// Ask tags. A tag NAMES a curated question, it never carries one: no free text
// ever rides a URL, so the prefill is always language-correct at render time
// and nothing a stranger can type reaches the composer.
//
//   hero              legacy, the pre-2026-07 single question. Resolves to the
//                     selected figure's own question when there is one, so old
//                     links and cached marketing pages upgrade themselves.
//   f:{figure}:{slot} the figure's landing question. Slot 1 is the hero
//                     question, slot 2 the figure page's idea question, and
//                     slot 3 falls back to slot 1 (the council door prefills
//                     through its own rail instead).
//   life              the one question that belongs to no figure.
const LEGACY_ASK_TAG = 'hero';
const LIFE_ASK_TAG = 'life';
const LIFE_QUESTION_KEY = 'entry.askQuestion.life';
const HERO_QUESTION_KEY = 'entry.heroAskQuestion';
const FIGURE_ASK_TAG = /^f:([a-z]+):([1-3])$/;

/** True for any tag the app knows how to resolve into a question. */
export function isValidAskTag(tag: string): boolean {
  if (tag === LEGACY_ASK_TAG || tag === LIFE_ASK_TAG) return true;
  const match = FIGURE_ASK_TAG.exec(tag);
  return !!match && hasHeroEntry(match[1]);
}

// Either the question itself (resolved from the bundled table) or the key the
// caller's translator has to look up. Keeps this module free of the i18n hook.
export type AskPrefill =
  | { kind: 'text'; text: string }
  | { kind: 'translationKey'; key: string };

/**
 * Turns a consumed ask tag into the question to stage in the composer.
 * `figureId` is the figure the visitor is about to talk to, which is what the
 * legacy 'hero' tag keys off.
 */
export function resolveAskPrefill(
  tag: string | null,
  figureId: string | null,
  lang: string
): AskPrefill | null {
  if (!tag) return null;
  if (tag === LIFE_ASK_TAG) return { kind: 'translationKey', key: LIFE_QUESTION_KEY };

  const match = FIGURE_ASK_TAG.exec(tag);
  if (match) {
    // Slot 2 is the figure page's idea question; slots 1 and 3 resolve to the
    // hero question (3 is the council door, which prefills via its own rail).
    if (match[2] === '2') {
      const idea = getFigurePageContent(match[1], lang)?.ideaQuestion;
      if (idea) return { kind: 'text', text: idea };
    }
    const text = getHeroEntryQuestion(match[1], lang);
    return text ? { kind: 'text', text } : null;
  }

  if (tag === LEGACY_ASK_TAG) {
    const text = getHeroEntryQuestion(figureId, lang);
    return text ? { kind: 'text', text } : { kind: 'translationKey', key: HERO_QUESTION_KEY };
  }
  return null;
}

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
  markEntryTextFirst();
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
  markEntryTextFirst();
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

/**
 * Announced whenever a question is staged for the composer. The composer picks
 * a staged question up when it mounts and when the mode or figure changes, but
 * a returning visitor can already be sitting in Free Talk with the same figure
 * when the staging happens, and then neither ever changes.
 */
export const PREFILL_STAGED_EVENT = 'agc:prefill-staged';

function announcePrefill(): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(PREFILL_STAGED_EVENT));
    }
  } catch {
    // no-op — the mount / mode / figure paths still pick it up
  }
}

/** Stash the consumed ask tag for the composer prefill. */
export function stashAskPrefill(tag: string): void {
  try {
    if (typeof sessionStorage !== 'undefined' && isValidAskTag(tag)) {
      sessionStorage.setItem(SS_ASK_PREFILL_KEY, tag);
    }
  } catch {
    // no-op — the visitor just types the question themselves
  }
  announcePrefill();
}

/**
 * Non-consuming read of the staged ask tag. The anchor seed is selected only
 * when Free Talk actually opens (a routing-time selection would make the gold
 * door begin the story at the anchor chapter instead of chapter 1), and that
 * read must not disturb the composer's later consume.
 */
export function peekAskPrefillTag(): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(SS_ASK_PREFILL_KEY);
  } catch {
    return null;
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
  markEntryTextFirst();
  announcePrefill();
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
 * Non-consuming read of whatever question is staged right now. The mode
 * ceremony shows the visitor their own words before they pick a door, and the
 * composer still consumes the stash later, so this must not clear anything.
 * `resolveKey` is only needed for the two tags that name a translated string
 * rather than a table entry; without it those read as nothing staged.
 */
export interface StagedQuestion {
  text: string;
  source: 'ask' | 'council';
}

export function peekStagedQuestion(
  figureId: string | null,
  lang: string,
  resolveKey?: (key: string) => string
): StagedQuestion | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    // Same precedence as the composer: council text wins over an ask tag.
    const councilText = sessionStorage.getItem(SS_COUNCIL_PREFILL_KEY);
    if (councilText) return { text: councilText, source: 'council' };
    const prefill = resolveAskPrefill(
      sessionStorage.getItem(SS_ASK_PREFILL_KEY),
      figureId,
      lang
    );
    if (!prefill) return null;
    const text = prefill.kind === 'text' ? prefill.text : resolveKey?.(prefill.key) ?? '';
    return text ? { text, source: 'ask' } : null;
  } catch {
    return null;
  }
}

/**
 * Story deep-link — the hero's "Chapter 1 of 12" beat. Only the mode name and
 * the chapter number ride the URL; the chapter maps to the figure's seed of the
 * same number, which is what story mode plays. Staged like the other intents
 * and consumed by the single figure-select chokepoint.
 */
export interface StoryIntent {
  chapter: number;
}

export function readStoryIntent(): StoryIntent | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    if (sessionStorage.getItem(SS_MODE_KEY) !== 'story') return null;
    const chapter = Number(sessionStorage.getItem(SS_CHAPTER_KEY));
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 12) return null;
    return { chapter };
  } catch {
    return null;
  }
}

/** Clears the story intent. Call once routing has consumed it. */
export function clearStoryIntent(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SS_MODE_KEY);
      sessionStorage.removeItem(SS_CHAPTER_KEY);
    }
  } catch {
    // no-op
  }
}

/**
 * Text-first marker. Anyone arriving with an entry intent came from a public
 * page holding a question, so the composer opens on the keyboard rather than
 * the microphone. Tab-scoped and non-consuming: it has to survive the welcome
 * step, the mode choice and any later remount of the composer. A visitor who
 * sets an input preference of their own wins over it.
 */
export function markEntryTextFirst(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SS_TEXT_FIRST_KEY, '1');
    }
  } catch {
    // no-op — the composer just opens on its normal default
  }
}

export function hasEntryTextFirst(): boolean {
  try {
    return typeof sessionStorage !== 'undefined'
      && sessionStorage.getItem(SS_TEXT_FIRST_KEY) === '1';
  } catch {
    return false;
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
 *
 * Also reads ?ask={tag} (a named question, never the question itself),
 * ?q={councilId} (a heard council's question, resolved from the bundled
 * catalog) and ?mode=story&chapter={1-12}. Every one of them is an identifier
 * the app resolves at render time, so nothing a stranger writes into a link
 * can reach the composer or the model.
 */
export function captureEntryIntentFromUrl(): void {
  try {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const figureParam = params.get('figure');
    const councilParam = params.get('council');
    const langParam = params.get('lang');
    const askParam = params.get('ask');
    const questionParam = params.get('q');
    const modeParam = params.get('mode');
    const chapterParam = params.get('chapter');
    if (!figureParam && !councilParam && !langParam && !askParam && !questionParam && !modeParam) {
      return;
    }
    if (figureParam) {
      const id = figureSlugToId[figureParam] || figureParam;
      if (id.length < 64) sessionStorage.setItem(SS_FIGURE_KEY, id);
    }
    if (councilParam && councilParam.length < 64) {
      sessionStorage.setItem(SS_COUNCIL_KEY, councilParam);
    }
    if (askParam && isValidAskTag(askParam)) {
      sessionStorage.setItem(SS_ASK_KEY, askParam);
    }
    if (langParam === 'en' || langParam === 'de') {
      try {
        LocalStorageAdapter.setString('selectedLanguage', langParam);
      } catch {
        // storage blocked — the app falls back to browser-locale detection
      }
    }
    // Story deep-link. Only 'story' is allowlisted; every other mode name is
    // ignored rather than staged.
    if (modeParam === 'story') {
      const chapter = Number(chapterParam);
      if (Number.isInteger(chapter) && chapter >= 1 && chapter <= 12) {
        sessionStorage.setItem(SS_MODE_KEY, 'story');
        sessionStorage.setItem(SS_CHAPTER_KEY, String(chapter));
      }
    }
    if (figureParam || councilParam || askParam || questionParam || modeParam) {
      markEntryTextFirst();
    }
    // A council id resolves to that council's own question, in the link's
    // language. The catalog is a large bundled asset, so it is fetched only
    // when a q= link is actually used; the staged prefill is read after the
    // welcome step, long after this resolves.
    if (questionParam && /^[a-z0-9-]{1,64}$/.test(questionParam)) {
      const lang = langParam === 'de' || langParam === 'en'
        ? langParam
        : LocalStorageAdapter.getString('selectedLanguage') || 'en';
      void import('../../data/councilCatalog')
        .then(({ councilCatalog, getLocalizedQuestion }) => {
          const council = councilCatalog.find((c) => c.id === questionParam);
          if (council) stageCouncilHandoff(getLocalizedQuestion(council, lang));
        })
        .catch(() => {
          // catalog chunk unavailable — the visitor just types their question
        });
    }
    params.delete('figure');
    params.delete('council');
    params.delete('lang');
    params.delete('ask');
    params.delete('q');
    params.delete('mode');
    params.delete('chapter');
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
