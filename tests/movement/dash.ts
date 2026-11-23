/**
 * Dash Thrusters (MVP session 5), against findings step 6 (actions, fuel,
 * direction) and session 5's static reads of the base ability state machine
 * (findings/step-6-dash.md, 2026-11-22 note), on Loki and two chassis whose
 * actions differ (Alpha, Wyrm), from the exported data. Each test names its
 * source; the firing range checks the game later (D1, D2; session 7).
 */
import { describe, expect, it } from 'vitest';
import { f32, vec, type Vec3 } from '../../src/scripts/movement/math/vec';
import {
  DASH_CPP_DEFAULTS,
  parseDash,
  type DashAction,
} from '../../src/scripts/movement/data/dash_ability';
import { dashDirection } from '../../src/scripts/movement/rules/abilities/dash_direction';
import { DASH_HOLDER } from '../../src/scripts/movement/rules/abilities/dash';
import type { RobotCharacter } from '../../src/scripts/movement/rules/robot_character';
import {
  chassisRobot,
  FLOOR,
  LOKI,
  readTable,
  restingZ,
} from './support/rules_fixture';

const DT = 1 / 60;
const STILL = vec(0, 0, 0);
const FORWARD = vec(1, 0, 0);
const ALPHA = 'BP_Module_Alpha_Chassis.0';
const WYRM = 'BP_Module_Wyrm_Chassis.0';
const TWO_LEGS = 'DA_MovementType_TwoLegs_Agile.6';

interface Step {
  input?: Vec3;
  dash?: boolean;
  jump?: boolean;
  aim?: Vec3;
}

function step(r: RobotCharacter, s: Step = {}): void {
  r.update(DT, s.input ?? STILL, {
    jump: s.jump ?? false,
    dash: s.dash ?? false,
    aim: s.aim ?? FORWARD,
  });
}

/** A chassis standing on the flat floor, settled, fuel full. */
function standing(chassis = LOKI): RobotCharacter {
  const r = chassisRobot(chassis, [FLOOR], vec(0, 0, restingZ(0)));
  for (let i = 0; i < 40; i++) step(r);
  return r;
}

/** Speed along `d`, horizontal (the actions' `s`). */
function along(v: Vec3, d: Vec3): number {
  const k =
    (v.x * d.x + v.y * d.y + v.z * d.z) / (d.x * d.x + d.y * d.y + d.z * d.z);
  return Math.hypot(d.x * k, d.y * k);
}

interface ActionTrace {
  startT: number | null;
  finishT: number | null;
  speedAtStart: number | null;
  speedBeforeFinish: number | null;
  speedAtFinish: number | null;
}

/** Press dash once (held `holdTicks` updates) with `input`; per action, the
 * elapsed time and along-D speed (before the update's own tick) when it
 * started and finished. */
function traceDash(r: RobotCharacter, input: Vec3, ticks = 90) {
  const d = r.dash;
  const traces: ActionTrace[] = d.actions.map(() => ({
    startT: null,
    finishT: null,
    speedAtStart: null,
    speedBeforeFinish: null,
    speedAtFinish: null,
  }));
  let activeUpdates = 0;
  let direction = vec(0, 0, 0);
  const fuelBefore = r.fuel.value;
  for (let i = 0; i < ticks; i++) {
    const before = d.actions.map((a) => ({ ...a }));
    const speedBefore = along(
      r.movement.velocity,
      d.isActive ? d.direction : vec(1, 0, 0)
    );
    step(r, { input, dash: i < 2 });
    if (d.isActive) {
      activeUpdates++;
      direction = d.direction;
    }
    const s = along(r.movement.velocity, direction);
    d.actions.forEach((a, k) => {
      const t = traces[k];
      if (a.started && !before[k].started) {
        t.startT = d.elapsed();
        // MinSpeedToStartAction is tested after the update's move.
        t.speedAtStart = s;
      }
      if (a.finished && !before[k].finished) {
        t.finishT = d.elapsed();
        t.speedBeforeFinish = speedBefore;
        t.speedAtFinish = s;
      }
    });
  }
  return { traces, activeUpdates, direction, spent: fuelBefore - r.fuel.value };
}

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

