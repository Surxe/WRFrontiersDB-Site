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
 * @typedef {Object} ShieldChartLine
 * @property {string} color           - Hex color string
 * @property {number} armorBase       - Armor floor (0 in shield-only mode)
 * @property {number} shieldAmount    - Shield capacity at this level (NOT including armor)
 * @property {number} rechargeDelay   - Seconds before regen begins
 * @property {number} rechargeTime    - Seconds to regen from 0 to shieldAmount
 *
 * @typedef {Object} ShieldChartData
 * Domain model passed into the renderer — decoupled from any library.
 * @property {ShieldChartLine[]} lines - The array of lines to draw
 * @property {number} maxTime         - X axis upper bound (per-category max, seconds)
 * @property {number} maxShield       - Y axis upper bound
 * @property {string} [yLabel]        - Y axis label (default: "Shields")
 */

// ============================================================
// PER-CANVAS STATE
// ============================================================

/** @type {Map<string, Set<string>>} Maps canvas ID → disabled shoulder IDs */
const disabledSets = new Map();

/** @type {Set<string>} Canvas IDs with armor mode active */
const armorModeSet = new Set();

// ============================================================
// RENDERING BACKEND — swap this function to change chart library
// ============================================================

/**
 * Renders multiple shield recharge curves onto a canvas using the native Canvas API.
 *
 * Normal mode curve shape:
 *   t ∈ [0, rechargeDelay]                        → y = 0
 *   t ∈ [rechargeDelay, rechargeDelay+rechargeTime] → y ramps 0→shieldAmount
 *   t > rechargeDelay + rechargeTime               → y = shieldAmount
 *
 * Armor mode shifts everything up by armorBase:
 *   y at t=0  = armorBase
 *   y at full = armorBase + shieldAmount
 *
 * @param {HTMLCanvasElement} canvas
 * @param {ShieldChartData}   data
 */
function drawShieldChart(canvas, data) {
  const { lines, maxTime, maxShield, yLabel = 'Shields' } = data;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Resolve canvas crispness and dynamic width
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(rect.width, 100); // fallback if display:none
  const H = 300; // Fixed height (or use rect.height if we want aspect ratio scaling)

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  
  ctx.save();
  ctx.scale(dpr, dpr);

  const PAD = { top: 24, right: 20, bottom: 44, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

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

  // ── Draw fills first (semi-transparent, behind strokes) ──────
  for (const line of lines) {
    const { shieldAmount, rechargeDelay, rechargeTime, color, armorBase = 0 } = line;
    const rechargeEnd = rechargeDelay + rechargeTime;
    const topY = armorBase + shieldAmount;

    // Armor floor band (constant rectangle)
    if (armorBase > 0) {
      ctx.fillStyle = hexToRgba(color, 0.05);
      ctx.fillRect(toX(0), toY(armorBase), plotW, toY(0) - toY(armorBase));
    }

    // Shield regen area (trapezoid from armorBase up to full)
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(armorBase));
    ctx.lineTo(toX(rechargeDelay), toY(armorBase));
    ctx.lineTo(toX(rechargeEnd), toY(topY));
    ctx.lineTo(toX(maxTime), toY(topY));
    ctx.lineTo(toX(maxTime), toY(armorBase));
    ctx.lineTo(toX(0), toY(armorBase));
    ctx.closePath();
    ctx.fillStyle = hexToRgba(color, 0.08);
    ctx.fill();
  }

  // ── Draw curves & armor floor markers ────────────────────────
  for (const line of lines) {
    const { shieldAmount, rechargeDelay, rechargeTime, color, armorBase = 0 } = line;
    const rechargeEnd = rechargeDelay + rechargeTime;
    const topY = armorBase + shieldAmount;

    // Dashed horizontal armor floor line
    if (armorBase > 0) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = hexToRgba(color, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(armorBase));
      ctx.lineTo(toX(maxTime), toY(armorBase));
      ctx.stroke();
      ctx.restore();
    }

    // Shield regen curve
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(armorBase));
    ctx.lineTo(toX(rechargeDelay), toY(armorBase));
    ctx.lineTo(toX(rechargeEnd), toY(topY));
    ctx.lineTo(toX(maxTime), toY(topY));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dot at peak
    ctx.beginPath();
    ctx.arc(toX(rechargeEnd), toY(topY), 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ── Y-axis labels ────────────────────────────────────────────
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= gridCount; i++) {
    const val = (maxShield / gridCount) * i;
    const y = toY(val);
    ctx.fillText(formatShieldLabel(val), PAD.left - 6, y);
  }

  // ── X-axis labels ─────────────────────────────────────────────
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

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Time (s)', PAD.left + plotW / 2, H - 2);

  ctx.save();
  ctx.translate(10, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore(); // restore rotation
  ctx.restore(); // restore dpr scaling
}

/**
 * Converts a hex color to rgba.
 * @param {string} hex  Hex color (e.g. #ff0000)
 * @param {number} alpha Opacity (0 to 1)
 */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── END OF RENDERING BACKEND ────────────────────────────────────────────

// ============================================================
// HELPERS
// ============================================================

