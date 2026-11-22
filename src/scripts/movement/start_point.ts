/**
 * Where a drive starts: the capsule's centre at a spawn pin plus its half
 * height. A map mode without a spawn pin (the firing range has no pins at
 * all) starts at the playable box's centre, dropped onto the collision; that
 * is a stand-in, not the game's, and is labelled as one.
 */
import type { CollisionWorld } from './collision/world';
import { vec, type Vec3 } from './math/vec';

type Point = readonly [number, number, number];

/** How far the fallback steps down past a solid its trace starts in, cm. */
const STEP_CM = 100;

export interface StartPoint {
  /** The capsule's centre, UE cm. */
  location: Vec3;
  /** True when no spawn pin gave it (the playable-box fallback). */
  standIn: boolean;
}

export function startPoint(
  world: CollisionWorld,
  spawn: { position: Point } | null,
  playableBox: readonly [Point, Point] | null,
  halfHeight: number
): StartPoint {
  if (spawn) {
    const [x, y, z] = spawn.position;
    return { location: vec(x, y, z + halfHeight), standIn: false };
  }
  if (!playableBox)
    throw new Error('a start needs a spawn pin or a playable box');
  const [min, max] = playableBox;
  const x = (min[0] + max[0]) / 2;
  const y = (min[1] + max[1]) / 2;
  // Down from the box top; a trace that starts inside a solid (the ceiling
  // slab sits at the top of the box) steps down past it and tries again.
  let top = max[2];
  let z = max[2];
  while (top > min[2]) {
    const hit = world.lineTrace(vec(x, y, top), vec(x, y, min[2]));
    if (!hit) break;
    if (!hit.startPenetrating) {
      z = hit.impactPoint.z;
      break;
    }
    top -= STEP_CM;
  }
  world.takeStats();
  return { location: vec(x, y, z + halfHeight), standIn: true };
}
