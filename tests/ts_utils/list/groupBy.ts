import { describe, it, expect } from 'vitest';
import { groupBy } from '../../../src/utils/list';

describe('groupBy', () => {
  it('should group items by the extracted key', () => {
    const items: [string, { type: string }][] = [
      ['item1', { type: 'A' }],
      ['item2', { type: 'B' }],
      ['item3', { type: 'A' }],
      ['item4', { type: 'C' }],
    ];

    const result = groupBy(items, ([_, obj]) => obj.type);

    expect(result.size).toBe(3);
    expect(result.get('A')).toEqual([
      ['item1', { type: 'A' }],
      ['item3', { type: 'A' }],
    ]);
    expect(result.get('B')).toEqual([['item2', { type: 'B' }]]);
    expect(result.get('C')).toEqual([['item4', { type: 'C' }]]);
  });

  it('should return empty map for empty input', () => {
    const items: [string, { type: string }][] = [];

    const result = groupBy(items, ([_, obj]) => obj.type);

    expect(result.size).toBe(0);
  });

  it('should handle single group', () => {
    const items: [string, { type: string }][] = [
      ['item1', { type: 'A' }],
      ['item2', { type: 'A' }],
      ['item3', { type: 'A' }],
    ];

    const result = groupBy(items, ([_, obj]) => obj.type);

    expect(result.size).toBe(1);
    expect(result.get('A')).toEqual([
      ['item1', { type: 'A' }],
      ['item2', { type: 'A' }],
      ['item3', { type: 'A' }],
    ]);
  });

  it('should preserve item order within groups', () => {
    const items: [string, { type: string; order: number }][] = [
      ['item1', { type: 'A', order: 1 }],
      ['item2', { type: 'B', order: 2 }],
      ['item3', { type: 'A', order: 3 }],
      ['item4', { type: 'B', order: 4 }],
      ['item5', { type: 'A', order: 5 }],
    ];

    const result = groupBy(items, ([_, obj]) => obj.type);

    expect(result.get('A')).toEqual([
      ['item1', { type: 'A', order: 1 }],
      ['item3', { type: 'A', order: 3 }],
      ['item5', { type: 'A', order: 5 }],
    ]);
    expect(result.get('B')).toEqual([
      ['item2', { type: 'B', order: 2 }],
      ['item4', { type: 'B', order: 4 }],
    ]);
  });

  it('should handle key extractor using the id (first element)', () => {
    const items: [string, { value: number }][] = [
      ['MOD_123', { value: 10 }],
      ['PIL_456', { value: 20 }],
      ['MOD_789', { value: 30 }],
      ['PIL_012', { value: 40 }],
    ];

    // Group by prefix (first 3 characters of id)
    const result = groupBy(items, ([id, _]) => id.substring(0, 3));

    expect(result.size).toBe(2);
    expect(result.get('MOD')).toEqual([
      ['MOD_123', { value: 10 }],
      ['MOD_789', { value: 30 }],
    ]);
    expect(result.get('PIL')).toEqual([
      ['PIL_456', { value: 20 }],
      ['PIL_012', { value: 40 }],
    ]);
  });

  it('should handle all items mapping to same key', () => {
    const items: [string, { type: string }][] = [
      ['item1', { type: 'Same' }],
      ['item2', { type: 'Same' }],
    ];

    const result = groupBy(items, () => 'constant');

    expect(result.size).toBe(1);
    expect(result.get('constant')).toEqual([
      ['item1', { type: 'Same' }],
      ['item2', { type: 'Same' }],
    ]);
  });

  it('should handle undefined and null in object values', () => {
    const items: [string, { type?: string }][] = [
      ['item1', { type: 'A' }],
      ['item2', {}],
      ['item3', { type: 'A' }],
    ];

    const result = groupBy(items, ([_, obj]) => obj.type ?? 'unknown');

    expect(result.size).toBe(2);
    expect(result.get('A')).toEqual([
      ['item1', { type: 'A' }],
      ['item3', { type: 'A' }],
    ]);
    expect(result.get('unknown')).toEqual([['item2', {}]]);
  });
});
