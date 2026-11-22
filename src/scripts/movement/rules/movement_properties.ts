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
    const a = this.a[field];
    const b = this.b[field];
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

  describe(): string {
    const { lower, upper, alpha } = this.blend;
    return lower === upper
      ? `tier ${lower}`
      : `tiers ${lower}-${upper} at ${alpha.toFixed(4)}`;
  }
}
