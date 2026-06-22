/**
 * shoulder_profiles.js
 * Client-side logic for the Shoulder Profiles page.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CHART ABSTRACTION LAYER
 * The rendering surface is isolated in drawShieldChart(). To swap to a
 * different charting library (e.g., Chart.js, uPlot, D3), replace only
 * that function while keeping the ShieldChartData interface unchanged.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * @typedef {Object} ShieldChartData
 * Domain model passed into the renderer — decoupled from any library.
 * @property {number} shieldAmount    - Full shield capacity at this level
 * @property {number} rechargeDelay   - Seconds before regen begins (shields = 0)
 * @property {number} rechargeTime    - Seconds to regen from 0 to shieldAmount
 * @property {number} maxTime         - X axis upper bound (per-category max, seconds)
 * @property {number} maxShield       - Y axis upper bound (per-category max)
 */

// ============================================================
// RENDERING BACKEND — swap this function to change chart library
// ============================================================

/**
 * Renders a shield recharge curve onto a canvas using the native Canvas API.
 *
 * Curve shape:
 *   t ∈ [0, rechargeDelay]                  → shields = 0  (delay flat line)
 *   t ∈ [rechargeDelay, rechargeDelay+rechargeTime] → shields ramp 0→shieldAmount
 *   t > rechargeDelay + rechargeTime          → shields = shieldAmount (plateau)
 *
 * @param {HTMLCanvasElement} canvas
 * @param {ShieldChartData}   data
 */
function drawShieldChart(canvas, data) {
  const { shieldAmount, rechargeDelay, rechargeTime, maxTime, maxShield } = data;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Pixel dimensions — use the canvas's actual pixel size for sharpness
  const W = canvas.width;
  const H = canvas.height;

  const PAD = { top: 24, right: 20, bottom: 44, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Map domain → canvas pixel
  const toX = (t) => PAD.left + (t / maxTime) * plotW;
  const toY = (s) => PAD.top + plotH - (s / maxShield) * plotH;

  // ── Clear & background ──────────────────────────────────────
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, W, H);

  // ── Axis lines ───────────────────────────────────────────────
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.stroke();

  // ── Grid lines (horizontal, 5 evenly spaced) ─────────────────
  const gridCount = 5;
  ctx.strokeStyle = '#2e2e2e';
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1;
  for (let i = 1; i <= gridCount; i++) {
    const gridY = PAD.top + plotH - (i / gridCount) * plotH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, gridY);
    ctx.lineTo(PAD.left + plotW, gridY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ── Vertical marker at rechargeDelay (start of regen) ────────
  if (rechargeDelay > 0 && rechargeDelay < maxTime) {
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(rechargeDelay), PAD.top);
    ctx.lineTo(toX(rechargeDelay), PAD.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Fill under curve ─────────────────────────────────────────
  const rechargeEnd = rechargeDelay + rechargeTime;

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(0));
  ctx.lineTo(toX(rechargeDelay), toY(0));
  ctx.lineTo(toX(rechargeEnd), toY(shieldAmount));
  ctx.lineTo(toX(maxTime), toY(shieldAmount));
  ctx.lineTo(toX(maxTime), toY(0));
  ctx.lineTo(toX(0), toY(0));
  ctx.closePath();
  ctx.fillStyle = 'rgba(79, 195, 247, 0.08)';
  ctx.fill();

  // ── Shield recharge curve ────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(0));
  ctx.lineTo(toX(rechargeDelay), toY(0));
  ctx.lineTo(toX(rechargeEnd), toY(shieldAmount));
  ctx.lineTo(toX(maxTime), toY(shieldAmount));
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dot at full-shield point
  ctx.beginPath();
  ctx.arc(toX(rechargeEnd), toY(shieldAmount), 4, 0, Math.PI * 2);
  ctx.fillStyle = '#4fc3f7';
  ctx.fill();

  // ── Y-axis labels (shield values) ────────────────────────────
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= gridCount; i++) {
    const val = (maxShield / gridCount) * i;
    const y = toY(val);
    ctx.fillText(formatShieldLabel(val), PAD.left - 6, y);
  }

  // ── X-axis labels (time in seconds) ──────────────────────────
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const xTickCount = 5;
  for (let i = 0; i <= xTickCount; i++) {
    const t = (maxTime / xTickCount) * i;
    const x = toX(t);
    ctx.fillText(t.toFixed(1) + 's', x, PAD.top + plotH + 6);
  }

  // ── Axis titles ───────────────────────────────────────────────
  ctx.fillStyle = '#666';
  ctx.font = '10px sans-serif';

  // X axis title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Time (s)', PAD.left + plotW / 2, H - 2);

  // Y axis title (rotated)
  ctx.save();
  ctx.translate(10, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Shields', 0, 0);
  ctx.restore();
}

// ─── END OF RENDERING BACKEND ────────────────────────────────────────────


// ============================================================
// HELPERS
// ============================================================

/**
 * Format a shield value for axis display.
 * Values ≥ 1000 are shown as "N.Nk"; smaller values as plain integers.
 * @param {number} value
 * @returns {string}
 */
function formatShieldLabel(value) {
  if (value >= 1000) {
    return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return Math.round(value).toString();
}


// ============================================================
// PAGE ORCHESTRATION
// ============================================================

/**
 * Render all chart canvases for the given 0-based level index.
 * Reads per-canvas data attributes, extracts the requested level's stats,
 * and calls drawShieldChart.
 *
 * @param {number} levelIndex  0-based (level 1 = index 0, level 13 = index 12)
 */
function renderAllCharts(levelIndex) {
  const canvases = document.querySelectorAll('.shield-chart-canvas');
  canvases.forEach((canvas) => {
    let levels;
    try {
      levels = JSON.parse(canvas.dataset.levels);
    } catch {
      return;
    }

    const levelKey = String(levelIndex + 1); // JSON keys are 1-indexed
    const stats = levels[levelKey];
    if (!stats) return;

    const maxTime = parseFloat(canvas.dataset.maxTime);
    const maxShield = parseFloat(canvas.dataset.maxShield);

    /** @type {ShieldChartData} */
    const chartData = {
      shieldAmount: stats.ShieldAmount,
      rechargeDelay: stats.RechargeDelay,
      rechargeTime: stats.RechargeTime,
      maxTime,
      maxShield,
    };

    drawShieldChart(canvas, chartData);
  });
}

/**
 * Highlight table rows matching the given 1-based level number.
 * Removes highlight from all other rows first.
 *
 * @param {number} levelIndex  0-based level index
 */
function updateTableHighlight(levelIndex) {
  const levelNum = String(levelIndex + 1);
  document
    .querySelectorAll('.shoulder-stats-table tr[data-level]')
    .forEach((row) => {
      row.classList.toggle('is-active-level', row.dataset.level === levelNum);
    });
}

/**
 * Respond to a level change: redraw all charts and update table highlights.
 *
 * @param {number} levelIndex  0-based level index
 */
function onLevelChange(levelIndex) {
  renderAllCharts(levelIndex);
  updateTableHighlight(levelIndex);
}

// ============================================================
// INITIALISATION
// ============================================================

function init() {
  const levelSwitcher = document.getElementById('level-switcher');
  if (!levelSwitcher) {
    console.warn('[shoulder_profiles] level-switcher element not found');
    return;
  }

  // Render at the initial level (value is a 0-based index string)
  const initialLevel = parseInt(levelSwitcher.value, 10);
  onLevelChange(initialLevel);

  // Re-render on every change
  levelSwitcher.addEventListener('change', (e) => {
    onLevelChange(parseInt(e.target.value, 10));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
