import { describe, it, expect } from 'vitest';
import {
  getModuleCategoryForWeaponSocket,
  isWeaponSocket,
  WEAPON_SOCKET_PREFIXES,
} from '../src/utils/socket_module_mapping';

describe('socket_module_mapping', () => {
  describe('isWeaponSocket', () => {
    it('should return true for Shoulder_Weapon sockets', () => {
      expect(isWeaponSocket('Shoulder_Weapon_0')).toBe(true);
      expect(isWeaponSocket('Shoulder_Weapon_1')).toBe(true);
    });

    it('should return true for Torso_Weapon sockets', () => {
      expect(isWeaponSocket('Torso_Weapon_0')).toBe(true);
    });

    it('should return false for non-weapon sockets', () => {
      expect(isWeaponSocket('Root')).toBe(false);
      expect(isWeaponSocket('Shoulder_L')).toBe(false);
      expect(isWeaponSocket('Shoulder_R')).toBe(false);
      expect(isWeaponSocket('Ability')).toBe(false);
    });
  });

  describe('getModuleCategoryForWeaponSocket', () => {
    it('should return correct module category for Shoulder_Weapon sockets', () => {
      expect(getModuleCategoryForWeaponSocket('Shoulder_Weapon_0')).toBe(
        'DA_ModuleCategory_Shoulder.0'
      );
      expect(getModuleCategoryForWeaponSocket('Shoulder_Weapon_1')).toBe(
        'DA_ModuleCategory_Shoulder.0'
      );
    });

    it('should return correct module category for Torso_Weapon sockets', () => {
      expect(getModuleCategoryForWeaponSocket('Torso_Weapon_0')).toBe(
        'DA_ModuleCategory_Torso.0'
      );
    });

    it('should return undefined for non-weapon sockets', () => {
      expect(getModuleCategoryForWeaponSocket('Root')).toBeUndefined();
      expect(getModuleCategoryForWeaponSocket('Shoulder_L')).toBeUndefined();
      expect(getModuleCategoryForWeaponSocket('Shoulder_R')).toBeUndefined();
      expect(getModuleCategoryForWeaponSocket('Unknown')).toBeUndefined();
    });
  });

  describe('constants', () => {
    it('should have correct weapon socket prefixes', () => {
      expect(WEAPON_SOCKET_PREFIXES.SHOULDER_WEAPON).toBe('Shoulder_Weapon');
      expect(WEAPON_SOCKET_PREFIXES.TORSO_WEAPON).toBe('Torso_Weapon');
    });
  });
});
