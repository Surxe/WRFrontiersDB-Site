/**
 * Slug generation utilities for WRFrontiersDB objects
 */

import type { ParseObject } from '../types/parse_object';
import type { Module } from '../types/module';
import type { Pilot, PilotTalent } from '../types/pilot';
import type { LocalizationKey } from '../types/localization';
import { getModuleGroupId, getModuleGroupSingularName } from './module_group_mapping';

export interface SlugMap {
  [objectId: string]: string;
}

/**
 * Convert string to slug format
 * - Lowercase
 * - Replace special characters with hyphens
 * - Remove consecutive hyphens
 * - Trim leading/trailing hyphens
 */
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/**
 * Get English localization value from a localization key
 */
function getEnglishValue(localizationKey: LocalizationKey | string): string {
  if (typeof localizationKey === 'string') {
    return localizationKey;
  }
  if (localizationKey && typeof localizationKey === 'object' && localizationKey.en) {
    return localizationKey.en;
  }
  if (localizationKey && typeof localizationKey === 'object' && localizationKey.InvariantString) {
    return localizationKey.InvariantString;
  }
  return '';
}

/**
 * Generate slug for a pilot object
 * Format: firstname.en-lastname.en
 */
function generatePilotSlug(pilot: Pilot): string {
  const firstName = getEnglishValue(pilot.first_name || '');
  const lastName = getEnglishValue(pilot.last_name || '');
  return `${toSlug(firstName)}-${toSlug(lastName)}`;
}

/**
 * Generate slug for a pilot talent object
 * Format: pilottalentname.en
 */
function generatePilotTalentSlug(talent: PilotTalent): string {
  const talentName = getEnglishValue(talent.name || '');
  return `${toSlug(talentName)}`;
}

/**
 * Generate slug for a module object
 * Format: modulecategory.en.singular-modulename.en
 */
function generateModuleSlug(module: Module): string {
  const moduleName = getEnglishValue(module.name || '');
  
  try {
    const moduleGroup = getModuleGroupId(module.module_type_ref);
    if (!moduleGroup) {
      throw new Error(`No module group found for type: ${module.module_type_ref}`);
    }
    const singularName = getModuleGroupSingularName(moduleGroup);
    return `${toSlug(singularName)}-${toSlug(moduleName)}`;
  } catch (error) {
    // Fallback to 'module' prefix if module group lookup fails
    console.warn(`Could not determine module group for ${module.id}, falling back to 'module' prefix:`, error);
    return `module-${toSlug(moduleName)}`;
  }
}

/**
 * Generate slug for factory bot objects
 * Format: factorybotname.en
 */
function generateFactoryBotSlug(object: ParseObject): string {
  const objectName = getEnglishValue(object.name || '');
  return `${toSlug(objectName)}`;
}

/**
 * Generate slug for AI bot objects
 * Format: aibotname.en
 */
function generateAiBotSlug(object: ParseObject): string {
  const objectName = getEnglishValue(object.name || '');
  return `${toSlug(objectName)}`;
}

/**
 * Generate slug for all other objects
 * Format: objectname.en
 */
function generateDefaultSlug(object: ParseObject): string {
  const objectName = getEnglishValue(object.name || '');
  return `${toSlug(objectName)}`;
}

/**
 * Generate slug for any parse object based on its type
 */
export function generateSlugForObject(object: ParseObject): string {
  switch (object.parseObjectClass) {
    case 'Pilot': {
      return generatePilotSlug(object as Pilot);
    }
    case 'PilotTalent': {
      return generatePilotTalentSlug(object as PilotTalent);
    }
    case 'Module': {
      return generateModuleSlug(object as Module);
    }
    case 'FactoryBot': {
      return generateFactoryBotSlug(object);
    }
    case 'AIBot': {
      return generateAiBotSlug(object);
    }
    default: {
      return generateDefaultSlug(object);
    }
  }
}

/**
 * Generate slug map for all objects
 */
export function generateSlugMap(objects: Record<string, ParseObject>[]): SlugMap {
  const slugMap: SlugMap = {};
  const collisions: Array<{ objectId: string; slug: string }> = [];

  for (const objectRecord of objects) {
    for (const [objectId, object] of Object.entries(objectRecord)) {
      try {
        const slug = generateSlugForObject(object);
        
        // Check for collisions
        if (slugMap[slug]) {
          collisions.push({ objectId, slug });
        }
        
        slugMap[objectId] = slug;
      } catch (error) {
        console.warn(`Failed to generate slug for ${objectId}:`, error);
      }
    }
  }

  // Report collisions
  if (collisions.length > 0) {
    console.error('Slug collisions detected:');
    for (const collision of collisions) {
      console.error(`  ${collision.slug}: ${collision.objectId}`);
    }
    throw new Error(`Found ${collisions.length} slug collisions`);
  }

  return slugMap;
}
