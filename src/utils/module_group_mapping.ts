import type { Module, ModuleType, ModuleCategory } from '../types/module';
import { refToId } from './object_reference';

export interface EnrichedModule extends Module {
  module_group?: string;
}

// Module group definitions
export const MODULE_GROUPS = {
  'titan-torsos': {
    id: 'titan-torsos',
    name: {
      en: 'Titan Torsos'
    },
    description: {
      en: 'Torso modules for Titan mechs'
    }
  },
  'non-titan-torsos': {
    id: 'non-titan-torsos',
    name: {
      en: 'Torsos'
    },
    description: {
      en: 'Standard torso modules'
    }
  },
  'titan-chassis': {
    id: 'titan-chassis',
    name: {
      en: 'Titan Chassis'
    },
    description: {
      en: 'Chassis modules for Titan mechs'
    }
  },
  'non-titan-chassis': {
    id: 'non-titan-chassis',
    name: {
      en: 'Chassis'
    },
    description: {
      en: 'Standard chassis modules'
    }
  },
  'titan-shoulder': {
    id: 'titan-shoulder',
    name: {
      en: 'Titan Shoulders'
    },
    description: {
      en: 'Shoulder modules for Titan mechs'
    }
  },
  'non-titan-shoulder': {
    id: 'non-titan-shoulder',
    name: {
      en: 'Shoulders'
    },
    description: {
      en: 'Standard shoulder modules'
    }
  },
  'light-weapon': {
    id: 'light-weapon',
    name: {
      en: 'Light Weapons'
    },
    description: {
      en: 'Light weapon modules'
    }
  },
  'heavy-weapon': {
    id: 'heavy-weapon',
    name: {
      en: 'Heavy Weapons'
    },
    description: {
      en: 'Heavy weapon modules'
    }
  },
  'titan-weapon': {
    id: 'titan-weapon',
    name: {
      en: 'Titan Weapons'
    },
    description: {
      en: 'Weapon modules for Titan mechs'
    }
  },
  'supply-gear': {
    id: 'supply-gear',
    name: {
      en: 'Supply Gear'
    },
    description: {
      en: 'Supply gear modules'
    }
  },
  'cycle-gear': {
    id: 'cycle-gear',
    name: {
      en: 'Cycle Gear'
    },
    description: {
      en: 'Cycle gear modules'
    }
  }
} as const;

export type ModuleGroupId = keyof typeof MODULE_GROUPS;

