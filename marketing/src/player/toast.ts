// One quiet line above the dock that says what just happened ("Saved",
// "Link copied"), with an optional undo. Polite, gone after four seconds.

let timer: number | null = null;

export function showToast(message: string, action?: { label: string; run: () => void }): void {
  let el = document.querySelector<HTMLElement>('.sp-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'sp-toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  const text = document.createElement('span');
  text.textContent = message;
  el.replaceChildren(text);
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.run();
      hideToast();
    });
    el.append(btn);
  }
  el.hidden = false;
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(hideToast, 4000);
}

/** Gone at once, when what it reported is in view (a sheet opened over it). */
export function hideToast(): void {
  const el = document.querySelector<HTMLElement>('.sp-toast');
  if (el) el.hidden = true;
}
