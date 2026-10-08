import { describe, it, expect } from 'vitest';
import {
  getModuleStatRows,
  moduleArmorStatKeys,
  moduleLevelStats,
  moduleWeaponSlots,
} from '../../../src/utils/module_stats';
import { resolveStatDisplay } from '../../../src/utils/stat_display';
import type { ObjectLoader } from '../../../src/utils/parse_object';
import type { Module } from '../../../src/types/module';

const text = (value: string) => ({ InvariantString: value });

const OBJECTS: Record<string, Record<string, unknown>> = {
  'Objects/ModuleType.json': {
    'Chassis.0': {
      id: 'Chassis.0',
      module_category_ref: 'OBJID_ModuleCategory::DA_ModuleCategory_Chassis.0',
    },
    'Shoulder.0': {
      id: 'Shoulder.0',
      module_category_ref: 'OBJID_ModuleCategory::DA_ModuleCategory_Shoulder.0',
    },
    'TitanShoulder.0': {
      id: 'TitanShoulder.0',
      module_category_ref: 'OBJID_ModuleCategory::DA_ModuleCategory_Shoulder.0',
      character_type: 'Titan',
    },
    'Weapon.0': {
      id: 'Weapon.0',
      module_category_ref: 'OBJID_ModuleCategory::DA_ModuleCategory_Weapon.0',
    },
    'Ability.0': {
      id: 'Ability.0',
      module_category_ref: 'OBJID_ModuleCategory::DA_ModuleCategory_Ability.0',
    },
  },
  'Objects/ModuleSocketType.json': {
    'LightSocket.0': {
      id: 'LightSocket.0',
      name: text('Light Weapon'),
      compatible_module_types_refs: ['OBJID_ModuleType::Weapon.0'],
    },
    'AbilitySocket.0': {
      id: 'AbilitySocket.0',
      name: text('Gear'),
      compatible_module_types_refs: ['OBJID_ModuleType::Ability.0'],
    },
  },
  'Objects/CharacterModule.json': {
    'CM_Chassis.0': {
      id: 'CM_Chassis.0',
      meshes: [
        { armor_zone: 'Pelvis.0' },
        { armor_zone: 'LeftLeg.0' },
        { armor_zone: 'LeftLeg.0' },
        { armor_zone: 'RightLeg.0' },
      ],
    },
    'CM_ShoulderL.0': {
      id: 'CM_ShoulderL.0',
      meshes: [{ armor_zone: 'LeftShoulder.0' }],
    },
    'CM_ShoulderR.0': {
      id: 'CM_ShoulderR.0',
      meshes: [{ armor_zone: 'RightShoulder.0' }, { mesh_path: 'no zone' }],
    },
  },
  'Objects/ArmorZone.json': {
    'Pelvis.0': { id: 'Pelvis.0', stat_key: 'PelvisArmor' },
    'LeftLeg.0': { id: 'LeftLeg.0', stat_key: 'LegsArmor' },
    'RightLeg.0': { id: 'RightLeg.0', stat_key: 'LegsArmor' },
    'LeftShoulder.0': { id: 'LeftShoulder.0', stat_key: 'Armor' },
    'RightShoulder.0': { id: 'RightShoulder.0', stat_key: 'Armor' },
  },
  'Objects/Stat.json': {
    MaxSpeed: {
      id: 'MaxSpeed',
      module_stat_ref: 'OBJID_ModuleStat::MS_MaxSpeed.0',
    },
    PelvisArmor: {
      id: 'PelvisArmor',
      module_stat_ref: 'OBJID_ModuleStat::MS_PelvisArmor.0',
    },
    LegsArmor: {
      id: 'LegsArmor',
      module_stat_ref: 'OBJID_ModuleStat::MS_LegsArmor.0',
    },
    Armor: { id: 'Armor', module_stat_ref: 'OBJID_ModuleStat::MS_Armor.0' },
    ShieldAmount: {
      id: 'ShieldAmount',
      module_stat_ref: 'OBJID_ModuleStat::MS_Shield.0',
    },
    WeightDrain: {
      id: 'WeightDrain',
      module_stat_ref: 'OBJID_ModuleStat::MS_Weight.0',
    },
  },
  'Objects/ModuleStat.json': {
    'MS_MaxSpeed.0': {
      id: 'MS_MaxSpeed.0',
      short_key: 'MaxSpeed',
      stat_name: { Key: 'MaxSpeed', TableNamespace: 'Test', en: 'Max Speed' },
      unit_name: 'km/h',
      unit_scaler: 0.036,
    },
    'MS_PelvisArmor.0': {
      id: 'MS_PelvisArmor.0',
      short_key: 'PelvisArmor',
      stat_name: {
        Key: 'Pelvis',
        TableNamespace: 'Test',
        en: 'Central-Section Armor',
      },
    },
    'MS_LegsArmor.0': {
      id: 'MS_LegsArmor.0',
      short_key: 'LegsArmor',
      stat_name: {
        Key: 'Legs',
        TableNamespace: 'Test',
        en: 'Side-Section Armor (each)',
      },
    },
    'MS_Armor.0': {
      id: 'MS_Armor.0',
      short_key: 'Armor',
      stat_name: { Key: 'Armor', TableNamespace: 'Test', en: 'Armor' },
    },
    'MS_Shield.0': {
      id: 'MS_Shield.0',
      short_key: 'ShieldAmt',
      stat_name: { Key: 'Shield', TableNamespace: 'Test', en: 'Shield' },
    },
    'MS_Weight.0': {
      id: 'MS_Weight.0',
      short_key: 'WeightDrain',
      stat_name: { Key: 'Weight', TableNamespace: 'Test', en: 'Weight used' },
    },
  },
};