/**
 * Format a shield/health value for axis display.
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
 * Render a single chart canvas for the given 0-based level index.
 * Respects per-canvas disabled shoulder sets and armor mode.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} levelIndex  0-based (level 1 = index 0, level 13 = index 12)
 */
function renderChart(canvas, levelIndex) {
  let shouldersData;
  try {
    shouldersData = JSON.parse(canvas.dataset.shoulders);
  } catch {
    return;
  }

  const levelKey = String(levelIndex + 1);
  const maxTime = parseFloat(canvas.dataset.maxTime);
  const disabled = disabledSets.get(canvas.id) ?? new Set();
  const isArmorMode = armorModeSet.has(canvas.id);

  // Shield multiplier in armor mode: capacity ×2, regen/s ×2 (so fill time ÷2)
  const ARMOR_SHIELD_MULT = isArmorMode ? 2 : 1;

  // Compute Y-axis upper bound across ALL shoulders in category (stable axis)
  let effectiveMaxShield = 0;
  if (isArmorMode) {
    for (const shoulder of shouldersData) {
      const stats = shoulder.levels[levelKey];
      if (stats) {
        const total = (stats.Armor ?? 0) + stats.ShieldAmount * ARMOR_SHIELD_MULT;
        if (total > effectiveMaxShield) effectiveMaxShield = total;
      }
    }
  } else {
    effectiveMaxShield = parseFloat(canvas.dataset.maxShield);
  }
  if (effectiveMaxShield <= 0) effectiveMaxShield = parseFloat(canvas.dataset.maxShield);

  // Build visible lines (skip disabled shoulders)
  const lines = [];
  for (const shoulder of shouldersData) {
    if (disabled.has(shoulder.id)) continue;
    const stats = shoulder.levels[levelKey];
    if (stats) {
      lines.push({
        color: shoulder.color,
        armorBase: isArmorMode ? (stats.Armor ?? 0) : 0,
        shieldAmount: stats.ShieldAmount * ARMOR_SHIELD_MULT,
        rechargeDelay: stats.RechargeDelay,
        // Regen/s doubles → fill time halves for the original capacity,
        // but capacity also doubles, so net fill time stays the same.
        rechargeTime: stats.RechargeTime,
      });
    }
  }

  /** @type {ShieldChartData} */
  const chartData = {
    lines,
    maxTime,
    maxShield: effectiveMaxShield,
    yLabel: isArmorMode ? 'Armor+2xShields' : 'Shields',
  };

  drawShieldChart(canvas, chartData);
}

/**
 * Render all chart canvases for the given 0-based level index.
 *
 * @param {number} levelIndex
 */
function renderAllCharts(levelIndex) {
  document.querySelectorAll('.shield-chart-canvas').forEach((canvas) => {
    renderChart(canvas, levelIndex);
  });
}

/**
 * Highlight table rows matching the given 1-based level number.
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

  const initialLevel = parseInt(levelSwitcher.value, 10);
  onLevelChange(initialLevel);

  levelSwitcher.addEventListener('change', (e) => {
    onLevelChange(parseInt(e.target.value, 10));
  });

  // ── Legend toggle ─────────────────────────────────────────────
  /**
   * Toggle a shoulder line on/off.
   * @param {HTMLElement} item
   */
  function toggleLegendItem(item) {
    const { shoulderId, graphId } = item.dataset;
    if (!shoulderId || !graphId) return;

    if (!disabledSets.has(graphId)) disabledSets.set(graphId, new Set());
    const disabled = disabledSets.get(graphId);

    if (disabled.has(shoulderId)) {
      disabled.delete(shoulderId);
      item.classList.remove('legend-item--disabled');
      item.setAttribute('aria-pressed', 'false');
    } else {
      disabled.add(shoulderId);
      item.classList.add('legend-item--disabled');
      item.setAttribute('aria-pressed', 'true');
    }

    const canvas = document.getElementById(graphId);
    if (canvas) renderChart(canvas, parseInt(levelSwitcher.value, 10));
  }

  document.querySelectorAll('.legend-item[data-shoulder-id]').forEach((item) => {
    item.addEventListener('click', () => toggleLegendItem(item));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleLegendItem(item);
      }
    });
  });

  // ── Armor mode toggle ──────────────────────────────────────────
  /**
   * Toggle armor mode for a specific chart.
   * @param {HTMLButtonElement} btn
   */
  function toggleArmorMode(btn) {
    const { graphId } = btn.dataset;
    if (!graphId) return;

    if (armorModeSet.has(graphId)) {
      armorModeSet.delete(graphId);
      btn.setAttribute('aria-pressed', 'false');
    } else {
      armorModeSet.add(graphId);
      btn.setAttribute('aria-pressed', 'true');
    }

    const canvas = document.getElementById(graphId);
    if (canvas) renderChart(canvas, parseInt(levelSwitcher.value, 10));
  }

  document.querySelectorAll('.armor-mode-toggle[data-graph-id]').forEach((btn) => {
    btn.addEventListener('click', () => toggleArmorMode(btn));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleArmorMode(btn);
      }
    });
  });

  // ── Window Resize (Redraw for fluid width) ───────────────────
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const currentLevel = parseInt(levelSwitcher.value, 10);
      renderAllCharts(currentLevel);
    }, 150); // debounce 150ms
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
