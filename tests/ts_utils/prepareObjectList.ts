import { describe, it, expect } from 'vitest';
import { prepareObjectList } from '../../src/utils/list';
import type { ParseObject } from '../../src/types/parse_object';

describe('prepareObjectList', () => {
  it('should return all entries when no options provided', () => {
    const objects: Record<string, ParseObject> = {
      obj1: { id: 'obj1', production_status: 'Ready', parseObjectClass: 'Test' },
      obj2: { id: 'obj2', production_status: 'NotReady', parseObjectClass: 'Test' },
      obj3: { id: 'obj3', production_status: 'Ready', parseObjectClass: 'Test' },
    };

    const result = prepareObjectList(objects);

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      ['obj1', objects.obj1],
      ['obj2', objects.obj2],
      ['obj3', objects.obj3],
    ]);
  });

  it('should filter objects when prodReadyOnly is true', () => {
    const objects: Record<string, ParseObject> = {
      obj1: { id: 'obj1', production_status: 'Ready', parseObjectClass: 'Test' },
      obj2: { id: 'obj2', production_status: 'NotReady', parseObjectClass: 'Test' },
      obj3: { id: 'obj3', production_status: 'Ready', parseObjectClass: 'Test' },
      obj4: { id: 'obj4', parseObjectClass: 'Test' }, // No production_status
    };

    const result = prepareObjectList(objects, { prodReadyOnly: true });

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      ['obj1', objects.obj1],
      ['obj3', objects.obj3],
    ]);
  });

  it('should apply custom sorting when sortBy is provided', () => {
    const objects: Record<string, ParseObject> = {
      obj1: { id: 'obj1', production_status: 'Ready', parseObjectClass: 'Test' },
      obj2: { id: 'obj2', production_status: 'Ready', parseObjectClass: 'Test' },
      obj3: { id: 'obj3', production_status: 'Ready', parseObjectClass: 'Test' },
    };

    const result = prepareObjectList(objects, {
      sortBy: (a, b) => b[0].localeCompare(a[0]), // Reverse alphabetical
    });

    expect(result).toEqual([
      ['obj3', objects.obj3],
      ['obj2', objects.obj2],
      ['obj1', objects.obj1],
    ]);
  });

  it('should filter and sort when both options are provided', () => {
    const objects: Record<string, ParseObject> = {
      zebra: { id: 'zebra', production_status: 'Ready', parseObjectClass: 'Test' },
      apple: { id: 'apple', production_status: 'NotReady', parseObjectClass: 'Test' },
      banana: { id: 'banana', production_status: 'Ready', parseObjectClass: 'Test' },
      cherry: { id: 'cherry', production_status: 'Ready', parseObjectClass: 'Test' },
    };

    const result = prepareObjectList(objects, {
      prodReadyOnly: true,
      sortBy: (a, b) => a[0].localeCompare(b[0]), // Alphabetical
    });

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      ['banana', objects.banana],
      ['cherry', objects.cherry],
      ['zebra', objects.zebra],
    ]);
  });

  it('should return empty array for empty input', () => {
    const objects: Record<string, ParseObject> = {};

    const result = prepareObjectList(objects);

    expect(result).toEqual([]);
  });
});