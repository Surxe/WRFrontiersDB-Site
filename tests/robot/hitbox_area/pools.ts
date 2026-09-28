import { describe, it, expect } from 'vitest';
import {
  assignPools,
  viewApplies,
} from '../../../src/scripts/robot/hitbox_area/pools';
import type { ModuleKind } from '../../../src/scripts/robot/build/types';

describe('assignPools', () => {
  const entry = (socketName: string, parentIndex: number) => ({
    moduleId: `M_${socketName}`,
    socketName,
    parentIndex,
  });
  const entries = [
    entry('None', -1), // chassis
    entry('Root', 0), // torso
    entry('Shoulder_L', 1),
    entry('Shoulder_Weapon_0', 2),
    entry('Shoulder_R', 1),
    entry('Shoulder_Weapon_0', 4),
    entry('Torso_Weapon_0', 1),
    entry('Ability', 1),
  ];
  const kinds: ModuleKind[] = [
    'chassis',
    'torso',
    'shoulder',
    'weapon',
    'shoulder',
    'weapon',
    'weapon',
    'ability',
  ];
  const { pools, poolOf, weapon } = assignPools(entries, (i) => kinds[i]);

  it('makes the chassis, torso and each shoulder a pool', () => {
    expect(pools.map((p) => p.kind)).toEqual([
      'chassis',
      'torso',
      'shoulder',
      'shoulder',
    ]);
    expect(pools.map((p) => p.side)).toEqual([null, null, 'left', 'right']);
    expect(pools.map((p) => p.key)).toEqual([
      'chassis',
      'torso',
      'shoulder:left',
      'shoulder:right',
    ]);
  });

  it("puts weapons in their mount's pool and leaves the rest out", () => {
    expect(poolOf).toEqual([0, 1, 2, 2, 3, 3, 1, null]);
    expect(weapon).toEqual([
      false,
      false,
      false,
      true,
      false,
      true,
      true,
      false,
    ]);
    expect(pools[2].weapons).toEqual([
      { moduleId: 'M_Shoulder_Weapon_0', index: 3 },
    ]);
    expect(pools[1].weapons).toEqual([
      { moduleId: 'M_Torso_Weapon_0', index: 6 },
    ]);
    // The chassis sits above the torso, but torso weapons stay with the torso.
    expect(pools[0].weapons).toEqual([]);
  });

  it("skips a shoulder's inner side", () => {
    expect(viewApplies(pools[2], 'right')).toBe(false);
    expect(viewApplies(pools[2], 'left')).toBe(true);
    expect(viewApplies(pools[3], 'left')).toBe(false);
    expect(viewApplies(pools[1], 'left')).toBe(true);
    expect(viewApplies(pools[0], 'right')).toBe(true);
  });
});
