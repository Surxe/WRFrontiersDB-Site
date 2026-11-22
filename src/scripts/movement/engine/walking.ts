/**
 * Walking, ported from UE 5.4.4 (CharacterMovementComponent.cpp PhysWalking,
 * MoveAlongFloor, ComputeGroundMovementDelta, MaintainHorizontalGroundVelocity,
 * AdjustFloorHeight, CheckFall, StartFalling).
 *
 * Movement bases aren't modelled; where UE asks whether the old base exists,
 * this port asks whether the old floor was walkable (UE sets the base from a
 * walkable floor). ShouldCatchAir is UE's default (false).
 */
import {
  addScaled,
  equals,
  f32,
  isNearlyZero,
  KINDA_SMALL_NUMBER,
  planeProject,
  safeNormal,
  safeNormal2D,
  scale,
  size,
  size2D,
  sub,
  UP,
  vec,
  withZ,
  type Vec3,
} from '../math/vec';
import { MAX_FLOOR_DIST, MIN_FLOOR_DIST, MIN_TICK_TIME } from './constants';
import { FindFloorResult, HitResult } from './hit';
import type {
  CharacterMovementComponent,
  StepDownResult,
} from './character_movement';

const GRAVITY_DIR = vec(0, 0, -1);

/** `remainingTime + timeTick * (1 - Min(1, ActualDist / DesiredDist))`,
 * in float as UE computes it (PhysWalking, StartFalling). */
const refund = (
  remainingTime: number,
  timeTick: number,
  actualDist: number,
  desiredDist: number
): number =>
  f32(
    remainingTime +
      f32(timeTick * f32(1 - Math.min(1, f32(actualDist / desiredDist))))
  );

/** UCharacterMovementComponent::PhysWalking. */
export function physWalking(
  c: CharacterMovementComponent,
  deltaTime: number,
  iterationsIn: number
): void {
  if (deltaTime < MIN_TICK_TIME) return;
  let iterations = iterationsIn;
  c.justTeleported = false;
  let checkedFall = false;
  // float remainingTime, timeTick (UE's types; the split is float).
  let remainingTime = f32(deltaTime);
  const startingMode = c.movementMode;

  while (
    remainingTime >= MIN_TICK_TIME &&
    iterations < c.params.maxSimulationIterations
  ) {
    iterations++;
    c.justTeleported = false;
    const timeTick = f32(c.getSimulationTimeStep(remainingTime, iterations));
    remainingTime = f32(remainingTime - timeTick);

    const oldLocation = c.location;
    const oldFloor = c.currentFloor.clone();
    const hadBase = oldFloor.isWalkableFloor();

    // Ensure velocity is horizontal.
    c.maintainHorizontalGroundVelocity();
    c.acceleration = planeProject(c.acceleration, UP);
    c.calcVelocity(
      timeTick,
      c.getGroundFriction(),
      false,
      c.getMaxBrakingDeceleration()
    );

    const moveVelocity = c.velocity;
    const delta = scale(moveVelocity, timeTick);
    const zeroDelta = isNearlyZero(delta);
    const stepDown: StepDownResult = {
      computedFloor: false,
      floorResult: new FindFloorResult(),
    };

    if (zeroDelta) {
      remainingTime = 0;
    } else {
      c.moveAlongFloor(moveVelocity, timeTick, stepDown);
      if (c.movementMode !== startingMode) {
        // Ended up in another mode (the step-up-and-over flow): refund the
        // unused time and keep moving in the new mode.
        const desiredDist = f32(size(delta));
        if (desiredDist > KINDA_SMALL_NUMBER) {
          const actualDist = f32(size2D(sub(c.location, oldLocation)));
          remainingTime = refund(
            remainingTime,
            timeTick,
            actualDist,
            desiredDist
          );
        }
        c.startNewPhysics(remainingTime, iterations);
        return;
      }
    }

    // Update the floor (StepUp may have done it already).
    if (stepDown.computedFloor) c.currentFloor = stepDown.floorResult;
    else c.findFloor(c.location, c.currentFloor, zeroDelta);

    // (bCanWalkOffLedges is true, so UE's ledge-move branch never runs.)
    if (c.currentFloor.isWalkableFloor()) {
      c.adjustFloorHeight();
    } else if (
      c.currentFloor.hitResult.startPenetrating &&
      remainingTime <= 0
    ) {
      // The floor check started in penetration: pop out of the floor
      // rather than moving down.
      const hit = c.currentFloor.hitResult.clone();
      hit.traceEnd = addScaled(hit.traceStart, UP, MAX_FLOOR_DIST);
      c.resolvePenetration(c.getPenetrationAdjustment(hit), hit);
      c.forceNextFloorCheck = true;
    }

    // See if we need to start falling.
    if (
      !c.currentFloor.isWalkableFloor() &&
      !c.currentFloor.hitResult.startPenetrating
    ) {
      const mustJump = c.justTeleported || zeroDelta || !hadBase;
      if (
        (mustJump || !checkedFall) &&
        c.checkFall(
          oldFloor,
          c.currentFloor.hitResult,
          delta,
          oldLocation,
          remainingTime,
          timeTick,
          iterations,
          mustJump
        )
      ) {
        return;
      }
      checkedFall = true;
    }

    if (c.isMovingOnGround()) {
      // Make velocity reflect the actual move.
      if (!c.justTeleported && timeTick >= MIN_TICK_TIME) {
        c.velocity = scale(sub(c.location, oldLocation), 1 / timeTick);
        c.maintainHorizontalGroundVelocity();
      }
    }

    // Didn't move at all: later iterations would be stuck too.
    if (equals(c.location, oldLocation, 0)) break;
  }

  if (c.isMovingOnGround()) c.maintainHorizontalGroundVelocity();
}

