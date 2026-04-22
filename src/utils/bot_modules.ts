/**
 * Bot Modules Utility
 *
 * Shared utilities for working with bot core modules across different pages.
 */

import { getVirtualBots } from './robot';
import type { VirtualBot } from './robot';
import { prepareObjectList } from './list';
import type { Module } from '../types/module';
import type { CharacterPreset } from '../types/character_preset';

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
