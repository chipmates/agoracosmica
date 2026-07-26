/* THE MARKS — the selection grammar of the whole night (the founder,
   2026-07-20, after the Breton example): world-anchored points of interest,
   one device everywhere, the gold ring-and-bead with a letterpress name.

   The laws this file is carved from:

   · a mark is a LIGHT STANDING IN THE WORLD, not a control laid over it.
     Gold only ever emits here. Every gold hairline is carved out of ink, so
     the ring holds on the fire and on the dark ground alike, and a point
     that stands further off is smaller and quieter, the way a lamp is.
   · ONE point may beckon: the first unopened point of this stretch, and only
     until it has been opened. The call is a ring that opens and dissolves
     three times, then rests. Nothing bounces.
   · the letterpress belongs to the keeper first. A name that would fall
     across his voice steps to the other side, then goes silent, and a bead
     that would sit on his words is struck.
   · two marks that crowd each other do not fight: the nearer keeps its name,
     the further keeps its bead, and a name hushed by the crowd comes back
     the moment a hand reaches for it.
   · a point just past the frame is still a point. It walks to the rim and
     leans out on a hairline toward where it really stands, which is the only
     reason a phone has anything to reach for at all.
   · 44px of reach on any pointer, 52 under a finger, tabbable, and a struck
     mark is struck for the keyboard too (visibility, never opacity).
   · reduced motion still composes: the call stops moving and simply stays. */

import { PerspectiveCamera, Vector3 } from 'three/webgpu'

export interface HotspotDef {
  id: string
  label: string
  /** world anchor */
  pos: Vector3
  /** narrow-stage anchor: phones restage the set, they never clip it */
  posNarrow?: Vector3
  /** a point can belong to one stretch of a walk: a mark for a site you
      have not reached yet is a mark you cannot read */
  when?(): boolean
  open(): void
}

export interface HotspotsHandles {
  set(defs: HotspotDef[]): void
  /** project + place every frame; visible=false strikes them */
  sync(camera: PerspectiveCamera, visible: boolean): void
  clear(): void
}

// ------------------------------------------------------------- the geometry
/** the smallest honest target, and what a finger gets instead */
const REACH = 44
/** ink between the bead and its name at k = 1, and the name's own line */
const NAME_GAP = 17
const NAME_SIDE = 14
const NAME_H = 13
/** the frame the marks may stand in: the brand rides the top, the
    instrument rail the bottom */
const EDGE_X = 18
const EDGE_TOP = 42
const EDGE_BOTTOM = 80
/** a mark that leans in from the rim stands further inboard, because its
    hairline has to lean OUT and still be on the stage */
const RIM_X = 40
const RIM_TOP = 58
const RIM_BOTTOM = 96
/** how far past the frame a point may still lean in from the rim. Measured,
    not guessed: on a phone the camp's own points sit at 2.2 (the crossed-log
    fire from the via) and 5.0 (the standard, which is behind your shoulder
    and stays off) */
const RIM_BAND = 2.4
/** and how many may do it at once, so the frame never grows a border */
const RIM_MAX = 2
/** the rim decides once and then holds: a point breathing across the frame
    edge must not flick between standing here and leaning in */
const RIM_HOLD = 26
/** how far a rim mark may walk along its edge to find clear air */
const SLIDES = [0, 30, -30, 60, -60, 92, -92]
const NO_SLIDE = [0]
/** two beads nearer than this are one bead: the further one goes */
const CLOSE = 26
/** the world's own letterpress, inflated, so no NAME of ours touches it.
    The bead is judged against the bare lines: a light beside his first
    word is a light beside it, not on it. */
const VOICE_PAD = 10
/** and the closer judgement a name gets for the side it already holds */
const HOLD_PAD = 6

/** a point's size and its presence, both by how far off it stands */
const scaleAt = (d: number): number => Math.min(1.1, Math.max(0.78, 1.16 - 0.026 * d))
const dimAt = (d: number): number => Math.min(1, Math.max(0.62, 1.06 - 0.016 * d))

// ------------------------------------------------------------------ the ink
/* the marks carry their own stylesheet: one device, one place it is
   described, and it travels with the module that draws it. */
