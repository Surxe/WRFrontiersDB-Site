/**
 * Bot Modules Utility
 *
 * Shared utilities for working with bot core modules across different pages.
 */

import { getVirtualBots } from './robot';
import { prepareObjectList } from './list';
import type { Module } from '../types/module';
import type { CharacterPreset } from '../types/character_preset';

/**
 * Virtual Bot Interface
 *
 * A VirtualBot represents a generic robot platform that groups together:
 * - All factory presets that belong to the same base robot (e.g., "Ares" platform)
 * - The core modules that define that robot's foundation
 *
 * This is NOT a specific CharacterPreset, but rather an abstraction that
 * groups all variants of a robot under one platform name.
 *
 * Example:
 * - VirtualBot "ares" groups all "Ares" factory presets
 * - Contains core modules: Ares Torso, Ares Legs, etc.
 * - Links to all factory presets that use these core modules
 *
 * This allows users to browse robots by their platform rather than
 * individual preset variants.
 */
export interface VirtualBot {
  /** URL-friendly slug for the bot platform (e.g., "ares", "guardian") */
  id: string;
  /** Display name of the robot platform (e.g., "Ares", "Guardian") */
  name: string;
  /** Character type classification (e.g., "Mech", "Titan") */
  character_type: string;
  /** Array of core module IDs that define this robot's foundation */
  core_modules: string[];
  /** Array of factory preset IDs that belong to this robot platform */
  factory_presets: string[];
}

/**
 * Get core modules for a specific bot, excluding a specified module
 */
export function getBotCoreModules(
  botId: string,
  modules: Record<string, Module>,
  presets: Record<string, CharacterPreset>,
  excludeModuleId?: string
): Module[] {
  const virtualBotsMap = getVirtualBots(modules, presets);
  const bot = virtualBotsMap[botId];

  if (!bot) {
    return [];
  }

  const coreModuleIds = bot.core_modules.filter((id) => id !== excludeModuleId);
  const coreModules = coreModuleIds
    .map((id) => modules[id])
    .filter(Boolean) as Module[];

  // Filter production-ready modules
  const filteredModuleEntries = prepareObjectList(
    Object.fromEntries(coreModules.map((m) => [m.id, m])),
    { prodReadyOnly: true }
  );

  return filteredModuleEntries
    .map(([, module]) => module)
    .sort((a, b) => {
      const nameA = a.name?.Key || a.id;
      const nameB = b.name?.Key || b.id;
      return nameA.localeCompare(nameB);
    });
}

/**
 * Get all virtual bots mapped by ID
 */
export function getAllVirtualBots(
  modules: Record<string, Module>,
  presets: Record<string, CharacterPreset>
): Record<string, VirtualBot> {
  return getVirtualBots(modules, presets);
}

/**
 * Get a specific virtual bot by ID
 */
export function getVirtualBotById(
  botId: string,
  modules: Record<string, Module>,
  presets: Record<string, CharacterPreset>
): VirtualBot | undefined {
  const virtualBotsMap = getVirtualBots(modules, presets);
  return virtualBotsMap[botId];
}
