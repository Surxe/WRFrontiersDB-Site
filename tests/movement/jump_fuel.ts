/**
 * The Jump Jet and fuel (MVP session 4), against findings step 5's
 * per-update pseudocode and 11-mvp-readiness.md section 3's expected values
 * (J1, F1, F2), on Loki from the exported data. Force timing against
 * 09-editor.md 2.3 (UE 5.4.4, measured headless). Each test names its
 * source; the firing range checks the game later (session 7).
 */
import { describe, expect, it } from 'vitest';
import { f32, vec, ZERO } from '../../src/scripts/movement/math/vec';
import { evalCurve } from '../../src/scripts/movement/data/rich_curve';
import { parseChassisLevel } from '../../src/scripts/movement/data/chassis_level';
import { parseFuelResource } from '../../src/scripts/movement/data/character';
import {
  JETPACK_CPP_DEFAULTS,
  parseJetpack,
} from '../../src/scripts/movement/data/jump_ability';
import { GameplayResource } from '../../src/scripts/movement/rules/fuel';
import { JETPACK_HOLDER } from '../../src/scripts/movement/rules/abilities/jetpack';
import type { RobotCharacter } from '../../src/scripts/movement/rules/robot_character';
import {
  box,
  FLOOR,
  LOKI,
  lokiOn,
  lokiRobot,
  readTable,
  restingZ,
} from './support/rules_fixture';

const DT = 1 / 60;
const STILL = vec(0, 0, 0);
const TWO_LEGS = 'DA_MovementType_TwoLegs_Agile.6';

/** Loki standing on the flat floor, settled, fuel full. */
function standing(options: Parameters<typeof lokiRobot>[2] = {}) {
  const r = lokiRobot([FLOOR], vec(0, 0, restingZ(0)), options);
  idle(r, 40);
  return r;
}

function idle(r: RobotCharacter, ticks: number): void {
  for (let i = 0; i < ticks; i++) r.update(DT, STILL, { jump: false });
}

function hold(r: RobotCharacter, ticks: number, jump = true): void {
  for (let i = 0; i < ticks; i++) r.update(DT, STILL, { jump });
}

/** The two-legged chassis of the MVP: the movement type's 39 minus
 * Kernel, four-legged in game (stages/mvp.md). */
function twoLeggedChassis(): string[] {
  const table = readTable('CharacterModule') as Record<
    string,
    { movement_type_ref?: string }
  >;
  return Object.entries(table)
    .filter(([, c]) => c.movement_type_ref?.endsWith(TWO_LEGS))
    .map(([id]) => id)
    .filter((id) => !id.includes('Kernel'));
}

/**
 * Hold or tap jump from standing; times from takeoff (the update Jump
 * starts) to the first walking update, and to Fly cutting out.
 */
function flight(
  holdTicks: number,
  options: Parameters<typeof lokiRobot>[2] = {}
) {
  const r = standing(options);
  let takeoff = -1;
  let poweredEnd = -1;
  for (let i = 1; i <= 1500; i++) {
    const before = r.jetpack.state;
    r.update(DT, STILL, { jump: i <= holdTicks });
    if (takeoff < 0 && r.jetpack.state === 'jump') takeoff = i;
    // The first cut: held on, Fly restarts once regeneration reaches
    // FuelCostToStartAirborne again (2.5 s later).
    if (poweredEnd < 0 && before === 'fly' && r.jetpack.state === 'inactive')
      poweredEnd = i;
    if (takeoff >= 0 && r.movement.isMovingOnGround())
      return {
        airtime: (i - takeoff) * DT,
        powered: poweredEnd < 0 ? null : (poweredEnd - takeoff) * DT,
        robot: r,
      };
  }
  throw new Error('never landed');
}

