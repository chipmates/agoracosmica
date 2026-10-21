// "Read text instead" ends the wait for the voice, not the wait for the reply.
// Until the reply's first words arrive, a small sign in the conversation says
// one is coming; while the waiting card is up there is no second one.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({
  order: [] as string[],
  preferText: true,
  state: {
    session: { isAudioPlaying: false, firstTextArrived: false },
    conversation: { pendingRequestId: null as string | null, processingStage: null },
    mode: { selected: 'free_conversation' },
    figures: { selectedId: 'aurelius' },
    quota: { used: 0, limit: 30, resetsAt: null, isFreeTier: false, loaded: false },
    serviceConfig: { raw: null as string | null },
    setProcessingStage: () => {},
    openRateLimitModal: () => {},
  },
}));

vi.mock('../../controllers/conversationStreamDriver', () => ({
  ttsScheduler: { cancelAll: () => h.order.push('cancelAll') },
}));
vi.mock('../../services/audioService', () => ({
  processAudio: vi.fn(),
  processTextMessage: vi.fn(),
  cleanupAudioResources: () => h.order.push('cleanup'),
}));
vi.mock('../../services/audio/stt/sttUtils', () => ({ EmptyAudioError: class extends Error {} }));
vi.mock('../../services/audio/tts/ttsSessions', () => ({
  getOrRollConversationSessionId: () => 's',
  sendSessionEndBeacon: () => {},
}));
vi.mock('../../utils/inputMethodDetection', () => ({
  preferTextInput: () => h.preferText,
  saveInputPreference: () => {},
  registerInputToggleShortcut: () => () => {},
  hasExplicitInputPreference: () => true,
}));
vi.mock('../../utils/public/entryIntent', () => ({
  consumeAskPrefill: () => null,
  consumeCouncilPrefill: () => null,
  resolveAskPrefill: () => null,
  hasEntryTextFirst: () => false,
  markComposerStagedOrigin: () => {},
  clearComposerStagedOrigin: () => {},
  PREFILL_STAGED_EVENT: 'prefill-staged',
}));
vi.mock('../../data/public/heroEntry', () => ({ askTagFigure: () => null, resolveAnchorSeedId: () => null }));
vi.mock('../../stores/uiStore', () => {
  const ui = { modals: { modeSelectorOpen: false } };
  const useUIStore = (selector: (s: typeof ui) => unknown) => selector(ui);
  useUIStore.getState = () => ui;
  return { useUIStore };
});
vi.mock('../../stores', () => {
  const useDomainStore = (selector: (s: typeof h.state) => unknown) => selector(h.state);
  useDomainStore.getState = () => h.state;
  return { useDomainStore };
});
vi.mock('../../services/audio/config/serviceConfig', () => ({
  loadServiceConfig: () => ({ sttEnabled: true }),
  serviceConfigFromRaw: () => ({ sttEnabled: true }),
}));
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    tString: (_key: string, fallback = '') => fallback,
    tNode: (key: string) => key,
    language: 'en',
  }),
}));
vi.mock('../../hooks/useAutoplayGate', () => ({ useAutoplayGate: () => ({ getContext: () => null, unlock: () => {} }) }));
vi.mock('../../components/ProcessingLoader', () => ({
  default: ({ onSwitchToText }: { onSwitchToText?: () => void }) => (
    <div role="status" data-card="">
      <button type="button" onClick={onSwitchToText}>Read text instead</button>
    </div>
  ),
}));
vi.mock('../../components/MicrophonePermissionError', () => ({ MicrophonePermissionError: () => null }));

import UnifiedInputContainer from '../../components/UnifiedInputContainer';

const SIGN = 'The reply is on its way.';
const mount = () => {
  const view = render(<UnifiedInputContainer selectedFigure="Echo of Marcus Aurelius" />);
  return () => view.rerender(<UnifiedInputContainer selectedFigure="Echo of Marcus Aurelius" />);
};

describe('after reading instead, the reply is still on its way', () => {
  beforeEach(() => {
    h.state.session.firstTextArrived = false;
    h.state.conversation.pendingRequestId = 'r1';
  });

  it('a sign stays until the first words arrive', () => {
    const rerender = mount();
    expect(screen.queryByText(SIGN)).toBeNull();

    fireEvent.click(screen.getByText('Read text instead'));
    expect(screen.queryByText('Read text instead')).toBeNull();
    expect(screen.getByText(SIGN)).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(1);

    h.state.session.firstTextArrived = true;
    rerender();
    expect(screen.queryByText(SIGN)).toBeNull();
  });

  it('the sign goes when the request ends without words', () => {
    const rerender = mount();
    fireEvent.click(screen.getByText('Read text instead'));
    expect(screen.getByText(SIGN)).toBeTruthy();

    h.state.conversation.pendingRequestId = null;
    rerender();
    expect(screen.queryByText(SIGN)).toBeNull();
  });

  it('the next message starts without it', () => {
    const rerender = mount();
    fireEvent.click(screen.getByText('Read text instead'));
    h.state.conversation.pendingRequestId = null;
    rerender();
    h.state.conversation.pendingRequestId = 'r2';
    rerender();
    expect(screen.queryByText(SIGN)).toBeNull();
    expect(screen.getByText('Read text instead')).toBeTruthy();
  });
});
