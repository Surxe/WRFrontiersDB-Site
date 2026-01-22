document.addEventListener('DOMContentLoaded', function() {
  const pilotTalentTable = document.getElementById('pilots-table-pilot-talent');
  const pilotTalentTypeTable = document.getElementById('pilots-table-pilot-talent-type');
  
  if (!pilotTalentTable || !pilotTalentTypeTable) {
    console.warn('Pilot tables not found');
    return;
  }

  // Create switcher container
  const switcherContainer = document.createElement('div');
  switcherContainer.className = 'table-switcher';
  switcherContainer.innerHTML = `
    <div class="switcher-buttons">
      <button class="switcher-btn active" data-table="pilot-talent">
        Pilot Talents
      </button>
      <button class="switcher-btn" data-table="pilot-talent-type">
        Pilot Talent Types
      </button>
    </div>
  `;

  // Insert switcher before the first table
  pilotTalentTable.parentNode.insertBefore(switcherContainer, pilotTalentTable);

  // Add click handlers
  const buttons = switcherContainer.querySelectorAll('.switcher-btn');
  buttons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all buttons
      buttons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      // Hide all tables
      pilotTalentTable.style.display = 'none';
      pilotTalentTypeTable.style.display = 'none';
      
      // Show selected table
      const tableType = this.getAttribute('data-table');
      if (tableType === 'pilot-talent') {
        pilotTalentTable.style.display = 'table';
      } else if (tableType === 'pilot-talent-type') {
        pilotTalentTypeTable.style.display = 'table';
      }
    });
  });

  // Initially hide the second table and show the first
  pilotTalentTypeTable.style.display = 'none';
  pilotTalentTable.style.display = 'table';
});