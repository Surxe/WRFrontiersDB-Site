/**
 * Module page functionality
 * Waits for DOM to be ready before accessing elements
 */
function initializeModulePage() {
  try {
    const el = document.getElementById('object-data');
    if (!el) {
      console.error('Object data element not found');
      return;
    }
    
    const module = JSON.parse(el.textContent.replace(/&quot;/g, '"'));
    
    const statsEl = document.getElementById('stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <p>Production_Status: ${module.production_status || 'Unknown'}</p>
      `;
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
