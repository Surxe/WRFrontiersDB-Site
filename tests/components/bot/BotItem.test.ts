import { describe, it, expect } from 'vitest';

interface ModuleInfo {
  module_ref: string;
  parent_socket_name: string | null;
  level: number;
}

interface Preset {
  character_type: string;
  modules: Record<string, ModuleInfo>;
}

describe('BotItem weapon count and side logic', () => {
  it('should display x2 for Titan shoulder weapons with single weapon', () => {
    function isWeaponSocket(socketName: string): boolean {
      return (
        socketName.startsWith('Shoulder_Weapon') ||
        socketName.startsWith('Torso_Weapon')
      );
    }

    function simulateGroupedModules(preset: Preset) {
      const moduleGroups = new Map();

      Object.entries(preset.modules).forEach(
        ([socketName, moduleInfo]: [string, ModuleInfo]) => {
          const isWeapon = isWeaponSocket(socketName);
          const key = isWeapon
            ? moduleInfo.module_ref
            : `${moduleInfo.module_ref}|${moduleInfo.parent_socket_name || 'none'}`;

          const isShoulderWeapon =
            isWeapon &&
            (moduleInfo.parent_socket_name === 'Shoulder_L' ||
              moduleInfo.parent_socket_name === 'Shoulder_R');

          if (moduleGroups.has(key)) {
            const existing = moduleGroups.get(key);
            existing.count += 1;
            if (isShoulderWeapon) {
              existing.shoulderCount += 1;
            }
          } else {
            const shoulderCount = isShoulderWeapon ? 1 : 0;
            moduleGroups.set(key, {
              socketName,
              moduleInfo,
              count: 1,
              shoulderCount,
            });
          }
        }
      );

      // Apply the fixed logic
      return Array.from(moduleGroups.values()).map((group) => {
        if (group.shoulderCount > 0) {
          const isTitan = preset.character_type === 'Titan';
          const isShoulderWeapon = isWeaponSocket(group.socketName);

          if (isTitan && isShoulderWeapon) {
            return { ...group, count: group.count * 2 };
          } else if (group.shoulderCount === 2) {
            return { ...group, count: group.count * 2 };
          }
        }
        return group;
      });
    }

    // Test case 1: Titan with single shoulder weapon (Matriarch case)
    const titanPreset = {
      character_type: 'Titan',
      modules: {
        Shoulder_Weapon_0: {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 10,
        },
      },
    };

    const titanResult = simulateGroupedModules(titanPreset);
    expect(titanResult[0].count).toBe(2); // Should be doubled for Titan

    // Test case 2: Non-Titan with single shoulder weapon (should not be doubled)
    const botPreset = {
      character_type: 'Bot',
      modules: {
        Shoulder_Weapon_0: {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 10,
        },
      },
    };

    const botResult = simulateGroupedModules(botPreset);
    expect(botResult[0].count).toBe(1); // Should not be doubled for non-Titan

    // Test case 3: Non-Titan with dual shoulder weapons (should be doubled)
    const botDualPreset = {
      character_type: 'Bot',
      modules: {
        Shoulder_Weapon_0: {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 10,
        },
        Shoulder_Weapon_1: {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_R',
          level: 10,
        },
      },
    };

    const botDualResult = simulateGroupedModules(botDualPreset);
    expect(botDualResult[0].count).toBe(4); // Should be doubled for dual shoulders (2 weapons x 2 shoulders)
  });

  it('should detect different weapon IDs for Titan weapons', () => {
    function isWeaponSocket(socketName: string): boolean {
      return (
        socketName.startsWith('Shoulder_Weapon') ||
        socketName.startsWith('Torso_Weapon')
      );
    }

    function hasDifferentWeaponIds(preset: Preset): boolean {
      const weaponIds = new Set<string>();
      Object.entries(preset.modules).forEach(
        ([socketName, moduleInfo]: [string, ModuleInfo]) => {
          if (isWeaponSocket(socketName)) {
            const moduleId = moduleInfo.module_ref.split('::')[1];
            weaponIds.add(moduleId);
          }
        }
      );
      return weaponIds.size > 1;
    }

    // Test case: Titan with different weapons
    const titanDifferentWeapons = {
      character_type: 'Titan',
      modules: {
        Shoulder_Weapon_0: {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 10,
        },
        Shoulder_Weapon_1: {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Scrubber.0',
          parent_socket_name: 'Shoulder_R',
          level: 10,
        },
      },
    };

    // Test case: Titan with same weapon
    const titanSameWeapon = {
      character_type: 'Titan',
      modules: {
        Shoulder_Weapon_0: {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 10,
        },
      },
    };

    expect(hasDifferentWeaponIds(titanDifferentWeapons)).toBe(true);
    expect(hasDifferentWeaponIds(titanSameWeapon)).toBe(false);
  });

  it('should map socket names to side locale keys', () => {
    function getSocketSideLocaleKey(
      parentSocketName: string
    ): string | undefined {
      const mapping: Record<string, string> = {
        Shoulder_L: 'Web_UI.Socket_Left',
        Shoulder_R: 'Web_UI.Socket_Right',
      };
      return mapping[parentSocketName];
    }

    expect(getSocketSideLocaleKey('Shoulder_L')).toBe('Web_UI.Socket_Left');
    expect(getSocketSideLocaleKey('Shoulder_R')).toBe('Web_UI.Socket_Right');
    expect(getSocketSideLocaleKey('Root')).toBeUndefined();
  });

  it('should detect different shoulder module IDs for Titans', () => {
    function isWeaponSocket(socketName: string): boolean {
      return (
        socketName.startsWith('Shoulder_Weapon') ||
        socketName.startsWith('Torso_Weapon')
      );
    }

    function hasDifferentShoulderModuleIds(preset: Preset): boolean {
      const moduleIds = new Set<string>();
      Object.entries(preset.modules).forEach(
        ([socketName, moduleInfo]: [string, ModuleInfo]) => {
          // Check for different IDs in weapons OR shoulder modules
          if (
            isWeaponSocket(socketName) ||
            socketName === 'Shoulder_L' ||
            socketName === 'Shoulder_R'
          ) {
            const moduleId = moduleInfo.module_ref.split('::')[1];
            moduleIds.add(moduleId);
          }
        }
      );
      return moduleIds.size > 1;
    }

    // Test case: Titan with different shoulder modules
    const titanDifferentShoulders = {
      character_type: 'Titan',
      modules: {
        Shoulder_L: {
          module_ref: 'OBJID_Module::DA_Module_ShoulderLMatriarch.0',
          parent_socket_name: 'Root',
          level: 1,
        },
        Shoulder_R: {
          module_ref: 'OBJID_Module::DA_Module_ShoulderRMatriarch.0',
          parent_socket_name: 'Root',
          level: 1,
        },
        Shoulder_Weapon_0: {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 1,
        },
      },
    };

    // Test case: Titan with same shoulder modules
    const titanSameShoulders = {
      character_type: 'Titan',
      modules: {
        Shoulder_L: {
          module_ref: 'OBJID_Module::DA_Module_ShoulderLAlpha.0',
          parent_socket_name: 'Root',
          level: 1,
        },
        Shoulder_R: {
          module_ref: 'OBJID_Module::DA_Module_ShoulderLAlpha.0',
          parent_socket_name: 'Root',
          level: 1,
        },
      },
    };

    expect(hasDifferentShoulderModuleIds(titanDifferentShoulders)).toBe(true);
    expect(hasDifferentShoulderModuleIds(titanSameShoulders)).toBe(false);
  });

  it('should display x2 for mechs with same shoulder modules (Anansi case)', () => {
    function isWeaponSocket(socketName: string): boolean {
      return (
        socketName.startsWith('Shoulder_Weapon') ||
        socketName.startsWith('Torso_Weapon')
      );
    }

    function hasSameShoulderModules(preset: Preset): boolean {
      const shoulderModuleIds = new Set<string>();
      Object.entries(preset.modules).forEach(([socketName, moduleInfo]) => {
        if (socketName === 'Shoulder_L' || socketName === 'Shoulder_R') {
          const moduleId = moduleInfo.module_ref.split('::')[1];
          shoulderModuleIds.add(moduleId);
        }
      });
      return shoulderModuleIds.size === 1;
    }

    function simulateGroupedModules(preset: Preset) {
      const moduleGroups = new Map();
      const SOCKET_ORDER = ['Root', 'None', 'Shoulder_L', 'Shoulder_R', 'Ability', 'UltAbility'];
      
      Object.entries(preset.modules).forEach(([socketName, moduleInfo]) => {
        const isWeapon = isWeaponSocket(socketName);
        const isShoulderModule = socketName === 'Shoulder_L' || socketName === 'Shoulder_R';
        
        const key = (isWeapon || isShoulderModule) 
          ? moduleInfo.module_ref 
          : `${moduleInfo.module_ref}|${moduleInfo.parent_socket_name || 'none'}`;
        
        const socketOrderIndex = SOCKET_ORDER.indexOf(socketName);
        const socketOrder = socketOrderIndex !== -1 ? socketOrderIndex : SOCKET_ORDER.length;
        
        if (moduleGroups.has(key)) {
          const existing = moduleGroups.get(key);
          existing.count += 1;
          existing.socketOrder = Math.min(existing.socketOrder, socketOrder);
        } else {
          const isShoulderWeapon =
            isWeapon &&
            (moduleInfo.parent_socket_name === 'Shoulder_L' ||
              moduleInfo.parent_socket_name === 'Shoulder_R');
          const shoulderCount = isShoulderWeapon ? 1 : 0;
          
          moduleGroups.set(key, {
            socketName,
            moduleInfo,
            count: 1,
            socketOrder,
            shoulderCount,
          });
        }
      });
      
      return Array.from(moduleGroups.values()).sort((a, b) => {
        if (a.socketOrder !== b.socketOrder) {
          return a.socketOrder - b.socketOrder;
        }
        return a.socketName.localeCompare(b.socketName);
      });
    }

    function applyShoulderMultiplier(preset: Preset, groupedModules: Array<{
      socketName: string;
      moduleInfo: ModuleInfo;
      count: number;
      shoulderCount: number;
    }>) {
      return groupedModules.map((group) => {
        if (group.shoulderCount > 0) {
          const isTitan = preset.character_type === 'Titan';
          const isShoulderWeapon = isWeaponSocket(group.socketName);

          if (isTitan && isShoulderWeapon) {
            return { ...group, count: group.count * 2 };
          } else if (group.shoulderCount === 2) {
            return { ...group, count: group.count * 2 };
          } else if (!isTitan && isShoulderWeapon && hasSameShoulderModules(preset)) {
            // For non-Titans with same shoulder modules (like Anansi), weapons are implicitly dual-mounted
            return { ...group, count: group.count * 2 };
          }
        }
        return group;
      });
    }

    // Test case: Anansi preset (Mech with same shoulder modules and single weapon)
    const anansiPreset: Preset = {
      character_type: 'Mech',
      modules: {
        'Shoulder_L': {
          module_ref: 'OBJID_Module::DA_Module_ShoulderAnansi.0',
          parent_socket_name: 'Root',
          level: 1
        },
        'Shoulder_R': {
          module_ref: 'OBJID_Module::DA_Module_ShoulderAnansi.0', // Same shoulder module
          parent_socket_name: 'Root',
          level: 1
        },
        'Shoulder_Weapon_0': {
          module_ref: 'OBJID_Module::DA_Module_Weapon_MLx2.0',
          parent_socket_name: 'Shoulder_R',
          level: 1
        }
      }
    };

    expect(hasSameShoulderModules(anansiPreset)).toBe(true);

    const groupedModules = simulateGroupedModules(anansiPreset);
    const weaponModule = groupedModules.find(g => g.socketName === 'Shoulder_Weapon_0');
    expect(weaponModule?.count).toBe(1); // Initial count should be 1

    const finalModules = applyShoulderMultiplier(anansiPreset, groupedModules);
    const finalWeaponModule = finalModules.find(g => g.socketName === 'Shoulder_Weapon_0');
    expect(finalWeaponModule?.count).toBe(2); // Should be doubled due to same shoulder modules
  });
});
