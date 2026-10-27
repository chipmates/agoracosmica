// The reading view: any story's text, or the introduction's, fetched from R2
// only when the visitor opens it (never in the page's HTML), set like a page
// of a book. It opens without sound. While its story plays, the spoken word is
// inked and underlined from the voice's character alignment and a bracket in
// the margin holds its sentence (the paragraph where the alignment does not
// fit), paced by frame; the view follows the voice until the visitor scrolls away.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useScreenWakeLock } from '@client/hooks/useScreenWakeLock';
import {
  audioTime,
  closeReader,
  getState,
  markRead,
  openReader,
  openSheet,
  playFrom,
  playStory,
  readProgress,
  saveSentence,
  removeSaved,
  seekTo,
  setAway,
  stepRate,
  togglePlay,
} from './controller';
import { cleanFact, loadFacts, loadText, loadTiming } from './content';
import type { FactEntry, StoryTiming, TextBlock } from './content';
import { blockAt, buildModel, paragraphStep, sentenceStart, wordAt } from './readalong';
import type { ReaderModel } from './readalong';
import { getDisplay, subscribeDisplay, SERVER_DISPLAY } from './theme';
import { Icon } from './icons';
import { shareStory } from './page';
import { takeFocus } from './focus';
import { showToast } from './toast';
import { LIST_SEP, VOICE_DESC_ID, clockLabel, labelHalves, playerStrings } from './strings';
import type { PlayerState, StoryQueue } from './types';

interface Props {
  state: PlayerState;
  queue: StoryQueue;
  n: number;
  label: { brief: string; expanded: string };
  factsWord: string;
  documentedWord: string;
  recreatedWord: string;
}

const LINE_HEIGHT = { tight: 1.45, normal: 1.62, airy: 1.85 } as const;

function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return wide;
}

