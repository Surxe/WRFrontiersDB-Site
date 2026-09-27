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

/**
 * Colors for the modules a build renders, in `toPresetModules(build)` order.
 *
 * Colors are handed out per slot (empty slots included), structural parts
 * first, so the chassis / torso / shoulders keep their colors while weapons
 * are swapped, and a weapon keeps its color when another slot is emptied.
 */
export function buildModuleColors(build: ResolvedBuild): number[] {
  const ranked = [...build.slots].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
  );
  const palette = uniqueColors(ranked.length);
  const colorOf = new Map(ranked.map((slot, i) => [slot.key, palette[i]]));
  return build.slots
    .filter((slot) => slot.moduleId)
    .map((slot) => colorOf.get(slot.key)!);
}
