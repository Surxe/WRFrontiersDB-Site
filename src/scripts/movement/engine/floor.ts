/**
 * Floor finding, ported from UE 5.4.4 (CharacterMovementComponent.cpp
 * FindFloor, ComputeFloorDist, FloorSweepTest, IsWalkable,
 * IsWithinEdgeTolerance, ShouldComputePerchResult, ComputePerchResult,
 * GetValidPerchRadius). bUseFlatBaseForFloorChecks (off by default) and
 * per-component walkable slope overrides are left out.
 */
import {
  addScaled,
  KINDA_SMALL_NUMBER,
  sizeSquared2D,
  sub,
  vec,
  type Vec3,
} from '../math/vec';
import type { Capsule } from '../collision/world';
import {
  MAX_FLOOR_DIST,
  MIN_FLOOR_DIST,
  SWEEP_EDGE_REJECT_DISTANCE,
} from './constants';
import { FindFloorResult, HitResult } from './hit';
import type { CharacterMovementComponent } from './character_movement';

const DOWN = vec(0, 0, -1);

/** UCharacterMovementComponent::IsWalkable. */
export function isWalkable(
  c: CharacterMovementComponent,
  hit: HitResult
): boolean {
  if (!hit.isValidBlockingHit()) return false;
  // Never walk up vertical surfaces.
  if (hit.impactNormal.z < KINDA_SMALL_NUMBER) return false;
  return hit.impactNormal.z >= c.params.walkableFloorZ;
}

/** UCharacterMovementComponent::IsWithinEdgeTolerance. */
export function isWithinEdgeTolerance(
  capsuleLocation: Vec3,
  testImpactPoint: Vec3,
  capsuleRadius: number
): boolean {
  const distFromCenterSq = sizeSquared2D(sub(testImpactPoint, capsuleLocation));
  const reducedRadius = Math.max(
    SWEEP_EDGE_REJECT_DISTANCE + KINDA_SMALL_NUMBER,
    capsuleRadius - SWEEP_EDGE_REJECT_DISTANCE
  );
  return distFromCenterSq < reducedRadius * reducedRadius;
}

/** UCharacterMovementComponent::FloorSweepTest: a plain world sweep. */
function floorSweepTest(
  c: CharacterMovementComponent,
  start: Vec3,
  end: Vec3,
  shape: Capsule
): HitResult {
  return HitResult.fromQuery(
    c.collision.sweepCapsule(start, end, shape),
    start,
    end
  );
}

