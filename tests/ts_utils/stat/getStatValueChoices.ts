import { describe, it, expect } from 'vitest';
import { getStatValueChoices } from '../../../src/utils/stat';
import type { ModuleStat } from '../../../src/types/module';

describe('getStatValueChoices', () => {
  const mockModuleStats: Record<string, ModuleStat> = {
    'STAT_ARMOR.0': {
      id: 'STAT_ARMOR.0',
      parseObjectClass: 'ModuleStat',
      parseObjectUrl: 'module_stats',
      stat_name: { Key: 'stat_armor', TableNamespace: 'Stats', en: 'Armor' },
      short_key: 'ArmorBoost',
      unit_name: { Key: 'unit_percent', TableNamespace: 'Units', en: '%' },
      unit_scaler: 100,
      unit_exponent: 1.0,
      unit_baseline: 0,
      unit_pattern: {
        Key: 'pattern_percent',
        TableNamespace: 'Patterns',
        en: '{Amount}{Unit}',
      },
      decimal_places: 0,
      more_is_better: true,
    },
    'STAT_SPEED.0': {
      id: 'STAT_SPEED.0',
      parseObjectClass: 'ModuleStat',
      parseObjectUrl: 'module_stats',
      stat_name: { Key: 'stat_speed', TableNamespace: 'Stats', en: 'Speed' },
      short_key: 'SpeedBoost',
      unit_name: { Key: 'unit_mps', TableNamespace: 'Units', en: 'm/s' },
      unit_scaler: 1,
      unit_exponent: 1.0,
      unit_baseline: 0,
      unit_pattern: {
        Key: 'pattern_space',
        TableNamespace: 'Patterns',
        en: '{Amount} {Unit}',
      },
      decimal_places: 2,
      more_is_better: true,
    },
    'STAT_NO_SCALER.0': {
      id: 'STAT_NO_SCALER.0',
      parseObjectClass: 'ModuleStat',
      parseObjectUrl: 'module_stats',
      stat_name: {
        Key: 'stat_no_scaler',
        TableNamespace: 'Stats',
        en: 'No Scaler',
      },
      short_key: 'NoScaler',
      unit_name: undefined,
      unit_scaler: undefined,
      unit_exponent: undefined,
      unit_baseline: 0,
      unit_pattern: undefined,
      decimal_places: undefined,
      more_is_better: true,
    },
  };

  it('should return empty object for undefined stats', () => {
    const result = getStatValueChoices(undefined, mockModuleStats);
    expect(result).toEqual({});
  });

  it('should return empty object for empty stats array', () => {
    const result = getStatValueChoices([], mockModuleStats);
    expect(result).toEqual({});
  });

  it('should build StatValueChoices with scaling applied', () => {
    const stats = [
      { stat_ref: 'OBJID_ModuleStat::STAT_ARMOR.0', value: 0.06 },
      { stat_ref: 'OBJID_ModuleStat::STAT_SPEED.0', value: 5.5 },
    ];

    const result = getStatValueChoices(stats, mockModuleStats);

    expect(result).toHaveProperty('STAT_ARMOR.0');
    expect(result).toHaveProperty('STAT_SPEED.0');

    // Check STAT_ARMOR (0.06 * 100 = 6)
    expect(result['STAT_ARMOR.0'].pattern).toBe('{Amount}{Unit}');
    expect(result['STAT_ARMOR.0'].shortKey).toBe('ArmorBoost');
    expect(result['STAT_ARMOR.0'].unitName).toEqual({
      Key: 'unit_percent',
      TableNamespace: 'Units',
      en: '%',
    });
    expect(result['STAT_ARMOR.0'].unitExponent).toBe(1.0);
    expect(result['STAT_ARMOR.0'].decimalPlaces).toBe(0);
    expect(result['STAT_ARMOR.0'].choices[0]).toBe(6);

    // Check STAT_SPEED (5.5 * 1 = 5.5)
    expect(result['STAT_SPEED.0'].pattern).toBe('{Amount} {Unit}');
    expect(result['STAT_SPEED.0'].shortKey).toBe('SpeedBoost');
    expect(result['STAT_SPEED.0'].unitName?.Key).toBe('unit_mps');
    expect(result['STAT_SPEED.0'].unitExponent).toBe(1.0);
    expect(result['STAT_SPEED.0'].decimalPlaces).toBe(2);
    expect(result['STAT_SPEED.0'].choices[0]).toBe(5.5);
  });

  it('should use default values when properties are undefined', () => {
    const stats = [
      { stat_ref: 'OBJID_ModuleStat::STAT_NO_SCALER.0', value: 10 },
    ];

    const result = getStatValueChoices(stats, mockModuleStats);

    expect(result).toHaveProperty('STAT_NO_SCALER.0');
    // Default pattern should be '{Amount}{Unit}'
    expect(result['STAT_NO_SCALER.0'].pattern).toBe('{Amount}{Unit}');
    // Default scaler should be 1 (10 * 1 = 10)
    expect(result['STAT_NO_SCALER.0'].choices[0]).toBe(10);
    // unitName should be undefined
    expect(result['STAT_NO_SCALER.0'].unitName).toBeUndefined();
    // unitExponent should be undefined
    expect(result['STAT_NO_SCALER.0'].unitExponent).toBeUndefined();
    // decimalPlaces should be undefined
    expect(result['STAT_NO_SCALER.0'].decimalPlaces).toBeUndefined();
  });

  it('should skip stats with missing ModuleStat objects', () => {
    const stats = [
      { stat_ref: 'OBJID_ModuleStat::STAT_ARMOR.0', value: 0.06 },
      { stat_ref: 'OBJID_ModuleStat::STAT_MISSING.0', value: 100 },
    ];

    const result = getStatValueChoices(stats, mockModuleStats);

    expect(result).toHaveProperty('STAT_ARMOR.0');
    expect(result).not.toHaveProperty('STAT_MISSING.0');
  });

  it('should handle multiple stats correctly', () => {
    const stats = [
      { stat_ref: 'OBJID_ModuleStat::STAT_ARMOR.0', value: 0.5 },
      { stat_ref: 'OBJID_ModuleStat::STAT_SPEED.0', value: 10 },
      { stat_ref: 'OBJID_ModuleStat::STAT_NO_SCALER.0', value: 7 },
    ];

    const result = getStatValueChoices(stats, mockModuleStats);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result['STAT_ARMOR.0'].choices[0]).toBe(50); // 0.5 * 100
    expect(result['STAT_SPEED.0'].choices[0]).toBe(10); // 10 * 1
    expect(result['STAT_NO_SCALER.0'].choices[0]).toBe(7); // 7 * 1
  });

  it('should preserve all ModuleStat properties in StatValueChoices', () => {
    const stats = [{ stat_ref: 'OBJID_ModuleStat::STAT_ARMOR.0', value: 0.1 }];

    const result = getStatValueChoices(stats, mockModuleStats);

    const statChoice = result['STAT_ARMOR.0'];
    expect(statChoice).toHaveProperty('pattern');
    expect(statChoice).toHaveProperty('unitName');
    expect(statChoice).toHaveProperty('unitExponent');
    expect(statChoice).toHaveProperty('decimalPlaces');
    expect(statChoice).toHaveProperty('shortKey');
    expect(statChoice).toHaveProperty('choices');
    expect(statChoice.choices).toHaveProperty('0');
  });
});
