import { getParseObjects } from './parse_object';
import { resolveObjectRef } from './object_resolver';
import { refToId } from './object_reference';
import { CORE_MODULE_CATEGORIES } from './constants';
import type { ParseObject } from '../types/parse_object';

// Cache module types and categories at module level for efficiency
const MODULE_TYPES = getParseObjects('Objects/ModuleType.json');
const MODULE_CATEGORIES = getParseObjects('Objects/ModuleCategory.json');

/**
 * Checks if a module is a core module (Chassis, Torso, or Shoulder)
 */
export function isCoreModule(module: ParseObject): boolean {
  if (!module.module_type_ref) return false;
  
  // Use object resolver to get the module type
  const moduleType = resolveObjectRef(module.module_type_ref as string, MODULE_TYPES);
  if (!moduleType?.module_category_ref) return false;
  
  const categoryId = refToId(moduleType.module_category_ref as string);
  return CORE_MODULE_CATEGORIES.includes(categoryId as typeof CORE_MODULE_CATEGORIES[number]);
}

/**
 * Gets the module category for a core module
 */
export function getCoreModuleCategory(module: ParseObject): ParseObject | null {
  if (!module.module_type_ref) return null;
  
  // Use object resolver to get the module type
  const moduleType = resolveObjectRef(module.module_type_ref as string, MODULE_TYPES);
  if (!moduleType?.module_category_ref) return null;
  
  // Use object resolver to get the category
  return resolveObjectRef(moduleType.module_category_ref as string, MODULE_CATEGORIES) || null;
}

