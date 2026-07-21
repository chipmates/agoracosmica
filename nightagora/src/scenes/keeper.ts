/* Beat 5 · THE KEEPER SPEAKS — the staged exchange at the fire.
   DOM theater, no canvas: Marcus's words set in letterpress serif and
   are revealed phrase by phrase, paced like breath. The visitor writes
   in italic ink. The offered lines are the real interface. A free-typed
   question receives one honest staged answer and is carried to the
   Forward Door. The module exposes speak() so the fire can listen. */

import {
  CARRIED_QUESTION_KEY,
  CODA_GOLD,
  CODA_TEXT,
  COLOPHON,
  GREETING,
  KEEPER_NAME,
  OFFERED,
  TYPED_REPLY,
} from '../content/keeper-script'

type Mode = 'idle' | 'greeting' | 'open' | 'answering'

export interface KeeperHandles {
  /** Drive the theater. Call every frame with real dt (never frozen). */
  update(dt: number): void
  /** 0..1 speaking intensity, smoothed. The fire brightens with it. */
  speak(): number
  /** Rig hook: compose a deterministic mid-conversation frame. */
  forgeStage(stage: number): void
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

export function createKeeper(host: HTMLElement, reducedMotion: boolean): KeeperHandles {
  // ---- build the chrome once ----
  host.textContent = ''
  const name = el('p', 'keeper-name', KEEPER_NAME)
  const dialogue = el('div', 'keeper-dialogue')
  dialogue.setAttribute('aria-live', 'polite')
  const greeting = el('p', 'keeper-line keeper-phrase', GREETING)
  dialogue.appendChild(greeting)

  const offersBox = el('div', 'keeper-offers')
  const offerButtons: HTMLButtonElement[] = []
  for (const turn of OFFERED) {
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
    offerButtons.push(b)
  }

  const form = document.createElement('form')
  form.className = 'keeper-form'
  const askLabel = el('span', 'keeper-ask-label', 'Ask')
  const input = document.createElement('input')
  input.className = 'keeper-input'
  input.type = 'text'
  input.maxLength = 240
  input.autocomplete = 'off'
  input.setAttribute('aria-label', 'Ask Marcus Aurelius')
  form.append(askLabel, input)
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    form.requestSubmit()
  })
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
    startTurn(text, TYPED_REPLY)
  })

  const colophon = el('p', 'keeper-note', COLOPHON)
  host.append(name, dialogue, offersBox, form, colophon)

  // ---- the theater's state ----
  let mode: Mode = 'idle'
  let sp = 0
  let turns = 0
  let codaShown = false
  let wait = 0 // seconds until the next step of the current mode
  let queue: string[] = []
  let breath: HTMLElement | null = null

  function phraseSeconds(text: string): number {
    return Math.min(4.5, 1.15 + text.length * 0.028)
  }

  /** The live exchange shows only the current breath: the new phrase
      crossfades in while the previous one leaves the window entirely. */
  function showPhrase(node: HTMLElement, instant: boolean): void {
    if (!breath) return
    for (const old of Array.from(breath.children)) {
      old.classList.remove('lit')
      old.classList.add('out')
      window.setTimeout(() => old.remove(), 950)
    }
    breath.appendChild(node)
    if (instant || reducedMotion) node.classList.add('lit')
    else requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('lit')))
  }

  function phraseNode(text: string): HTMLElement {
    return el('p', 'keeper-phrase', text)
  }

  function startTurn(ask: string, phrases: string[]): void {
    dialogue.textContent = ''
    dialogue.appendChild(el('p', 'keeper-ask', ask))
    breath = el('div', 'keeper-breath')
    dialogue.appendChild(breath)
    queue = [...phrases]
    host.classList.add('answering')
    mode = 'answering'
    wait = reducedMotion ? 0 : 0.9
    if (reducedMotion) flush()
  }

  function flush(): void {
    // the visitor skipped ahead: rest on the final phrase
    const lastText = queue[queue.length - 1]
    queue = []
    if (lastText !== undefined) showPhrase(phraseNode(lastText), true)
    wait = 0.9
  }

  function codaNode(): HTMLElement {
    const p = el('p', 'keeper-phrase', CODA_TEXT + ' ')
    p.appendChild(el('span', 'keeper-gold', CODA_GOLD))
    return p
  }

  function finishTurn(): void {
    turns += 1
    if (turns >= 2 && !codaShown) {
      codaShown = true
      showPhrase(codaNode(), false)
    }
    host.classList.remove('answering')
    mode = 'open'
  }

  // tap the words to skip the pacing (never trap the visitor)
  dialogue.addEventListener('click', () => {
    if (mode === 'answering' && queue.length > 0) flush()
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

    // the mode is observable from outside (rig + debugging)
    if (host.dataset['mode'] !== mode) host.dataset['mode'] = mode

    if (host.hidden) return

    if (mode === 'idle') {
      // first sight of the block: the greeting is already in the DOM,
      // let it breathe, then open the floor
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
      return
    }

    if (mode === 'answering') {
      const next = queue.shift()
      if (next !== undefined) {
        showPhrase(phraseNode(next), false)
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
    host.classList.add('instant', 'open')
    greeting.classList.add('lit')
    mode = 'open'
    sp = 0
    if (stage >= 2) {
      const first = OFFERED[0]
      if (!first) return
      offerButtons[0]?.remove()
      dialogue.textContent = ''
      dialogue.appendChild(el('p', 'keeper-ask', first.ask))
      breath = el('div', 'keeper-breath')
      dialogue.appendChild(breath)
      const lastText = first.phrases[first.phrases.length - 1]
      if (lastText !== undefined) showPhrase(phraseNode(lastText), true)
      turns = 1
      sp = 0.85
    }
  }

  return { update, speak, forgeStage }
}
