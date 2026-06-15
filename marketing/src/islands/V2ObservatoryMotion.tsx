// Motion controller island for the landing-lab v2 "Observatory" hero.
//
// The hero paints fully static from server HTML: the gold core, the three
// concentric rings, every figure "planet" at its resting position, and the
// spotlight plaque prefilled with the LCP figure. This island only ENHANCES,
// and only after idle, so it never blocks LCP:
//   1. flips on the orbit keyframes (the CSS keeps them off until .is-live)
//   2. runs the spotlight cycle: every ~6s one planet lights up and the
//      plaque introduces it (name + its catalog learn line). On mobile the
//      horizon crops the stage, so the cycle only picks planets whose face
//      is actually inside the visible window, re-checked each tick because
//      the slow orbits sink and raise faces over time.
//   3. arms the plaque's pause toggle (WCAG 2.2.2: the orbits and the cycle
//      run longer than 5 seconds, so users get a real pause mechanism)
//   4. gives touch users a first-tap identity: tapping a planet that is not
//      spotlighted spotlights it instead of navigating, the second tap
//      follows the link
//   5. parks the loop when the tab is hidden (battery + main-thread courtesy)
//   6. adds a tiny rAF-throttled pointer-parallax plane on desktop only
//
// Every motion path bails out under prefers-reduced-motion: reduce, so those
// users keep the static arrangement and plaque the server already painted.
// There is no visual element here, it returns null and works purely through
// the DOM nodes it is mounted beside.

import { useEffect } from 'react';
import { getPublicTrailerUrl } from '@client/utils/public/publicMediaUrl';

interface Props {
  /** id of the .v2-observatory root this controller drives */
  targetId: string;
}

const CYCLE_MS = 6000;
const FADE_MS = 230;
const HOVER_RESUME_MS = 2500;

// webm is ~6x smaller than the mp3 fallback; iOS Safari reports no webm
// confidence and gets mp3 (same probe as useFigureTrailer)
let cachedExt: 'webm' | 'mp3' | null = null;
function trailerExt(): 'webm' | 'mp3' {
  if (cachedExt) return cachedExt;
  let webm = false;
  try {
    const probe = document.createElement('audio');
    webm =
      probe.canPlayType('audio/webm; codecs="opus"') === 'probably' ||
      probe.canPlayType('audio/webm; codecs="vorbis"') === 'probably';
  } catch {
    webm = false;
  }
  cachedExt = webm ? 'webm' : 'mp3';
  return cachedExt;
}