/** UCharacterMovementComponent::ComputeFloorDist. */
export function computeFloorDist(
  c: CharacterMovementComponent,
  capsuleLocation: Vec3,
  lineDistance: number,
  sweepDistance: number,
  out: FindFloorResult,
  sweepRadius: number,
  downwardSweep: HitResult | null
): void {
  out.clear();
  const { radius: pawnRadius, halfHeight: pawnHalfHeight } = c.capsule;

  let skipSweep = false;
  if (downwardSweep && downwardSweep.isValidBlockingHit()) {
    // Only if the supplied sweep was vertical and downward.
    const along = sub(downwardSweep.traceStart, downwardSweep.traceEnd);
    const isDownward = along.z > 0;
    const isVertical = sizeSquared2D(along) <= KINDA_SMALL_NUMBER;
    if (isDownward && isVertical) {
      // Reject hits barely on the cusp of the capsule's radius.
      if (
        c.isWithinEdgeTolerance(
          downwardSweep.location,
          downwardSweep.impactPoint,
          pawnRadius
        )
      ) {
        skipSweep = true;
        const walkable = c.isWalkable(downwardSweep);
        const floorDist = capsuleLocation.z - downwardSweep.location.z;
        out.setFromSweep(downwardSweep, floorDist, walkable);
        if (walkable) return;
      }
    }
  }

  // The sweep distance must cover the line distance.
  if (sweepDistance < lineDistance) return;

  if (!skipSweep && sweepDistance > 0 && sweepRadius > 0) {
    // A shorter capsule avoids odd results when starting on a surface, and
    // lets us adjust out of penetrations.
    const shrinkScale = 0.9;
    const shrinkScaleOverlap = 0.1;
    let shrinkHeight = (pawnHalfHeight - pawnRadius) * (1 - shrinkScale);
    let traceDist = sweepDistance + shrinkHeight;
    let shape: Capsule = {
      radius: sweepRadius,
      halfHeight: pawnHalfHeight - shrinkHeight,
    };

    let hit = floorSweepTest(
      c,
      capsuleLocation,
      addScaled(capsuleLocation, DOWN, traceDist),
      shape
    );
    if (hit.blockingHit) {
      // Reject hits adjacent to us: only the bottom of the capsule matters.
      if (
        hit.startPenetrating ||
        !c.isWithinEdgeTolerance(capsuleLocation, hit.impactPoint, shape.radius)
      ) {
        // A slightly thinner, shorter capsule avoids the adjacent object.
        // (UE skips this for a nearly zero capsule, which the still-full
        // half height rules out.)
        const radius = Math.max(
          0,
          shape.radius - SWEEP_EDGE_REJECT_DISTANCE - KINDA_SMALL_NUMBER
        );
        shrinkHeight = (pawnHalfHeight - pawnRadius) * (1 - shrinkScaleOverlap);
        traceDist = sweepDistance + shrinkHeight;
        shape = {
          radius,
          halfHeight: Math.max(pawnHalfHeight - shrinkHeight, radius),
        };
        hit = floorSweepTest(
          c,
          capsuleLocation,
          addScaled(capsuleLocation, DOWN, traceDist),
          shape
        );
      }
      // Reduce the distance by the shrink; negative distances pull us out
      // of penetrations.
      const maxPenetrationAdjust = Math.max(MAX_FLOOR_DIST, pawnRadius);
      const sweepResult = Math.max(
        -maxPenetrationAdjust,
        hit.time * traceDist - shrinkHeight
      );
      out.setFromSweep(hit, sweepResult, false);
      if (
        hit.isValidBlockingHit() &&
        c.isWalkable(hit) &&
        sweepResult <= sweepDistance
      ) {
        out.walkableFloor = true;
        return;
      }
    }
  }

  // No line trace if the sweep missed everything, but do try one if the
  // sweep was stuck in penetration.
  if (!out.blockingHit && !out.hitResult.startPenetrating) {
    out.floorDist = sweepDistance;
    return;
  }

  if (lineDistance > 0) {
    const shrinkHeight = pawnHalfHeight;
    const traceDist = lineDistance + shrinkHeight;
    const end = addScaled(capsuleLocation, DOWN, traceDist);
    const hit = HitResult.fromQuery(
      c.collision.lineTrace(capsuleLocation, end),
      capsuleLocation,
      end
    );
    if (hit.blockingHit && hit.time > 0) {
      const maxPenetrationAdjust = Math.max(MAX_FLOOR_DIST, pawnRadius);
      const lineResult = Math.max(
        -maxPenetrationAdjust,
        hit.time * traceDist - shrinkHeight
      );
      out.blockingHit = true;
      if (lineResult <= lineDistance && c.isWalkable(hit)) {
        out.setFromLineTrace(hit, out.floorDist, lineResult, true);
        return;
      }
    }
  }

  out.walkableFloor = false;
}

/** UCharacterMovementComponent::GetValidPerchRadius. */
function getValidPerchRadius(c: CharacterMovementComponent): number {
  const pawnRadius = c.capsule.radius;
  return Math.min(
    Math.max(pawnRadius - c.getPerchRadiusThreshold(), 0.11),
    pawnRadius
  );
}

/** UCharacterMovementComponent::ShouldComputePerchResult. */
function shouldComputePerchResult(
  c: CharacterMovementComponent,
  hit: HitResult,
  checkRadius: boolean
): boolean {
  if (!hit.isValidBlockingHit()) return false;
  // Don't perch if the edge radius is very small.
  if (c.getPerchRadiusThreshold() <= SWEEP_EDGE_REJECT_DISTANCE) return false;
  if (checkRadius) {
    const distFromCenterSq = sizeSquared2D(sub(hit.impactPoint, hit.location));
    const standOnEdgeRadius = getValidPerchRadius(c);
    if (distFromCenterSq <= standOnEdgeRadius * standOnEdgeRadius) return false;
  }
  return true;
}