describe('Jump Jet data (Ability.json, findings step 5 table)', () => {
  it('every two-legged chassis has the same Jump Jet, Demeter its own Fly curve', () => {
    const chassis = twoLeggedChassis();
    expect(chassis).toHaveLength(38);
    for (const id of chassis) {
      const j = parseJetpack(
        readTable('Ability'),
        readTable('CharacterModule'),
        id
      );
      expect(j.defaulted, id).toEqual([]);
      expect(j.jumpFuelCost).toBe(2);
      expect(j.fuelCostToStartAirborne).toBe(2);
      expect(j.jumpTime).toBe(1.1);
      expect(j.fuelUsagePerSecond).toBe(6);
      expect(j.jetpackJumpAccelerationForce).toBe(280000);
      expect(j.jetpackStartVerticalImpulse).toBe(0);
      expect(j.jetpackMaxVerticalSpeed).toBe(3000000);
      expect(j.jumpMovementMode).toBe('falling');
      expect(j.airControl).toMatchObject({
        airControl: 0.5,
        airControlBoostMultiplier: 0.75,
        airControlBoostVelocityThreshold: 1000,
      });
      const curve = j.verticalAccelerationForceCurve!;
      if (id.includes('Demeter')) {
        expect(evalCurve(curve, 0)).toBe(80000);
        expect(evalCurve(curve, 0.1)).toBe(20000);
      } else {
        expect(evalCurve(curve, -500)).toBe(140000);
        expect(evalCurve(curve, 0.1)).toBe(70000);
        expect(evalCurve(curve, 1200)).toBe(15000);
        expect(evalCurve(curve, 3000)).toBe(0);
        // UE's float32 value at 600 cm/s (09-editor.md 2.5).
        expect(evalCurve(curve, 600)).toBeCloseTo(42502.29, 2);
      }
      // The data's 15 s cooldown is loaded, not applied (D16).
      expect(j.cooldown).toEqual({
        seconds: 15,
        policy: 'StartCooldownAfterEnd',
      });
    }
  });

  it('fills an absent field from the C++ constructor and rejects MOVE_Flying', () => {
    const abilities = {
      X: { misc: { JumpTime: 0.5, JumpMovementMode: 'MOVE_Falling' } },
    };
    const modules = { C: { abilities_refs: ['OBJID_Ability::X'] } };
    const j = parseJetpack(abilities, modules, 'C');
    expect(j.jumpTime).toBe(0.5);
    expect(j.jumpFuelCost).toBe(JETPACK_CPP_DEFAULTS.JumpFuelCost);
    expect(j.verticalAccelerationForceCurve).toBeNull();
    expect(j.defaulted).toContain('VerticalAccelerationForceCurve');
    expect(() =>
      parseJetpack({ X: { misc: { JumpTime: 0.5 } } }, modules, 'C')
    ).toThrow(/MOVE_Flying is not ported/);
  });

  it('fuel: BP_Character 16 at 0.8/s; the chassis FuelCapacity is only shown (D21)', () => {
    expect(parseFuelResource(readTable('Character'))).toMatchObject({
      MaxValue: 16,
      RegenPerSecond: 0.8,
    });
    const modules = readTable('Module');
    // The F1 chassis (11-mvp-readiness.md section 3) and Loki.
    expect(parseChassisLevel(modules, LOKI, 13).fuelCapacity).toBe(17);
    expect(
      parseChassisLevel(modules, 'BP_Module_Wyrm_Chassis.0', 13).fuelCapacity
    ).toBe(12);
    expect(
      parseChassisLevel(modules, 'BP_Module_Siren_Chassis.0', 13).fuelCapacity
    ).toBe(30);
  });
});

