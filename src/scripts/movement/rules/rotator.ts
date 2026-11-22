/**
 * The FRotator and FMath angle helpers WRF's rules call, ported from UE
 * 5.4.4 (Core/Public/Math/Rotator.h ClampAxis, NormalizeAxis, ClampAngle;
 * Core/Private/Math/UnrealMath.cpp FMath::FixedTurn; Vector.h
 * FVector::Rotation, RotateAngleAxis about Z). Degrees throughout; yaw 0
 * faces +X and 90 faces +Y, as in UE.
 */
import { f32, vec, type Vec3 } from '../math/vec';

const DEG = 180 / Math.PI;

/** TRotator::ClampAxis: an angle in [0, 360). */
export function clampAxis(angle: number): number {
  let a = angle % 360;
  if (a < 0) a += 360;
  return a;
}

/** TRotator::NormalizeAxis: an angle in (-180, 180]. */
export function normalizeAxis(angle: number): number {
  let a = clampAxis(angle);
  if (a > 180) a -= 360;
  return a;
}

/** FMath::ClampAngle (Rotator.h:943). */
export function clampAngle(angle: number, min: number, max: number): number {
  const maxDelta = clampAxis(max - min) * 0.5;
  const rangeCenter = clampAxis(min + maxDelta);
  const deltaFromCenter = normalizeAxis(angle - rangeCenter);
  if (deltaFromCenter > maxDelta) return normalizeAxis(rangeCenter + maxDelta);
  if (deltaFromCenter < -maxDelta) return normalizeAxis(rangeCenter - maxDelta);
  return normalizeAxis(angle);
}

/** FRotator3f::ClampAxis, in float as FixedTurn calls it. */
const clampAxisF = (angle: number): number => f32(clampAxis(f32(angle)));

/** FMath::FixedTurn (UnrealMath.cpp:3474): turn `current` toward `desired`
 * by at most `deltaRate` degrees, the shorter way; float, result [0, 360). */
export function fixedTurn(
  currentIn: number,
  desiredIn: number,
  deltaRateIn: number
): number {
  const deltaRate = f32(deltaRateIn);
  if (deltaRate === 0) return clampAxisF(currentIn);
  if (deltaRate >= 360) return clampAxisF(desiredIn);
  let result = clampAxisF(currentIn);
  const current = result;
  const desired = clampAxisF(desiredIn);
  const rate = Math.abs(deltaRate);
  if (current > desired) {
    if (f32(current - desired) < 180)
      result = f32(result - Math.min(f32(current - desired), rate));
    else
      result = f32(result + Math.min(f32(f32(desired + 360) - current), rate));
  } else if (f32(desired - current) < 180) {
    result = f32(result + Math.min(f32(desired - current), rate));
  } else {
    result = f32(result - Math.min(f32(f32(current + 360) - desired), rate));
  }
  return clampAxisF(result);
}

/** FVector::Rotation().Yaw: atan2(Y, X) in degrees. */
export const yawOf = (v: Vec3): number => Math.atan2(v.y, v.x) * DEG;

/** The horizontal unit vector a yaw faces (FRotator(0, yaw, 0).Vector()). */
export function yawVector(yawDegrees: number): Vec3 {
  const r = yawDegrees / DEG;
  return vec(Math.cos(r), Math.sin(r), 0);
}

/** FVector::RotateAngleAxis(angle, (0, 0, 1)). */
export function rotateZ(v: Vec3, angleDegrees: number): Vec3 {
  const r = angleDegrees / DEG;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return vec(v.x * c - v.y * s, v.x * s + v.y * c, v.z);
}

/** FRotator::Equals for yaw only: NormalizeAxis of the difference within
 * `tolerance` degrees. */
export const yawEquals = (a: number, b: number, tolerance: number): boolean =>
  Math.abs(normalizeAxis(a - b)) <= tolerance;
