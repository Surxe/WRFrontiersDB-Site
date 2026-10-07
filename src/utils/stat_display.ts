import type { LocalizationKey } from '../types/localization';
import type { ModuleStat } from '../types/module';
import { localizeText, loadLocalizationData } from './localization';
import { resolveObjectRef } from './object_resolver';
import { getParseObjects } from './parse_object';
import { getStatMetadata } from './stat';
import { formatStatValue } from './stat_formatting';
import {
  getStatNameLocalizationKey,
  type RawStat,
} from './stat_name_localization';

/**
 * The shield metrics the shoulder profiles compare: the game's shield stats plus
 * the Parser's derived Regen Delay / Fill Time / Full Recovery (in every shoulder's
 * levels, titans included).
 */
export const SHIELD_STAT_KEYS = [
  'ShieldAmount',
  'ShieldDelayReduction',
  'ShieldRegeneration',
  'RechargeDelay',
  'RechargeTime',
  'DelayAndRechargeTotal',
] as const;

/** The shoulder profile table columns: armor, then the shield metrics. */
export const SHOULDER_STAT_KEYS = ['Armor', ...SHIELD_STAT_KEYS] as const;

/** Decimal places shown when a stat sets none (as the stat tables show them). */
export const DEFAULT_STAT_DECIMAL_PLACES = 1;

/** How to label and format one stat (a `Stat.json` key, e.g. "ShieldAmount"). */
export interface StatDisplay {
  /** The stat's name (game ModuleStat name, or the site's synthetic label). */
  labelKey?: LocalizationKey;
  pattern: string;
  unitName?: LocalizationKey;
  unitExponent?: number;
  decimalPlaces?: number;
  shortKey: string;
  /** Raw module scalar -> display value (e.g. cm/s -> km/h, 0.05 -> 5%). */
  unitScaler: number;
}

/**
 * The display of a stat: Stat.json -> its ModuleStat's name, unit and scaler,
 * else a plain `{Amount}{Unit}` with no unit. Records load on demand if omitted.
 */
export function resolveStatDisplay(
  statKey: string,
  allStats?: Record<string, RawStat>,
  allModuleStats?: Record<string, ModuleStat>
): StatDisplay {
  const stats = allStats ?? getParseObjects<RawStat>('Objects/Stat.json');
  const moduleStats =
    allModuleStats ?? getParseObjects<ModuleStat>('Objects/ModuleStat.json');
  const labelKey = getStatNameLocalizationKey(statKey, stats, moduleStats);
  const stat = stats[statKey];
  const moduleStat = stat?.module_stat_ref
    ? resolveObjectRef(stat.module_stat_ref, moduleStats)
    : undefined;
  if (moduleStat) {
    return {
      ...getStatMetadata(moduleStat),
      labelKey,
      unitScaler: moduleStat.unit_scaler ?? 1,
    };
  }
  return {
    labelKey,
    pattern: '{Amount}{Unit}',
    shortKey: statKey,
    unitScaler: 1,
  };
}

/** A raw module scalar value as display text in `lang` (`109km/h`, `5%`). */
export function formatStatDisplayValue(
  display: StatDisplay,
  rawValue: number,
  lang: string
): string {
  return formatStatValue(
    rawValue * display.unitScaler,
    display.pattern,
    display.unitName,
    display.unitExponent,
    display.decimalPlaces ?? DEFAULT_STAT_DECIMAL_PLACES,
    loadLocalizationData(lang) ?? {}
  );
}

/** `Label: value` in `lang`, or '' when the stat has no name there. */
export function formatStatLine(
  display: StatDisplay,
  rawValue: number,
  lang: string
): string {
  const label = localizeText(display.labelKey, lang);
  return label
    ? `${label}: ${formatStatDisplayValue(display, rawValue, lang)}`
    : '';
}
