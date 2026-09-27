import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  assemble,
  ModelCache,
  type Assembly,
} from '../../src/scripts/robot/assembly';
import type { RobotTables } from '../../src/scripts/robot/data';
import { buildCompatibilityIndex } from '../../src/scripts/robot/build/compatibility';
import {
  resolveBuild,
  toPresetModules,
} from '../../src/scripts/robot/build/graph';
import { resolveComparison } from '../../src/scripts/robot/build/compare';
import {
  compareHitboxes,
  measureHitboxes,
  measureView,
  type ComparisonMeasurement,
} from '../../src/scripts/robot/hitbox_area/measure';
import { viewApplies } from '../../src/scripts/robot/hitbox_area/pools';
import { VIEW_NAMES } from '../../src/scripts/robot/hitbox_area/views';
import { requiredModelIds } from '../../src/scripts/robot/model/mount';
import { diffPlacements } from '../../src/scripts/robot/model/placement_diff';
import {
  ARMOR_ZONE_LEFT_LEG,
  ARMOR_ZONE_PELVIS,
  ARMOR_ZONE_RIGHT_LEG,
} from '../../src/utils/constants';
import { createObjectRef } from '../../src/utils/object_reference';
import type { ModuleModel } from '../../src/types/model';

// The headless pipeline against the real game data: the same assemble() the
// /models page runs, with models read from disk instead of fetched.
const current = path.join(process.cwd(), 'WRFrontiersDB-Data', 'current');
const readJson = <T>(...parts: string[]): T =>
  JSON.parse(fs.readFileSync(path.join(current, ...parts), 'utf8')) as T;
const objects = <T>(name: string): Record<string, T> =>
  readJson<Record<string, T>>('Objects', `${name}.json`);

const tables: RobotTables = {
  modules: objects('Module'),
  moduleTypes: objects('ModuleType'),
  socketTypes: objects('ModuleSocketType'),
  bots: objects('VirtualBot'),
  characterModules: objects('CharacterModule'),
};
const index = buildCompatibilityIndex(tables);
const cache = new ModelCache(async (id) =>
  readJson<ModuleModel>('Models', `${id}.json`)
);

/** Relative closeness, since grid areas are exact only in the limit. */
const near = (actual: number, expected: number, tol = 0.01): void => {
  expect(Math.abs(actual - expected) / expected).toBeLessThan(tol);
};

const anansiHefty = resolveBuild(
  {
    chassis: 'DA_Module_ChassisAnansi.2',
    'Shoulder_L.Shoulder_Weapon_0': 'DA_Module_Weapon_Hefty.0',
    'Shoulder_R.Shoulder_Weapon_0': 'DA_Module_Weapon_Hefty.0',
  },
  tables,
  index
);

describe('requiredModelIds', () => {
  it("includes a per-side weapon's parent-side model", () => {
    // Hive (a titan weapon) has a model per side; its mount uses the one for
    // the shoulder it sits on.
    const entry = (moduleId: string, socket_name: string, parent: number) => ({
      module_ref: createObjectRef('Module', moduleId),
      socket_name,
      parent_socket_index: parent,
      level: 1,
    });
    const ids = requiredModelIds(
      [
        entry('DA_Module_ChassisAnansi.2', 'None', -1),
        entry('DA_Module_TorsoAnansi.1', 'Root', 0),
        entry('DA_Module_ShoulderAnansi.0', 'Shoulder_L', 1),
        entry('DA_Module_Weapon_Hive.0', 'Shoulder_Weapon_0', 2),
      ],
      tables
    );
    expect(ids.has('BP_Weapon_Hive_L.0')).toBe(true);
  });
});

