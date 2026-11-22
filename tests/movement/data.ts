/**
 * The exported data loads into the simulation (prototype question 3), and
 * curves evaluate as UE's FRichCurve::Eval does. The data checks are
 * structural, so they hold across patches.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseChassis,
  requireScalar,
} from '../../src/scripts/movement/data/chassis';
import { parseChassisLevel } from '../../src/scripts/movement/data/chassis_level';
import {
  parseMovementType,
  type MovementType,
} from '../../src/scripts/movement/data/movement_type';
import { blendForMobility } from '../../src/scripts/movement/rules/movement_properties';
import {
  evalCurve,
  parseRichCurve,
  type RichCurve,
} from '../../src/scripts/movement/data/rich_curve';

const OBJECTS = path.join(
  process.cwd(),
  'WRFrontiersDB-Data',
  'current',
  'Objects'
);
const readTable = (name: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(OBJECTS, `${name}.json`), 'utf-8'));

/** The prototype's chassis (Loki's legs). */
const LOKI = 'BP_Module_Loki_Chassis.0';

describe('exported movement data', () => {
  const movementTypes = readTable('MovementType');
  const modules = readTable('CharacterModule');

  it('parses every movement type and tier', () => {
    for (const id of Object.keys(movementTypes)) {
      const type = parseMovementType(movementTypes, id);
      expect(type.tiers.length).toBeGreaterThan(0);
      for (const tier of type.tiers) {
        const accel = evalCurve(tier.accelerationDependenceOnSpeed, 0);
        expect(Number.isFinite(accel) && accel > 0).toBe(true);
      }
    }
  });

  it("resolves Loki's legs to a movement type and a max speed", () => {
    const chassis = parseChassis(modules, LOKI);
    expect(movementTypes[chassis.movementTypeId]).toBeDefined();
    expect(requireScalar(chassis, 'MaxSpeed')).toBeGreaterThan(0);
  });

  it("reads Loki's per-level Mobility and MaxSpeed, defaulting to the top level", () => {
    const level = parseChassisLevel(readTable('Module'), LOKI, null);
    expect(level.source).toBe('levels');
    expect(level.level).toBe(level.maxLevel);
    expect(level.mobility).toBeGreaterThan(0);
    expect(level.maxSpeed).toBeGreaterThan(0);
  });
});

describe('blendForMobility (findings step 2)', () => {
  // Six tiers and max_mobility 75, as every movement type has today.
  const type = {
    id: 'T',
    maxMobility: 75,
    tiers: Array(6).fill({}),
  } as unknown as MovementType;

  it('blends the two tiers around the Mobility', () => {
    // The findings' worked example: Loki's legs at level 13, Mobility 52.
    const blend = blendForMobility(type, 52);
    expect([blend.lower, blend.upper]).toEqual([3, 4]);
    expect(blend.alpha).toBeCloseTo(7 / 15, 6);
  });

  it('uses one tier alone on a step boundary, and clamps', () => {
    expect(blendForMobility(type, 45)).toEqual({
      lower: 3,
      upper: 3,
      alpha: 0,
    });
    expect(blendForMobility(type, 0)).toEqual({ lower: 0, upper: 0, alpha: 0 });
    expect(blendForMobility(type, 200)).toEqual({
      lower: 5,
      upper: 5,
      alpha: 0,
    });
  });
});

const curve = (
  keys: [number, number][],
  mode = 'RCIM_Linear',
  extra: Record<string, unknown> = {}
): RichCurve =>
  parseRichCurve(
    {
      EditorCurveData: {
        Keys: keys.map(([Time, Value]) => ({ InterpMode: mode, Time, Value })),
        ...extra,
      },
    },
    'test'
  );

describe('evalCurve (FRichCurve::Eval)', () => {
  it('interpolates linear keys and holds the ends', () => {
    const c = curve([
      [0, 2000],
      [400, 2000],
      [700, 800],
    ]);
    expect(evalCurve(c, -50)).toBe(2000);
    expect(evalCurve(c, 550)).toBeCloseTo(1400);
    expect(evalCurve(c, 9999)).toBe(800);
  });

  it('extrapolates linearly when asked', () => {
    const c = curve(
      [
        [0, 0],
        [10, 5],
      ],
      'RCIM_Linear',
      {
        PreInfinityExtrap: 'ERichCurveExtrapolation::RCCE_Linear',
        PostInfinityExtrap: 'ERichCurveExtrapolation::RCCE_Linear',
      }
    );
    expect(evalCurve(c, -10)).toBeCloseTo(-5);
    expect(evalCurve(c, 20)).toBeCloseTo(10);
  });

  it('steps constant keys and eases flat cubic keys', () => {
    expect(
      evalCurve(
        curve(
          [
            [0, 1],
            [10, 3],
          ],
          'RCIM_Constant'
        ),
        9.9
      )
    ).toBe(1);
    expect(
      evalCurve(
        curve(
          [
            [0, 1],
            [10, 3],
          ],
          'RCIM_Cubic'
        ),
        5
      )
    ).toBeCloseTo(2);
    expect(
      evalCurve(
        curve(
          [
            [0, 1],
            [10, 3],
          ],
          'RCIM_Cubic'
        ),
        2.5
      )
    ).toBeLessThan(1.5);
  });

  it('rejects what it cannot evaluate', () => {
    expect(() => curve([[0, 1]], 'RCIM_None')).toThrow();
    expect(() =>
      curve([[0, 1]], 'RCIM_Linear', { PostInfinityExtrap: 'RCCE_Cycle' })
    ).toThrow();
  });
});
