/**
 * The axis views a robot's hitbox area is measured from.
 *
 * Directions are UE: X forward, Y right, Z up. Each view looks along `dir`
 * (from the viewer into the robot), and `u` / `v` span its image plane as the
 * viewer sees it (`u` to the right, `v` up).
 */
import type { Vec3 } from '../../../types/model';

export const VIEW_NAMES = ['front', 'back', 'left', 'right', 'top'] as const;

export type ViewName = (typeof VIEW_NAMES)[number];

export interface ViewAxes {
  dir: Vec3;
  u: Vec3;
  v: Vec3;
}

export const VIEWS: Readonly<Record<ViewName, ViewAxes>> = {
  front: { dir: [-1, 0, 0], u: [0, -1, 0], v: [0, 0, 1] },
  back: { dir: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  left: { dir: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  right: { dir: [0, -1, 0], u: [-1, 0, 0], v: [0, 0, 1] },
  // The robot's front at the top of the image.
  top: { dir: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
};

export function isViewName(value: unknown): value is ViewName {
  return VIEW_NAMES.some((view) => view === value);
}

/** `fn` of every view, as a view-keyed record. */
export function mapViews<T>(fn: (view: ViewName) => T): Record<ViewName, T> {
  return {
    front: fn('front'),
    back: fn('back'),
    left: fn('left'),
    right: fn('right'),
    top: fn('top'),
  };
}
