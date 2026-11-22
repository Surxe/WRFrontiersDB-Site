/**
 * WRF's movement-properties provider: how a chassis turns its movement
 * type's tiers into the values the movement code asks for. From the
 * reverse-engineering findings, step 2 (`findings/step-2-tuning.md`,
 * build 5886399475557598571):
 *
 * - The chassis module's per-level `Mobility`, clamped to the type's
 *   `max_mobility`, picks two adjacent tiers and a blend factor
 *   (provider builder `0x145521f40`).
 * - Every value is `A + (B - A) x alpha` between the two tiers; curves are
 *   evaluated in each tier first, then blended
 *   (SInterpolatedMovementPropertiesProvider getters).
 * - The module's per-level `MaxSpeed` is written into each tier's
 *   `MaxWalkingSpeed`, so the blend returns exactly `MaxSpeed`.
 */
import { evalCurve, type RichCurve } from '../data/rich_curve';
import type { MovementTier, MovementType } from '../data/movement_type';

export interface TierBlend {
  /** Lower tier index. */
  lower: number;
  /** Upper tier index (equal to `lower` when one tier is used alone). */
  upper: number;
  /** Blend factor from `lower` to `upper`. */
  alpha: number;
}

/** The provider builder's tier choice for `mobility` (findings step 2). */
export function blendForMobility(
  type: MovementType,
  mobility: number
): TierBlend {
  const n = type.tiers.length;
  if (n === 1) return { lower: 0, upper: 0, alpha: 0 };
  if (type.maxMobility === null) {
    throw new Error(
      `${type.id}: max_mobility not exported (struct default unknown)`
    );
  }
  const m = Math.min(Math.max(mobility, 0), type.maxMobility);
  const step = type.maxMobility / (n - 1);
  const i = Math.trunc(m / step);
  let alpha = (m % step) / step;
  if (Math.abs(alpha) <= 1e-4) alpha = 1;
  // alpha snapped to 1 (or nearly 1): tier i alone.
  if (Math.abs(alpha - 1) <= 1e-4) return { lower: i, upper: i, alpha: 0 };
  return { lower: i, upper: Math.min(i + 1, n - 1), alpha };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** `BackwardMovementVelocityThreshold`: no tier exports it; the
 * USMovementProperties constructor sets 500 (`0x14550af7c`, findings
 * step 2). */
export const BACKWARD_MOVEMENT_VELOCITY_THRESHOLD = 500;

/**
 * USMovementProperties constructor defaults (`0x14550aef0`, findings step
 * 2) for fields a tier may leave out (cooked data omits defaults). Fields
 * not listed here fail loudly when missing.
 */
const STRUCT_DEFAULTS: Partial<Record<keyof MovementTier, number>> & {
  movingForcedTurnVelocityThreshold: number;
  movingForcedTurnVelocityMaxSpeedRatio: number;
} = {
  movingForcedTurnRate: 360,
  maxAngleToMoveForwards: 120,
  maxAngleToMoveForwardsFalling: 100,
  movingForcedTurnVelocityThreshold: 2500,
  movingForcedTurnVelocityMaxSpeedRatio: 1,
  frictionVelocityCompensationMultiplier: 0.5,
  fallingAcceleration: 1000,
  fallingBrakingVelocityThreshold: 3000,
  standingVelocityThreshold: 0.1,
};

/** The wall-hit curve whose key is nearest `maxSpeed` (first on a tie). */
function nearestWallCurve(
  curves: readonly { speed: number; curve: RichCurve }[],
  maxSpeed: number
): RichCurve {
  let best = curves[0];
  for (const entry of curves) {
    if (Math.abs(entry.speed - maxSpeed) < Math.abs(best.speed - maxSpeed))
      best = entry;
  }
  return best.curve;
}

/** Answers the movement code's questions for one chassis. */
export class MovementProperties {
  private readonly a: MovementTier;
  private readonly b: MovementTier;

  constructor(
    readonly type: MovementType,
    readonly blend: TierBlend,
    /** The chassis module's per-level MaxSpeed (cm/s). */
    readonly maxWalkingSpeed: number
  ) {
    this.a = type.tiers[blend.lower];
    this.b = type.tiers[blend.upper];
  }

  private value(field: keyof MovementTier): number {
    const fallback = STRUCT_DEFAULTS[field];
    const a = this.a[field] ?? fallback;
    const b = this.b[field] ?? fallback;
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error(
        `${this.type.id}: ${field} not exported (struct default unknown)`
      );
    }
    return lerp(a, b, this.blend.alpha);
  }

  private curve(field: keyof MovementTier, x: number): number {
    const a = this.a[field] as RichCurve | null;
    const b = this.b[field] as RichCurve | null;
    if (!a || !b)
      throw new Error(
        `${this.type.id}: ${field} not exported (struct default unknown)`
      );
    return lerp(evalCurve(a, x), evalCurve(b, x), this.blend.alpha);
  }

  accelerationAtSpeed(speed: number): number {
    return this.curve('accelerationDependenceOnSpeed', speed);
  }

  brakingDecelerationAtSpeed(speed: number): number {
    return this.curve('brakingDecelerationDependenceOnSpeed', speed);
  }

  get maxFallingSpeed(): number {
    return this.value('maxFallingSpeed');
  }

  get fallingAcceleration(): number {
    return this.value('fallingAcceleration');
  }

  get fallingBrakingDeceleration(): number {
    return this.value('fallingBrakingDeceleration');
  }

  get fallingBrakingVelocityThreshold(): number {
    return this.value('fallingBrakingVelocityThreshold');
  }

  get frictionVector(): { x: number; y: number } {
    const { alpha } = this.blend;
    return {
      x: lerp(this.a.frictionVector.x, this.b.frictionVector.x, alpha),
      y: lerp(this.a.frictionVector.y, this.b.frictionVector.y, alpha),
    };
  }

  // ---- Step 3 and 4 getters (provider slots, findings step 2 table) ----

  /** Slot +0x20: MaxSpeedDependenceOnDesiredYaw at `angle` degrees. */
  speedFactorForDesiredYaw(angle: number): number {
    return this.curve('maxSpeedDependenceOnDesiredYaw', angle);
  }

  /** Slot +0x28: AccelerationDependenceOnPitch at `pitch` degrees (the
   * callers pass minus the slope angle, findings step 3 items 3 and 9). */
  accelerationAtPitch(pitch: number): number {
    return this.curve('accelerationDependenceOnPitch', pitch);
  }

  /** Slot +0x30: EmergencyDecelerationDependenceOnInputOpposition at the
   * angle (degrees) between the velocity and the input. */
  emergencyDecelerationAtAngle(angle: number): number {
    return this.curve(
      'emergencyDecelerationDependenceOnInputOpposition',
      angle
    );
  }

  /** Slot +0x88: YawRateDependenceOnSpeed at `speed` cm/s. */
  yawRateScaleAtSpeed(speed: number): number {
    return this.curve('yawRateDependenceOnSpeed', speed);
  }

  /** Slot +0x60: min(MaxWalkingSpeed x MovingForcedTurnVelocityMaxSpeedRatio,
   * MovingForcedTurnVelocityThreshold), per tier, then blended. */
  get forcedTurnSpeedThreshold(): number {
    const tier = (t: MovementTier): number =>
      Math.min(
        this.maxWalkingSpeed *
          (t.movingForcedTurnVelocityMaxSpeedRatio ??
            STRUCT_DEFAULTS.movingForcedTurnVelocityMaxSpeedRatio),
        t.movingForcedTurnVelocityThreshold ??
          STRUCT_DEFAULTS.movingForcedTurnVelocityThreshold
      );
    return lerp(tier(this.a), tier(this.b), this.blend.alpha);
  }

  /** Slot +0x68 (deg/s). */
  get movingForcedTurnRate(): number {
    return this.value('movingForcedTurnRate');
  }

  /** Slot +0x70 (cm/s): never exported, the C++ default. */
  get backwardMovementVelocityThreshold(): number {
    return BACKWARD_MOVEMENT_VELOCITY_THRESHOLD;
  }

  /** Slot +0x78 (degrees). */
  get maxAngleToMoveForwards(): number {
    return this.value('maxAngleToMoveForwards');
  }

  /** Slot +0x80 (degrees). */
  get maxAngleToMoveForwardsFalling(): number {
    return this.value('maxAngleToMoveForwardsFalling');
  }

  /** Slot +0xa0. */
  get frictionVelocityCompensationMultiplier(): number {
    return this.value('frictionVelocityCompensationMultiplier');
  }

  /** Slot +0x98: (stiffness, damping) of the mesh spring-damper. */
  get meshRotationStiffnessDamping(): { x: number; y: number } {
    const a = this.a.meshRotationStiffnessDamping;
    const b = this.b.meshRotationStiffnessDamping;
    if (!a || !b)
      throw new Error(
        `${this.type.id}: MeshRotationStiffnessDamping not exported (struct default unknown)`
      );
    const { alpha } = this.blend;
    return { x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha) };
  }

  /**
   * Slot +0xa8: VelocityMultiplierOnWallAngleHit at `angle` degrees, from
   * the curve whose map key is nearest the tier's MaxWalkingSpeed (the
   * chassis MaxSpeed; first in map order on a tie), per tier, then blended
   * (`0x145526cd0`, `0x145526c60`; findings steps 2 and 4).
   */
  wallHitMultiplier(angle: number): number {
    const tier = (t: MovementTier): number => {
      const curves = t.velocityMultiplierOnWallAngleHit;
      if (!curves || curves.length === 0)
        throw new Error(
          `${this.type.id}: VelocityMultiplierOnWallAngleHit not exported (struct default unknown)`
        );
      return evalCurve(nearestWallCurve(curves, this.maxWalkingSpeed), angle);
    };
    return lerp(tier(this.a), tier(this.b), this.blend.alpha);
  }

  /** The wall-hit curve key the chassis uses (for the details list). */
  wallHitCurveKey(): number | null {
    const curves = this.a.velocityMultiplierOnWallAngleHit;
    if (!curves || curves.length === 0) return null;
    return curves.find(
      (c) => c.curve === nearestWallCurve(curves, this.maxWalkingSpeed)
    )!.speed;
  }

  describe(): string {
    const { lower, upper, alpha } = this.blend;
    return lower === upper
      ? `tier ${lower}`
      : `tiers ${lower}-${upper} at ${alpha.toFixed(4)}`;
  }
}
