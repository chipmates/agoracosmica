// src/services/ask/askDriver.ts
//
// The answer to a question asked while a chapter is paused: one free-talk
// generation carrying the aside rules, streamed to the reader and, unless the
// listener is reading, to the Echo voice through the conversation's own
// ordered TTS sink.

import { generateResponse, type Message } from '../audio/llm';
import { fetchInstructions, INSTRUCTION_MODES } from '../audio/instructionProcessor';
import { convertTextToSpeech } from '../audio/tts';
import { getOrRollConversationSessionId, touchConversationSession } from '../audio/tts/ttsSessions';
import { TTSScheduler, type TTSResult } from '../audio/ttsScheduler';
import {
  addToAudioQueue,
  cleanupAudioResources,
  getAudioQueueStatus,
  getBufferDurationSeconds,
  setCurrentSession,
} from '../audio/audioQueueManager';
import { loadServiceConfig } from '../audio/config/serviceConfig';
import { keyStorage } from '../storage/keyStorageService';
import { useDomainStore } from '../../stores/domainStore';
import { cleanTextForTts } from '../../utils/ttsTextCleaner';

/** One question and its answer inside a single pause. Mirrors the hook's type. */
export interface AskExchange {
  question: string;
  answer: string;
  paragraphIndex: number;
  spoken: boolean;
}

export interface AskInput {
  figureId: string;
  language: string;
  seedId: string;
  /** Whole paragraphs up to the paused one. Everything the answer may know. */
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
  ask(input: AskInput): Promise<void>;
  stopVoice(): void;
}

// Same bounded concurrency the conversation uses, on its own instance: an ask
// runs while no conversation streams, and the two never share a session id.
const ttsScheduler = new TTSScheduler(2);
ttsScheduler.setBufferProvider(getBufferDurationSeconds);

// The gateway refused audio once, so the rest of the session reads. Module
// scope on purpose: the refusal outlives any single ask.
let audioLimited = false;

if (typeof window !== 'undefined') {
  window.addEventListener('audio-rate-limit', () => {
    audioLimited = true;
  });
}

/** True once the gateway has refused audio in this session. */
export function isAudioLimited(): boolean {
  return audioLimited;
}

/** Test seam. Production has no path back from a refusal. */
export function resetAudioLimitForTests(): void {
  audioLimited = false;
}

/** The provider check llm/index.ts runs, so instructions load only when used. */
async function usesOwnProvider(): Promise<boolean> {
  const config = loadServiceConfig();
  const kind = config.llm.kind ?? 'openrouter';
  if (kind === 'custom-openai') return Boolean(config.llm.baseURL?.trim());
  return keyStorage.hasUsableKey('openrouter');
}

/** Audio-queue names split on the first underscore, so the id carries none. */
let askCounter = 0;
function nextRequestId(): string {
  askCounter += 1;
  return `ask${Date.now()}${askCounter}`;
}

interface ActiveAsk {
  stopped: boolean;
  /** Drops the queue listener. The promise resolves before the voice does. */
  detach: () => void;
}

class StoryAskDriver implements AskDriver {
  private active: ActiveAsk | null = null;

