import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { BuildTables } from '../../../src/scripts/model_viewer/build/types';

const tables = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixture_tables.json'), 'utf8')
) as BuildTables;

import { buildCompatibilityIndex } from '../../../src/scripts/model_viewer/build/compatibility';
import {
  resolveBuild,
  selectionFromPreset,
  slotKeyForPath,
  toPresetModules,
} from '../../../src/scripts/model_viewer/build/graph';

const index = buildCompatibilityIndex(tables);
const resolve = (selection: Record<string, string>) =>
  resolveBuild(selection, tables, index);
const keys = (selection: Record<string, string>) =>
  resolve(selection).slots.map((s) => s.key);

describe('slotKeyForPath', () => {
  it('maps socket paths to mount-location keys', () => {
    expect(slotKeyForPath([])).toBe('chassis');
    expect(slotKeyForPath(['Root'])).toBe('torso');
    expect(slotKeyForPath(['Root', 'Shoulder_L'])).toBe('Shoulder_L');
    expect(slotKeyForPath(['Root', 'Shoulder_L', 'Shoulder_Weapon_0'])).toBe(
      'Shoulder_L.Shoulder_Weapon_0'
    );
  });
});

describe('resolveBuild', () => {
  it('defaults to the first released robot chassis with required parts filled', () => {
    const build = resolve({});
    expect(build.selection).toEqual({
      chassis: 'DA_Module_ChassisAres.0',
      torso: 'DA_Module_TorsoAres.0',
      Shoulder_L: 'DA_Module_ShoulderBare.0',
      Shoulder_R: 'DA_Module_ShoulderBare.0',
    });
  });

  it("fills required slots from the chassis's own core modules", () => {
    const build = resolve({ chassis: 'DA_Module_ChassisTyphon.0' });
    expect(build.selection.torso).toBe('DA_Module_TorsoTyphon.0');
    expect(build.selection.Shoulder_L).toBe('DA_Module_ShoulderTwin.0');
    expect(build.selection.Shoulder_R).toBe('DA_Module_ShoulderTwin.0');
  });

  it('cascades: weapon and gear slots appear under their parent, empty by default', () => {
    expect(keys({ chassis: 'DA_Module_ChassisTyphon.0' })).toEqual([
      'chassis',
      'torso',
      'Shoulder_L',
      'Shoulder_L.Shoulder_Weapon_0',
      'Shoulder_L.Shoulder_Weapon_1',
      'Shoulder_R',
      'Shoulder_R.Shoulder_Weapon_0',
      'Shoulder_R.Shoulder_Weapon_1',
      'Torso_Weapon_0',
      'Ability',
    ]);
    const slot = resolve({ chassis: 'DA_Module_ChassisTyphon.0' }).slots.find(
      (s) => s.key === 'Torso_Weapon_0'
    )!;
    expect(slot.moduleId).toBeNull();
    expect(slot.required).toBe(false);
    expect(slot.kind).toBe('weapon');
    expect(slot.parentKey).toBe('torso');
    expect(slot.depth).toBe(2);
  });

  it('a shoulder with no weapon sockets has no child slots', () => {
    const k = keys({
      chassis: 'DA_Module_ChassisTyphon.0',
      Shoulder_L: 'DA_Module_ShoulderBare.0',
    });
    expect(k.filter((key) => key.startsWith('Shoulder_L'))).toEqual([
      'Shoulder_L',
    ]);
    expect(k).toContain('Shoulder_R.Shoulder_Weapon_1');
  });

  it('keeps chosen weapons, and drops ones that do not fit their slot', () => {
    const build = resolve({
      chassis: 'DA_Module_ChassisTyphon.0',
      'Shoulder_L.Shoulder_Weapon_0': 'DA_Module_WeaponHeavy.0',
      'Shoulder_L.Shoulder_Weapon_1': 'DA_Module_WeaponHeavy.0', // light-only slot
      Torso_Weapon_0: 'DA_Module_WeaponLight.0',
    });
    expect(build.selection['Shoulder_L.Shoulder_Weapon_0']).toBe(
      'DA_Module_WeaponHeavy.0'
    );
    expect(build.selection['Shoulder_L.Shoulder_Weapon_1']).toBeUndefined();
    expect(build.selection.Torso_Weapon_0).toBe('DA_Module_WeaponLight.0');
  });

  it('switching chassis keeps parts that still fit', () => {
    const build = resolve({
      chassis: 'DA_Module_ChassisAres.0',
      torso: 'DA_Module_TorsoTyphon.0',
      Torso_Weapon_0: 'DA_Module_WeaponHeavy.0',
    });
    expect(build.selection.torso).toBe('DA_Module_TorsoTyphon.0');
    expect(build.selection.Torso_Weapon_0).toBe('DA_Module_WeaponHeavy.0');
  });

  it('titans get their fixed torso + shoulders; standard parts are dropped', () => {
    const build = resolve({
      chassis: 'DA_Module_ChassisAlpha.0',
      torso: 'DA_Module_TorsoTyphon.0',
      Shoulder_L: 'DA_Module_ShoulderTwin.0',
      'Shoulder_R.Shoulder_Weapon_0': 'DA_Module_WeaponTitan.0',
    });
    expect(build.selection).toEqual({
      chassis: 'DA_Module_ChassisAlpha.0',
      torso: 'DA_Module_TorsoAlpha.0',
      Shoulder_L: 'DA_Module_ShoulderLAlpha.0',
      Shoulder_R: 'DA_Module_ShoulderRAlpha.0',
      'Shoulder_R.Shoulder_Weapon_0': 'DA_Module_WeaponTitan.0',
    });
    const torso = build.slots.find((s) => s.key === 'torso')!;
    expect(torso.fixed).toBe(true);
    expect(torso.options).toEqual(['DA_Module_TorsoAlpha.0']);
    const weapon = build.slots.find(
      (s) => s.key === 'Shoulder_R.Shoulder_Weapon_0'
    )!;
    expect(weapon.fixed).toBe(false);
    expect(weapon.options).toEqual(['DA_Module_WeaponTitan.0']);
  });

  it('hides unreleased modules unless selected', () => {
    const base = { chassis: 'DA_Module_ChassisTyphon.0' };
    const slot = (b: ReturnType<typeof resolve>) =>
      b.slots.find((s) => s.key === 'Shoulder_L.Shoulder_Weapon_1')!;
    expect(slot(resolve(base)).options).toEqual(['DA_Module_WeaponLight.0']);
    const withSecret = resolve({
      ...base,
      'Shoulder_L.Shoulder_Weapon_1': 'DA_Module_WeaponSecret.0',
    });
    expect(slot(withSecret).moduleId).toBe('DA_Module_WeaponSecret.0');
    expect(slot(withSecret).options).toEqual([
      'DA_Module_WeaponLight.0',
      'DA_Module_WeaponSecret.0',
    ]);
  });

  it('ignores an unknown chassis', () => {
    expect(resolve({ chassis: 'DA_Module_Nope.0' }).selection.chassis).toBe(
      'DA_Module_ChassisAres.0'
    );
  });
});