export default function V2ObservatoryMotion({ targetId }: Props) {
  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;

    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

    const planets = Array.from(root.querySelectorAll<HTMLAnchorElement>('.v2-planet'));
    const horizon = root.querySelector<HTMLElement>('.v2-horizon');
    const plaque = root.querySelector<HTMLElement>('#v2-plaque');
    const plaqueName = root.querySelector<HTMLElement>('#v2-plaque-name');
    const plaqueLearn = root.querySelector<HTMLElement>('#v2-plaque-learn');
    const pauseButton = root.querySelector<HTMLButtonElement>('#v2-plaque-pause');
    const voiceButton = root.querySelector<HTMLButtonElement>('#v2-plaque-voice');
    const voiceLabel = root.querySelector<HTMLElement>('#v2-plaque-voice-label');

    let parallaxRaf = 0;
    let pendingX = 0;
    let pendingY = 0;
    let cycleTimer = 0;
    let fadeTimer = 0;
    let resumeTimer = 0;
    let spotIndex = 0;
    let paused = false;
    let lastPointerType = '';
    let voiceOn = false;
    let voiceAudio: HTMLAudioElement | null = null;
    // the figure currently named on the plaque (the voice chip plays them)
    let plaqueFigure = {
      id: planets[0]?.dataset.figure ?? '',
      name: planets[0]?.dataset.name ?? '',
    };

    const applyParallax = () => {
      parallaxRaf = 0;
      root.style.setProperty('--v2-px', pendingX.toFixed(3));
      root.style.setProperty('--v2-py', pendingY.toFixed(3));
    };

    const onPointerMove = (event: PointerEvent) => {
      // map cursor to a -1..1 range around the hero center
      const rect = root.getBoundingClientRect();
      pendingX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pendingY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!parallaxRaf) parallaxRaf = requestAnimationFrame(applyParallax);
    };

    // ── spotlight cycle ──────────────────────────────────────────────────
    const isVisible = (planet: HTMLElement) => {
      if (!horizon) return true;
      // only the mobile media query sets overflow: hidden on the horizon;
      // on desktop the planets' overhang is visible, so everything counts
      // (a scrollHeight comparison would misread that overhang as a crop)
      if (getComputedStyle(horizon).overflowY !== 'hidden') return true;
      // all four edges: the stage is wider than the window, so faces can
      // leave through the sides too, and the edge fades start ~30px in.
      // The inset keeps the pick fully inside the opaque region with room
      // to drift during its 6s spotlight.
      const hRect = horizon.getBoundingClientRect();
      const face = planet.getBoundingClientRect();
      const inset = 24;
      return (
        face.top >= hRect.top + inset &&
        face.bottom <= hRect.bottom - inset &&
        face.left >= hRect.left + inset &&
        face.right <= hRect.right - inset
      );
    };

    // track the intended target, not the rendered text: an in-flight
    // crossfade still shows the OLD name, and comparing against it would
    // skip the cancel and let the pending swap win over a newer spotlight
    let plaqueTarget = plaqueName?.textContent ?? '';
    // the voice chip always offers the figure the plaque is naming, except
    // while a voice is playing (then it reads as the pause control)
    const syncVoiceLabel = () => {
      if (!voiceButton || !voiceLabel) return;
      if (voiceOn) {
        voiceLabel.textContent = voiceButton.dataset.pauseLabel ?? 'Pause';
      } else {
        const template = voiceButton.dataset.hearTemplate ?? 'Hear {name}';
        voiceLabel.textContent = template.replace('{name}', plaqueFigure.name);
      }
    };

    const setPlaque = (planet: HTMLElement) => {
      if (!plaque || !plaqueName || !plaqueLearn) return;
      const name = planet.dataset.name ?? '';
      const learn = planet.dataset.learn ?? '';
      if (name === plaqueTarget) return;
      plaqueTarget = name;
      plaqueFigure = { id: planet.dataset.figure ?? '', name };
      window.clearTimeout(fadeTimer);
      plaque.classList.add('is-fading');
      fadeTimer = window.setTimeout(() => {
        plaqueName.textContent = name;
        plaqueLearn.textContent = learn;
        plaque.classList.remove('is-fading');
        syncVoiceLabel();
      }, FADE_MS);
    };

    const clearSpot = () => {
      planets.forEach(p => p.classList.remove('is-spot'));
    };

    const spotlight = (planet: HTMLElement) => {
      clearSpot();
      planet.classList.add('is-spot');
      setPlaque(planet);
    };

    const advanceCycle = () => {
      // hold the spotlight while a voice is speaking
      if (voiceOn) return;
      if (!planets.length) return;
      // walk the roster until a planet inside the visible window turns up
      for (let step = 1; step <= planets.length; step++) {
        const candidate = planets[(spotIndex + step) % planets.length];
        if (candidate && isVisible(candidate)) {
          spotIndex = (spotIndex + step) % planets.length;
          spotlight(candidate);
          return;
        }
      }
    };

    const stopCycle = () => {
      window.clearInterval(cycleTimer);
      cycleTimer = 0;
    };

    const startCycle = () => {
      stopCycle();
      if (paused || document.hidden || reduceQuery.matches) return;
      cycleTimer = window.setInterval(advanceCycle, CYCLE_MS);
    };

    // hover steals the spotlight; the cycle resumes shortly after leave.
    // Touch taps synthesize a mouseenter right before their click, which
    // would spotlight the planet and make the click read as a second tap,
    // so touch-derived enters are ignored (the click path owns touch).
    const onPlanetEnter = (event: Event) => {
      if (lastPointerType === 'touch') return;
      const planet = (event.target as HTMLElement).closest<HTMLElement>('.v2-planet');
      if (!planet) return;
      window.clearTimeout(resumeTimer);
      stopCycle();
      spotlight(planet);
      spotIndex = Math.max(0, planets.indexOf(planet as HTMLAnchorElement));
    };
    const onPlanetLeave = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(startCycle, HOVER_RESUME_MS);
    };

    // first tap on an unspotlighted planet introduces it, second tap follows
    const onPointerDown = (event: PointerEvent) => {
      lastPointerType = event.pointerType;
    };
    const isTouchClick = (event: MouseEvent) => {
      // Chrome dispatches clicks as PointerEvents carrying their own
      // pointerType; fall back to the last pointerdown, then to the
      // hover-capability of the device.
      const pt = (event as PointerEvent).pointerType;
      if (pt) return pt === 'touch' || pt === 'pen';
      if (lastPointerType) return lastPointerType === 'touch';
      return window.matchMedia('(hover: none)').matches;
    };
    const onPlanetClick = (event: MouseEvent) => {
      if (!isTouchClick(event)) return;
      const planet = (event.target as HTMLElement).closest<HTMLElement>('.v2-planet');
      if (!planet || planet.classList.contains('is-spot')) return;
      event.preventDefault();
      window.clearTimeout(resumeTimer);
      stopCycle();
      spotlight(planet);
      spotIndex = Math.max(0, planets.indexOf(planet as HTMLAnchorElement));
      resumeTimer = window.setTimeout(startCycle, HOVER_RESUME_MS);
    };

    // ── pause toggle (also parks the CSS animations via .is-paused) ─────
    // the label stays constant; aria-pressed alone carries the state
    const onPauseClick = () => {
      paused = !paused;
      root.classList.toggle('is-paused', paused);
      pauseButton?.setAttribute('aria-pressed', paused ? 'true' : 'false');
      if (paused) stopCycle();
      else startCycle();
    };

    // ── the voice chip: play the spotlighted figure's ~50s trailer ───────
    // Wired independently of the motion gate, because hearing a voice is not
    // motion: it works under prefers-reduced-motion too (the plaque then
    // simply stays on the server-rendered figure). Tap-to-play only, play()
    // inside the gesture for iOS, audio fetched only on demand.
    const stopVoice = () => {
      if (voiceAudio) {
        voiceAudio.pause();
        voiceAudio.removeAttribute('src');
        voiceAudio.load();
      }
      voiceOn = false;
      voiceButton?.removeAttribute('data-voice');
      root.classList.remove('has-voice');
      planets.forEach(p => p.classList.remove('is-speaking'));
      syncVoiceLabel();
      startCycle();
    };

    const startVoice = () => {
      if (!plaqueFigure.id) return;
      if (!voiceAudio) {
        voiceAudio = new Audio();
        voiceAudio.preload = 'none';
        voiceAudio.addEventListener('ended', stopVoice);
        voiceAudio.addEventListener('error', stopVoice);
      }
      const lang = document.documentElement.lang === 'de' ? 'de' : 'en';
      voiceAudio.src = getPublicTrailerUrl(plaqueFigure.id, lang, trailerExt());
      voiceOn = true;
      voiceButton?.setAttribute('data-voice', 'on');
      root.classList.add('has-voice');
      const speaking = root.querySelector(`.v2-planet[data-figure="${plaqueFigure.id}"]`);
      speaking?.classList.add('is-speaking');
      syncVoiceLabel();
      // the spotlight holds on the speaker while the voice plays
      stopCycle();
      void voiceAudio.play().catch(() => stopVoice());
    };

    const onVoiceClick = () => {
      if (voiceOn) stopVoice();
      else startVoice();
    };

    const onVisibility = () => {
      // pause the whole orbital system while the tab is in the background
      root.classList.toggle('is-hidden', document.hidden);
      if (document.hidden) stopCycle();
      else startCycle();
    };

    const enableMotion = () => {
      if (reduceQuery.matches) {
        root.classList.remove('is-live');
        root.style.removeProperty('--v2-px');
        root.style.removeProperty('--v2-py');
        stopCycle();
        clearSpot();
        if (pauseButton) pauseButton.hidden = true;
        return;
      }
      root.classList.add('is-live');
      document.addEventListener('visibilitychange', onVisibility);
      if (hoverQuery.matches) {
        root.addEventListener('pointermove', onPointerMove, { passive: true });
      }
      if (pauseButton) {
        pauseButton.hidden = false;
        pauseButton.addEventListener('click', onPauseClick);
      }
      planets.forEach(p => {
        if (hoverQuery.matches) {
          p.addEventListener('mouseenter', onPlanetEnter);
          p.addEventListener('mouseleave', onPlanetLeave);
        }
        p.addEventListener('click', onPlanetClick);
      });
      root.addEventListener('pointerdown', onPointerDown, { passive: true });
      startCycle();
    };

    const teardownMotion = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerdown', onPointerDown);
      if (pauseButton) pauseButton.removeEventListener('click', onPauseClick);
      planets.forEach(p => {
        p.removeEventListener('mouseenter', onPlanetEnter);
        p.removeEventListener('mouseleave', onPlanetLeave);
        p.removeEventListener('click', onPlanetClick);
      });
      stopCycle();
      window.clearTimeout(fadeTimer);
      window.clearTimeout(resumeTimer);
      if (parallaxRaf) cancelAnimationFrame(parallaxRaf);
      parallaxRaf = 0;
    };

    // the voice chip lives outside the motion gate (audio is not motion)
    voiceButton?.addEventListener('click', onVoiceClick);

    enableMotion();

    // react live if the user toggles their reduced-motion preference
    const onReduceChange = () => {
      teardownMotion();
      enableMotion();
    };
    reduceQuery.addEventListener('change', onReduceChange);

    return () => {
      reduceQuery.removeEventListener('change', onReduceChange);
      voiceButton?.removeEventListener('click', onVoiceClick);
      if (voiceAudio) {
        voiceAudio.pause();
        voiceAudio.removeAttribute('src');
        voiceAudio.load();
        voiceAudio = null;
      }
      teardownMotion();
      clearSpot();
      planets.forEach(p => p.classList.remove('is-speaking'));
      root.classList.remove('is-live', 'is-hidden', 'is-paused', 'has-voice');
    };
  }, [targetId]);

  return null;
}
