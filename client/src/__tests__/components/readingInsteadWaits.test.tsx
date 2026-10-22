// "Read text instead" ends the wait for the voice, not the wait for the reply.
// Until the reply's first words arrive, a small sign in the conversation says
// one is coming; while the waiting card is up there is no second one. On a
// greeting nobody asked anything, so the sign does not speak of a reply.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  order: [] as string[],
  greetings: new Set<string>(),
  readFor: [] as Array<string | null>,
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
  readTextInstead: (requestId: string | null) => { h.readFor.push(requestId); },
  isGreetingRequest: (requestId: string | null) => requestId !== null && h.greetings.has(requestId),
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
import { processTextMessage } from '../../services/audioService';

const SIGN = 'The reply is on its way.';
const mount = () => {
  const view = render(<UnifiedInputContainer selectedFigure="Echo of Marcus Aurelius" />);
  return () => view.rerender(<UnifiedInputContainer selectedFigure="Echo of Marcus Aurelius" />);
};

describe('after reading instead, the reply is still on its way', () => {
  beforeEach(() => {
    h.state.session.firstTextArrived = false;
    h.state.conversation.pendingRequestId = 'r1';
    h.greetings.clear();
    h.readFor.length = 0;
  });

  it('the click holds for the request on its way', () => {
    mount();
    fireEvent.click(screen.getByText('Read text instead'));
    expect(h.readFor).toEqual(['r1']);
  });

  it('on a greeting the sign speaks of the greeting, not a reply', () => {
    h.greetings.add('r1');
    mount();
    fireEvent.click(screen.getByText('Read text instead'));
    expect(screen.queryByText(SIGN)).toBeNull();
    expect(screen.getByText('The greeting is on its way.')).toBeTruthy();
  });

  it('chosen before the message had its request (words still being transcribed), it holds for the request they start', async () => {
    h.state.conversation.pendingRequestId = null;
    // The message is still on its way to a request: its send does not settle here.
    vi.mocked(processTextMessage).mockImplementationOnce(() => new Promise(() => {}) as never);
    const rerender = mount();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Was ist Freiheit?' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    fireEvent.click(await screen.findByText('Read text instead'));
    expect(h.readFor).toEqual([null]);

    h.state.conversation.pendingRequestId = 'r3';
    rerender();
    expect(h.readFor).toEqual([null, 'r3']);
    // No card comes back for it, and the sign says the reply is on its way.
    expect(screen.queryByText('Read text instead')).toBeNull();
    expect(screen.getByText(SIGN)).toBeTruthy();
  });

  it('while the words are still being transcribed, the sign already says the reply is on its way', async () => {
    h.state.conversation.pendingRequestId = null;
    vi.mocked(processTextMessage).mockImplementationOnce(() => new Promise(() => {}) as never);
    const rerender = mount();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Was ist Freiheit?' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    fireEvent.click(await screen.findByText('Read text instead'));
    // No request yet: the card is gone, and the sign stands in for it.
    expect(screen.queryByText('Read text instead')).toBeNull();
    expect(screen.getByText(SIGN)).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(1);

    // The words start their request: the same sign, until the first words arrive.
    h.state.conversation.pendingRequestId = 'r5';
    rerender();
    expect(screen.getByText(SIGN)).toBeTruthy();
    h.state.session.firstTextArrived = true;
    rerender();
    expect(screen.queryByText(SIGN)).toBeNull();
  });

  it('a choice to read whose message started no request takes its sign with it', async () => {
    h.state.conversation.pendingRequestId = null;
    let settle: () => void = () => {};
    vi.mocked(processTextMessage).mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }) as never);
    mount();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Was ist Freiheit?' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    fireEvent.click(await screen.findByText('Read text instead'));
    expect(screen.getByText(SIGN)).toBeTruthy();
    await act(async () => { settle(); });
    expect(screen.queryByText(SIGN)).toBeNull();
  });

  it('a choice to read whose message started no request ends with it', async () => {
    h.state.conversation.pendingRequestId = null;
    let settle: () => void = () => {};
    vi.mocked(processTextMessage).mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }) as never);
    const rerender = mount();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Was ist Freiheit?' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    fireEvent.click(await screen.findByText('Read text instead'));
    await act(async () => { settle(); });

    // A later request (another conversation's greeting) gets its card as usual.
    h.state.conversation.pendingRequestId = 'r4';
    rerender();
    expect(h.readFor).toEqual([null]);
    expect(screen.getByText('Read text instead')).toBeTruthy();
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