const load: ObjectLoader = <T>(file: string) =>
  (OBJECTS[file] ?? {}) as Record<string, T>;

const module = (
  fields: Partial<Module> & {
    constants?: Record<string, unknown>;
    top?: Record<string, unknown>;
  }
) =>
  ({
    id: 'M.0',
    parseObjectClass: 'Module',
    character_module_mounts: [],
    module_scalars: {
      levels: {
        constants: fields.constants ?? {},
        variables: [{ Lvl1Only: 1 }, fields.top ?? {}],
      },
    },
    ...fields,
  }) as unknown as Module;

const chassis = module({
  module_type_ref: 'OBJID_ModuleType::Chassis.0',
  character_module_mounts: [
    {
      character_module_ref: 'OBJID_CharacterModule::CM_Chassis.0',
      mount: 'Standard',
    },
  ],
  top: { MaxSpeed: 3027.7778, PelvisArmor: 62500, LegsArmor: 64400 },
});

const shoulderMounts = [
  {
    character_module_ref: 'OBJID_CharacterModule::CM_ShoulderL.0',
    mount: 'Left' as const,
  },
  {
    character_module_ref: 'OBJID_CharacterModule::CM_ShoulderR.0',
    mount: 'Right' as const,
  },
];
const shoulderSockets = [
  { name: 'W0', socket_type_ref: 'OBJID_ModuleSocketType::LightSocket.0' },
  {
    name: 'W1',
    socket_type_ref: 'OBJID_ModuleSocketType::LightSocket.0',
    mount_way: 'Inherited' as const,
  },
  { name: 'G', socket_type_ref: 'OBJID_ModuleSocketType::AbilitySocket.0' },
];

describe('moduleLevelStats', () => {
  it('overlays the level on the constants', () => {
    const m = module({
      constants: { WeightDrain: 12, Armor: 1 },
      top: { Armor: 2 },
    });
    expect(moduleLevelStats(m, 1)).toEqual({ WeightDrain: 12, Armor: 2 });
    expect(moduleLevelStats(m, 0)).toEqual({
      WeightDrain: 12,
      Armor: 1,
      Lvl1Only: 1,
    });
  });
});

