/**
 * WRF's rules layer (MVP session 3), against the findings' formulas and as
 * behaviour on fixture geometry. Loki's legs at level 13 from the exported
 * data: tiers 3-4 blended at alpha 7/15 (Mobility 52), MaxSpeed 3222.2 cm/s
 * (findings step 2). Each test names its finding; expected numbers say
 * where they come from. Checked against the game later (firing range,
 * session 7).
 */
import { describe, expect, it } from 'vitest';
import {
  dot,
  f32,
  safeNormal2D,
  scale,
  size,
  size2D,
  vec,
  ZERO,
  type Vec3,
} from '../../src/scripts/movement/math/vec';
import { HitResult } from '../../src/scripts/movement/engine/hit';
import {
  applyFriction,
  desiredYaw,
  slopeAngle,
} from '../../src/scripts/movement/rules/ground_velocity';
import { wallHitAngle } from '../../src/scripts/movement/rules/move_along_floor';
import {
  clampAngle,
  fixedTurn,
  normalizeAxis,
  yawOf,
  yawVector,
} from '../../src/scripts/movement/rules/rotator';
import { parseJetpackAirControl } from '../../src/scripts/movement/data/jump_ability';
import {
  FLOOR,
  LOKI,
  lokiOn,
  lokiProperties,
  ramp,
  readTable,
  restingZ,
  settle,
  wall,
} from './support/rules_fixture';

const DT = 1 / 60;
const ALPHA = 7 / 15;
const lerp = (a: number, b: number): number => a + (b - a) * ALPHA;
const LOKI_MAX_SPEED = 3222.2222;

/** Loki standing on the flat floor at the origin, facing +X. */
function standing() {
  const c = lokiOn([FLOOR], vec(0, 0, restingZ(0)));
  settle(c);
  return c;
}

function run(c: ReturnType<typeof standing>, ticks: number, input: Vec3): void {
  for (let i = 0; i < ticks; i++) c.performMovement(DT, input);
}

describe('rotator helpers (UE 5.4.4 Rotator.h, UnrealMath.cpp)', () => {
  it('normalizes and clamps like FRotator and FMath', () => {
    expect(normalizeAxis(190)).toBe(-170);
    expect(normalizeAxis(-180)).toBe(180);
    expect(clampAngle(10, -3, 3)).toBe(3);
    expect(clampAngle(-170, -3, 3)).toBe(-3);
    expect(clampAngle(2, -3, 3)).toBe(2);
    // FixedTurn: the shorter way, at most the rate; result in [0, 360).
    expect(fixedTurn(0, 183, 6)).toBe(354);
    expect(fixedTurn(350, 10, 6)).toBe(356);
    expect(fixedTurn(10, 12, 6)).toBe(12);
  });
});

describe('provider getters for steps 3 and 4 (findings step 2 table)', () => {
  const p = lokiProperties();

  it('picks the wall-hit curve keyed nearest the chassis MaxSpeed', () => {
    // MaxSpeed 3222.2: key 3000 (222 away) beats 3500 (278). UE's float32
    // Eval of the 3000 curve at 45 degrees prints 0.674999952 (09-editor.md
    // 2.5, checks.json); both tiers carry the same curves.
    expect(p.wallHitCurveKey()).toBe(3000);
    expect(f32(p.wallHitMultiplier(45))).toBe(f32(0.674999952));
    expect(f32(p.wallHitMultiplier(0))).toBe(f32(0.35));
    expect(f32(p.wallHitMultiplier(90))).toBe(1);
    // A chassis at 1700 cm/s uses the 1500 curve: 0.9 at 45 (09-editor 2.5).
    const slow = lokiProperties(null, 1700);
    expect(slow.wallHitCurveKey()).toBe(1500);
    expect(slow.wallHitMultiplier(45)).toBeCloseTo(0.9, 6);
  });

  it('derives the forced-turn speed and uses the C++ defaults', () => {
    // min(3222.2 x 0.9, 1700) = 1700 (step 3).
    expect(p.forcedTurnSpeedThreshold).toBe(1700);
    // Not exported for two legs: constructor defaults 360 deg/s and 500
    // cm/s (step 2, `0x14550af9a`, `0x14550af7c`).
    expect(p.movingForcedTurnRate).toBe(360);
    expect(p.backwardMovementVelocityThreshold).toBe(500);
    expect(p.maxAngleToMoveForwards).toBe(110);
  });

  it('blends the step 3 curves between tiers 3 and 4', () => {
    // Emergency deceleration: 0 to 135 degrees, 3000 from 150 (both tiers).
    expect(p.emergencyDecelerationAtAngle(135)).toBe(0);
    expect(p.emergencyDecelerationAtAngle(142.5)).toBeCloseTo(1500, 3);
    expect(p.emergencyDecelerationAtAngle(180)).toBe(3000);
    // Pitch +20 (downhill 20): 270 and 290; -20: -370 and -420 (step 3 table).
    expect(p.accelerationAtPitch(20)).toBeCloseTo(lerp(270, 290), 3);
    expect(p.accelerationAtPitch(-20)).toBeCloseTo(lerp(-370, -420), 3);
    expect(p.accelerationAtPitch(5)).toBe(0);
    // YawRateDependenceOnSpeed: 20 at 200 cm/s; at 3222 tier 3 is 1.1
    // (beyond 2200), tier 4 1.2 (beyond 3000).
    expect(p.yawRateScaleAtSpeed(200)).toBeCloseTo(20, 4);
    expect(p.yawRateScaleAtSpeed(LOKI_MAX_SPEED)).toBeCloseTo(
      lerp(1.1, 1.2),
      4
    );
    expect(p.frictionVelocityCompensationMultiplier).toBeCloseTo(
      lerp(0.25, 0.4),
      6
    );
  });
});

