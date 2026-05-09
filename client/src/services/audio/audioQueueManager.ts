// src/services/audio/audioQueueManager.ts
// Production-Grade: Queue caps + promise barrier integration

import { loadServiceConfig } from './config/serviceConfig';

// ============================================
// Type Definitions
// ============================================

// Global AudioContext reference (injected by useAutoplayGate hook)
let globalAudioContext: AudioContext | null = null;

// Async barrier function (injected by useAutoplayGate hook)
let waitUntilReadyFn: (() => Promise<void>) | null = null;

// Idle suspension timer — suspend AudioContext after 30s of inactivity to save battery
let idleSuspendTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_SUSPEND_MS = 30_000;

// Inter-chunk pause for live TTS (blob URLs only).
// 200ms matches the validated server-side F5 stitching recipe ("trim+stitch
// + 200ms silence" — 54-clip sweep, 2026-04-17). The DE gateway already pads
// 200ms between F5 sub-chunks within one response; using the same value at
// the client-side chunk boundary keeps breath pacing consistent across the
// whole live conversation. Without any gap, Kokoro/Qwen3 tails sound clipped
// because HTML5 <audio> 'ended' fires at currentTime>=duration and duration
// can underreport actual audio by 30-50ms (encoder padding). Pre-rendered R2
// audio is not affected (no chunk transitions, single file).
let interChunkTimer: ReturnType<typeof setTimeout> | null = null;
const INTER_CHUNK_GAP_MS = 200;

// Primed HTMLAudioElement reference (injected by useAutoplayGate hook)
// CRITICAL: iOS Safari requires reusing the SAME element that was primed during unlock
let primedAudioElement: HTMLAudioElement | null = null;

export interface AudioFile {
  name: string;
  url: string;
  speed?: number;
  estimatedDuration?: number; // seconds, for buffer-aware scheduling
  /**
   * Engine that the gateway routed this chunk to (`kokoro` / `qwen-tts` /
   * `f5-tts`). Read from the X-TTS-Backend response header in selfHostedTTS.
   * Used by playNextInQueue to apply per-backend client-side `playbackRate`
   * (browser-native time-stretch, no GPU cost — see TTS-2c in
   * POST-RELEASE-ROADMAP.md). Undefined for pre-rendered R2 audio.
   */
  backend?: string;
}

export interface QueueState {
  audioQueue: AudioFile[];
  isPlaying: boolean;
  currentSessionId: string | null;
  activeTranslation: boolean;
}

export interface AudioQueueStatus {
  isPlaying: boolean;
  queueLength: number;
  hasActiveQueue: boolean;
  currentSessionId: string | null;
  isTranslationActive: boolean;
}

export interface AudioQueueOptions {
  maxItems?: number;    // Max items in queue (default: 100)
  maxBytes?: number;    // Max total bytes in queue (default: 64MB)
}

// ============================================
// Global State
// ============================================

let audioQueue: AudioFile[] = [];
let isPlaying = false;
let isEnqueuing = false; // Guard flag to prevent race conditions
let currentSessionId: string | null = null;
let activeTranslation = false;
let audioEl: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null; // Track current audio for cleanup

// Queue size limits (memory safety)
let maxQueueItems = 100;
let maxQueueBytes = 64 * 1024 * 1024; // 64MB
let currentQueueBytes = 0; // Track current queue size in bytes

