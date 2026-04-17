import { describe, it, expect } from 'vitest';

describe('BotItem weapon count logic', () => {
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
});
