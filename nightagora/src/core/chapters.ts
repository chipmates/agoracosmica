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
  position: fixed;
  left: clamp(22px, 4.4vw, 92px);
  right: auto;
  bottom: calc(104px + env(safe-area-inset-bottom));
  transform: none;
  /* clamped, not just capped: on a small laptop or a tablet in landscape a
     plain 38vw squeezed the titles into two lines each and the leaf grew a
     third taller */
  width: clamp(318px, 38vw, 394px);
  z-index: 6;
  padding: 2px 0 0 24px;
  background: none;
  border: none;
  backdrop-filter: none;
  text-rendering: optimizeLegibility;
  font-feature-settings: 'kern' 1, 'liga' 1;
}
/* the leaf's own air. Not a card: the night simply lies deeper where the
   page is. The field is thickest at the bound edge and thins away to
   nothing across the column, and it is feathered off at the head and the
   foot, so there is no boundary anywhere to find. A first pass put an
   ellipse behind the middle of the leaf and the eye read the shape it left
   as a rectangle (round 1), which is the exact failure this whole element
   is here to undo. */
#chapters::before {
  content: ''; position: absolute;
  left: -44px; top: -64px; right: -150px; bottom: -58px;
  z-index: -1; pointer-events: none;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--na-abyss) 88%, transparent) 0%,
    color-mix(in srgb, var(--na-abyss) 86%, transparent) 34%,
    color-mix(in srgb, var(--na-abyss) 74%, transparent) 56%,
    color-mix(in srgb, var(--na-abyss) 46%, transparent) 72%,
    color-mix(in srgb, var(--na-abyss) 18%, transparent) 86%,
    color-mix(in srgb, var(--na-abyss) 4%, transparent) 95%,
    transparent 100%);
  -webkit-mask-image: linear-gradient(180deg,
    transparent 0%, #000 15%, #000 84%, transparent 100%);
  mask-image: linear-gradient(180deg,
    transparent 0%, #000 15%, #000 84%, transparent 100%);
}
/* and the fire the leaf was opened at, pooling at its bound corner */
#chapters::after {
  content: ''; position: absolute;
  left: -44px; bottom: -58px; width: 70%; height: 34%;
  z-index: -1; pointer-events: none;
  background: radial-gradient(ellipse 62% 58% at 8% 92%,
    color-mix(in srgb, var(--na-gold-deep) 14%, transparent) 0%,
    transparent 74%);
}
/* the bound edge, where the fire finds it */
#chapters .chapters-spine {
  position: absolute; left: 0; top: 4px; bottom: 4px; width: 1px;
  pointer-events: none;
  background: linear-gradient(180deg,
    transparent 0%,
    color-mix(in srgb, var(--na-gold) 40%, transparent) 14%,
    color-mix(in srgb, var(--na-gold) 52%, transparent) 52%,
    color-mix(in srgb, var(--na-gold) 22%, transparent) 84%,
    transparent 100%);
}
/* while a night is told the bound edge carries a little of that fire */
#chapters.telling .chapters-spine {
  background: linear-gradient(180deg,
    transparent 0%,
    color-mix(in srgb, var(--na-gold) 58%, transparent) 14%,
    color-mix(in srgb, var(--na-gold) 74%, transparent) 52%,
    color-mix(in srgb, var(--na-gold) 30%, transparent) 84%,
    transparent 100%);
  box-shadow: 0 0 14px color-mix(in srgb, var(--na-gold) 22%, transparent);
}

/* ---- the head ---- */
#chapters .chapters-head { position: relative; padding-bottom: 11px; }
#chapters .chapters-head::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--na-gold) 46%, transparent) 0%,
    color-mix(in srgb, var(--na-gold) 30%, transparent) 62%,
    transparent 100%);
}
/* the head is cut, not labelled: serif capitals with inscription spacing.
   Sans caps here read as one more rail label in a night full of them. */
#chapters .chapters-kicker {
  font-family: var(--serif); font-weight: 400;
  font-size: 14px; letter-spacing: 0.2em; text-indent: 0.2em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--na-starlight) 94%, transparent);
  text-shadow: 0 1px 12px rgba(4, 6, 13, 0.9);
}
#chapters .chapters-of {
  margin-top: 7px;
  font-family: var(--sans);
  font-size: 8.5px; letter-spacing: 0.28em; text-indent: 0.28em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--na-mist) 88%, transparent);
  text-shadow: 0 1px 10px rgba(4, 6, 13, 0.9);
}
/* a night being told warms the head from behind, on a slow breath */
#chapters .chapters-head::before {
  content: ''; position: absolute;
  left: -18%; top: -46%; width: 92%; height: 210%;
  z-index: -1; pointer-events: none;
  opacity: 0;
  background: radial-gradient(ellipse 50% 42% at 22% 58%,
    color-mix(in srgb, var(--na-gold-deep) 20%, transparent) 0%,
    transparent 72%);
  transition: opacity 1.2s ease;
}
#chapters.telling .chapters-head::before {
  opacity: 1;
  animation: chapters-breath 3.6s ease-in-out infinite;
}
@keyframes chapters-breath {
  0%, 100% { opacity: 0.62; }
  50% { opacity: 1; }
}

