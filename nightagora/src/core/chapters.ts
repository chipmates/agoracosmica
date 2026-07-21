/* His Nights — the story chapters, played at the hearth. Cosmos-contract
   element 5: real R2 audio, chapter one enters the story. The Echo-voice
   law holds in the ink line; the ambient bed ducks while a night is told
   (same na-voice event the council uses). */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

export interface ChaptersHandles {
  open(): void
  close(): void
  isOpen(): boolean
  /** drive the progress hairline from the frame loop */
  update(): void
}

export function createChapters(slug: string, count: number): ChaptersHandles {
  const panel = document.getElementById('chapters')
  if (!panel) throw new Error('missing chapters shell')
  const panelEl: HTMLElement = panel
  const list = panelEl.querySelector('.chapters-list') as HTMLElement | null
  const toggle = panelEl.querySelector('.chapters-toggle') as HTMLButtonElement | null
  const now = panelEl.querySelector('.chapters-now') as HTMLElement | null
  const progress = panelEl.querySelector('.chapters-progress') as HTMLElement | null
  const closeBtn = panelEl.querySelector('.chapters-close') as HTMLButtonElement | null

  const audio = new Audio()
  audio.preload = 'none'
  let current = -1
  const buttons: HTMLButtonElement[] = []

  function announceVoice(playing: boolean): void {
    window.dispatchEvent(new CustomEvent('na-voice', { detail: playing }))
  }

  function chapterUrl(n: number): string {
    const id = String(n + 1).padStart(2, '0')
    return `https://media.agoracosmica.org/podcasts/agora-cosmica/${slug}/${id}.mp3`
  }

  function setNow(): void {
    const numeral = ROMAN[current] ?? String(current + 1)
    if (now) now.textContent = current < 0 ? '' : `Chapter ${numeral}`
    if (toggle) toggle.textContent = audio.paused ? 'Listen' : 'Pause'
    for (let i = 0; i < buttons.length; i++)
      buttons[i]?.classList.toggle('playing', i === current && !audio.paused)
  }

  function play(n: number): void {
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
      b.textContent = ROMAN[i] ?? String(i + 1)
      b.addEventListener('click', () => play(i))
      list.appendChild(b)
      buttons.push(b)
    }
  }

  toggle?.addEventListener('click', () => {
    if (current < 0) {
      play(0) // chapter one enters the story
      return
    }
    if (audio.paused) void audio.play().catch(() => undefined)
    else audio.pause()
    announceVoice(!audio.paused)
    setNow()
  })

  audio.addEventListener('ended', () => {
    announceVoice(false)
    // the next night follows on its own, as nights do
    if (current >= 0 && current < count - 1) play(current + 1)
    else setNow()
  })

  function open(): void {
    panelEl.hidden = false
    setNow()
  }
  function close(): void {
    panelEl.hidden = true
    audio.pause()
    announceVoice(false)
    setNow()
  }
  closeBtn?.addEventListener('click', close)

  function update(): void {
    if (panelEl.hidden || !progress) return
    progress.style.width =
      audio.duration > 0 ? `${(audio.currentTime / audio.duration) * 100}%` : '0%'
  }

  return { open, close, isOpen: () => !panelEl.hidden, update }
}
