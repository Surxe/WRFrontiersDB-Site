import type { CharacterPreset } from '../types/character_preset';
import type { Module } from '../types/module';
import type { EnrichedModule } from './module_group_mapping';
import type { LocalizationKey } from '../types/localization';
import { isCoreModule } from './core_modules';
import { refToId } from './object_reference';
import { getDefaultString } from './localization';
import { slugify } from './slug_base';

export interface VirtualBot {
  parseObjectClass: 'VirtualBot';
  parseObjectUrl: 'robots';
  id: string; // slugified bot ID for URLs (e.g. "ares")
  name: LocalizationKey; // localized name (e.g. "Ares")
  character_type: string;
  core_modules: string[]; // module IDs
  factory_presets: string[]; // preset IDs
  iconPath?: string; // icon path from factory preset
  [key: string]: unknown;
}

export function getVirtualBots(
  modules: Record<string, Module>,
  presets: Record<string, CharacterPreset>
): Record<string, VirtualBot> {
  const bots: Record<string, VirtualBot> = {};
  const coreModuleToBotId: Record<string, string> = {};

  const factoryPresets = Object.entries(presets).filter(
    ([_, preset]) => preset.is_factory_preset
  );

  // For determinism
  factoryPresets.sort(([a], [b]) => a.localeCompare(b));

  const allCoreModuleIds = Object.keys(modules).filter((id) =>
    isCoreModule(modules[id])
  );

  for (const moduleId of allCoreModuleIds) {
    if (coreModuleToBotId[moduleId]) continue;

    const firstPresetEntry = factoryPresets.find(([_, preset]) => {
      return preset.modules.some((m) => refToId(m.module_ref) === moduleId);
    });

    if (firstPresetEntry) {
      const [presetId, preset] = firstPresetEntry;
      const botName = getDefaultString(preset.name) || presetId;
      const slugId = slugify(botName);

      const coreModulesInPreset = preset.modules
        .map((m) => refToId(m.module_ref))
        .filter((id) => modules[id] && isCoreModule(modules[id]));

      for (const cmId of coreModulesInPreset) {
        if (!coreModuleToBotId[cmId]) {
          coreModuleToBotId[cmId] = slugId;
        }
      }

      if (!bots[slugId]) {
        bots[slugId] = {
          parseObjectClass: 'VirtualBot',
          parseObjectUrl: 'robots',
          id: slugId,
          name: preset.name,
          character_type: preset.character_type || 'Unknown',
          core_modules: [],
          factory_presets: [],
          iconPath: preset.icon,
        };
      }

      for (const cmId of coreModulesInPreset) {
        if (!bots[slugId].core_modules.includes(cmId)) {
          bots[slugId].core_modules.push(cmId);
        }
      }
    }
  }

  for (const [presetId, preset] of factoryPresets) {
    let assignedBotId: string | null = null;
    for (const m of preset.modules) {
      const mId = refToId(m.module_ref);
      if (coreModuleToBotId[mId]) {
        assignedBotId = coreModuleToBotId[mId];
        break;
      }
    }

    if (assignedBotId && bots[assignedBotId]) {
      if (!bots[assignedBotId].factory_presets.includes(presetId)) {
        bots[assignedBotId].factory_presets.push(presetId);
      }
    }
  }

  return bots;
}

export function enrichModulesWithBotIds(
  modules: Record<string, Module | EnrichedModule>,
  presets: Record<string, CharacterPreset>
): Record<string, EnrichedModule> {
  const bots = getVirtualBots(modules, presets);
  const coreModuleToBotId: Record<string, string> = {};

  for (const bot of Object.values(bots)) {
    for (const modId of bot.core_modules) {
      coreModuleToBotId[modId] = bot.id;
    }
  }

  const enriched: Record<string, EnrichedModule> = {};

  for (const [moduleId, module] of Object.entries(modules)) {
    enriched[moduleId] = {
      ...module,
      bot_id: coreModuleToBotId[moduleId],
    };
  }

  return enriched;
}
