/**
 * The float32 details tolerance class A depends on (stages/mvp.md;
 * 09-editor.md 2.5, 2.6), against values UE 5.4.4 itself printed
 * (/srv/dev/repos/wrf-movement-ref out/checks.json and the box traces):
 * FRichCurve::Eval in float, the sub-step split in float, the world's
 * frame clamp, GetGravityZ as a float product, and the data loaders that
 * replace the prototype's placeholders.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  evalCurve,
  type RichCurve,
} from '../../src/scripts/movement/data/rich_curve';
import { CharacterMovementComponent } from '../../src/scripts/movement/engine/character_movement';
import { fixupDeltaSeconds } from '../../src/scripts/movement/engine/world_tick';
import { ExactCollisionWorld } from '../../src/scripts/movement/collision/exact/world';
import { emptyColliderSet } from '../../src/scripts/movement/collision/exact/colliders';
import { vec } from '../../src/scripts/movement/math/vec';
import { parseCharacterMovement } from '../../src/scripts/movement/data/character';
import { parseMapPhysics } from '../../src/scripts/movement/data/map_physics';
import { worldSetup } from '../../src/scripts/movement/world_setup';
import { DEFAULT_KILL_Z } from '../../src/scripts/movement/engine/constants';

const f32 = Math.fround;

const linear = (keys: [number, number][]): RichCurve => ({
  keys: keys.map(([time, value]) => ({
    time: f32(time),
    value: f32(value),
    interpMode: 'RCIM_Linear',
    arriveTangent: 0,
    leaveTangent: 0,
  })),
  preInfinity: 'constant',
  postInfinity: 'constant',
  defaultValue: null,
});

describe('FRichCurve::Eval in float32 (UE checks.json, FRichCurve_Eval_data_curves)', () => {
  // UE's printed results (%.9g of the float): equal after rounding to float.
  const cases: [string, [number, number][], [number, number][]][] = [
    [
      'Jump Jet VerticalAccelerationForceCurve',
      [
        [0, 140000],
        [0.1, 70000],
        [1200, 15000],
        [3000, 0],
        [3000, 0],
      ],
      [
        [-1000, 140000],
        [0.05, 105000],
        [0.2, 69995.4141],
        [600, 42502.2891],
        [2100, 7500],
        [2999.9, 0.833984375],
        [3500, 0],
      ],
    ],
    [
      'two-legged VelocityMultiplierOnWallAngleHit, key 3000',
      [
        [0, 0.35],
        [90, 1.0],
      ],
      [
        [-10, 0.349999994],
        [10, 0.422222197],
        [22.5, 0.512499988],
        [45, 0.674999952],
        [67.5, 0.837499976],
        [89.9, 0.999277711],
      ],
    ],
  ];
  for (const [name, keys, points] of cases)
    it(name, () => {
      const curve = linear(keys);
      for (const [x, ue] of points) expect(evalCurve(curve, x)).toBe(f32(ue));
    });
});

describe('the world frame clamp and the sub-step split (09-editor.md 2.6)', () => {
  it('clamps a frame to [0.0005, 0.4] s in float', () => {
    // hitch_substeps_walk tick 102: dt 0.5, moveDt 0.4000000059604645.
    expect(fixupDeltaSeconds(0.5)).toBe(0.4000000059604645);
    expect(fixupDeltaSeconds(1 / 60)).toBe(f32(1 / 60));
    expect(fixupDeltaSeconds(0.0001)).toBe(f32(0.0005));
  });

  const split = (frame: number): number[] => {
    const ground = new ExactCollisionWorld({
      ...emptyColliderSet(),
      boxes: [
        {
          center: [0, 0, -500],
          rotation: [0, 0, 0, 1],
          halfExtents: [200000, 200000, 500],
          info: { source: 'ground', flags: 0 },
        },
      ],
    });
    const steps: number[] = [];
    class Probe extends CharacterMovementComponent {
      override calcVelocity(
        dt: number,
        friction: number,
        fluid: boolean,
        braking: number
      ): void {
        steps.push(dt);
        super.calcVelocity(dt, friction, fluid, braking);
      }
    }
    const c = new Probe(
      ground,
      { radius: 600, halfHeight: 700 },
      vec(0, 0, 702.15)
    );
    c.teleport(vec(0, 0, 702.15));
    c.setMovementMode('walking');
    c.performMovement(fixupDeltaSeconds(frame), vec(1, 0, 0));
    return steps;
  };

  it('splits a 0.3 s frame into 7 float sub-steps, as UE does', () => {
    // hitch_substeps_walk tick 60 (UE): 5 x 0.0500000007, 2 x 0.0250000041.
    expect(split(0.3)).toEqual([
      ...Array(5).fill(f32(0.05)),
      ...Array(2).fill(0.025000004097819328),
    ]);
  });

  it('runs a 0.5 s hitch as 0.4 s: 6 x 0.05 and 2 x 0.049999997', () => {
    // hitch_substeps_walk tick 102 (UE).
    const s = split(0.5);
    expect(s).toHaveLength(8);
    expect(s.slice(0, 6)).toEqual(Array(6).fill(f32(0.05)));
    expect(s.slice(6).map((t) => t.toPrecision(8))).toEqual([
      '0.049999997',
      '0.049999997',
    ]);
  });

  it('evaluates GetGravityZ as a float product', () => {
    // The traces' effectiveGravityZ: -1400 x 1.2 = -1680.0001220703125.
    const c = new CharacterMovementComponent(
      new ExactCollisionWorld(emptyColliderSet()),
      { radius: 600, halfHeight: 700 },
      vec(0, 0, 0),
      { gravityZ: -1400, gravityScale: 1.2 }
    );
    expect(c.getGravityZ()).toBe(-1680.0001220703125);
  });
});

describe('engine parameters from the exported data (D3)', () => {
  const objects = path.join(
    process.cwd(),
    'WRFrontiersDB-Data',
    'current',
    'Objects'
  );
  const read = (name: string): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(path.join(objects, `${name}.json`), 'utf-8'));
  const characterFile = path.join(objects, 'Character.json');
  const hasCharacter = fs.existsSync(characterFile);

  it.skipIf(!hasCharacter)(
    "reads BP_Character's movement defaults and every map's physics",
    () => {
      const pawn = parseCharacterMovement(read('Character'));
      expect(pawn.MaxStepHeight).toBeGreaterThan(0);
      expect(pawn.WalkableFloorZ).toBeGreaterThan(0);
      expect(pawn.WalkableFloorZ).toBeLessThan(1);
      const maps = read('Map') as Record<string, { physics?: unknown }>;
      for (const [id, map] of Object.entries(maps)) {
        const physics = parseMapPhysics(map.physics, id);
        expect(physics.gravityZ, id).toBeLessThan(0);
        expect(physics.terminalVelocity, id).toBeGreaterThan(0);
        const setup = worldSetup(pawn, physics, id);
        expect(setup.killZ).toBe(physics.killZ ?? DEFAULT_KILL_Z);
        expect(setup.params.gravityScale).toBe(pawn.GravityScale);
      }
    }
  );

  it('fails loudly on a missing or renamed field', () => {
    const pawn = {
      'BP_Character.0': {
        movement_component: {
          GravityScale: 1.2,
          MaxStepHeight: 500,
          WalkableFloorZ: 0.71,
          BrakingFrictionFactor: 0.05,
          AirControl: 0,
          AirControlBoostMultiplier: 0,
          PerchRadiusThreshold: 400,
          PerchAdditionalHeight: 0,
          bMaintainHorizontalGroundVelocity: false,
        },
      },
    };
    expect(parseCharacterMovement(pawn).PerchRadiusThreshold).toBe(400);
    const renamed = structuredClone(pawn);
    delete (
      renamed['BP_Character.0'].movement_component as Record<string, unknown>
    ).MaxStepHeight;
    expect(() => parseCharacterMovement(renamed)).toThrow(/MaxStepHeight/);
    expect(() => parseCharacterMovement({})).toThrow(/BP_Character.0/);
    expect(() => parseMapPhysics({ GravityZ: -1400 }, 'X')).toThrow(
      /TerminalVelocity/
    );
    expect(
      parseMapPhysics({ GravityZ: -1400, TerminalVelocity: 40000 }, 'X').killZ
    ).toBeNull();
  });
});
