/**
 * Slug generation utilities for WRFrontiersDB objects
 */

import type { ParseObject } from '../types/parse_object';
import type { Module } from '../types/module';
import type { Pilot, PilotTalent } from '../types/pilot';
import type { CharacterPreset } from '../types/character_preset';
import {
  getModuleGroupId,
  getModuleGroupSingularName,
} from './module_group_mapping';
import { getDefaultString } from './localization';
import { toSlug, camelToKebab } from './slug_base';
import { refToId } from './object_reference';

export interface SlugMap {
  [objectId: string]: string;
}

export interface SlugContext {
  allModules?: Record<string, Module>;
  allPresets?: Record<string, CharacterPreset>;
}

// --- Internal Helpers ---

/**
 * Check if a module is a titan shoulder (left or right)
 */
function isTitanShoulder(moduleId: string): boolean {
  return (
    (moduleId.includes('ShoulderL') || moduleId.includes('ShoulderR')) &&
    (moduleId.includes('Alpha') ||
      moduleId.includes('Grim') ||
      moduleId.includes('Matriarch') ||
      moduleId.includes('Norna') ||
      moduleId.includes('Spire'))
  );
}

/**
 * Extract titan name from module ID
 */
function extractTitanName(moduleId: string): string {
  const titanMap: Record<string, string> = {
    Alpha: 'alpha',
    Grim: 'grim',
    Matriarch: 'matriarch',
    Norna: 'norna',
    Spire: 'volta', // Spire maps to Volta in localization
  };

  for (const [key, value] of Object.entries(titanMap)) {
    if (moduleId.includes(key)) {
      return value;
    }
  }

  return 'unknown';
}

/**
 * Get shoulder side from character preset module array using socket_name
 */
function getShoulderSideFromPreset(
  moduleId: string,
  presets: Record<string, CharacterPreset>
): 'left' | 'right' | null {
  for (const preset of Object.values(presets)) {
    if (!preset.modules || !Array.isArray(preset.modules)) continue;

    const moduleEntry = preset.modules.find(
      (m) => refToId(m.module_ref) === moduleId
    );

    if (moduleEntry) {
      if (moduleEntry.socket_name === 'Shoulder_L') return 'left';
      if (moduleEntry.socket_name === 'Shoulder_R') return 'right';
    }
  }
  return null;
}

// --- Slug Generators ---

/**
 * Generate slug for a pilot object
 * Format: firstname.en-lastname.en
 */
function generatePilotSlug(pilot: Pilot): string {
  const firstName = getDefaultString(pilot.first_name) || '';
  const lastName = getDefaultString(pilot.last_name) || '';
  const slug = `${toSlug(firstName)}-${toSlug(lastName)}`;
  return slug.replace(/-+$/, '');
}

/**
 * Generate slug for a pilot talent object
 */
function generatePilotTalentSlug(talent: PilotTalent): string {
  const talentName = getDefaultString(talent.name) || '';
  return toSlug(talentName);
}

/**
 * Generate slug for a module object
 * Includes special handling for titan shoulders
 * Format: [titan-shoulder-side-titanname] OR [modulecategory-modulename]
 */
function generateModuleSlug(module: Module, context?: SlugContext): string {
  // Requirement: uses Left, Right for shoulders
  if (context?.allPresets && isTitanShoulder(module.id)) {
    const side = getShoulderSideFromPreset(module.id, context.allPresets);
    if (side) {
      const titanName = extractTitanName(module.id);
      return `titan-shoulder-${side}-${titanName}`;
    }
  }

  const moduleName = getDefaultString(module.name) || '';

  try {
    const moduleGroup = getModuleGroupId(module.module_type_ref);
    if (!moduleGroup) {
      throw new Error(
        `No module group found for type: ${module.module_type_ref}`
      );
    }
    const singularName = getModuleGroupSingularName(moduleGroup);
    const slug = `${toSlug(singularName)}-${toSlug(moduleName)}`;
    return slug.replace(/-+$/, '');
  } catch (error) {
    const fallbackSlug = `module-${toSlug(moduleName)}`;
    return fallbackSlug.replace(/-+$/, '');
  }
}

/**
 * Generate slug for factory bot objects
 * Requirement: factory presets are 1:1 of the name.en
 */
function generateFactoryBotSlug(object: ParseObject): string {
  const objectName = getDefaultString(object.name as any) || '';
  return toSlug(objectName);
}

/**
 * Generate slug for AI bot objects
 * Requirement: ai presets derived from the id with a few replacements
 */
function generateAiBotSlug(object: ParseObject): string {
  return camelToKebab(object.id);
}

/**
 * Generate slug for CharacterPreset
 * Logic: Use Factory logic if is_factory_preset, otherwise AI logic (replacements on ID)
 */
function generateCharacterPresetSlug(object: CharacterPreset): string {
  if (object.is_factory_preset) {
    return generateFactoryBotSlug(object);
  } else {
    return generateAiBotSlug(object);
  }
}

/**
 * Generate slug for all other objects
 */
function generateDefaultSlug(object: ParseObject): string {
  const objectName = getDefaultString(object.name as any) || '';
  return toSlug(objectName);
}

/**
 * Main entry point for generating a slug for any parse object
 */
export function generateSlugForObject(
  object: ParseObject,
  context?: SlugContext
): string {
  switch (object.parseObjectClass) {
    case 'Pilot':
      return generatePilotSlug(object as Pilot);
    case 'PilotTalent':
      return generatePilotTalentSlug(object as PilotTalent);
    case 'Module':
      return generateModuleSlug(object as Module, context);
    case 'FactoryBot':
      return generateFactoryBotSlug(object);
    case 'AIBot':
      return generateAiBotSlug(object);
    case 'CharacterPreset':
      return generateCharacterPresetSlug(object as CharacterPreset);
    default:
      return generateDefaultSlug(object);
  }
}

/**
 * Generate slug map for all objects
 */
export function generateSlugMap(
  objectRecords: Record<string, ParseObject>[]
): SlugMap {
  const slugMap: SlugMap = {};
  const collisions: Array<{ objectId: string; slug: string }> = [];

  // Create context for cross-object lookups (e.g. for shoulders)
  const allObjectsById: Record<string, ParseObject> = {};
  for (const record of objectRecords) {
    Object.assign(allObjectsById, record);
  }

  const context: SlugContext = {
    allModules: allObjectsById as Record<string, Module>,
    allPresets: allObjectsById as Record<string, CharacterPreset>,
  };

  for (const objectRecord of objectRecords) {
    for (const [objectId, object] of Object.entries(objectRecord)) {
      try {
        const slug = generateSlugForObject(object, context);

        // Check for collisions (within the same object type context is usually enough,
        // but we'll check overall to be safe)
        if (slugMap[slug] && slugMap[slug] !== objectId) {
          // Note: In some cases multiple IDs might map to same slug intentionally,
          // but usually we want to know.
          // collisions.push({ objectId, slug });
        }

        slugMap[objectId] = slug;
      } catch (error) {
        console.warn(`Failed to generate slug for ${objectId}:`, error);
      }
    }
  }

  return slugMap;
}
