import type { ArmorZone } from '../types/armor_zone';
import type { CharacterModule } from '../types/character_module';
import type { LocalizationKey } from '../types/localization';
import type { Module, ModuleStat, ModuleType } from '../types/module';
import type { ModuleSocketType } from '../types/module_socket_type';
import { MODULE_CATEGORY_IDS } from './constants';
import { refToId } from './object_reference';
import { resolveObjectRef } from './object_resolver';
import { type ObjectLoader, loadFreshObjects } from './parse_object';
import type { RawStat } from './stat_name_localization';
import {
  SHIELD_STAT_KEYS,
  type StatDisplay,
  resolveStatDisplay,
} from './stat_display';

/** One line of a module's stat summary, not yet localized. */
export type ModuleStatLine =
  /** A stat value, e.g. `Max Speed: 109km/h`. */
  | { kind: 'stat'; display: StatDisplay; value: number }
  /** A count of one weapon socket type, e.g. `Light Weapon ×2`. */
  | { kind: 'slots'; label?: LocalizationKey; count: number };

/** A summary field: a Stat.json key, the module's armor per zone, or its weapon slots. */
type StatField = string | typeof ARMOR | typeof WEAPON_SLOTS;
const ARMOR = Symbol('armor');
const WEAPON_SLOTS = Symbol('weapon slots');

/**
 * The stat summary of each armor module category, for standard and titan modules.
 * Stats that are missing or 0 are left out, so e.g. titan chassis (no weight or
 * energy capacity) and titan parts (no weight used) need no list of their own.
 */
const STAT_FIELDS: Record<
  string,
  { standard: StatField[]; titan: StatField[] }
> = {
  [MODULE_CATEGORY_IDS.chassis]: {
    standard: [
      'MaxSpeed',
      'Mobility',
      ARMOR,
      'FuelCapacity',
      'LoadCapacity',
      'EnergyCapacity',
    ],
    titan: [
      'MaxSpeed',
      'Mobility',
      ARMOR,
      'FuelCapacity',
      'LoadCapacity',
      'EnergyCapacity',
    ],
  },
  [MODULE_CATEGORY_IDS.torso]: {
    standard: [ARMOR, WEAPON_SLOTS, 'WeightDrain'],
    titan: [ARMOR, WEAPON_SLOTS, 'WeightDrain'],
  },
  [MODULE_CATEGORY_IDS.shoulder]: {
    standard: [WEAPON_SLOTS, ARMOR, ...SHIELD_STAT_KEYS, 'WeightDrain'],
    titan: [ARMOR, ...SHIELD_STAT_KEYS],
  },
};

/** A module's scalars at `level` (0-based): its constants overlaid with that level. */
export function moduleLevelStats(
  module: Module,
  level: number
): Record<string, unknown> {
  const levels = module.module_scalars?.levels;
  return {
    ...(levels?.constants ?? {}),
    ...(levels?.variables?.[level] ?? {}),
  };
}

const warnedZones = new Set<string>();

/**
 * The stat keys holding a module's armor, one per distinct armor zone its meshes
 * link (both leg zones share `LegsArmor`; a shoulder's left and right mounts share
 * `Armor`), in mesh order.
 */
export function moduleArmorStatKeys(
  module: Module,
  characterModules: Record<string, CharacterModule>,
  armorZones: Record<string, ArmorZone>
): string[] {
  const keys: string[] = [];
  for (const mount of module.character_module_mounts ?? []) {
    const characterModule = resolveObjectRef(
      mount.character_module_ref,
      characterModules
    );
    for (const mesh of characterModule?.meshes ?? []) {
      if (!mesh.armor_zone) continue;
      const statKey = armorZones[mesh.armor_zone]?.stat_key;
      if (!statKey) {
        if (!warnedZones.has(mesh.armor_zone)) {
          warnedZones.add(mesh.armor_zone);
          console.warn(
            `Armor zone ${mesh.armor_zone} has no stat in Objects/ArmorZone.json; its armor is not shown`
          );
        }
        continue;
      }
      if (!keys.includes(statKey)) keys.push(statKey);
    }
  }
  return keys;
}

/**
 * A module's weapon sockets, counted per socket type, in socket order. A socket is
 * a weapon socket when a weapon module type fits it.
 */
export function moduleWeaponSlots(
  module: Module,
  socketTypes: Record<string, ModuleSocketType>,
  moduleTypes: Record<string, ModuleType>
): Array<{ socketType: ModuleSocketType; count: number }> {
  const slots: Array<{ socketType: ModuleSocketType; count: number }> = [];
  for (const socket of module.sockets ?? []) {
    const socketType = resolveObjectRef(socket.socket_type_ref, socketTypes);
    if (!socketType || !isWeaponSocketType(socketType, moduleTypes)) continue;
    const slot = slots.find((s) => s.socketType.id === socketType.id);
    if (slot) slot.count += 1;
    else slots.push({ socketType, count: 1 });
  }
  return slots;
}

function isWeaponSocketType(
  socketType: ModuleSocketType,
  moduleTypes: Record<string, ModuleType>
): boolean {
  return (socketType.compatible_module_types_refs ?? []).some((ref) => {
    const moduleType = resolveObjectRef(ref, moduleTypes);
    return (
      !!moduleType?.module_category_ref &&
      refToId(moduleType.module_category_ref) === MODULE_CATEGORY_IDS.weapon
    );
  });
}

/**
 * The stat summary of an armor module (chassis, torso, shoulder) at `level`
 * (0-based); [] for other modules.
 */
export function getModuleStatLines(
  module: Module,
  level: number,
  load: ObjectLoader = loadFreshObjects
): ModuleStatLine[] {
  const moduleType = resolveObjectRef(
    module.module_type_ref,
    load<ModuleType>('Objects/ModuleType.json')
  );
  const categoryId = moduleType?.module_category_ref
    ? refToId(moduleType.module_category_ref)
    : undefined;
  const fieldSet = categoryId ? STAT_FIELDS[categoryId] : undefined;
  if (!fieldSet) return [];
  const fields =
    moduleType?.character_type === 'Titan' ? fieldSet.titan : fieldSet.standard;

  const values = moduleLevelStats(module, level);
  const stats = load<RawStat>('Objects/Stat.json');
  const moduleStats = load<ModuleStat>('Objects/ModuleStat.json');
  const statLine = (statKey: string): ModuleStatLine[] => {
    const value = values[statKey];
    if (typeof value !== 'number' || value === 0) return [];
    return [
      {
        kind: 'stat',
        display: resolveStatDisplay(statKey, stats, moduleStats),
        value,
      },
    ];
  };

  return fields.flatMap((field): ModuleStatLine[] => {
    if (field === ARMOR) {
      return moduleArmorStatKeys(
        module,
        load<CharacterModule>('Objects/CharacterModule.json'),
        load<ArmorZone>('Objects/ArmorZone.json')
      ).flatMap(statLine);
    }
    if (field === WEAPON_SLOTS) {
      return moduleWeaponSlots(
        module,
        load<ModuleSocketType>('Objects/ModuleSocketType.json'),
        load<ModuleType>('Objects/ModuleType.json')
      ).map(({ socketType, count }) => ({
        kind: 'slots',
        label: socketType.name,
        count,
      }));
    }
    return statLine(field);
  });
}
