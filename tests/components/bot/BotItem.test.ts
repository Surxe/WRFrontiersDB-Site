import { describe, it, expect } from 'vitest';

describe('BotItem weapon count and side logic', () => {
  it('should display x2 for Titan shoulder weapons with single weapon', () => {
    // Mock the logic from BotItem.astro
    function isWeaponSocket(socketName: string): boolean {
      return socketName.startsWith('Shoulder_Weapon') || socketName.startsWith('Torso_Weapon');
    }

    function simulateGroupedModules(preset: any) {
      const moduleGroups = new Map();
      
      Object.entries(preset.modules).forEach(([socketName, moduleInfo]: [string, any]) => {
        const isWeapon = isWeaponSocket(socketName);
        const key = isWeapon ? moduleInfo.module_ref : `${moduleInfo.module_ref}|${moduleInfo.parent_socket_name || 'none'}`;
        
        const isShoulderWeapon = isWeapon && (
          moduleInfo.parent_socket_name === 'Shoulder_L' || 
          moduleInfo.parent_socket_name === 'Shoulder_R'
        );
        
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
      });
      
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
        'Shoulder_Weapon_0': {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 10
        }
      }
    };

    const titanResult = simulateGroupedModules(titanPreset);
    expect(titanResult[0].count).toBe(2); // Should be doubled for Titan

    // Test case 2: Non-Titan with single shoulder weapon (should not be doubled)
    const botPreset = {
      character_type: 'Bot',
      modules: {
        'Shoulder_Weapon_0': {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 10
        }
      }
    };

    const botResult = simulateGroupedModules(botPreset);
    expect(botResult[0].count).toBe(1); // Should not be doubled for non-Titan

    // Test case 3: Non-Titan with dual shoulder weapons (should be doubled)
    const botDualPreset = {
      character_type: 'Bot',
      modules: {
        'Shoulder_Weapon_0': {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 10
        },
        'Shoulder_Weapon_1': {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_R',
          level: 10
        }
      }
    };

    const botDualResult = simulateGroupedModules(botDualPreset);
    expect(botDualResult[0].count).toBe(4); // Should be doubled for dual shoulders (2 weapons x 2 shoulders)
  });

  it('should detect different weapon IDs for Titan weapons', () => {
    function isWeaponSocket(socketName: string): boolean {
      return socketName.startsWith('Shoulder_Weapon') || socketName.startsWith('Torso_Weapon');
    }

    function hasDifferentWeaponIds(preset: any): boolean {
      const weaponIds = new Set<string>();
      Object.entries(preset.modules).forEach(([socketName, moduleInfo]: [string, any]) => {
        if (isWeaponSocket(socketName)) {
          const moduleId = moduleInfo.module_ref.split('::')[1];
          weaponIds.add(moduleId);
        }
      });
      return weaponIds.size > 1;
    }

    // Test case: Titan with different weapons
    const titanDifferentWeapons = {
      character_type: 'Titan',
      modules: {
        'Shoulder_Weapon_0': {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 10
        },
        'Shoulder_Weapon_1': {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Scrubber.0',
          parent_socket_name: 'Shoulder_R',
          level: 10
        }
      }
    };

    // Test case: Titan with same weapon
    const titanSameWeapon = {
      character_type: 'Titan',
      modules: {
        'Shoulder_Weapon_0': {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 10
        }
      }
    };

    expect(hasDifferentWeaponIds(titanDifferentWeapons)).toBe(true);
    expect(hasDifferentWeaponIds(titanSameWeapon)).toBe(false);
  });

  it('should map socket names to side locale keys', () => {
    function getSocketSideLocaleKey(parentSocketName: string): string | undefined {
      const mapping: Record<string, string> = {
        'Shoulder_L': 'Web_UI.Socket_Left',
        'Shoulder_R': 'Web_UI.Socket_Right',
      };
      return mapping[parentSocketName];
    }

    expect(getSocketSideLocaleKey('Shoulder_L')).toBe('Web_UI.Socket_Left');
    expect(getSocketSideLocaleKey('Shoulder_R')).toBe('Web_UI.Socket_Right');
    expect(getSocketSideLocaleKey('Root')).toBeUndefined();
  });

  it('should detect different shoulder module IDs for Titans', () => {
    function isWeaponSocket(socketName: string): boolean {
      return socketName.startsWith('Shoulder_Weapon') || socketName.startsWith('Torso_Weapon');
    }

    function hasDifferentShoulderModuleIds(preset: any): boolean {
      const moduleIds = new Set<string>();
      Object.entries(preset.modules).forEach(([socketName, moduleInfo]: [string, any]) => {
        // Check for different IDs in weapons OR shoulder modules
        if (isWeaponSocket(socketName) || socketName === 'Shoulder_L' || socketName === 'Shoulder_R') {
          const moduleId = moduleInfo.module_ref.split('::')[1];
          moduleIds.add(moduleId);
        }
      });
      return moduleIds.size > 1;
    }

    // Test case: Titan with different shoulder modules
    const titanDifferentShoulders = {
      character_type: 'Titan',
      modules: {
        'Shoulder_L': {
          module_ref: 'OBJID_Module::DA_Module_ShoulderLMatriarch.0',
          parent_socket_name: 'Root',
          level: 1
        },
        'Shoulder_R': {
          module_ref: 'OBJID_Module::DA_Module_ShoulderRMatriarch.0',
          parent_socket_name: 'Root',
          level: 1
        },
        'Shoulder_Weapon_0': {
          module_ref: 'OBJID_Module::DA_Module_Weapon_Hive.0',
          parent_socket_name: 'Shoulder_L',
          level: 1
        }
      }
    };

    // Test case: Titan with same shoulder modules
    const titanSameShoulders = {
      character_type: 'Titan',
      modules: {
        'Shoulder_L': {
          module_ref: 'OBJID_Module::DA_Module_ShoulderLAlpha.0',
          parent_socket_name: 'Root',
          level: 1
        },
        'Shoulder_R': {
          module_ref: 'OBJID_Module::DA_Module_ShoulderLAlpha.0',
          parent_socket_name: 'Root',
          level: 1
        }
      }
    };

    expect(hasDifferentShoulderModuleIds(titanDifferentShoulders)).toBe(true);
    expect(hasDifferentShoulderModuleIds(titanSameShoulders)).toBe(false);
  });
});
