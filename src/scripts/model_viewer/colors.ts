/**
 * Per-module render colors.
 *
 * Every module in a build gets its own color, and its hitbox is drawn in the
 * same color. A full robot needs at most 9 (chassis, torso, two shoulders,
 * five weapons), which the fixed palette covers; anything beyond it (e.g. gear
 * from a deep link) gets generated hues that are still guaranteed unique.
 */
import type { ModuleKind, ResolvedBuild } from './build/types';

/** Tableau 10: distinct, reasonably color-blind-safe, readable on dark. */
export const MODULE_PALETTE: readonly number[] = [
  0x4e79a7, 0xf28e2b, 0xe15759, 0x76b7b2, 0x59a14f, 0xedc948, 0xb07aa1,
  0xff9da7, 0x9c755f, 0xbab0ac,
];

function hslToHex(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

/** `n` distinct colors: the palette, then golden-angle hues (skipping any
 * value already used). */
export function uniqueColors(n: number): number[] {
  const colors = MODULE_PALETTE.slice(0, n);
  const used = new Set(colors);
  for (let i = 0; colors.length < n; i++) {
    const hue = (i * 0.618033988749895 + 0.13) % 1;
    const color = hslToHex(hue, 0.55, i % 2 === 0 ? 0.6 : 0.45);
    if (used.has(color)) continue;
    used.add(color);
    colors.push(color);
  }
  return colors;
}

const KIND_ORDER: readonly ModuleKind[] = [
  'chassis',
  'torso',
  'shoulder',
  'weapon',
  'ability',
  'other',
];

/** Chassis health pools (armor zones) drawn in a color of their own. The
 * chassis splits into pelvis + left leg + right leg; the pelvis keeps the
 * chassis slot's color. */
export const LEG_ZONES: readonly string[] = [
  'DA_ArmorZone_LeftLeg.0',
  'DA_ArmorZone_RightLeg.0',
];

/**
 * Color per slot key, plus `<chassisKey>#<zone>` for each leg zone.
 *
 * Colors are handed out per slot (empty slots included), structural parts
 * first, so the chassis (and its legs) / torso / shoulders keep their colors
 * while weapons are swapped, and a weapon keeps its color when another slot
 * is emptied.
 */
function slotColors(build: ResolvedBuild): Map<string, number> {
  const ranked = [...build.slots].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
  );
  const keys = ranked.flatMap((slot) =>
    slot.kind === 'chassis'
      ? [slot.key, ...LEG_ZONES.map((zone) => `${slot.key}#${zone}`)]
      : [slot.key]
  );
  const palette = uniqueColors(keys.length);
  return new Map(keys.map((key, i) => [key, palette[i]]));
}

/** Colors for the modules a build renders, in `toPresetModules(build)` order. */
export function buildModuleColors(build: ResolvedBuild): number[] {
  const colorOf = slotColors(build);
  return build.slots
    .filter((slot) => slot.moduleId)
    .map((slot) => colorOf.get(slot.key)!);
}

/** Colors of the chassis's leg health pools, keyed by armor zone id. Parts
 * in any other zone use their module's color. */
export function buildZoneColors(build: ResolvedBuild): Record<string, number> {
  const colorOf = slotColors(build);
  const chassis = build.slots.find((slot) => slot.kind === 'chassis');
  if (!chassis) return {};
  return Object.fromEntries(
    LEG_ZONES.map((zone) => [zone, colorOf.get(`${chassis.key}#${zone}`)!])
  );
}

/** Build comparison colors (A = the live build, B = the compared one): a
 * fixed, colorblind-safe set used instead of per-module colors, so any number
 * of swapped parts reads the same. Grey is area both builds cover; orange is
 * area only A has (lost by switching); blue is area only B has (gained). */
export const DIFF_COLORS = {
  shared: 0x8a9099,
  aOnly: 0xf28e2b,
  bOnly: 0x4e79a7,
} as const;

/** `0xrrggbb` -> `#rrggbb`. */
export function cssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
