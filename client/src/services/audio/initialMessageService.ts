/**
 * Initial Message Service
 *
 * Loads pre-created initial messages from Cloudflare R2.
 * Provides seamless fallback to LLM generation if message not found.
 *
 * Integration points:
 * - Uses mediaConfig.ts for URL generation (dev vs prod)
 * - Uses initialMessagePathBuilder.ts for path construction
 * - Integrates with existing audio playback system
 *
 * Created: October 16, 2025
 */

import { getMediaUrl } from '@/utils/mediaConfig';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import {
  initialMessagePathBuilder,
  type ConversationMode,
  type SupportedLanguage
} from './initialMessagePathBuilder';

/**
 * Initial Message metadata and content
 */
export interface InitialMessage {
  /**
   * Text content (lazy-loaded if needed for display)
   */
  text: string | null;

  /**
   * First audio URL — kept for backward compatibility with single-blob callers.
   * Equal to `audioUrls[0]` when the message rendered into multiple chunks.
   */
  audioUrl: string;

  /**
   * Full ordered list of audio URLs.
   * - Length 1 for pre-rendered R2 messages (single file) and short dynamic
   *   messages that fit under the gateway cap.
   * - Length 2+ when the dynamic path had to split text to stay under the
   *   gateway cap (DE 500 / EN 600 chars). The caller MUST enqueue all URLs
   *   in order so playback covers the full message.
   */
  audioUrls: string[];

  /**
   * Message metadata
   */
  metadata: {
    figure: string;
    mode: ConversationMode;
    seedId: number | null;
    language: SupportedLanguage;
  };

  /**
   * Audio availability flag
   */
  hasAudio: boolean;
}

// ============================================================
// Gateway cap-respecting splitter
// ============================================================
//
// Extracted 2026-05-02 to client/src/services/audio/utils/splitForGatewayCap.ts
// so live council segments (CustomCouncilService) can share the same logic
// when LLM turns exceed the per-language gateway cap.
//
// The Hetzner gateway returns 400 input_too_long above a per-language cap:
//   DE: 500 chars (Qwen3-TTS / F5)
//   EN: 600 chars (Kokoro)
// 42% of DE initial-message texts exceed the DE cap (p90 = 561, max = 718),
// causing custom-voice DE users to fall back to LLM-generated greetings on
// nearly half of their conversation starts.
//
// Local alias preserves the historical name in this module's body.
import { splitForGatewayCap as _splitForGatewayCap } from './utils/splitForGatewayCap';
const splitInitialMessageForGateway = (text: string, language: SupportedLanguage): string[] =>
  _splitForGatewayCap(text, language);

/**
 * Service for loading pre-created initial messages
 */
class InitialMessageService {
  /** In-memory cache for dynamically generated greeting audio (blob URLs). */
  private dynamicAudioCache = new Map<string, { urls: string[] }>();
  /**
   * Get initial message for a conversation
   *
   * Returns pre-created message if available, null otherwise.
   * Caller should fall back to LLM generation if null returned.
   *
   * @param figure - Figure ID (e.g., 'plato', 'laozi')
   * @param mode - Conversation mode
   * @param seedId - Seed ID (1-12) for wisdom/quest, null for freetalk
   * @param language - Language code (defaults to 'en')
   * @param includeText - Whether to fetch text content (defaults to true)
   * @returns Initial message or null if not available
   *
   * @example
   * const message = await initialMessageService.getInitialMessage(
   *   'plato',
   *   'wisdom',
   *   1,
   *   'en'
   * );
   *
   * if (message) {
   *   // Play pre-created message
   *   await playAudio(message.audioUrl);
   * } else {
   *   // Fall back to LLM generation
   *   await generateWithLLM();
   * }
   */
  async getInitialMessage(
    figure: string,
    mode: ConversationMode,
    seedId: number | null,
    language: SupportedLanguage = 'en',
    includeText: boolean = true
  ): Promise<InitialMessage | null> {
    // Check if initial message exists
    if (!initialMessagePathBuilder.hasInitialMessage(figure, mode, seedId)) {
      return null; // Fall back to LLM generation
    }

    // Get paths with language fallback
    const { path: audioPath, language: resolvedLanguage } = initialMessagePathBuilder.getPathWithFallback(
      figure,
      mode,
      seedId,
      language
    );

    const textPath = initialMessagePathBuilder.getTextPath(figure, mode, seedId, resolvedLanguage);

    // Convert to full URLs (dev: local, prod: Cloudflare)
    const audioUrl = getMediaUrl(audioPath);
    const textUrl = getMediaUrl(textPath);

    // Fetch text content if requested
    let text: string | null = null;
    if (includeText) {
      try {
        const response = await fetchWithTimeout(textUrl, { timeoutMs: 10_000 });
        if (response.ok) {
          text = await response.text();
          if (import.meta.env.DEV) {
            console.log('[InitialMessageService] ✅ Text content loaded', {
              length: text.length,
              preview: text.substring(0, 100) + '...'
            });
          }
        } else {
          console.warn('[InitialMessageService] Failed to fetch text content', {
            status: response.status,
            textUrl
          });
        }
      } catch (error) {
        console.warn('[InitialMessageService] Error fetching text content', error);
        // Continue without text - audio will still work
      }
    }

    return {
      text,
      audioUrl,
      audioUrls: [audioUrl],
      metadata: {
        figure,
        mode,
        seedId,
        language: resolvedLanguage
      },
      hasAudio: true
    };
  }

