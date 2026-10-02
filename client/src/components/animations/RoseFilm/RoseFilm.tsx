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
import { CUES, FIGURE_BOX, FILM_DURATION, GROUND, RING_RADIUS, SEATS, filmState, riseTime } from '../../../cosmos/rose-film/timeline';
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
    night: token('--bg-deep-space', [0.047, 0.067, 0.2], false),
    void: token('--bg-void', [0.031, 0.043, 0.125], false),
    gold: token('--gold-subtle', [0.83, 0.65, 0.22], true),
    goldBright: token('--gold-active', [1, 0.82, 0.5], true),
    white: token('--text-primary', [0.91, 0.89, 0.83], true),
    blue: token('--star-blue-light', [0.71, 0.78, 1], true),
  };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// How present a name is: it kindles with its light and fades as the light leaves.
const NAME_OUT = 0.45;
const nameOpacity = (i: number, lift: number, t: number) => 0.84 * ease(SEATS[i].kindle, SEATS[i].kindle + 0.7, t) * (1 - ease(lift, lift + NAME_OUT, t));

interface NameRow {
  y: number;
  /** The stretches of the row that are free: [from, to]. */
  segments: [number, number][];
  room: number;
  used: number;
  names: number[];
}

interface NameLayout {
  starts: Float32Array;
  /** When each light leaves its name, in film seconds. */
  lifts: Float32Array;
  /** The block's box: centre and half size, shares of the frame, y from the foot. */
  box: [number, number, number, number];
  placed: number;
}

/**
 * Place the thirty names in even rows above the ridge, each beside its
 * light. The seeker stands clear of them: beside the block on a wide frame,
 * below it on a tall one, and only on a frame with no room for that do the
 * rows run past him. Left to right the names follow the order of their
 * seats, so the rising lines fan out. The type steps down a little until
 * all thirty have a place.
 */
