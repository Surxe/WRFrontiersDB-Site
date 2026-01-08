import { describe, it, expect } from 'vitest';
import type { LocalizationKey, LocalizationData } from '../../src/types/localization';

describe('LocalizationKey', () => {
  it('should accept a valid LocalizationKey object', () => {
    const validKey: LocalizationKey = {
      Key: 'MOD_ArmorShield_Name',
      TableNamespace: 'Modules',
      en: 'Armor Shield'
    };

    expect(validKey.Key).toBe('MOD_ArmorShield_Name');
    expect(validKey.TableNamespace).toBe('Modules');
    expect(validKey.en).toBe('Armor Shield');
  });

  it('should support empty strings in required fields', () => {
    const keyWithEmptyStrings: LocalizationKey = {
      Key: '',
      TableNamespace: '',
      en: ''
    };

    expect(keyWithEmptyStrings.Key).toBe('');
    expect(keyWithEmptyStrings.TableNamespace).toBe('');
    expect(keyWithEmptyStrings.en).toBe('');
  });

  it('should accept special characters in fields', () => {
    const keyWithSpecialChars: LocalizationKey = {
      Key: 'MOD_Test-123_Name!@#',
      TableNamespace: 'Test/Namespace',
      en: 'Test & Display "Name" <value>'
    };

    expect(keyWithSpecialChars.Key).toContain('!@#');
    expect(keyWithSpecialChars.TableNamespace).toContain('/');
    expect(keyWithSpecialChars.en).toContain('&');
  });

  it('should support long text in en field', () => {
    const keyWithLongText: LocalizationKey = {
      Key: 'LONG_DESC',
      TableNamespace: 'Descriptions',
      en: 'This is a very long description that might span multiple lines and contain lots of detailed information about the game mechanic or object that needs to be localized properly.'
    };

    expect(keyWithLongText.en.length).toBeGreaterThan(100);
  });

  it('should work in arrays', () => {
    const keys: LocalizationKey[] = [
      { Key: 'KEY_1', TableNamespace: 'NS1', en: 'Value 1' },
      { Key: 'KEY_2', TableNamespace: 'NS2', en: 'Value 2' },
      { Key: 'KEY_3', TableNamespace: 'NS3', en: 'Value 3' }
    ];

    expect(keys).toHaveLength(3);
    expect(keys[0].Key).toBe('KEY_1');
    expect(keys[2].en).toBe('Value 3');
  });
});

describe('LocalizationData', () => {
  it('should accept a valid LocalizationData object', () => {
    const validData: LocalizationData = {
      Modules: {
        MOD_ArmorShield_Name: 'Armor Shield',
        MOD_ArmorShield_Desc: 'Provides additional armor protection'
      }
    };

    expect(validData.Modules.MOD_ArmorShield_Name).toBe('Armor Shield');
    expect(validData.Modules.MOD_ArmorShield_Desc).toBe('Provides additional armor protection');
  });

  it('should support multiple namespaces', () => {
    const multiNamespaceData: LocalizationData = {
      Modules: {
        MOD_Test: 'Test Module'
      },
      Pilots: {
        PILOT_TestPilot: 'Test Pilot'
      },
      Abilities: {
        ABL_Test: 'Test Ability'
      }
    };

    expect(Object.keys(multiNamespaceData)).toHaveLength(3);
    expect(multiNamespaceData.Modules.MOD_Test).toBe('Test Module');
    expect(multiNamespaceData.Pilots.PILOT_TestPilot).toBe('Test Pilot');
    expect(multiNamespaceData.Abilities.ABL_Test).toBe('Test Ability');
  });

  it('should support empty namespaces', () => {
    const emptyNamespace: LocalizationData = {
      EmptyNamespace: {}
    };

    expect(emptyNamespace.EmptyNamespace).toEqual({});
    expect(Object.keys(emptyNamespace.EmptyNamespace)).toHaveLength(0);
  });

  it('should support empty LocalizationData object', () => {
    const emptyData: LocalizationData = {};

    expect(emptyData).toEqual({});
    expect(Object.keys(emptyData)).toHaveLength(0);
  });

  it('should allow dynamic namespace and key access', () => {
    const data: LocalizationData = {
      TestNamespace: {
        TestKey: 'Test Value'
      }
    };

    const namespace = 'TestNamespace';
    const key = 'TestKey';

    expect(data[namespace][key]).toBe('Test Value');
  });

  it('should support nested lookup pattern', () => {
    const data: LocalizationData = {
      Modules: {
        MOD_1: 'Module 1',
        MOD_2: 'Module 2'
      },
      Pilots: {
        PILOT_1: 'Pilot 1',
        PILOT_2: 'Pilot 2'
      }
    };

    // Simulating two-level lookup: locData[namespace][key]
    const lookupValue = (namespace: string, key: string): string | undefined => {
      return data[namespace]?.[key];
    };

    expect(lookupValue('Modules', 'MOD_1')).toBe('Module 1');
    expect(lookupValue('Pilots', 'PILOT_2')).toBe('Pilot 2');
    expect(lookupValue('NonExistent', 'KEY')).toBeUndefined();
    expect(lookupValue('Modules', 'NonExistentKey')).toBeUndefined();
  });

  it('should handle special characters in keys and values', () => {
    const data: LocalizationData = {
      'Special/Namespace': {
        'Key-With-Dashes': 'Value with "quotes"',
        'Key_With_Underscores': 'Value with <html> & symbols'
      }
    };

    expect(data['Special/Namespace']['Key-With-Dashes']).toContain('quotes');
    expect(data['Special/Namespace']['Key_With_Underscores']).toContain('<html>');
  });

  it('should support numeric string keys', () => {
    const data: LocalizationData = {
      Numbers: {
        '1': 'One',
        '2': 'Two',
        '100': 'One Hundred'
      }
    };

    expect(data.Numbers['1']).toBe('One');
    expect(data.Numbers['100']).toBe('One Hundred');
  });

  it('should work with entries and iteration', () => {
    const data: LocalizationData = {
      NS1: { KEY1: 'Value 1' },
      NS2: { KEY2: 'Value 2' }
    };

    const namespaces = Object.keys(data);
    expect(namespaces).toEqual(['NS1', 'NS2']);

    const keys = Object.keys(data.NS1);
    expect(keys).toEqual(['KEY1']);
  });

  it('should support transformation from LocalizationKey array', () => {
    const keys: LocalizationKey[] = [
      { Key: 'MOD_1_Name', TableNamespace: 'Modules', en: 'Module 1' },
      { Key: 'MOD_1_Desc', TableNamespace: 'Modules', en: 'Description 1' },
      { Key: 'PILOT_1_Name', TableNamespace: 'Pilots', en: 'Pilot 1' }
    ];

    // Transform array to LocalizationData structure
    const data: LocalizationData = keys.reduce((acc, item) => {
      if (!acc[item.TableNamespace]) {
        acc[item.TableNamespace] = {};
      }
      acc[item.TableNamespace][item.Key] = item.en;
      return acc;
    }, {} as LocalizationData);

    expect(data.Modules.MOD_1_Name).toBe('Module 1');
    expect(data.Modules.MOD_1_Desc).toBe('Description 1');
    expect(data.Pilots.PILOT_1_Name).toBe('Pilot 1');
    expect(Object.keys(data)).toHaveLength(2);
  });
});
