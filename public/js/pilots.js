document.addEventListener('DOMContentLoaded', function () {
  const pilotTalentHoverTables = document.querySelectorAll('.pilots-table-pilot-talent-hover');
  const pilotTalentTypeTables = document.querySelectorAll('.pilots-table-pilot-talent-type');
  const pilotTalentFullTables = document.querySelectorAll('.pilots-table-pilot-talent-full');

  if (pilotTalentHoverTables.length === 0 || pilotTalentTypeTables.length === 0 || pilotTalentFullTables.length === 0) {
    console.warn('Pilot tables not found');
    return;
  }

  // Create switcher container
  const switcherContainer = document.createElement('div');
  switcherContainer.className = 'table-switcher';
  switcherContainer.innerHTML = `
    <div class="switcher-buttons">
      <button class="switcher-btn active" data-table="pilot-talent-hover">
        Pilot Talents (Hover)
      </button>
      <button class="switcher-btn" data-table="pilot-talent-type">
        Pilot Talent Types
      </button>
      <button class="switcher-btn" data-table="pilot-talent-full">
        Pilot Talents (Full)
      </button>
    </div>
  `;

  // Insert switcher before the first hover table
  pilotTalentHoverTables[0].parentNode.insertBefore(switcherContainer, pilotTalentHoverTables[0]);

  // Add click handlers
  const buttons = switcherContainer.querySelectorAll('.switcher-btn');
  buttons.forEach((button) => {
    button.addEventListener('click', function () {
      // Remove active class from all buttons
      buttons.forEach((btn) => btn.classList.remove('active'));

      // Add active class to clicked button
      this.classList.add('active');

      // Hide all tables
      pilotTalentHoverTables.forEach(table => table.style.display = 'none');
      pilotTalentTypeTables.forEach(table => table.style.display = 'none');
      pilotTalentFullTables.forEach(table => table.style.display = 'none');

      // Show selected tables
      const tableType = this.getAttribute('data-table');
      if (tableType === 'pilot-talent-hover') {
        pilotTalentHoverTables.forEach(table => table.style.display = 'table');
      } else if (tableType === 'pilot-talent-type') {
        pilotTalentTypeTables.forEach(table => table.style.display = 'table');
      } else if (tableType === 'pilot-talent-full') {
        pilotTalentFullTables.forEach(table => table.style.display = 'table');
      }
    });
  });

  // Initially hide all but the hover tables
  pilotTalentTypeTables.forEach(table => table.style.display = 'none');
  pilotTalentFullTables.forEach(table => table.style.display = 'none');
  pilotTalentHoverTables.forEach(table => table.style.display = 'table');
});
