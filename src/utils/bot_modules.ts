/**
 * Bot Modules Utility
 *
 * Shared utilities for working with bot core modules across different pages.
 */

import { getParseObjects } from './parse_object';
import type { VirtualBot } from '../types/virtual_bot';
import { prepareObjectList } from './list';
import type { Module } from '../types/module';
import { refToId } from './object_reference';

/**
 * Get core modules for a specific bot, excluding a specified module
 */
export function getBotCoreModules(
  botId: string,
  modules: Record<string, Module>,
  excludeModuleId?: string
): Module[] {
  const virtualBotsMap = getParseObjects<VirtualBot>('Objects/VirtualBot.json');
  const bot = virtualBotsMap[botId];

  if (!bot) {
    return [];
  }

  // Ref is like "OBJID_Module::DA_Module_ChassisAlpha.1", we just need the ID part if we use ID, wait... bot.core_module_refs contains "OBJID_Module::..."
  // But wait, the modules dict is keyed by module ID (e.g. "DA_Module_ChassisAlpha.1")
  // We need to parse the ref to ID first.

  const coreModuleIds = bot.core_module_refs
    .map((ref: string) => refToId(ref))
    .filter((id: string) => id !== excludeModuleId);

  const coreModules = coreModuleIds
    .map((id: string) => modules[id])
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
export function getAllVirtualBots(): Record<string, VirtualBot> {
  return getParseObjects<VirtualBot>('Objects/VirtualBot.json');
}

/**
 * Get a specific virtual bot by ID
 */
export function getVirtualBotById(botId: string): VirtualBot | undefined {
  const virtualBotsMap = getParseObjects<VirtualBot>('Objects/VirtualBot.json');
  return virtualBotsMap[botId];
}