describe('WRF CalcVelocity on the ground (findings step 3)', () => {
  it('walks forwards within 110 degrees of the facing, backwards beyond', () => {
    const c = standing();
    // At rest (|V| <= 500) the facing counts as forwards.
    const fwd = desiredYaw(c, yawVector(100));
    expect(fwd.sign).toBe(1);
    expect(fwd.angle).toBeCloseTo(100, 9);
    // 120 degrees is beyond MaxAngleToMoveForwards: backwards, measured
    // from -facing (120 - 180 = -60).
    const back = desiredYaw(c, yawVector(120));
    expect(back.sign).toBe(-1);
    expect(back.angle).toBeCloseTo(-60, 9);
  });

  it('limits the acceleration swing to RotationRate.Yaw x dt above 1000 cm/s', () => {
    // Step 3 item 2: above CapsuleRotationSpeedThreshold (1000) the input's
    // angle from the facing is clamped to 180 deg/s x dt = 3 degrees.
    const c = standing();
    c.velocity = vec(2000, 0, 0);
    run(c, 1, vec(0, 1, 0));
    // The steered acceleration is 3 degrees from the old facing (+X).
    expect(yawOf(c.acceleration)).toBeCloseTo(3, 4);

    // Below 1000 cm/s it points straight at the input.
    const slow = standing();
    slow.velocity = vec(900, 0, 0);
    run(slow, 1, vec(0, 1, 0));
    expect(yawOf(slow.acceleration)).toBeCloseTo(90, 4);
  });

  it('decelerates hard on opposing input (emergency deceleration)', () => {
    // Step 3 items 6 and 7, input straight back (180 degrees) at 2000 cm/s:
    // -3000 x dt, then the acceleration (steered backwards, |a| =
    // AccelerationDependenceOnSpeed at 2000 after the deceleration... at the
    // start: tiers 300 and 475) x dt against the motion.
    const c = standing();
    c.velocity = vec(2000, 0, 0);
    const accel = c.getMaxAcceleration(); // at 2000 cm/s, ScaleInputAcceleration
    expect(accel).toBeCloseTo(f32(lerp(300, 475)), 3);
    run(c, 1, vec(-1, 0, 0));
    expect(c.velocity.x).toBeCloseTo(2000 - 3000 * DT - accel * DT, 3);
    expect(c.velocity.y).toBeCloseTo(0, 9);
    expect(c.forcedTurn).toBe(false);
  });

  it('applies the sideways friction per world axis, with compensation', () => {
    // Step 3 item 8, FrictionVector (0, 1.8), facing +X: removes
    // 1.8 x dt x (V . right) = 1.8 / 60 x 200 = 6 cm/s sideways.
    const c = standing();
    c.velocity = vec(1000, 200, 0);
    c.acceleration = ZERO;
    applyFriction(c, DT);
    expect(c.velocity.x).toBeCloseTo(1000, 9);
    expect(c.velocity.y).toBeCloseTo(194, 9);

    // Facing 45 degrees: the per-axis weight |r_i| x r_i halves it on each
    // axis (3 cm/s, not 6 / sqrt(2) = 4.24), so the cut is 4.24 cm/s, not 6.
    c.setYaw(45);
    const fwd = yawVector(45);
    const right = yawVector(135);
    c.velocity = vec(
      fwd.x * 1000 + right.x * 200,
      fwd.y * 1000 + right.y * 200,
      0
    );
    const before = c.velocity;
    applyFriction(c, DT);
    expect(before.x - c.velocity.x).toBeCloseTo(-3, 9);
    expect(before.y - c.velocity.y).toBeCloseTo(3, 9);

    // Compensation: + dir2D(a) x |dV_xy| x FrictionVelocityCompensation
    // (0.32 at alpha 7/15), along the acceleration.
    c.setYaw(0);
    c.velocity = vec(1000, 200, 0);
    c.acceleration = vec(3000, 0, 0);
    applyFriction(c, DT);
    expect(c.velocity.x).toBeCloseTo(1000 + 6 * lerp(0.25, 0.4), 9);
    expect(c.velocity.y).toBeCloseTo(194, 9);
  });

  it('starts a forced turn when moving backwards fast and keeps going backwards', () => {
    // Step 3: sign < 0, V . fwd < 0, horizontal speed > 1700. The turn
    // direction is -fwd turned by 3 degrees (yaw 183 = -177); the body
    // turns at MovingForcedTurnRate 360 deg/s, 6 degrees per tick.
    const c = standing();
    c.velocity = vec(-2000, 0, 0);
    run(c, 1, vec(-1, 0, 0));
    expect(c.forcedTurn).toBe(true);
    expect(yawOf(c.forcedTurnDir)).toBeCloseTo(-177, 9);
    expect(c.yaw).toBeCloseTo(-6, 4);
    let ticks = 1;
    while (c.forcedTurn && ticks < 60) {
      run(c, 1, vec(-1, 0, 0));
      ticks++;
    }
    // 177 degrees at 6 per tick: reached on tick 30, ended on the next
    // rotation (31).
    expect(ticks).toBe(31);
    expect(c.yaw).toBeCloseTo(-177, 3);
  });

  it('reaches the chassis MaxSpeed on flat ground and no more', () => {
    const c = standing();
    run(c, 60 * 12, vec(1, 0, 0));
    expect(size2D(c.velocity)).toBeCloseTo(LOKI_MAX_SPEED, 3);
  });

  it('measures the slope and adds the downhill top-speed bonus', () => {
    // Step 3 items 3 and 9 on a 20-degree ramp: walking down it, s = -20,
    // so GetMaxSpeed = MaxSpeed + AccelerationDependenceOnPitch(20).
    const rise = Math.tan((20 * Math.PI) / 180) * 20000;
    const c = lokiOn(
      [FLOOR, ramp(-20000, 0, -5000, 5000, rise, 0, -1000)],
      vec(-12000, 0, restingZ(rise * 0.6) + 300)
    );
    settle(c, 1);
    expect(c.movementMode).toBe('walking');
    c.velocity = vec(1500, 0, 0);
    c.lastUpdateVelocity = c.velocity;
    expect(slopeAngle(c)).toBeCloseTo(-20, 3);
    expect(c.getMaxSpeed()).toBeCloseTo(
      f32(LOKI_MAX_SPEED + lerp(270, 290)),
      2
    );
    // Uphill: no bonus (max(0, ...)).
    c.velocity = vec(-1500, 0, 0);
    c.lastUpdateVelocity = c.velocity;
    expect(slopeAngle(c)).toBeCloseTo(20, 3);
    expect(c.getMaxSpeed()).toBeCloseTo(f32(LOKI_MAX_SPEED), 2);
  });

  it('brakes with BrakingDecelerationDependenceOnSpeed and friction 0', () => {
    // Step 3 item 10: no input at 1000 cm/s loses the braking curve's value
    // x dt (tiers: 1087.9 -> 1178.3 at 1000 is 1178.3 + ..., read from the
    // provider) and keeps its direction.
    const c = standing();
    c.velocity = vec(1000, 0, 0);
    const decel = c.getMaxBrakingDeceleration();
    run(c, 1, ZERO);
    expect(c.velocity.x).toBeCloseTo(1000 - decel * DT, 3);
  });
});

