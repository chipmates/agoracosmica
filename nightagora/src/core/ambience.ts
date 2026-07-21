/* The night's ambient bed (concept 01 audio law): starts only on the
   visitor's invitation at the stone gate, ducks while a council voice
   speaks, and the choice persists. One graph, no surprises. */

import { AUDIO_AMBIENT } from '../content/media'

const STORE_KEY = 'na-sound'

let el: HTMLAudioElement | null = null
let wanted = false
let ducked = false
let volume = 0

function ensure(): HTMLAudioElement {
  if (!el) {
    el = new Audio(AUDIO_AMBIENT)
    el.loop = true
    el.volume = 0
    el.preload = 'auto'
  }
  return el
}

export const ambience = {
  /** The remembered choice from an earlier night. */
  remembered(): 'on' | 'off' | null {
    try {
      const v = localStorage.getItem(STORE_KEY)
      return v === 'on' ? 'on' : v === 'off' ? 'off' : null
    } catch {
      return null
    }
  },

  on(): boolean {
    return wanted
  },

  /** Call from a user gesture: browsers only unlock audio there. */
  enable(): void {
    wanted = true
    try {
      localStorage.setItem(STORE_KEY, 'on')
    } catch {
      /* private mode: the night still plays */
    }
    void ensure()
      .play()
      .catch(() => {
        /* if the gesture was lost, the next toggle tries again */
      })
  },

  disable(): void {
    wanted = false
    try {
      localStorage.setItem(STORE_KEY, 'off')
    } catch {
      /* fine */
    }
  },

  duck(d: boolean): void {
    ducked = d
  },

  /** Drive from the frame loop: the volume breathes, never steps. */
  update(dt: number): void {
    if (!el) return
    const target = wanted ? (ducked ? 0.07 : 0.3) : 0
    volume += (target - volume) * Math.min(1, dt * 1.6)
    el.volume = Math.max(0, Math.min(1, volume))
    if (!wanted && volume < 0.005 && !el.paused) el.pause()
    if (wanted && el.paused) void el.play().catch(() => undefined)
  },
}
