import {
  Mesh, Raycaster, Vector3,
  type Intersection, type Material, type Object3D, type PerspectiveCamera,
} from 'three/webgpu'

export type VinciLabelMode = 0 | 1 | 2
export interface VinciLabelRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface VinciLabelAnchor {
  /** A null anchor means there is no built object for this station to name. */
  setAnchor(point: Readonly<Vector3> | null, accessibleLabel?: string): void
  setMode(mode: VinciLabelMode): void
  /** Call after the rail updates the camera. Pass the visible card's real box. */
  update(cardRect?: VinciLabelRect | null, now?: number): void
  /** Invalidate after a retained opaque object changes position or geometry. */
  invalidate(): void
  dispose(): void
}

function opaqueMaterial(material: Material | undefined): boolean {
  if (!material || !material.visible || material.transparent || material.opacity < 1) return false
  const physical = material as Material & { transmission?: number; transmissionNode?: unknown }
  return !(physical.transmission && physical.transmission > 0) && physical.transmissionNode == null
}

function visibleAncestors(object: Object3D): boolean {
  for (let parent: Object3D | null = object; parent; parent = parent.parent) {
    if (!parent.visible) return false
  }
  return true
}

/** Static scene membership is collected once. Water's opaque banks and bed
 * remain eligible; only its reflective surface meshes are excluded. */
export function collectVinciLabelOccluders(root: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse(object => {
    if (!(object instanceof Mesh) || object.userData['labelOccluder'] === false) return
    if (object.userData['manifestId'] === 'vinci/sky' || /(?:^|\/)(?:stream-water|stream-reflection)$/.test(object.name)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    if (!materials.some(opaqueMaterial)) return
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
    meshes.push(object)
  })
  return meshes
}

/** A reconstructed shell's dot is always amber. This helper supplies no
 * historical copy and cannot turn a future station into a built exhibit. */
export function createVinciLabelAnchor(options: {
  host: HTMLElement
  camera: PerspectiveCamera
  occluders: readonly Mesh[]
  onOpen: () => void
}): VinciLabelAnchor {
  const { host, camera, occluders, onOpen } = options
  const document = host.ownerDocument
  const view = document.defaultView!
  const dot = document.createElement('button')
  dot.className = 'vinci-dot'
  dot.type = 'button'
  dot.hidden = true
  dot.style.width = dot.style.height = '44px'
  dot.dataset['naClaim'] = 'inferred'
  dot.dataset['naAnchorClass'] = 'GENERATED'
  dot.dataset['naAnchor'] = 'vinci/shell'
  dot.addEventListener('click', onOpen)
  const leader = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  leader.classList.add('vinci-leader')
  leader.setAttribute('width', '100%')
  leader.setAttribute('height', '100%')
  leader.setAttribute('aria-hidden', 'true')
  leader.style.visibility = 'hidden'
  const line = document.createElementNS(leader.namespaceURI, 'line')
  leader.append(line)
  host.prepend(leader)
  host.append(dot)

  const anchor = new Vector3()
  const observedEye = new Vector3(Infinity, 0, 0)
  const eye = new Vector3(), projected = new Vector3(), direction = new Vector3()
  const ray = new Raycaster()
  const hits: Intersection<Mesh>[] = []
  let mode: VinciLabelMode = 1, hasAnchor = false, dirty = true, occluded = true
  let changedAt = -Infinity, disposed = false
  const tolerance = 0.08
  const settleMs = 80

  function hide(): void {
    dot.hidden = true
    leader.style.visibility = 'hidden'
  }

  function invalidate(): void {
    dirty = true
    occluded = true
    changedAt = view.performance.now()
    hide()
  }

  function blocked(): boolean {
    direction.subVectors(anchor, eye)
    const distance = direction.length()
    if (distance <= tolerance) return true
    ray.set(eye, direction.multiplyScalar(1 / distance))
    ray.near = 0
    ray.far = distance - tolerance
    // This is a binary visibility query. The first eligible hit before the
    // anchor blocks it; a hit on a transparent group is skipped by material.
    for (const mesh of occluders) {
      if (!visibleAncestors(mesh)) continue
      mesh.updateWorldMatrix(true, false)
      hits.length = 0
      ray.intersectObject(mesh, false, hits)
      for (const hit of hits) {
        const material = Array.isArray(mesh.material)
          ? mesh.material[hit.face?.materialIndex ?? 0]
          : mesh.material
        if (opaqueMaterial(material)) return true
      }
    }
    return false
  }

  return {
    setAnchor(point, accessibleLabel) {
      if (disposed) return
      const changed = point ? !hasAnchor || !anchor.equals(point) : hasAnchor
      hasAnchor = point !== null
      if (point) {
        anchor.copy(point)
        dot.setAttribute('aria-label', accessibleLabel ?? '')
      }
      if (changed) invalidate()
      if (!hasAnchor) hide()
    },
    setMode(next) {
      mode = next
      if (mode === 0) hide()
      else if (mode !== 2) leader.style.visibility = 'hidden'
    },
    update(cardRect = null, now = view.performance.now()) {
      if (disposed || !hasAnchor || mode === 0) { hide(); return }
      camera.updateWorldMatrix(true, false)
      camera.getWorldPosition(eye)
      if (eye.distanceToSquared(observedEye) > 1e-10) {
        observedEye.copy(eye)
        changedAt = now
        dirty = true
      }
      // A translated eye has a new sightline. Keep it unclaimed until it
      // settles, avoiding stale dots and repeated full-terrain raycasts.
      if (dirty) {
        if (now - changedAt < settleMs) { hide(); return }
        occluded = blocked()
        dirty = false
      }
      projected.copy(anchor).project(camera)
      const width = view.innerWidth, height = view.innerHeight
      const x = (projected.x * 0.5 + 0.5) * width
      const y = (-projected.y * 0.5 + 0.5) * height
      const covered = mode === 2 && cardRect !== null && x + 22 >= cardRect.left
        && x - 22 <= cardRect.right && y + 22 >= cardRect.top && y - 22 <= cardRect.bottom
      const visible = !occluded && !covered && projected.z > -1 && projected.z < 1
        && x > 22 && x < width - 22 && y > 120 && y < height - 220
      if (!visible) { hide(); return }
      dot.hidden = false
      dot.style.left = `${x}px`
      dot.style.top = `${y}px`
      if (mode !== 2 || !cardRect) { leader.style.visibility = 'hidden'; return }
      // The nearest clamped point lies on the card's boundary because the
      // anchor has already been rejected when covered by that rectangle.
      const endX = Math.max(cardRect.left, Math.min(cardRect.right, x))
      const endY = Math.max(cardRect.top, Math.min(cardRect.bottom, y))
      line.setAttribute('x1', String(x))
      line.setAttribute('y1', String(y))
      line.setAttribute('x2', String(endX))
      line.setAttribute('y2', String(endY))
      leader.style.visibility = 'visible'
    },
    invalidate,
    dispose() {
      disposed = true
      dot.removeEventListener('click', onOpen)
      dot.remove()
      leader.remove()
      hits.length = 0
    },
  }
}
