// The map of a story's text: its scenes (the writer's own breaks, else about ten stretches of equal time) drawn as
// small pages of lines, lit as heard, with the saved sentences as dots. In the bar and the open player it is tapped or
// dragged: the bubble names the time, the scene and the sentence the voice will start from, and letting go starts
// there. The native range stays underneath for keys and screen readers.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { loadText, loadTiming } from './content';
import { seekTo as seekVoice, skipBack, voicePosition } from './controller';
import { blockAt, buildModel, paragraphStep, sentenceStart, wordAt } from './readalong';
import type { ReaderModel } from './readalong';
import { Icon } from './icons';
import { clockLabel, playerStrings } from './strings';
import type { PlayerStrings } from './strings';
import type { PlayerState, StoryQueue } from './types';

export interface MapSegment {
  start: number;
  end: number;
  /** The scene's number where the story has the writer's breaks, else null. */
  scene: number | null;
  /** Drawn lines, each a share of the segment's width: the last one shorter. */
  lines: number[];
}

export interface TextMapModel {
  model: ReaderModel;
  segments: MapSegment[];
  scenes: boolean;
}

const GROUPS = 10;
const models = new Map<string, Promise<TextMapModel>>();
// Maps already built, so a sheet that opens later draws at once instead of one frame without them.
const ready = new Map<string, TextMapModel>();

/** Where each text block starts in the voice: its first timed word, else its paragraph stamp. */
function blockStarts(model: ReaderModel, duration: number): (number | null)[] {
  const out = model.blocks.map((b): number | null => {
    if (b.rule) return null;
    if (model.mode === 'word') {
      for (const si of b.sentences) {
        const t = sentenceStart(model, si);
        if (t > 0 || si === 0) return t;
      }
    }
    return model.paragraphs.find(p => p.index === b.index)?.start ?? null;
  });
  // blocks the timing does not reach take a share of the time by their length
  const total = model.blocks.reduce((n, b) => n + b.sentences.reduce((m, si) => m + (model.sentences[si]?.text.length ?? 0), 0), 0) || 1;
  let acc = 0;
  return out.map((t, i) => {
    const b = model.blocks[i]!;
    const here = acc;
    acc += b.sentences.reduce((m, si) => m + (model.sentences[si]?.text.length ?? 0), 0);
    return b.rule ? null : t ?? (here / total) * duration;
  });
}

function lineShape(seed: number, count: number): number[] {
  // a block of full lines, the last one shorter, its length varied a little from segment to segment
  return Array.from({ length: count }, (_, i) => (i < count - 1 ? 1 : 0.42 + ((seed * 37) % 41) / 100));
}

export function buildTextMap(model: ReaderModel, duration: number): TextMapModel {
  const starts = blockStarts(model, duration);
  const paras = model.blocks.map((b, i) => ({ b, t: starts[i] })).filter(x => !x.b.rule && !x.b.heading && x.t !== null) as { b: ReaderModel['blocks'][number]; t: number }[];
  const groups: { start: number }[][] = [];
  const ruled = model.blocks.some(b => b.rule);
  if (ruled) {
    let cur: { start: number }[] = [];
    model.blocks.forEach((b, i) => {
      if (b.rule) {
        if (cur.length) groups.push(cur);
        cur = [];
      } else if (!b.heading && starts[i] !== null) cur.push({ start: starts[i]! });
    });
    if (cur.length) groups.push(cur);
  }
  const scenes = groups.length >= 2;
  if (!scenes) {
    groups.length = 0;
    const k = Math.min(GROUPS, paras.length);
    let next = 1;
    let cur: { start: number }[] = [];
    paras.forEach((p, i) => {
      const cut = (next * duration) / k;
      if (cur.length && p.t >= cut && groups.length < k - 1) {
        groups.push(cur);
        cur = [];
        while ((next * duration) / k <= p.t) next += 1;
      }
      cur.push({ start: p.t });
      if (i === paras.length - 1) groups.push(cur);
    });
  }
  const segments: MapSegment[] = groups.map((g, i) => ({
    start: i === 0 ? 0 : g[0]!.start,
    end: groups[i + 1]?.[0]?.start ?? duration,
    scene: scenes ? i + 1 : null,
    lines: lineShape(i + 3, 4),
  }));
  return { model, segments, scenes };
}

