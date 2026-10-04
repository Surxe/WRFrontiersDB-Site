import * as fs from 'fs';
import * as path from 'path';
import type { Ability } from '../types/ability';
import type { CharacterClass } from '../types/character_class';
import type { CharacterModule } from '../types/character_module';
import type { CharacterPreset } from '../types/character_preset';
import type { Currency } from '../types/currency';
import type { Faction } from '../types/faction';
import type { Module, ModuleStat, ModuleStatsTable } from '../types/module';
import type { ModuleGroup } from '../types/module_group';
import type {
  Pilot,
  PilotClass,
  PilotPersonality,
  PilotTalent,
  PilotTalentType,
} from '../types/pilot';
import type { StatValueChoices } from '../types/stat';
import type { VirtualBot } from '../types/virtual_bot';
import { getDefaultString } from './localization';
import {
  type LocalizedDescription,
  generateCharacterClassLocalizedMetaDescriptions,
  generateCharacterPresetLocalizedMetaDescriptions,
  generateCurrencyLocalizedMetaDescriptions,
  generateModuleLocalizedMetaDescriptions,
  generatePilotLocalizedMetaDescriptions,
  generatePilotTalentLocalizedMetaDescriptions,
  generatePilotTalentTypeLocalizedMetaDescriptions,
  generateRobotLocalizedMetaDescriptions,
  generateTemplateMetaDescriptions,
} from './meta_description';
import { generateSlugBasedStaticPaths, getParseObjects } from './parse_object';
import {
  type ModuleAbilityRenderData,
  getModuleAbilityStats,
  getModuleStatValueChoices,
  getStatValueChoices,
} from './stat';

/** Reads `Objects/<Type>.json` (getParseObjects, or a cached stand-in). */
export type ObjectLoader = <T>(parseObjectFile: string) => Record<string, T>;

const loadFresh: ObjectLoader = (file) => getParseObjects(file);

function objectOf<T>(load: ObjectLoader, type: string, id: string): T {
  const obj = load<T>(`Objects/${type}.json`)[id];
  if (!obj) throw new Error(`Object ${id} not found in Objects/${type}.json`);
  return obj;
}

/** What a module page leads with: its stats and abilities at its initial (top) level. */
export interface ModuleLeadStats {
  statValueChoices: StatValueChoices;
  abilityStats: ModuleAbilityRenderData[];
  initialLevel: number;
}

export function getModuleLeadStats(
  module: Module,
  load: ObjectLoader = loadFresh
): ModuleLeadStats {
  const moduleStats = load<ModuleStat>('Objects/ModuleStat.json');
  const moduleStatsTables = load<ModuleStatsTable>(
    'Objects/ModuleStatsTable.json'
  );
  const maxLevel = module.module_scalars?.levels?.variables?.length || 0;
  return {
    statValueChoices: getModuleStatValueChoices(
      module,
      moduleStats,
      moduleStatsTables,
      getDefaultString(module.description)
    ),
    abilityStats: getModuleAbilityStats(
      module,
      load<CharacterModule>('Objects/CharacterModule.json'),
      load<Ability>('Objects/Ability.json'),
      moduleStats,
      moduleStatsTables
    ),
    initialLevel: Math.max(maxLevel - 1, 0),
  };
}

type MetaBuilder = (id: string, load: ObjectLoader) => LocalizedDescription[];

