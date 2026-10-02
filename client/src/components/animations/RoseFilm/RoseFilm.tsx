/**
 * RoseFilm — the entry film: a river of light turns round and opens as
 * Dante's rose (Paradiso XXX), and ends on the poem's last line.
 *
 * Film time is the only clock. The picture, the words and the foreground
 * all read it, so a frame can be shown on its own (dev: window.__roseFilm).
 */
import { FC, useEffect, useRef } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { createRoseFilm, type Rgb, type RoseFilm as Film, type RoseFilmPalette, type RoseFilmTier } from '../../../cosmos/rose-film/createRoseFilm';
import { CUES, FILM_DURATION, GROUND, filmState } from '../../../cosmos/rose-film/timeline';
import RoseFilmGround from './RoseFilmGround';
import './RoseFilm.css';

interface RoseFilmProps {
  tier: RoseFilmTier;
  onEnd: () => void;
  /** WebGL could not start: the caller falls back to the CSS intro. */
  onFail: () => void;
}

type CueName = keyof typeof CUES;
const CUE_NAMES = Object.keys(CUES) as CueName[];

declare global {
  interface Window {
    __roseFilm?: {
      ready: boolean;
      seek: (t: number) => void;
      step: (t: number) => void;
      info: () => Record<string, unknown>;
    };
  }
}

// A device that cannot hold about 30 frames a second first draws the moving
// light once per frame, then gets a smaller picture, then a smaller one again.
const SLOW_FRAME_MS = 30;
const GOVERNOR_WINDOW = 36;
const RELIEF_STEPS: ((film: Film) => void)[] = [
  (film) => film.setSingleStep(true),
  (film) => film.setQuality(0.6),
  (film) => film.setQuality(0.36),
];

function token(name: string, fallback: Rgb, linear: boolean): Rgb {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(raw);
  const rgb: Rgb = m
    ? [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255, parseInt(m[1].slice(4, 6), 16) / 255]
    : fallback;
  return linear ? (rgb.map((c) => Math.pow(c, 2.2)) as Rgb) : rgb;
}

