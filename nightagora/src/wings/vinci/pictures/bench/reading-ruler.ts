/** A physical comparison beside the closer reading camera. Its endpoints
 * live on the measured field's plane. No CSS artwork dimension drives it. */
import { Vector3, type PerspectiveCamera } from 'three/webgpu'
import { element } from '..'

export function createReadingRuler() {
  const root = element('div', 'picture-reading-ruler')
  root.setAttribute('aria-hidden', 'true')
  root.dataset['manifestId'] = 'vinci/pictures/reading-ruler'
  const rule = element('span', 'picture-reading-rule')
  const caption = element('span', 'picture-reading-unit')
  root.append(rule, caption)
  return {
    root,
    update(camera: PerspectiveCamera, field: { x: number; y: number; z: number; width: number; height: number }, viewport: { width: number; height: number }) {
      const cm = field.height > 1 ? 50 : 10
      const centre = new Vector3(field.x + field.width / 2, field.y, field.z).project(camera)
      const top = new Vector3(field.x, field.y + cm / 200, field.z).project(camera)
      const bottom = new Vector3(field.x, field.y - cm / 200, field.z).project(camera)
      const height = Math.abs(top.y - bottom.y) * viewport.height / 2
      const edge = (centre.x + 1) * viewport.width / 2
      root.style.left = `${Math.min(viewport.width - 38, edge + 20)}px`
      root.style.top = `${(1 - centre.y) * viewport.height / 2 - height / 2}px`
      rule.style.height = `${height}px`
      caption.textContent = `${cm} cm`
      root.dataset['lengthCm'] = String(cm)
      root.dataset['projectedPx'] = String(height)
    },
  }
}