/* ---- the twelve ---- */
#chapters .chapters-list {
  margin-top: 4px;
  display: flex; flex-direction: column; flex-wrap: nowrap; gap: 0;
}
#chapters .chapter-btn {
  position: relative;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center; gap: 0 14px;
  width: 100%; min-height: 44px; padding: 9px 2px 9px 0;
  background: none; border: none; border-radius: 0;
  text-align: left; cursor: pointer;
  text-transform: none;
  /* nothing on this line may be a box. The shell ships a chiclet (border,
     inset glow) and the leaf undoes all of it in one place, so a later
     hand editing the shell cannot quietly put the cell back. */
  box-shadow: none; outline: none;
  transition: background 0.5s ease;
}
#chapters .chapter-btn.playing, #chapters .chapter-btn:hover,
#chapters .chapter-btn:focus-visible { box-shadow: none; border: none; }
/* the ruled column of a table of contents, kept at a whisper and cut short
   of the right edge, so twelve of them read as rhythm and never as a table */
#chapters .chapter-btn::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--na-mist) 15%, transparent) 0%,
    color-mix(in srgb, var(--na-mist) 9%, transparent) 52%,
    transparent 100%);
}
#chapters .chapter-btn:last-child::after { background: none; }
/* the index numerals belong to the titles, so they are cut in the same face
   as them. In sans caps the column read as one more rail label in a night
   already full of them, instead of as a book's own index (the keeper's
   finding, applied here) */
#chapters .chapter-num {
  font-family: var(--serif);
  font-size: 11px; letter-spacing: 0.08em; line-height: 1;
  text-align: right; white-space: nowrap;
  color: color-mix(in srgb, var(--na-gold) 62%, transparent);
  transition: color 0.4s ease, text-shadow 0.4s ease;
}
#chapters .chapter-name {
  font-family: var(--serif);
  font-size: 15.5px; line-height: 1.25; letter-spacing: 0.012em;
  text-transform: none;
  color: color-mix(in srgb, var(--na-starlight) 76%, transparent);
  text-shadow: 0 1px 10px rgba(4, 6, 13, 0.85);
  transition: color 0.4s ease;
}
#chapters .chapter-measure {
  font-family: var(--sans);
  font-size: 8px; letter-spacing: 0.18em;
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--na-mist) 62%, transparent);
  white-space: nowrap;
}
#chapters .chapter-btn:hover .chapter-name,
#chapters .chapter-btn:focus-visible .chapter-name {
  color: var(--na-starlight);
}
#chapters .chapter-btn:hover .chapter-num,
#chapters .chapter-btn:focus-visible .chapter-num { color: var(--na-gold); }
#chapters .chapter-btn:focus-visible { outline: none; }
/* the focused line is marked the way a reader marks one, with a cut rule in
   the margin and never a browser ring. It lands ON the bound edge, so it has
   to be thicker than the edge it lights or it cannot be seen (round 7) */
#chapters .chapter-cut {
  position: absolute; left: -24px; top: 4px; bottom: 4px; width: 2px;
  background: var(--na-gold);
  box-shadow: 0 0 13px color-mix(in srgb, var(--na-gold) 70%, transparent);
  opacity: 0; transition: opacity 0.25s ease;
}
#chapters .chapter-btn:focus-visible .chapter-cut { opacity: 1; }
/* a night already told keeps its numeral, quieter */
#chapters .chapter-btn.heard .chapter-num {
  color: color-mix(in srgb, var(--na-gold) 34%, transparent);
}
#chapters .chapter-btn.heard .chapter-name {
  color: color-mix(in srgb, var(--na-starlight) 58%, transparent);
}
/* the night being told: the fire finds this one line. The pool has to hang
   OUTSIDE the row's own box, because a background painted on the row is
   clipped to it and the clip is a rectangle, which is what made the playing
   line read as a selected table cell in rounds 1 and 2. */
#chapters .chapter-btn.playing::before {
  content: ''; position: absolute;
  left: -30px; width: 230px; top: -13px; bottom: -13px;
  z-index: -1; pointer-events: none;
  /* the radii are lengths on purpose: a percentage ellipse in a box this
     wide spread the pool across the whole line and re-made the cell */
  background: radial-gradient(ellipse 96px 27px at 54px 50%,
    color-mix(in srgb, var(--na-gold-deep) 30%, transparent) 0%,
    color-mix(in srgb, var(--na-gold-deep) 11%, transparent) 46%,
    transparent 100%);
}
/* and the ruled lines let go of it: a line with a rule above and a rule
   below is a table cell no matter how it is lit (rounds 2 and 4) */
