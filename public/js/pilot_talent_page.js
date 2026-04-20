/**
 * Pilot Talent Page Table Switching
 * Implements table switching functionality specifically for pilot talent pages
 */

import {
  setupTableSwitching,
  createTableSwitcher,
  initializeTableSwitching,
  showTable,
} from './table_switcher.js';

/**
 * Initialize pilot talent page table switching
 * Sets up hover and full display mode switching for pilot talent tables
 */
document.addEventListener('DOMContentLoaded', function () {
  // Find all relevant tables
  const pilotTalentHoverTables = document.querySelectorAll(
    '.pilots-table-pilot-talent-hover'
  );
  const pilotTalentFullTables = document.querySelectorAll(
    '.pilots-table-pilot-talent-full'
  );

  // Check if tables exist
  if (
    pilotTalentHoverTables.length === 0 &&
    pilotTalentFullTables.length === 0
  ) {
    console.warn('Pilot talent tables not found');
    return;
  }

  // Set up table configuration
  const tableTypes = ['pilot-talent-hover', 'pilot-talent-full'];
  const buttonLabels = ['Pilot Talents (Hover)', 'Pilot Talents (Full)'];
  const activeTable = 'pilot-talent-hover';

  const tables = {
    'pilot-talent-hover': pilotTalentHoverTables,
    'pilot-talent-full': pilotTalentFullTables,
  };

  // Find the first table to insert switcher before it
  const firstTable =
    pilotTalentHoverTables.length > 0
      ? pilotTalentHoverTables[0]
      : pilotTalentFullTables[0];

  if (!firstTable) {
    console.warn('No table found to insert switcher before');
    return;
  }

  // Set up table switching with custom configuration
  setupTableSwitching({
    tableTypes,
    buttonLabels,
    tables,
    activeTable,
    insertBefore: firstTable,
    cssClasses: {
      container: 'table_switcher pilot-talent-switcher',
      button: 'switcher-btn',
    },
  });
});

/**
 * Export functions for potential external use
 */
export {
  setupTableSwitching,
  createTableSwitcher,
  initializeTableSwitching,
  showTable,
};
