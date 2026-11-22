/**
 * Stepping up, ported from UE 5.4.4 (CharacterMovementComponent.cpp
 * CanStepUp, StepUp). The map's static geometry always allows stepping
 * up (CanCharacterStepUp and CanBeBaseForCharacter default to true), so
 * CanStepUp reduces to its hit and movement-mode checks.
 */
import { dot, neg, scale, type Vec3 } from '../math/vec';
import { MAX_FLOOR_DIST, MAX_STEP_SIDE_Z } from './constants';
import { FindFloorResult, HitResult } from './hit';
import type {
  CharacterMovementComponent,
  StepDownResult,
} from './character_movement';

/** UCharacterMovementComponent::CanStepUp. */
export function canStepUp(
  c: CharacterMovementComponent,
  hit: HitResult
): boolean {
  return hit.isValidBlockingHit() && c.movementMode !== 'falling';
}

/** UCharacterMovementComponent::StepUp: up by MaxStepHeight, forward by
 * `delta`, then back down; reverted unless it lands on something valid. */
export function stepUp(
  c: CharacterMovementComponent,
  gravDir: Vec3,
  delta: Vec3,
  inHit: HitResult,
  outStepDown: StepDownResult | null
): boolean {
  const maxStepHeight = c.params.maxStepHeight;
  if (!c.canStepUp(inHit) || maxStepHeight <= 0) return false;

  const oldLocation = c.location;
  const { radius: pawnRadius, halfHeight: pawnHalfHeight } = c.capsule;

  // Don't bother if the top of the capsule is hitting something.
  const initialImpactZ = inHit.impactPoint.z;
  if (initialImpactZ > oldLocation.z + (pawnHalfHeight - pawnRadius))
    return false;

  let stepTravelUpHeight = maxStepHeight;
  let stepTravelDownHeight = stepTravelUpHeight;
  const stepSideZ = -dot(inHit.impactNormal, gravDir);
  let pawnInitialFloorBaseZ = oldLocation.z - pawnHalfHeight;
  let pawnFloorPointZ = pawnInitialFloorBaseZ;

  if (c.isMovingOnGround() && c.currentFloor.isWalkableFloor()) {
    // We float a variable amount off the floor: measure the step height
    // from the actual floor contact.
    const floorDist = Math.max(0, c.currentFloor.getDistanceToFloor());
    pawnInitialFloorBaseZ -= floorDist;
    stepTravelUpHeight = Math.max(stepTravelUpHeight - floorDist, 0);
    stepTravelDownHeight = maxStepHeight + MAX_FLOOR_DIST * 2;
    const hitVerticalFace = !c.isWithinEdgeTolerance(
      inHit.location,
      inHit.impactPoint,
      pawnRadius
    );
    if (!c.currentFloor.lineTrace && !hitVerticalFace) {
      pawnFloorPointZ = c.currentFloor.hitResult.impactPoint.z;
    } else {
      pawnFloorPointZ -= c.currentFloor.floorDist;
    }
  }

  // Don't step up if the impact is below us.
  if (initialImpactZ <= pawnInitialFloorBaseZ) return false;

  // FScopedCapsuleMovementUpdate: RevertMove puts the capsule back.
  const revert = (): false => {
    c.location = oldLocation;
    return false;
  };

  // Step up, treated as a vertical wall.
  const sweepUpHit = new HitResult(1);
  c.moveUpdatedComponent(
    scale(neg(gravDir), stepTravelUpHeight),
    true,
    sweepUpHit
  );
  if (sweepUpHit.startPenetrating) return revert();

  // Step forward.
  const hit = new HitResult(1);
  c.moveUpdatedComponent(delta, true, hit);
  if (hit.blockingHit) {
    if (hit.startPenetrating) return revert();
    if (c.isFalling()) return true;
    // Adjust and try again.
    const forwardHitTime = hit.time;
    const forwardSlideAmount = c.slideAlongSurface(
      delta,
      1 - hit.time,
      hit.normal,
      hit,
      true
    );
    if (c.isFalling()) return revert();
    // Neither the forward move nor the deflection got anywhere.
    if (forwardHitTime === 0 && forwardSlideAmount === 0) return revert();
  }

  // Step down.
  c.moveUpdatedComponent(scale(gravDir, stepTravelDownHeight), true, hit);
  if (hit.startPenetrating) return revert();

  const stepDownResult: StepDownResult = {
    computedFloor: false,
    floorResult: new FindFloorResult(),
  };
  if (hit.isValidBlockingHit()) {
    // Would this have taken us higher than MaxStepHeight?
    const deltaZ = hit.impactPoint.z - pawnFloorPointZ;
    if (deltaZ > maxStepHeight) return revert();

    if (!c.isWalkable(hit)) {
      // Reject if the normal opposes the move.
      if (dot(delta, hit.impactNormal) < 0) return revert();
      // Or if we would end up higher than we started.
      if (hit.location.z > oldLocation.z) return revert();
    }

    // Reject a downward hit very close to the capsule's edge (consistent
    // with FindFloor).
    if (!c.isWithinEdgeTolerance(hit.location, hit.impactPoint, pawnRadius))
      return revert();

    // Don't step up onto invalid surfaces if traveling higher.
    if (deltaZ > 0 && !c.canStepUp(hit)) return revert();

    if (outStepDown) {
      c.findFloor(c.location, stepDownResult.floorResult, false, hit);
      // Reject unwalkable floors above our start where we can't perch.
      if (hit.location.z > oldLocation.z) {
        if (
          !stepDownResult.floorResult.blockingHit &&
          stepSideZ < MAX_STEP_SIDE_Z
        )
          return revert();
      }
      stepDownResult.computedFloor = true;
    }
  }

  if (outStepDown) {
    outStepDown.computedFloor = stepDownResult.computedFloor;
    outStepDown.floorResult = stepDownResult.floorResult;
  }
  c.justTeleported =
    c.justTeleported || !c.params.maintainHorizontalGroundVelocity;
  return true;
}
