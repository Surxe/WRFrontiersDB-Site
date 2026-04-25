/**
 * Slug generation utilities for WRFrontiersDB objects
 */

import type { ParseObject } from '../types/parse_object';
import type { Module } from '../types/module';
import type { Pilot, PilotTalent } from '../types/pilot';
import type { CharacterPreset } from '../types/character_preset';
import type { LocalizationKey } from '../types/localization';
import type { ModuleGroup } from '../types/module_group';
import { getDefaultString } from './localization';
import { toSlug, camelToKebab } from './slug_base';
import { refToId } from './object_reference';

export interface SlugMap {
  [objectId: string]: string;
}

export interface SlugContext {
  allModuleGroups?: Record<string, ModuleGroup>;
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
  const groupRef = module.module_group_ref;
  const isTitanShoulder = groupRef && groupRef.includes('titan-shoulder');

  if (isTitanShoulder && module.shoulder_side && module.virtual_bot_ref) {
    const sideStr = module.shoulder_side === 'L' ? 'left' : 'right';
    const botId = refToId(module.virtual_bot_ref);
    return `titan-shoulder-${sideStr}-${botId}`;
  }

  const moduleName = getDefaultString(module.name) || '';

  try {
    if (!groupRef) throw new Error('No module group ref');
    const groupId = refToId(groupRef);
    const group = context?.allModuleGroups?.[groupId];
    if (!group) throw new Error('Module group not found in context');

    const singularName = group.name.en || getDefaultString(group.name) || '';
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

  const allObjectsById: Record<string, ParseObject> = {};
  for (const record of objectRecords) {
    Object.assign(allObjectsById, record);
  }

  // Filter for ModuleGroups
  const allModuleGroups: Record<string, ModuleGroup> = {};
  for (const [id, obj] of Object.entries(allObjectsById)) {
    if (obj.parseObjectClass === 'ModuleGroup') {
      allModuleGroups[id] = obj as ModuleGroup;
    }
  }

  const context: SlugContext = {
    allModuleGroups,
  };

  for (const objectRecord of objectRecords) {
    for (const [objectId, object] of Object.entries(objectRecord)) {
      try {
        const slug = generateSlugForObject(object, context);
        slugMap[objectId] = slug;
      } catch (error) {
        console.warn(`Failed to generate slug for ${objectId}:`, error);
      }
    }
  }

  return slugMap;
}