// Detect duplicate module instances in DEV
if (import.meta.env.DEV && typeof window !== 'undefined') {
  const w = window as any;
  w.__audioQueueInstanceSeq = (w.__audioQueueInstanceSeq || 0) + 1;
  w.__audioQueueInstanceId = w.__audioQueueInstanceSeq;
  console.log('[AudioQueue] module instance', w.__audioQueueInstanceId);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Initialize audio queue with AudioContext, promise barrier, and primed element from useAutoplayGate hook
 * Should be called from app initialization after first user gesture
 *
 * CRITICAL: iOS Safari requires reusing the SAME HTMLAudioElement that was primed during unlock!
 * Creating new elements will fail with NotAllowedError even after unlock.
 *
 * @param ctx - AudioContext from useAutoplayGate hook
 * @param waitFn - Async barrier function from useAutoplayGate hook
 * @param primedElement - The primed HTMLAudioElement from useAutoplayGate hook
 * @param options - Queue size limits (optional)
 */
export const initAudioQueue = (
  ctx: AudioContext,
  waitFn: () => Promise<void>,
  primedElement: HTMLAudioElement,
  options?: AudioQueueOptions
): void => {
  globalAudioContext = ctx;
  waitUntilReadyFn = waitFn;
  primedAudioElement = primedElement;  // Store primed element for reuse

  // Apply queue size limits if provided
  if (options?.maxItems) {
    maxQueueItems = options.maxItems;
  }
  if (options?.maxBytes) {
    maxQueueBytes = options.maxBytes;
  }

  if (import.meta.env.DEV) {
    console.log('[AudioQueue] Initialized with production-grade config:', {
      state: ctx.state,
      sampleRate: ctx.sampleRate,
      maxItems: maxQueueItems,
      maxBytes: (maxQueueBytes / (1024 * 1024)).toFixed(1) + 'MB',
      hasBarrier: !!waitFn,
      hasPrimedElement: !!primedElement  // CRITICAL for iOS!
    });
  }
};

/**
 * Get the global AudioContext if available
 * @returns AudioContext or null
 */
export const getAudioContext = (): AudioContext | null => {
  return globalAudioContext;
};

/**
 * Extract session ID from filename consistently
 * Format: {sessionId}_{index}.ext or fallback to currentSessionId
 * @param filename - Audio filename to parse
 * @returns Extracted session ID or current session ID
 */
const extractSessionId = (filename: string): string | null => {
  const underscoreIndex = filename.indexOf('_');
  const hasPrefix = underscoreIndex > 0;
  return hasPrefix ? filename.slice(0, underscoreIndex) : currentSessionId;
};

/**
 * Safely revoke a blob URL with error handling
 * @param url - Blob URL to revoke
 */
const safeRevokeUrl = (url: string): void => {
  try {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      if (import.meta.env.DEV) {
        console.log('[AudioQueue] Revoked blob URL:', url.substring(0, 50) + '...');
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[AudioQueue] Failed to revoke URL:', error);
    }
  }
};

/**
 * Estimate size of audio file in bytes
 * For blob URLs, we estimate based on typical MP3 compression
 * @param audioFile - Audio file to estimate
 * @returns Estimated size in bytes
 */
const estimateAudioSize = (_audioFile: AudioFile): number => {
  // Rough estimate: MP3 @ 128kbps = ~16KB per second
  // Assuming average chunk is ~5 seconds of audio
  // This is conservative - actual size varies
  return 80 * 1024; // 80KB estimate per chunk
};

/**
 * Enforce queue size caps (memory safety)
 * Drops oldest items if queue exceeds limits
 */
const enforceQueueCaps = (): void => {
  // Check item count limit
  while (audioQueue.length >= maxQueueItems) {
    const dropped = audioQueue.shift();
    if (dropped) {
      safeRevokeUrl(dropped.url);
      currentQueueBytes -= estimateAudioSize(dropped);
      if (import.meta.env.DEV) {
        console.warn('[AudioQueue] Dropped oldest item (max items reached):', {
          name: dropped.name,
          queueLength: audioQueue.length,
          limit: maxQueueItems
        });
      }
    }
  }

  // Check byte size limit
  while (currentQueueBytes > maxQueueBytes && audioQueue.length > 0) {
    const dropped = audioQueue.shift();
    if (dropped) {
      safeRevokeUrl(dropped.url);
      currentQueueBytes -= estimateAudioSize(dropped);
      if (import.meta.env.DEV) {
        console.warn('[AudioQueue] Dropped oldest item (max bytes reached):', {
          name: dropped.name,
          currentBytes: (currentQueueBytes / (1024 * 1024)).toFixed(1) + 'MB',
          limit: (maxQueueBytes / (1024 * 1024)).toFixed(1) + 'MB'
        });
      }
    }
  }
};

// ============================================
// Audio Queue Manager
// Handles sequential playback of audio chunks with session management
// ============================================

export const getQueueState = (): QueueState => ({
  audioQueue,
  isPlaying,
  currentSessionId,
  activeTranslation
});

export const setCurrentSession = (sessionId: string | null, isTranslation = false): void => {
  currentSessionId = sessionId;
  activeTranslation = isTranslation;
  if (import.meta.env.DEV) {
    console.log('[AudioQueue] setCurrentSession', { sessionId, isTranslation });
  }
};

export const addToAudioQueue = (audioFile: AudioFile): void => {
  // Validate audio file
  if (!audioFile || !audioFile.name || !audioFile.url) {
    console.error('[AudioQueue] Invalid audio file provided:', audioFile);
    return;
  }

  // Extract session ID consistently
  const fileSessionId = extractSessionId(audioFile.name);

  // If a current session is set and the file declares a different session, discard.
  if (currentSessionId && fileSessionId && fileSessionId !== currentSessionId) {
    if (import.meta.env.DEV) {
      console.warn('[AudioQueue] Discarding audio from different session:', {
        fileName: audioFile.name,
        fileSessionId,
        currentSessionId,
      });
    }
    safeRevokeUrl(audioFile.url);
    return;
  }

  // Enforce queue size caps BEFORE adding (memory safety)
  enforceQueueCaps();

  // Estimate and track size
  const estimatedSize = estimateAudioSize(audioFile);
  currentQueueBytes += estimatedSize;

  if (import.meta.env.DEV) {
    console.log('[AudioQueue] enqueue', {
      name: audioFile.name,
      fileSessionId,
      currentSessionId,
      isPlaying,
      isEnqueuing,
      queued: audioQueue.length,
      queueBytes: (currentQueueBytes / (1024 * 1024)).toFixed(1) + 'MB'
    });
  }

  audioQueue.push(audioFile);

  // Start playback only if not already playing or enqueuing (prevents race condition)
  if (!isPlaying && !isEnqueuing) {
    isEnqueuing = true;
    playNextInQueue().finally(() => {
      isEnqueuing = false;
    });
  }
};

const playNextInQueue = async (): Promise<void> => {
  if (audioQueue.length === 0) {
    isPlaying = false;

    // Clean up current audio URL if exists
    if (currentAudioUrl) {
      safeRevokeUrl(currentAudioUrl);
      currentAudioUrl = null;
    }

    // Reset queue size tracking
    currentQueueBytes = 0;

    // If we've finished playing a translation, mark translation as inactive
    if (activeTranslation) {
      activeTranslation = false;
    }

    // Schedule AudioContext suspension after idle period to save battery
    if (globalAudioContext && globalAudioContext.state === 'running') {
      if (idleSuspendTimer) clearTimeout(idleSuspendTimer);
      idleSuspendTimer = setTimeout(() => {
        if (globalAudioContext && globalAudioContext.state === 'running' && !isPlaying) {
          if (import.meta.env.DEV) {
            console.log('[AudioQueue] Suspending AudioContext after idle timeout');
          }
          globalAudioContext.suspend().catch(() => {});
        }
      }, IDLE_SUSPEND_MS);
    }

    window.dispatchEvent(new CustomEvent('audioEnd'));
    return;
  }

  // Cancel idle suspension — we're about to play audio
  if (idleSuspendTimer) {
    clearTimeout(idleSuspendTimer);
    idleSuspendTimer = null;
  }

  if (!isPlaying) {
    isPlaying = true;
    if (import.meta.env.DEV) {
      console.log('[AudioQueue] start playing');
    }
    window.dispatchEvent(new CustomEvent('audioStart'));
  }

  const audioFile = audioQueue.shift();
  if (!audioFile) return;

  // Update queue size tracking
  currentQueueBytes -= estimateAudioSize(audioFile);
  if (currentQueueBytes < 0) currentQueueBytes = 0;

  if (import.meta.env.DEV) {
    console.log('[AudioQueue] play', {
      name: audioFile.name,
      queueRemaining: audioQueue.length,
      queueBytes: (currentQueueBytes / (1024 * 1024)).toFixed(1) + 'MB'
    });
  }

  // Try to resume AudioContext before waiting on gate barrier
  // After initial unlock, ctx.resume() works without user gesture
  // This triggers onstatechange (suspended→running) which auto-resolves the barrier
  if (globalAudioContext && globalAudioContext.state === 'suspended') {
    if (import.meta.env.DEV) {
      console.log('[AudioQueue] Context suspended - attempting resume before gate wait');
    }
    try {
      await globalAudioContext.resume();
      if (import.meta.env.DEV) {
        console.log('[AudioQueue] Context resumed successfully, gate should auto-unlock');
      }
    } catch {
      // Initial load: may fail without user gesture, fall through to gate barrier
      if (import.meta.env.DEV) {
        console.warn('[AudioQueue] Context resume failed (may need user gesture)');
      }
    }
  }

  // ✅ CRITICAL: Await promise barrier before playback
  // This ensures audio gate is unlocked (especially after backgrounding)
  if (waitUntilReadyFn) {
    try {
      await waitUntilReadyFn();
      if (import.meta.env.DEV) {
        console.log('[AudioQueue] Promise barrier cleared - proceeding with playback');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[AudioQueue] Promise barrier wait failed:', error);
      }
      // Continue anyway - best effort
    }
  }

  // Check if TTS is disabled in settings
  const config = loadServiceConfig();
  if (config.ttsEnabled === false) {
    if (import.meta.env.DEV) {
      console.warn('[AudioQueue] TTS disabled - draining entire queue');
    }
    // Clean up current file
    safeRevokeUrl(audioFile.url);

    // Drain entire queue immediately and clean up all blob URLs
    audioQueue.forEach(file => safeRevokeUrl(file.url));
    audioQueue = [];
    isPlaying = false;

    if (activeTranslation) {
      activeTranslation = false;
    }

    window.dispatchEvent(new CustomEvent('audioEnd'));
    return;
  }

  // Double-check that this file belongs to the current session (use consistent helper)
  const fileSessionId = extractSessionId(audioFile.name);
  if (currentSessionId && fileSessionId && fileSessionId !== currentSessionId) {
    if (import.meta.env.DEV) {
      console.warn('[AudioQueue] Skipping audio from different session during playback:', {
        fileName: audioFile.name,
        fileSessionId,
        currentSessionId,
      });
    }
    safeRevokeUrl(audioFile.url);
    playNextInQueue(); // Continue with next file
    return;
  }
  
  try {
    // ✅ CRITICAL: Reuse primed element from useAutoplayGate hook (iOS Safari requirement)
    // iOS Safari unlocks HTMLAudioElement PER-INSTANCE, not globally
    // We MUST reuse the same element that was primed during unlock!
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (!audioEl) {
      // First time: Use primed element if available, otherwise create new
      if (primedAudioElement) {
        audioEl = primedAudioElement;
        if (import.meta.env.DEV) {
          console.log('[AudioQueue] 🎯 Using PRIMED element from useAutoplayGate (iOS unlock!)');
        }
      } else {
        // Fallback: Create new element (will likely fail on iOS without priming)
        audioEl = new Audio();
        if (import.meta.env.DEV) {
          console.warn('[AudioQueue] ⚠️ Creating NEW element (not primed - may fail on iOS!)');
        }
      }

      // Ensure element is properly configured for iOS
      if (isIOS && !document.body.contains(audioEl)) {
        document.body.appendChild(audioEl);
        audioEl.style.display = 'none';
      }

      // Event handlers with proper cleanup
      audioEl.onended = () => {
        if (import.meta.env.DEV) {
          console.log('[AudioQueue] ended', { name: audioFile.name });
        }
        // Detect TTS-generated chunk (blob:) vs pre-rendered file (https://r2…)
        const wasLiveTtsChunk = currentAudioUrl?.startsWith('blob:') ?? false;
        // Clean up the blob URL that just finished playing
        if (currentAudioUrl) {
          safeRevokeUrl(currentAudioUrl);
          currentAudioUrl = null;
        }
        if (interChunkTimer) {
          clearTimeout(interChunkTimer);
          interChunkTimer = null;
        }
        if (wasLiveTtsChunk) {
          // Live TTS: insert breath-pause to mask Kokoro/Qwen tail clipping
          interChunkTimer = setTimeout(() => {
            interChunkTimer = null;
            playNextInQueue();
          }, INTER_CHUNK_GAP_MS);
        } else {
          // Pre-rendered audio (R2 stories/initial messages): play immediately
          playNextInQueue();
        }
      };

      audioEl.onerror = (error) => {
        if (import.meta.env.DEV) {
          console.warn('[AudioQueue] error', { name: audioFile.name, error });
        }
        // Clean up the blob URL on error
        if (currentAudioUrl) {
          safeRevokeUrl(currentAudioUrl);
          currentAudioUrl = null;
        }
        playNextInQueue();
      };
    }

    // Track current audio for cleanup
    currentAudioUrl = audioFile.url;

    // Apply playback speed.
    //
    // Two paths:
    // - Pre-created audio (R2 URLs): user slider applies via `playbackRate`,
    //   no per-backend multiplier (the audio was rendered externally, e.g.
    //   ElevenLabs for stories/prisms/councils, with its own baked speed).
    // - TTS-generated audio (blob URLs): user slider × per-backend multiplier
    //   applied entirely client-side via `playbackRate`. The gateway is sent
    //   `speed: 1.0` for all live TTS so the engine renders at native pace
    //   (no GPU cost), then the browser does the time-stretch with
    //   preservesPitch=true (no formant artifacts). See TTS-2c in
    //   POST-RELEASE-ROADMAP.md and TTS-LAB-FINDINGS-2026-05-02.md.
    //
    // Per-backend multiplier table — chosen by ear in 2026-05-02 lab session.
    // First pass aimed at 149 WPM cross-engine but landed too slow; revised
    // to brisk-audiobook range, EN slightly above DE (matches cultural
    // norms: EN audiobook 150-180 WPM, DE 140-170 WPM).
    //   kokoro  : 0.9   (Kokoro EN native ~186 WPM × 0.9  ≈ 167 WPM)
    //   qwen3   : 0.95  (Qwen3 DE native ~166 WPM × 0.95 ≈ 157 WPM)
    //   f5-tts  : 0.9   (F5 native ~180 WPM × 0.9  ≈ 162 WPM — F5 was at 0.85
    //                    server-side until 2026-05-02; flipped to 1.0 server
    //                    same-day so client now owns the slowdown)
    //   unknown : 1.0   (safe default, no behaviour change)
    //
    // Slider semantics: slider=1.0 means "use backend default" (the values
    // above). Any other slider value is treated as a literal playbackRate
    // override and bypasses the backend multiplier — so user-tuned values
    // don't compound with the brand-pace default into uncomfortably slow
    // territory (e.g. without this, slider 0.9 on Qwen3 would be 0.9 × 0.9
    // = 0.81 effective ≈ 134 WPM, well below brand target).
    const isPreCreated = !audioFile.url.startsWith('blob:');
    const config = loadServiceConfig();
    const userSpeed = config.ttsSettings.speed ?? 1.0;
    const backendMultiplier = (() => {
      if (isPreCreated) return 1.0;
      const b = (audioFile.backend ?? '').toLowerCase();
      if (b.includes('kokoro')) return 0.9;
      if (b.includes('qwen')) return 0.95;
      if (b.includes('f5')) return 0.9;
      return 1.0;
    })();
    const isDefaultSlider = Math.abs(userSpeed - 1.0) < 0.001;
    audioEl.playbackRate = isDefaultSlider ? backendMultiplier : userSpeed;
    // Explicit: covers iOS Safari < 14.5 where preservesPitch defaulted to false.
    // Without this, slowdown would chipmunk / speed-up would munchkinise.
    (audioEl as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;

    // Assign new source and play
    audioEl.src = audioFile.url;
    if (import.meta.env.DEV) {
      console.log('[AudioQueue] Attempting to play:', {
        name: audioFile.name,
        src: audioFile.url.substring(0, 50) + '...',
        readyState: audioEl.readyState,
        paused: audioEl.paused,
        muted: audioEl.muted,  // ← CRITICAL: Should be false!
        isPrimedElement: audioEl === primedAudioElement
      });
    }

    // ✅ Try to resume AudioContext if suspended (handles background/foreground transitions)
    if (globalAudioContext && globalAudioContext.state === 'suspended') {
      if (import.meta.env.DEV) {
        console.log('[AudioQueue] Resuming suspended AudioContext before playback');
      }
      // Don't await - this is best-effort
      globalAudioContext.resume().catch(err => {
        console.warn('[AudioQueue] Failed to resume AudioContext:', err);
      });
    }

    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (import.meta.env.DEV) {
            console.log('[AudioQueue] Playback started successfully:', audioFile.name);
          }
        })
        .catch((error: DOMException) => {
          // Audio playback was prevented by browser
          if (import.meta.env.DEV) {
            console.warn('[AudioQueue] Playback error:', error.name, error.message);
          }

          if (error.name === 'NotAllowedError') {
            // ⚠️ This should NOT happen with universal unlock!
            // If it does, user needs to interact with the page again
            console.error('[AudioQueue] CRITICAL: Audio not unlocked! User needs to interact with page.');

            // Clean up resources
            safeRevokeUrl(audioFile.url);
            currentAudioUrl = null;

            if (isIOS && audioEl && document.body.contains(audioEl)) {
              document.body.removeChild(audioEl);
              audioEl = null;
            }

            // Skip this file and try next
            playNextInQueue();
          } else {
            // For other errors, clean up and continue with next audio
            safeRevokeUrl(audioFile.url);
            currentAudioUrl = null;
            playNextInQueue();
          }
        });
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[AudioQueue] Unexpected error in playNextInQueue:', error);
    }
    // Clean up and continue
    safeRevokeUrl(audioFile.url);
    currentAudioUrl = null;
    playNextInQueue();
  }
};

