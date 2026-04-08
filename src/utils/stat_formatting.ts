import type { LocalizationKey, LocalizationData } from '../types/localization';
import type { StatValueChoices } from '../types/stat';

// Import shared stat formatting functions from public JavaScript module
// Note: This is a build-time import that will be resolved during the build process
import { formatStatValue, replaceStatPlaceholdersFromChoiceMap } from '../../public/js/stat-formatting.js';

// Re-export the imported functions for TypeScript compatibility
export { formatStatValue, replaceStatPlaceholdersFromChoiceMap };

/**
 * Replaces stat placeholders in text with values from choice map
 * @param text - Text with stat placeholders
 * @param statValueChoices - Stat value choices object
 * @param currentChoice - Current choice index
 * @param locData - Localization data
 * @param wrapInHtml - Whether to wrap values in HTML tags
 * @returns Text with stat placeholders replaced
 */
export function replaceStatPlaceholders(
  text: string,
  statValueChoices: StatValueChoices,
  currentChoice: number,
  locData: LocalizationData,
  wrapInHtml: boolean = false
): string {
  if (!statValueChoices || typeof statValueChoices !== 'object') {
    return text;
  }

  let result = text;
  for (const [_statId, data] of Object.entries(statValueChoices)) {
    const amount = data.choices[currentChoice];
    if (amount !== undefined) {
      // Format the stat value
      const formattedValue = formatStatValue(
        amount,
        data.pattern,
        data.unitName,
        data.unitExponent,
        data.decimalPlaces,
        locData
      );

      // Replace all occurrences of {shortKey} with the formatted value
      const regex = new RegExp(`\\{${data.shortKey}\\}`, 'g');
      const replacement = wrapInHtml
        ? `<strong>${formattedValue}</strong>`
        : formattedValue;
      result = result.replace(regex, replacement);
    }
    // If value not found, leave placeholder intact
  }
  return result;
}

/**
 * Builds choice map from StatValueChoices format
 */
export function buildChoiceMap(statValueChoices: StatValueChoices): Record<
  string,
  {
    pattern: string;
    unitName?: LocalizationKey;
    unitExponent?: number;
    decimalPlaces?: number;
    choices: Record<number, number>;
  }
> {
  const choiceMap: Record<
    string,
    {
      pattern: string;
      unitName?: LocalizationKey;
      unitExponent?: number;
      decimalPlaces?: number;
      choices: Record<number, number>;
    }
  > = {};

  for (const [_, data] of Object.entries(statValueChoices)) {
    choiceMap[data.shortKey] = {
      pattern: data.pattern,
      unitName: data.unitName,
      unitExponent: data.unitExponent,
      decimalPlaces: data.decimalPlaces,
      choices: data.choices,
    };
  }

  return choiceMap;
}

/**
 * Processes localized text with stat replacements
 * Combines localization lookup and stat replacement logic
 */
export function processLocalizedTextWithStats(
  localizationKey: LocalizationKey | undefined,
  statValueChoices: StatValueChoices,
  currentChoice: number,
  locData: LocalizationData,
  wrapInHtml: boolean = false
): string {
  let localizedText = '';

  if (localizationKey?.InvariantString) {
    localizedText = localizationKey.InvariantString;
  } else if (localizationKey && locData) {
    localizedText =
      locData[localizationKey.TableNamespace!]?.[localizationKey.Key!] ||
      localizationKey.en ||
      '';
  } else {
    localizedText = localizationKey?.en || '';
  }

  // Apply stat replacements if available
  if (statValueChoices && Object.keys(statValueChoices).length > 0) {
    localizedText = replaceStatPlaceholders(
      localizedText,
      statValueChoices,
      currentChoice,
      locData,
      wrapInHtml
    );
  }

  return localizedText;
}
