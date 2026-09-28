import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { BuildTables } from '../../../src/scripts/robot/build/types';

const tables = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixture_tables.json'), 'utf8')
) as BuildTables;

import { buildCompatibilityIndex } from '../../../src/scripts/robot/build/compatibility';
import { BuildStore } from '../../../src/scripts/robot/build/store';

describe('BuildStore', () => {
  const index = buildCompatibilityIndex(tables);

  it('resolves the initial selection', () => {
    const store = new BuildStore(tables, index, {
      chassis: 'DA_Module_ChassisTyphon.0',
    });
    expect(store.current.selection.torso).toBe('DA_Module_TorsoTyphon.0');
  });

  it('select() fills and clears slots and notifies subscribers', () => {
    const store = new BuildStore(tables, index, {
      chassis: 'DA_Module_ChassisTyphon.0',
    });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.select('Torso_Weapon_0', 'DA_Module_WeaponHeavy.0');
    expect(store.current.selection.Torso_Weapon_0).toBe(
      'DA_Module_WeaponHeavy.0'
    );
    expect(listener).toHaveBeenCalledTimes(1);

    store.select('Torso_Weapon_0', null);
    expect(store.current.selection.Torso_Weapon_0).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.select('Torso_Weapon_0', 'DA_Module_WeaponHeavy.0');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('clearing a required slot refills it', () => {
    const store = new BuildStore(tables, index, {
      chassis: 'DA_Module_ChassisTyphon.0',
    });
    store.select('torso', null);
    expect(store.current.selection.torso).toBe('DA_Module_TorsoTyphon.0');
  });
});
