/**
 * Module Group Mapping Utility
 *
 * Why module groups instead of types/categories?
 * Module types (27 total) are too granular - users don't think in terms of
 * "TitanAlphaChassis" vs "TitanGrimChassis". Module categories (5 total)
 * are too broad - grouping Titan and non-Titan chassis together loses
 * important distinctions. Module groups combine both dimensions:
 * category (what slot) + type variant (Titan vs standard) into logical
 * user-facing groups like "Titan Chassis" vs "Chassis". This provides
 * ~11 intuitive groups that match how players actually browse modules.
 */

import type { Module, ModuleType, ModuleCategory } from '../types/module';
import { refToId } from './object_reference';

export interface EnrichedModule extends Module {
  module_group?: string;
}

// Module group definitions
export const MODULE_GROUPS = {
  'titan-torsos': {
    id: 'titan-torsos',
    sort_order: 1,
    name: {
      Key: 'GRP_TitanTorsos_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Titan Torsos'
    },
    description: {
      Key: 'GRP_TitanTorsos_Desc',
      TableNamespace: 'ModuleGroups',
      en: 'Torso modules for Titan mechs'
    }
  },
  'non-titan-torsos': {
    id: 'non-titan-torsos',
    sort_order: 2,
    name: {
      Key: 'GRP_Torsos_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Torsos'
    },
    description: {
      Key: 'GRP_Torsos_Desc',
      TableNamespace: 'ModuleGroups',
      en: 'Standard torso modules'
    }
  },
  'titan-chassis': {
    id: 'titan-chassis',
    sort_order: 3,
    name: {
      Key: 'GRP_TitanChassis_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Titan Chassis'
    },
    description: {
      Key: 'GRP_TitanChassis_Desc',
      TableNamespace: 'ModuleGroups',
      en: 'Chassis modules for Titan mechs'
    }
  },
  'non-titan-chassis': {
    id: 'non-titan-chassis',
    sort_order: 4,
    name: {
      Key: 'GRP_Chassis_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Chassis'
    },
    description: {
      Key: 'GRP_Chassis_Desc',
      TableNamespace: 'ModuleGroups',
      en: 'Standard chassis modules'
    }
  },
  'titan-shoulder': {
    id: 'titan-shoulder',
    sort_order: 5,
    name: {
      Key: 'GRP_TitanShoulders_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Titan Shoulders'
    },
    description: {
      Key: 'GRP_TitanShoulders_Desc',
      TableNamespace: 'ModuleGroups',
      en: 'Shoulder modules for Titan mechs'
    }
  },
  'non-titan-shoulder': {
    id: 'non-titan-shoulder',
    sort_order: 6,
    name: {
      Key: 'GRP_Shoulders_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Shoulders'
    },
    description: {
      Key: 'GRP_Shoulders_Desc',
      TableNamespace: 'ModuleGroups',
      en: 'Standard shoulder modules'
    }
  },
  'light-weapon': {
    id: 'light-weapon',
    sort_order: 7,
    name: {
      Key: 'GRP_LightWeapons_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Light Weapons'
    },
    description: {
      Key: 'GRP_LightWeapons_Desc',
      TableNamespace: 'ModuleGroups',
      en: 'Light weapon modules'
    }
  },
  'heavy-weapon': {
    id: 'heavy-weapon',
    sort_order: 8,
    name: {
      Key: 'GRP_HeavyWeapons_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Heavy Weapons'
    },
    description: {
      Key: 'GRP_HeavyWeapons_Desc',
      TableNamespace: 'ModuleGroups',
      en: 'Heavy weapon modules'
    }
  },
  'titan-weapon': {
    id: 'titan-weapon',
    sort_order: 9,
    name: {
      Key: 'GRP_TitanWeapons_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Titan Weapons'
    },
    description: {
      Key: 'GRP_TitanWeapons_Desc',
      TableNamespace: 'ModuleGroups',
      en: 'Weapon modules for Titan mechs'
    }
  },
  'supply-gear': {
    id: 'supply-gear',
    sort_order: 10,
    name: {
      Key: 'GRP_SupplyGear_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Supply Gear'
    },
    description: {
      Key: 'GRP_SupplyGear_Desc',
      TableNamespace: 'ModuleGroups',
      en: 'Supply gear modules'
    }
  },
  'cycle-gear': {
    id: 'cycle-gear',
    sort_order: 11,
    name: {
      Key: 'GRP_CycleGear_Name',
      TableNamespace: 'ModuleGroups',
      en: 'Cycle Gear'
    },
    description: {
      Key: 'GRP_CycleGear_Desc',
      TableNamespace: 'ModuleGroups',
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
