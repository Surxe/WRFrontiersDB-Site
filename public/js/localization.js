/**
 * @typedef {import('../../src/types/localization').LocalizationKey} LocalizationKey
 * @typedef {import('../../src/types/localization').LocalizationData} LocalizationData
 */

// Localization cache shared across all pages
const localizationCache = {};

/**
 * Loads localization data for a specific language and version
 * @param {string} lang - Language code (e.g., 'en', 'ru', 'ja')
 * @param {string} version - Game version date (e.g., '2025-12-09')
 * @returns {Promise<LocalizationData|null>} Localization data or null if failed
 */
export async function loadLanguage(lang, version) {
  const cacheKey = `${version}-${lang}`;
  if (localizationCache[cacheKey]) {
    return localizationCache[cacheKey];
  }

  try {
    const response = await fetch(
      `/WRFrontiersDB-Site/WRFrontiersDB-Data/archive/${version}/Localization/${lang}.json`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    localizationCache[cacheKey] = await response.json();
    return localizationCache[cacheKey];
  } catch (error) {
    console.warn(
      `Failed to load language ${lang} for version ${version}:`,
      error
    );
    return null;
  }
}

/**
 * Gets localized text from loaded localization data
 * @param {LocalizationData} locData - Loaded localization data
 * @param {string} namespace - TableNamespace (e.g., 'Ability_name')
 * @param {string} key - Localization key (e.g., 'ABL_name_ArmorShield')
 * @param {string} fallback - Fallback text if not found
 * @returns {string} Localized text or fallback
 */
export function getLocalizedText(locData, namespace, key, fallback = false) {
  if (!fallback) {
    fallback = key;
  }
  const localizedText = locData?.[namespace]?.[key] || fallback;
  return localizedText;
}

/**
 * Gets current language from localStorage with fallback
 * @returns {string} Current language code
 */
export function getCurrentLanguage() {
  return localStorage.getItem('selectedLang') || 'en';
}

/**
 * Sets current language in localStorage
 * @param {string} lang - Language code to save
 */
export function setCurrentLanguage(lang) {
  localStorage.setItem('selectedLang', lang);
}

/**
 * Formats a stat value using pattern, unit name, and decimal places
 * @param {number} value - The numeric value to format
 * @param {string} pattern - Pattern string with {Amount} and {Unit} placeholders
 * @param {LocalizationKey} [unitName] - Unit name localization key
 * @param {number} [decimalPlaces] - Number of decimal places
 * @param {LocalizationData} locData - Localization data for unit names
 * @returns {string} Formatted stat value
 */
function formatStatValue(value, pattern, unitName, decimalPlaces, locData) {
  // Format amount with decimal places
  const formattedAmount =
    decimalPlaces !== undefined ? value.toFixed(decimalPlaces) : String(value);

  // Get localized unit name (or empty string if not provided)
  let localizedUnit = '';
  if (unitName) {
    localizedUnit = getLocalizedText(
      locData,
      unitName.TableNamespace,
      unitName.Key,
      unitName.en // English fallback
    );
  }

  // Apply pattern
  return pattern
    .replace('{Amount}', formattedAmount)
    .replace('{Unit}', localizedUnit);
}

/**
 * Replaces stat placeholders in text with values from choice map
 * @param {string} text - Text with placeholders like {ArmorBoost}
 * @param {Object} choiceMap - Map of {shortKey: {pattern, unitName, decimalPlaces, choices}}
 * @param {number} currentChoice - Index of choice to use
 * @param {Object} locData - Localization data for unit names
 * @returns {string} Text with placeholders replaced
 */
function replaceStatPlaceholders(text, choiceMap, currentChoice, locData) {
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
        data.decimalPlaces,
        locData
      );

      // Replace all occurrences of {shortKey} with the formatted value
      const regex = new RegExp(`\\{${shortKey}\\}`, 'g');
      result = result.replace(regex, formattedValue);
    }
    // If value not found, leave placeholder intact
  }
  return result;
}

/**
 * Updates DOM elements with localization data attributes
 * @param {LocalizationData} locData - Loaded localization data
 * @param {string|string[]} selectors - CSS selector(s) for elements to update
 */
export function updateLocalizedElements(locData, selectors) {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

  selectorArray.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      const namespace = element.dataset.locNamespace;
      const key = element.dataset.locKey;
      const fallback = element.dataset.locFallback || element.textContent;

      if (namespace && key) {
        let localizedText = getLocalizedText(locData, namespace, key, fallback);

        // Handle stat replacements if data-stat-value-choices exists
        const statValueChoices = element.dataset.statValueChoices;
        if (statValueChoices) {
          try {
            const choiceMap = JSON.parse(statValueChoices);
            const currentChoice = parseInt(
              element.dataset.currentChoice || '0',
              10
            );
            localizedText = replaceStatPlaceholders(
              localizedText,
              choiceMap,
              currentChoice,
              locData
            );
          } catch (error) {
            console.warn('Failed to parse stat value choices:', error);
          }
        }

        element.textContent = localizedText;
      }
    });
  });
}

/**
 * Full localization update for a page
 * @param {string} version - Game version for this page
 * @param {string|string[]} selectors - Elements to localize
 */
export async function initializeLocalization(
  version,
  selectors = '[data-loc-key]'
) {
  const currentLang = getCurrentLanguage();

  // Update language indicator if exists
  const langSpan = document.getElementById('current-lang');
  if (langSpan) {
    langSpan.textContent = currentLang;
  }

  // Load and apply localization
  const locData = await loadLanguage(currentLang, version);
  if (locData) {
    updateLocalizedElements(locData, selectors);
  }
}

/**
 * Sets the current stat choice for elements with stat value choices
 * @param {number} choiceIndex - Index of the choice to use (0-based)
 * @param {string} version - Game version for re-localization
 */
export async function setStatChoice(choiceIndex, version) {
  // Update data-current-choice on all elements with stat choices
  const elements = document.querySelectorAll('[data-stat-value-choices]');
  elements.forEach((element) => {
    element.dataset.currentChoice = String(choiceIndex);
  });

  // Re-run localization to apply new choice
  const currentLang = getCurrentLanguage();
  const locData =
    currentLang === 'en' ? {} : await loadLanguage(currentLang, version);
  updateLocalizedElements(locData || {}, '[data-loc-key]');
}
