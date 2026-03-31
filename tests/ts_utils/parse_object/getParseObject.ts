import { describe, it, expect } from 'vitest';
import {
  getParseObject,
  getParseObjects,
} from '../../../src/utils/parse_object';
import type { Module } from '../../../src/types/module';
import type { Pilot } from '../../../src/types/pilot';

describe('getParseObject', () => {
  describe('successful retrieval', () => {
    it('should retrieve a specific Module by ID', () => {
      // Get any module ID using getParseObjects
      const allModules = getParseObjects<Module>('Objects/Module.json');
      const moduleId = Object.keys(allModules)[0];

      const result = getParseObject<Module>(moduleId, 'Objects/Module.json');

      expect(result).toBeDefined();
      expect(result.id).toBe(moduleId);
      expect(result.parseObjectClass).toBe('Module');
    });

    it('should use default parseObjectFile for Module', () => {
      const allModules = getParseObjects<Module>('Objects/Module.json');
      const moduleId = Object.keys(allModules)[0];

      // Should default to 'Objects/Module.json'
      const result = getParseObject<Module>(moduleId);

      expect(result).toBeDefined();
      expect(result.id).toBe(moduleId);
      expect(result.parseObjectClass).toBe('Module');
    });

    it('should retrieve a specific Pilot by ID', () => {
      const allPilots = getParseObjects<Pilot>('Objects/Pilot.json');
      const pilotId = Object.keys(allPilots)[0];

      const result = getParseObject<Pilot>(pilotId, 'Objects/Pilot.json');

      expect(result).toBeDefined();
      expect(result.id).toBe(pilotId);
      expect(result.parseObjectClass).toBe('Pilot');
      expect(result.first_name).toBeDefined();
    });

    it('should retrieve object from different object types', () => {
      const pilotClasses = getParseObjects('Objects/PilotClass.json');
      const pilotClassId = Object.keys(pilotClasses)[0];

      const result = getParseObject(pilotClassId, 'Objects/PilotClass.json');

      expect(result).toBeDefined();
      expect(result.id).toBe(pilotClassId);
      expect(result.parseObjectClass).toBe('PilotClass');
    });

    it('should return object with all original properties', () => {
      const allModules = getParseObjects<Module>('Objects/Module.json');
      const moduleId = Object.keys(allModules)[0];
      const expectedModule = allModules[moduleId];

      const result = getParseObject<Module>(moduleId, 'Objects/Module.json');

      // Should have all original properties plus parseObjectClass
      expect(result.inventory_icon_path).toBe(
        expectedModule.inventory_icon_path
      );
      expect(result.module_rarity_ref).toBe(expectedModule.module_rarity_ref);
      expect(result.parseObjectClass).toBe('Module');
    });
  });

  describe('error handling', () => {
    it('should throw error when object ID not found', () => {
      const nonExistentId = 'NON_EXISTENT_ID_12345';

      expect(() => {
        getParseObject(nonExistentId, 'Objects/Module.json');
      }).toThrow(`Object ${nonExistentId} not found in Objects/Module.json`);
    });

    it('should throw error with correct message for different files', () => {
      const nonExistentId = 'FAKE_PILOT_123';
      const parseObjectFile = 'Objects/Pilot.json';

      expect(() => {
        getParseObject(nonExistentId, parseObjectFile);
      }).toThrow(`Object ${nonExistentId} not found in ${parseObjectFile}`);
    });

    it('should throw error when file does not exist', () => {
      expect(() => {
        getParseObject('SOME_ID', 'Objects/NonExistent.json');
      }).toThrow('Object SOME_ID not found in Objects/NonExistent.json');
    });
  });

  describe('generic type parameter', () => {
    it('should work with Module generic type', () => {
      const allModules = getParseObjects<Module>('Objects/Module.json');
      const moduleId = Object.keys(allModules)[0];

      const result = getParseObject<Module>(moduleId, 'Objects/Module.json');

      // TypeScript should infer Module type
      expect(result.inventory_icon_path).toBeDefined();
      expect(result.module_rarity_ref).toBeDefined();
    });

    it('should work with Pilot generic type', () => {
      const allPilots = getParseObjects<Pilot>('Objects/Pilot.json');
      const pilotId = Object.keys(allPilots)[0];

      const result = getParseObject<Pilot>(pilotId, 'Objects/Pilot.json');

      // TypeScript should infer Pilot type
      expect(result.first_name).toBeDefined();
      expect(result.pilot_type_ref).toBeDefined();
    });

    it('should work without explicit generic type', () => {
      const allModules = getParseObjects('Objects/Module.json');
      const moduleId = Object.keys(allModules)[0];

      // Should default to ParseObject
      const result = getParseObject(moduleId, 'Objects/Module.json');

      expect(result.id).toBe(moduleId);
      expect(result.parseObjectClass).toBe('Module');
    });
  });

  describe('default parameter', () => {
    it('should use default parseObjectFile when not provided', () => {
      const allModules = getParseObjects<Module>('Objects/Module.json');
      const moduleId = Object.keys(allModules)[0];

      // Second parameter omitted, should default to 'Objects/Module.json'
      const result = getParseObject(moduleId);

      expect(result).toBeDefined();
      expect(result.parseObjectClass).toBe('Module');
    });

    it('should allow explicit parseObjectFile to override default', () => {
      const allPilots = getParseObjects<Pilot>('Objects/Pilot.json');
      const pilotId = Object.keys(allPilots)[0];

      // Explicitly provide non-default file
      const result = getParseObject(pilotId, 'Objects/Pilot.json');

      expect(result).toBeDefined();
      expect(result.parseObjectClass).toBe('Pilot');
    });
  });
});
