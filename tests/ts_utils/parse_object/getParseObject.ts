import { describe, it, expect } from 'vitest';
import { getParseObject, getParseObjects } from '../../../src/utils/parse_object';
import type { Module } from '../../../src/types/module';
import type { Pilot } from '../../../src/types/pilot';

describe('getParseObject', () => {
  const testVersion = '2025-12-09';

  describe('successful retrieval', () => {
    it('should retrieve a specific Module by ID', () => {
      // Get any module ID from the version using getParseObjects
      const allModules = getParseObjects<Module>('Objects/Module.json', testVersion);
      const moduleId = Object.keys(allModules)[0];

      const result = getParseObject<Module>(moduleId, testVersion, 'Objects/Module.json');

      expect(result).toBeDefined();
      expect(result.id).toBe(moduleId);
      expect(result.parseObjectClass).toBe('Module');
    });

    it('should use default parseObjectFile for Module', () => {
      const allModules = getParseObjects<Module>('Objects/Module.json', testVersion);
      const moduleId = Object.keys(allModules)[0];

      // Should default to 'Objects/Module.json'
      const result = getParseObject<Module>(moduleId, testVersion);

      expect(result).toBeDefined();
      expect(result.id).toBe(moduleId);
      expect(result.parseObjectClass).toBe('Module');
    });

    it('should retrieve a specific Pilot by ID', () => {
      const allPilots = getParseObjects<Pilot>('Objects/Pilot.json', testVersion);
      const pilotId = Object.keys(allPilots)[0];

      const result = getParseObject<Pilot>(pilotId, testVersion, 'Objects/Pilot.json');

      expect(result).toBeDefined();
      expect(result.id).toBe(pilotId);
      expect(result.parseObjectClass).toBe('Pilot');
      expect(result.first_name).toBeDefined();
    });

    it('should retrieve object from different object types', () => {
      const pilotClasses = getParseObjects('Objects/PilotClass.json', testVersion);
      const pilotClassId = Object.keys(pilotClasses)[0];

      const result = getParseObject(pilotClassId, testVersion, 'Objects/PilotClass.json');

      expect(result).toBeDefined();
      expect(result.id).toBe(pilotClassId);
      expect(result.parseObjectClass).toBe('PilotClass');
    });

    it('should work with different versions', () => {
      const olderVersion = '2025-11-25';
      const modules = getParseObjects<Module>('Objects/Module.json', olderVersion);
      const moduleId = Object.keys(modules)[0];

      const result = getParseObject<Module>(moduleId, olderVersion, 'Objects/Module.json');

      expect(result).toBeDefined();
      expect(result.id).toBe(moduleId);
    });

    it('should return object with all original properties', () => {
      const allModules = getParseObjects<Module>('Objects/Module.json', testVersion);
      const moduleId = Object.keys(allModules)[0];
      const expectedModule = allModules[moduleId];

      const result = getParseObject<Module>(moduleId, testVersion, 'Objects/Module.json');

      // Should have all original properties plus parseObjectClass
      expect(result.inventory_icon_path).toBe(expectedModule.inventory_icon_path);
      expect(result.module_rarity_id).toBe(expectedModule.module_rarity_id);
      expect(result.parseObjectClass).toBe('Module');
    });
  });

  describe('error handling', () => {
    it('should throw error when object ID not found', () => {
      const nonExistentId = 'NON_EXISTENT_ID_12345';

      expect(() => {
        getParseObject(nonExistentId, testVersion, 'Objects/Module.json');
      }).toThrow(`Object ${nonExistentId} not found in Objects/Module.json for version ${testVersion}`);
    });

    it('should throw error with correct message for different files', () => {
      const nonExistentId = 'FAKE_PILOT_123';
      const parseObjectFile = 'Objects/Pilot.json';

      expect(() => {
        getParseObject(nonExistentId, testVersion, parseObjectFile);
      }).toThrow(`Object ${nonExistentId} not found in ${parseObjectFile} for version ${testVersion}`);
    });

    it('should throw error when version does not exist', () => {
      const modules = getParseObjects<Module>('Objects/Module.json', testVersion);
      const moduleId = Object.keys(modules)[0];
      const invalidVersion = '2000-01-01';

      expect(() => {
        getParseObject(moduleId, invalidVersion, 'Objects/Module.json');
      }).toThrow(`Object ${moduleId} not found in Objects/Module.json for version ${invalidVersion}`);
    });

    it('should throw error when file does not exist', () => {
      expect(() => {
        getParseObject('SOME_ID', testVersion, 'Objects/NonExistent.json');
      }).toThrow('Object SOME_ID not found in Objects/NonExistent.json');
    });
  });

  describe('generic type parameter', () => {
    it('should work with Module generic type', () => {
      const allModules = getParseObjects<Module>('Objects/Module.json', testVersion);
      const moduleId = Object.keys(allModules)[0];

      const result = getParseObject<Module>(moduleId, testVersion, 'Objects/Module.json');

      // TypeScript should infer Module type
      expect(result.inventory_icon_path).toBeDefined();
      expect(result.module_rarity_id).toBeDefined();
    });

    it('should work with Pilot generic type', () => {
      const allPilots = getParseObjects<Pilot>('Objects/Pilot.json', testVersion);
      const pilotId = Object.keys(allPilots)[0];

      const result = getParseObject<Pilot>(pilotId, testVersion, 'Objects/Pilot.json');

      // TypeScript should infer Pilot type
      expect(result.first_name).toBeDefined();
      expect(result.pilot_type_id).toBeDefined();
    });

    it('should work without explicit generic type', () => {
      const allModules = getParseObjects('Objects/Module.json', testVersion);
      const moduleId = Object.keys(allModules)[0];

      // Should default to ParseObject
      const result = getParseObject(moduleId, testVersion, 'Objects/Module.json');

      expect(result.id).toBe(moduleId);
      expect(result.parseObjectClass).toBe('Module');
    });
  });

  describe('default parameter', () => {
    it('should use default parseObjectFile when not provided', () => {
      const allModules = getParseObjects<Module>('Objects/Module.json', testVersion);
      const moduleId = Object.keys(allModules)[0];

      // Third parameter omitted, should default to 'Objects/Module.json'
      const result = getParseObject(moduleId, testVersion);

      expect(result).toBeDefined();
      expect(result.parseObjectClass).toBe('Module');
    });

    it('should allow explicit parseObjectFile to override default', () => {
      const allPilots = getParseObjects<Pilot>('Objects/Pilot.json', testVersion);
      const pilotId = Object.keys(allPilots)[0];

      // Explicitly provide non-default file
      const result = getParseObject(pilotId, testVersion, 'Objects/Pilot.json');

      expect(result).toBeDefined();
      expect(result.parseObjectClass).toBe('Pilot');
    });
  });
});
