/* Beat 11 · THE COUNCIL EMBER — the agora transformed. The fire scales
   toward blaze, four lights descend from the night to take their seats
   (call down the stars, simplified to its essence), and the real
   council preview plays under a thin cartouche bar. The lights breathe
   with the audio as a circle: no per-voice timestamps yet, so nothing
   pretends to know who speaks (that sync arrives with the sound pass).
   Disclosure stays in ink below the topic. */

import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  PerspectiveCamera,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three/webgpu'
import { AUDIO_COUNCIL } from '../content/media'
import { COUNCIL_SEATS } from '../content/council'

const GOLD = new Color('#e0b96a')
const MODERATOR = new Color('#f3efe2')

export interface CouncilHandles {
  /** The return breath lands: descend the lights, then start the audio. */
  begin(): void
  update(dt: number, elapsed: number, camera: PerspectiveCamera): void
  /** 0..1 how far the blaze has risen (drives the agora fire). */
  blaze(): number
  stop(): void
  forgeStage(camera: PerspectiveCamera): void
  active(): boolean
}

export function createCouncil(scene: Scene, onEnded: () => void): CouncilHandles {
  const root = new Group()
  root.visible = false
  scene.add(root)

  // seats in an open arc around the agora fire (0, -0.45, -5.6): every
  // presence stays visible; nobody sits behind the blaze
  const WIDE_SEATS: Array<[number, number]> = [
    [-1.95, -5.3],
    [-0.95, -4.65],
    [0.95, -4.65],
    [1.95, -5.3],
  ]
  // narrow stage (phones): the same circle seen from inside — pairs stack
  // along the flame's flanks (deeper = higher), everything inside the frame
  // and clear of the blaze silhouette
  const NARROW_SEATS: Array<[number, number]> = [
    [-0.95, -6.4],
    [-0.62, -4.55],
    [0.62, -4.55],
    [0.95, -6.4],
  ]
  const SEAT_Y = -0.42
  const FROM_Y = 7.5

  function glowTexture(core: string): CanvasTexture {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, core)
    g.addColorStop(0.32, 'rgba(224, 185, 106, 0.5)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new CanvasTexture(canvas)
  }

  const lights: Array<{ sprite: Sprite; mat: SpriteMaterial; x: number; z: number }> = []
  for (let i = 0; i < WIDE_SEATS.length; i++) {
    const seat = WIDE_SEATS[i]
    const info = COUNCIL_SEATS[i]
    if (!seat || !info) continue
    const mat = new SpriteMaterial({
      map: glowTexture(info.moderator ? 'rgba(250, 246, 230, 1)' : 'rgba(255, 240, 200, 1)'),
      color: info.moderator ? MODERATOR : GOLD,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const sprite = new Sprite(mat)
    sprite.position.set(seat[0], FROM_Y, seat[1])
    sprite.scale.set(0.34, 0.34, 1)
    root.add(sprite)
    lights.push({ sprite, mat, x: seat[0], z: seat[1] })
  }

  // ---- the DOM organs: topic, names, cartouche ----
  const topicNode = document.getElementById('council-topic')
  const namesNode = document.getElementById('council-names')
  const cartoucheNode = document.getElementById('cartouche')
  if (!topicNode || !namesNode || !cartoucheNode) throw new Error('missing council shell')
  const topicEl: HTMLElement = topicNode
  const namesEl: HTMLElement = namesNode
  const cartoucheEl: HTMLElement = cartoucheNode
  const nameEls = Array.from(namesEl.children) as HTMLElement[]
  const progressEl = cartoucheEl.querySelector('.cartouche-progress') as HTMLElement | null
  const toggleEl = cartoucheEl.querySelector('.cartouche-toggle') as HTMLElement | null

  // ---- the audio ----
  const audio = new Audio(AUDIO_COUNCIL)
  audio.preload = 'auto'
  let endedFired = false
  audio.addEventListener('ended', () => {
    if (endedFired) return
    endedFired = true
    onEnded()
  })
  function setToggleLabel(): void {
    if (toggleEl) toggleEl.textContent = audio.paused ? 'Listen' : 'Pause'
  }
  cartoucheEl.addEventListener('click', () => {
    if (!running) return
    if (audio.paused) void audio.play().catch(() => undefined)
    else audio.pause()
    setToggleLabel()
  })

  // ---- state ----
  // Sound is on-by-invitation (World Bible §8): the circle convenes and
  // waits at the cartouche. Nothing plays until the visitor asks, and
  // the beat has to read as complete in silence.
  let running = false
  let t = 0
  let topicTimer = 0
  let stagedAspect = 0
  const projected = new Vector3()

  /** Restage the circle for the current frame shape (phones get the
      narrow arc; the CSS register/chips swap follows the same 9/10 line). */
  function layoutSeats(aspect: number): void {
    if (Math.abs(aspect - stagedAspect) < 0.01) return
    stagedAspect = aspect
    const seats = aspect < 0.9 ? NARROW_SEATS : WIDE_SEATS
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i]
      const seat = seats[i]
      if (!l || !seat) continue
      l.x = seat[0]
      l.z = seat[1]
    }
  }

  function begin(): void {
    running = true
    endedFired = false
    t = 0
    root.visible = true
    // the poem line has the frame first; the letterpress sets once the
    // voices are already speaking
    window.clearTimeout(topicTimer)
    topicTimer = window.setTimeout(() => {
      if (running) topicEl.classList.add('lit')
    }, 6200)
    cartoucheEl.hidden = false
    setToggleLabel()
  }

  function stop(): void {
    running = false
    root.visible = false
    audio.pause()
    audio.currentTime = 0
    window.clearTimeout(topicTimer)
    topicEl.classList.remove('lit')
    cartoucheEl.hidden = true
    namesEl.hidden = true
  }

  function blaze(): number {
    return running ? Math.min(1, t / 2.4) : 0
  }

  function update(dt: number, elapsed: number, camera: PerspectiveCamera): void {
    if (!running) return
    t += dt
    layoutSeats(camera.aspect)

    // the descent: staggered, easing, from the night to the seats
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i]
      if (!l) continue
      const k = Math.min(1, Math.max(0, (t - i * 0.32) / 2.2))
      const e = k * k * (3 - 2 * k)
      l.sprite.position.set(l.x, FROM_Y + (SEAT_Y - FROM_Y) * e, l.z)
      // seated lights breathe as a circle while the voices speak; in
      // silence they hold a steady, waiting light
      const breathe = audio.paused ? 0 : 0.24 * Math.sin(elapsed * 1.35 + i * 1.7)
      l.mat.opacity = Math.min(0.85, k * 0.85) * (0.76 + breathe)
    }

    // name chips ride under their lights once seated; a chip that would
    // leave the frame hides rather than clip (narrow stages use the
    // letterpress register instead, via CSS)
    const seated = t > 2.6
    namesEl.hidden = !seated
    if (seated) {
      for (let i = 0; i < lights.length; i++) {
        const l = lights[i]
        const el = nameEls[i]
        if (!l || !el) continue
        projected.copy(l.sprite.position).project(camera)
        const offFrame = projected.z > 1 || Math.abs(projected.x) > 0.92
        el.hidden = offFrame
        if (offFrame) continue
        const x = (projected.x * 0.5 + 0.5) * innerWidth
        const y = (-projected.y * 0.5 + 0.5) * innerHeight
        el.style.left = `${x}px`
        el.style.top = `${y + 26}px`
      }
    }

    if (progressEl && audio.duration > 0) {
      progressEl.style.width = `${(audio.currentTime / audio.duration) * 100}%`
    }
  }

  function forgeStage(camera: PerspectiveCamera): void {
    begin()
    // compose the seated circle without sound
    for (let i = 0; i < 220; i++) update(1 / 60, 12.4 + i / 60, camera)
    audio.pause()
    window.clearTimeout(topicTimer)
    topicEl.classList.add('lit')
    setToggleLabel()
  }

  return { begin, update, blaze, stop, forgeStage, active: () => running }
}
