import { describe, it, expect } from 'vitest';
import { Box3, Matrix4, Vector3 } from 'three';
import {
  compareOffset,
  hitboxBounds,
  isCompareLayout,
} from '../../src/scripts/model_viewer/render/compare_layout';
import type { HitboxSet } from '../../src/scripts/robot/hitbox_area/pools';

const box = (min: [number, number, number], max: [number, number, number]) =>
  new Box3(new Vector3(...min), new Vector3(...max));

describe('compareOffset', () => {
  const a = box([-100, -200, 0], [100, 200, 500]);
  const b = box([-50, -100, 0], [50, 100, 300]);

  it('leaves B on A when overlapping', () => {
    expect(compareOffset('overlap', a, b)).toEqual([0, 0, 0]);
  });

  it("stands B clear of A's left side, fronts and ground level", () => {
    const [x, y, z] = compareOffset('side', a, b);
    expect(x).toBe(0);
    expect(z).toBe(0);
    // B's right edge (max Y), moved, sits a gap left of A's left edge.
    const gap = a.min.y - (b.max.y + y);
    // A quarter of the wider build's width (A: 400).
    expect(gap).toBe(100);
  });

  it('keeps a minimum gap between narrow builds', () => {
    const thin = box([0, -10, 0], [10, 10, 10]);
    const [, y] = compareOffset('side', thin, thin);
    expect(thin.min.y - (thin.max.y + y)).toBe(50);
  });

  it('does not move B when either build has no hitboxes', () => {
    expect(compareOffset('side', new Box3(), b)).toEqual([0, 0, 0]);
    expect(compareOffset('side', a, new Box3())).toEqual([0, 0, 0]);
  });
});

describe('hitboxBounds', () => {
  it("bounds every body's primitives", () => {
    const set: HitboxSet = {
      pools: [],
      bodies: [
        {
          primitives: [
            {
              kind: 'sphere',
              radius: 10,
              m: new Matrix4().makeTranslation(0, 100, 50),
              zone: null,
            },
            {
              kind: 'box',
              extent: [20, 20, 20],
              m: new Matrix4().makeTranslation(0, -100, 10),
              zone: null,
            },
          ],
          moduleIndex: 0,
          zone: null,
          pool: null,
          weapon: false,
        },
      ],
    };
    const bounds = hitboxBounds(set);
    expect(bounds.min.y).toBeCloseTo(-110);
    expect(bounds.max.y).toBeCloseTo(110);
    expect(bounds.min.z).toBeCloseTo(0);
    expect(bounds.max.z).toBeCloseTo(60);
  });

  it('is empty without hitboxes', () => {
    expect(hitboxBounds({ pools: [], bodies: [] }).isEmpty()).toBe(true);
  });
});

describe('isCompareLayout', () => {
  it('accepts the layouts only', () => {
    expect(isCompareLayout('overlap')).toBe(true);
    expect(isCompareLayout('side')).toBe(true);
    expect(isCompareLayout('apart')).toBe(false);
    expect(isCompareLayout(undefined)).toBe(false);
  });
});
