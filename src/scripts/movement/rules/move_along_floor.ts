/**
 * WRF's MoveAlongFloor (`0x1455969e0`) for two-legged robots, from
 * `findings/step-4-falling-collisions.md` "Walking into walls". The stock
 * skeleton (UE 5.4.4 MoveAlongFloor: ramp re-move, CanStepUp / StepUp,
 * SlideAlongSurface) plus:
 *
 * - the first sweep's hit is saved (+0x1d28) for the slowdown and for
 *   CalcVelocity's desired-yaw gate;
 * - after the move, the wall-hit slowdown: the speed is capped at
 *   MaxWalkingSpeed x VelocityMultiplierOnWallAngleHit(angle), pointed
 *   along the horizontal direction the capsule actually moved, and kept
 *   (bJustTeleported);
 * - the capsule snaps to face that direction (outside a forced turn).
 *
 * The cvar `Movement.DefaultMoveAlongFloor` (default false; no cooked
 * config sets it) would switch back to stock; it is not modelled.
 */
import {
  dot,
  f32,
  KINDA_SMALL_NUMBER,
  planeProject,
  safeNormal2D,
  scale,
  size2D,
  sizeSquared2D,
  sub,
  UP,
  vec,
  withZ,
  type Vec3,
} from '../math/vec';
import { HitResult } from '../engine/hit';
import type { StepDownResult } from '../engine/character_movement';
import { yawOf } from './rotator';
import type { TunedCharacterMovement } from './tuned_movement';

const GRAVITY_DIR = vec(0, 0, -1);
const DEG = 180 / Math.PI;

/** The "did not step up" gate: the foot moved more than this vertically
 * across the step-up branch (`0x145597733`-`0x145597784`; the constant is
 * from the decompile, findings step 4 Unknowns). */
export const STEP_UP_DELTA_Z = 1;

/** What the last wall hit did, for tests and the details list. */
export interface WallHit {
  /** 0 head-on, 90 grazing. */
  angle: number;
  multiplier: number;
  speedBefore: number;
  speedAfter: number;
  /** Horizontal direction moved (the new velocity's direction). */
  direction: Vec3;
}

/** The hit angle: |acos(-(dir2D(V) . dir2D(Hit.Normal)))| in degrees. */
export function wallHitAngle(velocity: Vec3, hitNormal: Vec3): number {
  const c = -dot(safeNormal2D(velocity), safeNormal2D(hitNormal));
  return Math.abs(Math.acos(Math.min(Math.max(c, -1), 1)) * DEG);
}

export function moveAlongFloor(
  c: TunedCharacterMovement,
  inVelocity: Vec3,
  deltaSeconds: number,
  outStepDown: StepDownResult | null
): void {
  if (!c.currentFloor.isWalkableFloor()) return;

  // Entry state: the velocity the move starts with (+0xc0) and the location.
  const startVelocity = c.velocity;
  const entryLocation = c.location;
  let stepped = false;

  const delta = scale(withZ(inVelocity, 0), deltaSeconds);
  const hit = new HitResult(1);
  let rampVector = c.computeGroundMovementDelta(
    delta,
    c.currentFloor.hitResult,
    c.currentFloor.lineTrace
  );
  c.safeMoveUpdatedComponent(rampVector, hit);
  // Two legs: the first sweep's hit is the saved hit.
  c.lastMoveHit = hit.clone();

  if (hit.startPenetrating) {
    c.slideAlongSurface(delta, 1, hit.normal, hit, true);
    if (hit.startPenetrating) c.justTeleported = true;
  } else if (hit.isValidBlockingHit()) {
    let percentTimeApplied = hit.time;
    if (
      hit.time > 0 &&
      hit.normal.z > KINDA_SMALL_NUMBER &&
      c.isWalkable(hit)
    ) {
      const initialPercentRemaining = f32(1 - percentTimeApplied);
      rampVector = c.computeGroundMovementDelta(
        scale(delta, initialPercentRemaining),
        hit,
        false
      );
      c.safeMoveUpdatedComponent(rampVector, hit);
      const secondHitPercent = f32(hit.time * initialPercentRemaining);
      percentTimeApplied = Math.min(
        Math.max(f32(percentTimeApplied + secondHitPercent), 0),
        1
      );
    }

    if (hit.isValidBlockingHit() && c.canStepUp(hit)) {
      const preStepUpLocation = c.location;
      const footZBefore = preStepUpLocation.z - c.capsule.halfHeight;
      if (
        !c.stepUp(
          GRAVITY_DIR,
          scale(delta, f32(1 - percentTimeApplied)),
          hit,
          outStepDown
        )
      ) {
        c.slideAlongSurface(
          delta,
          f32(1 - percentTimeApplied),
          hit.normal,
          hit,
          true
        );
      } else if (!c.params.maintainHorizontalGroundVelocity) {
        c.justTeleported = true;
        // float StepUpTimeSlice = (1.f - PercentTimeApplied) * DeltaSeconds.
        const stepUpTimeSlice = f32(f32(1 - percentTimeApplied) * deltaSeconds);
        if (stepUpTimeSlice >= KINDA_SMALL_NUMBER) {
          c.velocity = planeProject(
            scale(sub(c.location, preStepUpLocation), 1 / stepUpTimeSlice),
            UP
          );
        }
      }
      const footZAfter = c.location.z - c.capsule.halfHeight;
      stepped = Math.abs(footZAfter - footZBefore) > STEP_UP_DELTA_Z;
    }
  }

  applyWallHitSlowdown(c, startVelocity, entryLocation, stepped);
}

/** The wall-hit slowdown after the move (gate `0x1455978be`-`0x1455978f5`,
 * walkable test `0x14559793a`, write `0x14559856d`). */
function applyWallHitSlowdown(
  c: TunedCharacterMovement,
  startVelocity: Vec3,
  entryLocation: Vec3,
  stepped: boolean
): void {
  const saved = c.lastMoveHit;
  const displacement = sub(c.location, entryLocation);
  if (
    !saved ||
    !saved.isValidBlockingHit() ||
    dot(c.consumedInput, startVelocity) <= 0 ||
    saved.normal.z > c.params.walkableFloorZ ||
    stepped ||
    sizeSquared2D(displacement) <= 1e-8 * 1e-8
  )
    return;
  // (|displacement_xy| > 1e-8, in the finding: compared squared here.)
  const angle = wallHitAngle(startVelocity, saved.normal);
  const multiplier = f32(c.properties.wallHitMultiplier(angle));
  const maxWalkingSpeed = f32(c.properties.maxWalkingSpeed);
  const speedBefore = size2D(startVelocity);
  const speed = Math.max(
    0,
    Math.min(speedBefore, f32(maxWalkingSpeed * multiplier))
  );
  const d = safeNormal2D(displacement);
  c.velocity = scale(d, speed);
  c.justTeleported = true;
  c.lastWallHit = {
    angle,
    multiplier,
    speedBefore,
    speedAfter: speed,
    direction: d,
  };
  // Snap the capsule to face the slide (SafeMoveUpdatedComponent with a
  // zero delta and no sweep: sets the rotation only, 09-editor.md 2.2).
  if (!c.forcedTurn) c.setYaw(yawOf(d));
}
