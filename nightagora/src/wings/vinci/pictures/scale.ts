import { Vector2, Vector3, type BufferGeometry, type Camera, type Matrix4 } from 'three';
import type { PictureWork } from './register';

export const PICTURE_DATUM_M = 1.55;
export interface TruePictureScale {
  readonly heightM: number;
  readonly widthM: number;
  /** Null for murals and drawers whose locked register does not assign a datum. */
  readonly datumM: number | null;
}
export type PictureDimensions = Pick<PictureWork, 'height_cm' | 'width_cm' | 'hang'>;

/** The only centimetre-to-world conversion used to construct apertures.
 * Unknown painted extents have no outline. Furniture and raster cards have
 * separate design dimensions and are never reported as measured originals.
 */
export function trueScale(work: PictureDimensions): TruePictureScale | null {
  if (work.height_cm === null || work.width_cm === null) return null;
  if (!Number.isFinite(work.height_cm) || !Number.isFinite(work.width_cm)
    || work.height_cm <= 0 || work.width_cm <= 0) throw new RangeError('A picture extent must be a positive finite number.');
  return {
    heightM: work.height_cm / 100,
    widthM: work.width_cm / 100,
    datumM: work.hang.eye_height_cm === null ? null : work.hang.eye_height_cm / 100,
  };
}

export interface PictureViewport { readonly width: number; readonly height: number }
export interface ProjectedPictureMeasurement {
  readonly id: string;
  readonly height_cm: number;
  readonly width_cm: number;
  readonly worldHeightM: number;
  readonly worldWidthM: number;
  readonly centerHeightM: number;
  readonly datumM: number | null;
  readonly datumErrorCm: number | null;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly pxPerCmX: number;
  readonly pxPerCmY: number;
  readonly expectedPxPerCm: number;
  readonly expectedWidthPx: number;
  readonly expectedHeightPx: number;
  readonly widthErrorPercent: number;
  readonly heightErrorPercent: number;
  readonly maxErrorPercent: number;
  readonly passes: boolean;
  readonly frontParallel: boolean;
  readonly visible: boolean;
  readonly viewport: PictureViewport;
}

function screenPoint(world: Vector3, camera: Camera, viewport: PictureViewport): Vector2 {
  const projected = world.clone().project(camera);
  return new Vector2((projected.x + 1) * viewport.width / 2, (1 - projected.y) * viewport.height / 2);
}

/** Independent pinhole calibration at the centre depth. It does not consume
 * trueScale or a projected edge. The multiplication by .01 means one real
 * centimetre. This is CSS pixels, regardless of devicePixelRatio.
 */
export function expectedPxPerCm(camera: Camera, centerWorld: Vector3, viewport: PictureViewport): number {
  const viewCenter = centerWorld.clone().applyMatrix4(camera.matrixWorldInverse);
  const projection = camera.projectionMatrix.elements;
  const perspective = projection[15] === 0;
  const denominator = perspective ? -viewCenter.z : 1;
  if (denominator <= 0) return NaN;
  return Math.abs(projection[5] ?? 0) * viewport.height / (2 * denominator) * .01;
}

/** Measure the real aperture geometry, not dimensions recreated from the
 * register. Pass the measured inset plane only, excluding the moulding and
 * the reproduction card. Geometry may have any local size; its world matrix
 * is included, so a mistakenly scaled parent fails this check.
 *
 * A scalar px/cm requires a wall parallel to the camera image plane. Oblique
 * views report frontParallel=false and cannot pass this datum calibration.
 */
export function measureProjectedWork(
  work: PictureWork,
  camera: Camera,
  apertureGeometry: BufferGeometry,
  apertureMatrixWorld: Matrix4,
  viewport: PictureViewport,
): ProjectedPictureMeasurement | null {
  if (work.height_cm === null || work.width_cm === null) return null;
  if (viewport.width <= 0 || viewport.height <= 0) throw new RangeError('Viewport must be positive.');
  camera.updateMatrixWorld(true);
  apertureGeometry.computeBoundingBox();
  const box = apertureGeometry.boundingBox;
  if (!box) throw new Error(`Aperture geometry has no bounds: ${work.id}`);
  const localCenter = box.getCenter(new Vector3());
  const center = localCenter.clone().applyMatrix4(apertureMatrixWorld);
  const left = new Vector3(box.min.x, localCenter.y, localCenter.z).applyMatrix4(apertureMatrixWorld);
  const right = new Vector3(box.max.x, localCenter.y, localCenter.z).applyMatrix4(apertureMatrixWorld);
  const bottom = new Vector3(localCenter.x, box.min.y, localCenter.z).applyMatrix4(apertureMatrixWorld);
  const top = new Vector3(localCenter.x, box.max.y, localCenter.z).applyMatrix4(apertureMatrixWorld);
  const widthPx = screenPoint(left, camera, viewport).distanceTo(screenPoint(right, camera, viewport));
  const heightPx = screenPoint(bottom, camera, viewport).distanceTo(screenPoint(top, camera, viewport));
  const expected = expectedPxPerCm(camera, center, viewport);
  const expectedWidthPx = work.width_cm * expected;
  const expectedHeightPx = work.height_cm * expected;
  const widthErrorPercent = Math.abs(widthPx / expectedWidthPx - 1) * 100;
  const heightErrorPercent = Math.abs(heightPx / expectedHeightPx - 1) * 100;
  const normal = right.clone().sub(left).cross(top.clone().sub(bottom)).normalize();
  const gaze = camera.getWorldDirection(new Vector3());
  const frontParallel = Math.abs(normal.dot(gaze)) > .999999;
  const datumM = work.hang.eye_height_cm === null ? null : work.hang.eye_height_cm / 100;
  const datumErrorCm = datumM === null ? null : Math.abs(center.y - datumM) * 100;
  const projectedCenter = center.clone().project(camera);
  const visible = projectedCenter.z >= -1 && projectedCenter.z <= 1
    && [left, right, bottom, top].every(point => {
      const ndc = point.clone().project(camera);
      return Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
    });
  const maxErrorPercent = Math.max(widthErrorPercent, heightErrorPercent);
  return {
    id: work.id, height_cm: work.height_cm, width_cm: work.width_cm,
    worldHeightM: bottom.distanceTo(top), worldWidthM: left.distanceTo(right),
    centerHeightM: center.y, datumM, datumErrorCm,
    widthPx, heightPx, pxPerCmX: widthPx / work.width_cm, pxPerCmY: heightPx / work.height_cm,
    expectedPxPerCm: expected, expectedWidthPx, expectedHeightPx,
    widthErrorPercent, heightErrorPercent, maxErrorPercent,
    passes: frontParallel && Number.isFinite(maxErrorPercent) && maxErrorPercent < 1
      && (datumErrorCm === null || datumErrorCm <= .1),
    frontParallel, visible, viewport,
  };
}
