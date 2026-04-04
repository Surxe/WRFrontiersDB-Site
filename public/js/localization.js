/**
 * @typedef {import('../../src/types/localization').LocalizationKey} LocalizationKey
 * @typedef {import('../../src/types/localization').LocalizationData} LocalizationData
 */

// Import shared stat formatting functions from TypeScript file
import { replaceStatPlaceholdersFromChoiceMap } from '../../src/utils/stat_formatting.js';

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
    const [gameResponse, localResponse] = await Promise.all([
      fetch(`/WRFrontiersDB-Data/current/Localization/${lang}.json`),
      fetch(`/locales/${lang}.json`).catch(() => null)
    ]);

    if (!gameResponse.ok) throw new Error(`HTTP ${gameResponse.status}`);
    
    const gameData = await gameResponse.json();
    let localData = {};
    
    if (localResponse && localResponse.ok) {
      try {
        localData = await localResponse.json();
      } catch (e) {
        console.warn(`Failed to parse local dict for ${lang}`, e);
      }
    }

    // Merge namespaces
    const mergedData = { ...gameData };
    for (const [namespace, keys] of Object.entries(localData)) {
      if (!mergedData[namespace]) Object.assign(mergedData, { [namespace]: {} });
      Object.assign(mergedData[namespace], keys);
    }
    
    localizationCache[cacheKey] = mergedData;
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

            // The choiceMap from StatEmbedLocalizedText already has the correct format
            // with shortKey as the key, so we can use it directly
            localizedText = replaceStatPlaceholdersFromChoiceMap(
              localizedText,
              choiceMap,
              currentChoice,
              locData,
              true // Wrap in HTML tags for client-side display
            );
          } catch (error) {
            console.warn('Failed to parse stat value choices:', error);
          }
        }

        element.innerHTML = localizedText;
      }
    });
  });
}

/**
 * Full localization update for a page
 * @param {string} version - Game version for this page (ignored, always uses current)
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
  const locData = await loadLanguage(currentLang, 'current');
  if (locData) {
    updateLocalizedElements(locData, selectors);
  }
}

/**
 * Sets the current stat choice for elements with stat value choices
 * @param {number} choiceIndex - Index of the choice to use (0-based)
 * @param {string} version - Game version for re-localization (ignored, always uses current)
 */
export async function setStatChoice(choiceIndex, _version) {
  // Update data-current-choice on all elements with stat choices
  const elements = document.querySelectorAll('[data-stat-value-choices]');
  elements.forEach((element) => {
    element.dataset.currentChoice = String(choiceIndex);
  });

  // Re-run localization to apply new choice
  const currentLang = getCurrentLanguage();
  const locData =
    currentLang === 'en' ? {} : await loadLanguage(currentLang, 'current');
  updateLocalizedElements(locData || {}, '[data-loc-key]');
}
