/**
 * Makes everything outside `target` inert (no focus, no clicks, out of the
 * accessibility tree) while a modal is open, and returns the undo.
 *
 * Elements matching `keepSelector` stay live. Elements added while the modal is
 * open (a portal mounting behind it) turn inert too. The undo clears only the
 * flags this call set.
 */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NOSCRIPT']);

export function inertOutside(target: Element, keepSelector: string): () => void {
  const marked = new Set<Element>();
  const observed = new Set<Element>();

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element && node.parentElement && observed.has(node.parentElement)) apply(node);
      });
    }
  });

  const walkInto = (parent: Element): void => {
    observed.add(parent);
    observer.observe(parent, { childList: true });
    Array.from(parent.children).forEach(apply);
  };

  function apply(el: Element): void {
    if (el === target || SKIP_TAGS.has(el.tagName) || el.matches(keepSelector)) return;
    if (el.contains(target) || el.querySelector(keepSelector)) {
      walkInto(el);
      return;
    }
    if (el.hasAttribute('inert')) return;
    el.setAttribute('inert', '');
    marked.add(el);
  }

  walkInto(document.body);

  return () => {
    observer.disconnect();
    marked.forEach((el) => el.removeAttribute('inert'));
    marked.clear();
    observed.clear();
  };
}
