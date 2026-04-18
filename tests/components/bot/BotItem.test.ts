import { describe, it, expect } from 'vitest';

// Mimicking the real helper since it's inside BotItem.astro
function isWeaponSocket(socketName: string): boolean {
  return (
    socketName.startsWith('Shoulder_Weapon') ||
    socketName.startsWith('Torso_Weapon')
  );
}

// Mimicking the real refToId
function refToId(ref: string): string {
  return ref.split('::').pop()?.split('.')[0] || '';
}

interface CharacterPresetModule {
  module_ref: string;
  socket_name: string;
  parent_socket_index: number;
}

interface CharacterPreset {
  character_type: string;
  modules: CharacterPresetModule[];
}

// Simulated grouping algorithm matching src/components/bot/BotItem.astro
function simulateGroupedModules(preset: CharacterPreset) {
  const modules_arr = preset.modules || [];
  
  const shoulderL = modules_arr.find(e => e.socket_name === 'Shoulder_L');
  const shoulderR = modules_arr.find(e => e.socket_name === 'Shoulder_R');
  const hasDifferentShoulders = shoulderL && shoulderR && shoulderL.module_ref !== shoulderR.module_ref;

  const weaponIds = new Set<string>();
  modules_arr.forEach(m => {
    if (isWeaponSocket(m.socket_name)) {
      weaponIds.add(refToId(m.module_ref));
    }
  });
  const shouldShowWeaponGroups = weaponIds.size > 1;

  interface ModuleGroupEntry {
    module_ref: string; // Simplified for test
    socket_name: string;
    count: number;
    firstIndex: number;
    socketSideLabel?: string;
    moduleGroupName?: string;
  }
  const groups = new Map<string, ModuleGroupEntry>();

  modules_arr.forEach((entry, idx) => {
    const isWeapon = isWeaponSocket(entry.socket_name);
    // In real code we use getModuleGroupForWeaponSocket, mimicking prefix here
    const mGroupId = isWeapon 
      ? (entry.socket_name.startsWith('Shoulder_Weapon') ? 'Shoulder' : 'Torso') 
      : undefined;
    
    const weaponGroupSuffix = (isWeapon && shouldShowWeaponGroups && mGroupId) ? `|${mGroupId}` : '';
    const isShoulderSlot = entry.socket_name === 'Shoulder_L' || entry.socket_name === 'Shoulder_R';
    
    const key = (isWeapon || isShoulderSlot) 
      ? `${entry.module_ref}${weaponGroupSuffix}`
      : `${entry.module_ref}|${entry.socket_name}`;

    if (groups.has(key)) {
      groups.get(key)!.count++;
    } else {
      let socketSideLabel = undefined;
      if (isShoulderSlot && hasDifferentShoulders) {
        socketSideLabel = entry.socket_name === 'Shoulder_L' ? 'Left' : 'Right';
      }

      groups.set(key, { 
        module_ref: entry.module_ref, 
        socket_name: entry.socket_name, 
        count: 1, 
        firstIndex: idx,
        socketSideLabel,
        moduleGroupName: (isWeapon && shouldShowWeaponGroups && mGroupId) ? mGroupId : undefined
      });
    }
  });

  return Array.from(groups.values()).sort((a, b) => a.firstIndex - b.firstIndex);
}

