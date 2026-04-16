import { describe, it, expect } from 'vitest';
import {
  getModuleGroupForWeaponSocket,
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

  describe('getModuleGroupForWeaponSocket', () => {
    it('should return correct module group for Shoulder_Weapon sockets', () => {
      expect(getModuleGroupForWeaponSocket('Shoulder_Weapon_0')).toBe(
        'non-titan-shoulder'
      );
      expect(getModuleGroupForWeaponSocket('Shoulder_Weapon_1')).toBe(
        'non-titan-shoulder'
      );
    });

    it('should return correct module group for Torso_Weapon sockets', () => {
      expect(getModuleGroupForWeaponSocket('Torso_Weapon_0')).toBe(
        'non-titan-torsos'
      );
    });

    it('should return undefined for non-weapon sockets', () => {
      expect(getModuleGroupForWeaponSocket('Root')).toBeUndefined();
      expect(getModuleGroupForWeaponSocket('Shoulder_L')).toBeUndefined();
      expect(getModuleGroupForWeaponSocket('Shoulder_R')).toBeUndefined();
      expect(getModuleGroupForWeaponSocket('Unknown')).toBeUndefined();
    });
  });

  describe('constants', () => {
    it('should have correct weapon socket prefixes', () => {
      expect(WEAPON_SOCKET_PREFIXES.SHOULDER_WEAPON).toBe('Shoulder_Weapon');
      expect(WEAPON_SOCKET_PREFIXES.TORSO_WEAPON).toBe('Torso_Weapon');
    });
  });
});