describe('fuel resource (findings step 5, 0x14567cd90 and 0x14568de30)', () => {
  it('starts full, clamps at 0 and the maximum, regenerates unless blocked', () => {
    const fuel = new GameplayResource(16, 0.8);
    expect(fuel.value).toBe(16);
    fuel.add(-20);
    expect(fuel.value).toBe(0);
    fuel.add(40);
    expect(fuel.value).toBe(16);
    expect(fuel.maxValue).toBe(16);
    fuel.add(-10);
    fuel.regenerate(1);
    expect(fuel.value).toBe(f32(6.8));
    fuel.regenBlockers.add('dash');
    fuel.regenerate(1);
    expect(fuel.value).toBe(f32(6.8));
    fuel.regenBlockers.remove('dash');
    fuel.regenerate(100);
    expect(fuel.value).toBe(16);
    // bAdjustMax (only a pilot talent passes it).
    fuel.add(2, true);
    expect([fuel.maxValue, fuel.value]).toEqual([18, 18]);
  });

  it('F2: refills from empty in 16 / 0.8 = 20 s', () => {
    const r = standing();
    r.fuel.add(-16);
    let ticks = 0;
    while (r.fuel.value < r.fuel.maxValue) {
      idle(r, 1);
      ticks++;
    }
    // 1200 updates of 1/60 s, give or take float32 rounding of the sum.
    expect(Math.abs(ticks - 1200)).toBeLessThanOrEqual(1);
  });
});

describe('forces (stock AddForce / ApplyAccumulatedForces, 09-editor.md 2.3)', () => {
  it('a force requested at the end of PerformMovement lands next update, with its dt', () => {
    const c = lokiOn([], vec(0, 0, 100000));
    c.params.gravityScale = 0;
    let once = true;
    c.onMovementUpdated = () => {
      if (!once) return;
      once = false;
      c.addForce(vec(0, 0, 10000));
      c.addImpulse(vec(0, 5000, 0), false);
      c.addImpulse(vec(300, 0, 0), true);
    };
    c.performMovement(1 / 60, ZERO);
    expect(c.velocity).toEqual(ZERO);
    expect(c.pendingForceToApply).toEqual(vec(0, 0, 100));
    expect(c.pendingImpulseToApply).toEqual(vec(300, 50, 0));
    c.performMovement(1 / 30, ZERO);
    expect(c.velocity.x).toBe(300);
    expect(c.velocity.y).toBe(50);
    expect(c.velocity.z).toBeCloseTo(100 * f32(1 / 30), 9);
    expect(c.pendingForceToApply).toEqual(ZERO);
  });

  it('walking turns to falling only when the push beats gravity (scale 1.2: 1680)', () => {
    for (const [up, falls] of [
      [1600, false],
      [1700, true],
    ] as const) {
      const r = standing();
      const c = r.movement;
      c.addForce(vec(0, 0, up * c.params.mass));
      idle(r, 1);
      expect(c.isFalling(), `${up} cm/s2`).toBe(falls);
    }
  });
});