function layoutNames(root: HTMLElement, list: HTMLElement, items: HTMLElement[]): NameLayout {
  const W = root.clientWidth;
  const H = root.clientHeight;
  const portrait = W / H < 0.8;
  const g = portrait ? GROUND.portrait : GROUND.landscape;
  const order = SEATS.map((seat, i) => ({ i, x: seat.startX })).sort((a, b) => a.x - b.x).map((o) => o.i);
  const boxW = g.figure * H * FIGURE_BOX.aspect;
  const danteX = g.standX * W + (FIGURE_BOX.danteX - 0.5) * boxW;

  list.style.fontSize = '';
  const baseFont = parseFloat(getComputedStyle(list).fontSize) || 14;

  // The round of light stands above the names: no row may reach into it.
  const before = filmState(8.4, { aspect: W / H, portrait });
  const ringFoot = H * (0.5 - before.centerY / 2) + (((RING_RADIUS + 0.17) / before.halfShort) * Math.min(W, H)) / 2;

  const attempt = (font: number, rowCount: number, clear: boolean) => {
    const rowH = Math.round(font * (portrait ? 1.7 : 1.95));
    const lightGap = Math.round(font * 1.1);
    const minGap = font * (portrait ? 0.75 : 1.5);
    const maxGap = font * (portrait ? 1.6 : 2.6);
    const margin = portrait ? 16 : Math.max(40, W * 0.09);
    const figureTop = H * (1 - g.top - g.figure * 0.8) - font;
    const baseY = clear ? figureTop - rowH * 0.5 : H * (1 - g.top - (portrait ? 0.048 : 0.06));
    if (clear && baseY - (rowCount - 1) * rowH - rowH * 0.7 < ringFoot) return null;
    const blocked: [number, number] = [danteX - boxW * 0.16 - font * 0.6, danteX + boxW * 0.17 + font * 1.2];
    const rows: NameRow[] = Array.from({ length: rowCount }, (_, r) => {
      const y = baseY - r * rowH;
      let segments: [number, number][];
      if (clear) segments = [[margin, W - margin]];
      else segments = y > figureTop ? [[margin, blocked[0]], [blocked[1], W - margin]] : [[margin, W - margin]];
      return { y, segments, room: segments.reduce((sum, [a, b]) => sum + Math.max(0, b - a), 0), used: 0, names: [] };
    });
    const width = (i: number) => (items[i] ? items[i].offsetWidth : 0) + lightGap;

    // Each name goes to the emptiest row that still has room, so the rows fill evenly.
    for (const i of order) {
      const w = width(i);
      let best: NameRow | null = null;
      for (const row of rows) {
        if (row.used + w + minGap * (row.names.length + row.segments.length - 1) > row.room) continue;
        if (!best || row.used / row.room < best.used / best.room - 1e-6) best = row;
      }
      if (!best) return null;
      best.names.push(i);
      best.used += w;
    }

    const starts = new Float32Array(SEATS.length * 2);
    const at: { i: number; x: number; y: number }[] = [];
    let x0 = W;
    let x1 = 0;
    for (const row of rows) {
      // Share the row's names between its stretches in proportion to their room.
      let from = 0;
      for (let k = 0; k < row.segments.length; k++) {
        const [a, b] = row.segments[k];
        const last = k === row.segments.length - 1;
        let to = from;
        let sum = 0;
        const share = row.used * ((b - a) / row.room);
        while (to < row.names.length) {
          const w = width(row.names[to]);
          const fits = sum + w + minGap * (to - from) <= b - a;
          if (!fits && !last) break;
          if (!last && sum + w / 2 > share) break;
          if (!fits) return null;
          sum += w;
          to++;
        }
        const count = to - from;
        if (count > 0) {
          const gap = count > 1 ? Math.min(maxGap, (b - a - sum) / (count - 1)) : 0;
          // Each stretch is centred, with the same air between its names.
          let x = a + (b - a - sum - gap * (count - 1)) / 2;
          for (let n = from; n < to; n++) {
            const i = row.names[n];
            at.push({ i, x, y: row.y });
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x + width(i));
            x += width(i) + gap;
          }
        }
        from = to;
      }
      if (from < row.names.length) return null;
    }
    for (const { i, x, y } of at) {
      starts[i * 2] = (x + 3) / W;
      starts[i * 2 + 1] = 1 - y / H;
      const el = items[i];
      if (el) {
        el.dataset.placed = 'true';
        el.style.transform = `translate(${Math.round(x + lightGap)}px, ${Math.round(y - font * 0.52)}px)`;
      }
    }
    // The top row leaves first, each row from the middle outwards, so no
    // rising light crosses a name that is still there.
    const lifts = new Float32Array(SEATS.length);
    at.slice()
      .sort((p, q) => p.y - q.y || Math.abs(p.x + width(p.i) / 2 - W / 2) - Math.abs(q.x + width(q.i) / 2 - W / 2))
      .forEach(({ i }, slot) => {
        lifts[i] = riseTime(slot);
      });
    const used = rows.filter((row) => row.names.length);
    const top = Math.min(...used.map((row) => row.y)) - rowH * 0.6;
    const foot = Math.max(...used.map((row) => row.y)) + rowH * 0.5;
    const box: [number, number, number, number] = [(x0 + x1) / 2 / W, 1 - (top + foot) / 2 / H, (x1 - x0) / 2 / W, (foot - top) / 2 / H];
    return { starts, lifts, box, placed: at.length };
  };

  const maxRows = portrait ? 10 : 6;
  for (const clear of [true, false]) {
    for (let step = 0; step < (clear ? 4 : 7); step++) {
      const font = baseFont * Math.pow(0.95, step);
      list.style.fontSize = step ? `${font.toFixed(2)}px` : '';
      // The fewest rows that leave the names some air.
      for (let rowCount = portrait ? 5 : 3; rowCount <= maxRows; rowCount++) {
        const done = attempt(font, rowCount, clear);
        if (done) return done;
      }
    }
  }
  // No room at all (a very small frame): the lights rise without their names.
  items.forEach((el) => {
    el.dataset.placed = 'false';
  });
  const starts = new Float32Array(SEATS.length * 2);
  SEATS.forEach((seat, i) => {
    starts[i * 2] = seat.startX;
    starts[i * 2 + 1] = g.top + 0.06 + 0.03 * (i % 3);
  });
  return { starts, lifts: Float32Array.from(SEATS, (seat) => seat.lift), box: [0.5, g.top + 0.1, 0.4, 0.05], placed: 0 };
}

