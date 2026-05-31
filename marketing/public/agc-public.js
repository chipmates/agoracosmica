// Vanilla-JS handlers for all marketing pages. Loaded as a static asset so it
// satisfies the strict CSP `script-src 'self'` in production (no inline,
// no hash needed). Cached by CF Pages, one HTTP request per visitor.
//
// Responsibilities:
//   - Capture gclid from URL into sessionStorage so the app can offer ad-
//     measurement consent and (only if granted) report the conversion
//   - Fire the anonymous page-load beacon (/v1/page)
//   - Click handlers on [data-agc-cta] elements (entry intent)
//   - Mobile burger menu toggle in the navbar
//
// No conversion is sent from the marketing pages. The gclid is forwarded to
// Google only from inside the app, after the visitor opts in.
(function () {
  'use strict';

  // Homepage only: the cinematic hero must paint from the top on every reload.
  // Browsers otherwise restore the prior scroll position, dropping a reloading
  // visitor halfway down the library. Guarded so it never fights a real anchor
  // target (e.g. the #v2-library scroll cue) and only touches / and /de/.
  if ((location.pathname === '/' || location.pathname === '/de/') && !location.hash) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }

  var SS_GCLID = 'agc_gclid';
  var SS_FIGURE = 'agc_intended_figure';
  var SS_COUNCIL = 'agc_intended_council';
  var LS_LANG = 'selectedLanguage';

  function captureGclidFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var g = params.get('gclid');
      if (g && g.length > 10 && g.length < 200) {
        sessionStorage.setItem(SS_GCLID, g);
      }
    } catch (e) { /* sessionStorage blocked — ignore */ }
  }

  function persistIntent(opts) {
    try {
      if (opts.lang) localStorage.setItem(LS_LANG, opts.lang);
      if (opts.figureId && opts.figureId.length < 64) {
        sessionStorage.setItem(SS_FIGURE, opts.figureId);
      }
      if (opts.councilId && opts.councilId.length < 64) {
        sessionStorage.setItem(SS_COUNCIL, opts.councilId);
      }
    } catch (e) { /* storage blocked — app falls back */ }
  }

  function sendPageBeacon() {
    try {
      var docLang = (document.documentElement.lang || 'en').toLowerCase();
      var language = docLang.indexOf('de') === 0 ? 'de' : 'en';
      // Absolute worker URL on purpose (agoracosmica.org has no /v1/* route).
      fetch('https://llm.agoracosmica.org/v1/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: window.location.pathname, language: language }),
        keepalive: true,
      }).catch(function () { /* never surface */ });
    } catch (e) { /* no-op */ }
  }

  captureGclidFromUrl();
  sendPageBeacon();

  document.addEventListener('click', function (e) {
    var target = e.target instanceof Element ? e.target.closest('[data-agc-cta]') : null;
    if (!target) return;
    var cta = target.getAttribute('data-agc-cta');
    if (cta !== 'start-exploring') return;
    var figureId = target.getAttribute('data-agc-figure') || undefined;
    var councilId = target.getAttribute('data-agc-council') || undefined;
    var lang = document.documentElement.lang || 'en';
    persistIntent({ figureId: figureId, councilId: councilId, lang: lang });
  });

  var burger = document.querySelector('[data-agc-burger]');
  var nav = document.querySelector('.pub-navbar__nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('pub-navbar__nav--open');
      burger.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Homepage mobile only: the hero already shows a Start Exploring CTA, so the
  // fixed bottom bar starts hidden (CSS, .pub-home-page) and slides in on the
  // first scroll, then stays visible like every other page. A plain scroll
  // listener is used on purpose: an IntersectionObserver on the hero misfires
  // on iOS Safari (the hero's parallax transform throws off the intersection
  // math), leaving the bar stuck off-screen. Pages without the .pub-home-page
  // class show the bar from first paint, so this whole block is a no-op there.
  var stickyCta = document.querySelector('.pub-cta--sticky');
  if (stickyCta && document.body.classList.contains('pub-home-page')) {
    var revealSticky = function () {
      if ((window.scrollY || window.pageYOffset || 0) > 24) {
        stickyCta.classList.add('is-revealed');
        window.removeEventListener('scroll', revealSticky);
      }
    };
    window.addEventListener('scroll', revealSticky, { passive: true });
    // In case the page restored a scrolled position before this ran.
    revealSticky();
  }
})();