describe('dash data (Ability.json, merged actions; findings step 6)', () => {
  it('every two-legged chassis has a dash with 8 actions and the C++ defaults it omits', () => {
    const chassis = twoLeggedChassis();
    expect(chassis).toHaveLength(38);
    for (const id of chassis) {
      const d = parseDash(
        readTable('Ability'),
        readTable('CharacterModule'),
        id
      );
      expect(d.actions, id).toHaveLength(8);
      expect(d.cooldown).toBe(1.5);
      expect(d.usageFuelCost).toBe(6);
      expect(d.defaulted).toEqual([
        'MinInterruptionAngle',
        'LateralFrictionMultiplier',
      ]);
      expect(d.minInterruptionAngle).toBe(
        DASH_CPP_DEFAULTS.MinInterruptionAngle
      );
      expect(d.lateralFrictionMultiplier).toBe(100);
    }
  });

  it("Loki's eight actions are step 6's table", () => {
    const d = parseDash(
      readTable('Ability'),
      readTable('CharacterModule'),
      LOKI
    );
    expect([
      d.initialDuration,
      d.minimumDuration,
      d.fuelConsumptionDuration,
    ]).toEqual([1.2, 1.2, 1.2]);
    const a = d.actions;
    const row = (x: DashAction) => [
      x.canStartOnGround,
      x.canStartMidair,
      x.startDelay,
      x.minSpeedToStartAction,
      x.hasDuration ? x.duration : null,
      x.hasVelocityThreshold ? x.velocityThreshold : null,
    ];
    expect(a.map(row)).toEqual([
      [true, false, 0, 0, 1, null],
      [true, false, 0, 0, null, null],
      [true, false, 0.5, 0, 0.3, 4500],
      [true, false, 0.2, 2100, 0.6, 5500],
      [false, true, 0, 0, null, 2200],
      [true, false, 0, 0, null, 2200],
      [false, true, 0, 2100, 0.6, 5500],
      [true, true, 0, 0, 1, null],
    ]);
    expect(a[0].maxSpeedModifier).toEqual({ value: 3000, type: 'Add' });
    expect(a[1].startImpulse).toEqual({ x: 0, y: 0, z: 700 });
    expect(a[2].verticalAcceleration).toBe(1400);
    expect(a.map((x) => x.requestedDirectionAcceleration)).toEqual([
      0, 0, 0, 5000, 8000, 8000, 5000, 0,
    ]);
    expect(a.map((x) => x.blocksAirControl)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('fails loudly on fields the port does not cover', () => {
    const base = {
      misc: { Actions: [{}], InitialDuration: 1 },
      cooldown: { Cooldown: 1 },
    };
    const modules = { C: { abilities_refs: ['OBJID_Ability::X'] } };
    const load = (entry: unknown) => () =>
      parseDash({ X: entry }, modules, 'C');
    expect(load(base)).not.toThrow();
    expect(
      load({ ...base, misc: { ...base.misc, CastDuration: 0.5 } })
    ).toThrow(/CastDuration/);
    expect(
      load({
        ...base,
        cooldown: { Cooldown: 1, CooldownPolicy: 'StartCooldownAfterEnd' },
      })
    ).toThrow(/CooldownPolicy/);
    expect(
      load({
        ...base,
        misc: {
          ...base.misc,
          Actions: [{ MaxSpeedModifier: { Value: 1, Type: 'Multiply' } }],
        },
      })
    ).toThrow(/Multiply/);
    expect(
      load({ ...base, misc: { ...base.misc, Actions: [{ Speed: 1 }] } })
    ).toThrow(/unknown/);
    expect(load({ ...base, misc: { Actions: [{}] } })).toThrow(
      /InitialDuration/
    );
  });
});

describe('dash actions per update (step 6 action pseudocode)', () => {
  for (const chassis of [LOKI, ALPHA, WYRM]) {
    it(`${chassis}: a ground W dash runs each action as its data says`, () => {
      const r = standing(chassis);
      const data = r.dash.data;
      const { traces, direction } = traceDash(r, FORWARD, 130);
      expect(direction.x).toBeCloseTo(1, 12);
      data.actions.forEach((a, k) => {
        const t = traces[k];
        const label = `${chassis} action ${k}`;
        if (!a.canStartOnGround) {
          // Ground dash: air-only actions finish without starting, when
          // their start is first tried (after any minimum speed).
          expect(t.startT, label).toBeNull();
          expect(t.finishT, label).not.toBeNull();
          if (a.minSpeedToStartAction === 0) expect(t.finishT, label).toBe(0);
          return;
        }
        expect(t.startT, label).not.toBeNull();
        // It starts on the first update at or after its delay (float).
        expect(t.startT!, label).toBeGreaterThanOrEqual(
          f32(a.startDelay) - 1e-6
        );
        if (a.minSpeedToStartAction > 0)
          expect(t.speedAtStart!, label).toBeGreaterThanOrEqual(
            a.minSpeedToStartAction - 1e-6
          );
        else expect(t.startT!, label).toBeLessThan(a.startDelay + DT + 1e-6);
        if (t.finishT === null) {
          // Neither a duration nor a threshold: it runs to the dash's end.
          expect(a.hasDuration || a.hasVelocityThreshold, label).toBe(true);
          return;
        }
        if (t.finishT >= r.dash.data.initialDuration - 1e-6) return; // the dash's end
        // The threshold is tested on the velocity after the update's move,
        // which is what the update ends with (before later actions' starts).
        const byThreshold =
          a.hasVelocityThreshold && t.speedAtFinish! > a.velocityThreshold - 1;
        const byDuration =
          a.hasDuration && t.finishT >= t.startT! + a.duration - 1e-6;
        expect(byThreshold || byDuration, label).toBe(true);
      });
    });
  }

  it('Loki ground dash: the hop, the pushes, the top-speed bonus and no air control for 1 s', () => {
    const r = standing();
    const m = r.movement;
    step(r, { input: FORWARD, dash: true });
    // Activation update: actions 0, 1, 5, 7 start; 700 cm/s up at once.
    expect(r.dash.state).toBe('active');
    expect(m.movementMode).toBe('falling');
    expect(m.velocity.z).toBe(700);
    expect([...m.maxSpeedModifiers.values()]).toEqual([3000]);
    expect(m.airControlBlockers.list()).toEqual(['Dash action 7']);
    expect(m.frictionEnabled).toBe(false);
    expect(r.fuel.regenBlockers.list()).toEqual([DASH_HOLDER]);
    // Action 5's push lands next update: 8000 cm/s^2 along D.
    const vx = m.velocity.x;
    step(r, { input: FORWARD });
    expect(m.velocity.x - vx).toBeCloseTo(8000 * DT, 3);
    let updates = 2;
    while (r.dash.isActive) {
      step(r, { input: FORWARD });
      updates++;
      if (updates === 59) {
        // Before 1 s: still +3000 and blocked.
        expect([...m.maxSpeedModifiers.values()]).toEqual([3000]);
        expect(m.airControlBlockers.active).toBe(true);
      }
    }
    expect(m.maxSpeedModifiers.size).toBe(0);
    expect(m.airControlBlockers.active).toBe(false);
    expect(m.frictionEnabled).toBe(true);
    expect(r.fuel.regenBlockers.active).toBe(false);
    expect(r.dash.direction).toEqual(vec(0, 0, 0));
    // 1.2 s at 60 fps: the float countdown ends on update 74 (73 ticks).
    expect(updates).toBe(74);
  });

  it('fuel: 5 per second for 73 updates, from full', () => {
    const r = standing();
    const { spent, activeUpdates } = traceDash(r, FORWARD);
    expect(activeUpdates).toBe(73);
    // Regeneration resumes the update after the dash ends.
    expect(spent).toBeCloseTo(73 * (6 / 72) - (90 - 74) * 0.8 * DT, 3);
  });

  it('an air dash runs only the midair actions', () => {
    const r = standing();
    // Jump, then dash in the air.
    for (let i = 0; i < 30; i++) step(r, { jump: i < 1 });
    expect(r.movement.isFalling()).toBe(true);
    const { traces } = traceDash(r, FORWARD, 30);
    const started = traces.map((t) => t.startT !== null);
    // 4 and 7 at once, 6 once the along-D speed reaches its 2100.
    expect(started).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      true,
      true,
    ]);
    expect(traces[6].speedAtStart!).toBeGreaterThanOrEqual(2100);
  });
});

describe('dash state machine (base ability, session 5 static read)', () => {
  it('starts on the press update, has a 1.5 s cooldown from activation, and holding dashes once', () => {
    const r = standing();
    const d = r.dash;
    let pressUpdate = -1;
    let second = -1;
    for (let i = 0; i < 200; i++) {
      step(r, { dash: true });
      if (pressUpdate < 0 && d.isActive) pressUpdate = i;
      else if (
        pressUpdate >= 0 &&
        i > pressUpdate + 80 &&
        d.isActive &&
        second < 0
      )
        second = i;
    }
    expect(pressUpdate).toBe(0);
    expect(second).toBe(-1);
  });

  it('a press during the cooldown dashes when it ends; a released one does not', () => {
    const r = standing();
    step(r, { dash: true });
    for (let i = 0; i < 80; i++) step(r);
    expect(r.dash.state).toBe('inactive');
    // Press and hold through the rest of the cooldown.
    let restart = -1;
    for (let i = 0; i < 30; i++) {
      step(r, { dash: true });
      if (restart < 0 && r.dash.isActive) restart = i;
    }
    // Cooldown 1.5 s = 90 updates from activation; 81 have passed.
    expect(restart).toBeGreaterThan(5);
    expect(restart).toBeLessThan(12);

    const q = standing();
    step(q, { dash: true });
    for (let i = 0; i < 80; i++) step(q);
    step(q, { dash: true });
    for (let i = 0; i < 40; i++) step(q);
    expect(q.dash.state).toBe('idle');
  });

  it('needs MinimumDuration / FuelConsumptionDuration x UsageFuelCost fuel to start', () => {
    const r = standing();
    expect(r.dash.startFuel).toBe(6);
    // Below 6 even after this update's regeneration (0.8/s).
    r.fuel.add(-(r.fuel.value - 5.9));
    step(r);
    expect(r.dash.canDash).toBe(false);
    step(r, { dash: true });
    expect(r.dash.isActive).toBe(false);
  });
});

describe('dash direction (0x1452d7e30, player path)', () => {
  const deg = Math.PI / 180;
  const aimAt = (pitch: number, yaw = 0) =>
    vec(
      Math.cos(pitch * deg) * Math.cos(yaw * deg),
      Math.cos(pitch * deg) * Math.sin(yaw * deg),
      Math.sin(pitch * deg)
    );
  // UE: X forward, Y right. W, S, A, D with the view along +X.
  const keys: [string, Vec3][] = [
    ['W', vec(1, 0, 0)],
    ['S', vec(-1, 0, 0)],
    ['A', vec(0, -1, 0)],
    ['D', vec(0, 1, 0)],
    ['none', vec(0, 0, 0)],
  ];
  const dir = (pitch: number, input: Vec3, onGround: boolean) =>
    dashDirection({
      aim: aimAt(pitch),
      input,
      onGround,
      forward: vec(0, 1, 0),
    });
  const close = (a: Vec3, b: Vec3) => {
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.y).toBeCloseTo(b.y, 9);
    expect(a.z).toBeCloseTo(b.z, 9);
  };
  const expected: Record<string, Vec3> = {
    W: vec(1, 0, 0),
    S: vec(-1, 0, 0),
    A: vec(0, -1, 0),
    D: vec(0, 1, 0),
    none: vec(1, 0, 0),
  };

  for (const pitch of [0, 45, -45]) {
    for (const [key, input] of keys) {
      it(`on the ground, looking ${pitch}: ${key} is horizontal along the view turned by the key`, () => {
        close(dir(pitch, input, true), expected[key]);
      });
    }
  }

  for (const [key, input] of keys) {
    it(`in the air, looking level: ${key}`, () => {
      close(dir(0, input, false), expected[key]);
    });
    it(`in the air, looking up 45: ${key} never points up`, () => {
      close(dir(45, input, false), expected[key]);
    });
  }

  it('in the air, looking down 45: W and none keep the pitch, S mirrors it, A and D are level', () => {
    const s = Math.SQRT1_2;
    close(dir(-45, vec(1, 0, 0), false), vec(s, 0, -s));
    close(dir(-45, vec(0, 0, 0), false), vec(s, 0, -s));
    close(dir(-45, vec(-1, 0, 0), false), vec(-s, 0, -s));
    close(dir(-45, vec(0, -1, 0), false), vec(0, -1, 0));
    close(dir(-45, vec(0, 1, 0), false), vec(0, 1, 0));
  });

  it('turns with the view: looking along +Y, W dashes along +Y and A along +X', () => {
    const aim = aimAt(0, 90);
    close(
      dashDirection({
        aim,
        input: vec(0, 1, 0),
        onGround: true,
        forward: vec(1, 0, 0),
      }),
      vec(0, 1, 0)
    );
    close(
      dashDirection({
        aim,
        input: vec(1, 0, 0),
        onGround: true,
        forward: vec(1, 0, 0),
      }),
      vec(1, 0, 0)
    );
  });

  it('falls back to the capsule forward when looking straight up on the ground', () => {
    close(
      dashDirection({
        aim: vec(0, 0, 1),
        input: vec(0, 0, 0),
        onGround: true,
        forward: vec(0, 1, 0),
      }),
      vec(0, 1, 0)
    );
  });
});

