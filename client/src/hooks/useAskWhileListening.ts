// src/hooks/useAskWhileListening.ts
// The ask machine for a paused chapter. It owns the states, the frozen anchor
// and the beacons; the player stays the player and the driver owns the model.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDomainStore } from '../stores/domainStore';
import { LocalStorageAdapter } from '../storage/localAdapter';
import {
  sendFunnelBeacon,
  sendFunnelBeaconOnce,
  hasFiredFirstTurn,
  hasFiredFunnelStep,
  markReplyDispatchStart,
  replyTimeBucketSinceDispatch,
  firstReplyFailReason,
} from '../utils/funnelBeacon';
import { buildChapterWindow, indexWithoutTimestamps } from '../utils/askContext';
import {
  ASK_CONTEXT_MAX_CHARS,
  ASK_DWELL_MS,
  ASK_RESUME_TIMEOUT_MS,
  ASK_SCRUB_EPSILON_S,
} from '../config/askWhileListening';

export type AskState =
  | 'listening'
  | 'paused'
  | 'armed'
  | 'composing'
  | 'recording'
  | 'pending'
  | 'answering'
  | 'answered'
  | 'resuming'
  | 'woven'
  | 'failed'
  | 'limited'
  | 'chapterend';

export interface AskExchange {
  question: string;
  answer: string;
  paragraphIndex: number;
  spoken: boolean;
}

/** Where the listener stopped. Frozen on arm, untouched for the whole ask. */
export interface AskAnchor {
  seconds: number;
  paragraphIndex: number;
}

/** The one quiet line under the sheet, when there is one. */
export type AskNotice = 'error' | 'voiceUnavailable' | 'offline' | 'quotaSpent' | 'capacity';

export interface AskDriverInput {
  figureId: string;
  language: string;
  seedId: string;
  contextWindow: string;
  question: string;
  priorPairs: AskExchange[];
  speak: boolean;
  signal: AbortSignal;
  onText: (t: string) => void;
  onFirstToken: () => void;
  onVoiceEnd: () => void;
}

export interface AskDriver {
  ask(input: AskDriverInput): Promise<void>;
  stopVoice(): void;
}

export interface UseAskArgs {
  enabled: boolean;
  figureId: string;
  figureName: string;
  seedId: string;
  chapter: number;
  language: string;
  paragraphs: string[];
  activeParagraphIndex: number | null;
  isHighlightingAvailable: boolean;
  audioTimeSeconds: number;
  audioDurationSeconds: number;
  isPlaying: boolean;
  hasPlayed: boolean;
  atChapterEnd: boolean;
  overlayOpen: boolean;
  /** Cancel voice, clean the queue, run-up seek, ask the player to play. */
  onResume: (seconds: number) => void;
  onCarry: (exchanges: AskExchange[]) => void;
  driver: AskDriver;
}

export interface UseAskResult {
  state: AskState;
  anchor: AskAnchor | null;
  /** The exchanges of this pause, live: a question joins as it is asked. */
  exchanges: AskExchange[];
  draft: string;
  answerText: string;
  notice: AskNotice | null;
  /** The Echo is speaking the answer right now. */
  speaking: boolean;
  /** The hint under the field, shown the first time the sheet opens. */
  showHint: boolean;
  openComposer: () => void;
  closeSheet: () => void;
  setDraft: (value: string) => void;
  send: () => void;
  retry: () => void;
  stopVoice: () => void;
  resume: () => void;
  askAnother: () => void;
  carry: () => void;
  /** Voice question: the recorder is wired by the sheet, this flips the room. */
  setRecording: (recording: boolean) => void;
}

const HINT_SEEN_KEY = 'askListenHintSeen';

function readHintSeen(): boolean {
  return LocalStorageAdapter.getString(HINT_SEEN_KEY) === '1';
}

function markHintSeen(): void {
  LocalStorageAdapter.setString(HINT_SEEN_KEY, '1');
}

