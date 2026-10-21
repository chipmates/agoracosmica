// Runs in the shell's head, before the splash paints: picks the page language
// the way the app will at start (a ?lang= link, the stored choice, then the
// browser). A same-origin file, so the CSP needs no hash for it. The splash
// shows the lines of that language; the app sets the attribute again later.
(function () {
  var lang = null;
  try {
    var q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'de' || q === 'en') lang = q;
  } catch (e) { /* no query */ }
  if (!lang) {
    try {
      var stored = window.localStorage.getItem('selectedLanguage');
      if (stored === 'de' || stored === 'en') lang = stored;
    } catch (e) { /* storage blocked */ }
  }
  if (!lang) lang = (navigator.language || '').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
  document.documentElement.lang = lang;
})();