describe('fuel interplay with the Jump Jet (ability order: dash first)', () => {
  it('dash and jump pressed together: the dash makes the robot fall, so the Jump Jet starts Fly, not Jump', () => {
    const r = standing();
    step(r, { input: FORWARD, dash: true, jump: true });
    expect(r.dash.isActive).toBe(true);
    expect(r.jetpack.state).toBe('fly');
  });

  it('a jump after a dash pays its cost from what the dash left; neither regenerates while either runs', () => {
    const r = standing();
    traceDash(r, FORWARD, 74);
    const left = r.fuel.value;
    expect(left).toBeCloseTo(16 - 73 * (6 / 72), 3);
    // Land first (the dash leaves the robot on the floor here), then jump.
    for (let i = 0; i < 20; i++) step(r);
    const beforeJump = r.fuel.value;
    step(r, { jump: true });
    expect(r.jetpack.state).toBe('jump');
    // Regeneration (before the ability ticks) adds 0.8/s first.
    expect(r.fuel.value).toBeCloseTo(beforeJump + 0.8 * DT - 2, 4);
  });

  it('flying while dashing drains both; the dash ends when the fuel runs out', () => {
    const r = standing();
    for (let i = 0; i < 70; i++) step(r, { jump: true });
    expect(r.jetpack.state).toBe('fly');
    r.fuel.add(-(r.fuel.value - 8));
    step(r, { jump: true, dash: true, input: FORWARD });
    expect(r.dash.isActive).toBe(true);
    let updates = 1;
    while (r.dash.isActive && updates < 200) {
      step(r, { jump: true, input: FORWARD });
      updates++;
    }
    // Fly's 6/s plus the dash's 5/s empty 8 fuel in about 0.73 s.
    expect(updates).toBeGreaterThan(40);
    expect(updates).toBeLessThan(48);
    expect(r.fuel.value).toBe(0);
  });
});
