import { useDomainStore } from '../stores';
import type { ConversationMessage } from '../stores/slices/domainTypes';
import type { StreamConversationParams } from './conversationController';
import { loadServiceConfig, LLM_SERVICES, type ServiceConfig } from '../services/audio/config/serviceConfig';
import { fetchInstructions } from '../services/audio/instructionProcessor';
import { getStoredStoryContent, getStoredPrismContent } from '../utils/storageKeysV2';
import prismService from '../services/prism/PrismService';
import { generateResponse } from '../services/audio/llm';
import { convertTextToSpeech } from '../services/audio/tts';
import { getOrRollConversationSessionId, touchConversationSession } from '../services/audio/tts/ttsSessions';
import { TTSScheduler } from '../services/audio/ttsScheduler';
import type { TTSResult } from '../services/audio/ttsScheduler';
import { addToAudioQueue, setCurrentSession, cleanupAudioResources, getBufferDurationSeconds } from '../services/audio/audioQueueManager';
import { ConversationMode, type Message, type Seed } from '../types/global';
import { initialMessageService } from '../services/audio/initialMessageService';
import { isUsingDefaultVoice } from '../services/audio/voices/voiceResolver';
import type { ConversationMode as InitialMessageMode } from '../services/audio/initialMessagePathBuilder';
import { cleanTextForTts } from '../utils/ttsTextCleaner';
import { QUEST_TOOLS, type AwardSeedArgs } from '../services/llm/questTools';
import { markSeedAsGathered } from '../services/seedAcquisition/SeedAcquisitionManager';
import { setPendingQuestVerdict } from '../utils/questVerdict';

const DEFAULT_LANGUAGE = 'english';

const verifyModelConfig = (config: ServiceConfig): ServiceConfig => {
  // Ensure LLM config has a valid provider and model.
  // For Local Mode (custom-openai), the model is whatever the user typed in
  // settings — leave it alone, even if empty, so the local server's default
  // resolves naturally.
  if (!config.llm || !config.llm.provider) {
    config.llm = {
      provider: LLM_SERVICES.OPENROUTER.name,
      model: LLM_SERVICES.OPENROUTER.models.QWEN3_235B,
      kind: 'openrouter',
    };
  }
  const kind = config.llm.kind ?? 'openrouter';
  if (!config.llm.model && kind === 'openrouter') {
    config.llm.model = LLM_SERVICES.OPENROUTER.models.QWEN3_235B;
  }
  return config;
};

const normalizeSeedId = (seedId: string | number | null | undefined): string | null => {
  if (seedId === null || seedId === undefined) {
    return null;
  }
  return seedId.toString();
};

const normalizeMessages = (messages: ConversationMessage[]): Message[] =>
  messages
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));

/**
 * Get prism context for a seed — tries manifest cache first, then stored content
 */
const getPrismContextForSeed = (figureId: string, seedId: string, language: string): string | null => {
  // Try manifest cache first (available if user loaded prism during session)
  let lang = language.toLowerCase();
  if (!['en', 'de'].includes(lang)) lang = 'en';

  const cached = prismService.getCachedManifest(figureId, Number(seedId), lang);
  if (cached) {
    const text = prismService.formatManifestAsContext(cached);
    if (text) return `[Multi-Perspective Dialogue]\n\n${text}`;
  }

  // Fallback to stored content (available if user completed prism before)
  const stored = getStoredPrismContent(figureId, seedId);
  if (stored?.content) {
    return `[Multi-Perspective Dialogue]\n\n${stored.content}`;
  }

  return null;
};

let streamingResponseCounter = 0;
let currentStreamSession = ''; // Guards against stale TTS writing to wrong session

// Pending audio queue to ensure sequential playback order
// Maps sequence number to audio file for out-of-order TTS completions
let pendingAudio = new Map<number, { url: string; name: string; speed?: number }>();
let lastAddedIndex = 0;

// ✅ TTS Scheduler with buffer-aware concurrency (BBA model)
// Throttles TTS requests based on audio buffer level to maximize server capacity
// URGENT (<2s buffer): concurrency 2 | NORMAL (2-10s): 1 | COMFORTABLE (>10s): 0
const ttsScheduler = new TTSScheduler(2);
ttsScheduler.setBufferProvider(getBufferDurationSeconds);

/**
 * Exported so UI layers (e.g. ProcessingLoader's opt-out button) can cancel
 * pending TTS jobs when the user chooses to read instead of listen.
 */
