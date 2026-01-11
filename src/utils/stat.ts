import type { ModuleStat } from '../types/module';
import type { StatValueChoices } from '../components/StatEmbedLocalizedText.astro';
import { getDefaultString } from './localization';

/**
 * Builds StatValueChoices from a stats array and ModuleStat objects.
 *
 * Applies unit scaling and formatting for each stat in the array.
 *
 * @param stats - Array of {stat_id, value} from a talent or similar object
 * @param moduleStats - Record of all ModuleStat objects
 * @returns StatValueChoices object for use with StatEmbedLocalizedText component
 */
export function getStatValueChoices(
  stats: Array<{ stat_id: string; value: number }> | undefined,
  moduleStats: Record<string, ModuleStat>
): StatValueChoices {
  const statValueChoices: StatValueChoices = {};

  if (!stats) {
    return statValueChoices;
  }

  stats.forEach(({ stat_id, value }) => {
    const statObject = moduleStats[stat_id];
    if (statObject) {
      // Get unit pattern (default to {Amount}{Unit} for older versions)
      const unitPattern =
        getDefaultString(statObject.unit_pattern) || '{Amount}{Unit}';

      // Apply unit scaler (default to 1.0)
      const scaler = statObject.unit_scaler ?? 1;
      const scaledValue = value * scaler;

      statValueChoices[stat_id] = {
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