describe('body rotation (findings step 3)', () => {
  it('turns at 180 deg/s at top speed with a 90-degree input change', () => {
    // The steering keeps the acceleration within 3 degrees per tick of the
    // facing, and the body turns at 180 x YawRateDependenceOnSpeed (1.147)
    // toward it: it follows at exactly 3 degrees per tick (180 deg/s).
    const c = standing();
    c.velocity = vec(LOKI_MAX_SPEED, 0, 0);
    run(c, 10, vec(0, 1, 0));
    expect(c.yaw).toBeCloseTo(30, 3);
  });

  it('turns effectively at once below 200 cm/s', () => {
    // YawRateDependenceOnSpeed is 20 at or below 200 cm/s: 3600 deg/s, so
    // 60 degrees per tick.
    const c = standing();
    run(c, 1, vec(0, 1, 0));
    expect(c.yaw).toBeCloseTo(60, 3);
    run(c, 1, vec(0, 1, 0));
    expect(c.yaw).toBeCloseTo(90, 3);
  });

  it('walks backwards facing away from the input', () => {
    const c = standing();
    run(c, 30, vec(-1, 0, 0));
    expect(c.yaw).toBeCloseTo(0, 6);
    expect(c.velocity.x).toBeLessThan(0);
  });

  it('keeps its facing with no input, and faces the velocity in the air', () => {
    const c = standing();
    c.setYaw(40);
    run(c, 5, ZERO);
    expect(c.yaw).toBe(40);
    const air = lokiOn([FLOOR], vec(0, 0, 5000));
    air.velocity = vec(0, -1000, 0);
    air.performMovement(DT, ZERO);
    expect(air.isFalling()).toBe(true);
    // No rate scaling in the air: 180 x dt = 3 degrees toward -90.
    expect(air.yaw).toBeCloseTo(-3, 4);
  });
});

