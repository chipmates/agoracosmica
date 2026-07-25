/* The staged sitting — one exchange engine for every hearth (beat 5 at
   the agora fire, beat 10 at the Danube camp). DOM theater, no canvas:
   the host's words are set like letterpress and arrive word by word,
   paced like breath; the live exchange shows only the current breath.
   The visitor writes in italic ink. The offered lines are the real
   interface. A free-typed question receives one honest staged answer and
   is carried to the Forward Door. speak() lets the fire listen. Verbs
   universal, staging sovereign.

   THE PRESS (2026-07-25): this seat owns how the sitting LOOKS as well as
   how it runs, so the type's own stylesheet ships from here, right below
   the shell's. The composition is a column of type with a rhythm: a seal,
   his name, his station, a hairline that breathes with his voice, then
   the words, then the way onward, then the colophon that never lies about
   what this is. Nothing is boxed. A card would wall the voice off from
   the fire it is sitting at, so the block earns its legibility from its
   own air (a soft shade), from doubled ink shadows, and from restraint
   with gold: a spark at the seal, a line under his name, his own gilded
   words, the way onward. Nothing else. */

import {
  FIRE_SCRIPT,
  CARRIED_QUESTION_KEY,
  COLOPHON,
  type KeeperScript,
} from '../content/keeper-script'

type Mode = 'idle' | 'greeting' | 'open' | 'answering'

export interface KeeperHandles {
  /** Drive the theater. Call every frame; pacing runs on wall clock. */
  update(dt: number): void
  /** 0..1 speaking intensity, smoothed. The fire brightens with it. */
  speak(): number
  /** Swap the sitting (e.g. agora fire → camp hearth) and reset. */
  setScript(script: KeeperScript): void
  /** Rig hook: compose a deterministic mid-conversation frame. */
  forgeStage(stage: number): void
}

/* The press. It sits after the shell's own sheet, so equal-weight rules
   land on top of the plain staging the shell ships. Every colour comes
   from the night's tokens: the letterpress never invents a hue. */
