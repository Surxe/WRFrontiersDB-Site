/**
 * Utility functions for handling object references in the format OBJID_Class::id
 */

export interface ParsedObjectRef {
  class: string;
  id: string;
}

/**
 * Parse an object reference string in the format OBJID_Class::id
 * @param ref - The object reference string (e.g., "OBJID_Module::DA_Module_AmmoFabricator.0")
 * @returns Parsed object with class and id
 * @throws Error if the reference format is invalid
 */
export function parseObjectRef(ref: string): ParsedObjectRef {
  if (!ref.includes('::')) {
    throw new Error(
      `Invalid object reference format: ${ref}. Expected format: OBJID_Class::id`
    );
  }

  const [classPart, id] = ref.split('::');

  if (!classPart.startsWith('OBJID_')) {
    throw new Error(
      `Invalid object reference class format: ${classPart}. Expected format: OBJID_Class`
    );
  }

  const className = classPart.substring(6); // Remove 'OBJID_' prefix

  return {
    class: className,
    id: id,
  };
}

/**
 * Create an object reference string from class and id
 * @param objectClass - The object class (e.g., "Module")
 * @param id - The object id (e.g., "DA_Module_AmmoFabricator.0")
 * @returns Object reference string (e.g., "OBJID_Module::DA_Module_AmmoFabricator.0")
 */
export function createObjectRef(objectClass: string, id: string): string {
  return `OBJID_${objectClass}::${id}`;
}

/**
 * Extract the ID from an object reference string
 * @param ref - The object reference string
 * @returns The extracted ID
 */
export function refToId(ref: string): string {
  return parseObjectRef(ref).id;
}

/**
 * Extract the class from an object reference string
 * @param ref - The object reference string
 * @returns The extracted class name
 */
export function extractClassFromRef(ref: string): string {
  return parseObjectRef(ref).class;
}

/**
 * Check if a string is an object reference in the format OBJID_Class::id
 * @param ref - The string to check
 * @returns True if it's a valid object reference format
 */
export function isObjectRef(ref: string): boolean {
  try {
    parseObjectRef(ref);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert legacy ID to object reference format
 * @param id - The legacy ID (e.g., "DA_Module_AmmoFabricator.0")
 * @param objectClass - The object class (e.g., "Module")
 * @returns Object reference string
 */
export function legacyIdToRef(id: string, objectClass: string): string {
  return createObjectRef(objectClass, id);
}

/**
 * Convert an ID to object reference format
 * @param id - The object ID (e.g., "DA_Module_AmmoFabricator.0")
 * @param objectType - The object type (e.g., "Module", "PilotTalent", "PilotTalentType")
 * @returns Object reference string (e.g., "OBJID_Module::DA_Module_AmmoFabricator.0")
 */
export function idToRef(id: string, objectType: string): string {
  return `OBJID_${objectType}::${id}`;
}

/**
 * Convert object reference to legacy ID format
 * @param ref - The object reference string
 * @returns Legacy ID
 */
export function refToLegacyId(ref: string): string {
  return refToId(ref);
}
