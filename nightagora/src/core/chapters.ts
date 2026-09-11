/* HIS NIGHTS — the twelve chapters, told at the crossed-log fire. Real R2
   audio, chapter one enters the story. The Echo-voice law holds in the
   colophon; the ambient bed ducks while a night is told (the same na-voice
   event the council uses).

   THE OBJECT (2026-07-26): this is not a player, it is a LEAF. A table of
   contents, set like letterpress, standing in the camp on the same side as
   the fire that opened it. So: no box, no card, no border. The night's own
   abyss is feathered in behind the type, one gold hairline runs down the
   bound edge where the fire catches it, and the rules at the head and the
   foot fade out at their ends the way a cut rule does. Everything else is
   type.

   Why the twelve carry NAMES now (the founder's bar: a body of work): twelve
   numerals in boxes is a track selector with the labels missing. The twelve
   titles below are the ones the library already carries for him, so the leaf
   states what the nights ARE, and the column reads as a book.

   Why it stands to the side: the mark that opens it is at the campfire, off
   to one flank, and at his tent the host is already speaking in the middle
   of the frame. A panel in the centre covered both. The leaf belongs beside
   the fire, and the praetorium stays in the night.

   What may never be guessed: a chapter's length. The measure column is
   filled in only from the audio's own metadata, so a row shows a time after
   it has been opened and never before. */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const COUNT_WORD: Record<number, string> = { 10: 'Ten', 12: 'Twelve', 24: 'Twenty-four' }

interface Book {
  /** whose nights these are, for the head */
  figure: string
  /** the chapters, in the order he lived them */
  titles: string[]
}

/* The library's own titles for his twelve. A story is a body of work or it
   is a playlist, and the difference is whether the parts are named. */
const BOOKS: Record<string, Book> = {
  aurelius: {
    figure: 'Marcus Aurelius',
    titles: [
      'The Stoic Path',
      'Control of Impressions',
      'Living According to Nature',
      'The Four Virtues',
      'What Truly Matters',
      'Emotional Clarity',
      'Morning Preparation',
      'Duty and Service',
      'Universal Humanity',
      'View from Above',
      'Providence and Acceptance',
      'Death as Teacher',
    ],
  },
}

export interface ChaptersHandles {
  open(): void
  close(): void
  isOpen(): boolean
  /** drive the progress hairline from the frame loop */
  update(): void
}

/* THE PRESS. It ships from here, after the shell's own sheet, so equal-weight
   rules land on top of the plain staging the shell carries. Every colour is
   one of the night's tokens: the letterpress never invents a hue. */
