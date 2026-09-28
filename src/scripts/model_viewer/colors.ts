/**
 * Render colors: one per module of a build (its hitboxes share it), and a
 * fixed set for comparing two builds.
 *
 * These are data colors drawn in the 3D scene (and repeated in the panels'
 * swatches), not page chrome, so they are raw values rather than design
 * tokens.
 */
import {
  ARMOR_ZONE_LEFT_LEG,
  ARMOR_ZONE_RIGHT_LEG,
} from '../../utils/constants';
import type { ModuleKind, ResolvedBuild } from '../robot/build/types';
import type { ArmorZoneId } from '../../types/model';

/** Tableau 10: distinct, reasonably color-blind-safe, readable on dark. A
 * full robot needs at most 11 (chassis + 2 legs, torso, two shoulders, five
 * weapons); beyond that (e.g. gear from a deep link) hues are generated. */
const MODULE_PALETTE: readonly number[] = [
  0x4e79a7, 0xf28e2b, 0xe15759, 0x76b7b2, 0x59a14f, 0xedc948, 0xb07aa1,
  0xff9da7, 0x9c755f, 0xbab0ac,
];

/** Color for anything the palette did not cover. */
export const FALLBACK_COLOR = 0x9aa0a6;

/** Build comparison colors (A = the live build, B = the compared one): a
 * fixed, colorblind-safe set used instead of per-module colors, so any number
 * of swapped parts reads the same. Grey is area both builds cover; orange is
 * area only A has (lost by switching); blue is area only B has (gained). */
export const DIFF_COLORS = {
  shared: 0x8a9099,
  aOnly: 0xf28e2b,
  bOnly: 0x4e79a7,
} as const;

export type DiffColorKey = keyof typeof DIFF_COLORS;

export function isDiffColorKey(value: unknown): value is DiffColorKey {
  return value === 'shared' || value === 'aOnly' || value === 'bOnly';
}

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

/** Chassis health pools (armor zones) drawn in a color of their own; the
 * pelvis keeps the chassis slot's color. */
const LEG_ZONES: readonly ArmorZoneId[] = [
  ARMOR_ZONE_LEFT_LEG,
  ARMOR_ZONE_RIGHT_LEG,
];

/** A build's colors. */
export interface BuildColors {
  /** Per module-list entry, in `toPresetModules(build)` order. */
  modules: readonly number[];
  /** Armor zones with a color of their own (the chassis legs), overriding
   * their module's. */
  zones: ReadonlyMap<ArmorZoneId, number>;
}

/**
 * Colors are handed out per slot (empty slots included), structural parts
 * first, so the chassis (and its legs) / torso / shoulders keep their colors
 * while weapons are swapped, and a weapon keeps its color when another slot is
 * emptied.
 */
export function buildColors(build: ResolvedBuild): BuildColors {
  const ranked = [...build.slots].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
  );
  const chassisKey = build.slots.find((slot) => slot.kind === 'chassis')?.key;
  const zoneKey = (zone: ArmorZoneId): string => `${chassisKey}#${zone}`;
  const keys = ranked.flatMap((slot) =>
    slot.key === chassisKey ? [slot.key, ...LEG_ZONES.map(zoneKey)] : [slot.key]
  );
  const palette = uniqueColors(keys.length);
  const colorOf = (key: string): number =>
    palette[keys.indexOf(key)] ?? FALLBACK_COLOR;
  return {
    modules: build.slots
      .filter((slot) => slot.moduleId)
      .map((slot) => colorOf(slot.key)),
    zones: new Map(
      chassisKey === undefined
        ? []
        : LEG_ZONES.map((zone) => [zone, colorOf(zoneKey(zone))])
    ),
  };
}

/** The color of a module's part in armor zone `zone` (null: none). */
export function partColor(
  colors: BuildColors,
  moduleIndex: number,
  zone: ArmorZoneId | null
): number {
  return (
    (zone !== null ? colors.zones.get(zone) : undefined) ??
    colors.modules[moduleIndex] ??
    FALLBACK_COLOR
  );
}

/** `0xrrggbb` -> `#rrggbb`. */
export function cssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
