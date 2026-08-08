// The council ink bands on the theme pages, made openable.
//
// Progressive enhancement: every band ships as a disabled <button>, so a
// visitor without this script never meets a control that does nothing. Here
// the script hands each one the viewer that PlateLightbox.astro rendered, and
// only then are the buttons enabled.
//
// The full plate is named on the button, never in a stylesheet, so it is
// fetched the first time someone opens a band and not on page load.
// Served from /plate-lightbox.js so it loads under script-src 'self'.
(function () {
  var dialog = document.querySelector('[data-plate-dialog]');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var stage = dialog.querySelector('[data-plate-stage]');
  var ink = dialog.querySelector('[data-plate-ink-layer]');
  var oil = dialog.querySelector('[data-plate-oil-layer]');
  var credit = dialog.querySelector('[data-plate-credit-link]');
  var trigger = null;

  function open(button) {
    trigger = button;
    var src = button.getAttribute('data-plate-full');
    // An oil carries its own colour and its own proportion, so it replaces the
    // mask stage entirely rather than being poured into a box sized from an
    // aspect the button had to declare.
    var isOil = button.hasAttribute('data-plate-oil');
    stage.hidden = isOil;
    if (oil) {
      oil.hidden = !isOil;
      if (isOil) oil.src = src;
    }

    if (!isOil) {
      var aspect = parseFloat(button.getAttribute('data-plate-aspect')) || 1;
      // The plate takes the largest box its own proportion allows, capped so a
      // wide engraving never runs past the viewport on either axis.
      stage.style.aspectRatio = String(aspect);
      stage.style.width = 'min(92vw, 1100px, ' + (78 * aspect).toFixed(1) + 'vh)';
      var mask = 'url("' + src + '")';
      ink.style.webkitMaskImage = mask;
      ink.style.maskImage = mask;
    }
    dialog.setAttribute('data-ink', button.getAttribute('data-plate-ink') || 'house');

    var line = button.getAttribute('data-plate-credit') || '';
    var href = button.getAttribute('data-plate-href') || '';
    credit.textContent = line;
    credit.hidden = !(line && href);
    if (href) credit.href = href;

    dialog.showModal();
  }

  // Tap anywhere to close, the way the council sheet does in the app. The
  // credit link is the one thing that is not a close target.
  dialog.addEventListener('click', function (event) {
    if (event.target.closest('[data-plate-credit-link]')) return;
    dialog.close();
  });

  // <dialog> restores focus on its own in current browsers. This makes it
  // certain, and costs nothing where the platform already did it.
  dialog.addEventListener('close', function () {
    if (trigger && document.contains(trigger)) trigger.focus();
    trigger = null;
  });

  document.querySelectorAll('[data-plate-open]').forEach(function (button) {
    button.disabled = false;
    button.addEventListener('click', function () {
      open(button);
    });
  });
})();