const PRESS = `
#chapters {
  --leaf-ink: var(--na-lapis);
  --leaf-muted: color-mix(in srgb, var(--na-lapis) 72%, var(--na-mist));
  position: fixed; left: var(--frame-margin, 40px); right: auto;
  bottom: calc(88px + env(safe-area-inset-bottom));
  width: 410px; max-width: calc(100% - 40px);
  max-height: calc(100dvh - 170px);
  display: flex; flex-direction: column;
  padding: 26px 30px 20px 38px;
  border: none; border-radius: 0; backdrop-filter: none;
  color: var(--leaf-ink); isolation: isolate;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--press-paper) 84%, var(--na-mist)),
    var(--press-paper) 7%, var(--na-starlight) 28%, var(--press-paper));
  box-shadow: -5px 1px 0 color-mix(in srgb, var(--na-starlight) 38%, var(--na-lapis)),
    0 16px 45px color-mix(in srgb, var(--na-abyss) 28%, transparent);
  opacity: 0; transform: translateY(8px);
  transition: opacity .65s ease, transform .8s ease;
  font-optical-sizing: auto;
}
#chapters[hidden] { display: none; }
#chapters.up { opacity: 1; transform: none; }
/* Paper fibres are fixed CSS geometry, without an image or a filtered canvas. */
#chapters::before {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background:
    repeating-linear-gradient(3deg, transparent 0 3px, color-mix(in srgb, var(--na-lapis) 2%, transparent) 3px 4px),
    repeating-linear-gradient(93deg, transparent 0 5px, color-mix(in srgb, var(--na-lapis) 2%, transparent) 5px 6px);
}
#chapters::after {
  content: ''; position: absolute; top: 0; left: 12px; bottom: 0; width: 1px;
  pointer-events: none; background: color-mix(in srgb, var(--na-lapis) 14%, transparent);
}
#chapters .chapters-spine {
  position: absolute; left: -5px; top: 0; bottom: 0; width: 5px;
  background: linear-gradient(180deg, transparent, var(--na-gold) 60%, transparent);
  opacity: .22; pointer-events: none;
  transition: opacity 1s ease;
}
#chapters.telling .chapters-spine { opacity: .9; box-shadow: 0 0 22px color-mix(in srgb, var(--na-gold) 30%, transparent); }
#chapters .chapters-head { flex: none; padding-bottom: 17px; border-bottom: 1px solid color-mix(in srgb, var(--na-lapis) 40%, transparent); }
#chapters .chapters-kicker {
  font-family: var(--press-display, Georgia, serif); font-size: 40px; font-weight: 400;
  letter-spacing: -.025em; text-indent: 0; line-height: 1.05;
  text-transform: none; color: var(--leaf-ink); text-shadow: none;
}
#chapters .chapters-of {
  margin-top: 10px; font-family: var(--press-ui, sans-serif); font-size: 11px;
  letter-spacing: .07em; text-transform: none; line-height: 1.5;
  color: var(--leaf-muted);
}
#chapters .chapters-list {
  min-height: 0; flex: 1 1 auto; margin-top: 7px;
  display: flex; flex-direction: column; flex-wrap: nowrap; gap: 0;
  overflow-y: auto; overscroll-behavior: contain;
  scrollbar-width: thin; scrollbar-color: var(--na-mist) transparent;
}
#chapters .chapter-btn {
  position: relative; flex: none; display: grid;
  grid-template-columns: 23px minmax(0,1fr) auto;
  align-items: center; gap: 12px;
  width: 100%; min-height: 44px;
  padding: 8px 0; text-align: left; text-indent: 0;
  background: none; border: none; border-radius: 0;
  box-shadow: none; text-transform: none; cursor: pointer;
}
#chapters .chapter-btn::after {
  content: ''; position: absolute; left: 35px; right: 0; bottom: 0; height: 1px;
  background: color-mix(in srgb, var(--na-lapis) 12%, transparent);
}
#chapters .chapter-btn:last-child::after { display: none; }
#chapters .chapter-num {
  font-family: var(--press-register, Georgia, serif); font-size: 11px;
  font-variant-numeric: lining-nums tabular-nums; letter-spacing: .04em;
  line-height: 1; text-align: right; color: var(--leaf-muted);
}
#chapters .chapter-name {
  font-family: var(--press-display, Georgia, serif); font-size: 17px;
  line-height: 1.25; letter-spacing: -.01em;
  color: var(--leaf-ink); text-shadow: none;
  font-variant-ligatures: common-ligatures;
}
#chapters .chapter-measure {
  font-family: var(--press-ui, sans-serif); font-size: 10px;
  font-variant-numeric: tabular-nums; letter-spacing: 0;
  color: var(--leaf-muted); white-space: nowrap;
}
#chapters .chapter-btn:hover, #chapters .chapter-btn:focus-visible,
#chapters .chapter-btn.playing {
  background: radial-gradient(ellipse at left, color-mix(in srgb, var(--na-gold) 27%, transparent), transparent 72%);
  box-shadow: none; border: none;
}
#chapters .chapter-btn:focus-visible { outline: 1px solid var(--leaf-muted); outline-offset: -2px; }
#chapters .chapter-cut { position: absolute; left: 0; width: 2px; height: 20px; background: var(--na-lapis); opacity: 0; }
#chapters .chapter-btn.playing .chapter-cut, #chapters .chapter-btn:focus-visible .chapter-cut { opacity: 1; }
#chapters .chapter-btn.heard .chapter-num { opacity: .6; }
#chapters .chapters-progress {
  position: absolute; left: 35px; right: 0; top: auto; bottom: 0;
  height: 1px; width: calc(100% - 35px); transform-origin: left center;
  transform: scaleX(0); background: var(--na-gold-deep); box-shadow: none;
}
#chapters .chapters-bar {
  flex: none; display: flex; align-items: center; gap: 10px;
  margin-top: 10px; padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--na-lapis) 40%, transparent);
}
#chapters .chapters-toggle, #chapters .chapters-close {
  min-width: 44px; min-height: 44px; padding: 8px 0;
  font-family: var(--press-ui, sans-serif); font-size: 13px;
  text-transform: none; letter-spacing: .04em; text-indent: 0;
  color: var(--leaf-ink);
}
#chapters .chapters-toggle { padding-right: 8px; }
#chapters .chapters-close { padding-left: 8px; }
#chapters .chapters-toggle:focus-visible, #chapters .chapters-close:focus-visible { outline: 1px solid var(--leaf-ink); outline-offset: 2px; }
#chapters .chapters-now {
  flex: 1; font-family: var(--press-ui, sans-serif); font-size: 10px;
  font-variant-numeric: tabular-nums; letter-spacing: .02em; text-transform: none;
  text-align: center; color: var(--leaf-muted);
}
#chapters.failed .chapters-now { white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.4; }
#chapters .chapters-ink {
  flex: none; margin-top: 5px; font-family: var(--press-ui, sans-serif);
  font-size: 9px; line-height: 1.5; letter-spacing: .025em;
  text-transform: none; color: var(--leaf-muted); text-shadow: none;
}
#chapters .chapters-ink-line { display: block; }
#chapters.yielded { visibility: hidden; opacity: 0; pointer-events: none; }
@media (max-width:620px) {
  #chapters {
    left: 20px; right: 20px; width: auto; max-width: none;
    bottom: calc(78px + env(safe-area-inset-bottom));
    max-height: calc(100dvh - 142px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    padding: 17px 22px 14px 28px;
  }
  #chapters .chapters-kicker { font-size: 34px; }
  #chapters .chapters-head { padding-bottom: 10px; }
  #chapters .chapters-of { margin-top: 7px; font-size: 10px; }
  #chapters .chapter-name { font-size: 15.5px; }
  #chapters .chapter-btn { gap: 9px; grid-template-columns: 22px minmax(0,1fr) auto; }
  #chapters .chapter-btn::after { left: 31px; }
  #chapters .chapters-bar { margin-top: 4px; padding-top: 3px; }
  #chapters .chapters-ink { font-size: 8.5px; }
}
@media (prefers-reduced-motion:reduce) { #chapters, #chapters * { transition: none; animation: none; } }
body.forge #chapters, body.forge #chapters * { transition: none !important; animation: none !important; }
`

