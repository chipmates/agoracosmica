// The map of a story's text: its scenes (the writer's own breaks, else about ten stretches of equal time) drawn as
// small blocks of lines, filled as heard, with the saved sentences as dots. In the open player and the desktop dock
// it is dragged: the bubble names the time, the scene and the sentence the voice will start from, and letting go
// starts there. The native range stays underneath for keys and screen readers. The phone dock shows the drawing only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { loadText, loadTiming } from './content';
import { blockAt, buildModel, sentenceStart, wordAt } from './readalong';
import type { ReaderModel } from './readalong';
import { clockLabel, playerStrings } from './strings';
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

interface DrawProps {
  map: TextMapModel;
  duration: number;
  /** Lines per segment and their thickness: the phone dock draws three thin ones. */
  rows: number;
  className: string;
}

/** The drawing alone: segments as blocks of lines, a gap between them, heard lines in the accent (a clip). */
export function TextMapDrawing({ map, duration, rows, className }: DrawProps) {
  const clipRef = useRef<SVGRectElement | null>(null);
  const id = useMemo(() => `sp-tmap-clip-${Math.random().toString(36).slice(2, 8)}`, []);
  const W = 1000;
  const lineH = rows <= 3 ? 1.4 : 2.2;
  const gapY = rows <= 3 ? 1.4 : 2.6;
  const H = rows * lineH + (rows - 1) * gapY;
  const rects = map.segments.flatMap((seg, i) => {
    const x0 = (seg.start / duration) * W;
    const x1 = (seg.end / duration) * W - (i < map.segments.length - 1 ? 6 : 0);
    const shape = seg.lines.slice(-rows);
    return shape.map((share, r) => (
      <rect key={`${i}-${r}`} x={x0.toFixed(1)} y={(r * (lineH + gapY)).toFixed(2)} width={Math.max(1, (x1 - x0) * (r < rows - 1 ? 1 : share)).toFixed(1)} height={lineH} />
    ));
  });
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H.toFixed(2)}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" data-tmap-drawing="">
      <defs>
        <clipPath id={id}><rect ref={clipRef} className="sp-tmap__clip" x="0" y="0" width="0" height={H.toFixed(2)} data-tmap-clip="" /></clipPath>
      </defs>
      <g className="sp-tmap__lines">{rects}</g>
      <g className="sp-tmap__heard" clipPath={`url(#${id})`}>{rects}</g>
    </svg>
  );
}

/** Set the drawing's heard share: an attribute, so the strict style policy allows it. */
export function setHeard(root: Element | null, share: number): void {
  root?.querySelectorAll('[data-tmap-clip]').forEach(r => r.setAttribute('width', String(Math.round(Math.max(0, Math.min(1, share)) * 1000))));
}

interface DockMapProps {
  state: PlayerState;
  queue: StoryQueue;
  /** "phone": the drawing in the progress line, display only; "desk": the dock's scrubber. */
  kind: 'phone' | 'desk';
  seekTo: (t: number) => void;
  /** What the dock shows until the story's text and timing are in. */
  plain: ReactNode;
}

/** The dock's map, loaded after the first screen: the plain line or range until the map is ready. */
export function DockMap({ state, queue, kind, seekTo, plain }: DockMapProps) {
  const map = useTextMap(queue, state.current, state.duration);
  const progRef = useRef<HTMLDivElement | null>(null);
  const share = state.duration > 0 ? Math.min(1, state.time / state.duration) : 0;
  useEffect(() => {
    setHeard(progRef.current, share);
  }, [share, map]);
  if (!map) return <>{plain}</>;
  if (kind === 'desk') return <TextMap state={state} queue={queue} map={map} where="dock" seekTo={seekTo} />;
  return (
    <div ref={progRef} className="story-dock__progress has-map" aria-hidden="true">
      <TextMapDrawing map={map} duration={state.duration > 0 ? state.duration : 1} rows={3} className="story-dock__tmap" />
    </div>
  );
}

interface MapProps {
  state: PlayerState;
  queue: StoryQueue;
  map: TextMapModel;
  /** "player" (the open player) or "dock" (the desktop dock, smaller). */
  where: 'player' | 'dock';
  seekTo: (t: number) => void;
}

/** The draggable map: the drawing, the playhead, the saved sentences, a bubble while dragging, the range under it. */
export function TextMap({ state, queue, map, where, seekTo }: MapProps) {
  const s = playerStrings(queue.lang);
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
  }, [shown, duration, drag, state.time]);

  const timeAt = useCallback((clientX: number) => {
    const b = boxRef.current?.getBoundingClientRect();
    if (!b || b.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - b.left) / b.width)) * duration;
  }, [duration]);
  const target = drag ? sentenceAtTime(map.model, drag.t) : null;
  const seg = drag ? segmentAt(map, drag.t) : undefined;

  useEffect(() => {
    const bubble = bubbleRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!bubble || !box || !drag) return;
    const w = bubble.getBoundingClientRect().width;
    const room = where === 'player' ? box.width : Math.max(box.width, w);
    const x = Math.min(room - w, Math.max(where === 'player' ? 0 : box.width - room, drag.at - w / 2));
    bubble.style.setProperty('left', `${x}px`);
  }, [drag, where]);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const b = boxRef.current!.getBoundingClientRect();
    setDrag({ t: timeAt(e.clientX), at: e.clientX - b.left });
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const b = boxRef.current!.getBoundingClientRect();
    setDrag({ t: timeAt(e.clientX), at: Math.min(b.width, Math.max(0, e.clientX - b.left)) });
  };
  const onUp = () => {
    if (!drag) return;
    const to = sentenceAtTime(map.model, drag.t);
    setDrag(null);
    seekTo(to ? to.start : drag.t);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'PageDown' && e.key !== 'PageUp') return;
    // Page keys step by scene, as the arrows step by second
    e.preventDefault();
    const now = state.time;
    const list = map.segments;
    const i = Math.max(0, list.findIndex(x => now >= x.start && now < x.end));
    const next = list[Math.min(list.length - 1, Math.max(0, i + (e.key === 'PageDown' ? 1 : now - list[i]!.start > 2 ? 0 : -1)))];
    if (next) seekTo(next.start);
  };
  const saved = state.saved.filter(x => x.n === state.current && map.model.sentences[x.si]);
  const sceneNow = map.scenes ? segmentAt(map, state.time)?.scene ?? null : null;
  return (
    <div className={`sp-tmap sp-tmap--${where}${drag ? ' is-dragging' : ''}`} data-tmap={where}>
      <div ref={boxRef} className="sp-tmap__box" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        <TextMapDrawing map={map} duration={duration} rows={4} className="sp-tmap__draw" />
        {saved.map(x => {
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
