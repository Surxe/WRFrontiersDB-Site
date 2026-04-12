document.addEventListener('DOMContentLoaded', function () {
  // Get query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  const validViews = ['pilot-talent-hover', 'pilot-talent-type', 'pilot-talent-full'];
  const currentView = validViews.includes(viewParam) ? viewParam : 'pilot-talent-hover';

  // Find all tables
  const pilotTalentHoverTables = document.querySelectorAll('.pilots-table-pilot-talent-hover');
  const pilotTalentTypeTables = document.querySelectorAll('.pilots-table-pilot-talent-type');
  const pilotTalentFullTables = document.querySelectorAll('.pilots-table-pilot-talent-full');

  // Find all navigation buttons
  const switcherButtons = document.querySelectorAll('.switcher-btn');

  // Function to show only the specified table type
  function showTable(viewType) {
    // Hide all tables
    pilotTalentHoverTables.forEach(table => table.style.display = 'none');
    pilotTalentTypeTables.forEach(table => table.style.display = 'none');
    pilotTalentFullTables.forEach(table => table.style.display = 'none');

    // Show selected tables
    switch (viewType) {
      case 'pilot-talent-hover':
        pilotTalentHoverTables.forEach(table => table.style.display = 'table');
        break;
      case 'pilot-talent-type':
        pilotTalentTypeTables.forEach(table => table.style.display = 'table');
        break;
      case 'pilot-talent-full':
        pilotTalentFullTables.forEach(table => table.style.display = 'table');
        break;
    }

    // Update button active states
    switcherButtons.forEach(button => {
      button.classList.remove('active');
      const buttonView = button.getAttribute('href')?.replace('?view=', '');
      if (buttonView === viewType) {
        button.classList.add('active');
      }
    });
  }

  // Show the initial table based on query parameter
  showTable(currentView);

  // Handle navigation button clicks
  switcherButtons.forEach(button => {
    button.addEventListener('click', function (e) {
      e.preventDefault();
      const view = this.getAttribute('href')?.replace('?view=', '');
      if (view && validViews.includes(view)) {
        // Update URL without page reload
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('view', view);
        window.history.pushState({}, '', newUrl);
        
        // Show the selected table
        showTable(view);
      }
    });
  });

  // Handle browser back/forward buttons
  window.addEventListener('popstate', function () {
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const view = validViews.includes(viewParam) ? viewParam : 'pilot-talent-hover';
    showTable(view);
  });
});