/** Per object type with a page: its meta descriptions, as that page shows them. */
const META_BUILDERS = {
  VirtualBot: (id, load) => {
    const bot = objectOf<VirtualBot>(load, 'VirtualBot', id);
    return generateRobotLocalizedMetaDescriptions(
      bot,
      getDefaultString(bot.name) || bot.id
    );
  },
  Pilot: (id, load) =>
    generatePilotLocalizedMetaDescriptions(
      objectOf<Pilot>(load, 'Pilot', id),
      load<PilotTalent>('Objects/PilotTalent.json')
    ),
  Module: (id, load) => {
    const module = objectOf<Module>(load, 'Module', id);
    const { statValueChoices, abilityStats, initialLevel } = getModuleLeadStats(
      module,
      load
    );
    return generateModuleLocalizedMetaDescriptions(
      module,
      statValueChoices,
      abilityStats,
      initialLevel
    );
  },
  PilotTalent: (id, load) => {
    const talent = objectOf<PilotTalent>(load, 'PilotTalent', id);
    return generatePilotTalentLocalizedMetaDescriptions(
      talent,
      getStatValueChoices(
        talent.stats,
        load<ModuleStat>('Objects/ModuleStat.json')
      )
    );
  },
  PilotTalentType: (id, load) => {
    const talents = Object.values(
      load<PilotTalent>('Objects/PilotTalent.json')
    ).filter(
      (talent) => talent.talent_type_ref === `OBJID_PilotTalentType::${id}`
    );
    return generatePilotTalentTypeLocalizedMetaDescriptions(
      objectOf<PilotTalentType>(load, 'PilotTalentType', id),
      talents.map((talent) => [talent.id, talent] as [string, PilotTalent]),
      id
    );
  },
  CharacterClass: (id, load) => {
    const characterClass = objectOf<CharacterClass>(load, 'CharacterClass', id);
    return generateCharacterClassLocalizedMetaDescriptions(
      characterClass,
      getDefaultString(characterClass.name) || characterClass.id
    );
  },
  CharacterPreset: (id, load) => {
    const preset = objectOf<CharacterPreset>(load, 'CharacterPreset', id);
    return generateCharacterPresetLocalizedMetaDescriptions(
      preset,
      getDefaultString(preset.name) || preset.id
    );
  },
  Currency: (id, load) => {
    const currency = objectOf<Currency>(load, 'Currency', id);
    return generateCurrencyLocalizedMetaDescriptions(
      currency,
      getDefaultString(currency.name) || currency.id
    );
  },
  PilotClass: (id, load) => {
    const pilotClass = objectOf<PilotClass>(load, 'PilotClass', id);
    return generateTemplateMetaDescriptions(
      { Key: 'PilotClass_Meta_Description', TableNamespace: 'Web_UI' },
      { name: pilotClass.name },
      getDefaultString(pilotClass.name) || pilotClass.id
    );
  },
  PilotPersonality: (id, load) => {
    const personality = objectOf<PilotPersonality>(
      load,
      'PilotPersonality',
      id
    );
    return generateTemplateMetaDescriptions(
      { Key: 'PilotPersonality_Meta_Description', TableNamespace: 'Web_UI' },
      { name: personality.name },
      getDefaultString(personality.name) || personality.id
    );
  },
  Faction: (id, load) => {
    const faction = objectOf<Faction>(load, 'Faction', id);
    return generateTemplateMetaDescriptions(
      { Key: 'Faction_Meta_Description', TableNamespace: 'Web_UI' },
      { name: faction.name },
      getDefaultString(faction.name) || faction.id
    );
  },
  ModuleGroup: (id, load) => {
    const group = objectOf<ModuleGroup>(load, 'ModuleGroup', id);
    return generateTemplateMetaDescriptions(
      { Key: 'ModuleGroup_Meta_Description', TableNamespace: 'Web_UI' },
      {
        groupName: group.name,
        groupDescription: group.description || {
          Key: '',
          TableNamespace: '',
          en: '',
        },
      },
      getDefaultString(group.name) || id
    );
  },
} satisfies Record<string, MetaBuilder>;

export type MetaObjectType = keyof typeof META_BUILDERS;

/** The meta descriptions of one object's page, in every language. */
export function getObjectMetaDescriptions(
  objectType: MetaObjectType,
  id: string,
  load: ObjectLoader = loadFresh
): LocalizedDescription[] {
  return META_BUILDERS[objectType](id, load);
}

/** `/meta_descriptions.json`: every object page's meta description, per language. */
export interface MetaDescriptionsDocument {
  /** The CI run that built the site (GITHUB_RUN_ID), or null for a local build. */
  build_id: string | null;
  /** The game version of the data the site was built from. */
  version: string;
  /** Object type -> object id -> language -> description. */
  descriptions: Record<string, Record<string, Record<string, string>>>;
}

function pageIds(objectType: MetaObjectType, load: ObjectLoader): string[] {
  if (objectType === 'VirtualBot') {
    return Object.keys(load<VirtualBot>('Objects/VirtualBot.json'));
  }
  return generateSlugBasedStaticPaths(objectType).map((p) => p.props.id);
}

function readDataVersion(): string {
  return fs
    .readFileSync(
      path.join(process.cwd(), 'WRFrontiersDB-Data/current/version.txt'),
      'utf8'
    )
    .trim();
}

export function buildMetaDescriptionsDocument(): MetaDescriptionsDocument {
  const cache = new Map<string, Record<string, unknown>>();
  const load: ObjectLoader = <T>(file: string) => {
    if (!cache.has(file)) cache.set(file, getParseObjects(file));
    return cache.get(file) as Record<string, T>;
  };

  const descriptions: MetaDescriptionsDocument['descriptions'] = {};
  for (const objectType of Object.keys(META_BUILDERS) as MetaObjectType[]) {
    const byId: Record<string, Record<string, string>> = {};
    for (const id of pageIds(objectType, load)) {
      byId[id] = Object.fromEntries(
        getObjectMetaDescriptions(objectType, id, load).map(
          ({ lang, description }) => [lang, description]
        )
      );
    }
    descriptions[objectType] = byId;
  }
  return {
    build_id: process.env.GITHUB_RUN_ID || null,
    version: readDataVersion(),
    descriptions,
  };
}