  /**
   * Check if initial message exists
   *
   * Used by conversation controller to decide:
   * - Use pre-created message → instant load
   * - Generate with LLM → 2-5s delay
   *
   * @param figure - Figure ID
   * @param mode - Conversation mode
   * @param seedId - Seed ID (null for freetalk)
   * @returns true if pre-created message available
   *
   * @example
   * if (initialMessageService.hasInitialMessage('plato', 'wisdom', 1)) {
   *   // Use pre-created message (fast path)
   * } else {
   *   // Generate with LLM (slow path)
   * }
   */
  hasInitialMessage(
    figure: string,
    mode: ConversationMode,
    seedId: number | null
  ): boolean {
    return initialMessagePathBuilder.hasInitialMessage(figure, mode, seedId);
  }

  /**
   * Load message text content (lazy load)
   *
   * Currently returns empty string (audio-first approach).
   * In future, could fetch .txt from Cloudflare or transcribe audio.
   *
   * @param message - Initial message
   * @returns Message text
   */
  /**
   * Preload initial message audio
   *
   * Can be called ahead of time to cache audio for faster playback.
   *
   * @param figure - Figure ID
   * @param mode - Conversation mode
   * @param seedId - Seed ID
   * @param language - Language code
   * @returns true if preload successful
   *
   * @example
   * // Preload when user selects figure/seed (before mode selection)
   * await initialMessageService.preloadAudio('plato', 'wisdom', 1, 'en');
   */
  async preloadAudio(
    figure: string,
    mode: ConversationMode,
    seedId: number | null,
    language: SupportedLanguage = 'en'
  ): Promise<boolean> {
    try {
      const message = await this.getInitialMessage(figure, mode, seedId, language);

      if (!message) {
        return false;
      }

      // Fetch audio to populate browser cache
      const response = await fetchWithTimeout(message.audioUrl, { timeoutMs: 15_000 });

      if (!response.ok) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('[InitialMessageService] Preload error', {
        figure,
        mode,
        seedId,
        error
      });
      return false;
    }
  }

  /**
   * Get initial message with dynamically generated audio (custom voice).
   * Fetches pre-created text from R2, then generates TTS with user's selected voice.
   * Results are cached in memory for same-session revisits.
   */
  async getInitialMessageWithDynamicAudio(
    figure: string,
    mode: ConversationMode,
    seedId: number | null,
    language: SupportedLanguage = 'en',
    speed: number = 1.0,
    requestId: string,
    sessionId?: string
  ): Promise<InitialMessage | null> {
    // Step 1: Get text content from R2
    const baseMessage = await this.getInitialMessage(figure, mode, seedId, language, true);
    if (!baseMessage?.text) return null;

    // Step 2: Resolve user's current voice for cache key
    const { getVoiceForNormalMode } = await import('./voices/voiceResolver');
    const voiceId = getVoiceForNormalMode(figure, 'kokoro', null, language);
    const cacheKey = `${figure}_${mode}_${seedId ?? 'null'}_${language}_${voiceId}`;

    // Step 3: Check cache
    const cached = this.dynamicAudioCache.get(cacheKey);
    if (cached) {
      if (import.meta.env.DEV) {
        console.log('[InitialMessageService] Cache hit for dynamic greeting audio', {
          cacheKey, chunks: cached.urls.length
        });
      }
      return {
        text: baseMessage.text,
        audioUrl: cached.urls[0],
        audioUrls: cached.urls,
        metadata: baseMessage.metadata,
        hasAudio: true
      };
    }

    // Step 4: Clean + split text to respect the gateway cap, then render each chunk.
    // 42% of DE initial-message texts exceed the 500-char DE cap and were silently
    // failing here before this fix (custom-voice DE users fell back to LLM-generated
    // greetings). EN texts are all under the 600-char EN cap so EN renders as 1 chunk.
    const { selfHostedTTS } = await import('./tts/selfHostedTTS');
    const { cleanTextForTts } = await import('../../utils/ttsTextCleaner');

    const cleanedText = cleanTextForTts(baseMessage.text);
    const textChunks = splitInitialMessageForGateway(cleanedText, language);

    if (import.meta.env.DEV && textChunks.length > 1) {
      console.log('[InitialMessageService] Splitting dynamic greeting for gateway cap', {
        language, totalChars: cleanedText.length,
        chunkSizes: textChunks.map(c => c.length)
      });
    }

    // Render chunks in parallel — gateway handles 2 concurrent fine and this matches
    // the latency of a single call for any text > cap. Order in result matches input.
    const audioFiles = await Promise.all(
      textChunks.map((chunkText, idx) =>
        selfHostedTTS(
          chunkText,
          `${requestId}_${idx + 1}`,
          figure,
          speed,
          undefined,
          undefined,
          language,
          sessionId,
        )
      )
    );

    const urls = audioFiles.map(af => af.url);

    // Step 5: Cache and return
    this.dynamicAudioCache.set(cacheKey, { urls });

    if (import.meta.env.DEV) {
      console.log('[InitialMessageService] Dynamic greeting audio generated', {
        cacheKey, voiceId, textLength: cleanedText.length, chunks: urls.length
      });
    }

    return {
      text: baseMessage.text,
      audioUrl: urls[0],
      audioUrls: urls,
      metadata: baseMessage.metadata,
      hasAudio: true
    };
  }
}

// Singleton export
export const initialMessageService = new InitialMessageService();

// Default export for convenience
export default initialMessageService;
