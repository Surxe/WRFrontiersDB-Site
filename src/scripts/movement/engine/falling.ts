/**
 * Falling and landing, ported from UE 5.4.4 (CharacterMovementComponent.cpp
 * PhysFalling, GetFallingLateralAcceleration, GetAirControl, BoostAirControl,
 * LimitAirControl, NewFallVelocity, HandleSlopeBoosting, IsValidLandingSpot,
 * ShouldCheckForValidLandingSpot, ProcessLanded, SetPostLandedPhysics).
 *
 * There is no jumping in the prototype, so the jump-force branches
 * (JumpForceTimeRemaining) never apply; the jump-apex substep is kept since
 * it also triggers when leaving a ramp upward.
 */
import {
  add,
  addScaled,
  clampedToMaxSize,
  dot,
  equals,
  isNearlyZero,
  KINDA_SMALL_NUMBER,
  mul,
  planeProject,
  pointPlaneProject,
  safeNormal,
  safeNormal2D,
  scale,
  sizeSquared,
  sizeSquared2D,
  sub,
  vec,
  withZ,
  ZERO,
  type Vec3,
} from '../math/vec';
import { MIN_TICK_TIME, VERTICAL_SLOPE_NORMAL_Z } from './constants';
import { FindFloorResult, HitResult } from './hit';
import type { CharacterMovementComponent } from './character_movement';

/** MaxJumpApexAttemptsPerSimulation (constructor default). */
export const MAX_JUMP_APEX_ATTEMPTS = 2;

/** UCharacterMovementComponent::GetFallingLateralAcceleration. */
export function getFallingLateralAcceleration(
  c: CharacterMovementComponent,
  deltaTime: number
): Vec3 {
  let fallAcceleration = withZ(c.acceleration, 0);
  if (sizeSquared2D(c.acceleration) > 0) {
    fallAcceleration = getAirControl(
      c,
      deltaTime,
      c.params.airControl,
      fallAcceleration
    );
    fallAcceleration = clampedToMaxSize(
      fallAcceleration,
      c.getMaxAcceleration()
    );
  }
  return fallAcceleration;
}

/** GetAirControl + BoostAirControl. */
function getAirControl(
  c: CharacterMovementComponent,
  _deltaTime: number,
  tickAirControlIn: number,
  fallAcceleration: Vec3
): Vec3 {
  let tickAirControl = tickAirControlIn;
  if (tickAirControl !== 0) {
    const { airControlBoostMultiplier, airControlBoostVelocityThreshold } =
      c.params;
    if (
      airControlBoostMultiplier > 0 &&
      sizeSquared2D(c.velocity) < airControlBoostVelocityThreshold ** 2
    ) {
      tickAirControl = Math.min(1, airControlBoostMultiplier * tickAirControl);
    }
  }
  return scale(fallAcceleration, tickAirControl);
}

/** UCharacterMovementComponent::NewFallVelocity: gravity, capped at the
 * terminal velocity. */
export function newFallVelocity(
  c: CharacterMovementComponent,
  initialVelocity: Vec3,
  gravity: Vec3,
  deltaTime: number
): Vec3 {
  let result = initialVelocity;
  if (deltaTime > 0) {
    result = addScaled(result, gravity, deltaTime);
    const terminalLimit = Math.abs(c.getTerminalVelocity());
    if (sizeSquared(result) > terminalLimit * terminalLimit) {
      const gravityDir = safeNormal(gravity);
      if (dot(result, gravityDir) > terminalLimit) {
        result = addScaled(
          pointPlaneProject(result, ZERO, gravityDir),
          gravityDir,
          terminalLimit
        );
      }
    }
  }
  return result;
}

