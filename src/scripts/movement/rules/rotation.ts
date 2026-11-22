/**
 * Body (capsule) rotation: stock PhysicsRotation (UE 5.4.4
 * CharacterMovementComponent.cpp:6286, bOrientRotationToMovement from
 * BP_Character) with WRF's GetDeltaRotation (`0x145590ad0`) and
 * ComputeOrientToMovementRotation (`0x1455883a0`), from
 * `findings/step-3-ground.md` "Body (capsule) rotation". Two-legged
 * branches only (the monowheel's x1.2 / 540 deg/s cap is 1.0 scope).
 *
 * PerformMovement calls it once per update with the whole frame's time,
 * after the physics (CharacterMovementComponent.cpp:2828). The character
 * stays vertical, so only yaw turns.
 */
import {
  f32,
  KINDA_SMALL_NUMBER,
  safeNormal,
  safeNormal2D,
  size,
  sizeSquared,
} from '../math/vec';
import { desiredYaw } from './ground_velocity';
import { fixedTurn, normalizeAxis, yawEquals, yawOf } from './rotator';
import type { TunedCharacterMovement } from './tuned_movement';

/** PhysicsRotation's AngleTolerance. */
const ANGLE_TOLERANCE = 1e-3;

/** GetAxisDeltaRotation (CharacterMovementComponent.cpp). */
const axisDeltaRotation = (rate: number, deltaTime: number): number =>
  rate >= 0 ? Math.min(f32(rate * deltaTime), 360) : 360;

/** WRF GetDeltaRotation, yaw: the forced-turn rate during a forced turn,
 * else stock RotationRate.Yaw through RotationRateYawChannel (identity
 * without buffs). */
export function deltaRotationYaw(
  c: TunedCharacterMovement,
  deltaTime: number
): number {
  if (c.forcedTurn) {
    return axisDeltaRotation(
      Math.abs(c.properties.movingForcedTurnRate),
      deltaTime
    );
  }
  return axisDeltaRotation(c.rotationRateYaw, deltaTime);
}

/**
 * WRF ComputeOrientToMovementRotation for yaw: the target yaw, and the
 * turn allowance (`deltaYaw`, scaled on the ground outside a forced turn).
 */
export function orientToMovement(
  c: TunedCharacterMovement,
  currentYaw: number,
  deltaYawIn: number
): { target: number; deltaYaw: number } {
  let deltaYaw = deltaYawIn;
  if (c.isMovingOnGround()) {
    if (c.forcedTurn) {
      const target = yawOf(c.forcedTurnDir);
      if (yawEquals(currentYaw, target, ANGLE_TOLERANCE)) {
        // Reached: the forced turn ends (ForcedTurnInProgress fires with 2).
        c.endForcedTurn();
      } else {
        c.forcedTurnRotationRatio =
          1 -
          Math.min(
            Math.max(Math.abs(normalizeAxis(currentYaw - target)) / 180, 0),
            1
          );
        return { target, deltaYaw };
      }
    }
    deltaYaw = f32(
      deltaYaw * f32(c.properties.yawRateScaleAtSpeed(size(c.velocity)))
    );
    if (sizeSquared(c.acceleration) < KINDA_SMALL_NUMBER)
      return { target: currentYaw, deltaYaw };
    const dir = safeNormal(c.acceleration);
    // Forwards: face the (steered) acceleration; backwards: face away.
    const { sign } = desiredYaw(c, dir);
    return {
      target: yawOf(sign < 0 ? { x: -dir.x, y: -dir.y, z: 0 } : dir),
      deltaYaw,
    };
  }
  if (c.isFalling()) {
    const v = safeNormal2D(c.velocity);
    if (v.x === 0 && v.y === 0) return { target: currentYaw, deltaYaw };
    let target = yawOf(v);
    const angle = Math.abs(normalizeAxis(target - currentYaw));
    if (angle > c.properties.maxAngleToMoveForwardsFalling)
      target = normalizeAxis(target + 180);
    return { target, deltaYaw };
  }
  return { target: currentYaw, deltaYaw };
}

/** PhysicsRotation (yaw; pitch and roll stay 0). */
export function physicsRotation(
  c: TunedCharacterMovement,
  deltaTime: number
): void {
  const currentYaw = normalizeAxis(c.yaw);
  const { target, deltaYaw } = orientToMovement(
    c,
    currentYaw,
    deltaRotationYaw(c, deltaTime)
  );
  const desired = normalizeAxis(target);
  if (yawEquals(currentYaw, desired, ANGLE_TOLERANCE)) return;
  // FMath::IsNearlyEqual(Current.Yaw, Desired.Yaw, AngleTolerance).
  if (Math.abs(currentYaw - desired) <= ANGLE_TOLERANCE) return;
  c.setYaw(fixedTurn(currentYaw, desired, deltaYaw));
}