/** UCharacterMovementComponent::ComputePerchResult. */
function computePerchResult(
  c: CharacterMovementComponent,
  testRadius: number,
  hit: HitResult,
  maxFloorDist: number,
  out: FindFloorResult
): boolean {
  if (maxFloorDist <= 0) return false;
  const { radius: pawnRadius, halfHeight: pawnHalfHeight } = c.capsule;
  const capsuleLocation = hit.location;
  const hitAboveBase = Math.max(
    0,
    hit.impactPoint.z - capsuleLocation.z + pawnHalfHeight
  );
  const perchLineDist = Math.max(0, maxFloorDist - hitAboveBase);
  const perchSweepDist = Math.max(0, maxFloorDist);
  const actualSweepDist = perchSweepDist + pawnRadius;
  c.computeFloorDist(
    capsuleLocation,
    perchLineDist,
    actualSweepDist,
    out,
    testRadius
  );
  if (!out.isWalkableFloor()) return false;
  if (hitAboveBase + out.floorDist > maxFloorDist) {
    out.walkableFloor = false;
    return false;
  }
  return true;
}

/** UCharacterMovementComponent::FindFloor. */
export function findFloor(
  c: CharacterMovementComponent,
  capsuleLocation: Vec3,
  out: FindFloorResult,
  _canUseCachedLocation: boolean,
  downwardSweep: HitResult | null
): void {
  // Check a bit further when walking, so the floor height adjustment can't
  // invalidate the result later.
  const heightCheckAdjust = c.isMovingOnGround()
    ? MAX_FLOOR_DIST + KINDA_SMALL_NUMBER
    : -MAX_FLOOR_DIST;
  const floorSweepTraceDist = Math.max(
    MAX_FLOOR_DIST,
    c.params.maxStepHeight + heightCheckAdjust
  );
  const floorLineTraceDist = floorSweepTraceDist;

  // UE reuses the last floor only while standing on a known movement base;
  // this port has no bases, so every path computes it afresh (and both of
  // UE's paths clear bForceNextFloorCheck).
  if (floorLineTraceDist > 0 || floorSweepTraceDist > 0) {
    c.forceNextFloorCheck = false;
    c.computeFloorDist(
      capsuleLocation,
      floorLineTraceDist,
      floorSweepTraceDist,
      out,
      c.capsule.radius,
      downwardSweep
    );
  }

  // See if we should try to perch at this location.
  if (
    out.blockingHit &&
    !out.lineTrace &&
    shouldComputePerchResult(c, out.hitResult, true)
  ) {
    let maxPerchFloorDist = Math.max(
      MAX_FLOOR_DIST,
      c.params.maxStepHeight + heightCheckAdjust
    );
    if (c.isMovingOnGround())
      maxPerchFloorDist += Math.max(0, c.params.perchAdditionalHeight);
    const perchFloorResult = new FindFloorResult();
    if (
      computePerchResult(
        c,
        getValidPerchRadius(c),
        out.hitResult,
        maxPerchFloorDist,
        perchFloorResult
      )
    ) {
      // Don't let the floor adjustment push us beyond the perch distance.
      const avgFloorDist = (MIN_FLOOR_DIST + MAX_FLOOR_DIST) * 0.5;
      const moveUpDist = avgFloorDist - out.floorDist;
      if (moveUpDist + perchFloorResult.floorDist >= maxPerchFloorDist)
        out.floorDist = avgFloorDist;
      // An unwalkable regular floor with a walkable perch: use the perch.
      if (!out.walkableFloor) {
        out.setFromLineTrace(
          perchFloorResult.hitResult,
          out.floorDist,
          Math.max(out.floorDist, MIN_FLOOR_DIST),
          true
        );
      }
    } else {
      // No floor and no perch: invalidate, so we start falling.
      out.walkableFloor = false;
    }
  }
}