function ensurePress(): void {
  if (document.getElementById('chapters-press')) return
  const sheet = document.createElement('style')
  sheet.id = 'chapters-press'
  sheet.textContent = PRESS
  document.head.appendChild(sheet)
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

/** a measure, set the way a clock is read */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function createChapters(slug: string, count: number): ChaptersHandles {
  const panel = document.getElementById('chapters')
  if (!panel) throw new Error('missing chapters shell')
  ensurePress()
  const panelEl: HTMLElement = panel
  const list = panelEl.querySelector('.chapters-list') as HTMLElement | null
  const toggle = panelEl.querySelector('.chapters-toggle') as HTMLButtonElement | null
  const now = panelEl.querySelector('.chapters-now') as HTMLElement | null
  const progress = panelEl.querySelector('.chapters-progress') as HTMLElement | null
  const closeBtn = panelEl.querySelector('.chapters-close') as HTMLButtonElement | null
  const kicker = panelEl.querySelector('.chapters-kicker') as HTMLElement | null
  const colophon = panelEl.querySelector('.chapters-ink') as HTMLElement | null

  const book = BOOKS[slug]
  const audio = new Audio()
  audio.preload = 'none'
  let current = -1
  let lastClock = ''
  let lastProgress = ''
  let playRequest = 0
  let returnFocus: HTMLElement | null = null
  /** a night that could not be fetched: the foot holds the truth until the
      visitor asks for another one (without this, the next frame's clock
      wrote the failure straight back out of the leaf) */
  let failed = false
  const buttons: HTMLButtonElement[] = []
  const measures: HTMLElement[] = []
  /** what a night actually ran, once its own metadata said so. Never guessed. */
  const lengths: number[] = []
  const heard: boolean[] = []

  // ---- the leaf, composed once ----
  panelEl.setAttribute('aria-label', 'His Nights')
  panelEl.setAttribute('role', 'dialog')
  now?.setAttribute('role', 'status')
  const spine = el('span', 'chapters-spine')
  spine.setAttribute('aria-hidden', 'true')
  panelEl.insertBefore(spine, panelEl.firstChild)
  if (kicker) {
    kicker.textContent = 'His Nights'
    const head = el('div', 'chapters-head')
    panelEl.insertBefore(head, kicker)
    head.appendChild(kicker)
    const nights = COUNT_WORD[count] ?? String(count)
    head.appendChild(
      el('p', 'chapters-of', book ? `${book.figure} · ${nights} nights` : `${nights} nights`)
    )
  }
  // the colophon leaves the head and goes to the foot of the leaf, set as
  // two lines. The wording is the Echo law and does not change.
  if (colophon) {
    panelEl.appendChild(colophon)
    colophon.textContent = ''
    colophon.appendChild(el('span', 'chapters-ink-line', "Told in his Echo's voice"))
    colophon.appendChild(el('span', 'chapters-ink-line', 'An interpretation, not a recording'))
  }

  function announceVoice(playing: boolean): void {
    window.dispatchEvent(new CustomEvent('na-voice', { detail: playing }))
  }

  function chapterUrl(n: number): string {
    const id = String(n + 1).padStart(2, '0')
    return `https://media.agoracosmica.org/podcasts/agora-cosmica/${slug}/${id}.mp3`
  }

  /** write a row's measure from what has actually been measured */
  function setMeasure(n: number): void {
    const cell = measures[n]
    const len = lengths[n]
    if (cell) cell.textContent = len && len > 0 ? clock(len) : ''
  }

  function setNow(): void {
    const telling = current >= 0 && !audio.paused && !failed
    if (toggle)
      toggle.textContent =
        failed ? 'Try again'
        : telling ? 'Pause'
        : current < 0 ? 'Listen'
        : 'Resume'
    panelEl.classList.toggle('telling', telling)
    panelEl.classList.toggle('failed', failed)
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i]
      if (!b) continue
      b.classList.toggle('playing', i === current && telling)
      // the rule above the told line steps back with the rule below it
      b.classList.toggle('before-playing', i === current - 1 && telling)
      b.classList.toggle('heard', Boolean(heard[i]) && i !== current)
      if (i === current) b.setAttribute('aria-current', 'true')
      else b.removeAttribute('aria-current')
    }
    // the reading line follows the line being read
    const row = current >= 0 ? buttons[current] : null
    if (progress && row && progress.parentElement !== row) row.appendChild(progress)
    if (progress && current < 0) progress.style.transform = 'scaleX(0)'
    setClock()
  }

  /** the foot's own line: what has been spent of this night, and what it ran */
  function setClock(): void {
    if (!now || failed) return
    let text = ''
    if (current >= 0) {
      const len = lengths[current] ?? 0
      text =
        len > 0 ? `${clock(audio.currentTime)} of ${clock(len)}`
        : audio.paused ? ''
        : 'Loading the night'
    }
    if (text !== lastClock) {
      now.textContent = text
      lastClock = text
    }
  }

  function play(n: number): void {
    if (n < 0 || n >= count) return
    const retry = failed
    failed = false
    const request = ++playRequest
    if (current !== n || retry) {
      current = n
      audio.src = chapterUrl(n)
    }
    void audio.play().catch((error: unknown) => {
      if (request !== playRequest || panelEl.hidden) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      fail()
    })
    setNow()
  }

  function fail(): void {
    failed = true
    const said = 'That night could not be reached'
    if (now) now.textContent = said
    lastClock = said
    announceVoice(false)
    setNow()
  }

  if (list) {
    list.textContent = ''
    for (let i = 0; i < count; i++) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'chapter-btn'
      b.style.setProperty('--i', String(i))
      const numeral = ROMAN[i] ?? String(i + 1)
      const cut = el('span', 'chapter-cut')
      cut.setAttribute('aria-hidden', 'true')
      b.appendChild(cut)
      b.appendChild(el('span', 'chapter-num', numeral))
      b.appendChild(el('span', 'chapter-name', book?.titles[i] ?? `Chapter ${numeral}`))
      const measure = el('span', 'chapter-measure')
      b.appendChild(measure)
      b.addEventListener('click', () => play(i))
      list.appendChild(b)
      buttons.push(b)
      measures.push(measure)
      lengths.push(0)
      heard.push(false)
    }
  }

  toggle?.addEventListener('click', () => {
    if (current < 0) {
      play(0) // chapter one enters the story
      return
    }
    if (audio.paused) {
      play(current)
    } else audio.pause()
    setNow()
  })

  // the leaf's own measures: a length is written only when the audio says so
  audio.addEventListener('loadedmetadata', () => {
    if (current >= 0 && Number.isFinite(audio.duration)) {
      lengths[current] = audio.duration
      setMeasure(current)
    }
    setClock()
  })
  audio.addEventListener('playing', () => { announceVoice(true); setNow() })
  audio.addEventListener('pause', () => { announceVoice(false); setNow() })
  audio.addEventListener('error', fail)

  audio.addEventListener('ended', () => {
    announceVoice(false)
    if (current >= 0) heard[current] = true
    // the next night follows on its own, as nights do
    if (current >= 0 && current < count - 1) play(current + 1)
    else setNow()
  })

  function open(): void {
    if (!panelEl.hidden) return
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelEl.hidden = false
    setNow()
    // one frame for the leaf to exist before it rises
    requestAnimationFrame(() => {
      if (panelEl.hidden) return
      panelEl.classList.add('up')
      buttons[Math.max(0, current)]?.focus({ preventScroll: true })
    })
  }
  function close(): void {
    const hadFocus = panelEl.contains(document.activeElement)
    playRequest++
    panelEl.classList.remove('up')
    panelEl.hidden = true
    audio.pause()
    announceVoice(false)
    setNow()
    panelEl.inert = false
    if (hadFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
  }
  closeBtn?.addEventListener('click', close)
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panelEl.hidden) close()
  })

  /* the leaf holds the frame: a hand reading it does not walk the camp out
     from under itself (the world listens to the same wheel and the same
     swipe) */
  panelEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })
  panelEl.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true })
  panelEl.addEventListener('pointerdown', (e) => e.stopPropagation())
  panelEl.addEventListener('click', (e) => e.stopPropagation())

  /** the host's sitting, if it is up: the one other block that can hold
      this frame at the same time as the leaf */
  const keeperEl = document.getElementById('keeper')

  function update(): void {
    if (panelEl.hidden) return
    // narrow stages give the frame to whoever is speaking
    const yielded = innerWidth < 620 && keeperEl !== null && !keeperEl.hidden
    panelEl.classList.toggle('yielded', yielded)
    panelEl.inert = yielded
    if (progress) {
      const ratio = audio.duration > 0 ? Math.min(1, audio.currentTime / audio.duration) : 0
      const next = `scaleX(${ratio.toFixed(4)})`
      if (next !== lastProgress) {
        progress.style.transform = next
        lastProgress = next
      }
    }
    setClock()
  }

  return { open, close, isOpen: () => !panelEl.hidden, update }
}
