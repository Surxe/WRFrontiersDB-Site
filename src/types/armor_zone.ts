import type { ParseObject } from './parse_object';

/**
 * A robot health pool (backs `Objects/ArmorZone.json`). Module meshes link one by
 * id (`CharacterModule.meshes[].armor_zone`); meshes linking the same zone share
 * its armor (a spider chassis's two left legs).
 */
export interface ArmorZone extends ParseObject {
  parseObjectClass: 'ArmorZone';
  id: string;
  /** The game's slot for the zone: Torso, LeftShoulder, Pelvis, LeftLeg, ... */
  role?: string;
  /** The linking module's scalar (module_scalars levels) holding the zone's armor. */
  stat_key?: string;
  /** That stat's ModuleStat (name, units). */
  module_stat_ref?: string;
}
