import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  assignPools,
  collectBodies,
  DIFF_A_ONLY,
  DIFF_B_ONLY,
  DIFF_SHARED,
  measureBuild,
  measureComparison,
  measureView,
  VIEW_ORDER,
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
import { resolveComparison } from '../../src/scripts/model_viewer/build/compare';
import { diffPlacements } from '../../src/scripts/model_viewer/placement_diff';

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
): HitboxBody => ({ primitives, moduleIndex: 0, zone: null, pool, weapon });

/** Relative closeness, since grid areas are exact only in the limit. */
const near = (actual: number, expected: number, tol = 0.01): void => {
  expect(Math.abs(actual - expected) / expected).toBeLessThan(tol);
};

describe('measureView: analytic shapes', () => {
  it('a sphere projects to a disc from every side', () => {
    const bodies = [body([sphere(50, [0, 0, 0])], 0)];
    for (const view of ['front', 'left', 'top'] as const) {
      near(measureView(bodies, 1, view).pools[0].alone, Math.PI * 50 * 50);
    }
  });

  it('a box projects to its face areas', () => {
    const box: HitboxPrimitive = {
      kind: 'box',
      m: eulerMat(0, 0, 0),
      extent: [100, 60, 40],
    };
    const bodies = [body([box], 0)];
    near(measureView(bodies, 1, 'front').pools[0].alone, 60 * 40);
    near(measureView(bodies, 1, 'left').pools[0].alone, 100 * 40);
    near(measureView(bodies, 1, 'top').pools[0].alone, 100 * 60);
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
    near(measureView(bodies, 1, 'front').pools[0].alone, Math.PI * r * r);
    near(
      measureView(bodies, 1, 'top').pools[0].alone,
      2 * r * len + Math.PI * r * r
    );
    near(
      measureView(bodies, 1, 'left').pools[0].alone,
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
    const [area] = measureView(bodies, 1, 'front').pools;
    const lens =
      2 * r * r * Math.acos(0.5) - (r / 2) * Math.sqrt(4 * r * r - r * r);
    near(area.alone, Math.PI * r * r);
    near(area.withWeapons, 2 * Math.PI * r * r - lens);
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
    const { pools, total } = measureView(bodies, 2, 'front');
    const disc = Math.PI * r * r;
    const lens =
      2 * r * r * Math.acos(0.5) - (r / 2) * Math.sqrt(4 * r * r - r * r);
    near(total.alone, 2 * disc - lens);
    near(total.withWeapons, 3 * disc - lens);
    expect(total.alone).toBeLessThan(pools[0].alone + pools[1].alone);
  });
});

describe('measureComparison', () => {
  const pool = { key: 'torso' } as never;
  const build = (bodies: HitboxBody[]) => ({ pools: [pool], bodies });
  const count = (states: Uint8Array, state: number): number =>
    states.reduce((n, s) => n + (s === state ? 1 : 0), 0);

  it('identical builds are all shared, with equal areas', () => {
    const bodies = [body([sphere(40, [0, 0, 0])], 0)];
    const result = measureComparison(build(bodies), build(bodies));
    for (const view of VIEW_ORDER) {
      const { a, b, diff } = result[view];
      expect(b).toEqual(a);
      expect(count(diff!.states, DIFF_A_ONLY)).toBe(0);
      expect(count(diff!.states, DIFF_B_ONLY)).toBe(0);
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
    } = measureComparison(build(a), build(b)).front;
    const disc = Math.PI * r * r;
    const lens =
      2 * r * r * Math.acos(0.5) - (r / 2) * Math.sqrt(4 * r * r - r * r);
    near(count(diff!.states, DIFF_SHARED), lens);
    near(count(diff!.states, DIFF_A_ONLY), disc - lens);
    near(count(diff!.states, DIFF_B_ONLY), disc - lens);
    // Each side's areas match measuring it alone.
    near(areaA.total.withWeapons, measureView(a, 1, 'front').total.withWeapons);
    near(areaB.total.withWeapons, measureView(b, 1, 'front').total.withWeapons);
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

  it('makes the chassis, torso and each shoulder a pool', () => {
    expect(pools.map((p) => p.label)).toEqual([
      'Chassis',
      'Torso',
      'Left Shoulder',
      'Right Shoulder',
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
    expect(pools[2].weaponIds).toEqual(['M_Shoulder_Weapon_0']);
    expect(pools[1].weaponIds).toEqual(['M_Torso_Weapon_0']);
    expect(pools[2].weaponIndices).toEqual([3]);
    expect(pools[1].weaponIndices).toEqual([6]);
    // The chassis sits above the torso, but torso weapons stay with the torso.
    expect(pools[0].weaponIds).toEqual([]);
  });

  it("skips a shoulder's inner side", () => {
    expect(viewApplies(pools[2], 'right')).toBe(false);
    expect(viewApplies(pools[2], 'left')).toBe(true);
    expect(viewApplies(pools[3], 'left')).toBe(false);
    expect(viewApplies(pools[1], 'left')).toBe(true);
    expect(viewApplies(pools[0], 'right')).toBe(true);
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

  const label = (name: string): number =>
    pools.findIndex((p) => p.label === name);

  it('splits the chassis into its armor zones', () => {
    expect(pools.map((p) => p.label)).toEqual([
      'Pelvis',
      'Left Leg',
      'Right Leg',
      'Torso',
      'Left Shoulder',
      'Right Shoulder',
    ]);
    expect(pools.map((p) => p.side)).toEqual([
      null,
      'left',
      'right',
      null,
      'left',
      'right',
    ]);
    expect(pools[label('Left Leg')].zone).toBe('DA_ArmorZone_LeftLeg.0');
    expect(pools[label('Left Leg')].key).toBe('chassis:DA_ArmorZone_LeftLeg.0');
    expect(pools[label('Left Shoulder')].weaponIds).toEqual([
      'DA_Module_Weapon_Hefty.0',
    ]);
    expect(pools[label('Right Shoulder')].weaponIds).toEqual([
      'DA_Module_Weapon_Hefty.0',
    ]);
  });

  it("puts a spider's two left legs in one pool and two right legs in another", () => {
    // Anansi: a pelvis capsule plus 3 capsules per leg, 4 legs.
    const count = (name: string): number =>
      bodies
        .filter((b) => b.pool === label(name))
        .reduce((n, b) => n + b.primitives.length, 0);
    expect(count('Pelvis')).toBe(1);
    expect(count('Left Leg')).toBe(6);
    expect(count('Right Leg')).toBe(6);
    // Every left-leg hitbox sits on the robot's left (-Y), right on +Y.
    for (const b of bodies) {
      for (const prim of b.primitives) {
        const y = prim.m[1][3];
        if (b.pool === label('Left Leg')) expect(y).toBeLessThan(0);
        if (b.pool === label('Right Leg')) expect(y).toBeGreaterThan(0);
      }
    }
  });

  it('measures each chassis pool from every applicable side', () => {
    const areas = measureBuild(bodies, pools.length, 4);
    for (const name of ['Pelvis', 'Left Leg', 'Right Leg']) {
      const p = label(name);
      for (const view of VIEW_ORDER) {
        if (!viewApplies(pools[p], view)) continue;
        const area = areas[view].pools[p];
        expect(area.alone, `${name} ${view}`).toBeGreaterThan(0);
        // No weapons mount on the chassis: nothing to add.
        expect(area.withWeapons, `${name} ${view}`).toBe(area.alone);
      }
    }
  });

  it("matches the torso capsule's analytic front area", () => {
    // Anansi's torso is a single capsule lying along X: a disc from the front.
    const torsoModel = models.get('BP_Module_Anansi_Torso.0')!;
    const r = torsoModel.capsules[0].radius;
    near(
      measureView(bodies, pools.length, 'front', 2).pools[label('Torso')].alone,
      Math.PI * r * r
    );
  });

  it('the whole robot covers at least its biggest pool from every side', () => {
    const areas = measureBuild(bodies, pools.length, 4);
    for (const view of VIEW_ORDER) {
      const { total, pools: byPool } = areas[view];
      const biggest = Math.max(...byPool.map((a) => a.withWeapons));
      expect(total.withWeapons, view).toBeGreaterThanOrEqual(biggest);
      // Weapons can sit wholly inside the rest of the silhouette (Hefty from
      // the side is hidden by the chassis + torso), so they never shrink it.
      expect(total.withWeapons, view).toBeGreaterThanOrEqual(total.alone);
    }
  });

  it('a mounted weapon grows its shoulder from the outer side', () => {
    const left = measureView(bodies, pools.length, 'left', 2).pools[
      label('Left Shoulder')
    ];
    expect(left.withWeapons).toBeGreaterThan(left.alone * 1.1);
  });
});

describe('real data: Anansi A vs B with the left shoulder swapped', () => {
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
  const index = buildCompatibilityIndex(tables);
  const models = new Map<string, ModuleModel>();

  const place = (build: ReturnType<typeof resolveBuild>) => {
    const preset = toPresetModules(build);
    for (const e of preset) {
      const id = modelIdForModule(
        refToId(e.module_ref),
        tables.modules,
        charModules,
        sideForSocket(e.socket_name ?? '')
      );
      if (id && !models.has(id)) {
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
    return {
      placements,
      ...collectBodies(preset, placements, models, tables),
    };
  };

  const a = resolveBuild(
    {
      chassis: 'DA_Module_ChassisAnansi.2',
      'Shoulder_L.Shoulder_Weapon_0': 'DA_Module_Weapon_Hefty.0',
      'Shoulder_R.Shoulder_Weapon_0': 'DA_Module_Weapon_Hefty.0',
    },
    tables,
    index
  );
  const leftSlot = a.slots.find((s) => s.key === 'Shoulder_L')!;
  // Another released left shoulder with a heavy slot, so the weapon carries.
  const other = leftSlot.options.find(
    (id) =>
      id !== a.selection.Shoulder_L &&
      tables.modules[id] &&
      resolveComparison(a, { Shoulder_L: id }, tables, index).b.selection[
        'Shoulder_L.Shoulder_Weapon_0'
      ] === 'DA_Module_Weapon_Hefty.0'
  )!;
  const { b } = resolveComparison(a, { Shoulder_L: other }, tables, index);
  const measuredA = place(a);
  const measuredB = place(b);
  const views = measureComparison(measuredA, measuredB, 4);
  const poolIndex = (pools: { key: string }[], key: string): number =>
    pools.findIndex((p) => p.key === key);

  it('found a comparable shoulder', () => {
    expect(other).toBeDefined();
  });

  it('leaves every other pool unchanged', () => {
    for (const key of [
      'torso',
      'shoulder:right',
      'chassis:DA_ArmorZone_Pelvis.0',
    ]) {
      const ia = poolIndex(measuredA.pools, key);
      const ib = poolIndex(measuredB.pools, key);
      for (const view of VIEW_ORDER) {
        expect(views[view].b.pools[ib], `${key} ${view}`).toEqual(
          views[view].a.pools[ia]
        );
      }
    }
  });

  it('changes the left shoulder and the whole robot somewhere', () => {
    const ia = poolIndex(measuredA.pools, 'shoulder:left');
    const ib = poolIndex(measuredB.pools, 'shoulder:left');
    expect(
      VIEW_ORDER.some(
        (view) =>
          views[view].a.pools[ia].alone !== views[view].b.pools[ib].alone
      )
    ).toBe(true);
    expect(
      VIEW_ORDER.some(
        (view) =>
          views[view].a.total.withWeapons !== views[view].b.total.withWeapons
      )
    ).toBe(true);
  });

  it('the 3D diff shares everything but the left shoulder and its weapon', () => {
    const { sharedA, sharedB } = diffPlacements(
      measuredA.placements,
      measuredB.placements
    );
    const changedA = measuredA.placements.filter((_, i) => !sharedA[i]);
    const changedB = measuredB.placements.filter((_, i) => !sharedB[i]);
    // The swapped shoulder, plus its (moved) weapon on each side.
    expect(changedA.map((p) => p.socket_name).sort()).toEqual([
      'Shoulder_L',
      'Shoulder_Weapon_0',
    ]);
    expect(changedB.map((p) => p.socket_name).sort()).toEqual([
      'Shoulder_L',
      'Shoulder_Weapon_0',
    ]);
  });
});