const STYLE_ID = 'na-marks-ink'
const INK = `
#hotspots .mark {
  --k: 1; --dim: 1; --ang: 0deg;
  position: absolute; left: 0; top: 0;
  display: block; width: ${REACH}px; height: ${REACH}px;
  margin: 0; padding: 0;
  background: none; border: 0; cursor: pointer;
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.9s ease var(--in, 0s);
  -webkit-tap-highlight-color: transparent;
}
@media (pointer: coarse) { #hotspots .mark { width: 52px; height: 52px; } }
#hotspots .mark.lit { opacity: 1; }
/* on its way out: no longer a target for any hand, and no delay on the
   fade — a point leaves at once, it just does not leave abruptly */
#hotspots .mark.going { pointer-events: none; transition: opacity 0.5s ease; }
#hotspots .mark > span { position: absolute; left: 50%; top: 50%; pointer-events: none; }
/* the name is part of the target: a wide word is a wider thing to reach for */
#hotspots .mark > .mark-name { pointer-events: auto; }
#hotspots .mark-glow, #hotspots .mark-reach,
#hotspots .mark-call, #hotspots .mark-ring, #hotspots .mark-bead { border-radius: 50%; }

/* the light this point throws: a lamp seen from across the ground. It is
   authored PALE on purpose — saturated gold at low alpha is darker than a
   firelit tent, and the glow read as a smudge of soot on the camp's bright
   canvas (round 4). A light may only ever lighten. */
#hotspots .mark-glow {
  width: 46px; height: 46px; margin: -23px 0 0 -23px;
  background: radial-gradient(circle closest-side,
    color-mix(in srgb, color-mix(in srgb, var(--na-gold) 46%, var(--na-starlight)) 30%, transparent),
    color-mix(in srgb, color-mix(in srgb, var(--na-gold) 46%, var(--na-starlight)) 8%, transparent) 54%,
    transparent 78%);
  transform: scale(var(--k));
  opacity: calc(0.6 * var(--dim));
  transition: opacity 0.45s ease;
}
/* the ring: one gold hairline with ink carved either side of it, which is
   the whole reason it still reads over a flame */
#hotspots .mark-ring {
  width: 19px; height: 19px; margin: -9.5px 0 0 -9.5px;
  border: 1px solid color-mix(in srgb, var(--na-gold) 78%, transparent);
  box-shadow:
    0 0 0 1px rgba(4, 6, 13, 0.55),
    0 0 12px color-mix(in srgb, var(--na-gold) 24%, transparent),
    inset 0 0 0 1px rgba(4, 6, 13, 0.4),
    inset 0 0 7px color-mix(in srgb, var(--na-gold) 8%, transparent);
  transform: scale(var(--k));
  opacity: var(--dim);
  transition: transform 0.34s cubic-bezier(0.2, 0.7, 0.2, 1),
    border-color 0.35s ease, box-shadow 0.35s ease;
}
/* the bead is a light, not a dot: a starlight core inside a gold bloom */
#hotspots .mark-bead {
  width: 3.5px; height: 3.5px; margin: -1.75px 0 0 -1.75px;
  background: var(--na-starlight);
  box-shadow:
    0 0 0 1px rgba(4, 6, 13, 0.34),
    0 0 5px color-mix(in srgb, var(--na-gold) 88%, transparent),
    0 0 12px color-mix(in srgb, var(--na-gold) 42%, transparent);
  transform: scale(var(--k));
  opacity: var(--dim);
  transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1);
}
/* the reach: a ring that opens under the hand and eases back */
#hotspots .mark-reach {
  width: 19px; height: 19px; margin: -9.5px 0 0 -9.5px;
  border: 1px solid color-mix(in srgb, var(--na-gold) 52%, transparent);
  opacity: 0; transform: scale(var(--k));
  transition: transform 0.62s cubic-bezier(0.16, 0.84, 0.24, 1), opacity 0.62s ease;
}
/* the call: the one point of this stretch you have not opened yet */
#hotspots .mark-call {
  width: 19px; height: 19px; margin: -9.5px 0 0 -9.5px;
  border: 1px solid color-mix(in srgb, var(--na-gold) 66%, transparent);
  opacity: 0; transform: scale(var(--k));
}
#hotspots .mark.beckon .mark-call { animation: na-mark-call 5.4s ease-out 3; }
@keyframes na-mark-call {
  0% { opacity: 0; transform: scale(var(--k)); }
  10% { opacity: 0.5; }
  52% { opacity: 0; transform: scale(calc(var(--k) * 2.7)); }
  100% { opacity: 0; transform: scale(calc(var(--k) * 2.7)); }
}
#hotspots .mark.beckon .mark-glow { opacity: calc(0.92 * var(--dim)); }
#hotspots .mark.beckon .mark-name { color: var(--na-gold); }

/* the rim: a point past the frame, leaning out toward where it stands */
#hotspots .mark-tick {
  width: 21px; height: 1px; margin: -0.5px 0 0 0;
  transform-origin: 0 50%;
  transform: rotate(var(--ang)) translateX(calc(var(--k) * 9px));
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--na-gold) 60%, transparent), transparent);
  opacity: 0; transition: opacity 0.4s ease;
}
#hotspots .mark.leaning .mark-tick { opacity: calc(0.9 * var(--dim)); }
#hotspots .mark.rim .mark-glow { opacity: 0; }
#hotspots .mark.rim .mark-ring { transform: scale(calc(var(--k) * 0.84)); }
#hotspots .mark.rim .mark-reach { transform: scale(calc(var(--k) * 0.84)); }
/* except when the rim mark is the stage's one offer: then it may glow */
#hotspots .mark.rim.beckon .mark-glow { opacity: calc(0.55 * var(--dim)); }

/* the name: the same letterpress the atlas plate speaks in, inked deep
   enough on its own glyphs to hold over fire and over dark ground */
#hotspots .mark-name {
  pointer-events: auto;
  font-family: var(--sans);
  font-size: 10px; line-height: ${NAME_H}px;
  letter-spacing: 0.3em; text-indent: 0.3em;
  text-transform: uppercase; white-space: nowrap;
  color: var(--na-starlight);
  /* carved, not floated: four hairline offsets give every glyph its own ink
     edge, which is the only thing that holds a gold name on the pale
     parchment of his lit desk, and the two blurs hold it on the dark */
  text-shadow:
    1px 0 1px rgba(3, 5, 12, 0.62), -1px 0 1px rgba(3, 5, 12, 0.62),
    0 1px 1px rgba(3, 5, 12, 0.7), 0 -1px 1px rgba(3, 5, 12, 0.55),
    0 0 9px rgba(3, 5, 12, 0.92),
    0 0 22px rgba(3, 5, 12, 0.7);
  opacity: var(--dim);
  transition: color 0.35s ease, letter-spacing 0.35s ease, opacity 0.5s ease;
}
#hotspots .mark-name.below { transform: translate(-50%, 0) translateY(calc(var(--k) * ${NAME_GAP}px)); }
#hotspots .mark-name.above { transform: translate(-50%, -100%) translateY(calc(var(--k) * -${NAME_GAP}px)); }
#hotspots .mark-name.right { transform: translate(0, -50%) translateX(calc(var(--k) * ${NAME_SIDE}px)); }
#hotspots .mark-name.left  { transform: translate(-100%, -50%) translateX(calc(var(--k) * -${NAME_SIDE}px)); }

/* hushed by the crowd: the bead keeps standing, the name waits to be asked */
#hotspots .mark.quiet .mark-name { opacity: 0; }
#hotspots .mark.quiet .mark-glow { opacity: calc(0.28 * var(--dim)); }
#hotspots .mark.quiet:hover .mark-name,
#hotspots .mark.quiet:focus-visible .mark-name { opacity: 1; }

#hotspots .mark:hover .mark-reach { opacity: 0.5; transform: scale(calc(var(--k) * 2.1)); }
#hotspots .mark:focus-visible .mark-reach {
  opacity: 0.9; transform: scale(calc(var(--k) * 2.1));
  border-color: var(--na-gold); border-width: 1.5px;
  box-shadow: 0 0 0 1px rgba(4, 6, 13, 0.5), 0 0 14px color-mix(in srgb, var(--na-gold) 30%, transparent);
}
#hotspots .mark:hover .mark-ring, #hotspots .mark:focus-visible .mark-ring {
  border-color: var(--na-gold);
  box-shadow:
    0 0 0 1px rgba(4, 6, 13, 0.55),
    0 0 20px color-mix(in srgb, var(--na-gold) 48%, transparent),
    inset 0 0 0 1px rgba(4, 6, 13, 0.4),
    inset 0 0 9px color-mix(in srgb, var(--na-gold) 22%, transparent);
}
#hotspots .mark:hover .mark-glow, #hotspots .mark:focus-visible .mark-glow {
  opacity: calc(1 * var(--dim));
}
#hotspots .mark:hover .mark-name, #hotspots .mark:focus-visible .mark-name {
  color: var(--na-gold); letter-spacing: 0.34em; text-indent: 0.34em;
}
#hotspots .mark:focus-visible { outline: none; }
#hotspots .mark:active .mark-ring { transform: scale(calc(var(--k) * 0.9)); }
#hotspots .mark:active .mark-bead { transform: scale(calc(var(--k) * 1.6)); }

@media (max-width: 720px) {
  #hotspots .mark-name { font-size: 9px; letter-spacing: 0.26em; text-indent: 0.26em; }
}
/* a wide stage is a room seen from further back: at 10px over eight hundred
   pixels of marble the whole device turned to dust (round 3) */
@media (min-width: 1100px) {
  #hotspots .mark-ring, #hotspots .mark-reach, #hotspots .mark-call {
    width: 22px; height: 22px; margin: -11px 0 0 -11px;
  }
  #hotspots .mark-bead { width: 4px; height: 4px; margin: -2px 0 0 -2px; }
  #hotspots .mark-glow { width: 54px; height: 54px; margin: -27px 0 0 -27px; }
  #hotspots .mark-name { font-size: 11px; letter-spacing: 0.32em; text-indent: 0.32em; }
  #hotspots .mark:hover .mark-name, #hotspots .mark:focus-visible .mark-name {
    letter-spacing: 0.36em; text-indent: 0.36em;
  }
}
@media (prefers-reduced-motion: reduce) {
  #hotspots .mark, #hotspots .mark > span { transition-duration: 0.001s; }
  #hotspots .mark.beckon .mark-call {
    animation: none; opacity: 0.36; transform: scale(calc(var(--k) * 1.75));
  }
}
/* the rig judges still frames: no transitions, and the call frozen at a
   phase where it can be READ instead of caught at a random moment */
body.forge #hotspots .mark, body.forge #hotspots .mark > span { transition: none !important; }
body.forge #hotspots .mark.beckon .mark-call {
  animation-delay: -1.35s !important; animation-play-state: paused !important;
}
`

