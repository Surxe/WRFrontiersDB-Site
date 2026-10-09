import type { LocalizationKey } from '../types/localization';
import type { StatValueChoices } from '../types/stat';
import { replaceStatPlaceholders } from './stat_formatting';
import {
  resolveLocalizedEmbeds,
  resolveLocalizationKey,
  loadLocalizationData,
  localizeText,
  gameStyleTagNames,
} from './localization';
import type { Pilot, PilotTalent, PilotTalentType } from '../types/pilot';
import type { CharacterPreset } from '../types/character_preset';
import type { Currency } from '../types/currency';
import type { CharacterClass } from '../types/character_class';
import type { VirtualBot } from '../types/virtual_bot';
import type { Module } from '../types/module';
import type { ModuleAbilityRenderData } from './stat';
import { refToId } from './object_reference';
import { getCoreModuleCategory } from './core_modules';
import { MODULE_CATEGORY_IDS } from './constants';
import type { ModuleStatLine, ModuleStatRow } from './module_stats';
import { formatStatDisplayValue } from './stat_display';
import langs from '../../public/langs.json';
import { stripGameMarkup } from '../../public/js/game_markup.js';

/** One precomputed meta description body, for a single language. */
export interface LocalizedDescription {
  lang: string;
  description: string;
}

/** Builds an object's meta description body for one language ('' if none). */
export type MetaBodyBuilder = (lang: string) => string;

const DEFAULT_LANG = 'en';

/**
 * Precompute a meta description body for every supported language. A language
 * whose body comes out empty falls back to the English body, and English falls
 * back to `fallback`. Bodies are plain text: game markup is always stripped,
 * since they are also served to other consumers (meta_descriptions.json).
 */
export function precomputeMetaBodies(
  buildBody: MetaBodyBuilder,
  fallback = ''
): LocalizedDescription[] {
  const build = (lang: string) =>
    stripGameMarkup(buildBody(lang), gameStyleTagNames(lang));
  const english = build(DEFAULT_LANG) || fallback;
  return Object.keys(langs).map((lang) => ({
    lang,
    description: (lang === DEFAULT_LANG ? english : build(lang)) || english,
  }));
}

/**
 * Body builder that fills a site localization template (Web_UI namespace)
 * with `embeds`, each localized to the requested language.
 */
export function templateMetaBody(
  templateKey: string | LocalizationKey,
  embeds: Record<string, LocalizationKey | string>
): MetaBodyBuilder {
  const resolvedKey =
    typeof templateKey === 'string'
      ? resolveLocalizationKey(templateKey, 'Web_UI')
      : templateKey;
  return (lang) => {
    const locData = loadLocalizationData(lang);
    return locData ? resolveLocalizedEmbeds(resolvedKey, embeds, locData) : '';
  };
}

/** Precompute a template-based meta description for every language. */
export function generateTemplateMetaDescriptions(
  templateKey: string | LocalizationKey,
  embeds: Record<string, LocalizationKey | string>,
  fallback: string
): LocalizedDescription[] {
  return precomputeMetaBodies(templateMetaBody(templateKey, embeds), fallback);
}

/**
 * Localize `text` into `lang` and fill its `{stat}` placeholders from the given
 * stat choice (level), as plain text: whitespace collapsed.
 */
export function statEmbeddedText(
  text: LocalizationKey | undefined,
  statValueChoices: StatValueChoices,
  lang: string,
  choice = 0
): string {
  const locData = loadLocalizationData(lang);
  let localized = localizeText(text, lang);
  if (locData) {
    localized = replaceStatPlaceholders(
      localized,
      statValueChoices,
      choice,
      locData
    );
  }
  return localized.replace(/\s+/g, ' ').trim();
}

/** Pilot talent body: its description with stat values embedded. */
export function pilotTalentMetaBody(
  talent: PilotTalent,
  statValueChoices: StatValueChoices
): MetaBodyBuilder {
  return (lang) => statEmbeddedText(talent.description, statValueChoices, lang);
}

/** Pilot talent: precomputed {@link pilotTalentMetaBody} for every language. */
export function generatePilotTalentLocalizedMetaDescriptions(
  talent: PilotTalent,
  statValueChoices: StatValueChoices
): LocalizedDescription[] {
  return precomputeMetaBodies(pilotTalentMetaBody(talent, statValueChoices));
}

