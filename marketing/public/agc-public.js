// Vanilla-JS handlers for all marketing pages. Loaded as a static asset so it
// satisfies the strict CSP `script-src 'self'` in production (no inline,
// no hash needed). Cached by CF Pages, one HTTP request per visitor.
//
// Responsibilities:
//   - Capture gclid from URL into sessionStorage (Google Ads attribution)
//   - Fire the anonymous page-load beacon (/v1/page)
//   - Click handlers on [data-agc-cta] elements (entry intent + conversion)
//   - Mobile burger menu toggle in the navbar
(function () {
  'use strict';

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

  function readGclid() {
    try { return sessionStorage.getItem(SS_GCLID); } catch (e) { return null; }
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

  function fireConversion(event, metadata) {
    var gclid = readGclid();
    if (!gclid) return;
    try {
      var firedKey = 'agc_conv_fired_' + event;
      if (sessionStorage.getItem(firedKey)) return;
      sessionStorage.setItem(firedKey, '1');
    } catch (e) { /* worker dedups via order_id */ }
    try {
      var body = { gclid: gclid, event: event, timestamp: Date.now() };
      if (metadata) {
        for (var k in metadata) {
          if (Object.prototype.hasOwnProperty.call(metadata, k)) body[k] = metadata[k];
        }
      }
      // Absolute worker URL on purpose. agoracosmica.org has no /api/* route,
      // so a relative path falls through the SPA fallback (/* /index.html 200)
      // and silently returns the React app HTML with 200. The fetch resolves
      // successfully, .catch() never fires, and the conversion never reaches
      // the worker. CSP allows https://*.agoracosmica.org in connect-src,
      // and worker CORS allows this origin explicitly.
      fetch('https://llm.agoracosmica.org/api/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(function () { /* never surface */ });
    } catch (e) { /* same posture */ }
  }

  function sendPageBeacon() {
    try {
      var docLang = (document.documentElement.lang || 'en').toLowerCase();
      var language = docLang.indexOf('de') === 0 ? 'de' : 'en';
      // Absolute worker URL for the same reason as fireConversion above.
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
    var metadata = {};
    if (figureId) metadata.figureId = figureId;
    if (councilId) metadata.councilId = councilId;
    fireConversion('start_exploring', Object.keys(metadata).length ? metadata : undefined);
  });

  var burger = document.querySelector('[data-agc-burger]');
  var nav = document.querySelector('.pub-navbar__nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('pub-navbar__nav--open');
      burger.setAttribute('aria-expanded', String(isOpen));
    });
  }
})();