/** UCharacterMovementComponent::MoveAlongFloor. */
export function moveAlongFloor(
  c: CharacterMovementComponent,
  inVelocity: Vec3,
  deltaSeconds: number,
  outStepDown: StepDownResult | null
): void {
  if (!c.currentFloor.isWalkableFloor()) return;

  const delta = scale(withZ(inVelocity, 0), deltaSeconds);
  const hit = new HitResult(1);
  let rampVector = c.computeGroundMovementDelta(
    delta,
    c.currentFloor.hitResult,
    c.currentFloor.lineTrace
  );
  c.safeMoveUpdatedComponent(rampVector, hit);

  if (hit.startPenetrating) {
    // Use the hit as an impact to deflect off, rather than doing nothing.
    c.slideAlongSurface(delta, 1, hit.normal, hit, true);
    // (UE's OnCharacterStuckInGeometry: don't trust this move for velocity.)
    if (hit.startPenetrating) c.justTeleported = true;
  } else if (hit.isValidBlockingHit()) {
    // Hit something: most likely another ramp, possibly a barrier.
    let percentTimeApplied = hit.time;
    if (
      hit.time > 0 &&
      hit.normal.z > KINDA_SMALL_NUMBER &&
      c.isWalkable(hit)
    ) {
      // Another walkable ramp.
      const initialPercentRemaining = 1 - percentTimeApplied;
      rampVector = c.computeGroundMovementDelta(
        scale(delta, initialPercentRemaining),
        hit,
        false
      );
      c.safeMoveUpdatedComponent(rampVector, hit);
      const secondHitPercent = hit.time * initialPercentRemaining;
      percentTimeApplied = Math.min(
        Math.max(percentTimeApplied + secondHitPercent, 0),
        1
      );
    }

    if (hit.isValidBlockingHit()) {
      if (c.canStepUp(hit)) {
        // A barrier: try to step up.
        const preStepUpLocation = c.location;
        if (
          !c.stepUp(
            GRAVITY_DIR,
            scale(delta, 1 - percentTimeApplied),
            hit,
            outStepDown
          )
        ) {
          c.slideAlongSurface(
            delta,
            1 - percentTimeApplied,
            hit.normal,
            hit,
            true
          );
        } else if (!c.params.maintainHorizontalGroundVelocity) {
          // Only horizontal movement counts toward velocity.
          c.justTeleported = true;
          const stepUpTimeSlice = (1 - percentTimeApplied) * deltaSeconds;
          if (stepUpTimeSlice >= KINDA_SMALL_NUMBER) {
            c.velocity = planeProject(
              scale(sub(c.location, preStepUpLocation), 1 / stepUpTimeSlice),
              UP
            );
          }
        }
      }
    }
  }
}

/** UCharacterMovementComponent::ComputeGroundMovementDelta: move along a
 * walkable ramp instead of into it. */
