// The stop-voice icon in the composer: shown only while the Echo speaks, held
// through a short gap in the audio queue, gone at once after a tap, and
// cancelling upstream TTS before it stops playback. In the text form it sits
// in a slot left of mic and send that keeps its width while silent; in the
// record-bar form it is a sibling of the bar, never nested in it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  order: [] as string[],
  preferText: true,
  state: {
    session: { isAudioPlaying: false },
    conversation: { pendingRequestId: null, processingStage: null },
    mode: { selected: 'free_conversation' },
    figures: { selectedId: 'aurelius' },
    quota: { used: 0, limit: 30, resetsAt: null, isFreeTier: false, loaded: false },
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
vi.mock('../../services/audio/config/serviceConfig', () => ({ loadServiceConfig: () => ({ sttEnabled: true }) }));
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    tString: (_key: string, fallback = '') => fallback,
    tNode: (key: string) => key,
    language: 'en',
  }),
}));
vi.mock('../../hooks/useAutoplayGate', () => ({ useAutoplayGate: () => ({ getContext: () => null, unlock: () => {} }) }));
vi.mock('../../components/ProcessingLoader', () => ({ default: () => null }));
vi.mock('../../components/MicrophonePermissionError', () => ({ MicrophonePermissionError: () => null }));

import UnifiedInputContainer from '../../components/UnifiedInputContainer';

function mount() {
  const view = render(<UnifiedInputContainer selectedFigure="Echo of Marcus Aurelius" />);
  return {
    view,
    voice: (playing: boolean) => {
      h.state.session.isAudioPlaying = playing;
      view.rerender(<UnifiedInputContainer selectedFigure="Echo of Marcus Aurelius" />);
    },
  };
}

const stopButton = () => screen.queryByRole('button', { name: 'Stop voice' });

describe('composer stop voice', () => {
  beforeEach(() => {
    h.order = [];
    h.preferText = true;
    h.state.session.isAudioPlaying = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing while the Echo is silent, but keeps the slot', () => {
    const { view } = mount();
    expect(stopButton()).toBeNull();
    expect(view.container.querySelector('.input-actions .stop-voice-slot')).not.toBeNull();
  });

  it('is a named icon button left of mic and send in the text form', () => {
    const { view, voice } = mount();
    voice(true);
    const button = stopButton();
    expect(button).not.toBeNull();
    expect(button!.getAttribute('type')).toBe('button');
    expect(button!.getAttribute('title')).toBe('Stop voice');
    expect(button!.closest('.stop-voice-slot')).not.toBeNull();

    const actions = [...view.container.querySelectorAll('.input-actions button')];
    expect(actions.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Stop voice',
      'Switch to voice input',
      'Send message',
    ]);
  });

  it('cancels upstream TTS before it stops playback, and goes at once', () => {
    const { voice } = mount();
    voice(true);
    fireEvent.click(stopButton()!);
    expect(h.order).toEqual(['cancelAll', 'cleanup']);
    expect(stopButton()).toBeNull();
  });

  it('rides out a short gap in the audio queue', () => {
    const { voice } = mount();
    voice(true);
    voice(false);
    act(() => { vi.advanceTimersByTime(400); });
    expect(stopButton()).not.toBeNull();
    voice(true);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(stopButton()).not.toBeNull();
  });

  it('folds away a little after the voice has ended', () => {
    const { voice } = mount();
    voice(true);
    voice(false);
    act(() => { vi.advanceTimersByTime(600); });
    expect(stopButton()).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(stopButton()).toBeNull();
  });

  it('sits beside the record bar, never inside it', () => {
    h.preferText = false;
    const { view, voice } = mount();
    expect(view.container.querySelector('.voice-input-area--stop')).toBeNull();
    voice(true);
    const button = stopButton();
    expect(button).not.toBeNull();
    expect(button!.closest('.record-button')).toBeNull();
    const area = view.container.querySelector('.voice-input-area--stop');
    expect(area).not.toBeNull();
    expect(button!.parentElement).toBe(area);
    expect(area!.querySelector(':scope > .record-button')).not.toBeNull();

    fireEvent.click(button!);
    expect(h.order).toEqual(['cancelAll', 'cleanup']);
    expect(view.container.querySelector('.voice-input-area--stop')).toBeNull();
  });
});
