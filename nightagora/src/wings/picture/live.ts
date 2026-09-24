/* THE LIVE ENGINE BEHIND THE SAME SEAM, for development only: the forge reads
   the live wing through the calls the chrome makes of the film (a node stood
   at, its marks, a point projected), so a marks file is the live picture's
   own reading. Loaded only by the export's address; never offered to a
   visitor. */

import { deskStageHeight } from '../desk-stage'
import { vinciApproachStation } from '../vinci/collection/approaches'
import { vinciWallOfExhibit, vinciWallVertex, vinciWallById } from '../vinci/collection/wall'
import type { FilmMotion, FilmNode } from '../vinci/film'
import type { VinciWalk } from '../vinci/walk'
import type { VinciStationId } from '../vinci/content'
import { parsePrint, projectPrint, type PictureBox, type PictureEvent, type PictureMark, type PictureNode, type PictureSource, type PictureState } from './seam'

interface FilmHook {
  place(node: FilmNode): boolean
  walk(from: FilmNode, to: FilmNode, motion: FilmMotion): boolean
  state(): { walking: boolean }
}

/** A node of the film graph, resolved the way `forge/film/graph.mjs` builds it. */
function resolveNode(walk: VinciWalk, id: PictureNode): FilmNode | null {
  if (id.startsWith('stop:')) {
    const walkId = id.slice(5)
    const stop = walk.stops.find(s => s.id === walkId)
    if (!stop) return null
    const wall = stop.wall ? vinciWallById(stop.wall) : undefined
    const vertex = wall && stop.exhibit ? vinciWallVertex(wall, stop.exhibit) : undefined
    return { id, kind: 'stop', station: stop.station, walkId, ...(stop.exhibit ? { exhibit: stop.exhibit } : {}),
      ...(wall && vertex !== undefined ? { wall: wall.id, vertex } : {}) }
  }
  if (id.startsWith('view:')) {
    const exhibit = id.slice(5)
    const station = vinciApproachStation(exhibit)
    if (!station) return null
    const wall = vinciWallOfExhibit(exhibit)
    const vertex = wall ? vinciWallVertex(wall, exhibit) : undefined
    return { id, kind: 'view', station: station as VinciStationId, exhibit, ...(wall && vertex !== undefined ? { wall: wall.id, vertex } : {}) }
  }
  return null
}

export function createLivePicture(hook: FilmHook, walk: VinciWalk): PictureSource {
  let here: PictureNode = ''
  const box = (): PictureBox => ({ left: 0, top: 0, width: innerWidth, height: deskStageHeight() })
  const canvas = (): HTMLElement => document.querySelector<HTMLElement>('#stage canvas') ?? document.body
  const state = (): PictureState => ({ kind: 'rest', node: here })
  return {
    kind: 'live',
    get element() { return canvas() },
    /* A CUT, as the stills are shot: the eye stood at the node at once, and
       answered when the rail says it stands */
    async go(node) {
      const at = resolveNode(walk, node)
      if (!at || !hook.place(at)) return here
      for (let i = 0; i < 600 && hook.state().walking; i++) await new Promise(r => requestAnimationFrame(r))
      here = node
      return here
    },
    hurry() {},
    ahead() {},
    lean() {},
    reach: node => (resolveNode(walk, node) ? 'walk' : 'none'),
    state,
    /** the marks the live wing draws now, in picture-box pixels */
    marks(_node, _lang) {
      const out: PictureMark[] = []
      for (const dot of document.querySelectorAll<HTMLElement>('.vinci-exhibit-dot')) {
        if (dot.hidden || !dot.dataset['exhibit']) continue
        out.push({ id: dot.dataset['exhibit'], x: parseFloat(dot.style.left) || 0, y: parseFloat(dot.style.top) || 0,
          walks: dot.dataset['mark'] === 'walk', label: dot.dataset['name'] ?? '', word: dot.dataset['word'] ?? '',
          colour: dot.style.getPropertyValue('--certainty').trim() })
      }
      return out
    },
    project(point) {
      const cam = (window as unknown as { __forge?: { state(): { cam?: { p: number[]; r: number[]; fov: number } } } }).__forge?.state().cam
      if (!cam) return null
      const print = parsePrint([...cam.p, ...cam.r, cam.fov].join(','))
      const b = box()
      const at = print ? projectPrint(print, b.width / b.height, point) : null
      return at ? { x: b.left + at.u * b.width, y: b.top + at.v * b.height } : null
    },
    box,
    framing: () => (innerWidth / innerHeight <= 0.9 ? 'upright' : 'wide'),
    on(_event: PictureEvent, _fn: (s: PictureState) => void) { return () => {} },
    ready: () => Promise.resolve(),
    update() {},
    veil() {},
    dispose() {},
  }
}
