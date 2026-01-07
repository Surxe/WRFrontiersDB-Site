const el = document.getElementById('module-data');
const module = JSON.parse(el.textContent);

const statsEl = document.getElementById('stats');
statsEl.innerHTML = `
  <p>Production_Status: ${module.production_status}</p>
`;
