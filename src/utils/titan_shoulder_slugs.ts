/**
 * Titan Shoulder Slug Generator
 *
 * Enhances slug generation for titan shoulder modules to differentiate
 * between left and right variants using bot context and localization.
 */

import { getParseObjects } from './parse_object';
import { enrichModulesWithBotIds } from './robot';
import { refToId } from './object_reference';
import type { Module } from '../types/module';
import type { CharacterPreset } from '../types/character_preset';

/**
 * Check if a module is a titan shoulder (left or right)
 */
export function isTitanShoulder(moduleId: string): boolean {
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
  // Find which preset contains this module
  for (const preset of Object.values(presets)) {
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

/**
 * Generate enhanced slug for titan shoulder modules
 */
export function generateTitanShoulderSlug(
  moduleId: string,
  modules: Record<string, Module>,
  presets: Record<string, CharacterPreset>
): string | null {
  if (!isTitanShoulder(moduleId)) {
    return null;
  }

  // Enrich modules with bot IDs to find which bot this module belongs to
  const enrichedModules = enrichModulesWithBotIds(modules, presets);
  const module = enrichedModules[moduleId];

  if (!module?.bot_id) {
    return null;
  }

  // Get side from character preset socket_name (more reliable than ID parsing)
  const side = getShoulderSideFromPreset(moduleId, presets);
  if (!side) {
    return null;
  }

  const titanName = extractTitanName(moduleId);

  return `titan-shoulder-${side}-${titanName}`;
}

/**
 * Generate enhanced slug map for all titan shoulder modules
 */
export function generateTitanShoulderSlugMap(): Record<string, string> {
  const modules = getParseObjects<Module>('Objects/Module.json');
  const presets = getParseObjects<CharacterPreset>(
    'Objects/CharacterPreset.json'
  );

  const enhancedSlugs: Record<string, string> = {};

  for (const [moduleId, module] of Object.entries(modules)) {
    if (module.production_status !== 'Ready') continue;

    const enhancedSlug = generateTitanShoulderSlug(moduleId, modules, presets);
    if (enhancedSlug) {
      enhancedSlugs[moduleId] = enhancedSlug;
    }
  }

  return enhancedSlugs;
}
