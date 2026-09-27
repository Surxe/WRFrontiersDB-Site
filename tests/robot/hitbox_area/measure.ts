import { describe, it, expect } from 'vitest';
import { Matrix4 } from 'three';
import {
  compareHitboxes,
  DiffState,
  measureView,
} from '../../../src/scripts/robot/hitbox_area/measure';
import { VIEW_NAMES } from '../../../src/scripts/robot/hitbox_area/views';
import type {
  HitboxBody,
  HitboxPool,
  HitboxSet,
} from '../../../src/scripts/robot/hitbox_area/pools';
import type { HitboxPrimitive } from '../../../src/scripts/robot/model/hitbox';
import {
  rotatorMatrix,
  translationMatrix,
} from '../../../src/scripts/robot/model/math';

const sphere = (
  radius: number,
  at: [number, number, number]
): HitboxPrimitive => ({
  kind: 'sphere',
  m: translationMatrix(at),
  radius,
  zone: null,
});

const body = (
  primitives: HitboxPrimitive[],
  pool: number | null,
  weapon = false
): HitboxBody => ({ primitives, moduleIndex: 0, zone: null, pool, weapon });

/** Relative closeness, since grid areas are exact only in the limit. */
const near = (actual: number, expected: number, tol = 0.01): void => {
  expect(Math.abs(actual - expected) / expected).toBeLessThan(tol);
};

describe('measureView: analytic shapes', () => {
  it('a sphere projects to a disc from every side', () => {
    const bodies = [body([sphere(50, [0, 0, 0])], 0)];
    for (const view of ['front', 'left', 'top'] as const) {
      near(measureView(bodies, 1, view, 1).pools[0].alone, Math.PI * 50 * 50);
    }
  });

  it('a box projects to its face areas', () => {
    const box: HitboxPrimitive = {
      kind: 'box',
      m: new Matrix4(),
      zone: null,
      extent: [100, 60, 40],
    };
    const bodies = [body([box], 0)];
    near(measureView(bodies, 1, 'front', 1).pools[0].alone, 60 * 40);
    near(measureView(bodies, 1, 'left', 1).pools[0].alone, 100 * 40);
    near(measureView(bodies, 1, 'top', 1).pools[0].alone, 100 * 60);
  });

  it('a capsule is a disc end-on and a stadium side-on', () => {
    const r = 30;
    const len = 120;
    // Local Z rolled onto world X (the robot's forward axis), as real torso
    // capsules are: roll -90 then yaw -90.
    const cap: HitboxPrimitive = {
      kind: 'capsule',
      m: rotatorMatrix([0, -90, -90], [10, 20, 300]),
      zone: null,
      radius: r,
      length: len,
    };
    const bodies = [body([cap], 0)];
    near(measureView(bodies, 1, 'front', 1).pools[0].alone, Math.PI * r * r);
    near(
      measureView(bodies, 1, 'top', 1).pools[0].alone,
      2 * r * len + Math.PI * r * r
    );
    near(
      measureView(bodies, 1, 'left', 1).pools[0].alone,
      2 * r * len + Math.PI * r * r
    );
  });
});

describe('measureView: pools', () => {
  it('counts a weapon toward its pool without double counting overlap', () => {
    // Two equal discs whose centers are one radius apart (seen from the front).
    const r = 40;
    const bodies = [
      body([sphere(r, [0, 0, 0])], 0),
      body([sphere(r, [0, r, 0])], 0, true),
    ];
    const [area] = measureView(bodies, 1, 'front', 1).pools;
    const lens =
      2 * r * r * Math.acos(0.5) - (r / 2) * Math.sqrt(4 * r * r - r * r);
    near(area.alone, Math.PI * r * r);
    near(area.withWeapons, 2 * Math.PI * r * r - lens);
  });
});

