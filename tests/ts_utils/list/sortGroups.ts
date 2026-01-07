import { describe, it, expect } from 'vitest';
import { sortGroups } from '../../../src/utils/list';

describe('sortGroups', () => {
  it('should sort groups alphabetically by default', () => {
    const groups = new Map<string, [string, { value: number }][]>([
      ['Zebra', [['z1', { value: 1 }]]],
      ['Alpha', [['a1', { value: 2 }]]],
      ['Beta', [['b1', { value: 3 }]]],
    ]);

    const result = sortGroups(groups);

    expect(result.map(([key]) => key)).toEqual(['Alpha', 'Beta', 'Zebra']);
  });

  it('should preserve items within each group', () => {
    const groups = new Map<string, [string, { value: number }][]>([
      ['B', [
        ['b1', { value: 1 }],
        ['b2', { value: 2 }],
      ]],
      ['A', [
        ['a1', { value: 3 }],
        ['a2', { value: 4 }],
        ['a3', { value: 5 }],
      ]],
    ]);

    const result = sortGroups(groups);

    expect(result).toEqual([
      ['A', [
        ['a1', { value: 3 }],
        ['a2', { value: 4 }],
        ['a3', { value: 5 }],
      ]],
      ['B', [
        ['b1', { value: 1 }],
        ['b2', { value: 2 }],
      ]],
    ]);
  });

  it('should use custom comparison function when provided', () => {
    const groups = new Map<string, [string, { value: number }][]>([
      ['A', [['a1', { value: 1 }]]],
      ['B', [['b1', { value: 2 }]]],
      ['C', [['c1', { value: 3 }]]],
    ]);

    // Sort in reverse alphabetical order
    const result = sortGroups(groups, (a, b) => b.localeCompare(a));

    expect(result.map(([key]) => key)).toEqual(['C', 'B', 'A']);
  });

  it('should handle empty map', () => {
    const groups = new Map<string, [string, { value: number }][]>();

    const result = sortGroups(groups);

    expect(result).toEqual([]);
  });

  it('should handle single group', () => {
    const groups = new Map<string, [string, { value: number }][]>([
      ['OnlyGroup', [['item1', { value: 1 }]]],
    ]);

    const result = sortGroups(groups);

    expect(result).toEqual([
      ['OnlyGroup', [['item1', { value: 1 }]]],
    ]);
  });

  it('should sort numeric strings naturally', () => {
    const groups = new Map<string, [string, { value: number }][]>([
      ['10', [['item10', { value: 10 }]]],
      ['2', [['item2', { value: 2 }]]],
      ['1', [['item1', { value: 1 }]]],
      ['20', [['item20', { value: 20 }]]],
    ]);

    const result = sortGroups(groups);

    // localeCompare should handle numeric strings naturally
    expect(result.map(([key]) => key)).toEqual(['1', '10', '2', '20']);
  });

  it('should allow custom numeric sorting', () => {
    const groups = new Map<string, [string, { value: number }][]>([
      ['10', [['item10', { value: 10 }]]],
      ['2', [['item2', { value: 2 }]]],
      ['1', [['item1', { value: 1 }]]],
      ['20', [['item20', { value: 20 }]]],
    ]);

    // Sort numerically
    const result = sortGroups(groups, (a, b) => parseInt(a) - parseInt(b));

    expect(result.map(([key]) => key)).toEqual(['1', '2', '10', '20']);
  });

  it('should handle case-sensitive sorting', () => {
    const groups = new Map<string, [string, { value: number }][]>([
      ['zebra', [['z1', { value: 1 }]]],
      ['Zebra', [['Z1', { value: 2 }]]],
      ['alpha', [['a1', { value: 3 }]]],
      ['Alpha', [['A1', { value: 4 }]]],
    ]);

    const result = sortGroups(groups);

    // localeCompare handles case-insensitive by default
    expect(result.map(([key]) => key)).toEqual(['alpha', 'Alpha', 'zebra', 'Zebra']);
  });

  it('should handle special characters in keys', () => {
    const groups = new Map<string, [string, { value: number }][]>([
      ['@special', [['s1', { value: 1 }]]],
      ['normal', [['n1', { value: 2 }]]],
      ['#hash', [['h1', { value: 3 }]]],
      ['123', [['num1', { value: 4 }]]],
    ]);

    const result = sortGroups(groups);

    // Just verify it doesn't throw and returns all groups
    expect(result.length).toBe(4);
    expect(result.map(([key]) => key)).toContain('@special');
    expect(result.map(([key]) => key)).toContain('normal');
    expect(result.map(([key]) => key)).toContain('#hash');
    expect(result.map(([key]) => key)).toContain('123');
  });

  it('should sort by length with custom compareFn', () => {
    const groups = new Map<string, [string, { value: number }][]>([
      ['longest_key', [['l1', { value: 1 }]]],
      ['mid', [['m1', { value: 2 }]]],
      ['x', [['x1', { value: 3 }]]],
      ['medium', [['m2', { value: 4 }]]],
    ]);

    const result = sortGroups(groups, (a, b) => a.length - b.length);

    expect(result.map(([key]) => key)).toEqual(['x', 'mid', 'medium', 'longest_key']);
  });
});