/** Separator between the talents on one level of a pilot's talent list. */
const PILOT_TALENT_SEPARATOR = ', ';

/**
 * Pilot body: every talent the pilot can learn, one `L#:` line per level, e.g.
 * five single-talent lines for a standard pilot, or 3 talents on levels 1-4
 * plus 1 on level 5 for a hero pilot. Levels without talents are skipped, but
 * each label keeps the pilot's real level number.
 */
export function pilotMetaBody(
  pilot: Pilot,
  pilotTalents: Record<string, PilotTalent>
): MetaBodyBuilder {
  return (lang) =>
    (pilot.levels ?? [])
      .map((level, i) => {
        const talents = (level.talents_refs ?? [])
          .map((ref) => localizeText(pilotTalents[refToId(ref)]?.name, lang))
          .filter((name) => name)
          .join(PILOT_TALENT_SEPARATOR);
        return talents ? `L${i + 1}: ${talents}` : '';
      })
      .filter((line) => line)
      .join('\n');
}

/** Pilot: precomputed {@link pilotMetaBody} for every language. */
export function generatePilotLocalizedMetaDescriptions(
  pilot: Pilot,
  pilotTalents: Record<string, PilotTalent>
): LocalizedDescription[] {
  return precomputeMetaBodies(pilotMetaBody(pilot, pilotTalents));
}

/** One stat summary field in `lang`, or null when it has no name there. */
export interface StatSummaryField {
  name: string;
  value: string;
}

export function moduleStatField(
  line: ModuleStatLine,
  lang: string
): StatSummaryField | null {
  const name =
    line.kind === 'stat'
      ? localizeText(line.display.labelKey, lang)
      : localizeText(line.label, lang);
  if (!name) return null;
  const value =
    line.kind === 'stat'
      ? formatStatDisplayValue(line.display, line.value, lang)
      : `×${line.count}`;
  return { name, value };
}

/** One stat summary line in `lang` (`Max Speed: 109km/h`, `Light Weapon ×2`). */
export function moduleStatLineText(line: ModuleStatLine, lang: string): string {
  const field = moduleStatField(line, lang);
  if (!field) return '';
  return line.kind === 'stat'
    ? `${field.name}: ${field.value}`
    : `${field.name} ${field.value}`;
}

/**
 * The text a module page leads with, stats at `level` (the page's initial
 * level): the module's own description, or else one line per ability, prefixed
 * with the ability name. Chassis have none: their abilities are the same dash
 * and jump on every robot. '' when there is no text.
 */
export function moduleLeadBody(
  module: Module,
  statValueChoices: StatValueChoices,
  abilityStats: ModuleAbilityRenderData[],
  level = 0
): MetaBodyBuilder {
  const isChassis =
    getCoreModuleCategory(module)?.id === MODULE_CATEGORY_IDS.chassis;
  const showsAbilities =
    !isChassis && abilityStats.length > 0 && !!module.abilities_scalars;

  return (lang) => {
    if (module.description && !showsAbilities) {
      return statEmbeddedText(
        module.description,
        statValueChoices,
        lang,
        level
      );
    }
    if (!showsAbilities) return '';
    return abilityStats
      .map(({ ability, statValueChoices: abilityChoices }) => {
        const text = statEmbeddedText(
          ability.description,
          abilityChoices,
          lang,
          level
        );
        const name = localizeText(ability.name, lang);
        return name && text ? `${name}: ${text}` : text;
      })
      .filter((line) => line)
      .join('\n');
  };
}

/**
 * Module body: its lead text ({@link moduleLeadBody}) followed by the armor
 * modules' stat summary (`statRows`, see getModuleStatRows), one line per stat.
 * Modules with neither (weapons without text) use the generic module template.
 */
export function moduleMetaBody(
  module: Module,
  statValueChoices: StatValueChoices,
  abilityStats: ModuleAbilityRenderData[],
  level = 0,
  statRows: ModuleStatRow[] = []
): MetaBodyBuilder {
  const fallback = templateMetaBody('Module_Meta_Description', {
    name: module.name ?? module.id,
  });
  const lead = moduleLeadBody(module, statValueChoices, abilityStats, level);

  return (lang) => {
    const stats = statRows.flat().map((line) => moduleStatLineText(line, lang));
    return (
      [lead(lang), ...stats].filter((line) => line).join('\n') || fallback(lang)
    );
  };
}

