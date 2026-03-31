import { describe, it, expect } from 'vitest';
import {
  resolveObjectRef,
  resolveObjectRefs,
} from '../../../src/utils/object_resolver';
import type { ParseObject } from '../../../src/types/parse_object';

// Mock ParseObject for testing
interface MockObject extends ParseObject {
  id: string;
  name: string;
}

describe('resolveObjectRef', () => {
  describe('success cases', () => {
    it('should return correct object for valid reference', () => {
      const objects: Record<string, MockObject> = {
        test_id: {
          id: 'test_id',
          name: 'Test Object',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
        another_id: {
          id: 'another_id',
          name: 'Another Object',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
      };

      const result = resolveObjectRef('OBJID_Test::test_id', objects);
      expect(result).toEqual(objects['test_id']);
      expect(result?.name).toBe('Test Object');
    });

    it('should return undefined for missing ID', () => {
      const objects: Record<string, MockObject> = {
        existing_id: {
          id: 'existing_id',
          name: 'Existing Object',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
      };

      const result = resolveObjectRef('OBJID_Test::missing_id', objects);
      expect(result).toBeUndefined();
    });

    it('should work with different object types', () => {
      const objects: Record<string, MockObject> = {
        module_id: {
          id: 'module_id',
          name: 'Module Object',
          parseObjectClass: 'Module',
          parseObjectUrl: 'modules',
        },
      };

      const result = resolveObjectRef('OBJID_Module::module_id', objects);
      expect(result).toEqual(objects['module_id']);
    });
  });

  describe('edge cases', () => {
    it('should return undefined when objects record is empty', () => {
      const objects: Record<string, MockObject> = {};

      const result = resolveObjectRef('OBJID_Test::test_id', objects);
      expect(result).toBeUndefined();
    });

    it('should handle empty objects record', () => {
      const objects: Record<string, MockObject> = {};

      const result = resolveObjectRef('OBJID_Test::test_id', objects);
      expect(result).toBeUndefined();
    });

    it('should work with undefined objects', () => {
      const objects: Record<string, MockObject> | undefined = undefined;

      if (objects) {
        const result = resolveObjectRef('OBJID_Test::test_id', objects);
        expect(result).toBeUndefined();
      }
    });
  });

  describe('type safety', () => {
    it('should work with generic types', () => {
      interface SpecificObject extends ParseObject {
        specificField: string;
      }

      const objects: Record<string, SpecificObject> = {
        test_id: {
          id: 'test_id',
          specificField: 'specific value',
          parseObjectClass: 'Specific',
          parseObjectUrl: 'specific',
        },
      };

      const result = resolveObjectRef<SpecificObject>(
        'OBJID_Specific::test_id',
        objects
      );
      expect(result?.specificField).toBe('specific value');
    });
  });
});

describe('resolveObjectRefs', () => {
  describe('success cases', () => {
    it('should return array of resolved objects for valid refs', () => {
      const objects: Record<string, MockObject> = {
        test_id: {
          id: 'test_id',
          name: 'Test Object 1',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
        test_id_2: {
          id: 'test_id_2',
          name: 'Test Object 2',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
        test_id_3: {
          id: 'test_id_3',
          name: 'Test Object 3',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
      };

      const refs = [
        'OBJID_Test::test_id',
        'OBJID_Test::test_id_2',
        'OBJID_Test::test_id_3',
      ];
      const result = resolveObjectRefs(refs, objects);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(objects['test_id']);
      expect(result[1]).toEqual(objects['test_id_2']);
      expect(result[2]).toEqual(objects['test_id_3']);
    });

    it('should filter out undefined objects', () => {
      const objects: Record<string, MockObject> = {
        existing_id: {
          id: 'existing_id',
          name: 'Existing Object',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
      };

      const refs = [
        'OBJID_Test::existing_id',
        'OBJID_Test::missing_id',
        'OBJID_Test::another_missing',
      ];
      const result = resolveObjectRefs(refs, objects);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(objects['existing_id']);
      expect(result[0]?.name).toBe('Existing Object');
    });

    it('should return empty array for undefined refs', () => {
      const objects: Record<string, MockObject> = {
        test_id: {
          id: 'test_id',
          name: 'Test Object',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
      };

      const result = resolveObjectRefs(undefined, objects);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty refs array', () => {
      const objects: Record<string, MockObject> = {
        test_id: {
          id: 'test_id',
          name: 'Test Object',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
      };

      const result = resolveObjectRefs([], objects);
      expect(result).toEqual([]);
    });

    it('should work with different object types', () => {
      const objects: Record<string, MockObject> = {
        module_id: {
          id: 'module_id',
          name: 'Module Object',
          parseObjectClass: 'Module',
          parseObjectUrl: 'modules',
        },
        pilot_id: {
          id: 'pilot_id',
          name: 'Pilot Object',
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
        },
      };

      const refs = ['OBJID_Module::module_id', 'OBJID_Pilot::pilot_id'];
      const result = resolveObjectRefs(refs, objects);

      expect(result).toHaveLength(2);
      expect(result[0]?.parseObjectClass).toBe('Module');
      expect(result[1]?.parseObjectClass).toBe('Pilot');
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects record', () => {
      const objects: Record<string, MockObject> = {};
      const refs = ['OBJID_Test::test_id'];

      const result = resolveObjectRefs(refs, objects);
      expect(result).toEqual([]);
    });

    it('should handle undefined objects record', () => {
      const objects: Record<string, MockObject> | undefined = undefined;
      const refs = ['OBJID_Test::test_id'];

      if (objects) {
        const result = resolveObjectRefs(refs, objects);
        expect(result).toEqual([]);
      }
    });

    it('should handle refs with mixed valid and invalid references', () => {
      const objects: Record<string, MockObject> = {
        valid_id: {
          id: 'valid_id',
          name: 'Valid Object',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
      };

      // Invalid references should cause errors, not be filtered out
      expect(() => {
        resolveObjectRefs(
          ['OBJID_Test::valid_id', 'INVALID_REFERENCE'],
          objects
        );
      }).toThrow(
        'Invalid object reference format: INVALID_REFERENCE. Expected format: OBJID_Class::id'
      );
    });
  });

  describe('integration with object_reference utilities', () => {
    it('should work with refToId', () => {
      const objects: Record<string, MockObject> = {
        test_id: {
          id: 'test_id',
          name: 'Test Object',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
      };

      const ref = 'OBJID_Test::test_id';
      const result = resolveObjectRef(ref, objects);
      expect(result).toEqual(objects['test_id']);
    });

    it('should work with complex reference formats', () => {
      const objects: Record<string, MockObject> = {
        complex_id_v2: {
          id: 'complex_id_v2',
          name: 'Complex Object',
          parseObjectClass: 'Test',
          parseObjectUrl: 'test',
        },
      };

      const ref = 'OBJID_Test::complex_id_v2';
      const result = resolveObjectRef(ref, objects);
      expect(result).toEqual(objects['complex_id_v2']);
    });
  });
});