export const cleanupAudioResources = (): void => {
  if (import.meta.env.DEV) {
    console.log('[AudioQueue] Cleaning up audio resources:', {
      queueLength: audioQueue.length,
      isPlaying,
      hasCurrentAudio: !!currentAudioUrl,
      queueBytes: (currentQueueBytes / (1024 * 1024)).toFixed(1) + 'MB'
    });
  }

  // Cancel any pending inter-chunk pause
  if (interChunkTimer) {
    clearTimeout(interChunkTimer);
    interChunkTimer = null;
  }

  // Revoke all queued blob URLs before clearing
  audioQueue.forEach(file => safeRevokeUrl(file.url));
  audioQueue = [];

  // Revoke currently playing audio URL
  if (currentAudioUrl) {
    safeRevokeUrl(currentAudioUrl);
    currentAudioUrl = null;
  }

  // Reset state
  isPlaying = false;
  isEnqueuing = false;
  currentSessionId = null;
  activeTranslation = false;
  currentQueueBytes = 0; // Reset queue size tracking

  try {
    if (audioEl) {
      audioEl.pause();

      // Revoke the audio element's src if it's a blob URL
      if (audioEl.src && audioEl.src.startsWith('blob:')) {
        safeRevokeUrl(audioEl.src);
      }

      audioEl.src = '';

      // ✅ CRITICAL: Don't remove primed element from DOM!
      // If this is the primed element from useAutoplayGate, it's managed by the hook
      // We just reset its state, but keep the reference alive for next playback
      const isPrimedElement = audioEl === primedAudioElement;

      if (!isPrimedElement) {
        // Only remove non-primed elements from DOM
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOS && document.body.contains(audioEl)) {
          document.body.removeChild(audioEl);
        }
        audioEl = null;
      } else {
        // Keep primed element reference but mark as not playing
        if (import.meta.env.DEV) {
          console.log('[AudioQueue] Keeping primed element for reuse (iOS Safari requirement)');
        }
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[AudioQueue] Error during cleanup:', error);
    }
  }

  window.dispatchEvent(new CustomEvent('audioEnd'));
};

/**
 * Estimate total buffered audio duration in seconds
 * Used by TTSScheduler for buffer-aware concurrency (BBA model)
 */
export const getBufferDurationSeconds = (): number => {
  let duration = 0;

  // Currently playing chunk: remaining time
  if (isPlaying && audioEl) {
    const remaining = audioEl.duration - audioEl.currentTime;
    if (!isNaN(remaining) && remaining > 0) {
      duration += remaining;
    }
  }

  // Queued items: use estimatedDuration if available, fallback to average
  for (const file of audioQueue) {
    duration += file.estimatedDuration ?? 6.75;
  }

  return duration;
};

export const getAudioQueueStatus = (): AudioQueueStatus => {
  return {
    isPlaying,
    queueLength: audioQueue.length,
    hasActiveQueue: audioQueue.length > 0 || isPlaying,
    currentSessionId,
    isTranslationActive: activeTranslation
  };
};
