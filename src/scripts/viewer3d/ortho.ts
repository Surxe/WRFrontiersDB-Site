/**
 * Flat (orthographic) views, shared by the viewers' 2D modes: aim a camera
 * down an axis so a square of `extent` scene units fills a pixel box on the
 * canvas, and resize its frustum to the canvas at a fixed scale.
 */
import * as THREE from 'three';

/** The canvas, in CSS pixels. */
export interface CanvasSize {
  width: number;
  height: number;
}

export interface OrthoAim {
  /** What the view centers on (scene space). */
  center: THREE.Vector3;
  /** The way the camera looks (scene space, unit length). */
  look: THREE.Vector3;
  /** Which scene direction points up the screen. */
  up: THREE.Vector3;
  /** How far before `center` the camera stands, and its depth range. */
  distance: number;
  near: number;
  far: number;
  /** Scene units the fit box must hold across its narrower side. */
  extent: number;
  canvas: CanvasSize;
  /** The pixel box `extent` fits in: canvas-wide, from `top` down `height`.
   * Default: the whole canvas. */
  fit?: { width: number; top: number; height: number };
}

/** Aim `camera` per `aim` at zoom 1. Returns the scale, in scene units per
 * pixel, for later resizes (sizeOrtho). */
export function aimOrtho(
  camera: THREE.OrthographicCamera,
  aim: OrthoAim
): number {
  const { canvas } = aim;
  const fit = aim.fit ?? { width: canvas.width, top: 0, height: canvas.height };
  const fitHeight = Math.max(1, fit.height);
  const unitsPerPixel =
    Math.max(aim.extent, 1e-6) / Math.min(Math.max(1, fit.width), fitHeight);
  camera.up.copy(aim.up);
  camera.position.copy(aim.center).addScaledVector(aim.look, -aim.distance);
  camera.near = aim.near;
  camera.far = aim.far;
  camera.zoom = 1;
  sizeOrtho(camera, canvas, unitsPerPixel, fit.top + fitHeight / 2);
  camera.lookAt(aim.center);
  return unitsPerPixel;
}

/** Fit `camera`'s frustum to `canvas` at `unitsPerPixel` (at zoom 1), the
 * view's center `centerY` pixels from the top (default: the middle). */
export function sizeOrtho(
  camera: THREE.OrthographicCamera,
  canvas: CanvasSize,
  unitsPerPixel: number,
  centerY = Math.max(1, canvas.height) / 2
): void {
  const height = Math.max(1, canvas.height);
  camera.left = (-canvas.width / 2) * unitsPerPixel;
  camera.right = (canvas.width / 2) * unitsPerPixel;
  camera.top = centerY * unitsPerPixel;
  camera.bottom = -(height - centerY) * unitsPerPixel;
  camera.updateProjectionMatrix();
}

/** Scene units one canvas pixel spans through `camera` now (its zoom in). */
export function orthoUnitsPerPixel(
  camera: THREE.OrthographicCamera,
  canvas: CanvasSize
): number {
  return (camera.right - camera.left) / camera.zoom / Math.max(1, canvas.width);
}