describe('WRF MoveAlongFloor: the wall-hit slowdown (findings step 4)', () => {
  /**
   * Loki at top speed along +X into a long flat wall whose normal is
   * `angle` degrees from head-on. Curve key 3000: 0.35 + 0.65 x angle / 90.
   * Expected speed after the hit: 3222.2 x that (below the entry speed).
   *   30 degrees: x 0.5667 -> 1826.0 cm/s
   *   45 degrees: x 0.675  -> 2175.0 cm/s
   *   60 degrees: x 0.7833 -> 2524.1 cm/s
   * Firing-range W1 confirms these.
   */
  it.each([30, 45, 60])('slows by the curve at %i degrees', (angle) => {
    const c = lokiOn(
      [FLOOR, wall([4000, 0, 0], 40000, 400, 3000, 90 - angle)],
      vec(0, 0, restingZ(0))
    );
    settle(c);
    c.velocity = vec(LOKI_MAX_SPEED, 0, 0);
    let ticks = 0;
    while (!c.lastWallHit && ticks < 200) {
      run(c, 1, vec(1, 0, 0));
      ticks++;
    }
    const hit = c.lastWallHit!;
    expect(hit).not.toBeNull();
    expect(hit.angle).toBeCloseTo(angle, 6);
    const mul = f32(0.35 + (0.65 * angle) / 90);
    expect(hit.multiplier).toBeCloseTo(mul, 6);
    expect(hit.speedAfter).toBeCloseTo(f32(f32(LOKI_MAX_SPEED) * mul), 2);
    // bJustTeleported: the slowed velocity survives PhysWalking
    // (09-editor.md 2.1), pointed along the capsule's actual move.
    expect(size2D(c.velocity)).toBe(hit.speedAfter);
    expect(dot(safeNormal2D(c.velocity), hit.direction)).toBeCloseTo(1, 12);
    expect(c.velocity.z).toBe(0);
    // The capsule snapped to the move's direction; PhysicsRotation then
    // turns at most 180 x YawRateDependenceOnSpeed x dt back toward the
    // steered input. The turned yaw is float32: allow one ulp at 32 to 64
    // degrees (2^-18 = 3.8e-6). Since session 3.5 the 30-degree hit takes
    // UE's StepUp branch first (Chaos's parallel-contact impact point).
    const allowance =
      180 * DT * c.properties.yawRateScaleAtSpeed(size(c.velocity)) + 2 ** -18;
    expect(
      Math.abs(normalizeAxis(c.yaw - yawOf(hit.direction)))
    ).toBeLessThanOrEqual(allowance);
    // The move kept going forwards, and turned away from head-on.
    expect(hit.direction.x).toBeGreaterThan(0);
    expect(Math.abs(yawOf(hit.direction))).toBeGreaterThan(1);
  });

  it('measures the angle from Hit.Normal and the entry velocity', () => {
    expect(wallHitAngle(vec(1000, 0, 0), vec(-1, 0, 0))).toBeCloseTo(0, 9);
    expect(wallHitAngle(vec(1000, 0, 0), yawVector(180 - 45))).toBeCloseTo(
      45,
      9
    );
    expect(wallHitAngle(vec(1000, 0, 0), vec(0, 1, 0))).toBeCloseTo(90, 9);
  });

  it('does not slow when the input does not push along the velocity', () => {
    // Gate: input . V > 0 (`0x1455978be`).
    const c = lokiOn(
      [FLOOR, wall([3000, 0, 0], 40000, 400, 3000, 90 - 45)],
      vec(0, 0, restingZ(0))
    );
    settle(c);
    c.velocity = vec(LOKI_MAX_SPEED, 0, 0);
    for (let i = 0; i < 120 && !c.lastWallHit; i++) c.performMovement(DT, ZERO);
    expect(c.lastWallHit).toBeNull();
  });

  it('saves the first sweep hit, which gates the desired-yaw factor', () => {
    // Landing saved the floor hit (falling records every move's hit); a
    // walking move on open ground saves its first sweep, which hits nothing.
    const c = standing();
    expect(c.lastMoveHit!.blockingHit).toBe(true);
    run(c, 1, vec(1, 0, 0));
    expect(c.lastMoveHit!.blockingHit).toBe(false);
  });
});

