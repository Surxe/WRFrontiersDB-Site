import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { BuildTables } from '../../../src/scripts/robot/build/types';
import { buildCompatibilityIndex } from '../../../src/scripts/robot/build/compatibility';
import {
  findChassis,
  kindOfModule,
} from '../../../src/scripts/robot/build/classify';

const tables = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixture_tables.json'), 'utf8')
) as BuildTables;
const index = buildCompatibilityIndex(tables);

describe('buildCompatibilityIndex', () => {
  it('lists chassis modules, robots before titans', () => {
    expect(index.rootModules).toEqual([
      'DA_Module_ChassisAres.0',
      'DA_Module_ChassisTyphon.0',
      'DA_Module_ChassisAlpha.0',
    ]);
  });

  it('resolves exclusive-only socket types', () => {
    expect(index.compatible('DA_ModuleSocketType_Weapon.0')).toEqual([
      'DA_Module_WeaponLight.0',
      'DA_Module_WeaponSecret.0', // unreleased sorts last
    ]);
  });

  it('merges compatible + exclusive types (heavy slots take light weapons too)', () => {
    expect(index.compatible('DA_ModuleSocketType_WeaponHeavy.0')).toEqual([
      'DA_Module_WeaponHeavy.0',
      'DA_Module_WeaponLight.0',
      'DA_Module_WeaponSecret.0',
    ]);
  });

  it('keeps titan socket types to their own parts', () => {
    expect(
      index.compatible('DA_ModuleSocketType_TitanAlphaShoulderL.0')
    ).toEqual(['DA_Module_ShoulderLAlpha.0']);
    expect(
      index.fits(
        'DA_Module_ShoulderTwin.0',
        'DA_ModuleSocketType_TitanAlphaShoulderL.0'
      )
    ).toBe(false);
    expect(
      index.fits('DA_Module_WeaponHeavy.0', 'DA_ModuleSocketType_Weapon.0')
    ).toBe(false);
    expect(
      index.fits('DA_Module_WeaponHeavy.0', 'DA_ModuleSocketType_WeaponHeavy.0')
    ).toBe(true);
  });

  it('returns nothing for an unknown socket type', () => {
    expect(index.compatible('DA_ModuleSocketType_Nope.0')).toEqual([]);
  });

  it('collects every socket name', () => {
    expect([...index.socketNames].sort()).toEqual([
      'Ability',
      'Root',
      'Shoulder_L',
      'Shoulder_R',
      'Shoulder_Weapon_0',
      'Shoulder_Weapon_1',
      'Torso_Weapon_0',
    ]);
  });
});

describe('kindOfModule', () => {
  it('classifies via ModuleType -> ModuleCategory', () => {
    expect(kindOfModule('DA_Module_ChassisAlpha.0', tables)).toBe('chassis');
    expect(kindOfModule('DA_Module_ShoulderRAlpha.0', tables)).toBe('shoulder');
    expect(kindOfModule('DA_Module_WeaponTitan.0', tables)).toBe('weapon');
    expect(kindOfModule('DA_Module_AbilityDash.0', tables)).toBe('ability');
    expect(kindOfModule('DA_Module_Missing.0', tables)).toBe('other');
  });
});

describe('findChassis', () => {
  it("picks a bot's chassis from its core modules", () => {
    expect(
      findChassis(
        ['DA_Module_ShoulderRAlpha.0', 'DA_Module_ChassisAlpha.0'],
        tables
      )
    ).toBe('DA_Module_ChassisAlpha.0');
    expect(findChassis(['DA_Module_ShoulderRAlpha.0'], tables)).toBeUndefined();
  });
});
