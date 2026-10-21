// The welcome screen is the top app layer: the page behind it is inert while
// it is open, and it sits over the full-screen players.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('../../storage/preferencesIndexedDbAdapter', () => ({
  preferencesIndexedDbAdapter: {
    hasUserProfile: vi.fn(() => Promise.resolve(true)),
    setUserProfile: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('../../utils/entryBeacon', () => ({ sendEntryBeacon: vi.fn() }));
vi.mock('../../utils/signupBeacon', () => ({ sendSignupBeacon: vi.fn() }));
vi.mock('../../utils/funnelBeacon', () => ({ sendFunnelBeaconOnce: vi.fn(), sendFunnelBeacon: vi.fn() }));
vi.mock('../../utils/public/gclidCapture', () => ({ sendConversion: vi.fn() }));

import WelcomeDisclosureModal from '../../components/WelcomeDisclosureModal';

const SRC = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const token = (name: string) => Number(new RegExp(`--${name}:\\s*(\\d+)`).exec(read('index.css'))?.[1]);
const zOf = (css: string, selector: string) =>
  Number(new RegExp(`${selector.replace('.', '\\.')}\\s*{[^}]*?z-index:\\s*(\\d+)`).exec(css)?.[1]);

function Page({ open }: { open: boolean }) {
  return (
    <div className="homepage">
      <button type="button">behind</button>
      <WelcomeDisclosureModal isOpen={open} onComplete={() => {}} onSkip={() => {}} />
    </div>
  );
}

afterEach(() => {
  cleanup();
  document.getElementById('turnstile-container')?.remove();
});

describe('the welcome layer', () => {
  it('makes the page behind inert while open and gives it back on close', () => {
    const bot = document.createElement('div');
    bot.id = 'turnstile-container';
    document.body.appendChild(bot);
    const { rerender } = render(<Page open />);
    const behind = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'behind')!;
    expect(behind.hasAttribute('inert')).toBe(true);
    expect(bot.hasAttribute('inert')).toBe(false);
    rerender(<Page open={false} />);
    expect(behind.hasAttribute('inert')).toBe(false);
  });

  it('keeps the first Shift+Tab from the screen inside it', () => {
    render(<Page open />);
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(document.activeElement).toBe(dialog);
    const notCancelled = fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(notCancelled).toBe(false);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(dialog);
  });

  it('sits over the prism and council players', () => {
    const consent = token('z-consent');
    const players = [
      zOf(read('components/PrismPlayer/PrismPlayer.css'), '.council-player-overlay'),
      zOf(read('components/LiveCouncilPlayer/LiveCouncilPlayer.css'), '.live-council-player'),
    ];
    expect(players.every((z) => z > 0)).toBe(true);
    expect(read('components/WelcomeDisclosureModal.module.css')).toMatch(/\.welcomeOverlay\s*{[^}]*z-index:\s*var\(--z-consent\)/);
    expect(read('components/HomePage/ModalsContainer.tsx')).toMatch(/zIndex:\s*'var\(--z-consent\)'/);
    players.forEach((z) => expect(consent).toBeGreaterThan(z));
    expect(consent).toBeLessThan(token('z-loader'));
  });
});