const PRESS = `
#keeper {
  /* 0..1, written from update(): the same signal the fire listens to */
  --speak: 0;
  max-width: 720px;
  text-rendering: optimizeLegibility;
  font-feature-settings: 'kern' 1, 'liga' 1;
}
/* the hub keeper stands under the council's own mark, so his block sits
   lower there: two letterpress lines a hand apart read as one confused
   stack (round 1). German is the case that decides it, three lines of
   greeting where English takes two (round 3). */
body[data-phase='agora'] #keeper { bottom: calc(108px + env(safe-area-inset-bottom)); }

/* the block's own air. Not a card: an ellipse of the night's own abyss,
   feathered out long before it has an edge, so the words hold over a
   bright fire and over a dark camp without anything to see. */
#keeper .keeper-shade {
  position: absolute; left: 50%; top: 50%;
  width: 168%; height: 215%;
  transform: translate(-50%, -50%);
  z-index: -1; pointer-events: none;
  background: radial-gradient(ellipse 42% 46% at 50% 50%,
    color-mix(in srgb, var(--na-abyss) 80%, transparent) 0%,
    color-mix(in srgb, var(--na-abyss) 54%, transparent) 44%,
    transparent 74%);
  /* the air closes in a little while he is speaking */
  opacity: calc(0.86 + var(--speak) * 0.14);
}
body[data-phase='camp'] #keeper .keeper-shade {
  /* his morning is lifted on purpose, but the tent's mouth is the
     brightest thing in the night: the shade takes the edge off it */
  background: radial-gradient(ellipse 44% 48% at 50% 50%,
    color-mix(in srgb, var(--na-abyss) 68%, transparent) 0%,
    color-mix(in srgb, var(--na-abyss) 44%, transparent) 46%,
    transparent 76%);
}

/* the seal: the mark that a voice is speaking here, carrying the speaking
   signal so the type has a heartbeat without a pulse. A lozenge, never a
   ring: in this night a ring with a bead means a place you can press, and
   the keeper's mark stacked under the council's read as a second button
   (round 2). */
#keeper .keeper-seal {
  width: 15px; height: 15px; margin: 0 auto 12px;
  position: relative;
}
#keeper .keeper-seal::before {
  content: ''; position: absolute; inset: 2px;
  border: 1px solid color-mix(in srgb, var(--na-gold) 52%, transparent);
  transform: rotate(45deg);
  box-shadow: 0 0 calc(6px + var(--speak) * 20px)
    color-mix(in srgb, var(--na-gold) 16%, transparent);
}
#keeper .keeper-seal::after {
  content: ''; position: absolute; inset: 0; margin: auto;
  width: 3px; height: 3px; border-radius: 50%;
  background: var(--na-gold);
  box-shadow: 0 0 calc(3px + var(--speak) * 11px) var(--na-gold);
}

/* his name is cut, not labelled: serif capitals with inscription spacing.
   In sans caps it was the same register as every hotspot label in the
   night, and under the council's own mark the two read as one stack
   (round 3, German mobile). The station line under it stays a label. */
#keeper .keeper-name {
  font-family: var(--serif); font-weight: 400;
  font-size: 17px; letter-spacing: 0.18em; text-indent: 0.18em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--na-starlight) 94%, transparent);
}
#keeper .keeper-role {
  margin-top: 8px;
  font-family: var(--sans);
  font-size: 9px; letter-spacing: 0.3em; text-indent: 0.3em;
  text-transform: uppercase;
  /* mist that has been sitting near a fire, not gold */
  color: color-mix(in srgb, var(--na-mist) 80%, var(--na-gold));
}
#keeper .keeper-role:empty { display: none; }

/* the hairline under his station widens while he speaks. A keeper with
   nothing offered never speaks, so at the hub it would only be a scratch
   under his name: it goes (round 1). */
#keeper .keeper-rule {
  height: 1px; margin: 13px auto 0;
  width: calc(66px + var(--speak) * 118px);
  background: linear-gradient(to right, transparent,
    color-mix(in srgb, var(--na-gold) 64%, transparent), transparent);
  opacity: calc(0.5 + var(--speak) * 0.5);
}
#keeper.quiet .keeper-rule { display: none; }
/* and at the hub his seal goes with it: the council's own ring hangs a
   hand above this block, and two marks that close read as one stack of
   buttons. His name in wide caps is anchor enough there. */
#keeper.quiet .keeper-seal { display: none; }
#keeper.quiet .keeper-exit { margin-top: 18px; }

#keeper .keeper-dialogue { margin-top: 17px; }
#keeper.quiet .keeper-dialogue { margin-top: 20px; }
#keeper .keeper-line, #keeper .keeper-phrase {
  margin-top: 0;
  line-height: 1.5;
  color: var(--na-starlight);
  text-wrap: balance;
  text-shadow:
    0 1px 2px color-mix(in srgb, var(--na-abyss) 92%, transparent),
    0 2px 30px color-mix(in srgb, var(--na-abyss) 82%, transparent);
}
#keeper .keeper-line { font-size: clamp(18px, 2.6vw, 24px); }
#keeper .keeper-phrase { font-size: clamp(18px, 2.5vw, 23px); }
body[data-phase='camp'] #keeper .keeper-line,
body[data-phase='camp'] #keeper .keeper-phrase,
body[data-phase='camp'] #keeper .keeper-ask,
body[data-phase='camp'] #keeper .keeper-name,
body[data-phase='camp'] #keeper .keeper-role,
body[data-phase='camp'] #keeper .keeper-note,
body[data-phase='camp'] #keeper .keeper-offer,
body[data-phase='camp'] #keeper .keeper-exit {
  /* the camp is a dawn: its ink is warm-dark, or the type looks pasted on */
  text-shadow: 0 1px 3px rgba(14, 9, 4, 0.92), 0 2px 26px rgba(14, 9, 4, 0.78);
}

/* THE BREATH — words arrive the way a person says them, not as a block
   that fades. Each word rises out of its own blur, a beat behind the one
   before it, and the stagger caps so a long German line still lands. */
#keeper .kw {
  display: inline-block;
  opacity: 0;
  transform: translateY(0.34em);
  filter: blur(3px);
  transition:
    opacity 0.7s ease,
    transform 0.85s cubic-bezier(0.16, 0.72, 0.24, 1),
    filter 0.7s ease;
  transition-delay: calc(var(--i, 0) * 46ms);
}
#keeper .keeper-phrase.lit .kw { opacity: 1; transform: none; filter: none; }
/* a spent breath drifts up and goes out whole, never word by word */
#keeper .keeper-breath .keeper-phrase.out { transform: translateY(calc(-50% - 0.34em)); }
#keeper .keeper-phrase.out .kw {
  opacity: 1; transform: none; filter: none; transition: none;
}

/* the breath window holds one breath at a time and resizes with it, so a
   four-line answer can never climb over the visitor's own question */
#keeper .keeper-breath {
  position: relative;
  min-height: 2.9em;
  font-size: inherit;
  transition: height 0.7s cubic-bezier(0.22, 0.7, 0.2, 1);
}
#keeper .keeper-breath .keeper-phrase {
  position: absolute; left: 0; right: 0; top: 50%;
  transform: translateY(-50%);
  margin: 0; font-size: inherit;
}

/* the visitor's own line, set small, with a caption rule handing the
   floor back to him */
#keeper .keeper-ask {
  margin-top: 0;
  font-family: var(--serif); font-style: italic;
  font-size: clamp(13px, 1.55vw, 15px);
  letter-spacing: 0.03em;
  color: color-mix(in srgb, var(--na-mist) 86%, var(--na-starlight));
}
#keeper .keeper-ask::after {
  content: ''; display: block; width: 22px; height: 1px;
  margin: 12px auto 14px;
  background: color-mix(in srgb, var(--na-mist) 42%, transparent);
}

/* how many breaths this answer has, and which one you are hearing */
#keeper .keeper-beats {
  display: flex; justify-content: center; align-items: center;
  gap: 8px; height: 3px; margin-top: 15px;
  opacity: 0; transition: opacity 0.7s ease;
}
#keeper.answering .keeper-beats { opacity: 1; }
#keeper .keeper-beats i {
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--na-mist); opacity: 0.45;
  box-shadow: 0 0 4px color-mix(in srgb, var(--na-abyss) 80%, transparent);
  transition: opacity 0.5s ease, background-color 0.5s ease;
}
#keeper .keeper-beats i.done { opacity: 0.7; }
#keeper .keeper-beats i.here {
  background: var(--na-gold); opacity: 1;
  box-shadow: 0 0 10px color-mix(in srgb, var(--na-gold) 55%, transparent);
}

/* the offered lines are a playbill, not a button row, and they arrive one
   after the other the way a host makes two offers, not one gesture */
#keeper .keeper-offers { margin-top: 15px; gap: 0; }
#keeper .keeper-offer {
  position: relative;
  font-size: clamp(15px, 1.85vw, 17px);
  color: color-mix(in srgb, var(--na-starlight) 64%, var(--na-mist));
  opacity: 0; transform: translateY(7px);
  min-height: 44px; padding: 10px 18px;
  transition: opacity 0.85s ease, transform 0.85s cubic-bezier(0.2, 0.7, 0.2, 1),
    color 0.45s ease;
}
#keeper.open .keeper-offer { opacity: 0.86; transform: none; }
#keeper.open .keeper-offer:nth-child(2) { transition-delay: 0.14s; }
#keeper.open .keeper-offer:nth-child(3) { transition-delay: 0.28s; }
#keeper .keeper-offer + .keeper-offer::before {
  content: ''; position: absolute; top: 0; left: 50%;
  transform: translateX(-50%);
  width: 92px; height: 1px;
  background: color-mix(in srgb, var(--na-gold) 15%, transparent);
}
#keeper .keeper-offer::after {
  content: ''; position: absolute; left: 50%; bottom: 8px;
  transform: translateX(-50%);
  width: 0; height: 1px;
  background: color-mix(in srgb, var(--na-gold) 60%, transparent);
  transition: width 0.45s ease;
}
#keeper .keeper-offer:hover, #keeper .keeper-offer:focus-visible {
  opacity: 1; color: var(--na-starlight); outline: none;
}
#keeper .keeper-offer:hover::after, #keeper .keeper-offer:focus-visible::after { width: 56%; }

/* the writing line: a label, then a line to write on that lights when
   the visitor takes it */
#keeper .keeper-form {
  margin: 18px auto 0; max-width: 430px;
  align-items: center; gap: 13px;
  border-top: none; padding-top: 0;
}
#keeper .keeper-ask-label {
  flex: none;
  font-size: 9px; letter-spacing: 0.3em; text-indent: 0.3em;
  color: color-mix(in srgb, var(--na-gold) 80%, transparent);
}
#keeper .keeper-writing { position: relative; flex: 1; min-width: 0; display: flex; }
#keeper .keeper-input {
  width: 100%; min-height: 44px; padding: 0 2px;
  font-size: 16px;
}
#keeper .keeper-input::placeholder {
  color: color-mix(in srgb, var(--na-mist) 46%, transparent);
  font-style: italic;
}
#keeper .keeper-writing::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 7px; height: 1px;
  background: color-mix(in srgb, var(--na-gold) 24%, transparent);
  transition: background-color 0.4s ease;
}
#keeper .keeper-writing:focus-within::after {
  background: color-mix(in srgb, var(--na-gold) 68%, transparent);
}

/* the way onward, flanked like a title rule so it reads as a door. It is
   earned, not present: when it finally shows, it comes up out of the
   ground like the rest of the sitting did. */
#keeper .keeper-exit {
  display: inline-flex; align-items: center; gap: 15px;
  margin: 22px auto 0; padding: 0 6px; min-height: 44px;
  font-size: 10px; letter-spacing: 0.32em;
  color: var(--na-gold); opacity: 0.9;
  transition: opacity 0.4s ease, color 0.4s ease;
  animation: keeper-arrive 1.2s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
@keyframes keeper-arrive {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 0.9; transform: none; }
}
body.forge #keeper .keeper-exit { animation: none; }
#keeper .keeper-exit::before, #keeper .keeper-exit::after {
  content: ''; flex: none; width: 18px; height: 1px;
  background: color-mix(in srgb, var(--na-gold) 50%, transparent);
  transition: background-color 0.4s ease;
}
#keeper .keeper-exit[hidden] { display: none; }
#keeper .keeper-exit-text { display: block; margin-right: -0.32em; }
#keeper .keeper-exit:hover, #keeper .keeper-exit:focus-visible {
  opacity: 1; color: var(--na-starlight); outline: none;
}
#keeper .keeper-exit:hover::before, #keeper .keeper-exit:focus-visible::before,
#keeper .keeper-exit:hover::after, #keeper .keeper-exit:focus-visible::after {
  background: color-mix(in srgb, var(--na-starlight) 45%, transparent);
}

/* the colophon. It is the one line that says what this voice is, so it
   is set to be read, not to be technically present. */
#keeper .keeper-note {
  margin-top: 20px;
  font-size: 9px; letter-spacing: 0.3em; text-indent: 0.3em;
  color: color-mix(in srgb, var(--na-mist) 84%, transparent);
}

/* the sitting sits down: the chrome rises, his name settles out of a
   wider set, and only then does he speak */
#keeper .keeper-seal, #keeper .keeper-name,
#keeper .keeper-role, #keeper .keeper-note {
  transform: translateY(9px); opacity: 0;
  transition: opacity 1s ease, transform 1s cubic-bezier(0.2, 0.7, 0.2, 1),
    letter-spacing 1.4s cubic-bezier(0.2, 0.7, 0.2, 1);
}
#keeper .keeper-name { transition-delay: 0.08s; letter-spacing: 0.34em; text-indent: 0.34em; }
#keeper .keeper-role { transition-delay: 0.16s; }
#keeper .keeper-note { transition-delay: 0.3s; }
#keeper.entered .keeper-seal, #keeper.entered .keeper-name,
#keeper.entered .keeper-role, #keeper.entered .keeper-note {
  transform: none; opacity: 1;
}
#keeper.entered .keeper-name { letter-spacing: 0.18em; text-indent: 0.18em; }

/* while the visitor is writing, the fire listens: his last words step
   back and the writing line is the brightest thing in the block */
#keeper.listening .keeper-dialogue { opacity: 0.5; }
#keeper.listening .keeper-offers { opacity: 0.42; }
#keeper .keeper-dialogue, #keeper .keeper-offers { transition: opacity 0.7s ease; }

@media (max-width: 480px) {
  #keeper { max-width: none; }
  body[data-phase='agora'] #keeper { bottom: calc(80px + env(safe-area-inset-bottom)); }
  /* the hub block is anchored at its foot, so every millimetre saved
     inside it lowers the top away from the council's label */
  #keeper.quiet .keeper-role { margin-top: 6px; }
  #keeper.quiet .keeper-exit { margin-top: 14px; }
  #keeper.quiet .keeper-note { margin-top: 12px; }
  #keeper .keeper-seal { width: 13px; height: 13px; margin-bottom: 10px; }
  #keeper .keeper-name { font-size: 14.5px; letter-spacing: 0.3em; text-indent: 0.3em; }
  #keeper.entered .keeper-name { letter-spacing: 0.15em; text-indent: 0.15em; }
  #keeper .keeper-role { font-size: 8.5px; letter-spacing: 0.24em; text-indent: 0.24em; }
  #keeper .keeper-rule { margin-top: 10px; }
  #keeper .keeper-dialogue { margin-top: 13px; }
  #keeper.quiet .keeper-dialogue { margin-top: 10px; }
  /* the hub greeting runs three lines in German where English takes two,
     and the council's mark hangs right above it: the quote sets tighter
     on a phone so his name never climbs into that label (round 5) */
  #keeper .keeper-line { font-size: 17.5px; line-height: 1.38; }
  #keeper .keeper-phrase { font-size: 16.5px; line-height: 1.46; }
  #keeper .keeper-breath { min-height: 2.5em; }
  #keeper .keeper-ask { font-size: 13px; }
  #keeper .keeper-ask::after { margin: 10px auto 12px; }
  #keeper .keeper-beats { margin-top: 12px; }
  #keeper .keeper-offers { margin-top: 10px; }
  #keeper .keeper-offer { font-size: 14px; padding: 9px 12px; }
  #keeper .keeper-form { margin-top: 12px; gap: 11px; }
  /* the offered lines are the real interface: the invitation to write
     stays quieter than they are, even though the field itself keeps the
     16px that stops a phone from zooming on focus */
  #keeper .keeper-input::placeholder {
    font-size: 14px;
    color: color-mix(in srgb, var(--na-mist) 40%, transparent);
  }
  #keeper .keeper-exit { margin-top: 16px; font-size: 9px; letter-spacing: 0.26em; gap: 12px; }
  #keeper .keeper-exit::before, #keeper .keeper-exit::after { width: 14px; }
  #keeper .keeper-exit-text { margin-right: -0.26em; }
  #keeper .keeper-note { margin-top: 14px; font-size: 8.5px; letter-spacing: 0.24em; text-indent: 0.24em; }
}

@media (prefers-reduced-motion: reduce) {
  /* the composition is the same one, it simply arrives already composed */
  #keeper .kw, #keeper .keeper-breath, #keeper .keeper-seal,
  #keeper .keeper-name, #keeper .keeper-role, #keeper .keeper-note,
  #keeper .keeper-offer, #keeper .keeper-dialogue, #keeper .keeper-offers {
    transition: none;
  }
  #keeper .keeper-name { letter-spacing: 0.36em; text-indent: 0.36em; }
  #keeper .keeper-exit { animation: none; }
}
`

