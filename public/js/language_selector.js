import { getCurrentLanguage, setCurrentLanguage } from './localization.js';

/**
 * Initializes language selector dropdown
 * @param {string} selectorId - ID of the select element
 * @param {Function} onChange - Optional callback when language changes
 */
export function initLanguageSelector(selectorId = 'lang-selector', onChange = null) {
  const savedLang = getCurrentLanguage();
  const selector = document.getElementById(selectorId);
  
  if (!selector) {
    console.warn(`Language selector with id "${selectorId}" not found`);
    return;
  }
  
  // Set to saved language
  selector.value = savedLang;
  
  // Handle changes
  selector.addEventListener('change', (e) => {
    const newLang = e.target.value;
    setCurrentLanguage(newLang);
    
    if (onChange) {
      onChange(newLang);
    } else {
      // Default: reload page to apply new language
      window.location.reload();
    }
  });
}