describe('Jump Jet states (findings step 5 pseudocode)', () => {
  it('a ground press starts Jump: cost 2, falling, no landing, no regen, gravity untouched', () => {
    const r = standing();
    const c = r.movement;
    hold(r, 1);
    expect(r.jetpack.state).toBe('jump');
    expect(r.fuel.value).toBe(14);
    expect(c.movementMode).toBe('falling');
    expect(c.walkingModeBlockers.list()).toEqual([JETPACK_HOLDER]);
    expect(r.fuel.regenBlockers.list()).toEqual([JETPACK_HOLDER]);
    expect(c.params.gravityScale).toBe(f32(1.2));
    expect(r.jetpack.jumpTimeRemaining).toBe(f32(1.1));
    // The Jump's own tick (first thrust) runs from the next update.
    expect(c.pendingForceToApply).toEqual(ZERO);
    hold(r, 1, false);
    // 280000 / Mass 100 = 2800 cm/s^2, queued for the next update.
    expect(c.pendingForceToApply.z).toBeCloseTo(2800, 6);
    expect(c.isValidLandingSpot(c.location, c.currentFloor.hitResult)).toBe(
      false
    );
  });

  it('releasing does not stop Jump; it lasts JumpTime and its exit writes gravity scale 1.0', () => {
    const r = standing();
    hold(r, 1);
    let thrustTicks = 0;
    while (r.jetpack.state === 'jump') {
      hold(r, 1, false);
      if (r.jetpack.lastThrust > 0) {
        thrustTicks++;
        expect(r.jetpack.lastThrust).toBeCloseTo(2800, 6);
      }
    }
    // 1.1 s of thrust at 1/60 s; the float32 remainder then costs one
    // update without thrust before the exit.
    expect(thrustTicks).toBe(66);
    expect(r.jetpack.state).toBe('inactive');
    expect(r.jetpack.gravityWriter).toBe('Jump exit');
    expect(r.movement.params.gravityScale).toBe(1);
    expect(r.movement.walkingModeBlockers.active).toBe(false);
    expect(r.fuel.regenBlockers.active).toBe(false);
  });

  it('holding on continues as Fly: gravity scale 0, the curve over vz, 6 fuel/s', () => {
    const r = standing();
    hold(r, 1);
    while (r.jetpack.state !== 'fly') hold(r, 1);
    expect(r.movement.params.gravityScale).toBe(0);
    expect(r.jetpack.gravityWriter).toBe('Fly enter');
    const curve = r.jetpack.data.verticalAccelerationForceCurve!;
    const before = r.fuel.value;
    hold(r, 1);
    const c = r.movement;
    expect(r.fuel.value).toBe(f32(before - f32(6 * f32(DT))));
    // The request is the curve at the vertical speed (nothing queued).
    expect(r.jetpack.lastThrust).toBeCloseTo(
      evalCurve(curve, c.velocity.z) / 100,
      6
    );
    expect(c.pendingForceToApply.z).toBeCloseTo(r.jetpack.lastThrust, 6);
    // Releasing ends Fly at once; the exit writes 1.0.
    hold(r, 1, false);
    expect(r.jetpack.state).toBe('inactive');
    expect(c.params.gravityScale).toBe(1);
    expect(r.jetpack.gravityWriter).toBe('Fly exit');
  });

  it('Fly ends at fuel 0, its last update thrusting with the fraction left', () => {
    const r = standing();
    hold(r, 1);
    while (r.jetpack.state !== 'fly') hold(r, 1);
    r.fuel.add(-(r.fuel.value - 0.05));
    hold(r, 1);
    expect(r.fuel.value).toBe(0);
    expect(r.jetpack.state).toBe('inactive');
    const vz = r.movement.velocity.z;
    const full =
      evalCurve(r.jetpack.data.verticalAccelerationForceCurve!, vz) / 100;
    // frac = 0.05 / 0.1.
    expect(r.jetpack.lastThrust / full).toBeCloseTo(0.5, 5);
  });

  it('falling without a jump, held input starts Fly from FuelCostToStartAirborne, not deducted', () => {
    const r = lokiRobot([FLOOR], vec(0, 0, 5000));
    idle(r, 2);
    expect(r.movement.isFalling()).toBe(true);
    hold(r, 1);
    expect(r.jetpack.state).toBe('fly');
    expect(r.fuel.value).toBe(16);
    // Below the threshold nothing starts.
    const low = lokiRobot([FLOOR], vec(0, 0, 5000));
    low.fuel.add(-14.5);
    hold(low, 1);
    expect(low.jetpack.state).toBe('inactive');
  });

  it('a ground jump needs JumpFuelCost; the check reads the previous update', () => {
    const r = standing();
    r.fuel.add(-14.1); // 1.9 left
    idle(r, 1);
    hold(r, 1);
    expect(r.jetpack.state).toBe('inactive');
    r.fuel.add(0.2);
    // "Enough fuel" is refreshed after the state tick: one update late.
    hold(r, 1);
    expect(r.jetpack.state).toBe('inactive');
    hold(r, 1);
    expect(r.jetpack.state).toBe('jump');
  });

  it('held through a long fall, Fly restarts whenever fuel regenerates to 2', () => {
    const r = lokiRobot([FLOOR], vec(0, 0, 2000000));
    idle(r, 2);
    const states: string[] = [];
    for (let i = 0; i < 60 * 6; i++) {
      hold(r, 1);
      if (states[states.length - 1] !== r.jetpack.state)
        states.push(r.jetpack.state);
    }
    // 16 fuel lasts 16 / 6 s; 2 / 0.8 = 2.5 s of regeneration; 2 more
    // lasts 1 / 3 s (5.5 s in all).
    expect(states).toEqual(['fly', 'inactive', 'fly', 'inactive']);
  });

  it('no cooldown: a second jump right after landing (D16)', () => {
    const { robot: r } = flight(1);
    expect(r.jetpack.state).toBe('inactive');
    hold(r, 2);
    expect(r.jetpack.state).toBe('jump');
  });

  it('no landing while active: a held Jump lifts off a ledge and over a block', () => {
    // Jump straight into a 300 cm block's top edge region: the capsule
    // passes floors it would land on while Inactive.
    const r = lokiRobot(
      [FLOOR, box([-5000, 700, 0], [5000, 5000, 300])],
      vec(0, 0, restingZ(0))
    );
    idle(r, 40);
    hold(r, 30);
    expect(r.movement.isFalling()).toBe(true);
    expect(r.movement.walkingModeBlockers.active).toBe(true);
  });

  it('respawn is a new robot: full fuel, Inactive, BP_Character gravity scale', () => {
    const r = standing();
    hold(r, 100);
    expect(r.movement.params.gravityScale).not.toBe(f32(1.2));
    r.respawn(vec(0, 0, restingZ(0)));
    expect(r.jetpack.state).toBe('inactive');
    expect(r.fuel.value).toBe(16);
    expect(r.movement.params.gravityScale).toBe(f32(1.2));
    expect(r.movement.walkingModeBlockers.active).toBe(false);
    expect(r.movement.pendingForceToApply).toEqual(ZERO);
  });
});

