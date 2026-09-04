// The ask machine: every transition of the design's state table, the dwell
// guards, and the once-per-chapter shown beacon. The driver is a fake, so no
// model, no audio, no network.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const shared = vi.hoisted(() => ({
  beacons: [] as string[],
  onceBeacons: [] as string[],
  quota: { used: 0, limit: 30, resetsAt: null as string | null, isFreeTier: true, loaded: true },
}));

vi.mock('../../utils/funnelBeacon', () => ({
  sendFunnelBeacon: (step: string) => {
    shared.beacons.push(step);
  },
  sendFunnelBeaconOnce: (step: string) => {
    shared.onceBeacons.push(step);
  },
  hasFiredFirstTurn: () => true,
  hasFiredFunnelStep: () => false,
  markReplyDispatchStart: () => undefined,
  replyTimeBucketSinceDispatch: () => 0,
  firstReplyFailReason: (error: unknown) =>
    (error as { status?: number } | null)?.status === 429 ? 'quota' : 'upstream',
}));

vi.mock('../../stores/domainStore', () => ({
  useDomainStore: Object.assign(() => undefined, {
    getState: () => ({ quota: shared.quota }),
  }),
}));

import { useAskWhileListening } from '../../hooks/useAskWhileListening';
import type { AskDriverInput, UseAskArgs } from '../../hooks/useAskWhileListening';
import { ASK_DWELL_MS } from '../../config/askWhileListening';

function makeDriver() {
  const calls: AskDriverInput[] = [];
  let settle: (() => void) | null = null;
  let breakIt: ((error: unknown) => void) | null = null;
  const stopVoice = vi.fn();
  const driver = {
    ask(input: AskDriverInput): Promise<void> {
      calls.push(input);
      return new Promise<void>((resolve, reject) => {
        settle = resolve;
        breakIt = reject;
      });
    },
    stopVoice,
  };
  return {
    driver,
    calls,
    stopVoice,
    last: () => calls[calls.length - 1],
    finish: () => settle?.(),
    fail: (error: unknown) => breakIt?.(error),
  };
}

const PARAGRAPHS = ['One paragraph.', 'Two paragraphs.', 'Three paragraphs.', 'Four paragraphs.'];

function baseArgs(overrides: Partial<UseAskArgs> = {}): UseAskArgs {
  return {
    enabled: true,
    figureId: 'aurelius',
    figureName: 'Marcus Aurelius',
    seedId: 'aurelius_3',
    chapter: 3,
    language: 'en',
    paragraphs: PARAGRAPHS,
    activeParagraphIndex: 2,
    isHighlightingAvailable: true,
    audioTimeSeconds: 252,
    audioDurationSeconds: 1120,
    isPlaying: false,
    hasPlayed: true,
    atChapterEnd: false,
    overlayOpen: false,
    onResume: vi.fn(),
    onCarry: vi.fn(),
    driver: makeDriver().driver,
    ...overrides,
  };
}

/** Render the hook, then take it through play and pause into the dwell. */
function mount(overrides: Partial<UseAskArgs> = {}) {
  const args = baseArgs(overrides);
  const view = renderHook((props: UseAskArgs) => useAskWhileListening(props), { initialProps: args });
  const update = (next: Partial<UseAskArgs>) => {
    Object.assign(args, next);
    act(() => view.rerender({ ...args }));
  };
  return { view, args, update };
}

function pauseInto(view: ReturnType<typeof mount>) {
  view.update({ isPlaying: true });
  view.update({ isPlaying: false });
}

