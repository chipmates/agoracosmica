// Manuscript carousel for the Emily Dickinson poems page.
// Active-dot tracking + click-to-page. Progressive enhancement only: native
// swipe + CSS scroll-snap work without this script; it just lights the dot for
// the leaf in view and lets dots jump pages.
//
// Served as a static file from /ed-carousel.js so it loads under script-src
// 'self' in both the meta CSP and the header CSP (no inline-hash maintenance).
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-ed-carousel]').forEach(function (root) {
    var track = root.querySelector('.ed-carousel__track');
    var dotsBox = root.querySelector('.ed-carousel__dots');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.ed-carousel__slide'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.ed-carousel__dot'));
    if (!track || slides.length < 2 || dots.length !== slides.length) return;
    // Dots start hidden so they never sit inert without JS; reveal now.
    if (dotsBox) dotsBox.hidden = false;
    function setActive(i) {
      dots.forEach(function (d, n) {
        d.setAttribute('aria-current', n === i ? 'true' : 'false');
      });
    }
    setActive(0);
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        slides[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
      });
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) setActive(slides.indexOf(e.target));
        });
      },
      { root: track, threshold: 0.6 }
    );
    slides.forEach(function (s) {
      io.observe(s);
    });
  });
})();