describe('assemble: Anansi with Hefty on both shoulders', () => {
  let assembly: Assembly;
  const poolIndex = (key: string): number =>
    assembly.hitboxes.pools.findIndex((p) => p.key === key);

  beforeAll(async () => {
    assembly = await assemble(toPresetModules(anansiHefty), tables, cache);
  });

  it('loads every model', () => {
    expect(assembly.missingModels).toEqual([]);
  });

  it('splits the chassis into its armor zones', () => {
    const { pools } = assembly.hitboxes;
    expect(pools.map((p) => p.key)).toEqual([
      `chassis:${ARMOR_ZONE_PELVIS}`,
      `chassis:${ARMOR_ZONE_LEFT_LEG}`,
      `chassis:${ARMOR_ZONE_RIGHT_LEG}`,
      'torso',
      'shoulder:left',
      'shoulder:right',
    ]);
    expect(pools.map((p) => p.side)).toEqual([
      null,
      'left',
      'right',
      null,
      'left',
      'right',
    ]);
    expect(
      pools[poolIndex('shoulder:left')].weapons.map((w) => w.moduleId)
    ).toEqual(['DA_Module_Weapon_Hefty.0']);
    expect(
      pools[poolIndex('shoulder:right')].weapons.map((w) => w.moduleId)
    ).toEqual(['DA_Module_Weapon_Hefty.0']);
  });

  it("puts a spider's two left legs in one pool and two right legs in another", () => {
    const { bodies } = assembly.hitboxes;
    const left = poolIndex(`chassis:${ARMOR_ZONE_LEFT_LEG}`);
    const right = poolIndex(`chassis:${ARMOR_ZONE_RIGHT_LEG}`);
    // Anansi: a pelvis capsule plus 3 capsules per leg, 4 legs.
    const count = (pool: number): number =>
      bodies
        .filter((b) => b.pool === pool)
        .reduce((n, b) => n + b.primitives.length, 0);
    expect(count(poolIndex(`chassis:${ARMOR_ZONE_PELVIS}`))).toBe(1);
    expect(count(left)).toBe(6);
    expect(count(right)).toBe(6);
    // Every left-leg hitbox sits on the robot's left (-Y), right on +Y.
    for (const b of bodies) {
      for (const prim of b.primitives) {
        const y = prim.m.elements[13];
        if (b.pool === left) expect(y).toBeLessThan(0);
        if (b.pool === right) expect(y).toBeGreaterThan(0);
      }
    }
  });

  it('measures each chassis pool from every applicable side', () => {
    const { pools, areas } = measureHitboxes(assembly.hitboxes, 4);
    for (const zone of [
      ARMOR_ZONE_PELVIS,
      ARMOR_ZONE_LEFT_LEG,
      ARMOR_ZONE_RIGHT_LEG,
    ]) {
      const p = poolIndex(`chassis:${zone}`);
      for (const view of VIEW_NAMES) {
        if (!viewApplies(pools[p], view)) continue;
        const area = areas[view].pools[p];
        expect(area.alone, `${zone} ${view}`).toBeGreaterThan(0);
        // No weapons mount on the chassis: nothing to add.
        expect(area.withWeapons, `${zone} ${view}`).toBe(area.alone);
      }
    }
  });

  it("matches the torso capsule's analytic front area", () => {
    // Anansi's torso is a single capsule lying along X: a disc from the front.
    const torso = assembly.models.get('BP_Module_Anansi_Torso.0');
    expect(torso).toBeDefined();
    const r = torso?.capsules[0].radius ?? 0;
    const { bodies, pools } = assembly.hitboxes;
    near(
      measureView(bodies, pools.length, 'front', 2).pools[poolIndex('torso')]
        .alone,
      Math.PI * r * r
    );
  });

  it('the whole robot covers at least its biggest pool from every side', () => {
    const { areas } = measureHitboxes(assembly.hitboxes, 4);
    for (const view of VIEW_NAMES) {
      const { total, pools } = areas[view];
      const biggest = Math.max(...pools.map((a) => a.withWeapons));
      expect(total.withWeapons, view).toBeGreaterThanOrEqual(biggest);
      // Weapons can sit wholly inside the rest of the silhouette (Hefty from
      // the side is hidden by the chassis + torso), so they never shrink it.
      expect(total.withWeapons, view).toBeGreaterThanOrEqual(total.alone);
    }
  });

  it('a mounted weapon grows its shoulder from the outer side', () => {
    const { bodies, pools } = assembly.hitboxes;
    const left = measureView(bodies, pools.length, 'left', 2).pools[
      poolIndex('shoulder:left')
    ];
    expect(left.withWeapons).toBeGreaterThan(left.alone * 1.1);
  });
});

describe('assemble + compareHitboxes: Anansi A vs B with the left shoulder swapped', () => {
  const a = anansiHefty;
  const leftSlot = a.slots.find((s) => s.key === 'Shoulder_L');
  // Another released left shoulder with a heavy slot, so the weapon carries.
  const other = leftSlot?.options.find(
    (id) =>
      id !== a.selection.Shoulder_L &&
      resolveComparison(a, { Shoulder_L: id }, tables, index).b.selection[
        'Shoulder_L.Shoulder_Weapon_0'
      ] === 'DA_Module_Weapon_Hefty.0'
  );
  let assemblyA: Assembly;
  let assemblyB: Assembly;
  let cmp: ComparisonMeasurement;
  const poolIndex = (of: Assembly, key: string): number =>
    of.hitboxes.pools.findIndex((p) => p.key === key);

  beforeAll(async () => {
    const { b } = resolveComparison(
      a,
      { Shoulder_L: other ?? null },
      tables,
      index
    );
    [assemblyA, assemblyB] = await Promise.all([
      assemble(toPresetModules(a), tables, cache),
      assemble(toPresetModules(b), tables, cache),
    ]);
    cmp = compareHitboxes(assemblyA.hitboxes, assemblyB.hitboxes, 4);
  });

  it('found a comparable shoulder', () => {
    expect(other).toBeDefined();
  });

  it('leaves every other pool unchanged', () => {
    for (const key of [
      'torso',
      'shoulder:right',
      `chassis:${ARMOR_ZONE_PELVIS}`,
    ]) {
      const ia = poolIndex(assemblyA, key);
      const ib = poolIndex(assemblyB, key);
      for (const view of VIEW_NAMES) {
        expect(cmp.views[view].b.pools[ib], `${key} ${view}`).toEqual(
          cmp.views[view].a.pools[ia]
        );
      }
    }
  });

  it('changes the left shoulder and the whole robot somewhere', () => {
    const ia = poolIndex(assemblyA, 'shoulder:left');
    const ib = poolIndex(assemblyB, 'shoulder:left');
    expect(
      VIEW_NAMES.some(
        (view) =>
          cmp.views[view].a.pools[ia].alone !==
          cmp.views[view].b.pools[ib].alone
      )
    ).toBe(true);
    expect(
      VIEW_NAMES.some(
        (view) =>
          cmp.views[view].a.total.withWeapons !==
          cmp.views[view].b.total.withWeapons
      )
    ).toBe(true);
  });

  it('the 3D diff shares everything but the left shoulder and its weapon', () => {
    const { sharedA, sharedB } = diffPlacements(
      assemblyA.placements,
      assemblyB.placements
    );
    const changed = (of: Assembly, shared: boolean[]): string[] =>
      of.placements
        .filter((_, i) => !shared[i])
        .map((p) => p.socketName)
        .sort();
    // The swapped shoulder, plus its (moved) weapon on each side.
    expect(changed(assemblyA, sharedA)).toEqual([
      'Shoulder_L',
      'Shoulder_Weapon_0',
    ]);
    expect(changed(assemblyB, sharedB)).toEqual([
      'Shoulder_L',
      'Shoulder_Weapon_0',
    ]);
  });
});