/** Module: precomputed {@link moduleMetaBody} for every language. */
export function generateModuleLocalizedMetaDescriptions(
  module: Module,
  statValueChoices: StatValueChoices,
  abilityStats: ModuleAbilityRenderData[],
  level = 0,
  statRows: ModuleStatRow[] = []
): LocalizedDescription[] {
  return precomputeMetaBodies(
    moduleMetaBody(module, statValueChoices, abilityStats, level, statRows)
  );
}

/**
 * A module's stat summary in one language, for consumers that lay the stats
 * out themselves (the Discord bot's embed fields): its lead text, without the
 * stats, and the stats as rows of fields.
 */
export interface StatSummary {
  lead: string;
  rows: StatSummaryField[][];
}

/** Module: its {@link StatSummary} in every language; null without stats. */
export function generateModuleStatSummaries(
  module: Module,
  statValueChoices: StatValueChoices,
  abilityStats: ModuleAbilityRenderData[],
  level = 0,
  statRows: ModuleStatRow[] = []
): Record<string, StatSummary> | null {
  if (statRows.length === 0) return null;
  const leads = precomputeMetaBodies(
    moduleLeadBody(module, statValueChoices, abilityStats, level)
  );
  return Object.fromEntries(
    leads.map(({ lang, description }) => [
      lang,
      {
        lead: description,
        rows: statRows
          .map((row) =>
            row
              .map((line) => moduleStatField(line, lang))
              .filter((field): field is StatSummaryField => field !== null)
          )
          .filter((row) => row.length > 0),
      },
    ])
  );
}

/**
 * Pilot talent type: its name plus the first few talents of that type.
 */
export function generatePilotTalentTypeLocalizedMetaDescriptions(
  talentType: PilotTalentType,
  talentsForType: [string, PilotTalent][],
  defaultName: string
): LocalizedDescription[] {
  const embeds: Record<string, LocalizationKey> = {
    TalentTypeName: talentType.name,
  };
  talentsForType.slice(0, 5).forEach(([, talent], i) => {
    embeds[`talent${i + 1}`] = talent.name;
  });

  return generateTemplateMetaDescriptions(
    talentsForType.length === 3
      ? 'PilotTalentType_Meta_Description_3'
      : 'PilotTalentType_Meta_Description_More',
    embeds,
    `${defaultName}: View detailed information.`
  );
}

/** Robot platform: name and type (Mech / Titan). */
export function generateRobotLocalizedMetaDescriptions(
  robot: VirtualBot,
  defaultName: string
): LocalizedDescription[] {
  return generateTemplateMetaDescriptions(
    'Robot_Meta_Description',
    {
      robot_name: robot.name,
      robot_type: resolveLocalizationKey(robot.character_type, 'Web_UI'),
    },
    `${defaultName}: View detailed robot information and core modules.`
  );
}

/** Currency: name and in-game description. */
export function generateCurrencyLocalizedMetaDescriptions(
  currency: Currency,
  defaultName: string
): LocalizedDescription[] {
  return generateTemplateMetaDescriptions(
    'Currency_Meta_Description_With_Description',
    { name: currency.name, description: currency.description },
    `${defaultName}: View detailed information about this currency in War Robots Frontiers.`
  );
}

/** Character preset: name and character type. */
export function generateCharacterPresetLocalizedMetaDescriptions(
  preset: CharacterPreset,
  defaultName: string
): LocalizedDescription[] {
  return generateTemplateMetaDescriptions(
    'CharacterPreset_Meta_Description',
    {
      preset_name: preset.name,
      character_type: resolveLocalizationKey(preset.character_type, 'Web_UI'),
    },
    `${defaultName}: View detailed character preset information and modules.`
  );
}

/** Character class: name and in-game description. */
export function generateCharacterClassLocalizedMetaDescriptions(
  characterClass: CharacterClass,
  defaultName: string
): LocalizedDescription[] {
  return generateTemplateMetaDescriptions(
    'CharacterClass_Meta_Description',
    { name: characterClass.name, description: characterClass.description },
    `${defaultName}: View detailed information about this character class in War Robots Frontiers.`
  );
}
