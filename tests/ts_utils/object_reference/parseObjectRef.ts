import { describe, it, expect } from 'vitest';
import {
  parseObjectRef,
  refToId,
  idToRef,
  isObjectRef,
  createObjectRef,
  extractClassFromRef,
  legacyIdToRef,
  refToLegacyId,
} from '../../../src/utils/object_reference';

describe('parseObjectRef', () => {
  describe('success cases', () => {
    it('should parse valid object reference', () => {
      const ref = 'OBJID_Module::DA_Module_AmmoFabricator.0';
      const result = parseObjectRef(ref);

      expect(result).toEqual({
        class: 'Module',
        id: 'DA_Module_AmmoFabricator.0',
      });
    });

    it('should parse reference with multiple parts in ID', () => {
      const ref = 'OBJID_PilotTalent::DA_Talent_Madman1.0';
      const result = parseObjectRef(ref);

      expect(result).toEqual({
        class: 'PilotTalent',
        id: 'DA_Talent_Madman1.0',
      });
    });

    it('should parse reference with special characters', () => {
      const ref = 'OBJID_Module::DA_Module_AmmoFabricator.0_v2';
      const result = parseObjectRef(ref);

      expect(result).toEqual({
        class: 'Module',
        id: 'DA_Module_AmmoFabricator.0_v2',
      });
    });

    it('should parse reference with empty ID', () => {
      const ref = 'OBJID_Module::';
      const result = parseObjectRef(ref);

      expect(result).toEqual({
        class: 'Module',
        id: '',
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when reference has no separator', () => {
      const ref = 'INVALID_REFERENCE';

      expect(() => {
        parseObjectRef(ref);
      }).toThrow(
        'Invalid object reference format: INVALID_REFERENCE. Expected format: OBJID_Class::id'
      );
    });

    it('should throw error when reference missing OBJID_ prefix', () => {
      const ref = 'Module::DA_Module_AmmoFabricator.0';

      expect(() => {
        parseObjectRef(ref);
      }).toThrow(
        'Invalid object reference class format: Module. Expected format: OBJID_Class'
      );
    });

    it('should throw error when reference has invalid class format', () => {
      const ref = 'INVALID_Module::DA_Module_AmmoFabricator.0';

      expect(() => {
        parseObjectRef(ref);
      }).toThrow(
        'Invalid object reference class format: INVALID_Module. Expected format: OBJID_Class'
      );
    });

    it('should throw error when reference is empty string', () => {
      const ref = '';

      expect(() => {
        parseObjectRef(ref);
      }).toThrow(
        'Invalid object reference format: . Expected format: OBJID_Class::id'
      );
    });

    it('should handle reference with multiple separators', () => {
      const ref = 'OBJID_Module::first::second';
      // The split only takes the first separator, so ID is just 'first'
      const result = parseObjectRef(ref);
      expect(result).toEqual({
        class: 'Module',
        id: 'first',
      });
    });
  });
});

describe('refToId', () => {
  it('should extract ID from valid reference', () => {
    const ref = 'OBJID_Module::DA_Module_AmmoFabricator.0';
    const result = refToId(ref);
    expect(result).toBe('DA_Module_AmmoFabricator.0');
  });

  it('should extract ID from reference with special characters', () => {
    const ref = 'OBJID_PilotTalent::DA_Talent_Madman1.0_v2';
    const result = refToId(ref);
    expect(result).toBe('DA_Talent_Madman1.0_v2');
  });

  it('should handle errors from parseObjectRef', () => {
    const ref = 'INVALID_REFERENCE';

    expect(() => {
      refToId(ref);
    }).toThrow(
      'Invalid object reference format: INVALID_REFERENCE. Expected format: OBJID_Class::id'
    );
  });
});

describe('idToRef', () => {
  it('should create reference from ID and object type', () => {
    const id = 'DA_Module_AmmoFabricator.0';
    const objectType = 'Module';
    const result = idToRef(id, objectType);
    expect(result).toBe('OBJID_Module::DA_Module_AmmoFabricator.0');
  });

  it('should create reference with different object types', () => {
    expect(idToRef('test_id', 'PilotTalent')).toBe(
      'OBJID_PilotTalent::test_id'
    );
    expect(idToRef('test_id', 'PilotTalentType')).toBe(
      'OBJID_PilotTalentType::test_id'
    );
    expect(idToRef('test_id', 'Pilot')).toBe('OBJID_Pilot::test_id');
  });

  it('should handle empty ID', () => {
    const result = idToRef('', 'Module');
    expect(result).toBe('OBJID_Module::');
  });

  it('should handle empty object type', () => {
    const result = idToRef('test_id', '');
    expect(result).toBe('OBJID_::test_id');
  });
});

describe('isObjectRef', () => {
  it('should return true for valid references', () => {
    expect(isObjectRef('OBJID_Module::DA_Module_AmmoFabricator.0')).toBe(true);
    expect(isObjectRef('OBJID_PilotTalent::DA_Talent_Madman1.0')).toBe(true);
  });

  it('should return false for invalid references', () => {
    expect(isObjectRef('INVALID_REFERENCE')).toBe(false);
    expect(isObjectRef('Module::DA_Module_AmmoFabricator.0')).toBe(false);
    expect(isObjectRef('')).toBe(false);
    expect(isObjectRef('OBJID_Module')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isObjectRef('')).toBe(false);
  });
});

describe('createObjectRef', () => {
  it('should create reference from class and ID', () => {
    const result = createObjectRef('Module', 'DA_Module_AmmoFabricator.0');
    expect(result).toBe('OBJID_Module::DA_Module_AmmoFabricator.0');
  });

  it('should work with different classes and IDs', () => {
    expect(createObjectRef('PilotTalent', 'test_id')).toBe(
      'OBJID_PilotTalent::test_id'
    );
    expect(createObjectRef('Pilot', 'pilot_123')).toBe(
      'OBJID_Pilot::pilot_123'
    );
  });

  it('should handle empty parameters', () => {
    expect(createObjectRef('', 'test_id')).toBe('OBJID_::test_id');
    expect(createObjectRef('Module', '')).toBe('OBJID_Module::');
  });
});

describe('extractClassFromRef', () => {
  it('should extract class name from valid reference', () => {
    const ref = 'OBJID_Module::DA_Module_AmmoFabricator.0';
    const result = extractClassFromRef(ref);
    expect(result).toBe('Module');
  });

  it('should extract class name with different object types', () => {
    expect(extractClassFromRef('OBJID_PilotTalent::test_id')).toBe(
      'PilotTalent'
    );
    expect(extractClassFromRef('OBJID_Pilot::pilot_123')).toBe('Pilot');
  });

  it('should handle errors from parseObjectRef', () => {
    const ref = 'INVALID_REFERENCE';

    expect(() => {
      extractClassFromRef(ref);
    }).toThrow(
      'Invalid object reference format: INVALID_REFERENCE. Expected format: OBJID_Class::id'
    );
  });
});

describe('legacyIdToRef', () => {
  it('should convert legacy ID to reference format', () => {
    const result = legacyIdToRef('DA_Module_AmmoFabricator.0', 'Module');
    expect(result).toBe('OBJID_Module::DA_Module_AmmoFabricator.0');
  });

  it('should be equivalent to createObjectRef', () => {
    const id = 'test_id';
    const objectClass = 'Test';
    expect(legacyIdToRef(id, objectClass)).toBe(
      createObjectRef(objectClass, id)
    );
  });
});

describe('refToLegacyId', () => {
  it('should convert reference to legacy ID', () => {
    const ref = 'OBJID_Module::DA_Module_AmmoFabricator.0';
    const result = refToLegacyId(ref);
    expect(result).toBe('DA_Module_AmmoFabricator.0');
  });

  it('should be equivalent to refToId', () => {
    const ref = 'OBJID_Module::test_id';
    expect(refToLegacyId(ref)).toBe(refToId(ref));
  });

  it('should handle errors from parseObjectRef', () => {
    const ref = 'INVALID_REFERENCE';

    expect(() => {
      refToLegacyId(ref);
    }).toThrow(
      'Invalid object reference format: INVALID_REFERENCE. Expected format: OBJID_Class::id'
    );
  });
});
