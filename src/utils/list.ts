import type { ParseObject } from '../types/parse_object';

/**
 * Filters and prepares parse objects for list display
 */
export function prepareObjectList<T extends ParseObject>(
  objects: Record<string, T>,
  options: {
    prodReadyOnly?: boolean;
    sortBy?: (_a: [string, T], _b: [string, T]) => number;
  } = {}
) {
  const { prodReadyOnly = false, sortBy } = options;
  
  let entries = Object.entries(objects);
  
  if (prodReadyOnly) {
    entries = entries.filter(([_, obj]) => obj.production_status === 'Ready');
  }
  
  if (sortBy) {
    entries.sort(sortBy);
  }
  
  return entries;
}

/**
 * Groups objects by a key extractor function
 */
export function groupBy<T>(
  items: [string, T][],
  keyExtractor: (_item: [string, T]) => string
): Map<string, [string, T][]> {
  const groups = new Map<string, [string, T][]>();
  
  for (const item of items) {
    const key = keyExtractor(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  
  return groups;
}

/**
 * Sorts groups by key
 */
export function sortGroups<T>(
  groups: Map<string, [string, T][]>,
  compareFn?: (_a: string, _b: string) => number
): [string, [string, T][]][] {
  const entries = Array.from(groups.entries());
  
  if (compareFn) {
    entries.sort((a, b) => compareFn(a[0], b[0]));
  } else {
    entries.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }
  
  return entries;
}