export default function StoryReader({ state, queue, n, label, factsWord, documentedWord, recreatedWord }: Props) {
  const s = playerStrings(queue.lang);
  const display = useSyncExternalStore(subscribeDisplay, getDisplay, () => SERVER_DISPLAY);
  const wide = useWide();
  const [blocks, setBlocks] = useState<TextBlock[] | null>(null);
  const [timing, setTiming] = useState<StoryTiming | null>(null);
  const [failed, setFailed] = useState(false);
  const [facts, setFacts] = useState<FactEntry | null>(null);
  const [pop, setPop] = useState<{ si: number; left: number; top: number } | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLElement | null>(null);
  const progRef = useRef<HTMLElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);
  const endRef = useRef<HTMLElement | null>(null);
  const bracketRef = useRef<HTMLSpanElement | null>(null);
  const programmaticUntil = useRef(0);
  const lit = useRef<{ w: number; si: number; bi: number | null }>({ w: -1, si: -1, bi: null });

  const here = state.current === n && !state.dismissed;
  const playingHere = here && (state.status === 'playing' || state.status === 'loading');
  const entry = queue.entries.find(e => e.n === n);

  // ---- content, fetched on open ----
  useEffect(() => {
    let live = true;
    setBlocks(null);
    setTiming(null);
    setFailed(false);
    setFacts(null);
    setPop(null);
    lit.current = { w: -1, si: -1, bi: null };
    loadText(queue, n).then(b => live && setBlocks(b)).catch(() => live && setFailed(true));
    loadTiming(queue, n).then(t => live && setTiming(t)).catch(() => live && setTiming({}));
    loadFacts(queue).then(f => live && setFacts(f.stories.get(n) ?? null)).catch(() => undefined);
    scrollRef.current?.scrollTo({ top: 0 });
    return () => {
      live = false;
    };
    // the queue's figure and language name the content; its object may be rebuilt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.figureId, queue.lang, n]);

  const model: ReaderModel | null = useMemo(
    () => (blocks ? buildModel(blocks, timing ?? {}, n === 0) : null),
    [blocks, timing, n],
  );

  useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, []);

  // ---- the reader follows the voice into the next story ----
  const nowCurrent = state.current;
  const nowDismissed = state.dismissed;
  const prevCurrent = useRef(nowCurrent);
  useEffect(() => {
    const before = prevCurrent.current;
    prevCurrent.current = nowCurrent;
    if (before === n && nowCurrent !== null && nowCurrent === n + 1 && !nowDismissed) openReader(nowCurrent);
  }, [nowCurrent, nowDismissed, n]);

  // ---- display settings onto the page ----
  useLayoutEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const size = display.size ?? (wide ? 21 : 19);
    el.style.setProperty('--sp-read-size', `${size / 16}rem`);
    el.style.setProperty('--sp-read-lh', String(LINE_HEIGHT[display.spacing]));
  }, [display.size, display.spacing, wide]);

  // ---- the voice: light the sentence, mark the word ----
  const follow = useCallback((force: boolean) => {
    const box = scrollRef.current;
    const body = bodyRef.current;
    if (!box || !body) return;
    const on = body.querySelector<HTMLElement>('.s.on') ?? body.querySelector<HTMLElement>('p.on');
    if (!on) return;
    const r = on.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (!force && r.top >= b.top + 40 && r.bottom <= b.bottom - 40) return;
    programmaticUntil.current = Date.now() + 800;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollBy({ top: r.top - (b.top + b.height * 0.3), behavior: reduce || force ? 'auto' : 'smooth' });
  }, []);

  // The bracket in the margin spans the lit sentence (or paragraph), measured from its line boxes.
  const placeBracket = useCallback(() => {
    const br = bracketRef.current;
    const page = pageRef.current;
    const on = bodyRef.current?.querySelector<HTMLElement>('.s.on') ?? bodyRef.current?.querySelector<HTMLElement>('p.on');
    if (!br || !page) return;
    const rects = on ? [...on.getClientRects()].filter(r => r.width > 0 && r.height > 0) : [];
    br.classList.toggle('is-on', rects.length > 0);
    if (!rects.length) return;
    const top = Math.min(...rects.map(r => r.top));
    const bottom = Math.max(...rects.map(r => r.bottom));
    br.style.setProperty('top', `${top - page.getBoundingClientRect().top}px`);
    br.style.setProperty('height', `${bottom - top}px`);
  }, []);

  /** Mark the voice's place at time t; true when the sentence or paragraph changed. */
  const paint = useCallback((t: number): boolean => {
    const body = bodyRef.current;
    if (!body || !model) return false;
    let changed = false;
    if (model.mode === 'word') {
      const w = wordAt(model, t);
      if (w !== lit.current.w) {
        body.querySelector(`.w[data-wi="${lit.current.w}"]`)?.classList.remove('on');
        if (w >= 0) body.querySelector(`.w[data-wi="${w}"]`)?.classList.add('on');
        const si = w >= 0 ? model.words[w]!.si : -1;
        if (si !== lit.current.si) {
          body.querySelector(`.s[data-si="${lit.current.si}"]`)?.classList.remove('on');
          if (si >= 0) body.querySelector(`.s[data-si="${si}"]`)?.classList.add('on');
          changed = true;
        }
        lit.current = { w, si, bi: null };
      }
    } else if (model.mode === 'paragraph') {
      const bi = blockAt(model, t);
      if (bi !== lit.current.bi) {
        body.querySelector(`p[data-b="${lit.current.bi}"]`)?.classList.remove('on');
        if (bi !== null) body.querySelector(`p[data-b="${bi}"]`)?.classList.add('on');
        lit.current = { w: -1, si: -1, bi };
        changed = true;
      }
    }
    if (changed) placeBracket();
    return changed;
  }, [model, placeBracket]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !model) return;
    if (!here) {
      body.querySelectorAll('.on').forEach(el => el.classList.remove('on'));
      lit.current = { w: -1, si: -1, bi: null };
      placeBracket();
      return;
    }
    if (paint(state.time) && display.follow && !state.away) follow(false);
  }, [state.time, here, model, display.follow, state.away, follow, paint, placeBracket]);

  // While the voice plays here, the marks follow it every frame: timeupdate comes about every 250 ms, and at 2x a
  // word is shorter than that. requestAnimationFrame stops by itself in a hidden tab.
  const followNow = useRef({ on: display.follow, away: state.away });
  useEffect(() => {
    followNow.current = { on: display.follow, away: state.away };
  }, [display.follow, state.away]);
  const framed = here && state.status === 'playing' && !!model && model.mode !== 'none';
  // Reading along, the screen stays on; released on pause, on close and in a hidden tab (the hook takes it back on return).
  useScreenWakeLock(here && state.status === 'playing');
  useEffect(() => {
    if (!framed) return;
    let raf = 0;
    const tick = () => {
      if (paint(audioTime()) && followNow.current.on && !followNow.current.away) follow(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [framed, paint, follow]);

  // The bracket is measured again whenever the text reflows: size, spacing, face, a font arriving, a new width.
  useEffect(() => {
    const body = bodyRef.current;
    placeBracket();
    if (!body || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => placeBracket());
    ro.observe(body);
    return () => ro.disconnect();
  }, [model, display.size, display.spacing, display.face, placeBracket]);

  // "To the voice" from the dock: back at once. A return the reader made by scrolling resumes where it stands.
  const wasAway = useRef(state.away);
  const quietReturn = useRef(false);
  useEffect(() => {
    if (wasAway.current && !state.away && here && !quietReturn.current) follow(true);
    quietReturn.current = false;
    wasAway.current = state.away;
  }, [state.away, here, follow]);

  // Away from the voice: which way it is, and a return once the spoken line has stood in the middle band (a quarter
  // to three quarters of the view) for about a second, so a reader scrolling past it is not pulled back.
  const backTimer = useRef<number | undefined>(undefined);
  const whereVoice = useCallback(() => {
    const box = scrollRef.current?.getBoundingClientRect();
    const on = bodyRef.current?.querySelector<HTMLElement>('.s.on') ?? bodyRef.current?.querySelector<HTMLElement>('p.on');
    if (!box || !on) return null;
    const r = on.getBoundingClientRect();
    const mid = r.top + Math.min(r.height, 60) / 2;
    if (mid < box.top + box.height * 0.25) return r.bottom < box.top ? 'up' : 'near';
    if (mid > box.top + box.height * 0.75) return r.top > box.bottom ? 'down' : 'near';
    return 'middle';
  }, []);
  const checkAway = useCallback(() => {
    const at = whereVoice();
    if (at === 'up' || at === 'down') setAway(true, at);
    if (at === 'middle') {
      if (backTimer.current === undefined) {
        backTimer.current = window.setTimeout(() => {
          backTimer.current = undefined;
          if (getState().away && whereVoice() === 'middle') {
            quietReturn.current = true;
            setAway(false);
          }
        }, 1000);
      }
    } else if (backTimer.current !== undefined) {
      window.clearTimeout(backTimer.current);
      backTimer.current = undefined;
    }
  }, [whereVoice]);
  useEffect(() => () => window.clearTimeout(backTimer.current), []);
  useEffect(() => {
    if (state.away && here) checkAway();
  }, [state.away, state.time, here, checkAway]);

  // ---- progress line: the voice while it plays here, else the scroll ----
  useEffect(() => {
    const bar = progRef.current;
    if (!bar) return;
    if (here && state.duration > 0) bar.style.width = `${Math.min(100, (state.time / state.duration) * 100)}%`;
  }, [here, state.time, state.duration]);

  const onScroll = () => {
    const box = scrollRef.current;
    const bar = progRef.current;
    if (box && bar && !here) bar.style.width = `${(box.scrollTop / Math.max(1, box.scrollHeight - box.clientHeight)) * 100}%`;
    if (pop) setPop(null);
    if (state.away && here) checkAway();
  };
  const onUserScroll = () => {
    if (Date.now() < programmaticUntil.current) return;
    if (playingHere && display.follow && !state.away && model?.mode !== 'none') {
      const at = whereVoice();
      setAway(true, at === 'down' ? 'down' : 'up');
    }
  };

  // ---- read to the end counts as finished ----
  useEffect(() => {
    const end = endRef.current;
    if (!end || !blocks || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        markRead(n);
        io.disconnect();
      }
    }, { root: scrollRef.current, threshold: 0.2 });
    io.observe(end);
    return () => io.disconnect();
  }, [blocks, n]);

  // ---- a saved sentence to show ----
  useEffect(() => {
    if (!model) return;
    const si = takeFocus(n);
    if (si === null) return;
    const el = bodyRef.current?.querySelector<HTMLElement>(`.s[data-si="${si}"]`);
    el?.scrollIntoView({ block: 'center' });
    el?.classList.add('is-picked');
  }, [model, n]);

  // ---- keys ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, .sp-sheet')) return;
      if (e.key === 'Escape') {
        if (pop) setPop(null);
        else closeReader();
        return;
      }
      if (e.key === ' ' && here && !target?.closest('button, a, summary')) {
        e.preventDefault();
        togglePlay();
        return;
      }
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && here && model && model.mode !== 'none' && !target?.closest('button, a')) {
        e.preventDefault();
        const cur = Math.max(0, lit.current.si);
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = e.shiftKey ? paragraphStep(model, cur, dir) : Math.max(0, Math.min(model.sentences.length - 1, cur + dir));
        seekTo(sentenceStart(model, next) + 0.01);
        return;
      }
      if ((e.key === '+' || e.key === '=' || e.key === '-' || e.key === '−') && here && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        stepRate(e.key === '-' || e.key === '−' ? -1 : 1);
        return;
      }
      if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey) keepCurrent();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // ---- sentences: tap, popover, keep ----
  const sentenceInView = (): number => {
    if (here && lit.current.si >= 0) return lit.current.si;
    const box = scrollRef.current?.getBoundingClientRect();
    const top = (box?.top ?? 0) + 8;
    for (const el of Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('.s') ?? [])) {
      if (el.getBoundingClientRect().bottom > top) return Number(el.dataset.si);
    }
    return 0;
  };
  const keep = (si: number) => {
    const text = model?.sentences[si]?.text;
    if (!text) return;
    const added = saveSentence(n, si, text);
    showToast(s.kept, added ? { label: s.undo, run: () => removeSaved(n, si) } : undefined, { label: s.showSaved, run: () => openSheet('saved') });
  };
  const keepCurrent = () => keep(sentenceInView());

  const onTextClick = (e: ReactMouseEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    const sentence = target?.closest<HTMLElement>('.s');
    if (!sentence || !model) {
      setPop(null);
      return;
    }
    const si = Number(sentence.dataset.si);
    if (playingHere && model.mode !== 'none') {
      seekTo(sentenceStart(model, si));
      setAway(false);
      return;
    }
    const page = pageRef.current?.getBoundingClientRect();
    const rects = sentence.getClientRects();
    const lastRect = rects[rects.length - 1] ?? sentence.getBoundingClientRect();
    const firstRect = rects[0] ?? lastRect;
    if (!page) return;
    const width = 280;
    const popH = 56;
    // any scroll closes the popover, so it opens above the sentence when the dock and the toast leave no room below
    const dockH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sp-dock-h')) || 0;
    const boxBottom = scrollRef.current?.getBoundingClientRect().bottom ?? window.innerHeight;
    const floor = Math.min(boxBottom, window.innerHeight - dockH) - 70;
    const below = lastRect.bottom + 8 + popH <= floor;
    const anchor = below ? lastRect : firstRect;
    setPop({
      si,
      left: Math.max(0, Math.min(page.width - width, anchor.left - page.left)),
      top: below ? lastRect.bottom - page.top + 8 : firstRect.top - page.top - 8 - popH,
    });
  };

  // the sentence a popover is about, marked while it is open
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !pop) return;
    const el = body.querySelector(`.s[data-si="${pop.si}"]`);
    el?.classList.add('is-picked');
    return () => el?.classList.remove('is-picked');
  }, [pop]);

  const savedHere = state.saved.filter(x => x.n === n).map(x => x.si);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.querySelectorAll('.s.is-saved').forEach(el => el.classList.remove('is-saved'));
    savedHere.forEach(si => body.querySelector(`.s[data-si="${si}"]`)?.classList.add('is-saved'));
  });

  // ---- the head ----
  const heading = n === 0 ? model?.blocks.find(b => b.heading) : undefined;
  const headingText = heading ? blocks?.[model!.blocks.indexOf(heading)]?.text : undefined;
  const title = n === 0 ? headingText ?? s.introTitle : entry?.title ?? s.storyN(n);
  const kicker = n === 0
    ? [s.introTitle, entry?.minutes ? s.minutes(entry.minutes) : ''].filter(Boolean).join(LIST_SEP)
    : [s.storyN(n), entry?.year ? s.approxYear(entry.year) : '', entry?.place, entry?.age ? s.ageAt(entry.age) : '', entry?.minutes ? s.minutes(entry.minutes) : ''].filter(Boolean).join(LIST_SEP);
  const kept = here ? null : readProgress(queue, n);
  const nextEntry = queue.entries.find(e => e.n === n + 1);
  const firstParagraph = model?.blocks.find(b => !b.rule && !b.heading);
  const sideOpen = wide && (state.sheet === 'facts' || state.sheet === 'display' || state.sheet === 'saved');

  const renderBlock = (b: ReaderModel['blocks'][number], bi: number) => {
    if (b.heading) return null;
    if (b.rule) return <hr key={bi} className="story-reader__rule" />;
    return (
      <p key={bi} data-b={b.index} className={b === firstParagraph ? 'is-first' : undefined}>
        {b.sentences.map((si, k) => {
          const sent = model!.sentences[si]!;
          const words = [];
          for (let w = sent.first; w <= sent.last; w += 1) {
            words.push(<span key={w} className="w" data-wi={w}>{model!.words[w]!.text}</span>);
            if (w < sent.last) words.push(' ');
          }
          return (
            <span key={si}>
              {k > 0 ? ' ' : ''}
              <span className="s" data-si={si}>{words}</span>
            </span>
          );
        })}
      </p>
    );
  };

  return (
    <section
      ref={readerRef}
      className={`story-reader${sideOpen ? ' has-side' : ''}${playingHere ? ' is-playing' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-label={s.readerAria}
      data-hl={display.highlight}
      data-strong={display.strong ? 'on' : 'off'}
      data-face={display.face}
      data-nosnippet=""
    >
      <div className="story-reader__bar">
        <div className="story-reader__bar-in">
          <button ref={backRef} type="button" className="story-btn story-reader__back" onClick={closeReader} aria-label={s.backToAria(queue.name)}>
            {Icon.back}
            <span>{queue.name}</span>
          </button>
          <span className="story-reader__bartitle">{title}</span>
          <span className="story-reader__sp" />
          <span className="story-reader__tools">
            <button type="button" className="story-btn story-reader__facts" onClick={() => openSheet('facts', n)} aria-haspopup="dialog">
              {Icon.checkCircle}
              <span>{factsWord}</span>
            </button>
            <button type="button" className="story-btn story-reader__mark" onClick={keepCurrent} aria-label={s.bookmark}>
              {Icon.mark}
            </button>
            <button type="button" className="story-btn story-reader__aa" onClick={() => openSheet('display')} aria-label={s.display} aria-haspopup="dialog">
              Aa
            </button>
          </span>
        </div>
        <div className="story-reader__prog" aria-hidden="true"><i ref={progRef} /></div>
      </div>

      <div
        ref={scrollRef}
        className="story-reader__scroll"
        onScroll={onScroll}
        onWheel={onUserScroll}
        onTouchMove={onUserScroll}
        tabIndex={-1}
      >
        <article ref={pageRef} className="story-reader__page">
          <span ref={bracketRef} className="story-reader__bracket" aria-hidden="true" />
          <header className="story-reader__head">
            <p className="story-reader__kicker">{kicker}</p>
            <h2 className="story-reader__title">{title}</h2>
            <p className="story-reader__note">{s.retellingNote(!!queue.she)}</p>
            <details className="story-label sp-label">
              <summary>
                <span className="sp-label__i" aria-hidden="true">i</span>
                <span className="sp-label__brief">
                  {labelHalves(label.brief).map((half, i) => (
                    <span key={i}>{i > 0 ? ' ' : ''}<span className="sp-label__half">{half}</span></span>
                  ))}
                </span>
              </summary>
              <p>{label.expanded}</p>
            </details>
            {!here && (
              <button type="button" className="sp-act sp-act--main story-reader__listen" onClick={() => playStory(queue, n)} aria-describedby={VOICE_DESC_ID}>
                <span className="sp-act__disc" aria-hidden="true">{Icon.play}</span>
                <span className="sp-act__words">
                  <span className="sp-act__t">{kept ? s.continueFrom : s.listen}</span>
                  <span className="sp-act__s">{kept ? s.fromTime(clockLabel(kept.t)) : entry?.minutes ? s.minutes(entry.minutes) : ''}</span>
                </span>
              </button>
            )}
          </header>
          <div className="story-reader__orn" aria-hidden="true"><span /></div>
          <div ref={bodyRef} className="story-reader__body" lang={queue.lang} onClick={onTextClick}>
            {failed && <p className="story-reader__status">{s.textError}</p>}
            {!failed && !model && <p className="story-reader__status" aria-live="polite">{s.textLoading}</p>}
            {model?.blocks.map(renderBlock)}
          </div>
          {pop && (
            <div className="story-reader__pop" ref={el => {
              el?.style.setProperty('left', `${pop.left}px`);
              el?.style.setProperty('top', `${pop.top}px`);
            }}>
              <button type="button" aria-describedby={VOICE_DESC_ID} onClick={() => {
                const si = pop.si;
                setPop(null);
                if (model) playFrom(queue, n, sentenceStart(model, si));
              }}>{Icon.play}<span>{s.fromHere}</span></button>
              <button type="button" onClick={() => {
                const si = pop.si;
                setPop(null);
                keep(si);
              }}>{Icon.mark}<span>{s.keep}</span></button>
            </div>
          )}
          {model && (
            <footer ref={endRef} className="story-reader__end">
              {facts && (facts.documented.length > 0 || facts.recreated.length > 0) && (
                <section className="story-reader__ledger">
                  <h3>{s.ledgerTitle}</h3>
                  {facts.documented.length > 0 && (
                    <div className="sp-facts__list sp-facts__list--doc">
                      <h4>{Icon.checkCircle}<span>{documentedWord}</span></h4>
                      <ul>{facts.documented.map((x, i) => <li key={i}>{cleanFact(x)}</li>)}</ul>
                    </div>
                  )}
                  {facts.recreated.length > 0 && (
                    <div className="sp-facts__list sp-facts__list--rec">
                      <h4>{Icon.pencil}<span>{recreatedWord}</span></h4>
                      <ul>{facts.recreated.map((x, i) => <li key={i}>{cleanFact(x)}</li>)}</ul>
                    </div>
                  )}
                </section>
              )}
              {nextEntry ? (
                <div className="story-reader__next">
                  <p className="story-reader__nextk">{s.nextUp}</p>
                  <p className="story-reader__nextt">{`${s.storyN(nextEntry.n)} · ${nextEntry.title}`}</p>
                  <div className="sp-acts sp-acts--two">
                    <button type="button" className="sp-act sp-act--main" onClick={() => playStory(queue, nextEntry.n)} aria-describedby={VOICE_DESC_ID}>
                      <span className="sp-act__disc" aria-hidden="true">{Icon.play}</span>
                      <span className="sp-act__words">
                        <span className="sp-act__t">{s.listen}</span>
                        <span className="sp-act__s">{nextEntry.minutes ? s.minutes(nextEntry.minutes) : ''}</span>
                      </span>
                    </button>
                    <button type="button" className="sp-act" onClick={() => openReader(nextEntry.n)}>
                      {Icon.book}<span>{s.read}</span>
                    </button>
                  </div>
                </div>
              ) : (queue.related?.length ?? 0) > 0 && (
                <div className="story-reader__next">
                  <p className="story-reader__nextk">{s.afterLast}</p>
                  <ul className="story-reader__lives">
                    {queue.related!.slice(0, 2).map(life => (
                      <li key={life.href}><a href={life.href}>{life.name}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="story-reader__share">
                <button type="button" className="sp-linkbtn" onClick={() => shareStory(queue, n)}>{Icon.share}<span>{s.shareStory}</span></button>
              </p>
            </footer>
          )}
        </article>
      </div>
    </section>
  );
}
