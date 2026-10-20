// A helper with a line or two stays a card on phones; long helpers keep the
// full screen there. The council's end message is the short kind.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../hooks/useResponsive', () => ({ default: () => ({ isMobile: true }) }));
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ tString: (_key: string, fallback?: string) => fallback ?? '', language: 'de' }),
}));

import HelperPopup from '../../components/HelperPopup/HelperPopup';

const TITLES = { end: 'Rat abgeschlossen', help: 'Hilfe' };
const popup = () => document.body.querySelector('.helper-popup') as HTMLElement;
const container = () => document.body.querySelector('.helper-popup-container') as HTMLElement;

describe('HelperPopup on a phone', () => {
  afterEach(cleanup);

  it('keeps the card form for a compact message', () => {
    render(<HelperPopup isOpen onDismiss={() => {}} title={TITLES.end} content="Der Rat ist beendet." showDontAskAgain={false} compact />);
    expect(popup().classList.contains('fullscreen-mobile')).toBe(false);
    expect(container().classList.contains('fullscreen-mobile')).toBe(false);
  });

  it('keeps the full screen for a long helper', () => {
    render(<HelperPopup isOpen onDismiss={() => {}} title={TITLES.help} content="Ein langer Text." />);
    expect(popup().classList.contains('fullscreen-mobile')).toBe(true);
  });

  it('is the compact form in the council player', () => {
    const source = readFileSync(resolve(__dirname, '../../components/LiveCouncilPlayer/LiveCouncilPlayer.tsx'), 'utf8');
    const block = source.slice(source.indexOf('<HelperPopup'), source.indexOf('/>', source.indexOf('<HelperPopup')));
    expect(block).toMatch(/\bcompact\b/);
  });
});