describe('moduleArmorStatKeys', () => {
  it('gives one stat per distinct zone stat, in mesh order', () => {
    expect(
      moduleArmorStatKeys(
        chassis,
        load('Objects/CharacterModule.json'),
        load('Objects/ArmorZone.json')
      )
    ).toEqual(['PelvisArmor', 'LegsArmor']);
  });

  it("merges a shoulder's two mounts and skips unknown zones", () => {
    const shoulder = module({ character_module_mounts: shoulderMounts });
    expect(
      moduleArmorStatKeys(
        shoulder,
        load('Objects/CharacterModule.json'),
        load('Objects/ArmorZone.json')
      )
    ).toEqual(['Armor']);
    expect(
      moduleArmorStatKeys(shoulder, load('Objects/CharacterModule.json'), {})
    ).toEqual([]);
  });
});

describe('moduleWeaponSlots', () => {
  it('counts weapon sockets per socket type, ignoring other sockets', () => {
    const slots = moduleWeaponSlots(
      module({ sockets: shoulderSockets }),
      load('Objects/ModuleSocketType.json'),
      load('Objects/ModuleType.json')
    );
    expect(slots.map((s) => [s.socketType.id, s.count])).toEqual([
      ['LightSocket.0', 2],
    ]);
  });
});

describe('getModuleStatRows', () => {
  const summary = (m: Module) =>
    getModuleStatRows(m, 1, load).map((row) =>
      row.map((line) =>
        line.kind === 'stat'
          ? [line.display.shortKey, line.value]
          : ['slots', line.count]
      )
    );

  it('summarizes a chassis in rows, leaving out missing stats and empty rows', () => {
    expect(summary(chassis)).toEqual([
      [['MaxSpeed', 3027.7778]],
      [
        ['PelvisArmor', 62500],
        ['LegsArmor', 64400],
      ],
    ]);
  });

  it('gives standard shoulders weapon slots and weight, titan shoulders neither', () => {
    const fields = {
      character_module_mounts: shoulderMounts,
      sockets: shoulderSockets,
      constants: { WeightDrain: 12 },
      top: { Armor: 52100, ShieldAmount: 29000 },
    };
    expect(
      summary(
        module({ ...fields, module_type_ref: 'OBJID_ModuleType::Shoulder.0' })
      )
    ).toEqual([
      [
        ['slots', 2],
        ['WeightDrain', 12],
        ['Armor', 52100],
      ],
      [['ShieldAmt', 29000]],
    ]);
    expect(
      summary(
        module({
          ...fields,
          module_type_ref: 'OBJID_ModuleType::TitanShoulder.0',
        })
      )
    ).toEqual([[['Armor', 52100]], [['ShieldAmt', 29000]]]);
  });

  it('leaves out zero stats and has nothing for non-armor modules', () => {
    const zeroWeight = module({
      module_type_ref: 'OBJID_ModuleType::Shoulder.0',
      constants: { WeightDrain: 0 },
    });
    expect(summary(zeroWeight)).toEqual([]);
    expect(
      summary(
        module({
          module_type_ref: 'OBJID_ModuleType::Weapon.0',
          top: { Armor: 5 },
        })
      )
    ).toEqual([]);
  });
});

describe('resolveStatDisplay', () => {
  const stats = load('Objects/Stat.json') as never;
  const moduleStats = load('Objects/ModuleStat.json') as never;

  it('takes the ModuleStat name, unit and scaler', () => {
    const display = resolveStatDisplay('MaxSpeed', stats, moduleStats);
    expect(display.labelKey?.en).toBe('Max Speed');
    expect(display.unitScaler).toBe(0.036);
    expect(display.shortKey).toBe('MaxSpeed');
  });

  it('uses the synthetic label for Parser-derived stats', () => {
    const display = resolveStatDisplay('RechargeDelay', stats, moduleStats);
    expect(display.labelKey?.en).toBe('Regen Delay');
    expect(display.unitScaler).toBe(1);
  });
});
