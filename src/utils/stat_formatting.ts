import type { LocalizationKey, LocalizationData } from '../types/localization';
import type { StatValueChoices } from '../types/stat';

/**
 * Formats a stat value using pattern, unit name, and decimal places
 * Extracted from public/js/localization.js lines 79-115
 */
export function formatStatValue(
  value: number,
  pattern: string,
  unitName: LocalizationKey | undefined,
  unitExponent: number | undefined,
  decimalPlaces: number | undefined,
  locData: LocalizationData
): string {
  // Apply exponent (default to 1.0)
  const exponentValue = unitExponent ?? 1.0;
  const exponentiatedValue = Math.pow(value, exponentValue);

  // Round to avoid floating point precision errors (e.g., 7.000000001 -> 7)
  const roundedValue = Math.round(exponentiatedValue * 1e10) / 1e10;

  // Format amount with decimal places (only show as many as needed)
  const formattedAmount =
    decimalPlaces !== undefined
      ? String(parseFloat(roundedValue.toFixed(decimalPlaces)))
      : String(roundedValue);

  // Get localized unit name (or empty string if not provided)
  let localizedUnit = '';
  if (unitName) {
    localizedUnit = locData[unitName.TableNamespace!]?.[unitName.Key!] || unitName.en || '';
  }

  // Apply pattern
  return pattern
    .replace('{Amount}', formattedAmount)
    .replace('{Unit}', localizedUnit);
}

/**
 * Replaces stat placeholders in text with values from choice map
 * Extracted from public/js/localization.js lines 125-151
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
      const replacement = wrapInHtml ? `<strong>${formattedValue}</strong>` : formattedValue;
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
 * Replaces stat placeholders in text with values from choice map
 * Works with the choice map format from StatEmbedLocalizedText (shortKey as key)
 */
export function replaceStatPlaceholdersFromChoiceMap(
  text: string,
  choiceMap: Record<string, {
    pattern: string;
    unitName?: LocalizationKey;
    unitExponent?: number;
    decimalPlaces?: number;
    choices: Record<number, number>;
  }>,
  currentChoice: number,
  locData: LocalizationData,
  wrapInHtml: boolean = false
): string {
  if (!choiceMap || typeof choiceMap !== 'object') {
    return text;
  }

  let result = text;
  for (const [shortKey, data] of Object.entries(choiceMap)) {
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
      const regex = new RegExp(`\\{${shortKey}\\}`, 'g');
      const replacement = wrapInHtml ? `<strong>${formattedValue}</strong>` : formattedValue;
      result = result.replace(regex, replacement);
    }
    // If value not found, leave placeholder intact
  }
  return result;
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
    localizedText = locData[localizationKey.TableNamespace!]?.[localizationKey.Key!] || 
                   (localizationKey.en || '');
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
