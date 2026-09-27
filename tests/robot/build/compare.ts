import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type {
  BuildSelection,
  BuildTables,
} from '../../../src/scripts/robot/build/types';
import { buildCompatibilityIndex } from '../../../src/scripts/robot/build/compatibility';
import { resolveBuild } from '../../../src/scripts/robot/build/graph';
import { slotKeyMatcher } from '../../../src/scripts/robot/build/params';
import { BuildStore } from '../../../src/scripts/robot/build/store';
import {
  CompareStore,
  readOverrides,
  resolveComparison,
  writeOverrides,
  type Comparison,
} from '../../../src/scripts/robot/build/compare';

const tables = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixture_tables.json'), 'utf8')
) as BuildTables;
const index = buildCompatibilityIndex(tables);

const HEAVY = 'DA_Module_WeaponHeavy.0';
const LIGHT = 'DA_Module_WeaponLight.0';
const TWIN = 'DA_Module_ShoulderTwin.0';
const BARE = 'DA_Module_ShoulderBare.0';

// Typhon: a bare left shoulder, a twin right shoulder with both weapons.
const aSelection: BuildSelection = {
  chassis: 'DA_Module_ChassisTyphon.0',
  Shoulder_L: BARE,
  Shoulder_R: TWIN,
  'Shoulder_R.Shoulder_Weapon_0': HEAVY,
  'Shoulder_R.Shoulder_Weapon_1': LIGHT,
};
const a = resolveBuild(aSelection, tables, index);

describe('resolveComparison', () => {
  it('B equals A with no overrides', () => {
    const { b, changed } = resolveComparison(a, {}, tables, index);
    expect(b.selection).toEqual(a.selection);
    expect(changed.size).toBe(0);
  });

  it('fills new weapon slots with A weapons of the same class', () => {
    const { b, changed } = resolveComparison(
      a,
      { Shoulder_L: TWIN },
      tables,
      index
    );
    expect(b.selection['Shoulder_L.Shoulder_Weapon_0']).toBe(HEAVY);
    expect(b.selection['Shoulder_L.Shoulder_Weapon_1']).toBe(LIGHT);
    expect([...changed].sort()).toEqual([
      'Shoulder_L',
      'Shoulder_L.Shoulder_Weapon_0',
      'Shoulder_L.Shoulder_Weapon_1',
    ]);
  });

  it('keeps a slot empty when A leaves it empty or B empties it', () => {
    const aOneWeapon = resolveBuild(
      { ...aSelection, 'Shoulder_R.Shoulder_Weapon_1': '' },
      tables,
      index
    );
    expect(aOneWeapon.selection['Shoulder_R.Shoulder_Weapon_1']).toBe(
      undefined
    );
    const same = resolveComparison(aOneWeapon, {}, tables, index);
    expect(same.b.selection['Shoulder_R.Shoulder_Weapon_1']).toBe(undefined);

    const emptied = resolveComparison(
      a,
      { Shoulder_L: TWIN, 'Shoulder_L.Shoulder_Weapon_1': null },
      tables,
      index
    );
    expect(emptied.b.selection['Shoulder_L.Shoulder_Weapon_0']).toBe(HEAVY);
    expect(emptied.b.selection['Shoulder_L.Shoulder_Weapon_1']).toBe(undefined);
  });

  it('marks slots B drops as changed', () => {
    const { b, changed } = resolveComparison(
      a,
      { Shoulder_R: BARE },
      tables,
      index
    );
    expect(b.selection['Shoulder_R.Shoulder_Weapon_0']).toBe(undefined);
    expect(changed.has('Shoulder_R')).toBe(true);
    expect(changed.has('Shoulder_R.Shoulder_Weapon_0')).toBe(true);
    expect(changed.has('Shoulder_R.Shoulder_Weapon_1')).toBe(true);
  });
});

describe('CompareStore', () => {
  const setup = () => {
    const store = new BuildStore(tables, index, aSelection);
    const compare = new CompareStore(store, tables, index);
    const seen: (Comparison | null)[] = [];
    compare.subscribe((c) => seen.push(c));
    return { store, compare, seen };
  };

  it('is off until enabled', () => {
    const { compare, seen } = setup();
    expect(compare.current).toBe(null);
    compare.setEnabled(true);
    expect(seen.at(-1)?.b.selection).toEqual(a.selection);
  });

  it('B follows A in slots it has not swapped', () => {
    const { store, compare } = setup();
    compare.setEnabled(true);
    compare.select('Shoulder_L', TWIN);
    store.select('Shoulder_R.Shoulder_Weapon_1', null);
    const b = compare.current!.b;
    expect(b.selection.Shoulder_L).toBe(TWIN);
    // Followed A's change on the right shoulder...
    expect(b.selection['Shoulder_R.Shoulder_Weapon_1']).toBe(undefined);
    // ...while the new left slots are still filled from A's weapons.
    expect(b.selection['Shoulder_L.Shoulder_Weapon_0']).toBe(HEAVY);
  });

  it("choosing A's module (or reverting) drops the override", () => {
    const { compare } = setup();
    compare.setEnabled(true);
    compare.select('Shoulder_L', TWIN);
    compare.select('Shoulder_L', BARE);
    expect(compare.currentOverrides).toEqual({});
    compare.select('Shoulder_L', TWIN);
    compare.revert('Shoulder_L');
    expect(compare.currentOverrides).toEqual({});
    expect(compare.current!.changed.size).toBe(0);
  });

  it('reset makes B equal A again', () => {
    const { compare } = setup();
    compare.setEnabled(true);
    compare.select('Shoulder_R', BARE);
    compare.reset();
    expect(compare.current!.b.selection).toEqual(a.selection);
  });
});

describe('override params', () => {
  const isSlotKey = slotKeyMatcher(index.socketNames);

  it('round-trips with a prefix, empty meaning emptied', () => {
    const params = new URLSearchParams('chassis=X&lang=ru&b.torso=OLD');
    writeOverrides(
      params,
      { Shoulder_L: TWIN, 'Shoulder_L.Shoulder_Weapon_1': null },
      isSlotKey
    );
    expect(params.get('chassis')).toBe('X');
    expect(params.get('lang')).toBe('ru');
    expect(params.has('b.torso')).toBe(false);
    expect(readOverrides(params, isSlotKey)).toEqual({
      Shoulder_L: TWIN,
      'Shoulder_L.Shoulder_Weapon_1': null,
    });
  });

  it('ignores unprefixed and non-slot params', () => {
    const params = new URLSearchParams('Shoulder_L=Y&b.lang=ru&b.chassis=Z');
    expect(readOverrides(params, isSlotKey)).toEqual({ chassis: 'Z' });
  });
});
