/**
 * Module page functionality
 * Waits for DOM to be ready before accessing elements
 */
async function initializeModulePage() {
  try {
    const el = document.getElementById('object-data');
    if (!el) {
      console.error('Object data element not found');
      return;
    }

    const _module = JSON.parse(el.textContent.replace(/&quot;/g, '"'));

    const levelSwitcher = document.getElementById('level-switcher');
    if (levelSwitcher) {
      // Import setStatChoice dynamically
      const { setStatChoice } = await import('./localization.js');

      levelSwitcher.addEventListener('change', (e) => {
        const levelIndex = parseInt(e.target.value, 10);
        setStatChoice(levelIndex);
      });
    }
  } catch (error) {
    console.error('Error initializing module page:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeModulePage);
} else {
  initializeModulePage();
}
