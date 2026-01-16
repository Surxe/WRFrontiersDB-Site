// Simple test script to verify JavaScript loading on production
console.log('Test script loaded successfully!');

// Create a simple function that can be called from browser console
window.testFunction = function () {
  alert('Production JavaScript is working!');
  return 'JavaScript test successful';
};

// Log the base path for debugging
if (typeof window !== 'undefined' && window.__ASTRO_BASE_PATH__) {
  console.log('Astro base path:', window.__ASTRO_BASE_PATH__);
} else {
  console.log('Astro base path not available yet');
}