export { ttsScheduler };

const createAbortError = () => {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Streaming aborted', 'AbortError');
  }

  const error = new Error('Streaming aborted');
  error.name = 'AbortError';
  return error;
};

/**
 * Map ConversationMode to InitialMessageMode
 */
const toInitialMessageMode = (mode: ConversationMode | string): InitialMessageMode | null => {
  switch (mode) {
    case ConversationMode.SEED_CONVERSATION:
    case 'seed_conversation':
      return 'wisdom';
    case ConversationMode.FREE_CONVERSATION:
    case 'free_conversation':
      return 'freetalk';
    case ConversationMode.CHALLENGE:
    case 'challenge':
      return 'quest';
    default:
      return null;
  }
};

/**
 * Check if this is the first message (initial conversation start)
 * First message is: messages array is empty (no user or assistant messages yet)
 */
const isFirstMessage = (messages: ConversationMessage[]): boolean => {
  // Simple check: if we have no messages at all, it's the first message
  // Pre-created messages load when conversation is starting (messages.length === 0)
  return messages.length === 0;
};

export const createLegacyConversationStream = () => {
  const streamConversation = async ({
    messages,
    signal,
    pushAssistantText,
    requestId,
  }: StreamConversationParams): Promise<void> => {
    if (import.meta.env.DEV) {
      console.log('[Mode2Triage][StreamDriver] invoked', {
        msgCount: messages?.length ?? 0,
        requestId,
      });
    }
    if (signal.aborted) {
      if (import.meta.env.DEV) {
        console.warn('[Mode2Triage][StreamDriver] early abort');
      }
      return;
    }

    const storeState = useDomainStore.getState();
    const figureId = storeState.figures.selectedId;
    const mode = storeState.mode.selected;
    const selectedSeedId = normalizeSeedId(storeState.seeds.selectedId);

    if (!figureId || !mode) {
      if (import.meta.env.DEV) {
        console.warn('[Mode2Triage][StreamDriver] missing selection', { figureId, mode });
      }
      return;
    }

    const seedList = storeState.seeds.byFigure?.[figureId] ?? [];
    const activeSeed: Seed | null = seedList.find((seed) => normalizeSeedId(seed.id) === selectedSeedId) ?? null;
    const config = verifyModelConfig(loadServiceConfig());

    const languagePreference =
      storeState.language.current ??
      DEFAULT_LANGUAGE;

    // 🎯 CRITICAL: Check for initial message FIRST (before checking for user message)
    // If this is the first message AND we have a pre-created message, we don't need a user prompt
    const isInitial = isFirstMessage(messages);

    if (!isInitial) {
      // Not first message - ensure we have a trailing user message
      const latestMessage = messages[messages.length - 1];
      if (!latestMessage || latestMessage.role !== 'user') {
        if (import.meta.env.DEV) {
          console.warn('[Mode2Triage][StreamDriver] no trailing user message', {
            messagesTail: latestMessage ? { role: latestMessage.role, len: (latestMessage.content || '').length } : null,
          });
        }
        return;
      }
    }

    const instructionPayload = await fetchInstructions(figureId, mode, activeSeed ?? undefined);

    cleanupAudioResources();
    setCurrentSession(String(requestId));

    // ✅ Set TTS scheduler session (cancels previous session's jobs)
    ttsScheduler.setSession(String(requestId));

    // Reset audio sequencing state for this conversation
    currentStreamSession = String(requestId);
    streamingResponseCounter = 0;
    // Revoke orphaned blob URLs before clearing
    for (const [, file] of pendingAudio) {
      if (file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url);
      }
    }
    pendingAudio.clear();
    lastAddedIndex = 0;

    // Define streaming callback for LLM responses
    const streamingCallback = async (chunk: string) => {
      if (signal.aborted) {
        throw createAbortError();
      }

      const trimmed = cleanTextForTts(chunk ?? '');
      if (!trimmed.trim()) {
        if (import.meta.env.DEV) {
          console.log('[StreamDriver] Skipping empty chunk');
        }
        return;
      }

      // First LLM chunk for this request → switch the loader's quote pool to 'contemplating'.
      if (streamingResponseCounter === 0) {
        useDomainStore.getState().setProcessingStage('contemplating');
      }

      if (import.meta.env.DEV) {
        console.log(`[StreamDriver] Processing chunk #${streamingResponseCounter + 1}: "${trimmed.substring(0, 50)}..."`);
      }

      try {
        pushAssistantText(trimmed);
      } catch (error) {
        console.error('[ConversationStreamDriver] Failed to apply assistant chunk', error);
      }

      if (config.ttsEnabled === false) {
        return;
      }

      streamingResponseCounter += 1;
      // Second chunk onward lives in 'shaping' — first TTS job has been queued,
      // audio production is underway. The user is now waiting for the voice specifically.
      if (streamingResponseCounter === 1) {
        useDomainStore.getState().setProcessingStage('shaping');
      }

      try {
        if (streamingResponseCounter === 1) {
          setCurrentSession(String(requestId));
        }

        const currentSequence = streamingResponseCounter;
        const responseIndex = `${requestId}_${currentSequence}`;

        // ✅ Use TTS Scheduler for bounded concurrency (max 2 concurrent requests)
        // This prevents memory bloat when LLM generates text faster than TTS can synthesize
        // `signal` comes from the scheduler's per-job AbortController (LT-12) so that
        // cancelAll() truly aborts in-flight HTTP requests mid-inference.
        const ttsProvider = async (text: string, _voice: string, speed: number, signal?: AbortSignal): Promise<TTSResult> => {
          const sessionId = getOrRollConversationSessionId();
          const result = await convertTextToSpeech(
            text,
            responseIndex,
            figureId,
            config.tts,
            speed,
            languagePreference,
            sessionId,
            signal,
          );
          if (result.sessionTtlSeconds !== undefined) {
            touchConversationSession(result.sessionTtlSeconds);
          }
          return result;
        };

        // Enqueue TTS job with bounded concurrency.
        // speed: 1.0 (always) — gateway renders at native pace, client applies
        // per-backend × user-slider multiplier via audioEl.playbackRate. See
        // TTS-2c. F5 still renders at its 0.85 server-side default; client adds
        // user-slider only on top of that.
        const audioFile = await ttsScheduler.enqueue(
          {
            id: responseIndex,
            text: trimmed,
            voice: figureId, // Use figure as voice
            speed: 1.0,
            provider: config.localMode?.ttsEnabled ? 'local-tts' : 'self-hosted',
            sessionId: String(requestId),
            sequenceNumber: currentSequence
          },
          ttsProvider,
        );

        // Guard: reject stale TTS results from previous sessions
        if (currentStreamSession !== String(requestId)) {
          if (audioFile.url.startsWith('blob:')) URL.revokeObjectURL(audioFile.url);
          return;
        }

        pendingAudio.set(currentSequence, audioFile);

        // Add audio files to queue in sequence order
        while (pendingAudio.has(lastAddedIndex + 1)) {
          const nextFile = pendingAudio.get(lastAddedIndex + 1)!;
          addToAudioQueue(nextFile);
          pendingAudio.delete(lastAddedIndex + 1);
          lastAddedIndex++;
        }
      } catch (error) {
        // Silently skip cancelled jobs
        if (error instanceof Error && error.message.includes('Cancelled')) {
          if (import.meta.env.DEV) {
            console.log('[ConversationStreamDriver] TTS job cancelled');
          }
          return;
        }

        console.error('[ConversationStreamDriver] Failed to convert chunk to speech', error);
      }
    };

    // 🎯 CRITICAL FIX: Check for initial message FIRST (before building payload)
    // If this is an initial message with pre-created content, handle it and return early
    // This prevents the "empty payload" exit bug for challenge/freetalk modes

    if (isInitial) {
      const initialMsgMode = toInitialMessageMode(mode);
      const seedId = activeSeed?.id ? Number(activeSeed.id) : null;

      // Normalize language preference to 2-letter code
      // languagePreference might be "english", "en", "german", "de", etc.
      let langCode: 'en' | 'de' = 'en'; // Default to English
      const langLower = languagePreference?.toLowerCase() || 'english';

      if (langLower.startsWith('de') || langLower === 'german') {
        langCode = 'de';
      } else if (langLower.startsWith('en') || langLower === 'english') {
        langCode = 'en';
      }

      if (import.meta.env.DEV) {
        console.log('[StreamDriver] Language detection for initial message', {
          languagePreference,
          resolvedCode: langCode
        });
      }

      if (initialMsgMode && initialMessageService.hasInitialMessage(figureId, initialMsgMode, seedId)) {
        const usingDefaultVoice = isUsingDefaultVoice(figureId, langCode);

        if (import.meta.env.DEV) {
          console.log('[StreamDriver] Initial message available', {
            figure: figureId,
            mode: initialMsgMode,
            seedId,
            language: langCode,
            usingDefaultVoice
          });
        }

        try {
          let initialMessage: { text: string | null; audioUrl: string; audioUrls: string[]; hasAudio: boolean } | null = null;

          if (usingDefaultVoice) {
            // Default voice: use pre-created audio from R2 (instant)
            initialMessage = await initialMessageService.getInitialMessage(
              figureId, initialMsgMode, seedId, langCode
            );
          } else if (config.ttsEnabled !== false) {
            // Custom voice + TTS enabled: generate with user's selected voice.
            // Use the same session-id as the subsequent conversation turns so the
            // greeting and the first response route to the same backend → same voice timbre.
            // speed: 1.0 always (TTS-2c) — server renders at native pace, client applies
            // user-slider × backend-multiplier via playbackRate. Side benefit: the
            // dynamicAudioCache key becomes slider-independent (cached blob is always
            // 1.0-baked, slider changes apply via playbackRate without re-render).
            const sessionId = getOrRollConversationSessionId();
            initialMessage = await initialMessageService.getInitialMessageWithDynamicAudio(
              figureId, initialMsgMode, seedId, langCode,
              1.0,
              String(requestId),
              sessionId
            );
          } else {
            // Custom voice + TTS disabled: text only (avoid wrong-voice playback)
            const textOnly = await initialMessageService.getInitialMessage(
              figureId, initialMsgMode, seedId, langCode
            );
            if (textOnly?.text && !signal.aborted) {
              pushAssistantText(textOnly.text);
              return;
            }
          }

          if (initialMessage && !signal.aborted) {
            const urls = initialMessage.audioUrls.length > 0
              ? initialMessage.audioUrls
              : [initialMessage.audioUrl];

            if (import.meta.env.DEV) {
              console.log('[StreamDriver] Queuing initial message audio', {
                isDynamic: urls[0].startsWith('blob:'),
                chunks: urls.length,
                sessionId: requestId,
                mode: initialMsgMode,
                seedId
              });
            }

            urls.forEach((url, idx) => {
              addToAudioQueue({
                url,
                name: `${requestId}_${idx + 1}`,
                speed: config.ttsSettings?.speed ?? 1.0
              });
            });

            const messageText = initialMessage.text || '\ud83c\udfa4 [Initial message playing - audio only]';
            pushAssistantText(messageText);

            return;
          }
        } catch (error) {
          console.warn('[StreamDriver] Failed to load initial message, falling back to LLM', error);
          // Fall through to LLM generation
        }
      } else if (import.meta.env.DEV) {
        console.log('[StreamDriver] No pre-created message available, using LLM', {
          figure: figureId,
          mode: initialMsgMode,
          seedId
        });
      }
    }

    // Standard LLM path (fallback or non-initial message)
    // Build payload for LLM call from story content + prism context + conversation history
    const storyContent =
      mode === ConversationMode.SEED_CONVERSATION && selectedSeedId
        ? getStoredStoryContent(figureId, selectedSeedId)
        : null;

    // Prism context — loaded from PrismService manifest cache or stored content
    const prismContext =
      (mode === ConversationMode.SEED_CONVERSATION || mode === ConversationMode.CHALLENGE) && selectedSeedId
        ? getPrismContextForSeed(figureId, selectedSeedId, languagePreference)
        : null;

    const conversationHistory = normalizeMessages(messages);

    // Only check for user message if NOT first message
    // Initial messages don't need a user prompt
    if (!isInitial && !conversationHistory.some((message) => message.role === 'user')) {
      if (import.meta.env.DEV) {
        console.warn('[Mode2Triage][StreamDriver] history missing user role after normalization');
      }
      return;
    }

    const payload: Message[] = [];

    if (storyContent?.content) {
      payload.push({ role: 'assistant', content: storyContent.content });
    }

    if (prismContext) {
      payload.push({ role: 'assistant', content: prismContext });
    }

    payload.push(...conversationHistory);

    if (payload.length === 0) {
      if (import.meta.env.DEV) {
        console.warn('[StreamDriver] Empty payload for LLM path - this should not happen', {
          isInitial,
          mode,
          hasStoryContent: !!storyContent,
          conversationHistoryLen: conversationHistory.length
        });
      }
      return;
    }

    // Wire tools for challenge mode — LLM calls award_seed to pass/fail
    const isChallenge = mode === ConversationMode.CHALLENGE;
    const questTools = isChallenge ? QUEST_TOOLS : undefined;
    // Track whether the model called award_seed during this stream so we can
    // detect "model ended conversation without firing the tool" and synthesize
    // a not-earned verdict on its behalf (defense in depth — the prompt rule
    // always-call-award-seed should make this unnecessary, but Qwen3 235B
    // occasionally drifts on tool calls, especially when the user disengages).
    let awardSeedFired = false;
    const questToolHandler = isChallenge && figureId && selectedSeedId
      ? (toolCall: { name: string; arguments: string; id?: string }) => {
          if (toolCall.name === 'award_seed') {
            awardSeedFired = true;
            try {
              const args: AwardSeedArgs = JSON.parse(toolCall.arguments);
              if (import.meta.env.DEV) {
                console.log('[StreamDriver] award_seed tool call:', args);
              }
              if (args.passed && selectedSeedId) {
                markSeedAsGathered(figureId, selectedSeedId);
              } else if (selectedSeedId) {
                // Not earned (ALMOST or NOT_YET): set pending verdict marker so the
                // homepage PostQuestVerdictCard surfaces with restart + deepen-Wisdom CTAs.
                // Mirrors the bloom-event pattern but for non-earned outcomes.
                setPendingQuestVerdict({ figureId, seedId: String(selectedSeedId) });
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('questVerdictDelivered', {
                      detail: { figureId, seedId: String(selectedSeedId), passed: false },
                    }),
                  );
                }
              }
            } catch (e) {
              console.error('[StreamDriver] Failed to parse award_seed args:', e);
            }
          }
        }
      : undefined;

    if (import.meta.env.DEV) {
      console.log('[Mode2Triage][StreamDriver] calling generateResponse', {
        provider: config.llm.provider,
        model: config.llm.model,
        language: languagePreference,
        payloadLen: payload.length,
        isInitialMessage: isInitial,
        hasTools: !!questTools
      });
    }
    await generateResponse({
      messages: payload,
      instructions: instructionPayload,
      model: config.llm.model,
      streamingCallback,
      language: languagePreference,
      tools: questTools,
      onToolCall: questToolHandler,
      signal,
    });

    // Stream complete — flush any remaining TTS jobs immediately
    // No more chunks coming, dispatch regardless of buffer level
    ttsScheduler.flush();

    // Defensive fallback: Quest mode that finished WITHOUT firing award_seed
    // AND the last figure message looks like a verdict / termination (no question mark).
    //
    // Per the prompt rules, question and probe turns ALWAYS have exactly one '?',
    // and verdict turns have ZERO. So a Quest figure response with no question
    // mark and no tool call = the model thinks the conversation is done but
    // skipped the tool. Synthesize a not-earned verdict so the user gets the card.
    //
    // Why we check the question mark and not just turn count: the LLM stream
    // completes after EVERY figure response, including Q1, Q2, Q3 question turns.
    // Without the question-mark guard the fallback fires after the user's first
    // answer because award_seed hasn't fired yet for Q1 / Q2 / Q3 either.
    if (isChallenge && !awardSeedFired && figureId && selectedSeedId) {
      const liveMessages = useDomainStore.getState().conversation.messages;
      const userTurnsInThread = liveMessages.filter((m) => m?.role === 'user').length;
      const lastAssistantText = ([...liveMessages].reverse().find(
        (m) => m?.role === 'assistant',
      )?.content || '').trim();
      const lastHasQuestionMark = /\?/.test(lastAssistantText);
      const looksLikeVerdict =
        !lastHasQuestionMark && lastAssistantText.length > 80;

      if (userTurnsInThread >= 2 && looksLikeVerdict) {
        if (import.meta.env.DEV) {
          console.warn('[StreamDriver] Quest stream ended without award_seed AND last reply looks like a verdict — synthesizing not-earned', {
            figureId,
            seedId: selectedSeedId,
            userTurns: userTurnsInThread,
            lastReplyPreview: lastAssistantText.slice(0, 120),
          });
        }
        setPendingQuestVerdict({ figureId, seedId: String(selectedSeedId) });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('questVerdictDelivered', {
              detail: { figureId, seedId: String(selectedSeedId), passed: false, synthesized: true },
            }),
          );
        }
      }
    }

    if (import.meta.env.DEV) {
      console.log('[Mode2Triage][StreamDriver] generateResponse completed, TTS flushed');
    }
  };

  return streamConversation;
};

export type LegacyConversationStream = ReturnType<typeof createLegacyConversationStream>;
