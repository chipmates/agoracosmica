// After the welcome closes, a first visit opens the gallery; a browser that
// accepted earlier terms lands where a return with the current terms lands.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const state = vi.hoisted(() => ({ history: false, figureIntent: null as string | null }));
vi.mock('../../utils/userState', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/userState')>()),
  hasStoredHistory: () => state.history,
}));
vi.mock('../../utils/public/entryIntent', () => ({
  readFigureIntent: () => state.figureIntent,
  clearFigureIntent: vi.fn(),
  readCouncilIntent: () => null,
  clearCouncilIntent: vi.fn(),
  readLibraryIntent: () => false,
  clearLibraryIntent: vi.fn(),
  requestAudioLibrary: vi.fn(),
}));

import { useHelperFunctions } from '../../hooks/useHelperFunctions';
import { useDomainStore } from '../../stores';
import type { Figure } from '../../types/global';

const figure = { id: 'aurelius', name: 'Marcus Aurelius' } as Figure;

const setup = () => {
  const handlers = {
    handleOnboardingClose: vi.fn(),
    handleWisdomGalleryOpen: vi.fn(),
    handleWisdomGalleryCloseComplete: vi.fn(),
    handleModeSelectorOpen: vi.fn(),
    handleModeSelect: vi.fn(),
    handleFigureCarouselOpen: vi.fn(),
    handleSelectFigure: vi.fn(),
    startCuratedCouncilById: vi.fn(),
  };
  const { result } = renderHook(() =>
    useHelperFunctions({
      selectedFigure: null,
      selectedSeed: null,
      language: 'de',
      getTranslatedSeedTitle: () => null,
      t: (key: string) => key,
      getFigureById: (id: string) => (id === figure.id ? figure : undefined),
      ...handlers,
    })
  );
  return { complete: result.current.handleOnboardingComplete, handlers };
};

describe('routing after the welcome', () => {
  beforeEach(() => {
    state.history = false;
    state.figureIntent = null;
    useDomainStore.setState((s) => ({ figures: { ...s.figures, selectedId: null } }));
  });

  it('opens the gallery on a first visit', () => {
    const { complete, handlers } = setup();
    complete({ returning: false });
    expect(handlers.handleWisdomGalleryOpen).toHaveBeenCalledTimes(1);
    expect(handlers.handleFigureCarouselOpen).not.toHaveBeenCalled();
  });

  it('leaves a returning browser with history where it was', () => {
    state.history = true;
    const { complete, handlers } = setup();
    complete({ returning: true });
    expect(handlers.handleOnboardingClose).toHaveBeenCalled();
    expect(handlers.handleWisdomGalleryOpen).not.toHaveBeenCalled();
    expect(handlers.handleFigureCarouselOpen).not.toHaveBeenCalled();
  });

  it('leaves a returning browser with a chosen figure where it was', () => {
    useDomainStore.setState((s) => ({ figures: { ...s.figures, selectedId: 'aurelius' } }));
    const { complete, handlers } = setup();
    complete({ returning: true });
    expect(handlers.handleWisdomGalleryOpen).not.toHaveBeenCalled();
    expect(handlers.handleFigureCarouselOpen).not.toHaveBeenCalled();
  });

  it('shows a returning browser without history the figure list', () => {
    const { complete, handlers } = setup();
    complete({ returning: true });
    expect(handlers.handleFigureCarouselOpen).toHaveBeenCalledTimes(1);
    expect(handlers.handleWisdomGalleryOpen).not.toHaveBeenCalled();
  });

  it('still follows a figure link from the public page', () => {
    state.figureIntent = 'aurelius';
    const { complete, handlers } = setup();
    complete({ returning: true });
    expect(handlers.handleSelectFigure).toHaveBeenCalledWith(figure);
    expect(handlers.handleFigureCarouselOpen).not.toHaveBeenCalled();
  });
});