  async ask(input: AskInput): Promise<void> {
    const {
      figureId,
      language,
      seedId,
      contextWindow,
      question,
      priorPairs,
      speak,
      signal,
      onText,
      onFirstToken,
      onVoiceEnd,
    } = input;

    const config = loadServiceConfig();
    const withVoice = speak && config.ttsEnabled !== false && !audioLimited;

    // A previous ask still speaking loses the queue: its chunks must not land
    // in this one's session.
    if (this.active) {
      this.active.stopped = true;
      this.active.detach();
    }

    const call: ActiveAsk = { stopped: false, detach: () => {} };
    this.active = call;

    const messages: Message[] = [];
    if (contextWindow.trim()) {
      messages.push({ role: 'assistant', content: contextWindow });
    }
    for (const pair of priorPairs) {
      if (pair.question.trim()) messages.push({ role: 'user', content: pair.question });
      if (pair.answer.trim()) messages.push({ role: 'assistant', content: pair.answer });
    }
    messages.push({ role: 'user', content: question });

    // Free-tier requests carry figure and mode instead of a system prompt, so
    // the instruction fetch happens only on the path that sends one.
    let instructions = '';
    if (await usesOwnProvider()) {
      const seedData = seedId
        ? useDomainStore.getState().seeds.byFigure[figureId]?.find(
            (seed) => String(seed.id) === String(seedId),
          ) ?? null
        : null;
      instructions = await fetchInstructions(
        figureId,
        INSTRUCTION_MODES.FREE_CONVERSATION,
        seedData,
        { aside: true, mode: INSTRUCTION_MODES.FREE_CONVERSATION },
      );
    }

    const requestId = nextRequestId();
    let firstTokenSent = false;
    let voiceEndSent = false;
    let streamDone = false;
    let sequence = 0;
    let inflight = 0;
    const pendingAudio = new Map<number, { url: string; name: string; speed?: number }>();
    let lastAddedIndex = 0;

    const finishVoice = (): void => {
      call.detach();
      if (voiceEndSent || call.stopped) return;
      voiceEndSent = true;
      onVoiceEnd();
    };

    // The queue drains between chunks while the stream still runs, so the end
    // of the voice is the drain that happens with nothing left to produce.
    const settleVoice = (): void => {
      if (!streamDone || inflight > 0 || pendingAudio.size > 0) return;
      const status = getAudioQueueStatus();
      if (status.isPlaying || status.queueLength > 0) return;
      finishVoice();
    };

    const onAudioEnd = (): void => settleVoice();

    if (withVoice) {
      cleanupAudioResources();
      setCurrentSession(requestId);
      ttsScheduler.setSession(requestId);
      window.addEventListener('audioEnd', onAudioEnd);
      call.detach = () => window.removeEventListener('audioEnd', onAudioEnd);
    }

    const streamingCallback = async (chunk: string): Promise<void> => {
      if (signal.aborted) return;

      const text = cleanTextForTts(chunk ?? '');
      if (!text.trim()) return;

      if (!firstTokenSent) {
        firstTokenSent = true;
        onFirstToken();
      }
      // Display copy: the model sometimes drops the space after a sentence
      // end ("Wahrheit.Später"), and chunks arrive trimmed, so the join needs
      // its space back. The voice path below keeps the chunk as it came.
      onText(text.replace(/([.!?])(?=\p{L})/gu, '$1 ') + ' ');

      if (!withVoice || call.stopped) return;

      sequence += 1;
      const currentSequence = sequence;
      const responseIndex = `${requestId}_${currentSequence}`;
      inflight += 1;

      try {
        const ttsProvider = async (
          jobText: string,
          _voice: string,
          speed: number,
          jobSignal?: AbortSignal,
        ): Promise<TTSResult> => {
          const sessionId = getOrRollConversationSessionId();
          const result = await convertTextToSpeech(
            jobText,
            responseIndex,
            figureId,
            config.tts,
            speed,
            language,
            sessionId,
            jobSignal,
          );
          if (result.sessionTtlSeconds !== undefined) {
            touchConversationSession(result.sessionTtlSeconds);
          }
          return result;
        };

        const audioFile = await ttsScheduler.enqueue(
          {
            id: responseIndex,
            text,
            voice: figureId,
            speed: 1.0,
            provider: config.localMode?.ttsEnabled ? 'local-tts' : 'self-hosted',
            sessionId: requestId,
            sequenceNumber: currentSequence,
          },
          ttsProvider,
        );

        if (call.stopped) {
          if (audioFile.url.startsWith('blob:')) URL.revokeObjectURL(audioFile.url);
          return;
        }

        pendingAudio.set(currentSequence, audioFile);

        while (pendingAudio.has(lastAddedIndex + 1)) {
          const nextFile = pendingAudio.get(lastAddedIndex + 1)!;
          addToAudioQueue(nextFile);
          pendingAudio.delete(lastAddedIndex + 1);
          lastAddedIndex += 1;
        }
      } catch (error) {
        // A voice error is not a state: the text stands and the sheet says so.
        if (!(error instanceof Error && error.message.includes('Cancelled'))) {
          console.warn('[AskDriver] Chunk did not reach the voice', error);
        }
      } finally {
        inflight -= 1;
      }
    };

    try {
      await generateResponse({
        messages,
        instructions,
        streamingCallback,
        language,
        signal,
        mode: INSTRUCTION_MODES.FREE_CONVERSATION,
        aside: true,
        turnKind: 'aside',
      });

      streamDone = true;

      if (withVoice) {
        ttsScheduler.flush();
        settleVoice();
      } else {
        finishVoice();
      }
    } catch (error) {
      streamDone = true;
      const aborted = signal.aborted || (error as Error)?.name === 'AbortError';
      // Words already on screen: the answer ends here, so the voice does too.
      // Nothing on screen is a failed ask, which the sheet offers to retry.
      if (!aborted && firstTokenSent) finishVoice();
      else call.detach();
      throw error;
    }
  }

  /** The stop-voice pill's order: cancel the jobs, then drop what is playing. */
  stopVoice(): void {
    if (this.active) {
      this.active.stopped = true;
      this.active.detach();
    }
    ttsScheduler.cancelAll();
    cleanupAudioResources();
  }
}

export const askDriver: AskDriver = new StoryAskDriver();

export default askDriver;