describe('BotItem rework - dynamic grouping logic', () => {
  it('should group weapons by module_ref and increment count (CeresLocust case)', () => {
    const preset: CharacterPreset = {
      character_type: 'Mech',
      modules: [
        { module_ref: 'OBJID_Module::DA_Module_ChassisGriffin.2', socket_name: 'None', parent_socket_index: -1 },
        { module_ref: 'OBJID_Module::DA_Module_TorsoDemeter.1', socket_name: 'Root', parent_socket_index: 0 },
        { module_ref: 'OBJID_Module::DA_Module_ShoulderDemeter.0', socket_name: 'Shoulder_L', parent_socket_index: 1 },
        { module_ref: 'OBJID_Module::DA_Module_Weapon_Locust.0', socket_name: 'Shoulder_Weapon_0', parent_socket_index: 2 },
        { module_ref: 'OBJID_Module::DA_Module_ShoulderDemeter.0', socket_name: 'Shoulder_R', parent_socket_index: 1 },
        { module_ref: 'OBJID_Module::DA_Module_Weapon_Locust.0', socket_name: 'Shoulder_Weapon_0', parent_socket_index: 4 },
        { module_ref: 'OBJID_Module::DA_Module_Weapon_Locust.0', socket_name: 'Torso_Weapon_0', parent_socket_index: 1 }
      ]
    };

    const result = simulateGroupedModules(preset);
    
    // Locust (index 3, 5, 6 in input) should be collapsed into one group
    const locustGroup = result.find(g => g.module_ref.includes('Locust'));
    expect(locustGroup).toBeDefined();
    expect(locustGroup?.count).toBe(3);
    expect(locustGroup?.moduleGroupName).toBeUndefined(); // only 1 weapon ID, so no group names shown
    
    // Shoulders (index 2, 4) should be collapsed
    const shoulderGroup = result.find(g => g.socket_name === 'Shoulder_L');
    expect(shoulderGroup?.count).toBe(2);
    expect(shoulderGroup?.socketSideLabel).toBeUndefined(); // Both shoulders are same ref
  });

  it('should show (Left)/(Right) labels only when shoulder IDs differ (PhantomScourge case)', () => {
    const preset: CharacterPreset = {
      character_type: 'Mech',
      modules: [
        { module_ref: 'OBJID_Module::DA_Module_ChassisPhantom.0', socket_name: 'None', parent_socket_index: -1 },
        { module_ref: 'OBJID_Module::DA_Module_Shoulder_L_Phantom.0', socket_name: 'Shoulder_L', parent_socket_index: 0 },
        { module_ref: 'OBJID_Module::DA_Module_Shoulder_R_Phantom.0', socket_name: 'Shoulder_R', parent_socket_index: 0 }
      ]
    };

    const result = simulateGroupedModules(preset);
    
    const shoulderL = result.find(g => g.socket_name === 'Shoulder_L');
    const shoulderR = result.find(g => g.socket_name === 'Shoulder_R');
    
    expect(shoulderL?.count).toBe(1);
    expect(shoulderL?.socketSideLabel).toBe('Left');
    expect(shoulderR?.count).toBe(1);
    expect(shoulderR?.socketSideLabel).toBe('Right');
  });

  it('should NOT use Titan-specific doubling (natural data counting)', () => {
    // If a Titan has two shoulders and one weapon on each, the data provides BOTH entries now.
    const titanPreset: CharacterPreset = {
      character_type: 'Titan',
      modules: [
        { module_ref: 'OBJID_Module::DA_Module_ChassisTitan.0', socket_name: 'None', parent_socket_index: -1 },
        { module_ref: 'OBJID_Module::DA_Module_Weapon_Heavy.0', socket_name: 'Shoulder_Weapon_0', parent_socket_index: 0 }
      ]
    };

    // Old logic would double this to x2. New logic counts exactly what's there.
    const result = simulateGroupedModules(titanPreset);
    const weaponGroup = result.find(g => g.module_ref.includes('Heavy'));
    expect(weaponGroup?.count).toBe(1);
  });

  it('should show weapon group labels when multiple weapon types exist', () => {
    const preset: CharacterPreset = {
      character_type: 'Mech',
      modules: [
        { module_ref: 'OBJID_Module::DA_Module_Weapon_A.0', socket_name: 'Shoulder_Weapon_0', parent_socket_index: 0 },
        { module_ref: 'OBJID_Module::DA_Module_Weapon_B.0', socket_name: 'Torso_Weapon_0', parent_socket_index: 0 }
      ]
    };

    const result = simulateGroupedModules(preset);
    const weaponA = result.find(g => g.module_ref.includes('Weapon_A'));
    const weaponB = result.find(g => g.module_ref.includes('Weapon_B'));
    
    expect(weaponA?.moduleGroupName).toBe('Shoulder');
    expect(weaponB?.moduleGroupName).toBe('Torso');
  });
});
