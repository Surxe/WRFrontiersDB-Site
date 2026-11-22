/**
 * UMovementComponent's moving, sliding and depenetration, plus the parts of
 * UPrimitiveComponent::MoveComponent they rely on, ported from UE 5.4.4:
 * - Engine/Private/Components/MovementComponent.cpp: SafeMoveUpdatedComponent,
 *   GetPenetrationAdjustment, ResolvePenetrationImpl, ComputeSlideVector,
 *   SlideAlongSurface, TwoWallAdjust
 * - Engine/Private/Components/PrimitiveComponent.cpp: MoveComponentImpl's
 *   sweep handling (minimum move, PullBackHit, ignoring overlaps the move
 *   exits)
 *
 * The updated component is an upright capsule; its rotation never changes
 * (the prototype has no physics rotation), so rotations are left out.
 * Plane constraints (bConstrainToPlane) are off by default and left out.
 */
import {
  add,
  addScaled,
  cross,
  dot,
  equals,
  isNearlyZero,
  isZero,
  KINDA_SMALL_NUMBER,
  planeProject,
  safeNormal,
  scale,
  sizeSquared,
  sub,
  ZERO,
  type Vec3,
} from '../math/vec';
import type { Capsule, CollisionWorld } from '../collision/world';
import { HitResult } from './hit';
import {
  PENETRATION_OVERLAP_CHECK_INFLATION,
  PENETRATION_PULLBACK_DISTANCE,
} from './constants';

/** MoveComponentImpl: moves shorter than this (squared, cm) don't sweep. */
const MIN_MOVEMENT_DIST_SQ = (4 * KINDA_SMALL_NUMBER) ** 2;

/** PrimitiveComponent.cpp PullBackHit: back the hit off the surface a
 * little so the next sweep doesn't start touching it. */
function pullBackHit(hit: HitResult, distance: number): void {
  const desiredTimeBack =
    Math.min(Math.max(0.1, 0.1 / distance), 1 / distance) + 0.001;
  hit.time = Math.min(Math.max(hit.time - desiredTimeBack, 0), 1);
}

export class MovementComponent {
  /** The capsule's center, UE cm. */
  location: Vec3;

  constructor(
    readonly collision: CollisionWorld,
    public capsule: Capsule,
    location: Vec3
  ) {
    this.location = location;
  }

  /**
   * UPrimitiveComponent::MoveComponent for the capsule. With `sweep`, stops
   * at the first blocking hit (backed off by PullBackHit) and reports it in
   * `outHit`; `neverIgnoreBlockingOverlaps` (MOVECOMP_NeverIgnoreBlockingOverlaps)
   * also reports a starting overlap the move is leaving. Returns whether the
   * capsule moved.
   */
  moveUpdatedComponent(
    delta: Vec3,
    sweep: boolean,
    outHit: HitResult | null = null,
    neverIgnoreBlockingOverlaps = false
  ): boolean {
    const start = this.location;
    const end = add(start, delta);
    if (!sweep) {
      outHit?.reset(1, false);
      if (outHit) {
        outHit.traceStart = start;
        outHit.traceEnd = end;
      }
      this.location = end;
      return !isZero(delta);
    }
    if (sizeSquared(delta) <= MIN_MOVEMENT_DIST_SQ) {
      if (outHit) {
        outHit.reset(1, false);
        outHit.traceStart = start;
        outHit.traceEnd = end;
      }
      return true;
    }
    const query = this.collision.sweepCapsule(start, end, this.capsule, {
      ignoreOverlapsMovingOut: !neverIgnoreBlockingOverlaps,
    });
    const hit = HitResult.fromQuery(query, start, end);
    let newLocation = end;
    if (hit.blockingHit) {
      if (!hit.startPenetrating)
        pullBackHit(hit, Math.sqrt(sizeSquared(delta)));
      else hit.time = 0;
      newLocation = addScaled(start, delta, hit.time);
      if (sizeSquared(sub(newLocation, start)) <= MIN_MOVEMENT_DIST_SQ) {
        newLocation = start;
        hit.time = 0;
      }
    }
    if (outHit) outHit.copyFrom(hit);
    const moved = !equals(newLocation, start, 0);
    this.location = newLocation;
    return moved;
  }

  /** UMovementComponent::SafeMoveUpdatedComponent: a sweeping move that
   * first tries to get out of any penetration it starts in. */
  safeMoveUpdatedComponent(delta: Vec3, outHit: HitResult): boolean {
    // p.MoveIgnoreFirstBlockingOverlap is 0: always report starting overlaps.
    let moved = this.moveUpdatedComponent(delta, true, outHit, true);
    if (outHit.startPenetrating) {
      const adjustment = this.getPenetrationAdjustment(outHit);
      if (this.resolvePenetration(adjustment, outHit)) {
        moved = this.moveUpdatedComponent(delta, true, outHit, true);
      }
    }
    return moved;
  }