function dwell(ms = ASK_DWELL_MS) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('useAskWhileListening', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    shared.beacons.length = 0;
    shared.onceBeacons.length = 0;
    shared.quota = { used: 0, limit: 30, resetsAt: null, isFreeTier: true, loaded: true };
    setVisibility('visible');
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('arms after the dwell and freezes the anchor', () => {
    const view = mount();
    pauseInto(view);
    expect(view.view.result.current.state).toBe('paused');

    dwell();
    expect(view.view.result.current.state).toBe('armed');
    expect(view.view.result.current.anchor).toEqual({ seconds: 252, paragraphIndex: 2 });
    expect(shared.beacons).toEqual(['ask_listen_shown']);
  });

  it('renders nothing when play comes back inside the dwell', () => {
    const view = mount();
    pauseInto(view);
    dwell(ASK_DWELL_MS - 200);
    view.update({ isPlaying: true });

    expect(view.view.result.current.state).toBe('listening');
    expect(shared.beacons).toEqual([]);
  });

  it('does not arm on a dark screen, and arms when the screen comes back', () => {
    const view = mount();
    setVisibility('hidden');
    pauseInto(view);
    dwell();
    expect(view.view.result.current.state).toBe('paused');

    setVisibility('visible');
    dwell();
    expect(view.view.result.current.state).toBe('armed');
  });

  it('does not arm while an overlay is open, or before the chapter ever sounded', () => {
    const withOverlay = mount({ overlayOpen: true });
    pauseInto(withOverlay);
    dwell();
    expect(withOverlay.view.result.current.state).toBe('paused');

    const neverPlayed = mount({ hasPlayed: false });
    neverPlayed.update({ isPlaying: false });
    dwell();
    expect(neverPlayed.view.result.current.state).toBe('listening');
    expect(shared.beacons).toEqual([]);
  });

  it('hands the surface to the end card and never arms there', () => {
    const view = mount();
    pauseInto(view);
    view.update({ atChapterEnd: true });
    dwell();
    expect(view.view.result.current.state).toBe('chapterend');
    expect(shared.beacons).toEqual([]);
  });

  it('fires the shown beacon once per chapter, however often the bar arms', () => {
    const view = mount();
    pauseInto(view);
    dwell();
    view.update({ isPlaying: true });
    view.update({ isPlaying: false });
    dwell();

    expect(view.view.result.current.state).toBe('armed');
    expect(shared.beacons).toEqual(['ask_listen_shown']);
  });

  it('folds the bar on a scrub', () => {
    const view = mount();
    pauseInto(view);
    dwell();
    expect(view.view.result.current.state).toBe('armed');

    view.update({ audioTimeSeconds: 400 });
    expect(view.view.result.current.state).toBe('paused');
  });

  it('runs the whole ask, from the bar tap to the answer', async () => {
    const fake = makeDriver();
    const view = mount({ driver: fake.driver });
    pauseInto(view);
    dwell();

    act(() => view.view.result.current.openComposer());
    expect(view.view.result.current.state).toBe('composing');

    act(() => view.view.result.current.setDraft('Why did you forgive him?'));
    act(() => view.view.result.current.send());

    expect(view.view.result.current.state).toBe('pending');
    expect(shared.beacons).toContain('ask_listen_sent');
    expect(shared.onceBeacons).toContain('first_turn');
    const input = fake.last();
    expect(input.question).toBe('Why did you forgive him?');
    expect(input.speak).toBe(true);
    // The window ends at the paused paragraph, and never reaches past it.
    expect(input.contextWindow).toContain('Three paragraphs.');
    expect(input.contextWindow).not.toContain('Four paragraphs.');

    act(() => input.onFirstToken());
    expect(view.view.result.current.state).toBe('answering');
    expect(shared.onceBeacons).toContain('first_reply');

    act(() => input.onText('I did not forgive. I waited.'));
    expect(view.view.result.current.answerText).toBe('I did not forgive. I waited.');
    expect(view.view.result.current.exchanges[0].answer).toBe('I did not forgive. I waited.');

    await act(async () => {
      fake.finish();
      await Promise.resolve();
    });
    // The stream ended but the voice has not, so the panel keeps speaking.
    expect(view.view.result.current.state).toBe('answering');

    await act(async () => {
      input.onVoiceEnd();
      await Promise.resolve();
    });
    expect(view.view.result.current.state).toBe('answered');
  });

  it('closes the sheet back to the bar and keeps the draft', () => {
    const view = mount();
    pauseInto(view);
    dwell();
    act(() => view.view.result.current.openComposer());
    act(() => view.view.result.current.setDraft('half a question'));
    act(() => view.view.result.current.closeSheet());

    expect(view.view.result.current.state).toBe('armed');
    expect(view.view.result.current.draft).toBe('half a question');
  });

  it('resumes into the woven room and back to paused on the next pause', async () => {
    const fake = makeDriver();
    const onResume = vi.fn();
    const view = mount({ driver: fake.driver, onResume });
    pauseInto(view);
    dwell();
    act(() => view.view.result.current.openComposer());
    act(() => view.view.result.current.setDraft('one thing'));
    act(() => view.view.result.current.send());
    const input = fake.last();
    act(() => input.onFirstToken());
    await act(async () => {
      fake.finish();
      input.onVoiceEnd();
      await Promise.resolve();
    });
    expect(view.view.result.current.state).toBe('answered');

    act(() => view.view.result.current.resume());
    expect(view.view.result.current.state).toBe('resuming');
    expect(onResume).toHaveBeenCalledWith(252);
    expect(shared.beacons).toContain('ask_listen_resumed');

    view.update({ isPlaying: true });
    expect(view.view.result.current.state).toBe('woven');

    view.update({ isPlaying: false });
    expect(view.view.result.current.state).toBe('paused');
  });

  it('keeps the words and offers one retry when the model fails', async () => {
    const fake = makeDriver();
    const view = mount({ driver: fake.driver });
    pauseInto(view);
    dwell();
    act(() => view.view.result.current.openComposer());
    act(() => view.view.result.current.setDraft('a question that fails'));
    act(() => view.view.result.current.send());

    await act(async () => {
      fake.fail(new Error('upstream is down'));
      await Promise.resolve();
    });
    expect(view.view.result.current.state).toBe('failed');
    expect(view.view.result.current.notice).toBe('error');
    expect(view.view.result.current.exchanges).toHaveLength(1);

    act(() => view.view.result.current.retry());
    expect(view.view.result.current.state).toBe('pending');
    expect(fake.calls).toHaveLength(2);
    expect(fake.last().question).toBe('a question that fails');
    expect(fake.last().priorPairs).toHaveLength(0);
  });

  it('lands a 429 in limited, with the capacity line when the quota is not spent', async () => {
    const fake = makeDriver();
    const view = mount({ driver: fake.driver });
    pauseInto(view);
    dwell();
    act(() => view.view.result.current.openComposer());
    act(() => view.view.result.current.setDraft('one more'));
    act(() => view.view.result.current.send());

    await act(async () => {
      fake.fail({ status: 429 });
      await Promise.resolve();
    });
    expect(view.view.result.current.state).toBe('limited');
    expect(view.view.result.current.notice).toBe('capacity');
  });

  it('shows the quota line inside the sheet instead of asking at all', () => {
    shared.quota = { used: 30, limit: 30, resetsAt: null, isFreeTier: true, loaded: true };
    const fake = makeDriver();
    const view = mount({ driver: fake.driver });
    pauseInto(view);
    dwell();
    act(() => view.view.result.current.openComposer());
    act(() => view.view.result.current.setDraft('anything'));
    act(() => view.view.result.current.send());

    expect(view.view.result.current.state).toBe('limited');
    expect(view.view.result.current.notice).toBe('quotaSpent');
    expect(fake.calls).toHaveLength(0);
    expect(shared.beacons).not.toContain('ask_listen_sent');
  });

  it('sends nothing on an empty box, and moves through the voice room', () => {
    const fake = makeDriver();
    const view = mount({ driver: fake.driver });
    pauseInto(view);
    dwell();
    act(() => view.view.result.current.openComposer());
    act(() => view.view.result.current.send());
    expect(fake.calls).toHaveLength(0);
    expect(view.view.result.current.state).toBe('composing');

    act(() => view.view.result.current.setRecording(true));
    expect(view.view.result.current.state).toBe('recording');
    act(() => view.view.result.current.setRecording(false));
    expect(view.view.result.current.state).toBe('composing');
  });

  it('asks a second question inside the same pause and carries both', async () => {
    const fake = makeDriver();
    const onCarry = vi.fn();
    const view = mount({ driver: fake.driver, onCarry });
    pauseInto(view);
    dwell();
    act(() => view.view.result.current.openComposer());
    act(() => view.view.result.current.setDraft('first'));
    act(() => view.view.result.current.send());
    let input = fake.last();
    act(() => input.onFirstToken());
    act(() => input.onText('first answer'));
    await act(async () => {
      fake.finish();
      input.onVoiceEnd();
      await Promise.resolve();
    });

    act(() => view.view.result.current.askAnother());
    expect(view.view.result.current.state).toBe('composing');
    act(() => view.view.result.current.setDraft('second'));
    act(() => view.view.result.current.send());
    input = fake.last();
    expect(input.priorPairs).toHaveLength(1);
    expect(input.priorPairs[0].answer).toBe('first answer');

    act(() => view.view.result.current.carry());
    expect(onCarry).toHaveBeenCalledTimes(1);
    expect(onCarry.mock.calls[0][0]).toHaveLength(2);
  });

  it('stops the voice on demand and settles the answer', async () => {
    const fake = makeDriver();
    const view = mount({ driver: fake.driver });
    pauseInto(view);
    dwell();
    act(() => view.view.result.current.openComposer());
    act(() => view.view.result.current.setDraft('speak to me'));
    act(() => view.view.result.current.send());
    const input = fake.last();
    act(() => input.onFirstToken());
    await act(async () => {
      fake.finish();
      await Promise.resolve();
    });
    expect(view.view.result.current.speaking).toBe(true);

    act(() => view.view.result.current.stopVoice());
    expect(fake.stopVoice).toHaveBeenCalled();
    expect(view.view.result.current.speaking).toBe(false);
    expect(view.view.result.current.state).toBe('answered');
  });

  it('reads without speaking for a chapter that never sounded', () => {
    const fake = makeDriver();
    const view = mount({ driver: fake.driver, hasPlayed: false });
    // The bar cannot arm without audio, so the anchor is set the moment the
    // chapter does sound once and pauses again.
    view.update({ hasPlayed: true, isPlaying: true });
    view.update({ isPlaying: false });
    dwell();
    act(() => view.view.result.current.openComposer());
    act(() => view.view.result.current.setDraft('a reader asks'));
    view.update({ hasPlayed: false });
    act(() => view.view.result.current.send());

    expect(fake.last().speak).toBe(false);
  });
});
