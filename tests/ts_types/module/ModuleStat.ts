import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { ModuleStat } from '../../../src/types/module';
import type { LocalizationKey } from '../../../src/types/localization';

describe('ModuleStat interface', () => {
  // Get the latest version directory
  const archiveDir = path.join(process.cwd(), 'WRFrontiersDB-Data', 'archive');
  const versions = fs.readdirSync(archiveDir).sort().reverse();
  const latestVersion = versions[0];
  const moduleStatPath = path.join(
    archiveDir,
    latestVersion,
    'Objects',
    'ModuleStat.json'
  );

  const data = JSON.parse(fs.readFileSync(moduleStatPath, 'utf-8'));
  const moduleStats = Object.values(data) as ModuleStat[];

  // Define required and optional fields explicitly
  const requiredFields = ['id', 'stat_name', 'short_key'];
  const optionalFields = [
    'unit_name',
    'unit_scaler',
    'unit_exponent',
    'unit_baseline',
    'unit_pattern',
    'decimal_places',
    'more_is_better',
    'max_stat_value_ui',
    'max_stat_titan_value_ui',
  ];
  const allInterfaceFields = [
    ...requiredFields,
    ...optionalFields,
    'parseObjectClass',
    'parseObjectUrl',
  ];

  it('should have all required fields in every object', () => {
    moduleStats.forEach((moduleStat) => {
      requiredFields.forEach((field) => {
        expect(moduleStat).toHaveProperty(field);
        expect(moduleStat[field as keyof ModuleStat]).not.toBeUndefined();
      });
    });
  });

  it('should have nested LocalizationKey structure for stat_name', () => {
    moduleStats.forEach((moduleStat) => {
      const statName = moduleStat.stat_name as LocalizationKey;
      expect(statName).toHaveProperty('Key');
      expect(statName).toHaveProperty('TableNamespace');
      expect(statName).toHaveProperty('en');
      expect(typeof statName.Key).toBe('string');
      expect(typeof statName.TableNamespace).toBe('string');
      expect(typeof statName.en).toBe('string');
    });
  });

  it('should have nested LocalizationKey structure for unit_name when present', () => {
    const statsWithUnitName = moduleStats.filter((ms) => ms.unit_name);
    expect(statsWithUnitName.length).toBeGreaterThan(0);

    statsWithUnitName.forEach((moduleStat) => {
      const unitName = moduleStat.unit_name as LocalizationKey;
      expect(unitName).toHaveProperty('Key');
      expect(unitName).toHaveProperty('TableNamespace');
      expect(unitName).toHaveProperty('en');
      expect(typeof unitName.Key).toBe('string');
      expect(typeof unitName.TableNamespace).toBe('string');
      expect(typeof unitName.en).toBe('string');
    });
  });

  it('should have optional fields present in some but not all objects', () => {
    optionalFields.forEach((field) => {
      const objectsWithField = moduleStats.filter(
        (ms) => ms[field as keyof ModuleStat] !== undefined
      );
      const objectsWithoutField = moduleStats.filter(
        (ms) => ms[field as keyof ModuleStat] === undefined
      );

      expect(objectsWithField.length).toBeGreaterThan(0);
      expect(objectsWithoutField.length).toBeGreaterThan(0);
    });
  });

  it('should only contain fields defined in the interface', () => {
    moduleStats.forEach((moduleStat) => {
      Object.keys(moduleStat).forEach((key) => {
        expect(allInterfaceFields).toContain(key);
      });
    });
  });

  it('should have correct types for optional numeric fields', () => {
    const numericFields = [
      'unit_scaler',
      'unit_exponent',
      'unit_baseline',
      'decimal_places',
    ];

    moduleStats.forEach((moduleStat) => {
      numericFields.forEach((field) => {
        const value = moduleStat[field as keyof ModuleStat];
        if (value !== undefined) {
          expect(typeof value).toBe('number');
        }
      });
    });
  });

  it('should have correct type for more_is_better field', () => {
    const statsWithMoreIsBetter = moduleStats.filter(
      (ms) => ms.more_is_better !== undefined
    );
    expect(statsWithMoreIsBetter.length).toBeGreaterThan(0);

    statsWithMoreIsBetter.forEach((moduleStat) => {
      expect(typeof moduleStat.more_is_better).toBe('boolean');
    });
  });
});