function inkOnce(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = INK
  document.head.appendChild(style)
}

// ------------------------------------------------------------- the placing
type Side = 'below' | 'above' | 'right' | 'left'

interface Rect {
  l: number
  t: number
  r: number
  b: number
}

const hits = (a: Rect, b: Rect, pad = 0): boolean =>
  a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad
const inside = (x: number, y: number, r: Rect, pad = 0): boolean =>
  x > r.l - pad && x < r.r + pad && y > r.t - pad && y < r.b + pad

/** every text-bearing part of the keeper's voice, by TAG and not by class:
    his letterpress is built in two places and a class list goes stale the
    moment one of them gains a line (round 5: the station under his name was
    a class this file had never heard of, and every mark walked over it) */
const VOICE_SEL = '#keeper p, #keeper button, #keeper label'

/** a line that is laid out is not a line that is READ: the keeper's offers
    sit in the flow at zero opacity long before he makes them.

    The test is opacity ZERO, not opacity FAINT, and that distinction is the
    whole point: a line resting at 0 is not there, but a line at 0.02 is a
    line ARRIVING, and the marks have to have moved out of its way before it
    lands (round 5: his voice fades in over 1.4s, and every mark sat happily
    on top of it for the whole fade). */
function painted(node: Element): boolean {
  let el: Element | null = node
  for (let up = 0; up < 5 && el; up++) {
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || Number(cs.opacity) <= 0.001) return false
    el = el.parentElement
  }
  return true
}

