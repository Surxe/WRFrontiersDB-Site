/**
 * Table Switcher Utility
 * Provides reusable functionality for switching between different table display modes
 */

/**
 * Creates a table switcher UI with buttons for different table types
 * @param {Object} config - Configuration object
 * @param {string[]} config.tableTypes - Array of table type identifiers
 * @param {string[]} config.buttonLabels - Array of button labels matching tableTypes
 * @param {string} config.activeTable - Initially active table type
 * @param {string} config.containerClass - CSS class for the switcher container
 * @param {string} config.buttonClass - CSS class for switcher buttons
 * @returns {HTMLElement} The created switcher container element
 */
export function createTableSwitcher(config) {
  const {
    tableTypes,
    buttonLabels,
    activeTable,
    containerClass = 'table-switcher',
    buttonClass = 'switcher-btn',
  } = config;

  // Validate configuration
  if (tableTypes.length !== buttonLabels.length) {
    throw new Error('tableTypes and buttonLabels must have the same length');
  }
  if (!tableTypes.includes(activeTable)) {
    throw new Error('activeTable must be one of the tableTypes');
  }

  // Create switcher container
  const switcherContainer = document.createElement('div');
  switcherContainer.className = containerClass;

  // Create buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'switcher-buttons';

  // Create buttons for each table type
  tableTypes.forEach((tableType, index) => {
    const button = document.createElement('button');
    button.className = buttonClass;
    button.setAttribute('data-table', tableType);
    button.textContent = buttonLabels[index];

    // Set active state for the initially active table
    if (tableType === activeTable) {
      button.classList.add('active');
    }

    buttonsContainer.appendChild(button);
  });

  switcherContainer.appendChild(buttonsContainer);
  return switcherContainer;
}

/**
 * Initializes table switching functionality
 * @param {Object} config - Configuration object
 * @param {string[]} config.tableTypes - Array of table type identifiers
 * @param {Object} config.tables - Object mapping table types to NodeList of table elements
 * @param {HTMLElement} config.switcherContainer - The switcher container element
 * @param {string} config.activeTable - Initially active table type
 */
export function initializeTableSwitching(config) {
  const { tableTypes, tables, switcherContainer, activeTable } = config;

  // Get all switcher buttons
  const buttons = switcherContainer.querySelectorAll('.switcher-btn');

  // Add click handlers to buttons
  buttons.forEach((button) => {
    button.addEventListener('click', function () {
      const tableType = this.getAttribute('data-table');

      // Remove active class from all buttons
      buttons.forEach((btn) => btn.classList.remove('active'));

      // Add active class to clicked button
      this.classList.add('active');

      // Show the selected table type
      showTable(tableType, tables);
    });
  });

  // Initially show only the active table
  showTable(activeTable, tables);
}

/**
 * Shows/hides tables based on the selected table type
 * @param {string} tableType - The table type to show
 * @param {Object} tables - Object mapping table types to NodeList of table elements
 */
export function showTable(tableType, tables) {
  // Hide all tables
  Object.values(tables).forEach((tableList) => {
    if (tableList && tableList.forEach) {
      tableList.forEach((table) => {
        table.style.display = 'none';
      });
    }
  });

  // Show selected tables
  const selectedTables = tables[tableType];
  if (selectedTables && selectedTables.forEach) {
    selectedTables.forEach((table) => {
      table.style.display = 'table';
    });
  }
}

/**
 * Convenience function to set up complete table switching
 * @param {Object} config - Configuration object
 * @param {string[]} config.tableTypes - Array of table type identifiers
 * @param {string[]} config.buttonLabels - Array of button labels matching tableTypes
 * @param {Object} config.tables - Object mapping table types to NodeList of table elements
 * @param {string} config.activeTable - Initially active table type
 * @param {HTMLElement} config.insertBefore - Element to insert switcher before (optional)
 * @param {Object} config.cssClasses - Custom CSS classes (optional)
 */
export function setupTableSwitching(config) {
  const {
    tableTypes,
    buttonLabels,
    tables,
    activeTable,
    insertBefore,
    cssClasses = {},
  } = config;

  // Validate that all table types exist in the tables object
  Object.keys(tables).forEach((tableType) => {
    if (!tables[tableType] || tables[tableType].length === 0) {
      console.warn(`No tables found for table type: ${tableType}`);
    }
  });

  // Create switcher
  const switcherContainer = createTableSwitcher({
    tableTypes,
    buttonLabels,
    activeTable,
    containerClass: cssClasses.container || 'table-switcher',
    buttonClass: cssClasses.button || 'switcher-btn',
  });

  // Insert switcher into DOM
  if (insertBefore && insertBefore.parentNode) {
    insertBefore.parentNode.insertBefore(switcherContainer, insertBefore);
  } else {
    console.warn('insertBefore element not found or has no parent node');
    return null;
  }

  // Initialize switching functionality
  initializeTableSwitching({
    tableTypes,
    tables,
    switcherContainer,
    activeTable,
  });

  return switcherContainer;
}
