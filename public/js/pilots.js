document.addEventListener('DOMContentLoaded', async function () {
  // Import table switching utility
  const { setupTableSwitching } = await import('./table-switcher.js');

  // Find all relevant tables
  const pilotTalentHoverTables = document.querySelectorAll(
    '.pilots-table-pilot-talent-hover'
  );
  const pilotTalentTypeTables = document.querySelectorAll(
    '.pilots-table-pilot-talent-type'
  );
  const pilotTalentFullTables = document.querySelectorAll(
    '.pilots-table-pilot-talent-full'
  );

  if (
    pilotTalentHoverTables.length === 0 ||
    pilotTalentTypeTables.length === 0 ||
    pilotTalentFullTables.length === 0
  ) {
    console.warn('Pilot tables not found');
    return;
  }

  // Set up table configuration
  const tableTypes = [
    'pilot-talent-hover',
    'pilot-talent-type',
    'pilot-talent-full',
  ];
  const buttonLabels = [
    'Pilot Talents (Hover)',
    'Pilot Talent Types',
    'Pilot Talents (Full)',
  ];
  const activeTable = 'pilot-talent-hover';

  const tables = {
    'pilot-talent-hover': pilotTalentHoverTables,
    'pilot-talent-type': pilotTalentTypeTables,
    'pilot-talent-full': pilotTalentFullTables,
  };

  // Find first table to insert switcher before it
  const firstTable =
    pilotTalentHoverTables.length > 0
      ? pilotTalentHoverTables[0]
      : pilotTalentTypeTables.length > 0
        ? pilotTalentTypeTables[0]
        : pilotTalentFullTables.length > 0
          ? pilotTalentFullTables[0]
          : null;

  if (!firstTable) {
    console.warn('No table found to insert switcher before');
    return;
  }

  // Set up table switching with the utility
  setupTableSwitching({
    tableTypes,
    buttonLabels,
    tables,
    activeTable,
    insertBefore: firstTable,
    cssClasses: {
      container: 'table-switcher',
      button: 'switcher-btn',
    },
  });
});
