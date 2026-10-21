// The page's waiting card (a first load, a translation) and the composer's
// card for a message on its way are both full-screen layers. While a request
// is pending the composer's card is the one: it knows the stage and offers to
// read instead, so the page's card steps aside rather than cover it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ cards: [] as Array<{ stage?: string; figureName: string }> }));

vi.mock('../../components/ProcessingLoader', () => ({
  default: (props: { stage?: string; figureName: string }) => {
    h.cards.push(props);
    return <div data-card={props.stage ?? 'page'} />;
  },
}));
vi.mock('../../components/UnifiedInputContainer', () => ({ default: () => <div data-composer="" /> }));
vi.mock('../../components/ChatBox', () => ({ default: () => null }));
vi.mock('../../components/FigureCarousel', () => ({ default: () => null }));
vi.mock('../../components/CosmicCouncil/CosmicCouncilHeader', () => ({ default: () => null }));
vi.mock('../../components/CosmicCouncil/CosmicCouncilLoaderIntegration', () => ({ default: () => null }));
vi.mock('../../components/Navigation', () => ({ BookmarkQuickLinks: () => null }));
vi.mock('../../utils/funnelBeacon', () => ({ sendFunnelBeacon: () => {} }));

import MainContent from '../../components/HomePage/MainContent';
import { useDomainStore } from '../../stores/domainStore';

const noop = () => {};
const props = (over: Partial<Parameters<typeof MainContent>[0]> = {}) => ({
  showFigureCarousel: false,
  isCouncilMode: false,
  councilConfig: null,
  selectedFigure: { id: 'aurelius', name: 'Echo von Mark Aurel' } as never,
  selectedSeed: null,
  selectedMode: 'free_conversation',
  conversationStartedFinal: true,
  messages: [],
  loading: true,
  translationInProgress: false,
  firstTextArrived: false,
  isReviewMode: false,
  isAudioPlaying: false,
  storyData: null,
  config: {},
  cosmicCouncilService: null,
  t: (key: string) => key,
  MODES: [],
  getTranslatedFigureName: () => 'Mark Aurel',
  getCurrentSeedName: () => '',
  handleSelectFigure: noop,
  handleCouncilEnd: noop,
  handleSeedComplete: noop,
  setError: noop,
  onSubmitMessage: noop,
  showQuickLinkBar: false,
  handleQuickAction: noop,
  handleHistoryModalOpen: noop,
  councilPlayerId: null,
  onCouncilHandoff: noop,
  onCouncilGoDeeper: noop,
  councilPlayerLevel: 1 as const,
  onCouncilPlayerClose: noop,
  onPrismClose: noop,
  onChooseMode: noop,
  onChooseFigure: noop,
  onCarouselClose: noop,
  onAskCarry: noop,
  ...over,
});

const pageCards = () => document.querySelectorAll('[data-card="page"]').length;

describe('one waiting card while a message is on its way', () => {
  beforeEach(() => {
    h.cards = [];
    useDomainStore.getState().setPendingRequestId(null);
  });
  afterEach(() => {
    cleanup();
    useDomainStore.getState().setPendingRequestId(null);
  });

  it('a first load with nothing pending: the page shows its card', () => {
    render(<MainContent {...props()} />);
    expect(pageCards()).toBe(1);
    expect(document.querySelector('[data-composer]')).not.toBeNull();
  });

  it('a request pending (typed, spoken or push-to-talk alike): the page card steps aside for the composer\'s', () => {
    useDomainStore.getState().setPendingRequestId('req-1');
    render(<MainContent {...props()} />);
    expect(pageCards()).toBe(0);
  });

  it('the page card leaves the moment a request starts, and is not there when it ends with the text in', () => {
    const view = render(<MainContent {...props()} />);
    expect(pageCards()).toBe(1);

    act(() => useDomainStore.getState().setPendingRequestId('req-2'));
    expect(pageCards()).toBe(0);

    view.rerender(<MainContent {...props({ loading: false, firstTextArrived: true })} />);
    act(() => useDomainStore.getState().setPendingRequestId(null));
    expect(pageCards()).toBe(0);
  });

  it('in a council there is no composer, so the page card stays its own', () => {
    useDomainStore.getState().setPendingRequestId('req-3');
    render(<MainContent {...props({ isCouncilMode: true, councilConfig: { moderator: 'aurelius' } })} />);
    expect(pageCards()).toBe(1);
  });
});