function readPalette(): RoseFilmPalette {
  return {
    night: token('--film-slate', [0.106, 0.141, 0.22], false),
    void: token('--film-slate-deep', [0.078, 0.106, 0.173], false),
    abyss: token('--film-abyss', [0.02, 0.027, 0.051], false),
    veil: token('--film-slate-veil', [0.227, 0.271, 0.376], false),
    gold: token('--film-gold-deep', [0.72, 0.525, 0.231], true),
    goldBright: token('--film-gold', [0.878, 0.725, 0.416], true),
    white: token('--film-ivory', [0.953, 0.937, 0.886], true),
    blue: token('--film-mist', [0.553, 0.576, 0.678], true),
  };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// How present a line of words is: it fades in at its cue and out after it.
const LINE_IN = 1.1;
const LINE_OUT = 0.55;
const lineOpacity = (name: CueName, t: number) => ease(CUES[name][0], CUES[name][0] + LINE_IN, t) * (1 - ease(CUES[name][1], CUES[name][1] + LINE_OUT, t));

const RoseFilm: FC<RoseFilmProps> = ({ tier, onEnd, onFail }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { tString } = useTranslation();
  const wordsRef = useRef<HTMLDivElement>(null);

  const onEndRef = useRef(onEnd);
  const onFailRef = useRef(onFail);
  onEndRef.current = onEnd;
  onFailRef.current = onFail;

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    let film: Film;
    try {
      film = createRoseFilm(canvas, { tier, palette: readPalette() });
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      onFailRef.current();
      return;
    }

    let t = 0;
    let last = performance.now();
    let raf = 0;
    let paused = false;
    let ended = false;
    let shownCue: CueName | null = null;
    const lineShown = new Float32Array(CUE_NAMES.length).fill(-1);
    const frameMs: number[] = [];
    const recent: number[] = [];
    let qualityStep = 0;

    const wordsBox = [0.5, 0.86, 0.3, 0.05];
    let wordsAxis = 0;

    // Where the two stand on the rock.
    const relayout = () => {
      const aspect = root.clientWidth / Math.max(1, root.clientHeight);
      const g = aspect < 0.8 ? GROUND.portrait : GROUND.landscape;
      root.style.setProperty('--rose-ground-top', String(g.top));
      root.style.setProperty('--rose-stand-x', String(g.standX));
      root.style.setProperty('--rose-figure', String(g.figure));
    };
    relayout();

    // The film dims its light behind the line of words on screen.
    const measureWords = (name: CueName | null) => {
      const line = name ? wordsRef.current?.querySelector<HTMLElement>(`[data-cue="${name}"] .rose-film-ink`) : null;
      if (!line) return;
      const r = line.getBoundingClientRect();
      const W = root.clientWidth;
      const H = root.clientHeight;
      wordsBox[0] = (r.left + r.width / 2) / W - wordsAxis;
      wordsBox[1] = 1 - (r.top + r.height / 2) / H;
      wordsBox[2] = r.width / 2 / W + 0.035;
      wordsBox[3] = r.height / 2 / H + 0.022;
    };

    const present = (time: number) => {
      const aspect = root.clientWidth / Math.max(1, root.clientHeight);
      const st = filmState(time, { aspect, portrait: aspect < 0.8 });
      root.style.setProperty('--rose-fade', st.fade.toFixed(4));
      root.style.setProperty('--rose-heart', st.heart.toFixed(4));
      root.style.setProperty('--rose-her', st.beatrice.toFixed(4));
      root.style.setProperty('--rose-flash', st.flash.toFixed(4));
      // The words stand over the heart of the picture and follow it.
      wordsAxis = st.centerX * 0.5;
      root.style.setProperty('--rose-axis', (wordsAxis * 100).toFixed(3));
      // The words run on film time too: the line on screen, and how present it is.
      let next: CueName | null = null;
      let wordsOn = 0;
      const lines = wordsRef.current?.children;
      CUE_NAMES.forEach((name, k) => {
        const o = lineOpacity(name, time);
        if (o > wordsOn) {
          wordsOn = o;
          next = name;
        }
        const el = lines?.[k] as HTMLElement | undefined;
        if (el && Math.abs(o - lineShown[k]) > 0.003) {
          lineShown[k] = o;
          el.style.opacity = o.toFixed(3);
          el.style.transform = `translateY(${((1 - ease(CUES[name][0], CUES[name][0] + LINE_IN, time)) * 14).toFixed(1)}px)`;
        }
      });
      if (next && next !== shownCue) {
        shownCue = next;
        measureWords(next);
      }
      film.setWords(wordsBox[0] + wordsAxis, wordsBox[1], wordsBox[2], wordsBox[3], wordsOn);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (paused) return;
      if (import.meta.env.DEV) frameMs.push(now - last);
      if (t > 0.4 && qualityStep < RELIEF_STEPS.length) {
        recent.push(now - last);
        if (recent.length >= GOVERNOR_WINDOW) {
          const median = recent.slice().sort((a, b) => a - b)[recent.length >> 1];
          recent.length = 0;
          if (median > SLOW_FRAME_MS) RELIEF_STEPS[qualityStep++](film);
        }
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      present(t);
      film.render(Math.min(t, FILM_DURATION), dt);
      if (t >= FILM_DURATION && !ended) {
        ended = true;
        onEndRef.current();
      }
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => {
      film.resize();
      relayout();
      measureWords(shownCue);
    };
    window.addEventListener('resize', onResize);

    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      onFailRef.current();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    if (import.meta.env.DEV) {
      window.__roseFilm = {
        ready: true,
        seek: (time: number) => {
          paused = true;
          t = time;
          shownCue = null;
          present(time);
          film.seek(time);
        },
        // Advance to a later time without rebuilding the trails (for recording).
        step: (time: number) => {
          paused = true;
          while (t + 1 / 60 <= time + 1e-6) {
            t += 1 / 60;
            present(t);
            film.render(Math.min(t, FILM_DURATION), 1 / 60);
          }
        },
        info: () => {
          const sorted = frameMs.slice(5).sort((a, b) => a - b);
          const at = (q: number) => (sorted.length ? Math.round(sorted[Math.floor((sorted.length - 1) * q)] * 10) / 10 : 0);
          return { tier, duration: FILM_DURATION, width: canvas.width, height: canvas.height, qualityStep, t: Math.round(t * 100) / 100, frames: sorted.length, p50: at(0.5), p95: at(0.95), max: at(1) };
        },
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onLost);
      if (import.meta.env.DEV) delete window.__roseFilm;
      film.dispose();
    };
  }, [tier]);

  return (
    <div className="rose-film" ref={rootRef} aria-hidden="true">
      <canvas className="rose-film-canvas" ref={canvasRef} />
      <RoseFilmGround />
      <div className="rose-film-words" ref={wordsRef}>
        {(['card1', 'card2', 'card3', 'card4'] as const).map((name) => (
          <p key={name} className="rose-film-line" data-cue={name}>
            <span className="rose-film-ink">{tString(`entry.cinematic.${name}`, '')}</span>
          </p>
        ))}
        <div className="rose-film-line rose-film-verse" data-cue="verse">
          <div className="rose-film-ink">
            <p className="rose-film-verse-line">{tString('entry.cinematic.verse', '')}</p>
            <p className="rose-film-verse-original" lang="it">{tString('entry.cinematic.verseOriginal', '')}</p>
            <p className="rose-film-verse-ref">{tString('entry.cinematic.verseRef', '')}</p>
          </div>
        </div>
      </div>
      <div className="rose-film-flash" />
    </div>
  );
};

export default RoseFilm;
