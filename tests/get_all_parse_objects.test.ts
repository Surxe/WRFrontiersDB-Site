/**
 * Tests for getAllParseObjects function
 */

import { describe, it, expect } from 'vitest';
import { getAllParseObjects } from '../src/utils/parse_object';

describe('getAllParseObjects', () => {
  it('should return all object types with correct structure', () => {
    const allObjects = getAllParseObjects();

    // Check that we have some object types (don't hardcode the list)
    const objectTypes = Object.keys(allObjects);
    expect(objectTypes.length).toBeGreaterThan(0);

    // Check that each object type has the correct structure
    objectTypes.forEach((type) => {
      expect(typeof allObjects[type]).toBe('object');
      expect(Array.isArray(Object.keys(allObjects[type]))).toBe(true);
    });

    // Check that we have actual data in some key types (if they exist)
    if (allObjects.Module) {
      expect(Object.keys(allObjects.Module).length).toBeGreaterThan(0);
    }
    if (allObjects.Pilot) {
      expect(Object.keys(allObjects.Pilot).length).toBeGreaterThan(0);
    }
    if (allObjects.CharacterPreset) {
      expect(Object.keys(allObjects.CharacterPreset).length).toBeGreaterThan(0);
    }
  });

  it('should have parseObjectClass set on each object', () => {
    const allObjects = getAllParseObjects();

    // Check that objects have parseObjectClass set correctly
    Object.entries(allObjects).forEach(([objectType, objects]) => {
      if (Object.keys(objects).length > 0) {
        const firstObject = Object.values(objects)[0];
        expect(firstObject).toHaveProperty('parseObjectClass', objectType);
      }
    });
  });

  it('should return consistent structure', () => {
    const allObjects1 = getAllParseObjects();
    const allObjects2 = getAllParseObjects();

    // Should return the same structure and data
    expect(Object.keys(allObjects1)).toEqual(Object.keys(allObjects2));

    // Check that counts are consistent
    Object.keys(allObjects1).forEach((type) => {
      expect(Object.keys(allObjects1[type]).length).toBe(
        Object.keys(allObjects2[type]).length
      );
    });
  });
});
