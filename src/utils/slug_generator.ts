/**
 * Slug generation utilities for WRFrontiersDB objects
 */

import type { ParseObject } from '../types/parse_object';
import type { Module } from '../types/module';
import type { Pilot, PilotTalent } from '../types/pilot';
import type { CharacterPreset } from '../types/character_preset';
import type { LocalizationKey } from '../types/localization';
import { getModuleGroupId, MODULE_GROUPS } from './module_group_mapping';
import { getDefaultString } from './localization';
import { toSlug, camelToKebab } from './slug_base';
import { refToId } from './object_reference';

import { enrichModulesWithBotIds } from './robot';
import type { EnrichedModule } from './module_group_mapping';

export interface SlugMap {
  [objectId: string]: string;
}

export interface SlugContext {
  allModules?: Record<string, Module>;
  allPresets?: Record<string, CharacterPreset>;
  enrichedModules?: Record<string, EnrichedModule>;
}

// --- Internal Helpers ---

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
  const lastName = getDefaultString(pilot.last_name || pilot.second_name) || '';
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
  const groupId = getModuleGroupId(module.module_type_ref);

  // Requirement: uses Left, Right for shoulders
  if (
    groupId === 'titan-shoulder' &&
    context?.allPresets &&
    context?.enrichedModules
  ) {
    const side = getShoulderSideFromPreset(module.id, context.allPresets);
    if (side) {
      const botId = context.enrichedModules[module.id]?.bot_id;
      if (botId) {
        return `titan-shoulder-${side}-${botId}`;
      }
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
    const singularName = MODULE_GROUPS[moduleGroup].name.en;
    const slug = `${toSlug(singularName)}-${toSlug(moduleName)}`;
    return slug.replace(/-+$/, '');
  } catch {
    const fallbackSlug = `module-${toSlug(moduleName)}`;
    return fallbackSlug.replace(/-+$/, '');
  }
}

/**
 * Generate slug for factory bot objects
 * Requirement: factory presets are 1:1 of the name.en
 */
function generateFactoryBotSlug(object: ParseObject): string {
  const objectName = getDefaultString(object.name as LocalizationKey) || '';
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
  const objectName = getDefaultString(object.name as LocalizationKey) || '';
  return toSlug(objectName);
}

/**
 * Main entry point for generating a slug for any parse object
 */
export function generateSlugForObject(
  object: ParseObject,
  context?: SlugContext
): string {
  const objectType = object.parseObjectClass;
  switch (objectType) {
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
  // const collisions: Array<{ objectId: string; slug: string }> = [];

  // Create context for cross-object lookups (e.g. for shoulders)
  const allObjectsById: Record<string, ParseObject> = {};
  for (const record of objectRecords) {
    Object.assign(allObjectsById, record);
  }

  const allModules = allObjectsById as Record<string, Module>;
  const allPresets = allObjectsById as Record<string, CharacterPreset>;
  const enrichedModules = enrichModulesWithBotIds(allModules, allPresets);

  const context: SlugContext = {
    allModules,
    allPresets,
    enrichedModules,
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