export function useAskWhileListening(args: UseAskArgs): UseAskResult {
  const {
    enabled,
    figureId,
    seedId,
    chapter,
    language,
    paragraphs,
    activeParagraphIndex,
    isHighlightingAvailable,
    audioTimeSeconds,
    audioDurationSeconds,
    isPlaying,
    hasPlayed,
    atChapterEnd,
    overlayOpen,
    onResume,
    onCarry,
    driver,
  } = args;

  const [state, setState] = useState<AskState>('listening');
  const [anchor, setAnchor] = useState<AskAnchor | null>(null);
  const [exchanges, setExchanges] = useState<AskExchange[]>([]);
  const [draft, setDraft] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [notice, setNotice] = useState<AskNotice | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [showHint, setShowHint] = useState<boolean>(() => !readHintSeen());
  const [documentVisible, setDocumentVisible] = useState<boolean>(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );

  const stateRef = useRef<AskState>(state);
  stateRef.current = state;
  const anchorRef = useRef<AskAnchor | null>(anchor);
  anchorRef.current = anchor;
  const exchangesRef = useRef<AskExchange[]>(exchanges);
  exchangesRef.current = exchanges;
  const timeRef = useRef(audioTimeSeconds);
  timeRef.current = audioTimeSeconds;
  const paragraphsRef = useRef(paragraphs);
  paragraphsRef.current = paragraphs;
  const hasPlayedRef = useRef(hasPlayed);
  hasPlayedRef.current = hasPlayed;
  const driverRef = useRef(driver);
  driverRef.current = driver;

  const shownBeaconRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamDoneRef = useRef(true);
  const voiceDoneRef = useRef(true);
  // The gateway refused audio once, so nothing asks it again this session.
  const textOnlyRef = useRef(false);
  const armedAtTimeRef = useRef<number | null>(null);

  // Resolve the paused paragraph. With timestamps the player already knows it;
  // without them the position in the file is the only thing there is.
  const resolveParagraphIndex = useCallback((): number => {
    if (isHighlightingAvailable && activeParagraphIndex !== null) return activeParagraphIndex;
    return indexWithoutTimestamps(timeRef.current, audioDurationSeconds, paragraphsRef.current.length);
  }, [isHighlightingAvailable, activeParagraphIndex, audioDurationSeconds]);

  // The dwell never runs on a dark screen: a lock-screen pause is a real pause
  // but must not arm a bar nobody can see.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => setDocumentVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // Audio rate limit: text-only for the rest of the session, no request the
  // gateway will refuse.
  useEffect(() => {
    const onLimit = () => {
      textOnlyRef.current = true;
    };
    window.addEventListener('audio-rate-limit', onLimit);
    return () => window.removeEventListener('audio-rate-limit', onLimit);
  }, []);

  // --- play and pause, from any source ---
  const wasPlayingRef = useRef(isPlaying);
  useEffect(() => {
    const was = wasPlayingRef.current;
    wasPlayingRef.current = isPlaying;
    if (!enabled || was === isPlaying) return;

    if (isPlaying) {
      const current = stateRef.current;
      if (current === 'resuming') {
        setState('woven');
        return;
      }
      if (current === 'chapterend') return;
      // The chapter took the room back. Whatever the sheet was doing stops.
      if (current === 'answering' || current === 'pending') {
        abortRef.current?.abort();
        driverRef.current.stopVoice();
      }
      setSpeaking(false);
      setState('listening');
      return;
    }

    const current = stateRef.current;
    if (current === 'listening' || current === 'woven') setState('paused');
  }, [isPlaying, enabled]);

  // --- the end card owns the surface ---
  useEffect(() => {
    if (!enabled) return;
    if (atChapterEnd) {
      if (stateRef.current !== 'chapterend') setState('chapterend');
      return;
    }
    if (stateRef.current === 'chapterend') setState(isPlaying ? 'listening' : 'paused');
  }, [atChapterEnd, enabled, isPlaying]);

  // --- the dwell ---
  useEffect(() => {
    if (!enabled) return;
    if (state !== 'paused') return;
    if (!hasPlayed || atChapterEnd || overlayOpen || !documentVisible) return;

    const timer = setTimeout(() => {
      setAnchor({ seconds: timeRef.current, paragraphIndex: resolveParagraphIndex() });
      // A new pause opens a new margin note.
      setExchanges([]);
      setAnswerText('');
      setNotice(null);
      setState('armed');

      const ref = `${figureId}:${chapter}`;
      if (shownBeaconRef.current !== ref) {
        shownBeaconRef.current = ref;
        sendFunnelBeacon('ask_listen_shown', { figureId, mode: 'story' });
      }
    }, ASK_DWELL_MS);

    return () => clearTimeout(timer);
  }, [enabled, state, hasPlayed, atChapterEnd, overlayOpen, documentVisible, figureId, chapter, resolveParagraphIndex]);

  // --- a scrub invalidates the anchor, so the bar folds ---
  useEffect(() => {
    if (state !== 'armed') {
      armedAtTimeRef.current = null;
      return;
    }
    if (armedAtTimeRef.current === null) {
      armedAtTimeRef.current = audioTimeSeconds;
      return;
    }
    if (Math.abs(audioTimeSeconds - armedAtTimeRef.current) > ASK_SCRUB_EPSILON_S) {
      armedAtTimeRef.current = null;
      setState('paused');
    }
  }, [state, audioTimeSeconds]);

  // --- a resume that never sounds must not leave the sheet hanging ---
  useEffect(() => {
    if (state !== 'resuming') return;
    const timer = setTimeout(() => {
      if (stateRef.current === 'resuming') setState('paused');
    }, ASK_RESUME_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state]);

  // --- the ask ---
  const settle = useCallback(() => {
    if (!streamDoneRef.current || !voiceDoneRef.current) return;
    setSpeaking(false);
    setState((prev) => (prev === 'answering' || prev === 'pending' ? 'answered' : prev));
  }, []);

  const startAsk = useCallback(
    (question: string, priorPairs: AskExchange[]) => {
      const paragraphIndex = anchorRef.current?.paragraphIndex ?? 0;
      const contextWindow = buildChapterWindow(paragraphsRef.current, paragraphIndex, ASK_CONTEXT_MAX_CHARS);
      // A transcript reader never asked for sound, and a refused gateway will
      // refuse again.
      const speak = hasPlayedRef.current && !textOnlyRef.current;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      streamDoneRef.current = false;
      voiceDoneRef.current = !speak;

      const index = priorPairs.length;
      setAnswerText('');
      setNotice(null);
      setSpeaking(false);
      setState('pending');
      // The pair joins the mark the moment it is asked, so a chapter ending
      // mid-answer still leaves the question and whatever arrived behind.
      setExchanges([...priorPairs, { question, answer: '', paragraphIndex, spoken: speak }]);

      sendFunnelBeacon('ask_listen_sent', { figureId, mode: 'story' });
      sendFunnelBeaconOnce('first_turn', { figureId, mode: 'story' });
      markReplyDispatchStart();

      let firstToken = false;
      let accumulated = '';

      const fail = (error: unknown): void => {
        const reason = firstReplyFailReason(error);
        if (hasFiredFirstTurn()) {
          const alreadyLanded = hasFiredFunnelStep('first_reply');
          sendFunnelBeaconOnce('first_reply', { outcome: 'error', bucket: replyTimeBucketSinceDispatch() });
          if (!alreadyLanded) {
            sendFunnelBeaconOnce('first_reply_failed', { outcome: reason, bucket: replyTimeBucketSinceDispatch() });
          }
        }
        setSpeaking(false);
        if (reason === 'quota') {
          const quota = useDomainStore.getState().quota;
          const spent = quota.isFreeTier && quota.loaded && quota.limit - quota.used <= 0;
          setNotice(spent ? 'quotaSpent' : 'capacity');
          setState('limited');
          // The daily limit gets the same door as the composer: the modal that
          // explains it and offers a key. The chapter stays paused under it.
          if (spent) {
            useDomainStore.getState().openRateLimitModal('chat', quota.resetsAt, quota.limit);
          }
          return;
        }
        setNotice(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
        setState('failed');
      };

      void driverRef.current
        .ask({
          figureId,
          language,
          seedId,
          contextWindow,
          question,
          priorPairs,
          speak,
          signal: controller.signal,
          onText: (chunk) => {
            accumulated += chunk;
            setAnswerText(accumulated);
            setExchanges((prev) =>
              prev.map((item, i) => (i === index ? { ...item, answer: accumulated } : item)),
            );
          },
          onFirstToken: () => {
            if (firstToken) return;
            firstToken = true;
            if (speak) setSpeaking(true);
            setState((prev) => (prev === 'pending' ? 'answering' : prev));
            if (hasFiredFirstTurn()) {
              sendFunnelBeaconOnce('first_reply', { outcome: '200', bucket: replyTimeBucketSinceDispatch() });
            }
          },
          onVoiceEnd: () => {
            voiceDoneRef.current = true;
            settle();
          },
        })
        .then(() => {
          streamDoneRef.current = true;
          if (!firstToken) {
            fail(new Error('no reply'));
            return;
          }
          settle();
        })
        .catch((error: unknown) => {
          streamDoneRef.current = true;
          if ((error as { name?: string } | null)?.name === 'AbortError') return;
          if (firstToken) {
            // Text arrived, so the answer stands. A voice that died after it is
            // one quiet line, not a state.
            voiceDoneRef.current = true;
            setNotice('voiceUnavailable');
            settle();
            return;
          }
          fail(error);
        });
    },
    [figureId, language, seedId, settle],
  );

  // --- actions ---
  const openComposer = useCallback(() => {
    if (stateRef.current !== 'armed') return;
    if (showHint) {
      markHintSeen();
      // The hint stays up for this open, and never again.
    }
    setState('composing');
  }, [showHint]);

  const closeSheet = useCallback(() => {
    const current = stateRef.current;
    if (current === 'listening' || current === 'paused' || current === 'armed' || current === 'chapterend') return;
    abortRef.current?.abort();
    driverRef.current.stopVoice();
    setSpeaking(false);
    setShowHint(false);
    setState('armed');
  }, []);

  const send = useCallback(() => {
    if (stateRef.current !== 'composing') return;
    const question = draft.trim();
    if (!question) return;
    setShowHint(false);

    // Pre-checked the way the composer does: a spent quota is a line inside
    // the sheet plus the rate-limit modal that offers a key, no request leaves.
    const quota = useDomainStore.getState().quota;
    if (quota.isFreeTier && quota.loaded && quota.limit - quota.used <= 0) {
      setNotice('quotaSpent');
      setState('limited');
      useDomainStore.getState().openRateLimitModal('chat', quota.resetsAt, quota.limit);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setNotice('offline');
      setState('failed');
      return;
    }
    startAsk(question, exchangesRef.current);
  }, [draft, startAsk]);

  const retry = useCallback(() => {
    if (stateRef.current !== 'failed') return;
    const pairs = exchangesRef.current;
    const last = pairs[pairs.length - 1];
    // A model failure leaves the pair in the mark with an empty answer; an
    // offline send never got that far and the words are still in the box.
    const pendingPair = last && !last.answer ? last : null;
    const question = (pendingPair ? pendingPair.question : draft).trim();
    if (!question) return;
    startAsk(question, pendingPair ? pairs.slice(0, -1) : pairs);
  }, [draft, startAsk]);

  const stopVoice = useCallback(() => {
    driverRef.current.stopVoice();
    voiceDoneRef.current = true;
    setSpeaking(false);
    setState((prev) => (prev === 'answering' ? 'answered' : prev));
  }, []);

  const resume = useCallback(() => {
    const current = stateRef.current;
    if (current === 'listening' || current === 'woven' || current === 'resuming') return;
    const answered = current === 'answering' || current === 'answered';
    abortRef.current?.abort();
    driverRef.current.stopVoice();
    setSpeaking(false);
    if (answered) sendFunnelBeacon('ask_listen_resumed', { figureId, mode: 'story' });
    setState('resuming');
    onResume(anchorRef.current?.seconds ?? 0);
  }, [figureId, onResume]);

  const askAnother = useCallback(() => {
    const current = stateRef.current;
    if (current !== 'answered' && current !== 'failed' && current !== 'limited') return;
    driverRef.current.stopVoice();
    setSpeaking(false);
    setDraft('');
    setAnswerText('');
    setNotice(null);
    setState('composing');
  }, []);

  const carry = useCallback(() => {
    abortRef.current?.abort();
    driverRef.current.stopVoice();
    setSpeaking(false);
    onCarry(exchangesRef.current);
  }, [onCarry]);

  const setRecording = useCallback((recording: boolean) => {
    setState((prev) => {
      if (recording) return prev === 'composing' ? 'recording' : prev;
      return prev === 'recording' ? 'composing' : prev;
    });
  }, []);

  // A language switch remounts the player, but a figure or chapter change does
  // not: the marks and the machine belong to the chapter that made them.
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    setState(wasPlayingRef.current ? 'listening' : 'paused');
    setAnchor(null);
    setExchanges([]);
    setAnswerText('');
    setDraft('');
    setNotice(null);
    setSpeaking(false);
    abortRef.current?.abort();
  }, [figureId, seedId, language]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const hintVisible = showHint && (state === 'composing' || state === 'recording');

  return useMemo(
    () => ({
      state,
      anchor,
      exchanges,
      draft,
      answerText,
      notice,
      speaking,
      showHint: hintVisible,
      openComposer,
      closeSheet,
      setDraft,
      send,
      retry,
      stopVoice,
      resume,
      askAnother,
      carry,
      setRecording,
    }),
    [
      state,
      anchor,
      exchanges,
      draft,
      answerText,
      notice,
      speaking,
      hintVisible,
      openComposer,
      closeSheet,
      send,
      retry,
      stopVoice,
      resume,
      askAnother,
      carry,
      setRecording,
    ],
  );
}

export default useAskWhileListening;