  /** UMovementComponent::GetPenetrationAdjustment. */
  getPenetrationAdjustment(hit: HitResult): Vec3 {
    if (!hit.startPenetrating) return ZERO;
    const depth = hit.penetrationDepth > 0 ? hit.penetrationDepth : 0.125;
    return scale(hit.normal, depth + Math.abs(PENETRATION_PULLBACK_DISTANCE));
  }

  /** UMovementComponent::ResolvePenetration(Impl). */
  resolvePenetration(adjustment: Vec3, hit: HitResult): boolean {
    if (isZero(adjustment)) return false;
    const inflated: Capsule = {
      radius: this.capsule.radius + PENETRATION_OVERLAP_CHECK_INFLATION,
      halfHeight: this.capsule.halfHeight + PENETRATION_OVERLAP_CHECK_INFLATION,
    };
    const encroached = this.collision.overlapCapsule(
      add(hit.traceStart, adjustment),
      inflated
    );
    if (!encroached) {
      this.moveUpdatedComponent(adjustment, false);
      return true;
    }
    // Sweep out as far as possible, ignoring the overlaps we are leaving.
    const sweepOutHit = new HitResult(1);
    let moved = this.moveUpdatedComponent(adjustment, true, sweepOutHit);
    if (!moved && sweepOutHit.startPenetrating) {
      // Combine two MTDs to get out of multiple surfaces.
      const secondMtd = this.getPenetrationAdjustment(sweepOutHit);
      const combined = add(adjustment, secondMtd);
      if (!equals(secondMtd, adjustment, 0) && !isZero(combined)) {
        moved = this.moveUpdatedComponent(combined, true);
      }
    }
    if (!moved) {
      // Try the adjustment plus the attempted move.
      const moveDelta = sub(hit.traceEnd, hit.traceStart);
      if (!isZero(moveDelta)) {
        moved = this.moveUpdatedComponent(add(adjustment, moveDelta), true);
        if (!moved && dot(moveDelta, adjustment) > 0) {
          moved = this.moveUpdatedComponent(moveDelta, true);
        }
      }
    }
    return moved;
  }

  /** UMovementComponent::ComputeSlideVector. */
  computeSlideVector(
    delta: Vec3,
    time: number,
    normal: Vec3,
    _hit: HitResult
  ): Vec3 {
    return scale(planeProject(delta, normal), time);
  }

  /** UMovementComponent::SlideAlongSurface: move along the surface hit,
   * then along a second one if that move hits too. Returns the fraction of
   * `time` applied. HandleImpact is a no-op here (it only notifies and
   * pushes physics objects). */
  slideAlongSurface(
    delta: Vec3,
    time: number,
    normal: Vec3,
    hit: HitResult,
    _handleImpact = false
  ): number {
    if (!hit.blockingHit) return 0;
    const oldHitNormal = normal;
    let slideDelta = this.computeSlideVector(delta, time, normal, hit);
    if (dot(slideDelta, delta) <= 0) return 0;
    this.safeMoveUpdatedComponent(slideDelta, hit);
    const firstHitPercent = hit.time;
    let percentTimeApplied = firstHitPercent;
    if (hit.isValidBlockingHit()) {
      // Compute a new slide normal when hitting multiple surfaces.
      slideDelta = this.twoWallAdjust(slideDelta, hit, oldHitNormal);
      // Only proceed if the new direction is significant and not reversed.
      if (!isNearlyZero(slideDelta, 1e-3) && dot(slideDelta, delta) > 0) {
        this.safeMoveUpdatedComponent(slideDelta, hit);
        percentTimeApplied += hit.time * (1 - firstHitPercent);
      }
    }
    return Math.min(Math.max(percentTimeApplied, 0), 1);
  }

  /** UMovementComponent::TwoWallAdjust: the delta after hitting a second
   * wall (`hit`) while sliding along the first (`oldHitNormal`). */
  twoWallAdjust(delta: Vec3, hit: HitResult, oldHitNormal: Vec3): Vec3 {
    const hitNormal = hit.normal;
    if (dot(oldHitNormal, hitNormal) <= 0) {
      // A corner of 90 degrees or less: move along the crease.
      const desiredDir = delta;
      const newDir = safeNormal(cross(hitNormal, oldHitNormal));
      let result = scale(newDir, dot(delta, newDir) * (1 - hit.time));
      if (dot(desiredDir, result) < 0) result = scale(result, -1);
      return result;
    }
    const desiredDir = delta;
    let result = this.computeSlideVector(delta, 1 - hit.time, hitNormal, hit);
    if (dot(result, desiredDir) <= 0) {
      result = ZERO;
    } else if (
      Math.abs(dot(hitNormal, oldHitNormal) - 1) < KINDA_SMALL_NUMBER
    ) {
      // Hit the same wall again: nudge away from it (precision issues).
      result = addScaled(result, hitNormal, 0.01);
    }
    return result;
  }
}
