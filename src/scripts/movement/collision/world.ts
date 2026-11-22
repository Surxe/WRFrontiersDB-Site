/**
 * The collision queries the movement engine needs, as UE's world scene
 * queries answer them (UWorld::SweepSingleByChannel, LineTraceSingleByChannel,
 * OverlapBlockingTestByChannel). The engine depends only on this interface;
 * `exact/world.ts` implements it on the map's collision export.
 *
 * Everything is in Unreal space: centimeters, Z up. Capsules are upright
 * (UE characters never tilt their capsule) and centered on their position.
 */
import type { Vec3 } from '../math/vec';

export interface Capsule {
  radius: number;
  /** Half the full height, hemispheres included (UE's CapsuleHalfHeight). */
  halfHeight: number;
}

/** A blocking hit, with FHitResult's meaning for each field. */
export interface QueryHit {
  /** Fraction of the trace (0 to 1) where the shape stopped. */
  time: number;
  /** Where the shape's center was at `time`. */
  location: Vec3;
  /** The contact point on the hit surface. */
  impactPoint: Vec3;
  /** For sweeps, the normal of the swept shape at the contact, pointing
   * away from the surface; for a line trace, the surface normal. When
   * `startPenetrating`, the direction that moves out of penetration. */
  normal: Vec3;
  /** The hit surface's normal. */
  impactNormal: Vec3;
  /** The shape overlapped something where it started. */
  startPenetrating: boolean;
  /** How far to move along `normal` to get out, when `startPenetrating`. */
  penetrationDepth: number;
  /** Debug name of the collider hit, when the backend knows it. */
  source?: string;
}

export interface SweepOptions {
  /** Report a starting overlap only if moving into it (PrimitiveComponent's
   * "ignore blocking overlaps we are moving out of", the default for moves
   * without MOVECOMP_NeverIgnoreBlockingOverlaps). Plain world sweeps
   * report every starting overlap. */
  ignoreOverlapsMovingOut?: boolean;
  /** The capsule's rotation (x, y, z, w; UE passes the component's
   * quaternion). It enters only Chaos's float32 impact point on parallel
   * contacts, and there only on shapes rotated out of the horizontal plane
   * (findings/chaos-contact-point.md). Default: identity. */
  rotation?: readonly [number, number, number, number];
}

/** Query counters, for the debug overlay and the measurements. */
export interface QueryStats {
  sweeps: number;
  lineTraces: number;
  overlaps: number;
  /** Total time inside queries, milliseconds. */
  ms: number;
}

export interface CollisionWorld {
  /** Sweep `capsule` from `start` to `end`; null when nothing blocks. */
  sweepCapsule(
    start: Vec3,
    end: Vec3,
    capsule: Capsule,
    options?: SweepOptions
  ): QueryHit | null;
  /** Trace a ray from `start` to `end`; null when nothing blocks. */
  lineTrace(start: Vec3, end: Vec3): QueryHit | null;
  /** Whether `capsule` at `position` overlaps anything. */
  overlapCapsule(position: Vec3, capsule: Capsule): boolean;
  /** Counters since the last call (and reset them). */
  takeStats(): QueryStats;
}
