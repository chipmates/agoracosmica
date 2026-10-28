// The ended chat's addresses (/app and everything under it, served this page by _redirects): forward to the landing
// in the visitor's language, picked as the app picked it (a ?lang= link, the stored choice, then the browser), with
// the figure a link named and the mark (from=app) the landing reads for its one line. A same-origin file, so the CSP
// needs no hash for it.
(function () {
  var q = null;
  try { q = new URLSearchParams(window.location.search); } catch (e) { /* no query */ }
  var lang = q ? q.get('lang') : null;
  if (lang !== 'de' && lang !== 'en') {
    lang = null;
    try {
      var stored = window.localStorage.getItem('selectedLanguage');
      if (stored === 'de' || stored === 'en') lang = stored;
    } catch (e) { /* storage blocked */ }
  }
  if (!lang) lang = (navigator.language || '').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
  var params = [];
  var figure = q ? q.get('figure') : null;
  if (figure && /^[a-z][a-z-]{1,40}$/.test(figure)) params.push('figure=' + figure);
  params.push('from=app');
  if (q && q.get('probe') === '1') params.push('probe=1');
  window.location.replace((lang === 'de' ? '/de/' : '/') + '?' + params.join('&'));
})();
