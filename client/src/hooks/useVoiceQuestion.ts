// src/hooks/useVoiceQuestion.ts
// The composer's recorder, reduced to what a one-off question needs: record,
// transcribe, hand back text. No conversation, no LLM, no processing overlay.
import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio } from '../services/audio/stt';
import { EmptyAudioError } from '../services/audio/stt/sttUtils';
import { STT_SERVICES, loadServiceConfig } from '../services/audio/config/serviceConfig';
import { useAutoplayGate } from './useAutoplayGate';

/**
 * Shortest take that can hold a spoken word. Below it the blob is an
 * accidental double-tap: header-only, undecodable, and a guaranteed 500 if it
 * were sent. A Blob carries no duration, so the elapsed time is the only
 * reliable guard.
 */
export const MIN_AUDIO_MS = 300;

/** Why the microphone is unavailable. Everything maps to "type instead". */
export type VoiceQuestionError = 'denied' | 'unavailable' | 'no-speech' | 'transcription';

export interface UseVoiceQuestionArgs {
  language: string;
  /** Called with the transcript once it lands. Never called with empty text. */
  onTranscript: (text: string) => void;
  /** Called when a take ends without a transcript, so the caller can settle. */
  onSettled?: () => void;
}

export interface UseVoiceQuestionResult {
  supported: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  /** 0 to 255, for the pulse on the mic button. */
  audioLevel: number;
  error: VoiceQuestionError | null;
  clearError: () => void;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  /** Drop the take without transcribing it (sheet closed, chapter resumed). */
  cancel: () => void;
}

export function useVoiceQuestion({ language, onTranscript, onSettled }: UseVoiceQuestionArgs): UseVoiceQuestionResult {
  const { unlock, getContext } = useAutoplayGate();

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<VoiceQuestionError | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const discardRef = useRef(false);
  const recordingRef = useRef(false);

  const supported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined' &&
    loadServiceConfig().sttEnabled !== false;

  const releaseStream = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setAudioLevel(0);
  }, []);

  const start = useCallback((): void => {
    if (recordingRef.current || isTranscribing || !supported) return;

    // The unlock has to happen in the same event turn as the tap, before the
    // permission prompt steals it, or the answer cannot autoplay afterwards.
    unlock();
    discardRef.current = false;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        streamRef.current = stream;

        try {
          const context = getContext();
          const analyser = context.createAnalyser();
          analyser.fftSize = 256;
          context.createMediaStreamSource(stream).connect(analyser);
          analyserRef.current = analyser;
          const tick = (): void => {
            if (!analyserRef.current) return;
            const data = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(data);
            setAudioLevel(data.reduce((acc, value) => acc + value, 0) / data.length);
            frameRef.current = requestAnimationFrame(tick);
          };
          tick();
        } catch {
          // No meter is fine. The take still records.
        }

        const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : undefined;
        const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : {});
        recorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        startedAtRef.current = Date.now();
        recorder.start();
        recordingRef.current = true;
        setIsRecording(true);
        setError(null);
      } catch (err) {
        releaseStream();
        recordingRef.current = false;
        setIsRecording(false);
        const name = (err as { name?: string } | null)?.name;
        setError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
        onSettled?.();
      }
    })();
  }, [isTranscribing, supported, unlock, getContext, releaseStream, onSettled]);

  const stop = useCallback((): void => {
    const recorder = recorderRef.current;
    if (!recordingRef.current || !recorder) return;
    recordingRef.current = false;

    void (async () => {
      try {
        // Attached before stop() so an instant take cannot miss the event.
        const flushed = new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
        });
        recorder.stop();
        setIsRecording(false);

        try {
          await Promise.race([flushed, new Promise<void>((resolve) => setTimeout(resolve, 1500))]);
        } finally {
          releaseStream();
        }

        const elapsedMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const chunkCount = chunksRef.current.length;
        chunksRef.current = [];

        if (discardRef.current) {
          onSettled?.();
          return;
        }
        if (chunkCount === 0 || elapsedMs < MIN_AUDIO_MS) {
          setError('no-speech');
          onSettled?.();
          return;
        }

        setIsTranscribing(true);
        const result = await transcribeAudio(blob, STT_SERVICES.SELF_HOSTED, language);
        setIsTranscribing(false);
        const text = result?.text?.trim() ?? '';
        if (!text) {
          setError('no-speech');
          onSettled?.();
          return;
        }
        if (discardRef.current) {
          onSettled?.();
          return;
        }
        onTranscript(text);
      } catch (err) {
        releaseStream();
        setIsRecording(false);
        setIsTranscribing(false);
        setError(err instanceof EmptyAudioError ? 'no-speech' : 'transcription');
        onSettled?.();
      }
    })();
  }, [language, onTranscript, onSettled, releaseStream]);

  const toggle = useCallback((): void => {
    if (recordingRef.current) stop();
    else start();
  }, [start, stop]);

  const cancel = useCallback((): void => {
    discardRef.current = true;
    if (recordingRef.current) stop();
    else releaseStream();
  }, [stop, releaseStream]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => () => {
    discardRef.current = true;
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    } catch {
      // Already gone.
    }
    releaseStream();
  }, [releaseStream]);

  return { supported, isRecording, isTranscribing, audioLevel, error, clearError, start, stop, toggle, cancel };
}

export default useVoiceQuestion;
