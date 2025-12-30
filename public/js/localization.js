// Localization cache shared across all pages
const localizationCache = {};

/**
 * Loads localization data for a specific language and version
 * @param {string} lang - Language code (e.g., 'en', 'ru', 'ja')
 * @param {string} version - Game version date (e.g., '2025-12-09')
 * @returns {Promise<Object|null>} Localization data or null if failed
 */
export async function loadLanguage(lang, version) {
  const cacheKey = `${version}-${lang}`;
  if (localizationCache[cacheKey]) {
    return localizationCache[cacheKey];
  }
  
  try {
    const response = await fetch(`/WRFrontiersDB-Site/WRFrontiersDB-Data/archive/${version}/Localization/${lang}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    localizationCache[cacheKey] = await response.json();
    return localizationCache[cacheKey];
  } catch (error) {
    console.warn(`Failed to load language ${lang} for version ${version}:`, error);
    return null;
  }
}

/**
 * Gets localized text from loaded localization data
 * @param {Object} locData - Loaded localization data
 * @param {string} namespace - TableNamespace (e.g., 'Ability_name')
 * @param {string} key - Localization key (e.g., 'ABL_name_ArmorShield')
 * @param {string} fallback - Fallback text if not found
 * @returns {string} Localized text or fallback
 */
export function getLocalizedText(locData, namespace, key, fallback = '') {
  return locData?.[namespace]?.[key] || fallback || key;
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
 * @param {Object} locData - Loaded localization data
 * @param {string|string[]} selectors - CSS selector(s) for elements to update
 */
export function updateLocalizedElements(locData, selectors) {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
  
  selectorArray.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      const namespace = element.dataset.locNamespace;
      const key = element.dataset.locKey;
      const fallback = element.dataset.locFallback || element.textContent;
      
      if (namespace && key) {
        const localizedText = getLocalizedText(locData, namespace, key, fallback);
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
export async function initializeLocalization(version, selectors = '[data-loc-key]') {
  const currentLang = getCurrentLanguage();
  
  // Update language indicator if exists
  const langSpan = document.getElementById('current-lang');
  if (langSpan) {
    langSpan.textContent = currentLang;
  }
  
  // Skip loading if English (already embedded as fallback)
  if (currentLang === 'en') return;
  
  // Load and apply localization
  const locData = await loadLanguage(currentLang, version);
  if (locData) {
    updateLocalizedElements(locData, selectors);
  }
}
