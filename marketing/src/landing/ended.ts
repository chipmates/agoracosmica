// The landing's line for a visitor the ended chat's forwarder sent (?from=app): shown once on that load, the mark
// taken out of the address (the history entry's state kept, the stage and the router write their own fields there),
// closed by its button. Nothing is stored.

const MARK = 'from';

export function installEnded(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get(MARK) !== 'app') return;
  url.searchParams.delete(MARK);
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  const inner = document.querySelector<HTMLElement>('[data-landing-ended-in]');
  if (!inner) return;
  inner.hidden = false;
  inner.querySelector<HTMLButtonElement>('[data-landing-ended-close]')?.addEventListener('click', () => {
    inner.hidden = true;
  });
}
