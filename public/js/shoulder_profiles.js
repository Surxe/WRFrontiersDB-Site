/**
 * shoulder_profiles.js
 * Client-side logic for the Unified Shoulder Profiles view.
 * Profile selection is driven by clicking profile group headers in the legend,
 * not a dropdown. Individual items can still be toggled independently.
 */

// ============================================================
// STATE
// ============================================================

/** Per-canvas set of disabled shoulder IDs */
const disabledSets = new Map();
const armorModeSet = new Set();
let currentProfileId = null;
let currentLevelIndex = 12;

// ============================================================
// RENDERING BACKEND
// ============================================================

function drawShieldChart(canvas, data) {
  const { lines, maxTime, maxShield, yLabel = 'Shields' } = data;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(rect.width, 100);
  const H = 300;

  canvas.width = W * dpr;
  canvas.height = H * dpr;

  ctx.save();
  ctx.scale(dpr, dpr);

  const PAD = { top: 24, right: 20, bottom: 44, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const safeMaxTime = maxTime > 0 ? maxTime : 1;
  const safeMaxShield = maxShield > 0 ? maxShield : 1;

  const toX = (t) => PAD.left + (t / safeMaxTime) * plotW;
  const toY = (s) => PAD.top + plotH - (s / safeMaxShield) * plotH;

  // Clear & background
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, W, H);

  // Axis lines
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.stroke();

  // Grid lines
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

  // Fills
  for (const line of lines) {
    const { shieldAmount, rechargeDelay, rechargeTime, color, armorBase = 0 } = line;
    const rechargeEnd = rechargeDelay + rechargeTime;
    const topY = armorBase + shieldAmount;

    if (armorBase > 0) {
      ctx.fillStyle = hexToRgba(color, 0.05);
      ctx.fillRect(toX(0), toY(armorBase), plotW, toY(0) - toY(armorBase));
    }

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(armorBase));
    ctx.lineTo(toX(rechargeDelay), toY(armorBase));
    ctx.lineTo(toX(rechargeEnd), toY(topY));
    ctx.lineTo(toX(safeMaxTime), toY(topY));
    ctx.lineTo(toX(safeMaxTime), toY(armorBase));
    ctx.lineTo(toX(0), toY(armorBase));
    ctx.closePath();
    ctx.fillStyle = hexToRgba(color, 0.08);
    ctx.fill();
  }

  // Curves & armor floor markers
  for (const line of lines) {
    const { shieldAmount, rechargeDelay, rechargeTime, color, armorBase = 0 } = line;
    const rechargeEnd = rechargeDelay + rechargeTime;
    const topY = armorBase + shieldAmount;

    if (armorBase > 0) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = hexToRgba(color, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(armorBase));
      ctx.lineTo(toX(safeMaxTime), toY(armorBase));
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(armorBase));
    ctx.lineTo(toX(rechargeDelay), toY(armorBase));
    ctx.lineTo(toX(rechargeEnd), toY(topY));
    ctx.lineTo(toX(safeMaxTime), toY(topY));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(toX(rechargeEnd), toY(topY), 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Y-axis labels
  ctx.fillStyle = '#bbb';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= gridCount; i++) {
    const val = (safeMaxShield / gridCount) * i;
    const y = toY(val);
    ctx.fillText(formatShieldLabel(val), PAD.left - 6, y);
  }

  // X-axis labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const xTickCount = 5;
  for (let i = 0; i <= xTickCount; i++) {
    const t = (safeMaxTime / xTickCount) * i;
    const x = toX(t);
    ctx.fillText(t.toFixed(1) + 's', x, PAD.top + plotH + 6);
  }

  // Axis titles
  ctx.fillStyle = '#ddd';
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
  ctx.restore();
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatShieldLabel(value) {
  if (value >= 1000) {
    return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return Math.round(value).toString();
}

// ============================================================
// DYNAMIC CALCULATION
// ============================================================

/**
 * Calculates maxTime and maxShield based on the shoulders that are
 * currently ENABLED (not in disabledSets) across ALL levels.
 */
function calculateBounds(shouldersData, disabled, isArmorMode) {
  let maxTime = 0;
  let maxShield = 0;
  const ARMOR_SHIELD_MULT = isArmorMode ? 2 : 1;

  for (const shoulder of shouldersData) {
    if (disabled.has(shoulder.id)) continue;

    for (const levelKey in shoulder.levels) {
      const stats = shoulder.levels[levelKey];
      if (stats.DelayAndRechargeTotal > maxTime) {
        maxTime = stats.DelayAndRechargeTotal;
      }

      const totalShield = isArmorMode
        ? (stats.Armor ?? 0) + stats.ShieldAmount * ARMOR_SHIELD_MULT
        : stats.ShieldAmount;

      if (totalShield > maxShield) {
        maxShield = totalShield;
      }
    }
  }

  return { maxTime, maxShield };
}

// ============================================================
// PAGE ORCHESTRATION
// ============================================================

function renderChart(canvas) {
  let shouldersData;
  try {
    shouldersData = JSON.parse(canvas.dataset.shoulders);
  } catch {
    return;
  }

  const levelKey = String(currentLevelIndex + 1);
  const disabled = disabledSets.get(canvas.id) ?? new Set();
  const isArmorMode = armorModeSet.has(canvas.id);
  const ARMOR_SHIELD_MULT = isArmorMode ? 2 : 1;

  const { maxTime, maxShield } = calculateBounds(shouldersData, disabled, isArmorMode);

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
        rechargeTime: stats.RechargeTime,
      });
    }
  }

  drawShieldChart(canvas, { lines, maxTime, maxShield, yLabel: isArmorMode ? 'Armor+2xShields' : 'Shields' });
}

