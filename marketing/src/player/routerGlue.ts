// The client router on player pages, kept to what the player needs.
//
// A soft page change happens only while a story is loaded. Every other
// navigation is a full page load, exactly as on pages without the router.
//
// agc-public.js does its work once per document, so after a soft change this
// repeats the two parts a page relies on, in the same shape: the anonymous
// pageview row of an internal navigation, and the navbar's menu button. The
// consent card's click ID, held in page memory until an answer, is dropped
// as a page unload would drop it, so the card does not ask again.

import { clearGclid, getGclid, adConsentDecided } from '@client/utils/public/gclidCapture';
import { probeField } from '@client/utils/probeSession';
import { onProductionHost } from '../utils/heardSeconds';

// Absolute on purpose: agoracosmica.org has no /v1/* route.
const PAGE_URL = 'https://llm.agoracosmica.org/v1/page';

function pageLanguage(): 'en' | 'de' {
  return (document.documentElement.lang || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
}

// Same row as agc-public.js sends for a pageview that did not open the visit.
function sendInternalPageview(): void {
  if (!onProductionHost()) return;
  try {
    fetch(PAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        language: pageLanguage(),
        probe: probeField(),
      }),
      keepalive: true,
    }).catch(() => {
      /* never surface */
    });
  } catch {
    /* no-op */
  }
}

const MENU_OPEN = 'pub-navbar__nav--open';

// The swapped-in navbar has no listener: agc-public.js bound the first one.
function bindMenu(): void {
  const burger = document.querySelector<HTMLElement>('[data-agc-burger]');
  const nav = document.querySelector<HTMLElement>('.pub-navbar__nav');
  if (!burger || !nav) return;
  burger.dataset.playerMenu = '';
  burger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle(MENU_OPEN);
    burger.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) nav.querySelector<HTMLElement>('a')?.focus();
  });
}

function onMenuEscape(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  const burger = document.querySelector<HTMLElement>('[data-agc-burger][data-player-menu]');
  const nav = document.querySelector<HTMLElement>('.pub-navbar__nav');
  if (!burger || !nav || !nav.classList.contains(MENU_OPEN)) return;
  nav.classList.remove(MENU_OPEN);
  burger.setAttribute('aria-expanded', 'false');
  burger.focus();
}

// A step back or forward through history: on pages without the router the
// browser restores those from its page cache, which sends no pageview either.
let traversing = false;

export function installRouterGlue(storyLoaded: () => boolean): void {
  document.addEventListener('astro:before-preparation', e => {
    if (!storyLoaded()) {
      e.preventDefault();
      return;
    }
    traversing = (e as Event & { navigationType?: string }).navigationType === 'traverse';
  });
  document.addEventListener('astro:before-swap', () => {
    if (getGclid() !== null && !adConsentDecided()) clearGclid();
  });
  document.addEventListener('astro:after-swap', () => {
    bindMenu();
    if (!traversing) sendInternalPageview();
  });
  document.addEventListener('keydown', onMenuEscape);
}