export function createHotspots(container: HTMLElement): HotspotsHandles {
  inkOnce()

  interface Spot {
    def: HotspotDef
    el: HTMLButtonElement
    name: HTMLElement
    /** measured letterpress width, remeasured when the stage changes size */
    w: number
    order: number
    struck: boolean
    /** last frame's verdicts, so placement holds instead of flicking */
    rim: boolean
    side: Side
    cls: string
    tf: string
    k: number
    dim: number
    ang: number
    z: number
    fade: number
  }

  interface Place {
    spot: Spot
    x: number
    y: number
    depth: number
    k: number
    dim: number
    rim: boolean
    ang: number
    /** the hairline only leans out where there is clear air to lean into */
    tick: boolean
    side: Side
    quiet: boolean
    beckon: boolean
    dead: boolean
  }

  let spots: Spot[] = []
  /** opened this visit: a point that has been walked into stops calling */
  const opened = new Set<string>()
  const projected = new Vector3()
  const places: Place[] = []
  const taken: Rect[] = []
  /** every line of the world's own letterpress, pooled: no bead may stand
      on one and no name of ours may touch one */
  const lines: Rect[] = []
  let lineN = 0
  const range = document.createRange()
  const box: Rect = { l: 0, t: 0, r: 0, b: 0 }
  let frame = 0

  addEventListener('resize', () => {
    for (const s of spots) s.w = 0
  })

  function clear(): void {
    for (const s of spots) {
      window.clearTimeout(s.fade)
      s.el.remove()
    }
    spots = []
    places.length = 0
  }

  function set(defs: HotspotDef[]): void {
    clear()
    let order = 0
    for (const def of defs) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'hotspot mark'
      b.style.visibility = 'hidden'
      // the points of a stage light one after another, never all at once
      b.style.setProperty('--in', `${Math.min(0.42, order * 0.07)}s`)
      for (const part of ['mark-glow', 'mark-call', 'mark-reach', 'mark-tick', 'mark-ring', 'mark-bead']) {
        const el = document.createElement('span')
        el.className = part
        el.setAttribute('aria-hidden', 'true')
        b.appendChild(el)
      }
      const name = document.createElement('span')
      name.className = 'mark-name below'
      name.textContent = def.label
      b.appendChild(name)
      b.addEventListener('click', (e) => {
        // THE MARK IS THE TARGET. The world keeps a generous halo around each
        // point for the hand that misses, and that halo would fire a SECOND
        // time on every hit — which toggled the traces open and shut again in
        // the same click. A hit on the mark is the whole event.
        e.stopPropagation()
        opened.add(def.id)
        def.open()
      })
      container.appendChild(b)
      spots.push({
        def, el: b, name,
        w: 0, order, struck: true, rim: false, side: 'below', cls: '', tf: '',
        k: -1, dim: -1, ang: -999, z: -1, fade: 0,
      })
      order++
    }
    // one layout for the whole set, never one per mark
    for (const s of spots) s.w = s.name.offsetWidth
    frame = 0
  }

  /** a point leaves the way it arrived. It stops being a target at once (no
      hand and no keyboard reaches a point that is no longer offered) and its
      light goes out over half a second, because a mark that blinks out reads
      as a fault in the page rather than as a place you have walked past. */
  function strike(s: Spot): void {
    s.rim = false
    if (s.struck) return
    s.struck = true
    s.cls = ''
    s.el.className = 'hotspot mark going'
    s.el.tabIndex = -1
    if (document.body.classList.contains('forge')) {
      s.el.style.visibility = 'hidden'
      return
    }
    window.clearTimeout(s.fade)
    s.fade = window.setTimeout(() => {
      if (s.struck) s.el.style.visibility = 'hidden'
    }, 560)
  }

  /** ONE LINE, NOT ONE BOX. A block of centred letterpress is mostly empty
      air at its flanks, and a bounding box over the keeper's voice made the
      whole left half of a phone a no-go zone. Ranges give the boxes the
      GLYPHS actually occupy, which is what the law was always about. */
  function addLines(el: Element): void {
    if (!painted(el)) return
    range.selectNodeContents(el)
    const rs = range.getClientRects()
    let row: Rect | null = null
    for (let i = 0; i < rs.length; i++) {
      const q = rs[i]
      if (!q || q.width < 2 || q.height < 2) continue
      // His lines arrive word by word, so one sentence hands back forty
      // boxes — and they alternate between the span's box and the text's,
      // which is why they have to be merged by OVERLAP and not by matching
      // edges (round 5: edge-matching kept every word as its own line, the
      // pool filled on the first sentence, and his second line went unread).
      const mid = (q.top + q.bottom) / 2
      if (row && mid > row.t && mid < row.b) {
        row.l = Math.min(row.l, q.left)
        row.r = Math.max(row.r, q.right)
        row.t = Math.min(row.t, q.top)
        row.b = Math.max(row.b, q.bottom)
        continue
      }
      if (lineN >= 24) return
      const rect = lines[lineN] ?? (lines[lineN] = { l: 0, t: 0, r: 0, b: 0 })
      rect.l = q.left
      rect.t = q.top
      rect.r = q.right
      rect.b = q.bottom
      row = rect
      lineN++
    }
  }

  /** what the world is already saying, so the marks never talk over it.
      Read at the head of the frame, before a single style is written. */
  function readVoice(): void {
    lineN = 0
    const keeper = document.getElementById('keeper')
    if (keeper && !keeper.hidden) {
      for (const node of document.querySelectorAll(VOICE_SEL)) addLines(node)
    }
    const trace = document.getElementById('trace-card')
    if (trace && !trace.hidden) addLines(trace)
    const brand = document.querySelector('.brand')
    if (brand) addLines(brand)
  }

  /** the 44px target a mark actually presents to a finger */
  const target: Rect = { l: 0, t: 0, r: 0, b: 0 }

  function nameBox(p: Place, side: Side, out: Rect): void {
    const w = p.spot.w
    const gap = NAME_GAP * p.k
    const beside = NAME_SIDE * p.k
    if (side === 'below') {
      out.l = p.x - w / 2; out.r = p.x + w / 2
      out.t = p.y + gap; out.b = p.y + gap + NAME_H
    } else if (side === 'above') {
      out.l = p.x - w / 2; out.r = p.x + w / 2
      out.t = p.y - gap - NAME_H; out.b = p.y - gap
    } else if (side === 'right') {
      out.l = p.x + beside; out.r = p.x + beside + w
      out.t = p.y - NAME_H / 2; out.b = p.y + NAME_H / 2
    } else {
      out.l = p.x - beside - w; out.r = p.x - beside
      out.t = p.y - NAME_H / 2; out.b = p.y + NAME_H / 2
    }
  }

  function sync(camera: PerspectiveCamera, visible: boolean): void {
    if (!visible) {
      for (const s of spots) strike(s)
      places.length = 0
      return
    }
    const W = innerWidth
    const H = innerHeight
    const narrow = camera.aspect < 0.9
    // the world's own letterpress moves slowly: reading it every frame would
    // cost a layout for nothing. THE RIG IS THE EXCEPTION — it runs a couple
    // of frames per shot, so a throttled read there means a frame judged
    // against letterpress that had not appeared yet (round 5: the marks sat
    // on his name in a letterbox window and the numbers said they did not)
    if (frame % 4 === 0 || document.body.classList.contains('forge')) readVoice()
    frame++

    // ---- who is on this stage at all, and where each one falls
    places.length = 0
    for (const s of spots) {
      const def = s.def
      if (def.when && !def.when()) {
        strike(s)
        continue
      }
      const anchor = narrow && def.posNarrow ? def.posNarrow : def.pos
      projected.copy(anchor).project(camera)
      if (projected.z > 1 || Math.abs(projected.x) > RIM_BAND || Math.abs(projected.y) > RIM_BAND) {
        strike(s)
        continue
      }
      const rawX = (projected.x * 0.5 + 0.5) * W
      const rawY = (-projected.y * 0.5 + 0.5) * H
      // once a point is leaning in from the rim it keeps leaning until it
      // stands WELL inside again, so a breath across the edge never flicks
      const hold = s.rim ? RIM_HOLD : 0
      let x = rawX
      let y = rawY
      let rim = false
      if (
        rawX < EDGE_X + hold || rawX > W - EDGE_X - hold ||
        rawY < EDGE_TOP + hold || rawY > H - EDGE_BOTTOM - hold
      ) {
        rim = true
        x = Math.min(Math.max(rawX, RIM_X), W - RIM_X)
        y = Math.min(Math.max(rawY, RIM_TOP), H - RIM_BOTTOM)
        // and it never leans in ON a line of the world's own letterpress:
        // it steps clear of that line, or it stays off-stage
        for (let i = 0; i < lineN; i++) {
          const v = lines[i]
          if (!v || !inside(x, y, v, VOICE_PAD)) continue
          if (v.b < H * 0.5) y = v.b + VOICE_PAD + 8
          else y = v.t - VOICE_PAD - 8
        }
        if (y < RIM_TOP || y > H - RIM_BOTTOM) {
          strike(s)
          continue
        }
      }
      s.rim = rim
      const depth = anchor.distanceTo(camera.position)
      if (s.w === 0) s.w = s.name.offsetWidth
      places.push({
        spot: s,
        x: Math.round(x),
        y: Math.round(y),
        depth,
        k: rim ? scaleAt(depth) * 0.86 : scaleAt(depth),
        dim: rim ? dimAt(depth) * 0.9 : dimAt(depth),
        rim,
        ang: rim ? (Math.atan2(rawY - y, rawX - x) * 180) / Math.PI : 0,
        tick: rim,
        side: 'below',
        quiet: false,
        beckon: false,
        dead: false,
      })
    }

    // ---- the nearest first: a point you could touch outranks one you could not
    places.sort((a, b) => a.depth - b.depth)

    // the rim is a whisper from off-stage, never a border of pips
    let rims = 0
    for (const p of places) {
      if (!p.rim) continue
      rims++
      if (rims > RIM_MAX) p.dead = true
    }

    // a bead standing ON the world's own words is struck, and two beads
    // closer than a thumb are one bead: the further one steps out of frame
    for (let i = 0; i < places.length; i++) {
      const p = places[i]
      if (!p || p.dead) continue
      const a = (p.ang * Math.PI) / 180
      const tx = p.x + Math.cos(a) * 30 * p.k
      const ty = p.y + Math.sin(a) * 30 * p.k
      if (p.tick && (tx < 4 || tx > W - 4 || ty < 4 || ty > H - 4)) p.tick = false
      // A MARK IS A 44px TARGET, not a point. Testing its centre against
      // his voice let a bead sit half over the way onward and take the tap
      // meant for it: on a phone at the overlook, the hearth mark swallowed
      // "Return to the agora fire" (round 10, caught by the live walk).
      const half = 22 * Math.max(0.7, p.k)
      target.l = p.x - half
      target.r = p.x + half
      target.t = p.y - half
      target.b = p.y + half
      for (let n = 0; n < lineN; n++) {
        const v = lines[n]
        if (!v) continue
        if (hits(target, v, 2)) p.dead = true
        // and a hairline never draws itself through them either
        if (p.tick && inside(tx, ty, v, 3)) p.tick = false
      }
      if (p.dead) continue
      for (let j = 0; j < i; j++) {
        const q = places[j]
        if (!q || q.dead) continue
        if (Math.hypot(p.x - q.x, p.y - q.y) < CLOSE) {
          p.dead = true
          break
        }
      }
    }

    // ---- the call: the first point of this stretch nobody has opened yet.
    // A point STANDING here always outranks one leaning in from off-stage,
    // but a stage whose only offer is at the rim still gets to make it (on a
    // phone at his tent, that rim mark is the whole reason to walk on)
    let call: Place | null = null
    for (const p of places) {
      if (p.dead || opened.has(p.spot.def.id)) continue
      if (!call) call = p
      else if (call.rim !== p.rim) call = call.rim ? p : call
      else if (p.spot.order < call.spot.order) call = p
    }
    if (call) call.beckon = true

    // ---- the names, the one that calls placed first
    places.sort((a, b) => (b.beckon ? 1 : 0) - (a.beckon ? 1 : 0) || a.depth - b.depth)
    taken.length = 0
    for (const p of places) {
      if (p.dead) continue
      const w = p.spot.w
      // a mark standing on its own point does not move. A mark leaning in
      // from off-stage is already only half here, so it may WALK THE RIM a
      // little to find air rather than vanish (which is what the phone did)
      const alongY = p.rim && Math.abs(Math.cos((p.ang * Math.PI) / 180)) > 0.7
      const x0 = p.x
      const y0 = p.y
      let placed = false
      for (const slide of p.rim ? SLIDES : NO_SLIDE) {
        p.x = alongY ? x0 : x0 + slide
        p.y = alongY ? y0 + slide : y0
        if (p.x < RIM_X || p.x > W - RIM_X || p.y < RIM_TOP || p.y > H - RIM_BOTTOM) continue
        let onWords = false
        for (let n = 0; n < lineN; n++) {
          const v = lines[n]
          if (v && inside(p.x, p.y, v)) { onWords = true; break }
        }
        if (onWords) continue
        // at an edge a centred name would walk off the stage, so it runs
        // inboard from its own bead instead
        const order: Side[] =
          p.x - w / 2 < EDGE_X ? ['right', 'below', 'above', 'left']
          : p.x + w / 2 > W - EDGE_X ? ['left', 'below', 'above', 'right']
          : p.y > H - EDGE_BOTTOM - NAME_GAP - NAME_H ? ['above', 'below', 'right', 'left']
          : ['below', 'above', 'right', 'left']
        // the side it took last frame is tried first and judged closer, so a
        // name does not hop across its own bead every time the keeper draws
        // breath and his lines shift a pixel
        for (let c = -1; c < order.length; c++) {
          const side = c < 0 ? p.spot.side : order[c]
          if (!side || (c >= 0 && side === p.spot.side)) continue
          const pad = c < 0 ? HOLD_PAD : VOICE_PAD
          nameBox(p, side, box)
          if (box.l < EDGE_X || box.r > W - EDGE_X || box.t < EDGE_TOP || box.b > H - EDGE_BOTTOM) continue
          let clash = false
          for (const t of taken) if (hits(box, t, 4)) { clash = true; break }
          if (!clash) {
            for (let n = 0; n < lineN; n++) {
              const v = lines[n]
              if (v && hits(box, v, pad)) { clash = true; break }
            }
          }
          if (clash) continue
          p.side = side
          placed = true
          taken.push({ l: box.l, t: box.t, r: box.r, b: box.b })
          break
        }
        if (placed) break
      }
      // no clear air anywhere: an anchored bead keeps standing and its name
      // waits to be asked, but a mark leaning in from off-stage is ONLY its
      // name — without it there is nothing to read, so it stays off-stage
      if (!placed) {
        p.x = x0
        p.y = y0
        if (p.rim) p.dead = true
        else p.quiet = true
      }
    }

    // ---- last guard: a name may never run off the stage. The side is
    // chosen against a measured width, but a width measured before the type
    // has its letterspacing reads short, and the first frame of a phone
    // stage is exactly when that happens (round 10: THE COMMONS lost its T).
    // So the box is checked once more against a fresh read, and the mark
    // leans inward until its own name fits.
    for (const p of places) {
      if (p.dead) continue
      const live = p.spot.name.offsetWidth
      if (live > 0 && live !== p.spot.w) p.spot.w = live
      nameBox(p, p.side, box)
      if (box.l < EDGE_X) p.x += EDGE_X - box.l
      else if (box.r > W - EDGE_X) p.x -= box.r - (W - EDGE_X)
      nameBox(p, p.side, box)
      if (box.t < EDGE_TOP) p.y += EDGE_TOP - box.t
      else if (box.b > H - EDGE_BOTTOM) p.y -= box.b - (H - EDGE_BOTTOM)
    }

    // ---- and only now, one write per mark that actually changed
    for (const p of places) {
      if (p.dead) continue
      const s = p.spot
      const cls =
        `hotspot mark lit${p.rim ? ' rim' : ''}${p.tick ? ' leaning' : ''}` +
        `${p.quiet ? ' quiet' : ''}${p.beckon ? ' beckon' : ''}`
      if (s.cls !== cls) {
        s.el.className = cls
        s.cls = cls
      }
      if (s.side !== p.side) {
        s.name.className = `mark-name ${p.side}`
        s.side = p.side
      }
      const tf = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`
      if (s.tf !== tf) {
        s.el.style.transform = tf
        s.tf = tf
      }
      if (s.k !== p.k) {
        s.el.style.setProperty('--k', p.k.toFixed(3))
        s.k = p.k
      }
      if (s.dim !== p.dim) {
        s.el.style.setProperty('--dim', p.dim.toFixed(3))
        s.dim = p.dim
      }
      if (p.rim && s.ang !== p.ang) {
        s.el.style.setProperty('--ang', `${p.ang.toFixed(1)}deg`)
        s.ang = p.ang
      }
      // a nearer point draws over a further one, the way it stands
      const z = Math.max(0, 400 - Math.round(p.depth * 8))
      if (s.z !== z) {
        s.el.style.zIndex = `${z}`
        s.z = z
      }
      if (s.struck) {
        s.struck = false
        window.clearTimeout(s.fade)
        s.el.tabIndex = 0
        s.el.style.visibility = 'visible'
      }
    }
    for (const p of places) if (p.dead) strike(p.spot)
  }

  return { set, sync, clear }
}