describe('measureView: anchors', () => {
  const r = 40;
  const onDisc = (
    at: number[] | null,
    center: [number, number],
    radius = r
  ): boolean =>
    at !== null &&
    (at[1] - center[0]) ** 2 + (at[2] - center[1]) ** 2 <= radius ** 2;

  it('points at the part of a pool nothing else covers', () => {
    // Pool 1 is in front of pool 0 (rays run -X) and covers its +Y half.
    const bodies = [
      body([sphere(r, [0, 0, 0])], 0),
      body([sphere(r, [100, 30, 0])], 1),
    ];
    const { anchors } = measureView(bodies, 2, 'front', 1);
    expect(onDisc(anchors[0], [0, 0])).toBe(true);
    expect(onDisc(anchors[0], [30, 0])).toBe(false);
    expect(onDisc(anchors[1], [30, 0])).toBe(true);
  });

  it('falls back to a hidden pool, and is null without area', () => {
    const bodies = [
      body([sphere(r / 2, [0, 0, 0])], 0),
      body([sphere(r, [100, 0, 0])], 1),
    ];
    const { anchors } = measureView(bodies, 3, 'front', 1);
    expect(onDisc(anchors[0], [0, 0], r / 2)).toBe(true);
    expect(anchors[2]).toBeNull();
  });
});

describe('measureView: whole robot', () => {
  it('unions every pool once, and counts weapons only with weapons', () => {
    // Two pools' discs overlapping by one radius, plus a weapon disc off to
    // the side on pool 0 (seen from the front, rays run -X).
    const r = 40;
    const bodies = [
      body([sphere(r, [0, 0, 0])], 0),
      body([sphere(r, [0, r, 0])], 1),
      body([sphere(r, [0, -4 * r, 0])], 0, true),
    ];
    const { pools, total } = measureView(bodies, 2, 'front', 1);
    const disc = Math.PI * r * r;
    const lens =
      2 * r * r * Math.acos(0.5) - (r / 2) * Math.sqrt(4 * r * r - r * r);
    near(total.alone, 2 * disc - lens);
    near(total.withWeapons, 3 * disc - lens);
    expect(total.alone).toBeLessThan(pools[0].alone + pools[1].alone);
  });
});

describe('compareHitboxes', () => {
  const pool: HitboxPool = {
    key: 'torso',
    kind: 'torso',
    side: null,
    zone: null,
    moduleIndex: 0,
    moduleId: 'M_Torso',
    weapons: [],
  };
  const build = (bodies: HitboxBody[]): HitboxSet => ({
    pools: [pool],
    bodies,
  });
  const count = (states: Uint8Array | undefined, state: number): number =>
    states ? states.filter((s) => s === state).length : 0;

  it('identical builds are all shared, with equal areas', () => {
    const bodies = [body([sphere(40, [0, 0, 0])], 0)];
    const result = compareHitboxes(build(bodies), build(bodies)).views;
    for (const view of VIEW_NAMES) {
      const { a, b, diff } = result[view];
      expect(b).toEqual(a);
      expect(diff).not.toBeNull();
      expect(count(diff?.states, DiffState.AOnly)).toBe(0);
      expect(count(diff?.states, DiffState.BOnly)).toBe(0);
    }
  });

  it('splits two offset discs into A-only, B-only and shared', () => {
    const r = 40;
    const a = [body([sphere(r, [0, 0, 0])], 0)];
    const b = [body([sphere(r, [0, r, 0])], 0)];
    const {
      a: areaA,
      b: areaB,
      diff,
    } = compareHitboxes(build(a), build(b), 1).views.front;
    const disc = Math.PI * r * r;
    const lens =
      2 * r * r * Math.acos(0.5) - (r / 2) * Math.sqrt(4 * r * r - r * r);
    near(count(diff?.states, DiffState.Shared), lens);
    near(count(diff?.states, DiffState.AOnly), disc - lens);
    near(count(diff?.states, DiffState.BOnly), disc - lens);
    // Each side's areas match measuring it alone.
    near(
      areaA.total.withWeapons,
      measureView(a, 1, 'front', 1).total.withWeapons
    );
    near(
      areaB.total.withWeapons,
      measureView(b, 1, 'front', 1).total.withWeapons
    );
  });
});
