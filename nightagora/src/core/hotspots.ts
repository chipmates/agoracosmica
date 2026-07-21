/* The selection grammar of the whole night (Michel, 2026-07-20, after
   the Breton example): world-anchored points of interest. One device
   everywhere — the gold ring-and-bead mark with a letterpress label,
   44px targets, keyboard-tabbable, projected like every other chip. */

import { PerspectiveCamera, Vector3 } from 'three/webgpu'

export interface HotspotDef {
  id: string
  label: string
  /** world anchor */
  pos: Vector3
  open(): void
}

export interface HotspotsHandles {
  set(defs: HotspotDef[]): void
  /** project + place every frame; visible=false strikes them */
  sync(camera: PerspectiveCamera, visible: boolean): void
  clear(): void
}

export function createHotspots(container: HTMLElement): HotspotsHandles {
  interface Spot {
    def: HotspotDef
    el: HTMLButtonElement
  }
  let spots: Spot[] = []
  const projected = new Vector3()

  function clear(): void {
    for (const s of spots) s.el.remove()
    spots = []
  }

  function set(defs: HotspotDef[]): void {
    clear()
    for (const def of defs) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'hotspot'
      b.style.visibility = 'hidden'
      const mark = document.createElement('span')
      mark.className = 'hotspot-mark'
      mark.setAttribute('aria-hidden', 'true')
      const label = document.createElement('span')
      label.className = 'hotspot-label'
      label.textContent = def.label
      b.append(mark, label)
      b.addEventListener('click', () => def.open())
      container.appendChild(b)
      spots.push({ def, el: b })
    }
  }

  function sync(camera: PerspectiveCamera, visible: boolean): void {
    for (const s of spots) {
      if (!visible) {
        s.el.classList.remove('lit')
        s.el.style.visibility = 'hidden'
        continue
      }
      projected.copy(s.def.pos).project(camera)
      if (projected.z > 1 || Math.abs(projected.x) > 0.94 || Math.abs(projected.y) > 0.94) {
        s.el.classList.remove('lit')
        s.el.style.visibility = 'hidden'
        continue
      }
      s.el.style.left = `${(projected.x * 0.5 + 0.5) * innerWidth}px`
      s.el.style.top = `${(-projected.y * 0.5 + 0.5) * innerHeight}px`
      s.el.style.visibility = 'visible'
      s.el.classList.add('lit')
    }
  }

  return { set, sync, clear }
}