/** The story's text map once its text and timing are in (the same cached files the reader reads). */
export function loadTextMap(queue: StoryQueue, n: number, duration: number): Promise<TextMapModel> {
  const key = `${queue.figureId}/${queue.lang}/${n}`;
  let hit = models.get(key);
  if (!hit) {
    hit = Promise.all([loadText(queue, n), loadTiming(queue, n)]).then(([blocks, timing]) => {
      const map = buildTextMap(buildModel(blocks, timing, n === 0), duration);
      ready.set(key, map);
      return map;
    });
    hit.catch(() => models.delete(key));
    models.set(key, hit);
  }
  return hit;
}

export function useTextMap(queue: StoryQueue | null, n: number | null, duration: number): TextMapModel | null {
  const key = queue && n !== null && duration > 0 ? `${queue.figureId}/${queue.lang}/${n}` : null;
  const [map, setMap] = useState<{ key: string; map: TextMapModel } | null>(null);
  useEffect(() => {
    if (!queue || n === null || !key) return;
    let live = true;
    loadTextMap(queue, n, duration).then(m => live && setMap({ key, map: m })).catch(() => undefined);
    return () => {
      live = false;
    };
    // the duration only scales stretches the timing does not cover; the key names the story
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map && map.key === key ? map.map : key ? ready.get(key) ?? null : null;
}

/** The sentence the voice is in at time t, and where it starts. */
export function sentenceAtTime(model: ReaderModel, t: number): { si: number; start: number; text: string } | null {
  let si = -1;
  if (model.mode === 'word') {
    const w = wordAt(model, t);
    si = w >= 0 ? model.words[w]!.si : 0;
  } else if (model.mode === 'paragraph') {
    const bi = blockAt(model, t);
    const block = bi === null ? model.blocks.find(b => !b.rule && !b.heading) : model.blocks.find(b => b.index === bi);
    si = block?.sentences[0] ?? 0;
  } else return null;
  const s = model.sentences[si];
  return s ? { si, start: sentenceStart(model, si), text: s.text } : null;
}

function segmentAt(map: TextMapModel, t: number): MapSegment | undefined {
  return map.segments.find(s => t >= s.start && t < s.end) ?? map.segments[map.segments.length - 1];
}


/** The whole story as one page, until its text and timing are in. */
function flatSegments(duration: number): MapSegment[] {
  return [{ start: 0, end: duration, scene: null, lines: lineShape(3, 4) }];
}

/** Pages are 6 px apart: the gap comes out of each page's right edge, so time stays linear across the width. */
const PAGE_GAP = 6;

function placePage(el: HTMLElement | null, seg: MapSegment, last: boolean, duration: number): void {
  if (!el) return;
  const x0 = Math.min(100, (seg.start / duration) * 100);
  // the last page ends at the voice's real end (the map may have been built with the catalog's rounder length)
  const w = last ? 100 - x0 : Math.min(100 - x0, ((seg.end - seg.start) / duration) * 100);
  // CSSOM, not style attributes: the strict style-src blocks attributes.
  el.style.setProperty('left', `${x0.toFixed(3)}%`);
  el.style.setProperty('width', last ? `${w.toFixed(3)}%` : `max(1px, calc(${w.toFixed(3)}% - ${PAGE_GAP}px))`);
  el.style.setProperty('--sp-last', `${Math.round((seg.lines[seg.lines.length - 1] ?? 0.6) * 100)}%`);
}

/** A page under 2 % of the story (a closing line) is drawn as part of the page before it: a sliver reads as a glitch. */
function drawnSegments(segs: MapSegment[], duration: number): MapSegment[] {
  const out: MapSegment[] = [];
  for (const seg of segs) {
    const prev = out[out.length - 1];
    if (prev && duration > 0 && (seg.end - seg.start) / duration < 0.02) out[out.length - 1] = { ...prev, end: seg.end };
    else out.push(seg);
  }
  return out;
}

interface DrawProps {
  map: TextMapModel | null;
  duration: number;
  className?: string;
}

/** The drawing alone: each page four lines (2 px every 6 px, the last one short), the heard part lit, a clip. */
export function TextMapDrawing({ map, duration, className = '' }: DrawProps) {
  const segs = map ? drawnSegments(map.segments, duration) : flatSegments(duration);
  const pages = segs.map((seg, i) => (
    <span key={i} className="sp-page" ref={el => placePage(el, seg, i === segs.length - 1, duration)} />
  ));
  return (
    <span className={`sp-pages ${className}`} aria-hidden="true" data-tmap-drawing="">
      <span className="sp-pages__layer">{pages}</span>
      <span className="sp-pages__layer sp-pages__layer--heard" data-tmap-heard="">{pages}</span>
    </span>
  );
}

/** Set the drawing's heard share: a clip on the lit layer. */
export function setHeard(root: Element | null, share: number): void {
  const right = (1 - Math.max(0, Math.min(1, share))) * 100;
  root?.querySelectorAll<HTMLElement>('[data-tmap-heard]').forEach(el => el.style.setProperty('clip-path', `inset(0 ${right.toFixed(2)}% 0 0)`));
}

/** One step by sentence (held: by paragraph); back from well inside a sentence replays it from its start. */
export function stepSentence(model: ReaderModel, dir: 1 | -1, paragraph = false): void {
  const now = voicePosition();
  const at = sentenceAtTime(model, now);
  if (!at) return;
  let si = at.si;
  if (paragraph) si = paragraphStep(model, si, dir);
  else if (dir > 0) si = Math.min(model.sentences.length - 1, si + 1);
  else if (now - at.start < 1.5) si = Math.max(0, si - 1);
  seekVoice(sentenceStart(model, si) + 0.01);
}

/** Back a few seconds: the bar's step until the story's timing is in. */
export function backAFew(): void {
  seekVoice(Math.max(0, voicePosition() - 5));
}

interface BarProps {
  state: PlayerState;
  queue: StoryQueue;
  seekTo: (t: number) => void;
}

/** The bar's pages, loaded after the first screen: the whole story as one page until the map is in. */
export function BarMap({ state, queue, seekTo }: BarProps) {
  const map = useTextMap(queue, state.current, state.duration);
  return <TextMap state={state} queue={queue} map={map} where="bar" seekTo={seekTo} />;
}

/** The bar's one back control: a sentence where the words are timed, 15 s where they are not. */
export function BarBack({ state, queue, s }: { state: PlayerState; queue: StoryQueue; s: PlayerStrings }) {
  const map = useTextMap(queue, state.current, state.duration);
  const words = map && map.model.mode === 'word' ? map.model : null;
  if (map && !words) {
    return <button type="button" className="story-btn story-dock__back" onClick={skipBack} aria-label={s.back15Aria}>{Icon.back15}</button>;
  }
  return (
    <button type="button" className="story-btn story-dock__back" onClick={() => (words ? stepSentence(words, -1) : backAFew())}
      aria-label={s.sentenceBack}>{Icon.again}</button>
  );
}

interface MapProps {
  state: PlayerState;
  queue: StoryQueue;
  /** Null until the story's text and timing are in: one page, the bubble names the time only. */
  map: TextMapModel | null;
  /** "bar" (the bar under the page) or "player" (the open player). */
  where: 'bar' | 'player';
  seekTo: (t: number) => void;
}

/** The map that is tapped and dragged: the drawing, the playhead, the saved sentences, a bubble while dragging, the
 * range under it for keys and screen readers. */
export function TextMap({ state, queue, map, where, seekTo }: MapProps) {
  const s = playerStrings(queue.lang);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const rangeRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState<{ t: number; at: number } | null>(null);
  const duration = state.duration > 0 ? state.duration : 1;
  const shown = drag ? drag.t : state.time;

  // CSSOM, not style attributes: the strict style-src blocks attributes.
  useEffect(() => {
    const share = Math.min(1, Math.max(0, shown / duration));
    headRef.current?.style.setProperty('left', `${share * 100}%`);
    setHeard(boxRef.current, drag ? Math.min(1, state.time / duration) : share);
    rangeRef.current?.style.setProperty('--story-seek', `${share * 100}%`);
  }, [shown, duration, drag, state.time, map]);

  const timeAt = useCallback((clientX: number) => {
    const b = boxRef.current?.getBoundingClientRect();
    if (!b || b.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - b.left) / b.width)) * duration;
  }, [duration]);
  const target = drag && map ? sentenceAtTime(map.model, drag.t) : null;
  const seg = drag && map ? segmentAt(map, drag.t) : undefined;

  // The bubble stands over the finger, kept inside the open player's width or, in the bar, inside the screen. On a phone
  // the bar's bubble spans the screen less 8 px a side: a narrower one let a letter of the page peek beside it.
  useEffect(() => {
    const bubble = bubbleRef.current;
    const root = rootRef.current?.getBoundingClientRect();
    const box = boxRef.current?.getBoundingClientRect();
    if (!bubble || !root || !box || !drag) return;
    const screen = document.documentElement.clientWidth;
    if (where === 'bar' && screen < 1024) {
      bubble.style.setProperty('width', `${screen - 16}px`);
      bubble.style.setProperty('left', `${8 - root.left}px`);
      return;
    }
    const w = bubble.getBoundingClientRect().width;
    const lo = where === 'player' ? root.left : 8;
    const hi = where === 'player' ? root.right : screen - 8;
    const x = Math.min(hi - w, Math.max(lo, box.left + drag.at - w / 2));
    bubble.style.setProperty('left', `${x - root.left}px`);
  }, [drag, where, target?.si]);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // a pointer the browser no longer tracks: the drag still follows its moves over the band
    }
    const b = boxRef.current!.getBoundingClientRect();
    setDrag({ t: timeAt(e.clientX), at: Math.min(b.width, Math.max(0, e.clientX - b.left)) });
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const b = boxRef.current!.getBoundingClientRect();
    setDrag({ t: timeAt(e.clientX), at: Math.min(b.width, Math.max(0, e.clientX - b.left)) });
  };
  const onUp = () => {
    if (!drag) return;
    const to = map ? sentenceAtTime(map.model, drag.t) : null;
    setDrag(null);
    seekTo(to ? to.start : drag.t);
  };
  // Keys as in the edition: the arrows step by sentence (with Shift by paragraph; 5 s where the words are not timed),
  // the page keys by scene, Home and End to the first and the last scene.
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const words = map && map.model.mode === 'word' ? map.model : null;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (dir) {
      e.preventDefault();
      if (words) stepSentence(words, dir, e.shiftKey);
      else seekTo(Math.min(duration, Math.max(0, voicePosition() + dir * 5)));
      return;
    }
    const list = map?.segments ?? flatSegments(duration);
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      seekTo(e.key === 'Home' ? 0 : list[list.length - 1]!.start);
      return;
    }
    if (e.key !== 'PageDown' && e.key !== 'PageUp') return;
    e.preventDefault();
    const now = state.time;
    const i = Math.max(0, list.findIndex(x => now >= x.start && now < x.end));
    const next = list[Math.min(list.length - 1, Math.max(0, i + (e.key === 'PageDown' ? 1 : now - list[i]!.start > 2 ? 0 : -1)))];
    if (next) seekTo(next.start);
  };
  const saved = map ? state.saved.filter(x => x.n === state.current && map.model.sentences[x.si]) : [];
  const sceneNow = map?.scenes ? segmentAt(map, state.time)?.scene ?? null : null;
  return (
    <div ref={rootRef} className={`sp-tmap sp-tmap--${where}${drag ? ' is-dragging' : ''}`} data-tmap={where}>
      <div ref={boxRef} className="sp-tmap__box" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}>
        <TextMapDrawing map={map} duration={duration} className="sp-tmap__draw" />
        {map && saved.map(x => {
          const at = (sentenceStart(map.model, x.si) / duration) * 100;
          return <span key={x.si} className="sp-tmap__dot" data-tmap-dot={x.si} ref={el => el?.style.setProperty('left', `${at}%`)} />;
        })}
        <span ref={headRef} className="sp-tmap__head" aria-hidden="true" />
      </div>
      <input ref={rangeRef} className="sp-tmap__range" type="range" min={0} max={state.duration > 0 ? Math.floor(state.duration) : 0} step={1}
        value={Math.floor(state.time)} aria-label={s.seekAria}
        aria-valuetext={s.mapValue(clockLabel(state.time), clockLabel(state.duration), sceneNow)}
        onKeyDown={onKey} onChange={e => seekTo(Number(e.currentTarget.value))} />
      {drag && (
        <div ref={bubbleRef} className="sp-tmap__bubble" aria-hidden="true">
          <span className="sp-tmap__when">
            {clockLabel(target ? target.start : drag.t)}
            {seg?.scene ? <span className="sp-tmap__scene">{s.mapScene(seg.scene)}</span> : null}
          </span>
          {target && <span className="sp-tmap__line">{target.text}</span>}
        </div>
      )}
    </div>
  );
}
