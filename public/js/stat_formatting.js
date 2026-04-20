/**
 * Shared stat formatting functions
 * Used by both TypeScript build-time and client-side JavaScript
 */

// Import number formatting utilities
import {
  formatNumberWithSeparator,
  getCurrentSeparator,
} from './number-formatting.js';

/**
 * Formats a stat value using pattern, unit name, and decimal places
 * @param {number} value - The stat value
 * @param {string} pattern - Pattern string with {Amount} and {Unit} placeholders
 * @param {Object|string|undefined} unitName - Localized unit name object with TableNamespace, Key, and en properties, plain string, or undefined
 * @param {number|undefined} unitExponent - Power to apply to the value
 * @param {number|undefined} decimalPlaces - Number of decimal places to show
 * @param {Object} locData - Localization data for unit names
 * @returns {string} Formatted stat value
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

  // Get current separator preference
  const separator = getCurrentSeparator();

  // Format amount with decimal places and thousands separator
  const formattedAmount = formatNumberWithSeparator(
    roundedValue,
    separator,
    decimalPlaces
  );

  // Get localized unit name (or empty string if not provided)
  let localizedUnit = '';
  if (unitName) {
    if (
      typeof unitName === 'object' &&
      unitName.TableNamespace &&
      unitName.Key
    ) {
      // Handle LocalizationKey object
      localizedUnit =
        unitName.InvariantString ||
        locData[unitName.TableNamespace]?.[unitName.Key] ||
        unitName.en ||
        '';
    } else if (typeof unitName === 'string') {
      // Handle plain string
      localizedUnit = unitName;
    }
  }

  // Apply pattern
  return pattern
    .replace('{Amount}', formattedAmount)
    .replace('{Unit}', localizedUnit);
}

/**
 * Replaces stat placeholders in text with values from choice map
 * @param {string} text - Text with stat placeholders
 * @param {Object} choiceMap - Choice map with stat data
 * @param {number} currentChoice - Current choice index
 * @param {Object} locData - Localization data
 * @param {boolean} wrapInHtml - Whether to wrap values in HTML tags
 * @returns {string} Text with stat placeholders replaced
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
      const replacement = wrapInHtml
        ? `<strong>${formattedValue}</strong>`
        : formattedValue;
      result = result.replace(regex, replacement);
    }
    // If value not found, leave placeholder intact
  }
  return result;
}