// How present a line of words is: it fades in at its cue and out after it.
const LINE_IN = 1.1;
const LINE_OUT = 0.55;
const lineOpacity = (name: CueName, t: number) => ease(CUES[name][0], CUES[name][0] + LINE_IN, t) * (1 - ease(CUES[name][1], CUES[name][1] + LINE_OUT, t));

const RoseFilm: FC<RoseFilmProps> = ({ tier, onEnd, onFail }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { tString, tArray, language } = useTranslation();
  const names = tArray('entry.cinematic.names');
  const shortNames = tArray('entry.cinematic.namesShort');
  const namesRef = useRef<HTMLUListElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const relayoutRef = useRef<() => void>(() => {});

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
    let namesBox: [number, number, number, number] = [0.5, 0.25, 0.4, 0.06];
    let namesPlaced = 0;
    const nameShown = new Float32Array(SEATS.length);
    let nameLifts: Float32Array = Float32Array.from(SEATS, (seat) => seat.lift);

    // Where things stand: the figures on the ridge, the names beside their lights.
    const relayout = () => {
      const aspect = root.clientWidth / Math.max(1, root.clientHeight);
      const g = aspect < 0.8 ? GROUND.portrait : GROUND.landscape;
      root.style.setProperty('--rose-ground-top', String(g.top));
      root.style.setProperty('--rose-stand-x', String(g.standX));
      root.style.setProperty('--rose-figure', String(g.figure));
      const list = namesRef.current;
      if (!list) return;
      const placed = layoutNames(root, list, Array.from(list.children) as HTMLElement[]);
      film.setSeatStarts(placed.starts, placed.lifts);
      nameLifts = placed.lifts;
      namesBox = placed.box;
      namesPlaced = placed.placed;
    };
    relayoutRef.current = relayout;
    relayout();
    // The names' widths change once the reading face has loaded.
    document.fonts?.ready.then(() => relayoutRef.current()).catch(() => {});

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

      const items = namesRef.current?.children;
      let namesOn = 0;
      if (items) {
        for (let i = 0; i < items.length && i < SEATS.length; i++) {
          const el = items[i] as HTMLElement;
          const o = el.dataset.placed === 'true' ? nameOpacity(i, nameLifts[i], time) * (1 - st.flash) : 0;
          namesOn = Math.max(namesOn, o);
          if (Math.abs(o - nameShown[i]) > 0.004 || (o === 0 && nameShown[i] !== 0)) {
            nameShown[i] = o;
            el.style.opacity = o.toFixed(3);
          }
        }
      }
      film.setNames(namesBox[0], namesBox[1], namesBox[2], namesBox[3], Math.min(1, namesOn / 0.9));
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
          return { tier, duration: FILM_DURATION, width: canvas.width, height: canvas.height, qualityStep, names: namesPlaced, t: Math.round(t * 100) / 100, frames: sorted.length, p50: at(0.5), p95: at(0.95), max: at(1) };
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

  // The names change with the language: place them again.
  useEffect(() => {
    relayoutRef.current();
  }, [language, names.length]);

  return (
    <div className="rose-film" ref={rootRef} aria-hidden="true">
      <canvas className="rose-film-canvas" ref={canvasRef} />
      <ul className="rose-film-names" ref={namesRef}>
        {SEATS.map((_, i) => (
          <li key={i}>
            <span className="rose-film-name-full">{names[i] ?? ''}</span>
            <span className="rose-film-name-short">{shortNames[i] ?? names[i] ?? ''}</span>
          </li>
        ))}
      </ul>
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
