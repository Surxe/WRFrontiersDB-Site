import type { LocalizationKey } from '../types/localization';
import type { ModuleStat } from '../types/module';
import { getParseObjects } from './parse_object';
import { resolveObjectRef } from './object_resolver';

/**
 * Minimal shape of a Stat.json entry.
 */
interface RawStat {
  id: string;
  module_stat_ref: string;
}

/**
 * Map from Stat.id (the key in Stat.json, e.g. "RechargeDelay") to a LocalizationKey
 * for synthetic ModuleStats that have no stat_name field in the game data.
 *
 * These synthetic stats are parser-generated (identified by "Synthetic" in their ModuleStat ID)
 * and are covered by the SyntheticStatKeys namespace in public/locales/en.json.
 */
export const SYNTHETIC_STAT_LOCALIZATION_MAP: Record<string, LocalizationKey> = {
  RechargeDelay: {
    Key: 'Stat_RechargeDelay',
    TableNamespace: 'SyntheticStatKeys',
    en: 'Regen Delay',
  },
  RechargeTime: {
    Key: 'Stat_RechargeTime',
    TableNamespace: 'SyntheticStatKeys',
    en: 'Fill Time',
  },
  DelayAndRechargeTotal: {
    Key: 'Stat_DelayAndRechargeTotal',
    TableNamespace: 'SyntheticStatKeys',
    en: 'Full Recovery',
  },
  AoeArmor: {
    Key: 'Stat_AoeArmor',
    TableNamespace: 'SyntheticStatKeys',
    en: 'AoE Armor',
  },
  AoeNoArmor: {
    Key: 'Stat_AoeNoArmor',
    TableNamespace: 'SyntheticStatKeys',
    en: 'AoE No-Armor Damage',
  },
  TimeBetweenShots: {
    Key: 'Stat_TimeBetweenShots',
    TableNamespace: 'SyntheticStatKeys',
    en: 'Time Between Shots',
  },
};

/**
 * Hardcoded LocalizationKey for the WeightDrain stat name.
 * WeightDrain (Stat short_key: "WeightDrain") maps to DA_ModuleStat_WeightDrain.0,
 * which carries stat_name Key=ModuleStat_WeightDrain in the game's ModuleStatKeys namespace.
 * Used by the shoulder chart legend to localize the "Weight" label.
 */
export const WEIGHT_DRAIN_STAT_NAME_LOCALIZATION_KEY: LocalizationKey = {
  Key: 'ModuleStat_WeightDrain',
  TableNamespace: 'ModuleStatKeys',
  en: 'Weight used',
};

/**
 * Resolve the display-name LocalizationKey for a stat by its Stat.json id (e.g. "ShieldAmount").
 *
 * Resolution chain:
 *   1. Look up statId in Stat.json -> get module_stat_ref
 *   2. Follow module_stat_ref to ModuleStat.json
 *   3. If the ModuleStat has a stat_name with a Key, return it
 *   4. Otherwise fall back to SYNTHETIC_STAT_LOCALIZATION_MAP[statId]
 *   5. Return undefined if no localization is found
 *
 * @param statId - The key from Stat.json (same as Stat.id), e.g. "ShieldAmount", "RechargeDelay"
 * @param allStats - Optional pre-loaded Stat.json record (loaded on-demand if omitted)
 * @param allModuleStats - Optional pre-loaded ModuleStat.json record (loaded on-demand if omitted)
 * @returns A LocalizationKey for the stat's display name, or undefined
 */
export function getStatNameLocalizationKey(
  statId: string,
  allStats?: Record<string, RawStat>,
  allModuleStats?: Record<string, ModuleStat>
): LocalizationKey | undefined {
  const stats =
    allStats ?? (getParseObjects<RawStat>('Objects/Stat.json') as Record<string, RawStat>);
  const moduleStats =
    allModuleStats ?? getParseObjects<ModuleStat>('Objects/ModuleStat.json');

  const stat = stats[statId];
  if (!stat) {
    return SYNTHETIC_STAT_LOCALIZATION_MAP[statId];
  }

  const moduleStat = resolveObjectRef(stat.module_stat_ref, moduleStats);
  if (moduleStat?.stat_name?.Key) {
    return moduleStat.stat_name;
  }

  return SYNTHETIC_STAT_LOCALIZATION_MAP[statId];
}
