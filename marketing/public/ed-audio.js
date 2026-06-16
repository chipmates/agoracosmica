// Echo-voice audio teaser on the Emily Dickinson poems page.
// Progressive enhancement: the page ships a native <audio controls> fallback;
// when this runs it hides the native controls and reveals a styled play button
// that matches the figure-page trailer button (.pub-trailer). Served from
// /ed-audio.js so it loads under script-src 'self' (no CSP hash needed).
(function () {
  var PLAY =
    '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M4 3l9 5-9 5z"></path></svg>';
  var PAUSE =
    '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M4 3h3v10H4zM9 3h3v10H9z"></path></svg>';
  document.querySelectorAll('[data-ed-audio]').forEach(function (root) {
    var btn = root.querySelector('[data-ed-audio-btn]');
    var audio = root.querySelector('[data-ed-audio-el]');
    var icon = root.querySelector('[data-ed-audio-icon]');
    var label = root.querySelector('[data-ed-audio-label]');
    if (!btn || !audio) return;
    // JS is here: drop the native controls, show the styled button.
    audio.removeAttribute('controls');
    btn.hidden = false;
    function setPlaying(on) {
      btn.classList.toggle('pub-trailer--on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (icon) icon.innerHTML = on ? PAUSE : PLAY;
      if (label) label.textContent = on ? 'Pause' : 'Hear her letter';
    }
    btn.addEventListener('click', function () {
      if (audio.paused) audio.play();
      else audio.pause();
    });
    audio.addEventListener('play', function () {
      setPlaying(true);
    });
    audio.addEventListener('pause', function () {
      setPlaying(false);
    });
    audio.addEventListener('ended', function () {
      setPlaying(false);
    });
  });
})();
