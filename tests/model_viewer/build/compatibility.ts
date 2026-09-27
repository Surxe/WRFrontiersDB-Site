import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { BuildTables } from '../../../src/scripts/model_viewer/build/types';

const tables = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixture_tables.json'), 'utf8')
) as BuildTables;

import { buildCompatibilityIndex } from '../../../src/scripts/model_viewer/build/compatibility';
import {
  kindOfModule,
  slotLabel,
} from '../../../src/scripts/model_viewer/build/classify';

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

describe('slotLabel', () => {
  it('names weapon slots by number with the socket type as hint', () => {
    const base = {
      key: 'k',
      path: [],
      parentKey: 'p',
      depth: 3,
      mountWay: null,
      required: false,
      fixed: false,
      options: [],
      moduleId: null,
    };
    expect(
      slotLabel(
        {
          ...base,
          socketName: 'Shoulder_Weapon_1',
          socketTypeId: 'DA_ModuleSocketType_Weapon.0',
          kind: 'weapon',
        },
        tables
      )
    ).toEqual({ label: 'Weapon 2', hint: 'Light Weapon' });
    expect(
      slotLabel(
        {
          ...base,
          socketName: 'Shoulder_L',
          socketTypeId: 'DA_ModuleSocketType_ShoulderL.0',
          kind: 'shoulder',
        },
        tables
      )
    ).toEqual({ label: 'Left Shoulder' });
  });
});