function updateLegendVisuals() {
  // Update group header active state
  document.querySelectorAll('.legend-group-header').forEach((btn) => {
    const isActive = btn.dataset.profileId === currentProfileId;
    btn.classList.toggle('is-active-profile', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  // Update individual item disabled state based on disabledSets
  document.querySelectorAll('.legend-item').forEach((item) => {
    const { shoulderId, graphId } = item.dataset;
    const disabled = disabledSets.get(graphId) ?? new Set();
    const isDisabled = disabled.has(shoulderId);
    item.classList.toggle('legend-item--disabled', isDisabled);
    item.setAttribute('aria-pressed', isDisabled ? 'true' : 'false');
  });
}

function updateTable() {
  const levelNum = String(currentLevelIndex + 1);
  document.querySelectorAll('.shoulder-stats-table tr[data-level]').forEach((row) => {
    row.classList.toggle('is-active-level', row.dataset.level === levelNum);
    row.classList.toggle('is-active-profile', row.dataset.profileId === currentProfileId);
  });
}

function updateAll() {
  updateLegendVisuals();
  updateTable();
  document.querySelectorAll('.shield-chart-canvas').forEach((canvas) => {
    renderChart(canvas);
  });
}

/**
 * Apply a profile selection: disable all shoulders NOT in the given profile,
 * re-enable all shoulders IN the profile.
 */
function selectProfile(newProfileId) {
  currentProfileId = newProfileId;

  document.querySelectorAll('.shield-chart-canvas').forEach((canvas) => {
    let shouldersData = [];
    try {
      shouldersData = JSON.parse(canvas.dataset.shoulders);
    } catch {}

    const disabled = new Set();
    for (const shoulder of shouldersData) {
      if (shoulder.profileId !== currentProfileId) {
        disabled.add(shoulder.id);
      }
    }
    disabledSets.set(canvas.id, disabled);
  });

  updateAll();
}

// ============================================================
// INITIALISATION
// ============================================================

function init() {
  const levelSwitcher = document.getElementById('level-switcher');
  const canvas = document.querySelector('.shield-chart-canvas');

  if (!levelSwitcher || !canvas) return;

  // Read default profile from canvas data attribute (set by Astro at build time)
  currentProfileId = canvas.dataset.defaultProfile || null;
  currentLevelIndex = parseInt(levelSwitcher.value, 10);

  // Apply initial profile selection
  selectProfile(currentProfileId);

  // Level switcher
  levelSwitcher.addEventListener('change', (e) => {
    currentLevelIndex = parseInt(e.target.value, 10);
    updateAll();
  });

  // Profile group header clicks
  document.querySelectorAll('.legend-group-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectProfile(btn.dataset.profileId);
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectProfile(btn.dataset.profileId);
      }
    });
  });

  // Individual legend item toggle
  function toggleLegendItem(item) {
    const { shoulderId, graphId } = item.dataset;
    if (!shoulderId || !graphId) return;

    if (!disabledSets.has(graphId)) disabledSets.set(graphId, new Set());
    const disabled = disabledSets.get(graphId);

    if (disabled.has(shoulderId)) {
      disabled.delete(shoulderId);
    } else {
      disabled.add(shoulderId);
    }

    updateLegendVisuals();
    const targetCanvas = document.getElementById(graphId);
    if (targetCanvas) renderChart(targetCanvas);
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

  // Armor mode toggle
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

    const targetCanvas = document.getElementById(graphId);
    if (targetCanvas) renderChart(targetCanvas);
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

  // Window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll('.shield-chart-canvas').forEach(renderChart);
    }, 150);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
