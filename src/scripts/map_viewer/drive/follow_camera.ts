/**
 * A third-person camera behind the capsule, aimed by the view's yaw and
 * pitch. Its distance and height are viewing choices, not game values. It
 * doesn't collide with the map.
 */
import * as THREE from 'three';
import { ueDirection } from '../../viewer3d/stage';
import type { Capsule } from '../../movement/collision/world';
import type { Vec3 } from '../../movement/math/vec';

/** Boom length in capsule half-heights, and the pivot's height on the
 * capsule (fraction of the half height above its center). */
const DISTANCE_HALF_HEIGHTS = 4;
const MIN_DISTANCE = 800;
const PIVOT_HEIGHT = 0.8;

const RAD = Math.PI / 180;

export function placeFollowCamera(
  camera: THREE.PerspectiveCamera,
  center: Vec3,
  capsule: Capsule,
  yawDegrees: number,
  pitchDegrees: number
): void {
  const yaw = yawDegrees * RAD;
  const pitch = pitchDegrees * RAD;
  const forward = {
    x: Math.cos(pitch) * Math.cos(yaw),
    y: Math.cos(pitch) * Math.sin(yaw),
    z: Math.sin(pitch),
  };
  const distance = Math.max(
    MIN_DISTANCE,
    capsule.halfHeight * DISTANCE_HALF_HEIGHTS
  );
  const pivot: [number, number, number] = [
    center.x,
    center.y,
    center.z + capsule.halfHeight * PIVOT_HEIGHT,
  ];
  const eye: [number, number, number] = [
    pivot[0] - forward.x * distance,
    pivot[1] - forward.y * distance,
    pivot[2] - forward.z * distance,
  ];
  camera.position.copy(ueDirection(eye));
  camera.lookAt(ueDirection(pivot));
}
