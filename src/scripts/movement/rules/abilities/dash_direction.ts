/**
 * The dash direction `D` (`0x1452d7e30`, findings step 6 and its 2026-11-21
 * note), player path, computed once when the active state starts (called
 * with its "use input" flag set, `0x1452ddd40`):
 *
 * 1. `A` = the aim: the unit vector from the capsule to the aim target.
 * 2. The input (`CMC+0x11f0`, world axes) is taken into the aim's frame
 *    (rows `A`, `R = norm(Up x A)`, `T = norm(A x R)`; identity if any is
 *    zero) through a full 4x4 inverse, and its yaw read there.
 * 3. The base is `A` flattened on the ground (`GetSafeNormal2D`) or `A` in
 *    the air (`GetSafeNormal`); with non-zero input it is turned about up by
 *    that yaw.
 * 4. A base that is nearly zero falls back to the capsule's forward.
 * 5. `D.z` is clamped to `[-|A2D . base2D|, 0]` (float), then normalised.
 *
 * The AI-controller branch (`AAIController::GetFocalPointForPriority`) is
 * bots only and not ported.
 */
import {
  isNearlyZero,
  isZero,
  f32,
  cross,
  safeNormal,
  safeNormal2D,
  UP,
  vec,
  type Vec3,
} from '../../math/vec';
import {
  matrixInverse,
  rotateAngleAxis,
  transformVector,
  vectorRotation,
} from '../../math/ue_rotation';

export interface DashDirectionInput {
  /** AimTarget - capsule location (any length). */
  aim: Vec3;
  /** The input vector ConsumeInputVector kept (CMC+0x11f0). */
  input: Vec3;
  onGround: boolean;
  /** The capsule's forward (the root component's), the fallback. */
  forward: Vec3;
}

export function dashDirection({
  aim,
  input,
  onGround,
  forward,
}: DashDirectionInput): Vec3 {
  const a = safeNormal(aim);
  // The aim's frame. The function is called with "use input" set, so the
  // input branch runs even for (nearly) zero input.
  const r = safeNormal(cross(UP, a));
  const t = safeNormal(cross(a, r));
  const frame =
    isZero(a) || isZero(r) || isZero(t)
      ? [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ]
      : [
          [a.x, a.y, a.z, 0],
          [r.x, r.y, r.z, 0],
          [t.x, t.y, t.z, 0],
          [0, 0, 0, 1],
        ];
  const local = transformVector(matrixInverse(frame), input);
  let base = onGround ? safeNormal2D(a) : safeNormal(a);
  if (!isZero(input))
    base = rotateAngleAxis(base, vectorRotation(local).yaw, UP);
  const dir = isNearlyZero(base) ? forward : base;
  const base2D = safeNormal2D(base);
  const aim2D = safeNormal2D(a);
  const alignment = f32(
    Math.abs(aim2D.y * base2D.y + aim2D.x * base2D.x + aim2D.z * base2D.z)
  );
  const upper = alignment >= 0 ? 0 : alignment;
  const lower = -alignment;
  let z = dir.z <= upper ? dir.z : upper;
  if (z <= lower) z = lower;
  return safeNormal(vec(dir.x, dir.y, z));
}
