import { describe, it, expect, beforeEach } from 'vitest';
import { inertOutside } from '../../utils/accessibility/inertOutside';

// body > #root > .page > (button.behind, .modal-host > .dialog), body > #turnstile-container
const build = () => {
  document.body.innerHTML = `
    <div id="root">
      <nav id="skip"><a href="#main">skip</a></nav>
      <div class="page">
        <button class="behind">behind</button>
        <div class="modal-host"><div class="dialog"><button>in</button></div></div>
      </div>
      <div id="live-region" aria-live="polite"></div>
    </div>
    <div id="turnstile-container"></div>
    <div class="already" inert></div>`;
  return document.querySelector('.dialog') as HTMLElement;
};

const isInert = (sel: string) => (document.querySelector(sel) as HTMLElement).hasAttribute('inert');
const KEEP = '#turnstile-container, #live-region';

describe('inertOutside', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('makes the page behind inert and leaves the dialog, its ancestors and kept elements live', () => {
    const dialog = build();
    inertOutside(dialog, KEEP);
    expect(isInert('.behind')).toBe(true);
    expect(isInert('#skip')).toBe(true);
    expect(isInert('#root')).toBe(false);
    expect(isInert('.page')).toBe(false);
    expect(isInert('.modal-host')).toBe(false);
    expect(isInert('.dialog')).toBe(false);
    expect(isInert('#live-region')).toBe(false);
    expect(isInert('#turnstile-container')).toBe(false);
  });

  it('makes a portal that mounts behind the open dialog inert too', async () => {
    const dialog = build();
    inertOutside(dialog, KEEP);
    const portal = document.createElement('div');
    portal.className = 'council-player-overlay';
    document.body.appendChild(portal);
    await Promise.resolve();
    expect(portal.hasAttribute('inert')).toBe(true);
  });

  it('undoes only what it set', () => {
    const dialog = build();
    const undo = inertOutside(dialog, KEEP);
    undo();
    expect(isInert('.behind')).toBe(false);
    expect(isInert('#skip')).toBe(false);
    expect(isInert('.already')).toBe(true);
  });
});
