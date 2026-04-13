import type { Module, ModuleStat } from '../types/module';
import type { StatValueChoices } from '../types/stat';
import type { CharacterModule } from '../types/character_module';
import type { Ability } from '../types/ability';
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
      const statId = statObject.short_key;
      statValueChoices[statId] = {
        ...getStatMetadata(statObject),
        choices: {
          0: scaleStatValue(statObject, value, true),
        },
      };
    }
  });

  return statValueChoices;
}

/**
 * Gets common metadata for a stat object.
 *
 * @param statObject - The ModuleStat object
 * @returns Metadata for StatValueChoices
 */
export function getStatMetadata(statObject: ModuleStat) {
  return {
    pattern: getDefaultString(statObject.unit_pattern) || '{Amount}{Unit}',
    unitName: statObject.unit_name,
    unitExponent: statObject.unit_exponent,
    decimalPlaces: statObject.decimal_places,
    shortKey: statObject.short_key,
  };
}

/**
 * Scales a stat value based on its unit_scaler.
 *
 * @param statObject - The ModuleStat object
 * @param value - The raw value to scale
 * @param applyScaler - Whether to apply the unit_scaler (true for talents, false for module leveled variables)
 * @returns The scaled value
 */
export function scaleStatValue(
  statObject: ModuleStat,
  value: number,
  applyScaler: boolean = true
): number {
  const scaler = applyScaler ? (statObject.unit_scaler ?? 1) : 1;
  return value * scaler;
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
    const statId = primaryStat.short_key;
    statValueChoices[statId] = {
      ...getStatMetadata(primaryStat),
      choices: {},
    };

    variables.forEach((variable, index) => {
      const value = variable.PrimaryParameter as number | undefined;
      if (value !== undefined) {
        // Module leveled variables are already scaled in the data
        statValueChoices[statId].choices[index] = scaleStatValue(
          primaryStat,
          value,
          false
        );
      }
    });
  }

  if (secondaryStat) {
    const statId = secondaryStat.short_key;
    statValueChoices[statId] = {
      ...getStatMetadata(secondaryStat),
      choices: {},
    };

    variables.forEach((variable, index) => {
      const value = variable.SecondaryParameter as number | undefined;
      if (value !== undefined) {
        // Module leveled variables are already scaled in the data
        statValueChoices[statId].choices[index] = scaleStatValue(
          secondaryStat,
          value,
          false
        );
      }
    });
  }

  return statValueChoices;
}

export interface ModuleAbilityRenderData {
  ability: Ability;
  statValueChoices: StatValueChoices;
}

/**
 * Builds ability render data including stat value choices for a module's abilities.
 *
 * @param module - The module object
 * @param characterModules - Record of character modules
 * @param abilities - Record of abilities
 * @param moduleStats - Record of module stats
 * @returns Array of ModuleAbilityRenderData mapped by index
 */
export function getModuleAbilityStats(
  module: Module,
  characterModules: Record<string, CharacterModule>,
  abilities: Record<string, Ability>,
  moduleStats: Record<string, ModuleStat>
): ModuleAbilityRenderData[] {
  const result: ModuleAbilityRenderData[] = [];

  const mounts = module.character_module_mounts;
  if (!mounts || mounts.length === 0) return result;

  const charModuleRef = mounts[0].character_module_ref;
  const charModule = resolveObjectRef(charModuleRef, characterModules);
  if (!charModule || !charModule.abilities_refs) return result;

  const abilitiesScalars = module.abilities_scalars;

  charModule.abilities_refs.forEach((abilityRef, index) => {
    const ability = resolveObjectRef(abilityRef, abilities);
    if (!ability) return;

    const statValueChoices: StatValueChoices = {};

    if (abilitiesScalars && abilitiesScalars[index]) {
      const scalar = abilitiesScalars[index];
      const levels = scalar.levels;

      if (levels && levels.variables) {
        const primaryStatRef = scalar.primary_stat_ref;
        const secondaryStatRef = scalar.secondary_stat_ref;
        
        const primaryStat = primaryStatRef
          ? resolveObjectRef(primaryStatRef, moduleStats)
          : undefined;
        const secondaryStat = secondaryStatRef
          ? resolveObjectRef(secondaryStatRef, moduleStats)
          : undefined;

        const variables = levels.variables;

        if (primaryStat) {
          const statId = primaryStat.short_key;
          statValueChoices[statId] = {
            ...getStatMetadata(primaryStat),
            choices: {},
          };

          variables.forEach((variable, vIndex) => {
            const value = variable.PrimaryParameter as number | undefined;
            if (value !== undefined) {
              statValueChoices[statId].choices[vIndex] = scaleStatValue(
                primaryStat,
                value,
                false
              );
            }
          });
        }

        if (secondaryStat) {
          const statId = secondaryStat.short_key;
          statValueChoices[statId] = {
            ...getStatMetadata(secondaryStat),
            choices: {},
          };

          variables.forEach((variable, vIndex) => {
            const value = variable.SecondaryParameter as number | undefined;
            if (value !== undefined) {
              statValueChoices[statId].choices[vIndex] = scaleStatValue(
                secondaryStat,
                value,
                false
              );
            }
          });
        }
      }
    }

    result.push({
      ability,
      statValueChoices,
    });
  });

  return result;
}
