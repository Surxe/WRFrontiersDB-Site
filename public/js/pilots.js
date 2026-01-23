document.addEventListener('DOMContentLoaded', function () {
  const pilotTalentHoverTable = document.getElementById('pilots-table-pilot-talent-hover');
  const pilotTalentTypeTable = document.getElementById(
    'pilots-table-pilot-talent-type'
  );
  const pilotTalentFullTable = document.getElementById(
    'pilots-table-pilot-talent-full'
  );

  if (!pilotTalentHoverTable || !pilotTalentTypeTable || !pilotTalentFullTable) {
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

  // Insert switcher before the first table
  pilotTalentHoverTable.parentNode.insertBefore(switcherContainer, pilotTalentHoverTable);

  // Add click handlers
  const buttons = switcherContainer.querySelectorAll('.switcher-btn');
  buttons.forEach((button) => {
    button.addEventListener('click', function () {
      // Remove active class from all buttons
      buttons.forEach((btn) => btn.classList.remove('active'));

      // Add active class to clicked button
      this.classList.add('active');

      // Hide all tables
      pilotTalentHoverTable.style.display = 'none';
      pilotTalentTypeTable.style.display = 'none';
      pilotTalentFullTable.style.display = 'none';

      // Show selected table
      const tableType = this.getAttribute('data-table');
      if (tableType === 'pilot-talent-hover') {
        pilotTalentHoverTable.style.display = 'table';
      } else if (tableType === 'pilot-talent-type') {
        pilotTalentTypeTable.style.display = 'table';
      } else if (tableType === 'pilot-talent-full') {
        pilotTalentFullTable.style.display = 'table';
      }
    });
  });

  // Initially hide all but the hover table
  pilotTalentTypeTable.style.display = 'none';
  pilotTalentFullTable.style.display = 'none';
  pilotTalentHoverTable.style.display = 'table';
});
