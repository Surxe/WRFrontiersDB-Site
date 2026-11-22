/**
 * Velocity integration, ported from UE 5.4.4
 * (CharacterMovementComponent.cpp CalcVelocity, ApplyVelocityBraking,
 * ComputeAnalogInputModifier; MovementComponent.cpp IsExceedingMaxSpeed).
 * Path following (ApplyRequestedMove), bForceMaxAccel, root motion and RVO
 * avoidance are left out (none apply to a player-driven robot here).
 */
import {
  addScaled,
  clampedToMaxSize,
  dot,
  isZero,
  KINDA_SMALL_NUMBER,
  safeNormal,
  scale,
  size,
  sizeSquared,
  sub,
  ZERO,
} from '../math/vec';
import { BRAKE_TO_STOP_VELOCITY, MIN_TICK_TIME } from './constants';
import type { CharacterMovementComponent } from './character_movement';

export function computeAnalogInputModifier(
  c: CharacterMovementComponent
): number {
  const maxAccel = c.getMaxAcceleration();
  if (sizeSquared(c.acceleration) > 0 && maxAccel > 1e-8) {
    return Math.min(Math.max(size(c.acceleration) / maxAccel, 0), 1);
  }
  return 0;
}

/** UMovementComponent::IsExceedingMaxSpeed (1% tolerance). */
export function isExceedingMaxSpeed(
  c: CharacterMovementComponent,
  maxSpeed: number
): boolean {
  const max = Math.max(0, maxSpeed);
  return sizeSquared(c.velocity) > max * max * 1.01;
}

/** UCharacterMovementComponent::CalcVelocity. */
export function calcVelocity(
  c: CharacterMovementComponent,
  deltaTime: number,
  frictionIn: number,
  fluid: boolean,
  brakingDeceleration: number
): void {
  if (deltaTime < MIN_TICK_TIME) return;
  const friction = Math.max(0, frictionIn);
  const maxSpeedRaw = c.getMaxSpeed();

  const maxInputSpeed = Math.max(
    maxSpeedRaw * c.analogInputModifier,
    c.getMinAnalogSpeed()
  );
  const maxSpeed = maxInputSpeed;

  const zeroAcceleration = isZero(c.acceleration);
  const velocityOverMax = c.isExceedingMaxSpeed(maxSpeed);

  // Brake only without acceleration, or when over max speed.
  if (zeroAcceleration || velocityOverMax) {
    const oldVelocity = c.velocity;
    const brakingFriction = c.params.useSeparateBrakingFriction
      ? c.params.brakingFriction
      : friction;
    c.applyVelocityBraking(deltaTime, brakingFriction, brakingDeceleration);
    // Don't brake below max speed if we started above it.
    if (
      velocityOverMax &&
      sizeSquared(c.velocity) < maxSpeed * maxSpeed &&
      dot(c.acceleration, oldVelocity) > 0
    ) {
      c.velocity = scale(safeNormal(oldVelocity), maxSpeed);
    }
  } else if (!zeroAcceleration) {
    // Friction affects the ability to change direction.
    const accelDir = safeNormal(c.acceleration);
    const velSize = size(c.velocity);
    c.velocity = sub(
      c.velocity,
      scale(
        sub(c.velocity, scale(accelDir, velSize)),
        Math.min(deltaTime * friction, 1)
      )
    );
  }

  if (fluid) {
    c.velocity = scale(c.velocity, 1 - Math.min(friction * deltaTime, 1));
  }

  if (!zeroAcceleration) {
    const newMaxInputSpeed = c.isExceedingMaxSpeed(maxInputSpeed)
      ? size(c.velocity)
      : maxInputSpeed;
    c.velocity = clampedToMaxSize(
      addScaled(c.velocity, c.acceleration, deltaTime),
      newMaxInputSpeed
    );
  }
}

/** UCharacterMovementComponent::ApplyVelocityBraking. */
export function applyVelocityBraking(
  c: CharacterMovementComponent,
  deltaTime: number,
  frictionIn: number,
  brakingDecelerationIn: number
): void {
  if (isZero(c.velocity) || deltaTime < MIN_TICK_TIME) return;
  const frictionFactor = Math.max(0, c.params.brakingFrictionFactor);
  const friction = Math.max(0, frictionIn * frictionFactor);
  const brakingDeceleration = Math.max(0, brakingDecelerationIn);
  const zeroFriction = friction === 0;
  const zeroBraking = brakingDeceleration === 0;
  if (zeroFriction && zeroBraking) return;

  const oldVel = c.velocity;
  // Subdivide braking for consistent results at low frame rates.
  let remainingTime = deltaTime;
  const maxTimeStep = Math.min(
    Math.max(c.params.brakingSubStepTime, 1 / 75),
    1 / 20
  );
  const revAccel = zeroBraking
    ? ZERO
    : scale(safeNormal(c.velocity), -brakingDeceleration);
  while (remainingTime >= MIN_TICK_TIME) {
    // Zero friction is constant deceleration: no need to iterate.
    const dt =
      remainingTime > maxTimeStep && !zeroFriction
        ? Math.min(maxTimeStep, remainingTime * 0.5)
        : remainingTime;
    remainingTime -= dt;
    c.velocity = addScaled(
      c.velocity,
      addScaled(revAccel, c.velocity, -friction),
      dt
    );
    // Don't reverse direction.
    if (dot(c.velocity, oldVel) <= 0) {
      c.velocity = ZERO;
      return;
    }
  }
  // Clamp to zero if nearly zero, or below the stop threshold while braking.
  const vSizeSq = sizeSquared(c.velocity);
  if (
    vSizeSq <= KINDA_SMALL_NUMBER ||
    (!zeroBraking && vSizeSq <= BRAKE_TO_STOP_VELOCITY ** 2)
  ) {
    c.velocity = ZERO;
  }
}
