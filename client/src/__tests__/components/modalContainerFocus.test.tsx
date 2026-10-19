import { describe, expect, it, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import ModalContainer from '@/components/Modal/ModalContainer';

// The page behind the dialog: a menu toggle, the menu region holding the
// opener, and a control after it that a leaking Shift+Tab would reach.
function Page({ openerDisabled = false, withToggle = true }: { openerDisabled?: boolean; withToggle?: boolean }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      {withToggle && (
        <button type="button" aria-controls="navigation">
          menu
        </button>
      )}
      <div id="navigation">
        <button type="button" disabled={collapsed} onClick={() => { setOpen(true); setCollapsed(openerDisabled); }}>
          library
        </button>
      </div>
      <button type="button">behind</button>
      {open && (
        <ModalContainer isOpen onClose={() => setOpen(false)}>
          <button type="button">first</button>
          <button type="button">last</button>
        </ModalContainer>
      )}
    </div>
  );
}

const byText = (text: string) =>
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text) as HTMLButtonElement;

const openFromOpener = () => {
  const opener = byText('library');
  opener.focus();
  act(() => {
    opener.click();
  });
  return document.querySelector('[role="dialog"]') as HTMLElement;
};

afterEach(cleanup);

describe('ModalContainer focus', () => {
  it('starts on the dialog itself', () => {
    render(<Page />);
    const dialog = openFromOpener();
    expect(document.activeElement).toBe(dialog);
  });

  it('keeps the first Shift+Tab from the dialog inside it', () => {
    render(<Page />);
    const dialog = openFromOpener();
    const event = fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(event).toBe(false); // default prevented: the browser does not move focus behind
    expect(document.activeElement).toBe(byText('last'));
  });

  it('still wraps from the first control to the last and back', () => {
    render(<Page />);
    const dialog = openFromOpener();
    byText('first').focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(byText('last'));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(byText('first'));
  });

  it('returns focus to the opener on Escape when it can take it', () => {
    render(<Page />);
    const dialog = openFromOpener();
    act(() => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(byText('library'));
  });

  it('falls back to the control that expands the opener region when the opener cannot take focus', () => {
    render(<Page openerDisabled />);
    const dialog = openFromOpener();
    act(() => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(document.activeElement).toBe(byText('menu'));
  });

  it('leaves focus alone when there is no such control', () => {
    render(<Page openerDisabled withToggle={false} />);
    const dialog = openFromOpener();
    act(() => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(document.activeElement).toBe(document.body);
  });
});
