import { getCurrentLanguage, setCurrentLanguage } from './localization.js';

/**
 * Initializes language selector dropdown.
 * Reads the active language from the `lang` URL query parameter and navigates
 * to the current page with the updated param when the user picks a new language.
 *
 * @param {string} selectorId - ID of the select element
 */
export function initLanguageSelector(selectorId = 'lang-selector') {
  const selector = document.getElementById(selectorId);

  if (!selector) {
    console.warn(`Language selector with id "${selectorId}" not found`);
    return;
  }

  // Pre-select the option matching the current lang param
  selector.value = getCurrentLanguage();

  // On change, navigate to same page with updated lang param
  selector.addEventListener('change', (e) => {
    const newLang = e.target.value;
    setCurrentLanguage(newLang);
  });
}
