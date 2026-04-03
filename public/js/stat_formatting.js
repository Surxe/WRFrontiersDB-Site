/**
 * Shared stat formatting functions for client-side use
 * Converted from src/utils/stat_formatting.ts for JavaScript compatibility
 */

/**
 * Formats a stat value using pattern, unit name, and decimal places
 */
export function formatStatValue(
  value,
  pattern,
  unitName,
  unitExponent,
  decimalPlaces,
  locData
) {
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
    localizedUnit = locData[unitName.TableNamespace]?.[unitName.Key] || unitName.en || '';
  }

  // Apply pattern
  return pattern
    .replace('{Amount}', formattedAmount)
    .replace('{Unit}', localizedUnit);
}

/**
 * Replaces stat placeholders in text with values from choice map
 * Works with the choice map format from StatEmbedLocalizedText (shortKey as key)
 */
export function replaceStatPlaceholdersFromChoiceMap(
  text,
  choiceMap,
  currentChoice,
  locData,
  wrapInHtml = false
) {
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
