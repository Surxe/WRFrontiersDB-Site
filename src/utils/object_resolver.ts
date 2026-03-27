import type { ParseObject } from '../types/parse_object';
import { extractIdFromRef } from './object_reference';

/**
 * Resolve an object reference to an actual object
 * @param ref - The object reference (e.g., "OBJID_Module::DA_Module_AmmoFabricator.0")
 * @param objects - Record of objects indexed by their ID
 * @returns The resolved object or undefined if not found
 */
export function resolveObjectRef<T extends ParseObject>(
  ref: string,
  objects: Record<string, T>
): T | undefined {
  const id = extractIdFromRef(ref);
  return objects[id];
}

/**
 * Resolve an array of object references to actual objects
 * @param refs - Array of object references
 * @param objects - Record of objects indexed by their ID
 * @returns Array of resolved objects (filters out undefined values)
 */
export function resolveObjectRefs<T extends ParseObject>(
  refs: string[] | undefined,
  objects: Record<string, T>
): T[] {
  if (!refs) return [];
  
  const resolved: T[] = [];
  for (const ref of refs) {
    const obj = resolveObjectRef(ref, objects);
    if (obj) {
      resolved.push(obj);
    }
  }
  return resolved;
}
