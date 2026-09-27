import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  assignPools,
  collectBodies,
  measureView,
  viewApplies,
  type HitboxBody,
} from '../../src/scripts/model_viewer/hitbox_area';
import type { HitboxPrimitive } from '../../src/scripts/model_viewer/hitbox';
import { eulerMat } from '../../src/scripts/model_viewer/math';
import type { ModuleKind } from '../../src/scripts/model_viewer/build/types';
import type { CharacterPresetModule } from '../../src/types/character_preset';
import type { ModuleModel } from '../../src/types/model';
import { buildCompatibilityIndex } from '../../src/scripts/model_viewer/build/compatibility';
import {
  resolveBuild,
  toPresetModules,
} from '../../src/scripts/model_viewer/build/graph';
import {
  computeModuleWorlds,
  modelIdForModule,
  sideForSocket,
} from '../../src/scripts/model_viewer/mount';
import { refToId } from '../../src/utils/object_reference';

const sphere = (
  radius: number,
  at: [number, number, number]
): HitboxPrimitive => ({
  kind: 'sphere',
  m: eulerMat(0, 0, 0, at),
  radius,
});

const body = (
  primitives: HitboxPrimitive[],
  pool: number | null,
  weapon = false
): HitboxBody => ({ primitives, pool, weapon });

/** Relative closeness, since grid areas are exact only in the limit. */
const near = (actual: number, expected: number, tol = 0.01): void => {
  expect(Math.abs(actual - expected) / expected).toBeLessThan(tol);
};

describe('measureView: analytic shapes', () => {
  it('a sphere projects to a disc from every side', () => {
    const bodies = [body([sphere(50, [0, 0, 0])], 0)];
    for (const view of ['front', 'left', 'top'] as const) {
      near(measureView(bodies, 1, view)[0].alone, Math.PI * 50 * 50);
    }
  });

  it('a box projects to its face areas', () => {
    const box: HitboxPrimitive = {
      kind: 'box',
      m: eulerMat(0, 0, 0),
      extent: [100, 60, 40],
    };
    const bodies = [body([box], 0)];
    near(measureView(bodies, 1, 'front')[0].alone, 60 * 40);
    near(measureView(bodies, 1, 'left')[0].alone, 100 * 40);
    near(measureView(bodies, 1, 'top')[0].alone, 100 * 60);
  });

  it('a capsule is a disc end-on and a stadium side-on', () => {
    const r = 30;
    const len = 120;
    // Local Z rolled onto world X (the robot's forward axis), as real torso
    // capsules are: roll -90 then yaw -90.
    const cap: HitboxPrimitive = {
      kind: 'capsule',
      m: eulerMat(0, -90, -90, [10, 20, 300]),
      radius: r,
      length: len,
    };
    const bodies = [body([cap], 0)];
    near(measureView(bodies, 1, 'front')[0].alone, Math.PI * r * r);
    near(measureView(bodies, 1, 'top')[0].alone, 2 * r * len + Math.PI * r * r);
    near(
      measureView(bodies, 1, 'left')[0].alone,
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
    const [area] = measureView(bodies, 1, 'front');
    const lens =
      2 * r * r * Math.acos(0.5) - (r / 2) * Math.sqrt(4 * r * r - r * r);
    near(area.alone, Math.PI * r * r);
    near(area.withWeapons, 2 * Math.PI * r * r - lens);
  });
});

describe('assignPools', () => {
  const entry = (socket: string, parent: number): CharacterPresetModule => ({
    module_ref: `OBJID_Module::M_${socket}`,
    socket_name: socket,
    parent_socket_index: parent,
    level: 1,
  });
  const presets = [
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
  const { pools, poolOf, weapon } = assignPools(presets, (i) => kinds[i]);

  it('makes the torso and each shoulder a pool', () => {
    expect(pools.map((p) => p.label)).toEqual([
      'Torso',
      'Left Shoulder',
      'Right Shoulder',
    ]);
    expect(pools.map((p) => p.side)).toEqual([null, 'left', 'right']);
  });

  it("puts weapons in their mount's pool and leaves the rest out", () => {
    expect(poolOf).toEqual([null, 0, 1, 1, 2, 2, 0, null]);
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
    expect(pools[1].weaponIds).toEqual(['M_Shoulder_Weapon_0']);
    expect(pools[0].weaponIds).toEqual(['M_Torso_Weapon_0']);
    expect(pools[1].weaponIndices).toEqual([3]);
    expect(pools[0].weaponIndices).toEqual([6]);
  });

  it("skips a shoulder's inner side", () => {
    expect(viewApplies(pools[1], 'right')).toBe(false);
    expect(viewApplies(pools[1], 'left')).toBe(true);
    expect(viewApplies(pools[2], 'left')).toBe(false);
    expect(viewApplies(pools[0], 'left')).toBe(true);
  });
});

describe('real data: Anansi with Hefty on both shoulders', () => {
  const current = path.join(process.cwd(), 'WRFrontiersDB-Data', 'current');
  const read = <T>(file: string): T =>
    JSON.parse(
      fs.readFileSync(path.join(current, 'Objects', file), 'utf8')
    ) as T;
  const tables = {
    modules: read<Record<string, never>>('Module.json'),
    moduleTypes: read<Record<string, never>>('ModuleType.json'),
    socketTypes: read<Record<string, never>>('ModuleSocketType.json'),
    bots: read<Record<string, never>>('VirtualBot.json'),
  };
  const charModules = read<Record<string, unknown>>('CharacterModule.json');

  const build = resolveBuild(
    {
      chassis: 'DA_Module_ChassisAnansi.2',
      'Shoulder_L.Shoulder_Weapon_0': 'DA_Module_Weapon_Hefty.0',
      'Shoulder_R.Shoulder_Weapon_0': 'DA_Module_Weapon_Hefty.0',
    },
    tables,
    buildCompatibilityIndex(tables)
  );
  const preset = toPresetModules(build);
  const models = new Map<string, ModuleModel>();
  for (const e of preset) {
    const id = modelIdForModule(
      refToId(e.module_ref),
      tables.modules,
      charModules,
      sideForSocket(e.socket_name ?? '')
    );
    if (id) {
      models.set(
        id,
        JSON.parse(
          fs.readFileSync(path.join(current, 'Models', `${id}.json`), 'utf8')
        )
      );
    }
  }
  const placements = computeModuleWorlds(
    preset,
    tables.modules,
    tables.moduleTypes,
    charModules,
    models
  );
  const { pools, bodies } = collectBodies(preset, placements, models, tables);

  it('finds the torso and both shoulders, each shoulder armed', () => {
    expect(pools.map((p) => p.label)).toEqual([
      'Torso',
      'Left Shoulder',
      'Right Shoulder',
    ]);
    expect(pools[1].weaponIds).toEqual(['DA_Module_Weapon_Hefty.0']);
    expect(pools[2].weaponIds).toEqual(['DA_Module_Weapon_Hefty.0']);
  });

  it("matches the torso capsule's analytic front area", () => {
    // Anansi's torso is a single capsule lying along X: a disc from the front.
    const torsoModel = models.get('BP_Module_Anansi_Torso.0')!;
    const r = torsoModel.capsules[0].radius;
    near(
      measureView(bodies, pools.length, 'front', 2)[0].alone,
      Math.PI * r * r
    );
  });

  it('a mounted weapon grows its shoulder from the outer side', () => {
    const [, left] = measureView(bodies, pools.length, 'left', 2);
    expect(left.withWeapons).toBeGreaterThan(left.alone * 1.1);
  });
});
