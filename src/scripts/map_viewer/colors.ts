/**
 * Pin colors: data colors drawn in the scene and repeated in the legend
 * (raw values, not design tokens, as the model viewer's colors.ts).
 */
import type { PinType } from '../../types/map';

/** Team colors (Tableau 10, as the model viewer's palette). */
export const TEAM_COLORS: readonly number[] = [0x4e79a7, 0xe15759];
export const NO_TEAM_COLOR = 0x9aa0a6;

/** Per pin type; null: by team. A power-up spawner takes its power-up's
 * minimap color when the data has one. */
export const PIN_COLORS: Readonly<Record<PinType, number | null>> = {
  spawn: null,
  warp_probe: 0xedc948,
  beacon: 0x59a14f,
  powerup_spawner: 0xb07aa1,
  ctf_core: null,
  ctf_upload_zone: null,
  drill: 0x9c755f,
};

export function teamColor(team: number | undefined): number {
  return team === undefined
    ? NO_TEAM_COLOR
    : (TEAM_COLORS[team] ?? NO_TEAM_COLOR);
}