#chapters .chapter-btn.playing::after,
#chapters .chapter-btn.before-playing::after { background: none; }
#chapters .chapter-btn.playing .chapter-num {
  color: var(--na-gold);
  text-shadow: 0 0 11px color-mix(in srgb, var(--na-gold) 62%, transparent);
}
#chapters .chapter-btn.playing .chapter-name {
  color: var(--na-starlight);
}
#chapters .chapter-btn.playing .chapter-measure {
  color: color-mix(in srgb, var(--na-gold) 66%, transparent);
}
/* the reading line: the rule under the line being told, inking left to
   right as the night is spent */
#chapters .chapters-progress {
  position: absolute; left: 0; top: auto; bottom: 0;
  height: 1px; width: 0%;
  background: var(--na-gold);
  box-shadow: 0 0 9px color-mix(in srgb, var(--na-gold) 55%, transparent);
}

/* ---- the foot ---- */
#chapters .chapters-bar {
  position: relative;
  margin-top: 13px; padding-top: 11px;
  display: flex; align-items: center; gap: 12px;
  border-top: none;
}
#chapters .chapters-bar::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--na-gold) 40%, transparent) 0%,
    color-mix(in srgb, var(--na-gold) 24%, transparent) 58%,
    transparent 100%);
}
#chapters .chapters-toggle {
  min-height: 44px; padding: 8px 10px 8px 0;
  font-size: 9.5px; letter-spacing: 0.3em; text-indent: 0.3em;
  color: var(--na-gold);
  transition: color 0.3s ease, text-shadow 0.3s ease;
}
#chapters .chapters-toggle:hover, #chapters .chapters-toggle:focus-visible {
  outline: none;
  text-shadow: 0 0 14px color-mix(in srgb, var(--na-gold) 60%, transparent);
}
#chapters .chapters-now {
  flex: 1; text-align: right;
  font-family: var(--sans);
  font-size: 8.5px; letter-spacing: 0.2em;
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--na-mist) 78%, transparent);
}
/* a night that could not be fetched says so in full. The shell's foot line
   is a one-line clock with an ellipsis, and half a sentence about a failure
   is not an honest failure (the fail pass, phone). */
#chapters.failed .chapters-now {
  white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.5;
}
#chapters .chapters-close {
  min-height: 44px; padding: 8px 0 8px 12px;
  font-size: 8.5px; letter-spacing: 0.28em; text-indent: 0.28em;
  color: color-mix(in srgb, var(--na-mist) 78%, transparent);
}
/* the colophon sits at the foot of the leaf, where a colophon belongs. The
   wording is load-bearing (the Echo law) and does not move. */
#chapters .chapters-ink {
  margin-top: 12px;
  font-family: var(--sans);
  font-size: 7.5px; letter-spacing: 0.19em; line-height: 1.8;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--na-mist) 82%, transparent);
  text-shadow: 0 1px 8px rgba(4, 6, 13, 0.95);
}
/* the colophon is set as two lines by hand. Left to wrap it broke wherever
   the leaf happened to be narrow and left RECORDING sitting alone on a line
   of its own, and this is the one line on the leaf that may never look
   careless (round 9, the small-laptop stage). */
#chapters .chapters-ink-line { display: block; }

/* the host outranks the book. On a narrow stage his sitting and this leaf
   are the same piece of frame, and two letterpresses in one place is soup
   (round 6, phone at the praetorium), so the leaf steps back while he
   speaks and comes forward again when he is done. The night keeps being
   told the whole time. */
#chapters.up.yielded, #chapters.yielded { opacity: 0; pointer-events: none; }

/* ---- the arrival: the leaf rises from the fire it was opened at, and the
   lines ink in one after another. Nothing bounces. ---- */
#chapters { opacity: 0; transform: translateY(9px); transition: opacity 0.7s ease, transform 0.9s cubic-bezier(0.2, 0.7, 0.25, 1); }
#chapters.up { opacity: 1; transform: translateY(0); }
#chapters .chapter-btn, #chapters .chapters-bar, #chapters .chapters-ink {
  opacity: 0; transition: opacity 0.6s ease;
  transition-delay: calc(var(--i, 0) * 26ms + 120ms);
}
#chapters.up .chapter-btn, #chapters.up .chapters-bar, #chapters.up .chapters-ink { opacity: 1; }

/* ---- the phone: the leaf is laid at the foot of the frame, edge to edge,
   and the night thickens into it from below. Twelve 44px lines, the camp's
   sky still overhead. ---- */
