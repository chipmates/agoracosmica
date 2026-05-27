// src/services/audio/ttsScheduler.ts
// Bounded concurrency scheduler for TTS requests
// Prevents memory bloat when LLM generates text faster than TTS can synthesize

// Buffer-Based Approach (BBA) thresholds for concurrency control
const BUFFER_URGENT_S = 2;     // Below: max concurrency, get audio NOW
const BUFFER_NORMAL_S = 10;    // Below: steady pre-fetch at concurrency 1
// Above BUFFER_NORMAL_S: COMFORTABLE — stop fetching, wait for drain

export interface TTSJob {
  id: string;
  text: string;
  voice: string;
  speed: number;
  /**
   * Routing label used for dev logs only. Reflects which TTS path the caller
   * resolved before enqueueing: `self-hosted` for the GEX130 gateway,
   * `local-tts` when Local Mode is on. The actual backend that produced the
   * audio (`kokoro-local` / `qwen-local` / `qwen-cloud` / `f5-cloud`) lives
   * on `TTSResult.backend` because the gateway picks it server-side.
   */
  provider: 'self-hosted' | 'local-tts';
  sessionId: string;
  sequenceNumber: number;
}

export interface TTSResult {
  url: string;
  name: string;
  speed?: number;
  estimatedDuration?: number; // seconds, for buffer-aware scheduling
  /** X-TTS-Backend response header — needed for client-side per-backend playbackRate (TTS-2c). */
  backend?: string;
  /** X-TTS-Session-Expires-In — preserved end-to-end so callers can refresh sticky-session TTL. */
  sessionTtlSeconds?: number;
}

type TTSProviderFunction = (
  text: string,
  voice: string,
  speed: number,
  signal?: AbortSignal
) => Promise<TTSResult>;

/**
 * TTSScheduler - Bounded concurrency for TTS requests
 *
 * Problem: LLM can stream tokens faster than TTS can synthesize audio.
 * This creates unbounded memory usage when many TTS requests pile up.
 *
 * Solution: Limit concurrent TTS requests to 2-3 maximum.
 * Queue up the rest and process them as slots become available.
 *
 * Features:
 * - Bounded concurrency (default: 2 concurrent requests)
 * - Cancellation support (barge-in, session change)
 * - Error handling with retries
 * - Session-based isolation
 *
 * The scheduler is provider-agnostic. The single TTS function passed to
 * `enqueue` already encapsulates the hosted-vs-local routing decision (see
 * `convertTextToSpeech` in `audio/tts/index.ts`). `TTSJob.provider` is a log
 * label only; the real backend that produced each chunk surfaces on
 * `TTSResult.backend`.
 *
 * @example
 * ```ts
 * const scheduler = new TTSScheduler(2); // max 2 concurrent
 *
 * scheduler.enqueue({
 *   id: crypto.randomUUID(),
 *   text: "Hello world",
 *   voice: "alloy",
 *   speed: 1.0,
 *   provider: 'self-hosted',
 *   sessionId: 'session_123',
 *   sequenceNumber: 1
 * }, ttsProvider);
 *
 * scheduler.cancelAll();
 * ```
 */