/**
 * 11-mvp-readiness.md section 3. Its expected values are continuous-time
 * sums; the update loop adds whole frames:
 * - J1 (tap): within one 1/60 s frame of 3.30 s (scale 1.2 before the
 *   jump) and 3.76 s (1.0 throughout);
 * - F1 (hold until empty): 1.1 + (C - 2) / 6 s plus 4 updates at 60 fps:
 *   the Jump's entry (its tick starts next update), the float32 remainder
 *   of JumpTime, the Jump exit to Inactive, and Fly's entry. Session R
 *   compares recordings with these frame-exact values, not the sum.
 */
describe('airtime and fuel tables (11-mvp-readiness.md section 3)', () => {
  it('J1: tap airtime 3.30 s at scale 1.2 before the jump, 3.76 s at 1.0', () => {
    expect(flight(1).airtime).toBeCloseTo(3.3, 1);
    expect(Math.abs(flight(1).airtime - 3.3)).toBeLessThanOrEqual(DT + 1e-9);
    const scale1 = flight(1, { gravityScale: 1 }).airtime;
    expect(Math.abs(scale1 - 3.756)).toBeLessThanOrEqual(DT + 1e-9);
  });

  it('F1: powered airtime 1.1 + (C - 2) / 6 s, plus 4 frames', () => {
    for (const [capacity, expected] of [
      [16, 3.433],
      [12, 2.767],
      [30, 5.767],
    ] as const) {
      const { powered } = flight(100000, { fuelMax: capacity });
      expect(powered, `C = ${capacity}`).not.toBeNull();
      expect(
        Math.abs(powered! - (1.1 + (capacity - 2) / 6 + 4 * DT)),
        `C = ${capacity}`
      ).toBeLessThan(DT / 2);
      expect(Math.abs(powered! - expected)).toBeLessThan(5 * DT);
    }
  });
});
