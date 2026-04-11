import {
  getCurrentSeparator,
  setCurrentSeparator,
  updateNumberElements,
} from './number-formatting.js';

/**
 * Initializes number format selector dropdown
 * @param {string} selectorId - ID of the select element
 * @param {Function} onChange - Optional callback when format changes
 */
export function initNumberFormatSelector(
  selectorId = 'number-format-selector',
  onChange = null
) {
  const savedSeparator = getCurrentSeparator();
  const selector = document.getElementById(selectorId);

  if (!selector) {
    console.warn(`Number format selector with id "${selectorId}" not found`);
    return;
  }

  // Set to saved separator
  selector.value = savedSeparator;

  // Handle changes
  selector.addEventListener('change', async (e) => {
    const newSeparator = e.target.value;
    setCurrentSeparator(newSeparator);

    // Update all number elements
    updateNumberElements('[data-number-value]');

    // Also update stat elements that contain numbers
    const { initializeLocalization } = await import('./localization.js');
    // Use requestAnimationFrame to ensure DOM updates complete before re-localization
    // eslint-disable-next-line no-undef
    requestAnimationFrame(async () => {
      await initializeLocalization('current', '[data-stat-value-choices]');
    });

    if (onChange) {
      onChange(newSeparator);
    }
  });
}

/**
 * Creates a number format selector dropdown if it doesn't exist
 * @param {string} containerId - ID of container element to create selector in
 * @param {string} selectorId - ID for the created selector
 * @param {string} label - Label text for the selector
 */
export function createNumberFormatSelector(
  containerId = 'number-format-container',
  selectorId = 'number-format-selector',
  label = 'Number Format:'
) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`Container with id "${containerId}" not found`);
    return;
  }

  // Check if selector already exists
  if (document.getElementById(selectorId)) {
    return;
  }

  // Create selector HTML
  const selectorHTML = `
    <label for="${selectorId}">${label}</label>
    <select id="${selectorId}">
      <option value=",">1,234 (Comma)</option>
      <option value=".">1.234 (Period)</option>
    </select>
  `;

  // Add to container
  container.innerHTML = selectorHTML;

  // Initialize the selector
  initNumberFormatSelector(selectorId);
}