@media (max-width: 620px) {
  #chapters {
    left: 0; right: 0; width: auto;
    bottom: calc(88px + env(safe-area-inset-bottom));
    padding: 4px max(20px, env(safe-area-inset-right)) 0
      calc(max(20px, env(safe-area-inset-left)) + 16px);
  }
  /* on the phone the leaf is the foot of the frame, so the night simply
     thickens into it from below: no side edges to find at all. It stops
     short of the rail, because burying the night's own two buttons under a
     page is not a composition (round 2). */
  #chapters::before {
    left: 0; right: 0; top: -84px; bottom: -30px;
    background: linear-gradient(180deg,
      transparent 0%,
      color-mix(in srgb, var(--na-abyss) 38%, transparent) 13%,
      color-mix(in srgb, var(--na-abyss) 76%, transparent) 28%,
      color-mix(in srgb, var(--na-abyss) 87%, transparent) 46%,
      color-mix(in srgb, var(--na-abyss) 87%, transparent) 88%,
      color-mix(in srgb, var(--na-abyss) 44%, transparent) 97%,
      transparent 100%);
    -webkit-mask-image: none;
    mask-image: none;
  }
  #chapters::after {
    left: 0; bottom: -30px; width: 76%; height: 30%;
    background: radial-gradient(ellipse 66% 60% at 4% 92%,
      color-mix(in srgb, var(--na-gold-deep) 13%, transparent) 0%,
      transparent 76%);
  }
  #chapters .chapters-spine {
    left: max(20px, env(safe-area-inset-left)); top: 10px; bottom: 10px;
  }
  /* the bound edge stands inside the frame here, so the focus mark that
     lights it moves with it */
  #chapters .chapter-cut { left: -16px; }
  #chapters .chapters-kicker { font-size: 13px; }
  #chapters .chapter-name { font-size: 14.5px; }
  #chapters .chapter-btn { padding: 8px 2px 8px 0; }
  #chapters .chapters-ink { margin-top: 10px; font-size: 7px; letter-spacing: 0.16em; }
}
/* short phones in the hand: the same leaf, one notch tighter, still 44px */
@media (max-width: 620px) and (max-height: 760px) {
  #chapters { bottom: calc(64px + env(safe-area-inset-bottom)); }
  #chapters .chapters-head { padding-bottom: 9px; }
  #chapters .chapter-name { font-size: 14px; }
  #chapters .chapters-bar { margin-top: 10px; padding-top: 9px; }
}

@media (prefers-reduced-motion: reduce) {
  /* the same composition, it simply arrives already composed */
  #chapters, #chapters .chapter-btn, #chapters .chapters-bar, #chapters .chapters-ink {
    transition: none; transform: none;
  }
  #chapters.telling .chapters-head::before { animation: none; opacity: 0.86; }
}
/* the rig shoots single moments: nothing may be caught mid-arrival */
body.forge #chapters, body.forge #chapters * {
  transition: none !important; animation: none !important;
}
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
    if (progress && current < 0) progress.style.width = '0%'
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
    failed = false
    if (current !== n) {
      current = n
      audio.src = chapterUrl(n)
    }
    void audio.play().catch(() => undefined)
    announceVoice(true)
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
      failed = false
      void audio.play().catch(() => undefined)
    } else audio.pause()
    announceVoice(!audio.paused)
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
  audio.addEventListener('playing', () => setNow())
  audio.addEventListener('pause', () => setNow())
  audio.addEventListener('error', () => {
    // an honest failure beats a silent one
    failed = true
    const said = 'That night could not be reached'
    if (now) now.textContent = said
    lastClock = said
    announceVoice(false)
    setNow()
  })

  audio.addEventListener('ended', () => {
    announceVoice(false)
    if (current >= 0) heard[current] = true
    // the next night follows on its own, as nights do
    if (current >= 0 && current < count - 1) play(current + 1)
    else setNow()
  })

  function open(): void {
    panelEl.hidden = false
    setNow()
    // one frame for the leaf to exist before it rises
    requestAnimationFrame(() => panelEl.classList.add('up'))
  }
  function close(): void {
    panelEl.classList.remove('up')
    panelEl.hidden = true
    audio.pause()
    announceVoice(false)
    setNow()
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

  /** the host's sitting, if it is up: the one other block that can hold
      this frame at the same time as the leaf */
  const keeperEl = document.getElementById('keeper')

  function update(): void {
    if (panelEl.hidden) return
    // narrow stages give the frame to whoever is speaking
    panelEl.classList.toggle('yielded', innerWidth < 620 && keeperEl !== null && !keeperEl.hidden)
    if (progress) {
      progress.style.width =
        audio.duration > 0 ? `${(audio.currentTime / audio.duration) * 100}%` : '0%'
    }
    setClock()
  }

  return { open, close, isOpen: () => !panelEl.hidden, update }
}
