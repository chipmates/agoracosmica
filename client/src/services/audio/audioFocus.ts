// src/services/audio/audioFocus.ts
//
// Global audio focus: only one *content* sound plays at a time.
//
// The app has many independent players (a story narration, a prism, a council
// debate, the audio library, a figure trailer, a voice preview, the live TTS
// conversation). Each one used to own its HTMLAudioElement and knew nothing
// about the others, so starting a second player left the first one playing and
// you heard both at once (GitHub issue #18).
//
// This module is the one place that fixes that. A content player "claims focus"
// the moment it starts producing sound; whoever held focus before is paused.
// Whoever the user just started wins, the previous one steps back. It mirrors
// the OS audio-focus idea (Android AudioManager, iOS AVAudioSession): a single
// active holder, the previous holder yields.
//
// We pause the *previous holder only*, not every registered player. That keeps
// the pause exact (the one thing that was actually sounding) and avoids firing
// a council's heavy stop/cleanup on players that are merely idle.
//
// What deliberately does NOT register: UI sound effects (uiSounds), the login
// ambient loop, the muted autoplay primer, the little bloom/completion chimes.
// Those may legitimately overlap real content (a short chime while a story
// plays is fine), so they stay out and are never touched. Registration is
// opt-in for exactly this reason.

interface ContentPlayer {
  /** Pause or stop this player. Must be safe to call when already stopped. */
  pause: () => void;
}

/** Handle returned by {@link registerContentPlayer}. */
export interface AudioFocusHandle {
  /** Call the moment this player starts producing sound. Pauses the previous holder. */
  claim: () => void;
  /** Call when this player stops (pause / ended). Releases focus if it held it. */
  release: () => void;
  /** Detach this player for good (e.g. its element is being discarded). */
  dispose: () => void;
}

let activePlayer: ContentPlayer | null = null;

function claimFocus(player: ContentPlayer): void {
  // Same player re-firing 'play' (resume after seek, next TTS chunk on the same
  // element): nothing else changed, so leave the room alone.
  if (activePlayer === player) return;

  // Set the new holder before pausing the old one. Pausing an element fires its
  // 'pause' event, which calls release() on that player — with the new holder
  // already set, that release is a harmless no-op instead of clobbering it.
  const previous = activePlayer;
  activePlayer = player;
  if (previous) {
    try {
      previous.pause();
    } catch {
      // Best effort — a player throwing on pause must not block the new one.
    }
  }
}

/**
 * Register a content player. `pause` is invoked when another player takes
 * focus. Returns a handle to claim/release focus and to unregister.
 *
 * Use this for players without an HTMLAudioElement 'play' event to hook (e.g.
 * Web Audio buffer sources). For a plain <audio> element, {@link bindAudioElement}
 * is simpler.
 */
export function registerContentPlayer(pause: () => void): AudioFocusHandle {
  const player: ContentPlayer = { pause };
  return {
    claim: () => claimFocus(player),
    release: () => {
      if (activePlayer === player) activePlayer = null;
    },
    dispose: () => {
      if (activePlayer === player) activePlayer = null;
    },
  };
}

/**
 * Bind an HTMLAudioElement to the coordinator. When it starts playing it claims
 * focus (pausing whoever held it); when it pauses or ends it releases focus.
 * Returns a cleanup fn that detaches the listeners and unregisters the element.
 *
 * Attach this BEFORE the first play() on the element so the 'play' event is
 * caught.
 */
export function bindAudioElement(el: HTMLAudioElement): () => void {
  const handle = registerContentPlayer(() => {
    try {
      el.pause();
    } catch {
      // Best effort.
    }
  });
  const onPlay = (): void => handle.claim();
  const onStop = (): void => handle.release();
  el.addEventListener('play', onPlay);
  el.addEventListener('pause', onStop);
  el.addEventListener('ended', onStop);
  return () => {
    el.removeEventListener('play', onPlay);
    el.removeEventListener('pause', onStop);
    el.removeEventListener('ended', onStop);
    handle.dispose();
  };
}
