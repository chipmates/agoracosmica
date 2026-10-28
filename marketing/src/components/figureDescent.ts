// Era bar enhancement: active band, depth readout, descent gauge. Everything
// it touches is already correct without it.
// The page's own script installs it (the front's c2 bundle): a script this small on its own would be inlined, and
// the site's CSP runs inline code only by hash.
export function installDescent(): void {
  const bar = document.getElementById('fx-bar');
  const descent = document.getElementById('fx-descent');
  const depth = document.getElementById('fx-depth');
  const gaugeFill = document.querySelector<HTMLElement>('.fx-bar__gauge span');
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.fx-bar__link'));

  if (bar && descent && links.length) {
    const surface = depth ? depth.textContent : '';
    const sections = links
      .map(link => ({ link, el: document.getElementById(link.hash.slice(1)) }))
      .filter((s): s is { link: HTMLAnchorElement; el: HTMLElement } => !!s.el);
    const closers = document.getElementById('fx-closers');
    let ticking = false;

    const apply = () => {
      ticking = false;
      const line = bar.getBoundingClientRect().bottom + 32;

      let active: (typeof sections)[number] | null = null;
      for (const s of sections) {
        if (s.el.getBoundingClientRect().top <= line) active = s;
      }
      const changed = active ? !active.link.hasAttribute('aria-current') : false;
      for (const s of sections) {
        if (s === active) s.link.setAttribute('aria-current', 'true');
        else s.link.removeAttribute('aria-current');
      }
      if (depth) depth.textContent = active ? (active.link.dataset.span || '') : surface;

      // narrow screens scroll the chip row, so keep the live band in view
      const list = bar.querySelector<HTMLElement>('.fx-bar__list');
      if (changed && active && list && list.scrollWidth > list.clientWidth + 4) {
        list.scrollTo({
          left: active.link.offsetLeft - list.clientWidth / 2 + active.link.offsetWidth / 2,
          behavior: 'smooth',
        });
      }

      if (gaugeFill) {
        const box = descent.getBoundingClientRect();
        const run = box.height - window.innerHeight * 0.5;
        const done = run > 0 ? (line - box.top) / run : 0;
        gaugeFill.parentElement?.style.setProperty(
          '--fx-progress',
          String(Math.min(1, Math.max(0, done))),
        );
      }

      // the bar has no job once the closing blocks start
      if (closers) {
        bar.classList.toggle('is-off', closers.getBoundingClientRect().top <= line);
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    apply();
  }
}
