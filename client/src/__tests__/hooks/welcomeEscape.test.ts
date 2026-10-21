// Escape on the welcome screen lands on the homepage and stays there: the
// homepage's returning-visitor forward (run here from its own source) must
// not send a browser holding a terms record straight back to the app.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { useHelperFunctions, WELCOME_EXIT_URL } from '../../hooks/useHelperFunctions';

const HERO = readFileSync(join(__dirname, '..', '..', '..', '..', 'marketing', 'src', 'components', 'AgoraHero.astro'), 'utf8');
const FORWARD = /<script is:inline>\s*(\/\* Returning-visitor forward[\s\S]*?)<\/script>/.exec(HERO)?.[1] ?? '';

/** Run the homepage's forward as a fresh page load at `url`. */
const loadHome = (url: string) => {
  const fake = { search: new URL(url, 'https://agoracosmica.org').search, replace: vi.fn() };
  vi.stubGlobal('location', fake);
  new Function(FORWARD)();
  return fake.replace;
};

const escapeTarget = () => {
  const fake = { href: '' };
  vi.stubGlobal('location', fake);
  const { result } = renderHook(() =>
    useHelperFunctions({
      selectedFigure: null,
      selectedSeed: null,
      language: 'de',
      getTranslatedSeedTitle: () => null,
      t: (key: string) => key,
      handleOnboardingClose: vi.fn(),
      handleWisdomGalleryOpen: vi.fn(),
      handleWisdomGalleryCloseComplete: vi.fn(),
      handleModeSelectorOpen: vi.fn(),
      handleModeSelect: vi.fn(),
      handleFigureCarouselOpen: vi.fn(),
      handleSelectFigure: vi.fn(),
      getFigureById: () => undefined,
      startCuratedCouncilById: vi.fn(),
    })
  );
  result.current.handleOnboardingSkip();
  vi.unstubAllGlobals();
  return fake.href;
};

describe('Escape on the welcome screen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('goes to the pinned homepage', () => {
    expect(escapeTarget()).toBe(WELCOME_EXIT_URL);
  });

  it('stays on the homepage although the browser holds a terms record', () => {
    expect(FORWARD).not.toBe('');
    localStorage.setItem('agb_consent', JSON.stringify({ version: '1.0.0', timestamp: 1 }));
    const replace = loadHome(escapeTarget());
    expect(replace).not.toHaveBeenCalled();
  });

  it('would be sent back to the app from the bare homepage', () => {
    localStorage.setItem('agb_consent', JSON.stringify({ version: '1.0.0', timestamp: 1 }));
    const replace = loadHome('/');
    expect(replace).toHaveBeenCalledWith('/app/');
  });
});