function ensurePress(): void {
  if (document.getElementById('keeper-press')) return
  const sheet = document.createElement('style')
  sheet.id = 'keeper-press'
  sheet.textContent = PRESS
  document.head.appendChild(sheet)
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

/* a long line must not take longer to arrive than it takes to say, so the
   per-word delay stops climbing after this many words */
const STAGGER_CAP = 16

/** Set a line as words, each one carrying its place in the breath.
    Returns the next word index, so a gilded tail keeps counting. */
function setWords(node: HTMLElement, text: string, from = 0, extra = ''): number {
  const parts = text.split(' ').filter((w) => w.length > 0)
  parts.forEach((word, k) => {
    const span = el('span', extra ? `kw ${extra}` : 'kw', word)
    span.style.setProperty('--i', String(Math.min(from + k, STAGGER_CAP)))
    node.appendChild(span)
    if (k < parts.length - 1) node.appendChild(document.createTextNode(' '))
  })
  return from + parts.length
}

/** "Marcus Aurelius · Keeper of Tonight's Fire" is two registers, not one
    label: the name is the anchor, the station is the small line under it. */
function splitTitle(full: string): [string, string] {
  const cut = full.indexOf(' · ')
  if (cut < 0) return [full, '']
  return [full.slice(0, cut), full.slice(cut + 3)]
}

export function createKeeper(
  host: HTMLElement,
  reducedMotion: boolean,
  onExit?: () => void
): KeeperHandles {
  ensurePress()
  let script: KeeperScript = FIRE_SCRIPT

  // ---- build the chrome once ----
  host.textContent = ''
  const shade = el('div', 'keeper-shade')
  shade.setAttribute('aria-hidden', 'true')
  const seal = el('div', 'keeper-seal')
  seal.setAttribute('aria-hidden', 'true')
  const name = el('p', 'keeper-name')
  const role = el('p', 'keeper-role')
  const rule = el('div', 'keeper-rule')
  rule.setAttribute('aria-hidden', 'true')
  const dialogue = el('div', 'keeper-dialogue')
  dialogue.setAttribute('aria-live', 'polite')
  const greeting = el('p', 'keeper-line keeper-phrase')
  const beats = el('div', 'keeper-beats')
  beats.setAttribute('aria-hidden', 'true')
  const offersBox = el('div', 'keeper-offers')

  const form = document.createElement('form')
  form.className = 'keeper-form'
  const askLabel = el('span', 'keeper-ask-label', 'Ask')
  const writing = el('div', 'keeper-writing')
  const input = document.createElement('input')
  input.className = 'keeper-input'
  input.type = 'text'
  input.maxLength = 240
  input.autocomplete = 'off'
  input.placeholder = 'Write your own question'
  input.setAttribute('enterkeyhint', 'send')
  input.setAttribute('aria-label', 'Ask the Echo')
  writing.appendChild(input)
  form.append(askLabel, writing)
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    form.requestSubmit()
  })
  // the fire listens: while the visitor writes, his words step back
  input.addEventListener('focus', () => host.classList.add('listening'))
  input.addEventListener('blur', () => host.classList.remove('listening'))
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (mode !== 'open') return
    const text = input.value.trim()
    if (!text) return
    try {
      sessionStorage.setItem(CARRIED_QUESTION_KEY, text)
    } catch {
      /* private mode: the question still gets its answer */
    }
    input.value = ''
    input.blur()
    startTurn(text, script.typedReply)
  })

  const exitBtn = document.createElement('button')
  exitBtn.type = 'button'
  exitBtn.className = 'keeper-exit'
  const exitText = el('span', 'keeper-exit-text')
  exitBtn.appendChild(exitText)
  exitBtn.hidden = true
  exitBtn.addEventListener('click', () => {
    if (onExit) onExit()
  })

  const colophon = el('p', 'keeper-note', COLOPHON)
  host.append(shade, seal, name, role, rule, dialogue, beats, offersBox, form, exitBtn, colophon)

  // ---- the theater's state ----
  let mode: Mode = 'idle'
  let sp = 0
  let spWritten = -1
  let turns = 0
  let codaShown = false
  let wait = 0
  let queue: string[] = []
  let breath: HTMLElement | null = null
  let breaths = 0
  let entered = false

  function buildOffers(): void {
    offersBox.textContent = ''
    for (const turn of script.offered) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'keeper-offer'
      b.textContent = turn.ask
      b.addEventListener('click', () => {
        if (mode !== 'open') return
        b.remove()
        startTurn(turn.ask, turn.phrases)
      })
      offersBox.appendChild(b)
    }
  }

  function setScript(next: KeeperScript): void {
    script = next
    // a keeper with nothing offered also takes no written questions:
    // the hub points the way, the hearth holds the conversation
    form.hidden = next.offered.length === 0
    host.classList.toggle('quiet', next.offered.length === 0)
    const [who, where] = splitTitle(script.name)
    name.textContent = who
    role.textContent = where
    greeting.textContent = ''
    setWords(greeting, script.greeting)
    greeting.classList.remove('lit')
    dialogue.textContent = ''
    dialogue.appendChild(greeting)
    buildOffers()
    setBeats(0, -1)
    exitText.textContent = script.exit ?? ''
    exitBtn.hidden = true
    host.classList.remove('open', 'answering')
    mode = 'idle'
    turns = 0
    codaShown = false
    wait = 0
    queue = []
    breath = null
    breaths = 0
  }

  function phraseSeconds(text: string): number {
    return Math.min(4.5, 1.15 + text.length * 0.028)
  }

  /** The pacing made visible: one mark per breath in this answer, the one
      you are hearing lit. It also tells the visitor a line is still
      coming, so a pause reads as a pause and not as a stall. */
  function setBeats(total: number, at: number): void {
    if (beats.childElementCount !== total) {
      beats.textContent = ''
      for (let i = 0; i < total; i++) beats.appendChild(el('i', ''))
    }
    const marks = Array.from(beats.children)
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i]
      if (mark) mark.className = i < at ? 'done' : i === at ? 'here' : ''
    }
  }

  /** The live exchange shows only the current breath. The window takes the
      height of the breath it is holding, so the words never climb. */
  function showPhrase(node: HTMLElement, instant: boolean): void {
    if (!breath) return
    for (const old of Array.from(breath.children)) {
      old.classList.remove('lit')
      old.classList.add('out')
      window.setTimeout(() => old.remove(), 950)
    }
    breath.appendChild(node)
    // one measured layout per breath, then the window eases to that height
    breath.style.height = `${node.offsetHeight}px`
    if (instant || reducedMotion) node.classList.add('lit')
    else requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('lit')))
  }

  function phraseNode(text: string): HTMLElement {
    const p = el('p', 'keeper-phrase')
    setWords(p, text)
    return p
  }

  function startTurn(ask: string, phrases: string[]): void {
    dialogue.textContent = ''
    dialogue.appendChild(el('p', 'keeper-ask', ask))
    breath = el('div', 'keeper-breath')
    dialogue.appendChild(breath)
    queue = [...phrases]
    breaths = phrases.length
    setBeats(breaths, 0)
    host.classList.add('answering')
    mode = 'answering'
    wait = reducedMotion ? 0 : 0.9
    if (reducedMotion) flush()
  }

  function flush(): void {
    const lastText = queue[queue.length - 1]
    queue = []
    if (lastText !== undefined) {
      showPhrase(phraseNode(lastText), true)
      setBeats(breaths, breaths - 1)
    }
    wait = 0.9
  }

  function codaNode(): HTMLElement {
    const p = el('p', 'keeper-phrase')
    const next = setWords(p, script.codaText)
    if (script.codaGold) {
      if (script.codaText) p.appendChild(document.createTextNode(' '))
      setWords(p, script.codaGold, next, 'keeper-gold')
    }
    return p
  }

  function finishTurn(): void {
    turns += 1
    if (turns >= 2 && !codaShown) {
      codaShown = true
      showPhrase(codaNode(), false)
      if (script.exit) exitBtn.hidden = false
    }
    host.classList.remove('answering')
    mode = 'open'
  }

  // tap the words to skip the pacing (never trap the visitor)
  dialogue.addEventListener('click', () => {
    if (mode === 'answering' && queue.length > 0) flush()
  })

  // a turned phone re-wraps the breath: the window is measured in pixels,
  // so it has to be measured again or the words spill out of it
  addEventListener('resize', () => {
    if (!breath) return
    const live = breath.lastElementChild
    if (live instanceof HTMLElement) breath.style.height = `${live.offsetHeight}px`
  })

  let lastNow = -1

  function update(dt: number): void {
    // the theater breathes in wall-clock time: the canvas clamps its dt
    // on slow frames, but spoken pacing must not dilate with the fps
    const now = performance.now() / 1000
    const wall = lastNow < 0 ? dt : Math.min(0.5, now - lastNow)
    lastNow = now

    const target = mode === 'answering' ? 1 : 0
    sp += (target - sp) * Math.min(1, wall * 2.2)
    // the type listens to the same signal the fire does: the seal glows
    // and the hairline widens while he is speaking
    if (Math.abs(sp - spWritten) > 0.008) {
      spWritten = sp
      host.style.setProperty('--speak', sp.toFixed(3))
    }

    // the mode is observable from outside (rig + debugging)
    if (host.dataset['mode'] !== mode) host.dataset['mode'] = mode

    if (host.hidden) {
      // a sitting that is struck replays its arrival when it is set again
      if (entered) {
        entered = false
        host.classList.remove('entered')
      }
      return
    }

    if (!entered) {
      entered = true
      if (reducedMotion) host.classList.add('entered')
      else requestAnimationFrame(() => host.classList.add('entered'))
    }

    if (mode === 'idle') {
      requestAnimationFrame(() => greeting.classList.add('lit'))
      mode = 'greeting'
      wait = reducedMotion ? 0 : 2.4
      return
    }

    if (wait > 0) {
      wait -= wall
      return
    }

    if (mode === 'greeting') {
      host.classList.add('open')
      mode = 'open'
      if (script.exitImmediate && script.exit) exitBtn.hidden = false
      return
    }

    if (mode === 'answering') {
      const next = queue.shift()
      if (next !== undefined) {
        showPhrase(phraseNode(next), false)
        setBeats(breaths, breaths - queue.length - 1)
        wait = phraseSeconds(next)
      } else {
        finishTurn()
      }
    }
  }

  function speak(): number {
    return sp
  }

  function forgeStage(stage: number): void {
    host.classList.add('instant', 'open', 'entered')
    entered = true
    greeting.classList.add('lit')
    mode = 'open'
    sp = 0
    host.style.setProperty('--speak', '0')
    spWritten = 0
    if (script.exitImmediate && script.exit) exitBtn.hidden = false
    if (stage >= 2) {
      const first = script.offered[0]
      if (!first) return
      offersBox.querySelector('.keeper-offer')?.remove()
      dialogue.textContent = ''
      dialogue.appendChild(el('p', 'keeper-ask', first.ask))
      breath = el('div', 'keeper-breath')
      dialogue.appendChild(breath)
      const lastText = first.phrases[first.phrases.length - 1]
      if (lastText !== undefined) showPhrase(phraseNode(lastText), true)
      breaths = first.phrases.length
      setBeats(breaths, breaths - 1)
      turns = 1
      sp = 0.85
      host.style.setProperty('--speak', '0.850')
      spWritten = 0.85
    }
    if (stage >= 3) {
      // the coda + the way onward, composed
      turns = 2
      codaShown = true
      showPhrase(codaNode(), true)
      setBeats(0, -1)
      if (script.exit) exitBtn.hidden = false
    }
  }

  setScript(FIRE_SCRIPT)
  return { update, speak, setScript, forgeStage }
}
