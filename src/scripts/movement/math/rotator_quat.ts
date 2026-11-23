/**
 * FRotator3d::Quaternion as UE 5.4.4's Linux editor computes it
 * (Core/Private/Math/UnrealMath.cpp:481, the vector path): VectorMod360
 * (X - 360 x Trunc(X / 360), no FMA), times DOUBLE_DEG_TO_RAD_HALF, then
 * VectorSinCos, which without SVML (clang) is FMath::Sin / FMath::Cos per
 * lane, and the shuffled products with their sign bits:
 *   X =   CR (SP SY) - SR (CP CY),  Y = -CR (SP CY) - SR (CP SY),
 *   Z =   CR (CP SY) - SR (SP CY),  W =  CR (CP CY) + SR (SP SY).
 * Gated against the 16,254 capsule rotations of the session 4.5 oracle
 * (MVP session 4.5, D27; tests/movement/chaos_sweeps.ts).
 */
import { sinCos } from './sincos';

export type Quat = [number, number, number, number];

const DEG_TO_RAD_HALF = (Math.PI / 180) * 0.5;

const mod360 = (x: number): number => x - 360 * Math.trunc(x / 360);

/** x, y, z, w of FRotator(pitch, yaw, roll).Quaternion(). */
export function rotatorQuaternion(
  pitch: number,
  yaw: number,
  roll: number
): Quat {
  const [SP, CP] = sinCos(mod360(pitch) * DEG_TO_RAD_HALF);
  const [SY, CY] = sinCos(mod360(yaw) * DEG_TO_RAD_HALF);
  const [SR, CR] = sinCos(mod360(roll) * DEG_TO_RAD_HALF);
  return [
    CR * (SP * SY) + -(SR * (CP * CY)),
    -(CR * (SP * CY)) + -(SR * (CP * SY)),
    CR * (CP * SY) + -(SR * (SP * CY)),
    CR * (CP * CY) + SR * (SP * SY),
  ];
}
