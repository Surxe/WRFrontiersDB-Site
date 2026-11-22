/**
 * WRF's CalcVelocity on the ground (`0x145582780`), from
 * `findings/step-3-ground.md` "WRF CalcVelocity, on the ground" (build
 * 5886399475557598571). Numbered comments are the finding's items. Off the
 * ground WRF calls stock CalcVelocity (tuned_movement.ts).
 *
 * Left out (not plain driving, findings step 3 Unknowns): simulated
 * proxies, animation root motion, AI requested velocity (zero for a player),
 * bForceMaxAccel (false for a player), the timed velocity fade (+0x1690).
 */
import {
  add,
  addScaled,
  clampedToMaxSize,
  dot,
  f32,
  isZero,
  safeNormal,
  safeNormal2D,
  scale,
  size,
  size2D,
  sizeSquared,
  sizeSquared2D,
  sub,
  vec,
  type Vec3,
} from '../math/vec';
import { MIN_TICK_TIME } from '../engine/constants';
import { clampAngle, normalizeAxis, rotateZ, yawOf } from './rotator';
import type { TunedCharacterMovement } from './tuned_movement';

const DEG = 180 / Math.PI;

/** The forced turn's direction is the facing turned by this (step 3). */
export const FORCED_TURN_OFFSET_DEGREES = 3;

/** WRF `CapsuleRotationSpeedThreshold` (+0x1cd8): the steering limit
 * applies above it (constructor `0x14557707e`, findings step 3). */
export const CAPSULE_ROTATION_SPEED_THRESHOLD = 1000;

export interface DesiredYaw {
  /** Degrees from the walking direction (`facing`) to the input. */
  angle: number;
  /** +1 walks forwards, -1 backwards. */
  sign: number;
  /** `sign` x the capsule's forward vector. */
  facing: Vec3;
}

/**
 * `0x145590cb0`: forwards or backwards, and the input's angle from that
 * direction. Below BackwardMovementVelocityThreshold the robot counts as
 * facing forwards; above, the velocity's side of the capsule decides. Input
 * more than MaxAngleToMoveForwards away flips it.
 */
export function desiredYaw(
  c: TunedCharacterMovement,
  accel: Vec3,
  fwd: Vec3 = c.forwardVector()
): DesiredYaw {
  const p = c.properties;
  // (bForwardDirectionFromInput, +0x17e8, is taken as false: who sets it is
  // an open point of findings step 3, listed in RULES_KNOWN_GAPS.)
  let sign =
    size(c.velocity) <= p.backwardMovementVelocityThreshold
      ? 1
      : dot(c.velocity, fwd) < 0
        ? -1
        : 1;
  let facing = scale(fwd, sign);
  let angle = normalizeAxis(yawOf(accel) - yawOf(facing));
  if (Math.abs(angle) > p.maxAngleToMoveForwards) {
    sign = -sign;
    facing = scale(facing, -1);
    angle = normalizeAxis(yawOf(accel) - yawOf(facing));
  }
  return { angle, sign, facing };
}

/** The slope angle `s` (`0x1455934c0`), degrees: positive uphill. 0 when
 * the velocity or floor is degenerate or |s| > 90.0001 (item 9). */
export function slopeAngle(c: TunedCharacterMovement): number {
  const v = safeNormal(c.lastUpdateVelocity);
  if (isZero(v)) return 0;
  const n = c.currentFloor.hitResult.impactNormal;
  const cos = Math.min(Math.max(dot(v, n), -1), 1);
  const s = Math.acos(cos) * DEG - 90;
  return Math.abs(s) > 90.0001 ? 0 : s;
}

/** Item 2: steering, forced turns and the desired-yaw speed factor. */
function steer(c: TunedCharacterMovement, deltaTime: number): void {
  const p = c.properties;
  c.speedFactor = 1;
  if (!isZero(c.acceleration) && !c.forcedTurn) {
    const fwd = c.forwardVector();
    const { angle, sign, facing } = desiredYaw(c, c.acceleration, fwd);
    // Forced turn check (`0x145586d20`).
    if (
      sign < 0 &&
      dot(c.velocity, fwd) < 0 &&
      size2D(c.velocity) > p.forcedTurnSpeedThreshold
    ) {
      c.startForcedTurn(
        rotateZ(safeNormal2D(facing), FORCED_TURN_OFFSET_DEGREES)
      );
    } else {
      let steered = angle;
      if (size(c.velocity) > CAPSULE_ROTATION_SPEED_THRESHOLD) {
        // RotationRateYawChannel(RotationRate.Yaw x dt): no modifiers
        // without buffs (findings step 2).
        const step = f32(c.rotationRateYaw * deltaTime);
        steered = clampAngle(angle, -step, step);
      }
      c.acceleration = scale(rotateZ(facing, steered), size(c.acceleration));
      // Skipped while the last move's saved hit blocked without starting in
      // penetration (two legs, +0x1dd5).
      if (!c.lastMoveHit?.isValidBlockingHit())
        c.speedFactor = f32(p.speedFactorForDesiredYaw(angle));
    }
  }
  if (c.forcedTurn) {
    c.acceleration = scale(c.forcedTurnDir, f32(c.getMaxAcceleration()));
  }
}

