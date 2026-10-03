/**
 * Where build B stands relative to build A while comparing in the 3D view: on
 * top of A (the overlap the diff colors are made for), or beside it, so each
 * build can be seen whole. The axis views always overlap: their diff image is
 * measured that way.
 */
import * as THREE from 'three';
import { primitiveGeometry } from './scene';
import type { HitboxSet } from '../../robot/hitbox_area/pools';
import type { Vec3 } from '../../../types/model';

export type CompareLayout = 'overlap' | 'side';

export function isCompareLayout(value: unknown): value is CompareLayout {
  return value === 'overlap' || value === 'side';
}

/** Clear space between side-by-side builds, as a share of the wider one's
 * width (UE cm), and its floor. */
const SIDE_GAP_SHARE = 0.25;
const MIN_SIDE_GAP_CM = 50;

/** The UE-space box around a build's hitboxes. Hitboxes rather than meshes,
 * so the layout holds still as the mesh / hitbox layers are toggled. */
export function hitboxBounds(set: HitboxSet): THREE.Box3 {
  const bounds = new THREE.Box3();
  for (const body of set.bodies) {
    for (const prim of body.primitives) {
      const geometry = primitiveGeometry(prim);
      geometry.computeBoundingBox();
      if (geometry.boundingBox) bounds.union(geometry.boundingBox);
      geometry.dispose();
    }
  }
  return bounds;
}

/**
 * B's offset from A (UE) for `layout`. Side by side, B stands to A's left (so
 * on the right as seen from the front, A then B), clear of it by a gap, with
 * the fronts and ground level with A's.
 */
export function compareOffset(
  layout: CompareLayout,
  a: THREE.Box3,
  b: THREE.Box3
): Vec3 {
  if (layout === 'overlap' || a.isEmpty() || b.isEmpty()) return [0, 0, 0];
  const width = Math.max(a.max.y - a.min.y, b.max.y - b.min.y);
  const gap = Math.max(MIN_SIDE_GAP_CM, width * SIDE_GAP_SHARE);
  return [0, a.min.y - gap - b.max.y, 0];
}