export function computeGroundMovementDelta(
  c: CharacterMovementComponent,
  delta: Vec3,
  rampHit: HitResult,
  hitFromLineTrace: boolean
): Vec3 {
  const floorNormal = rampHit.impactNormal;
  const contactNormal = rampHit.normal;
  if (
    floorNormal.z < 1 - KINDA_SMALL_NUMBER &&
    floorNormal.z > KINDA_SMALL_NUMBER &&
    contactNormal.z > KINDA_SMALL_NUMBER &&
    !hitFromLineTrace &&
    c.isWalkable(rampHit)
  ) {
    // Project the horizontal movement onto the ramp.
    const floorDotDelta =
      floorNormal.x * delta.x +
      floorNormal.y * delta.y +
      floorNormal.z * delta.z;
    const rampMovement = vec(delta.x, delta.y, -floorDotDelta / floorNormal.z);
    return c.params.maintainHorizontalGroundVelocity
      ? rampMovement
      : scale(safeNormal(rampMovement), size(delta));
  }
  return delta;
}

/** UCharacterMovementComponent::MaintainHorizontalGroundVelocity. */
export function maintainHorizontalGroundVelocity(
  c: CharacterMovementComponent
): void {
  if (c.velocity.z === 0) return;
  c.velocity = c.params.maintainHorizontalGroundVelocity
    ? withZ(c.velocity, 0)
    : scale(safeNormal2D(c.velocity), size(c.velocity));
}

/** UCharacterMovementComponent::AdjustFloorHeight: keep the capsule
 * floating MIN_FLOOR_DIST to MAX_FLOOR_DIST above the floor. */
export function adjustFloorHeight(c: CharacterMovementComponent): void {
  const floor = c.currentFloor;
  if (!floor.isWalkableFloor()) return;
  let oldFloorDist = floor.floorDist;
  if (floor.lineTrace) {
    // This would scale unwalkable walls.
    if (oldFloorDist < MIN_FLOOR_DIST && floor.lineDist >= MIN_FLOOR_DIST)
      return;
    // The sweep was unwalkable or penetrating: use the line distance.
    oldFloorDist = floor.lineDist;
  }
  if (oldFloorDist >= MIN_FLOOR_DIST && oldFloorDist <= MAX_FLOOR_DIST) return;

  const adjustHit = new HitResult(1);
  const initialZ = c.location.z;
  const avgFloorDist = (MIN_FLOOR_DIST + MAX_FLOOR_DIST) * 0.5;
  const moveDist = avgFloorDist - oldFloorDist;
  c.safeMoveUpdatedComponent(vec(0, 0, moveDist), adjustHit);
  if (!adjustHit.isValidBlockingHit()) {
    c.currentFloor.floorDist += moveDist;
  } else if (moveDist > 0) {
    c.currentFloor.floorDist += c.location.z - initialZ;
  } else {
    c.currentFloor.floorDist = c.location.z - adjustHit.location.z;
    if (c.isWalkable(adjustHit))
      c.currentFloor.setFromSweep(adjustHit, c.currentFloor.floorDist, true);
  }
  // Don't derive velocity from this adjustment if vertical moves count, or
  // if it moved us out of penetration.
  c.justTeleported =
    c.justTeleported ||
    !c.params.maintainHorizontalGroundVelocity ||
    oldFloorDist < 0;
  c.forceNextFloorCheck = true;
}

/** UCharacterMovementComponent::CheckFall. */
export function checkFall(
  c: CharacterMovementComponent,
  _oldFloor: FindFloorResult,
  _hit: HitResult,
  delta: Vec3,
  oldLocation: Vec3,
  remainingTime: number,
  timeTick: number,
  iterations: number,
  mustJump: boolean
): boolean {
  if (mustJump || c.canWalkOffLedges()) {
    // (HandleWalkingOffLedge only notifies the character.)
    if (c.isMovingOnGround())
      c.startFalling(iterations, remainingTime, timeTick, delta, oldLocation);
    return true;
  }
  return false;
}

/** UCharacterMovementComponent::StartFalling. */
export function startFalling(
  c: CharacterMovementComponent,
  iterations: number,
  remainingTimeIn: number,
  timeTick: number,
  delta: Vec3,
  subLoc: Vec3
): void {
  const desiredDist = f32(size(delta));
  const actualDist = f32(size2D(sub(c.location, subLoc)));
  const remainingTime =
    desiredDist < KINDA_SMALL_NUMBER
      ? 0
      : refund(remainingTimeIn, timeTick, actualDist, desiredDist);
  if (c.isMovingOnGround()) c.setMovementMode('falling');
  c.startNewPhysics(remainingTime, iterations);
}
