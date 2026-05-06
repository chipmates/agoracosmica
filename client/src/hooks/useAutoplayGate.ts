// src/hooks/useAutoplayGate.ts
// 2025 Production-Grade: Resettable promise barrier + muted HTMLAudioElement priming
// Based on expert feedback + ChipMates architecture

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type GateState = 'locked' | 'unlocking' | 'unlocked';

/**
 * Production-grade autoplay gate with resettable promise barrier
 *
 * Key features:
 * - Lazy AudioContext creation (inside user gesture, not on mount)
 * - Resettable promise barrier (blocks playback after backgrounding)
 * - Muted HTMLAudioElement priming (prevents audio clicks)
 * - Synchronous unlock in same event turn (iOS requirement)
 * - Background/foreground transition handling
 * - Proper cleanup on unmount
 *
 * Usage:
 * ```tsx
 * const { getContext, unlock, unlocked, waitUntilReady } = useAutoplayGate();
 *
 * // Call unlock() synchronously in user gesture handler:
 * <button onPointerDown={() => unlock()}>
 *
 * // Before playback, await the barrier:
 * await waitUntilReady();
 * audio.play();
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
 */
export function useAutoplayGate() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Gate state management
  const [state, setState] = useState<GateState>('locked');

  // Track previous AudioContext state (for transition detection)
  const previousCtxStateRef = useRef<AudioContextState | null>(null);

  // Ref for lock function to avoid stale closure in onstatechange handler
  const lockRef = useRef<(reason: string) => void>(() => {});

  // Track whether gate has ever been successfully unlocked (distinguishes idle-resume from initial unlock)
  const hasBeenUnlockedRef = useRef(false);
  // Ref for auto-unlock function to avoid stale closure in onstatechange handler
  const autoUnlockRef = useRef<() => void>(() => {});

  // Resettable promise barrier (CRITICAL for background/foreground)
  const resolveReadyRef = useRef<(() => void) | null>(null);
  const readyPromiseRef = useRef<Promise<void>>(new Promise(() => {}));

  // Create a new ready promise (called on lock and init)
  const makeReadyPromise = useCallback(() => {
    const promise = new Promise<void>((resolve) => {
      resolveReadyRef.current = resolve;
    });
    readyPromiseRef.current = promise;
    return promise;
  }, []);

  // Initialize ready promise
  useEffect(() => {
    makeReadyPromise();
  }, [makeReadyPromise]);

  // Compute unlocked boolean for UI (derived from state)
  const unlocked = state === 'unlocked';

  /**
   * Lock the audio gate (reset promise barrier)
   * Called when context suspends or app backgrounds
   * ONLY locks on state TRANSITIONS (running → suspended), not initial state
   */
  const lock = useCallback((reason: string) => {
    if (state === 'locked') return;

    if (import.meta.env.DEV) {
      console.log(`[AudioGate] Locking gate: ${reason}`);
    }

    // Reset the barrier - creates NEW promise that must be resolved again
    setState('locked');
    makeReadyPromise();
  }, [state, makeReadyPromise]);

  // Keep lockRef in sync so onstatechange handler always calls latest version
  lockRef.current = lock;

  // Auto-unlock when context resumes after idle suspension
  // Only fires if gate was previously unlocked (not initial browser-policy unlock)
  const autoUnlockOnResume = useCallback(() => {
    if (!hasBeenUnlockedRef.current) return;
    if (state === 'unlocked') return;
    if (import.meta.env.DEV) {
      console.log('[AudioGate] Auto-unlocking: context resumed after idle suspension');
    }
    setState('unlocked');
    if (resolveReadyRef.current) resolveReadyRef.current();
  }, [state]);
  autoUnlockRef.current = autoUnlockOnResume;

  /**
   * Lazy AudioContext creation
   * Creates context ONLY when first needed, ideally inside a user gesture
   * This avoids the race condition where context is created before user interacts
   */
  const getContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext);

      if (!Ctor) {
        throw new Error('AudioContext not supported in this browser');
      }

      // Use 'interactive' latency hint for conversational use cases
      audioCtxRef.current = new Ctor({ latencyHint: 'interactive' });

      // Store initial state
      previousCtxStateRef.current = audioCtxRef.current.state;

      // Monitor state changes to detect suspension (ONLY on transitions)
      audioCtxRef.current.onstatechange = () => {
        const currentState = audioCtxRef.current?.state;
        const previousState = previousCtxStateRef.current;

        if (import.meta.env.DEV) {
          console.log('[AudioGate] Context state transition:', {
            from: previousState,
            to: currentState
          });
        }

        // CRITICAL: Only lock on transition from 'running' to 'suspended'
        // Don't lock on initial 'suspended' state!
        // Use lockRef.current to avoid stale closure (lock captures state at creation time)
        if (previousState === 'running' && currentState === 'suspended') {
          if (import.meta.env.DEV) {
            console.log('[AudioGate] ⚠️ Context suspended (was running) - locking gate');
          }
          lockRef.current('context transition: running → suspended');
        }

        // Auto-unlock on resume after idle suspension
        // After first unlock, ctx.resume() works without user gesture
        if (previousState === 'suspended' && currentState === 'running') {
          autoUnlockRef.current();
        }

        // Update previous state
        previousCtxStateRef.current = currentState || null;
      };

      if (import.meta.env.DEV) {
        console.log('[AudioGate] AudioContext created lazily:', {
          state: audioCtxRef.current.state,
          sampleRate: audioCtxRef.current.sampleRate,
          latencyHint: 'interactive'
        });
      }
    }

    return audioCtxRef.current!;
  }, [lock]);

  /**
   * Lazy HTMLAudioElement creation
   * Used for muted priming to unlock HTMLMediaElement autoplay
   */
  const getAudioElement = useCallback((): HTMLAudioElement => {
    if (!audioElRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      (audio as any).playsinline = true;
      (audio as any).disableRemotePlayback = true;

      // For iOS, append to DOM (hidden)
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (isIOS) {
        audio.style.display = 'none';
        audio.hidden = true;
        document.body.appendChild(audio);
      }

      audioElRef.current = audio;

      if (import.meta.env.DEV) {
        console.log('[AudioGate] HTMLAudioElement created (iOS optimized)');
      }
    }

    return audioElRef.current!;
  }, []);

  /**
   * Handle background/foreground transitions
   * iOS suspends AudioContext when app backgrounds
   * CRITICAL: Reset promise barrier to require new gesture
   */
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible' &&
          audioCtxRef.current?.state === 'suspended') {
        if (import.meta.env.DEV) {
          console.log('[AudioGate] Context suspended after backgrounding - resetting barrier');
        }
        // Reset promise barrier - playback will wait for next gesture
        lock('visibility change - backgrounded');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [lock]);

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        if (import.meta.env.DEV) {
          console.log('[AudioGate] Cleaning up AudioContext on unmount');
        }
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }

      if (audioElRef.current) {
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        if (isIOS && document.body.contains(audioElRef.current)) {
          document.body.removeChild(audioElRef.current);
        }
        audioElRef.current = null;
      }
    };
  }, []);

  /**
   * Production-grade unlock with dual-handshake
   *
   * CRITICAL: Must be called synchronously inside a user gesture event handler
   * (pointerdown, touchstart, click, keydown, etc.)
   *
   * This function:
   * 1. Resumes AudioContext (for Web Audio API)
   * 2. Primes HTMLAudioElement with muted playback (for <audio> tags)
   * 3. Resolves the ready promise (unlocks async playback barrier)
   *
   * iOS Safari will IGNORE operations if called from:
   * - Promise callbacks (async)
   * - setTimeout/setInterval
   * - Event handlers not directly triggered by user
   *
   * @example
   * ```tsx
   * <button onPointerDown={() => {
   *   unlock(); // ✅ Synchronous, same event turn
   *   someAsyncOperation(); // OK to be async after
   * }}>
   * ```
   */
  const unlock = useCallback(async () => {
    if (state === 'unlocked' || state === 'unlocking') {
      if (import.meta.env.DEV) {
        console.log('[AudioGate] Already unlocked or unlocking, skipping');
      }
      return;
    }

    setState('unlocking');

    if (import.meta.env.DEV) {
      console.log('[AudioGate] Starting unlock sequence...');
    }

    try {
      // 1) Resume AudioContext (synchronous call in same event turn)
      const ctx = getContext();

      if (import.meta.env.DEV) {
        console.log('[AudioGate] AudioContext state before resume:', ctx.state);
      }

      await ctx.resume();

      if (import.meta.env.DEV) {
        console.log('[AudioGate] AudioContext resumed:', ctx.state);
      }

      // Update previous state tracker (for transition detection)
      previousCtxStateRef.current = ctx.state;

      // 2) Prime HTMLAudioElement with MUTED MediaStream playback
      //    This unlocks ALL future HTMLAudioElement.play() calls
      //    Using MediaStream bridge from Web Audio ensures compatibility
      try {
        const dest = ctx.createMediaStreamDestination();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Practically silent oscillator
        gain.gain.value = 0.0001;
        osc.connect(gain).connect(dest);

        const audio = getAudioElement();

        // CRITICAL: Mute to ensure truly silent priming (prevents clicks)
        audio.muted = true;

        audio.pause();
        (audio as any).srcObject = dest.stream;

        const playPromise = audio.play();
        osc.start();
        osc.stop(ctx.currentTime + 0.05);

        await (playPromise ?? Promise.resolve());

        // Cleanup
        audio.pause();
        (audio as any).srcObject = null;

        // ✅ CRITICAL: Always unmute after priming for actual playback!
        // Don't restore prevMuted - it might be undefined or true
        audio.muted = false;

        if (import.meta.env.DEV) {
          console.log('[AudioGate] HTMLAudioElement primed successfully', {
            muted: audio.muted,
            readyState: audio.readyState,
            inDOM: document.body.contains(audio)
          });
        }
      } catch (primingError) {
        // If HTMLAudioElement priming fails, AudioContext unlock still works
        if (import.meta.env.DEV) {
          console.warn('[AudioGate] HTMLAudioElement priming failed (non-critical):', primingError);
        }
      }

      // 3) Unlock successful - resolve ready promise and update state
      setState('unlocked');
      hasBeenUnlockedRef.current = true;

      if (resolveReadyRef.current) {
        resolveReadyRef.current();
        if (import.meta.env.DEV) {
          console.log('[AudioGate] Ready promise resolved - playback barrier removed');
        }
      }

      if (import.meta.env.DEV) {
        console.log('[AudioGate] ✅ Unlock complete - audio ready for playback');
      }

    } catch (error) {
      console.error('[AudioGate] Unlock failed:', error);
      setState('locked');
      makeReadyPromise(); // Reset barrier
    }
  }, [state, getContext, getAudioElement, makeReadyPromise]);

  /**
   * Async playback barrier
   * Await this before playing audio to ensure unlock has completed
   *
   * Usage:
   * ```tsx
   * await waitUntilReady();
   * audio.play(); // Safe to play now
   * ```
   */
  const waitUntilReady = useCallback(async (): Promise<void> => {
    if (state === 'unlocked') {
      return Promise.resolve();
    }

    if (import.meta.env.DEV) {
      console.log('[AudioGate] Waiting for unlock...');
    }

    return readyPromiseRef.current;
  }, [state]);

  /**
   * Rearm the gate after backgrounding
   * Call this in the next user gesture after app returns to foreground
   */
  const rearm = useCallback(async () => {
    if (state !== 'locked') return;

    if (import.meta.env.DEV) {
      console.log('[AudioGate] Rearming after background...');
    }

    await unlock();
  }, [state, unlock]);

  return useMemo(() => ({
    /**
     * Get or create the AudioContext
     * Creates lazily on first call, ideally inside a user gesture
     */
    getContext,

    /**
     * Get or create the HTMLAudioElement
     * Used for priming, created lazily
     */
    getAudioElement,

    /**
     * Whether audio has been unlocked (derived from state)
     */
    unlocked,

    /**
     * Current gate state ('locked' | 'unlocking' | 'unlocked')
     */
    state,

    /**
     * Unlock audio for autoplay (dual-handshake)
     * MUST be called synchronously inside a user gesture handler
     * Unlocks both AudioContext AND HTMLAudioElement
     */
    unlock,

    /**
     * Async playback barrier
     * Await this before playing audio to ensure unlock completed
     */
    waitUntilReady,

    /**
     * Rearm the gate after backgrounding
     * Call in next user gesture after app returns to foreground
     */
    rearm
  }), [getContext, getAudioElement, unlocked, state, unlock, waitUntilReady, rearm]);
}