/** Item 6: emergency deceleration on opposing input (`0x14557b6c0`). */
function emergencyDeceleration(
  c: TunedCharacterMovement,
  deltaTime: number,
  inputDir: Vec3
): void {
  if (c.forcedTurn || isZero(inputDir) || isZero(c.velocity)) return;
  const vDir = safeNormal(c.velocity);
  const cos = dot(vDir, inputDir);
  if (cos >= 0) return;
  const angle = Math.acos(Math.max(cos, -1)) * DEG;
  const decel = f32(
    f32(c.properties.emergencyDecelerationAtAngle(angle)) * deltaTime
  );
  c.velocity = scale(vDir, Math.max(0, size(c.velocity) - decel));
}

/** Item 8: the sideways friction model (`0x14557ba20`, kernel
 * `0x145580290`). */
export function applyFriction(
  c: TunedCharacterMovement,
  deltaTime: number
): void {
  if (!c.frictionEnabled) return;
  const p = c.properties;
  const fv = p.frictionVector;
  const fwd = c.forcedTurn ? c.forcedTurnDir : c.forwardVector();
  let g = rotateZ(vec(fv.x * deltaTime, fv.y * deltaTime, 0), yawOf(fwd));
  g = scale(safeNormal(g), Math.min(size(g), 1));
  const g2 = sizeSquared(g);
  if (g2 === 0) return;
  const q = dot(sub(c.velocity, scale(fwd, size(c.velocity))), g) / g2;
  // dV_i = |g_i| x g_i x q, per world axis; x FrictionChannel(1) = 1.
  const dv = vec(
    Math.abs(g.x) * g.x * q,
    Math.abs(g.y) * g.y * q,
    Math.abs(g.z) * g.z * q
  );
  c.velocity = sub(c.velocity, dv);
  // Compensation along the acceleration's horizontal direction.
  const a2d =
    sizeSquared2D(c.acceleration) < 0.1
      ? vec(0, 0, 0)
      : safeNormal2D(c.acceleration);
  c.velocity = addScaled(
    c.velocity,
    a2d,
    size2D(dv) * p.frictionVelocityCompensationMultiplier
  );
}

/** WRF CalcVelocity on the ground. */
export function calcVelocityGround(
  c: TunedCharacterMovement,
  deltaTime: number,
  brakingDeceleration: number
): void {
  if (deltaTime < MIN_TICK_TIME) return;
  // 1. The input direction before steering.
  const inputDir = safeNormal(c.acceleration);
  // 2. Steering and the speed factor.
  steer(c, deltaTime);
  // 3. MaxSpeed (GetMaxSpeed, with the speed factor and slope bonus).
  const maxSpeed = f32(c.getMaxSpeed());
  // 5. Max input speed (RequestedVelocity is zero for a player).
  const maxInputSpeed =
    c.analogInputModifier > 1e-4
      ? f32(
          Math.max(
            f32(Math.min(Math.max(c.analogInputModifier, 0), 1) * maxSpeed),
            f32(c.getMinAnalogSpeed())
          )
        )
      : maxSpeed;
  // 6. Emergency deceleration.
  emergencyDeceleration(c, deltaTime, inputDir);
  // 7. Integrate.
  const zeroAcceleration = isZero(c.acceleration);
  if (!zeroAcceleration) {
    const speed = size(c.velocity);
    const limit = speed > maxInputSpeed ? speed : maxInputSpeed;
    c.velocity = clampedToMaxSize(
      addScaled(c.velocity, c.acceleration, deltaTime),
      limit
    );
  }
  // 8. Sideways friction and its compensation.
  applyFriction(c, deltaTime);
  // 9. Slope acceleration.
  const pitchAccel = f32(c.properties.accelerationAtPitch(-slopeAngle(c)));
  if (pitchAccel !== 0 && !isZero(c.velocity)) {
    c.velocity = add(
      c.velocity,
      scale(safeNormal(c.velocity), pitchAccel * deltaTime)
    );
  }
  // 10. Braking: stock ApplyVelocityBraking with friction 0.
  const overMax = c.isExceedingMaxSpeed(maxSpeed);
  if (zeroAcceleration || overMax) {
    const oldVelocity = c.velocity;
    c.applyVelocityBraking(deltaTime, 0, brakingDeceleration);
    if (
      overMax &&
      sizeSquared(c.velocity) < f32(maxSpeed * maxSpeed) &&
      dot(c.acceleration, oldVelocity) > 0
    ) {
      c.velocity = scale(safeNormal(oldVelocity), maxSpeed);
    }
  }
}
