import { describe, it, expect } from 'vitest';
import { getParseObjects } from '../../../src/utils/parse_object';
import type { Module } from '../../../src/types/module';
import type { Pilot } from '../../../src/types/pilot';

describe('getParseObjects', () => {
  // Use real version from the data archive
  const testVersion = '2025-12-09';

  describe('successful loading', () => {
    it('should load Module objects and add parseObjectClass', () => {
      const result = getParseObjects<Module>(
        'Objects/Module.json',
        testVersion
      );

      // Should return a non-empty object
      expect(Object.keys(result).length).toBeGreaterThan(0);

      // Pick first object and verify structure
      const firstKey = Object.keys(result)[0];
      const firstModule = result[firstKey];

      expect(firstModule.parseObjectClass).toBe('Module');
      expect(firstModule.id).toBeDefined();
      expect(firstModule.inventory_icon_path).toBeDefined();
    });

    it('should load Pilot objects and add parseObjectClass', () => {
      const result = getParseObjects<Pilot>('Objects/Pilot.json', testVersion);

      expect(Object.keys(result).length).toBeGreaterThan(0);

      const firstKey = Object.keys(result)[0];
      const firstPilot = result[firstKey];

      expect(firstPilot.parseObjectClass).toBe('Pilot');
      expect(firstPilot.id).toBeDefined();
      expect(firstPilot.first_name).toBeDefined();
    });

    it('should extract parseObjectClass from different file paths', () => {
      const pilotClasses = getParseObjects(
        'Objects/PilotClass.json',
        testVersion
      );

      expect(Object.keys(pilotClasses).length).toBeGreaterThan(0);

      const firstKey = Object.keys(pilotClasses)[0];
      expect(pilotClasses[firstKey].parseObjectClass).toBe('PilotClass');
    });

    it('should handle different versions', () => {
      // Test with an older version
      const olderVersion = '2025-11-25';
      const result = getParseObjects('Objects/Module.json', olderVersion);

      expect(Object.keys(result).length).toBeGreaterThan(0);

      const firstKey = Object.keys(result)[0];
      expect(result[firstKey].parseObjectClass).toBe('Module');
    });

    it('should preserve all original object properties', () => {
      const result = getParseObjects<Module>(
        'Objects/Module.json',
        testVersion
      );
      const firstKey = Object.keys(result)[0];
      const module = result[firstKey];

      // Should have original properties plus parseObjectClass
      expect(module.id).toBeDefined();
      expect(module.parseObjectClass).toBe('Module');
      expect(module.inventory_icon_path).toBeDefined();

      // Verify it's a proper Module object with expected structure
      if (module.name) {
        expect(module.name).toHaveProperty('Key');
        expect(module.name).toHaveProperty('TableNamespace');
        expect(module.name).toHaveProperty('en');
      }
    });
  });

  describe('error handling', () => {
    it('should return empty object for non-existent version', () => {
      const result = getParseObjects('Objects/Module.json', '2000-01-01');

      expect(result).toEqual({});
      expect(Object.keys(result).length).toBe(0);
    });

    it('should return empty object for non-existent file', () => {
      const result = getParseObjects('Objects/NonExistent.json', testVersion);

      expect(result).toEqual({});
      expect(Object.keys(result).length).toBe(0);
    });

    it('should return empty object for invalid path', () => {
      const result = getParseObjects('InvalidPath/File.json', testVersion);

      expect(result).toEqual({});
    });
  });

  describe('parseObjectClass extraction', () => {
    it('should extract class name from simple file path', () => {
      const result = getParseObjects('Objects/Module.json', testVersion);
      const firstKey = Object.keys(result)[0];

      expect(result[firstKey].parseObjectClass).toBe('Module');
    });

    it('should handle nested paths correctly', () => {
      // Even if path has multiple parts, should extract from filename
      const result = getParseObjects('Objects/PilotTalent.json', testVersion);
      const firstKey = Object.keys(result)[0];

      expect(result[firstKey].parseObjectClass).toBe('PilotTalent');
    });
  });

  describe('return type', () => {
    it('should return Record<string, T> structure', () => {
      const result = getParseObjects('Objects/Module.json', testVersion);

      // Should be an object (not array)
      expect(typeof result).toBe('object');
      expect(Array.isArray(result)).toBe(false);

      // Keys should be strings
      const keys = Object.keys(result);
      expect(keys.length).toBeGreaterThan(0);
      expect(typeof keys[0]).toBe('string');

      // Values should be objects
      expect(typeof result[keys[0]]).toBe('object');
    });

    it('should allow generic type parameter', () => {
      // Test that TypeScript generic works
      const modules = getParseObjects<Module>(
        'Objects/Module.json',
        testVersion
      );
      const pilots = getParseObjects<Pilot>('Objects/Pilot.json', testVersion);

      const moduleKey = Object.keys(modules)[0];
      const pilotKey = Object.keys(pilots)[0];

      // Should have type-specific properties
      expect(modules[moduleKey].inventory_icon_path).toBeDefined();
      expect(pilots[pilotKey].first_name).toBeDefined();
    });
  });
});