// Mapping from module type reference to module group
const MODULE_TYPE_TO_GROUP: Record<string, ModuleGroupId> = {
  // Titan torsos
  'DA_ModuleType_TitanAlphaTorso.0': 'titan-torsos',
  'DA_ModuleType_TitanGrimTorso.0': 'titan-torsos',
  'DA_ModuleType_TitanMatriarchTorso.0': 'titan-torsos',
  'DA_ModuleType_TitanNornaTorso.0': 'titan-torsos',
  'DA_ModuleType_TitanSpireTorso.0': 'titan-torsos',

  // Non-titan torsos
  'DA_ModuleType_Torso.0': 'non-titan-torsos',

  // Titan chassis
  'DA_ModuleType_TitanAlphaChassis.0': 'titan-chassis',
  'DA_ModuleType_TitanGrimChassis.0': 'titan-chassis',
  'DA_ModuleType_TitanMatriarchChassis.0': 'titan-chassis',
  'DA_ModuleType_TitanNornaChassis.0': 'titan-chassis',
  'DA_ModuleType_TitanSpireChassis.0': 'titan-chassis',

  // Non-titan chassis
  'DA_ModuleType_Chassis.0': 'non-titan-chassis',

  // Titan shoulders
  'DA_ModuleType_TitanAlphaShoulderL.0': 'titan-shoulder',
  'DA_ModuleType_TitanAlphaShoulderR.0': 'titan-shoulder',
  'DA_ModuleType_TitanGrimShoulderL.0': 'titan-shoulder',
  'DA_ModuleType_TitanGrimShoulderR.0': 'titan-shoulder',
  'DA_ModuleType_TitanMatriarchShoulderL.0': 'titan-shoulder',
  'DA_ModuleType_TitanMatriarchShoulderR.0': 'titan-shoulder',
  'DA_ModuleType_TitanNornaShoulderL.0': 'titan-shoulder',
  'DA_ModuleType_TitanNornaShoulderR.0': 'titan-shoulder',
  'DA_ModuleType_TitanSpireShoulderL.0': 'titan-shoulder',
  'DA_ModuleType_TitanSpireShoulderR.0': 'titan-shoulder',

  // Non-titan shoulders
  'DA_ModuleType_Shoulder.0': 'non-titan-shoulder',

  // Light weapons
  'DA_ModuleType_Weapon.0': 'light-weapon',

  // Heavy weapons
  'DA_ModuleType_WeaponHeavy.0': 'heavy-weapon',

  // Titan weapons
  'DA_ModuleType_TitanWeapon.0': 'titan-weapon',
  'DA_ModuleType_TitanWeaponAssault.0': 'titan-weapon',
  'DA_ModuleType_TitanWeaponFlanker.0': 'titan-weapon',
  'DA_ModuleType_TitanWeaponNorna.0': 'titan-weapon',
  'DA_ModuleType_TitanWeaponTactician.0': 'titan-weapon',
  'DA_ModuleType_TitanWeaponTank.0': 'titan-weapon',

  // Supply gear
  'DA_ModuleType_Ability2.0': 'supply-gear',
  'DA_ModuleType_Ability3.0': 'supply-gear',

  // Cycle gear
  'DA_ModuleType_Ability4.0': 'cycle-gear'
};

/**
 * Get the module group ID for a given module type reference
 * @param moduleTypeRef - The module type reference (e.g., "OBJID_ModuleType::DA_ModuleType_Chassis.0")
 * @returns The module group ID or undefined if not found
 */
export function getModuleGroupId(moduleTypeRef: string): ModuleGroupId | undefined {
  const typeId = refToId(moduleTypeRef);
  return MODULE_TYPE_TO_GROUP[typeId];
}

/**
 * Get the module group name for display
 * @param groupId - The module group ID
 * @returns The localized name or the ID if not found
 */
export function getModuleGroupName(groupId: string): string {
  const group = MODULE_GROUPS[groupId as ModuleGroupId];
  return group?.name?.en || groupId;
}

/**
 * Get the module group description
 * @param groupId - The module group ID
 * @returns The localized description or empty string if not found
 */
export function getModuleGroupDescription(groupId: string): string {
  const group = MODULE_GROUPS[groupId as ModuleGroupId];
  return group?.description?.en || '';
}

/**
 * Enrich modules with their module group assignments
 * Follows the pattern of enrichPilotTalents in src/utils/pilot.ts
 * @param modules - Record of all modules
 * @param moduleTypes - Record of all module types
 * @param moduleCategories - Record of all module categories (kept for consistency, not used)
 * @returns Record of enriched modules with module_group attribute
 */
export function enrichModulesWithGroups(
  modules: Record<string, Module>,
  moduleTypes: Record<string, ModuleType>,
  _moduleCategories: Record<string, ModuleCategory>
): Record<string, EnrichedModule> {
  const enriched: Record<string, EnrichedModule> = {};

  for (const [moduleId, module] of Object.entries(modules)) {
    const moduleTypeRef = module.module_type_ref;
    const moduleGroup = getModuleGroupId(moduleTypeRef);

    enriched[moduleId] = {
      ...module,
      module_group: moduleGroup
    };
  }

  return enriched;
}

/**
 * Get all module group IDs
 * @returns Array of all module group IDs
 */
export function getAllModuleGroupIds(): ModuleGroupId[] {
  return Object.keys(MODULE_GROUPS) as ModuleGroupId[];
}