/** UCharacterMovementComponent::LimitAirControl. */
export function limitAirControl(
  c: CharacterMovementComponent,
  _deltaTime: number,
  fallAcceleration: Vec3,
  hit: HitResult,
  checkForValidLandingSpot: boolean
): Vec3 {
  let result = fallAcceleration;
  if (hit.isValidBlockingHit() && hit.normal.z > VERTICAL_SLOPE_NORMAL_Z) {
    if (!checkForValidLandingSpot || !c.isValidLandingSpot(hit.location, hit)) {
      // Into the wall: allow movement along it, not into it (that may push
      // us up).
      if (dot(fallAcceleration, hit.normal) < 0) {
        result = planeProject(fallAcceleration, safeNormal2D(hit.normal));
      }
    }
  } else if (hit.startPenetrating) {
    // Allow movement out of penetration.
    return dot(result, hit.normal) > 0 ? result : ZERO;
  }
  return result;
}

/** UCharacterMovementComponent::HandleSlopeBoosting: don't let a slide
 * while falling carry us higher than the move intended. */
export function handleSlopeBoosting(
  _c: CharacterMovementComponent,
  slideResult: Vec3,
  delta: Vec3,
  time: number,
  normal: Vec3,
  _hit: HitResult
): Vec3 {
  let result = slideResult;
  if (result.z > 0) {
    const zLimit = delta.z * time;
    if (result.z - zLimit > KINDA_SMALL_NUMBER) {
      if (zLimit > 0) {
        // Rescale the whole vector, so we don't head back into the impact.
        result = scale(result, zLimit / result.z);
      } else {
        // Heading down but deflecting up: make the deflection horizontal.
        result = ZERO;
      }
      // Make the rest horizontal and parallel to the impact.
      const remainderXY = mul(sub(slideResult, result), vec(1, 1, 0));
      const normalXY = safeNormal2D(normal);
      // Super::ComputeSlideVector (UMovementComponent's, not the override).
      result = add(result, planeProject(remainderXY, normalXY));
    }
  }
  return result;
}

/** UCharacterMovementComponent::IsValidLandingSpot. */
export function isValidLandingSpot(
  c: CharacterMovementComponent,
  capsuleLocation: Vec3,
  hit: HitResult
): boolean {
  if (!hit.blockingHit) return false;
  if (!hit.startPenetrating) {
    if (!c.isWalkable(hit)) return false;
    const { radius: pawnRadius, halfHeight: pawnHalfHeight } = c.capsule;
    // Reject hits above the lower hemisphere (sliding down a wall).
    const lowerHemisphereZ = hit.location.z - pawnHalfHeight + pawnRadius;
    if (hit.impactPoint.z >= lowerHemisphereZ) return false;
    // Reject hits barely on the cusp of the radius.
    if (!c.isWithinEdgeTolerance(hit.location, hit.impactPoint, pawnRadius))
      return false;
  } else if (hit.normal.z < KINDA_SMALL_NUMBER) {
    // A penetration next to a vertical or overhanging wall: don't pop up.
    return false;
  }
  const floorResult = new FindFloorResult();
  c.findFloor(capsuleLocation, floorResult, false, hit);
  return floorResult.isWalkableFloor();
}

/** UCharacterMovementComponent::ShouldCheckForValidLandingSpot: an edge hit
 * on the lower capsule may have walkable ground on top. */
export function shouldCheckForValidLandingSpot(
  c: CharacterMovementComponent,
  _deltaTime: number,
  _delta: Vec3,
  hit: HitResult
): boolean {
  if (
    hit.normal.z > KINDA_SMALL_NUMBER &&
    !equals(hit.normal, hit.impactNormal)
  ) {
    if (c.isWithinEdgeTolerance(c.location, hit.impactPoint, c.capsule.radius))
      return true;
  }
  return false;
}

/** ProcessLanded + SetPostLandedPhysics. */
export function processLanded(
  c: CharacterMovementComponent,
  _hit: HitResult,
  remainingTime: number,
  iterations: number
): void {
  if (c.isFalling()) c.setMovementMode('walking');
  c.startNewPhysics(remainingTime, iterations);
}

