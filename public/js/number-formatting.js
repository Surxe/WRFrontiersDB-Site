/**
 * Number formatting utilities for client-side number display
 * Handles thousands separators and decimal places
 */

/**
 * Formats a number with thousands separator and decimal places
 * @param {number} value - The number to format
 * @param {string} separator - Thousands separator (',' or '.')
 * @param {number} decimalPlaces - Number of decimal places to show
 * @returns {string} Formatted number
 */
export function formatNumberWithSeparator(value, separator, decimalPlaces) {
  // Apply decimal places first (preserving existing system)
  let processedValue;
  if (decimalPlaces !== undefined) {
    processedValue = parseFloat(value.toFixed(decimalPlaces)).toString();
  } else {
    processedValue = value.toString();
  }

  // Split into integer and decimal parts
  const [integerPart, decimalPart] = processedValue.split('.');
  
  // Apply thousands separator to integer part
  let formattedInteger = integerPart;
  if (separator && integerPart.length > 3) {
    const regex = /\B(?=(\d{3})+(?!\d))/g;
    formattedInteger = integerPart.replace(regex, separator);
  }
  
  // Combine with decimal part if it exists
  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
}

/**
 * Gets current thousands separator preference
 * @returns {string} Current separator preference (',' or '.')
 */
export function getCurrentSeparator() {
  try {
    return localStorage.getItem('numberSeparator') || ',';
  } catch (e) {
    // localStorage not available (server-side rendering), fallback to comma
    return ',';
  }
}

/**
 * Sets current thousands separator preference
 * @param {string} separator - Separator to save (',' or '.')
 */
export function setCurrentSeparator(separator) {
  localStorage.setItem('numberSeparator', separator);
}

/**
 * Updates DOM elements with number formatting data attributes
 * @param {string|string[]} selectors - CSS selector(s) for elements to update
 */
export function updateNumberElements(selectors) {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
  const currentSeparator = getCurrentSeparator();

  selectorArray.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      const numberValue = element.dataset.numberValue;
      const decimalPlaces = element.dataset.decimalPlaces;

      if (numberValue !== undefined) {
        const value = parseFloat(numberValue);
        const decimalPlacesNum = decimalPlaces !== undefined ? parseInt(decimalPlaces, 10) : undefined;
        
        const formattedValue = formatNumberWithSeparator(value, currentSeparator, decimalPlacesNum);
        element.textContent = formattedValue;
      }
    });
  });
}

/**
 * Formats a stat value using the existing stat system but with thousands separators
 * @param {number} value - The stat value
 * @param {string} pattern - Pattern string with {Amount} and {Unit} placeholders
 * @param {Object|string|undefined} unitName - Localized unit name object
 * @param {number|undefined} unitExponent - Power to apply to the value
 * @param {number|undefined} decimalPlaces - Number of decimal places to show
 * @param {Object} locData - Localization data for unit names
 * @returns {string} Formatted stat value with thousands separators
 */
export function formatStatValueWithSeparator(value, pattern, unitName, unitExponent, decimalPlaces, locData) {
  // Apply exponent (default to 1.0)
  const exponentValue = unitExponent ?? 1.0;
  const exponentiatedValue = Math.pow(value, exponentValue);

  // Round to avoid floating point precision errors
  const roundedValue = Math.round(exponentiatedValue * 1e10) / 1e10;

  // Get current separator preference
  const separator = getCurrentSeparator();

  // Format amount with decimal places and thousands separator
  const formattedAmount = formatNumberWithSeparator(roundedValue, separator, decimalPlaces);

  // Get localized unit name (reuse existing logic)
  let localizedUnit = '';
  if (unitName) {
    if (
      typeof unitName === 'object' &&
      unitName.TableNamespace &&
      unitName.Key
    ) {
      localizedUnit =
        locData[unitName.TableNamespace]?.[unitName.Key] || unitName.en || '';
    } else if (typeof unitName === 'string') {
      localizedUnit = unitName;
    }
  }

  // Apply pattern
  return pattern
    .replace('{Amount}', formattedAmount)
    .replace('{Unit}', localizedUnit);
}
