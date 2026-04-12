import type { Module, ModuleStat } from '../types/module';
import type { StatValueChoices } from '../types/stat';
import { getDefaultString } from './localization';
import { resolveObjectRef } from './object_resolver';

/**
 * Builds StatValueChoices from a stats array and ModuleStat objects.
 *
 * Applies unit scaling and formatting for each stat in the array.
 *
 * @param stats - Array of {stat_ref, value} from a talent or similar object
 * @param moduleStats - Record of all ModuleStat objects
 * @returns StatValueChoices object for use with StatEmbedLocalizedText component
 */
export function getStatValueChoices(
  stats: Array<{ stat_ref: string; value: number }> | undefined,
  moduleStats: Record<string, ModuleStat>
): StatValueChoices {
  const statValueChoices: StatValueChoices = {};

  if (!stats) {
    return statValueChoices;
  }

  stats.forEach(({ stat_ref, value }) => {
    const statObject = resolveObjectRef(stat_ref, moduleStats);
    if (statObject) {
      // Get unit pattern (default to {Amount}{Unit} for older versions)
      const unitPattern =
        getDefaultString(statObject.unit_pattern) || '{Amount}{Unit}';

      // Apply unit scaler (default to 1.0)
      const scaler = statObject.unit_scaler ?? 1;
      const scaledValue = value * scaler;

      const statId = statObject.short_key;
      statValueChoices[statId] = {
        pattern: unitPattern,
        unitName: statObject.unit_name,
        unitExponent: statObject.unit_exponent,
        decimalPlaces: statObject.decimal_places,
        shortKey: statObject.short_key,
        choices: {
          0: scaledValue,
        },
      };
    }
  });


  return statValueChoices;
}

/**
 * Builds StatValueChoices for a module's leveled descriptions.
 *
 * Maps PrimaryParameter and SecondaryParameter from levels.variables
 * to the corresponding ModuleStat short keys.
 *
 * @param module - The module object
 * @param moduleStats - Record of all ModuleStat objects
 * @returns StatValueChoices object for use with StatEmbedLocalizedText component
 */
export function getModuleStatValueChoices(
  module: Module,
  moduleStats: Record<string, ModuleStat>
): StatValueChoices {
  const statValueChoices: StatValueChoices = {};

  const scalars = module.module_scalars;
  if (!scalars || !scalars.levels || !scalars.levels.variables) {
    return statValueChoices;
  }

  const primaryStat = scalars.primary_stat_ref
    ? resolveObjectRef(scalars.primary_stat_ref, moduleStats)
    : undefined;
  const secondaryStat = scalars.secondary_stat_ref
    ? resolveObjectRef(scalars.secondary_stat_ref, moduleStats)
    : undefined;

  const variables = scalars.levels.variables;

  if (primaryStat) {
    const unitPattern =
      getDefaultString(primaryStat.unit_pattern) || '{Amount}{Unit}';
    const scaler = primaryStat.unit_scaler ?? 1;
    const statId = primaryStat.short_key;

    statValueChoices[statId] = {
      pattern: unitPattern,
      unitName: primaryStat.unit_name,
      unitExponent: primaryStat.unit_exponent,
      decimalPlaces: primaryStat.decimal_places,
      shortKey: primaryStat.short_key,
      choices: {},
    };

    variables.forEach((variable, index) => {
      const value = variable.PrimaryParameter as number | undefined;
      if (value !== undefined) {
        statValueChoices[statId].choices[index] = value * scaler;
      }
    });
  }

  if (secondaryStat) {
    const unitPattern =
      getDefaultString(secondaryStat.unit_pattern) || '{Amount}{Unit}';
    const scaler = secondaryStat.unit_scaler ?? 1;
    const statId = secondaryStat.short_key;

    statValueChoices[statId] = {
      pattern: unitPattern,
      unitName: secondaryStat.unit_name,
      unitExponent: secondaryStat.unit_exponent,
      decimalPlaces: secondaryStat.decimal_places,
      shortKey: secondaryStat.short_key,
      choices: {},
    };

    variables.forEach((variable, index) => {
      const value = variable.SecondaryParameter as number | undefined;
      if (value !== undefined) {
        statValueChoices[statId].choices[index] = value * scaler;
      }
    });
  }

  return statValueChoices;
}