describe('toPresetModules / selectionFromPreset', () => {
  const selection = {
    chassis: 'DA_Module_ChassisTyphon.0',
    torso: 'DA_Module_TorsoTyphon.0',
    Shoulder_L: 'DA_Module_ShoulderTwin.0',
    'Shoulder_L.Shoulder_Weapon_1': 'DA_Module_WeaponLight.0',
    Shoulder_R: 'DA_Module_ShoulderBare.0',
    Torso_Weapon_0: 'DA_Module_WeaponHeavy.0',
  };

  it('flattens filled slots into a preset module list', () => {
    expect(toPresetModules(resolve(selection))).toEqual([
      {
        module_ref: 'OBJID_Module::DA_Module_ChassisTyphon.0',
        socket_name: 'None',
        parent_socket_index: -1,
        level: 1,
      },
      {
        module_ref: 'OBJID_Module::DA_Module_TorsoTyphon.0',
        socket_name: 'Root',
        parent_socket_index: 0,
        level: 1,
      },
      {
        module_ref: 'OBJID_Module::DA_Module_ShoulderTwin.0',
        socket_name: 'Shoulder_L',
        parent_socket_index: 1,
        level: 1,
      },
      {
        module_ref: 'OBJID_Module::DA_Module_WeaponLight.0',
        socket_name: 'Shoulder_Weapon_1',
        parent_socket_index: 2,
        level: 1,
      },
      {
        module_ref: 'OBJID_Module::DA_Module_ShoulderBare.0',
        socket_name: 'Shoulder_R',
        parent_socket_index: 1,
        level: 1,
      },
      {
        module_ref: 'OBJID_Module::DA_Module_WeaponHeavy.0',
        socket_name: 'Torso_Weapon_0',
        parent_socket_index: 1,
        level: 1,
      },
    ]);
  });

  it('round-trips through selectionFromPreset', () => {
    const modules = toPresetModules(resolve(selection));
    expect(selectionFromPreset(modules)).toEqual(selection);
  });

  it('skips excluded entries and their subtrees', () => {
    const modules = toPresetModules(resolve(selection));
    const noShoulderL = selectionFromPreset(
      modules,
      (id) => id !== 'DA_Module_ShoulderTwin.0'
    );
    expect(noShoulderL.Shoulder_L).toBeUndefined();
    expect(noShoulderL['Shoulder_L.Shoulder_Weapon_1']).toBeUndefined();
    expect(noShoulderL.Shoulder_R).toBe('DA_Module_ShoulderBare.0');
  });
});