describe('falling (findings steps 4 and 5)', () => {
  it("keeps the input's length when making it horizontal", () => {
    const c = lokiOn([FLOOR], vec(0, 0, 5000));
    expect(c.isFalling()).toBe(true);
    const v = c.constrainInputAcceleration(vec(0.6, 0, 0.8));
    expect(v.x).toBeCloseTo(1, 12);
    expect(v.z).toBe(0);
  });

  it("takes air control from the chassis's Jump Jet entry", () => {
    // Every two-legged Jump Jet: bOverrideAirControl, 0.5, 0.75, 1000.
    const air = parseJetpackAirControl(
      readTable('Ability'),
      readTable('CharacterModule'),
      LOKI
    );
    expect(air).toMatchObject({
      overrideAirControl: true,
      airControl: 0.5,
      airControlBoostMultiplier: 0.75,
      airControlBoostVelocityThreshold: 1000,
    });
    // 09-editor.md 2.4: 0.375 strictly below 1000 cm/s, 0.5 from 1000,
    // times FallingAcceleration 3500 (step 4).
    const c = lokiOn([FLOOR], vec(0, 0, 50000));
    c.acceleration = vec(3500, 0, 0);
    c.velocity = vec(999, 0, 0);
    expect(c.getFallingLateralAcceleration(DT).x).toBeCloseTo(0.375 * 3500, 3);
    c.velocity = vec(1000, 0, 0);
    expect(c.getFallingLateralAcceleration(DT).x).toBeCloseTo(0.5 * 3500, 3);
  });

  it('blocks air control and air braking while AirControlBlockers holds', () => {
    const c = lokiOn([FLOOR], vec(0, 0, 50000));
    c.acceleration = vec(3500, 0, 0);
    c.velocity = vec(3000, 0, 0);
    expect(c.getMaxBrakingDeceleration()).toBeCloseTo(350, 3);
    c.airControlBlockers.add('dash');
    expect(c.getFallingLateralAcceleration(DT)).toEqual(ZERO);
    expect(c.getMaxBrakingDeceleration()).toBe(0);
  });

  it('refuses to land while WalkingModeBlockers holds', () => {
    const c = lokiOn([FLOOR], vec(0, 0, restingZ(0) + 50));
    c.walkingModeBlockers.add('test');
    settle(c, 1);
    expect(c.isFalling()).toBe(true);
    c.walkingModeBlockers.remove('test');
    settle(c, 0.2);
    expect(c.isMovingOnGround()).toBe(true);
  });

  it('slides along a hit plane by plain projection in the air', () => {
    // WRF ComputeSlideVector (step 4): (D - N (D . N)) x t, no slope-boost
    // guard; on the ground the stock direction at the full length |D| x t.
    const c = lokiOn([FLOOR], vec(0, 0, 50000));
    const up = c.computeSlideVector(
      vec(100, 0, 0),
      0.5,
      vec(-Math.SQRT1_2, 0, Math.SQRT1_2),
      new HitResult()
    );
    expect(up.x).toBeCloseTo(25, 9);
    expect(up.z).toBeCloseTo(25, 9);
    const g = standing();
    const slide = g.computeSlideVector(
      vec(100, 0, 0),
      0.5,
      vec(-Math.SQRT1_2, Math.SQRT1_2, 0),
      new HitResult()
    );
    expect(size(slide)).toBeCloseTo(50, 9);
    expect(
      dot(slide, scale(vec(-Math.SQRT1_2, Math.SQRT1_2, 0), 1))
    ).toBeCloseTo(0, 9);
  });
});

describe('input blockers (findings step 1)', () => {
  it('keeps the previous input on the ground while MovementInputBlockers holds', () => {
    const c = standing();
    run(c, 1, vec(1, 0, 0));
    c.movementInputBlockers.add('test');
    run(c, 1, ZERO);
    expect(c.consumedInput).toEqual(vec(1, 0, 0));
    expect(c.velocity.x).toBeGreaterThan(0);
  });
});