/** UCharacterMovementComponent::PhysFalling. */
export function physFalling(
  c: CharacterMovementComponent,
  deltaTime: number,
  iterationsIn: number
): void {
  if (deltaTime < MIN_TICK_TIME) return;
  let iterations = iterationsIn;

  const fallAcceleration = withZ(c.getFallingLateralAcceleration(deltaTime), 0);
  const hasLimitedAirControl = sizeSquared2D(fallAcceleration) > 0;

  let remainingTime = deltaTime;
  while (
    remainingTime >= MIN_TICK_TIME &&
    iterations < c.params.maxSimulationIterations
  ) {
    iterations++;
    let timeTick = c.getSimulationTimeStep(remainingTime, iterations);
    remainingTime -= timeTick;

    c.justTeleported = false;
    const oldVelocityWithRootMotion = c.velocity;
    const oldVelocity = c.velocity;

    // Apply input (CalcVelocity with Acceleration = FallAcceleration).
    const maxDecel = c.getMaxBrakingDeceleration();
    const savedAcceleration = c.acceleration;
    c.acceleration = fallAcceleration;
    c.velocity = withZ(c.velocity, 0);
    c.calcVelocity(timeTick, c.params.fallingLateralFriction, false, maxDecel);
    c.velocity = withZ(c.velocity, oldVelocity.z);
    c.acceleration = savedAcceleration;

    const gravity = vec(0, 0, c.getGravityZ());
    const gravityTime = timeTick;
    c.velocity = c.newFallVelocity(c.velocity, gravity, gravityTime);

    // Substep to exactly reach the apex.
    if (
      oldVelocityWithRootMotion.z > 0 &&
      c.velocity.z <= 0 &&
      c.numJumpApexAttempts < MAX_JUMP_APEX_ATTEMPTS
    ) {
      const derivedAccel = scale(
        sub(c.velocity, oldVelocityWithRootMotion),
        1 / timeTick
      );
      if (Math.abs(derivedAccel.z) > 1e-8) {
        const timeToApex = -oldVelocityWithRootMotion.z / derivedAccel.z;
        const apexTimeMinimum = 0.0001;
        if (timeToApex >= apexTimeMinimum && timeToApex < timeTick) {
          const apexVelocity = addScaled(
            oldVelocityWithRootMotion,
            derivedAccel,
            timeToApex
          );
          c.velocity = withZ(apexVelocity, 0);
          remainingTime += timeTick - timeToApex;
          timeTick = timeToApex;
          iterations--;
          c.numJumpApexAttempts++;
        }
      }
    }

    // Midpoint integration.
    let adjusted = scale(
      add(oldVelocityWithRootMotion, c.velocity),
      0.5 * timeTick
    );

    const hit = new HitResult(1);
    c.safeMoveUpdatedComponent(adjusted, hit);

    let lastMoveTimeSlice = timeTick;
    let subTimeTickRemaining = timeTick * (1 - hit.time);

    if (hit.blockingHit) {
      if (c.isValidLandingSpot(c.location, hit)) {
        remainingTime += subTimeTickRemaining;
        c.processLanded(hit, remainingTime, iterations);
        return;
      }
      // Deflect using the final velocity, so the slide includes all of
      // gravity's effect.
      adjusted = scale(c.velocity, timeTick);

      // Maybe a normally invalid landing spot (by the hit) is usable.
      if (
        !hit.startPenetrating &&
        c.shouldCheckForValidLandingSpot(timeTick, adjusted, hit)
      ) {
        const floorResult = new FindFloorResult();
        c.findFloor(c.location, floorResult, false);
        if (
          floorResult.isWalkableFloor() &&
          c.isValidLandingSpot(c.location, floorResult.hitResult)
        ) {
          remainingTime += subTimeTickRemaining;
          c.processLanded(floorResult.hitResult, remainingTime, iterations);
          return;
        }
      }

      // Limit air control based on what we hit.
      let velocityNoAirControl = oldVelocity;
      let airControlAccel = c.acceleration;
      if (hasLimitedAirControl) {
        // Velocity without acceleration.
        const keepAcceleration = c.acceleration;
        const keepVelocity = c.velocity;
        c.acceleration = ZERO;
        c.velocity = withZ(oldVelocity, 0);
        c.calcVelocity(
          timeTick,
          c.params.fallingLateralFriction,
          false,
          maxDecel
        );
        velocityNoAirControl = vec(c.velocity.x, c.velocity.y, oldVelocity.z);
        c.acceleration = keepAcceleration;
        c.velocity = keepVelocity;
        velocityNoAirControl = c.newFallVelocity(
          velocityNoAirControl,
          gravity,
          gravityTime
        );

        airControlAccel = scale(
          sub(c.velocity, velocityNoAirControl),
          1 / timeTick
        );
        const airControlDeltaV = scale(
          c.limitAirControl(lastMoveTimeSlice, airControlAccel, hit, false),
          lastMoveTimeSlice
        );
        adjusted = scale(
          add(velocityNoAirControl, airControlDeltaV),
          lastMoveTimeSlice
        );
      }

      const oldHitNormal = hit.normal;
      const oldHitImpactNormal = hit.impactNormal;
      let delta = c.computeSlideVector(
        adjusted,
        1 - hit.time,
        oldHitNormal,
        hit
      );

      // Velocity after deflection.
      if (subTimeTickRemaining > KINDA_SMALL_NUMBER && !c.justTeleported) {
        c.velocity = scale(delta, 1 / subTimeTickRemaining);
      }

      if (
        subTimeTickRemaining > KINDA_SMALL_NUMBER &&
        dot(delta, adjusted) > 0
      ) {
        // Move in the deflected direction.
        c.safeMoveUpdatedComponent(delta, hit);
        if (hit.blockingHit) {
          // Hit a second wall.
          lastMoveTimeSlice = subTimeTickRemaining;
          subTimeTickRemaining *= 1 - hit.time;

          if (c.isValidLandingSpot(c.location, hit)) {
            remainingTime += subTimeTickRemaining;
            c.processLanded(hit, remainingTime, iterations);
            return;
          }

          // Act as if there was no air control on the last move.
          if (hasLimitedAirControl && hit.normal.z > VERTICAL_SLOPE_NORMAL_Z) {
            const lastMoveNoAirControl = scale(
              velocityNoAirControl,
              lastMoveTimeSlice
            );
            delta = c.computeSlideVector(
              lastMoveNoAirControl,
              1,
              oldHitNormal,
              hit
            );
          }

          delta = c.twoWallAdjust(delta, hit, oldHitNormal);

          // Limit air control, but allow a slide along the second wall.
          if (hasLimitedAirControl) {
            const airControlDeltaV = scale(
              c.limitAirControl(
                subTimeTickRemaining,
                airControlAccel,
                hit,
                false
              ),
              subTimeTickRemaining
            );
            // Only if not back into the first wall.
            if (dot(airControlDeltaV, oldHitNormal) > 0) {
              delta = addScaled(delta, airControlDeltaV, subTimeTickRemaining);
            }
          }

          if (subTimeTickRemaining > KINDA_SMALL_NUMBER && !c.justTeleported) {
            c.velocity = scale(delta, 1 / subTimeTickRemaining);
          }

          // Straddling two slopes, neither of which can be stood on.
          const ditch =
            oldHitImpactNormal.z > 0 &&
            hit.impactNormal.z > 0 &&
            Math.abs(delta.z) <= KINDA_SMALL_NUMBER &&
            dot(hit.impactNormal, oldHitImpactNormal) < 0;
          c.safeMoveUpdatedComponent(delta, hit);
          if (hit.time === 0) {
            // Stuck: try to side step.
            let sideDelta = safeNormal2D(add(oldHitNormal, hit.impactNormal));
            if (isNearlyZero(sideDelta)) {
              sideDelta = safeNormal(vec(oldHitNormal.y, -oldHitNormal.x, 0));
            }
            c.safeMoveUpdatedComponent(sideDelta, hit);
          }

          if (
            ditch ||
            c.isValidLandingSpot(c.location, hit) ||
            hit.time === 0
          ) {
            remainingTime = 0;
            c.processLanded(hit, remainingTime, iterations);
            return;
          }
          // (The perch-radius "virtual ditch" nudge needs PerchRadiusThreshold
          // > 0 and a random stream; with UE's default of 0 it never runs.)
        }
      }
    }

    if (sizeSquared2D(c.velocity) <= KINDA_SMALL_NUMBER * 10) {
      c.velocity = vec(0, 0, c.velocity.z);
    }
  }
}