export class TTSScheduler {
  private inflight = 0;
  private readonly maxInflight: number;
  private queue: Array<{
    job: TTSJob;
    provider: TTSProviderFunction;
    resolve: (result: TTSResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private cancelled = new Set<string>();
  private currentSessionId: string | null = null;
  private getBufferSeconds: (() => number) | null = null;
  private wakeUpTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  /** Per-job AbortController for in-flight requests. cancelAll aborts them. (LT-12) */
  private inflightControllers = new Map<string, AbortController>();

  constructor(maxInflight = 2) {
    this.maxInflight = maxInflight;

    if (import.meta.env.DEV) {
      console.log(`[TTSScheduler] Initialized with max concurrency: ${maxInflight}`);
    }
  }

  /** Inject buffer duration provider from audioQueueManager */
  setBufferProvider(fn: () => number): void {
    this.getBufferSeconds = fn;
  }

  /** Force-dispatch all remaining jobs (call when LLM stream ends) */
  flush(): void {
    this.flushing = true;
    this.kick();
  }

  /**
   * Set the current session ID
   * Jobs from different sessions will be automatically cancelled
   */
  setSession(sessionId: string | null): void {
    if (this.currentSessionId !== sessionId) {
      if (import.meta.env.DEV) {
        console.log(`[TTSScheduler] Session changed: ${this.currentSessionId} → ${sessionId}`);
      }

      // Clear buffer scheduling state
      if (this.wakeUpTimer) {
        clearTimeout(this.wakeUpTimer);
        this.wakeUpTimer = null;
      }
      this.flushing = false;

      // Cancel all jobs from previous session
      if (this.currentSessionId) {
        this.cancelSession(this.currentSessionId);
      }

      this.currentSessionId = sessionId;
    }
  }

  /**
   * Enqueue a TTS job
   * Returns a promise that resolves with the audio file
   */
  async enqueue(
    job: TTSJob,
    provider: TTSProviderFunction,
  ): Promise<TTSResult> {
    // Validate session
    if (this.currentSessionId && job.sessionId !== this.currentSessionId) {
      if (import.meta.env.DEV) {
        console.warn(
          `[TTSScheduler] Rejecting job from different session: ${job.sessionId} !== ${this.currentSessionId}`
        );
      }
      throw new Error('Job session mismatch');
    }

    return new Promise<TTSResult>((resolve, reject) => {
      this.queue.push({
        job,
        provider,
        resolve,
        reject
      });

      if (import.meta.env.DEV) {
        console.log(`[TTSScheduler] Enqueued job ${job.id}:`, {
          text: job.text.substring(0, 50) + '...',
          provider: job.provider,
          queueLength: this.queue.length,
          inflight: this.inflight
        });
      }

      this.kick();
    });
  }

  /**
   * Cancel all pending + in-flight jobs.
   *
   * Queued jobs get rejected immediately. In-flight jobs get their
   * AbortController fired (LT-12), which propagates through the provider →
   * selfHostedTTS → fetchWithTimeout → fetch call chain, freeing any
   * GPU work the gateway had started.
   */
  cancelAll(): void {
    if (this.wakeUpTimer) {
      clearTimeout(this.wakeUpTimer);
      this.wakeUpTimer = null;
    }
    this.flushing = false;

    const queuedCount = this.queue.length;

    this.queue.forEach(item => {
      this.cancelled.add(item.job.id);
      item.reject(new Error('Cancelled'));
    });

    this.queue = [];

    // Abort in-flight HTTP requests.
    const inflightCount = this.inflightControllers.size;
    for (const [jobId, controller] of this.inflightControllers) {
      this.cancelled.add(jobId);
      try {
        controller.abort();
      } catch {
        /* ignore — abort is best-effort */
      }
    }
    this.inflightControllers.clear();

    if (import.meta.env.DEV && (queuedCount > 0 || inflightCount > 0)) {
      console.log(
        `[TTSScheduler] Cancelled ${queuedCount} queued + ${inflightCount} in-flight jobs`,
      );
    }
  }

  /**
   * Cancel jobs from a specific session
   */
  private cancelSession(sessionId: string): void {
    const beforeLength = this.queue.length;

    this.queue = this.queue.filter(item => {
      if (item.job.sessionId === sessionId) {
        this.cancelled.add(item.job.id);
        item.reject(new Error(`Session ${sessionId} cancelled`));
        return false;
      }
      return true;
    });

    const cancelledCount = beforeLength - this.queue.length;

    if (import.meta.env.DEV && cancelledCount > 0) {
      console.log(`[TTSScheduler] Cancelled ${cancelledCount} jobs from session ${sessionId}`);
    }
  }

  /**
   * Process queued jobs up to effective concurrency limit
   * Uses BBA (Buffer-Based Approach) to throttle based on audio buffer level
   */
  private async kick(): Promise<void> {
    // Clear any pending wake-up timer
    if (this.wakeUpTimer) {
      clearTimeout(this.wakeUpTimer);
      this.wakeUpTimer = null;
    }

    // Determine effective concurrency based on buffer level
    let effectiveMax = this.maxInflight;

    if (this.getBufferSeconds && !this.flushing) {
      const buffer = this.getBufferSeconds();
      if (buffer >= BUFFER_NORMAL_S) {
        effectiveMax = 0; // COMFORTABLE — don't dispatch
      } else if (buffer >= BUFFER_URGENT_S) {
        effectiveMax = 1; // NORMAL — steady pace
      }
      // else: URGENT — use maxInflight (2)
    }

    // COMFORTABLE zone with queued jobs: schedule wake-up
    if (effectiveMax === 0 && this.queue.length > 0) {
      const buffer = this.getBufferSeconds!();
      const wakeUpMs = Math.max(500, (buffer - BUFFER_URGENT_S) * 1000);
      this.wakeUpTimer = setTimeout(() => {
        this.wakeUpTimer = null;
        this.kick();
      }, wakeUpMs);

      if (import.meta.env.DEV) {
        console.log(`[TTSScheduler] COMFORTABLE (${buffer.toFixed(1)}s buffer) — wake up in ${(wakeUpMs / 1000).toFixed(1)}s`);
      }
      return;
    }

    // Reset flushing when queue empties
    if (this.queue.length === 0) {
      this.flushing = false;
    }

    while (this.inflight < effectiveMax && this.queue.length > 0) {
      const item = this.queue.shift()!;

      // Skip if cancelled
      if (this.cancelled.has(item.job.id)) {
        this.cancelled.delete(item.job.id);
        item.reject(new Error('Cancelled before processing'));
        continue;
      }

      this.inflight++;

      // LT-12: give each in-flight job its own AbortController so cancelAll()
      // can abort the HTTP request mid-flight, not just skip queued jobs.
      const controller = new AbortController();
      this.inflightControllers.set(item.job.id, controller);

      if (import.meta.env.DEV) {
        const zone = effectiveMax >= this.maxInflight ? 'URGENT' : 'NORMAL';
        console.log(`[TTSScheduler] Starting job ${item.job.id} [${zone}]:`, {
          inflight: this.inflight,
          queueRemaining: this.queue.length,
          effectiveMax
        });
      }

      // Process job asynchronously
      (async () => {
        try {
          const result = await this.synthesize(
            item.job,
            item.provider,
            controller.signal,
          );

          // Check if cancelled during synthesis
          if (this.cancelled.has(item.job.id)) {
            this.cancelled.delete(item.job.id);
            item.reject(new Error('Cancelled during synthesis'));
            return;
          }

          item.resolve(result);

          if (import.meta.env.DEV) {
            const backendTag = result.backend ? ` (${result.backend})` : '';
            console.log(`[TTSScheduler] Completed job ${item.job.id}${backendTag}`);
          }
        } catch (error) {
          item.reject(error as Error);

          if (import.meta.env.DEV) {
            console.error(`[TTSScheduler] Job ${item.job.id} failed:`, error);
          }
        } finally {
          this.inflight--;
          this.cancelled.delete(item.job.id);
          this.inflightControllers.delete(item.job.id);

          // Process next jobs
          this.kick();
        }
      })();
    }
  }

  /**
   * Synthesize audio using the provided TTS function. The caller's function
   * already encapsulates hosted-vs-local routing; the scheduler only manages
   * concurrency, cancellation, and session isolation.
   */
  private async synthesize(
    job: TTSJob,
    provider: TTSProviderFunction,
    signal?: AbortSignal,
  ): Promise<TTSResult> {
    try {
      return await provider(job.text, job.voice, job.speed, signal);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[TTSScheduler] ${job.provider} TTS failed:`, error);
      }
      throw error;
    }
  }

  /**
   * Get current queue status
   */
  getStatus(): {
    inflight: number;
    queueLength: number;
    currentSession: string | null;
  } {
    return {
      inflight: this.inflight,
      queueLength: this.queue.length,
      currentSession: this.currentSessionId
    };
  }
}
