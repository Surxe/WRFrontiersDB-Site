import { describe, it, expect } from 'vitest';
import { getObjRefData } from '../../../src/utils/obj_ref';
import type { Module } from '../../../src/types/module';
import type {
  PilotClass,
  PilotPersonality,
  PilotTalent,
  PilotTalentType,
  Pilot,
} from '../../../src/types/pilot';
import type { ParseObject } from '../../../src/types/parse_object';
import type { LocalizationKey } from '../../../src/types/localization';

describe('getObjRefData', () => {
  const mockLocalizationKey = {
    Key: 'test_key',
    TableNamespace: 'test_namespace',
    en: 'Test Value',
  };

  describe('Module', () => {
    it('should return correct ObjRefData for Module with name', () => {
      const module: Module = {
        parseObjectClass: 'Module',
        id: 'MOD_123',
        name: mockLocalizationKey,
        inventory_icon_path: '/path/to/icon',
        description: mockLocalizationKey,
        module_rarity_id: 'Common',
        character_module_mounts: [],
        module_scalars: {},
        faction_id: 'faction_123',
        module_classes_ids: [],
        module_type_id: 'type_123',
      };

      const result = getObjRefData(module);

      expect(result).toEqual({
        text: mockLocalizationKey,
        iconPath: '/path/to/icon',
        hoverText: mockLocalizationKey,
      });
    });

    it('should throw error for Module without name', () => {
      const module: Module = {
        parseObjectClass: 'Module',
        id: 'MOD_123',
        inventory_icon_path: '/path/to/icon',
        production_status: 'NotReady',
        module_rarity_id: 'Common',
        character_module_mounts: [],
        module_scalars: {},
        faction_id: 'faction_123',
        module_classes_ids: [],
        module_type_id: 'type_123',
        // name is intentionally omitted to test the error case
      };

      expect(() => getObjRefData(module)).toThrow('Module object has no name');
    });
  });

  describe('PilotClass', () => {
    it('should return correct ObjRefData including hexColor', () => {
      const pilotClass: PilotClass = {
        parseObjectClass: 'PilotClass',
        id: 'PC_123',
        name: mockLocalizationKey,
        badge: {
          image_path: '/path/to/badge',
          hex: '#FF5733',
        },
      };

      const result = getObjRefData(pilotClass);

      expect(result).toEqual({
        text: mockLocalizationKey,
        iconPath: '/path/to/badge',
        iconColor: '#FF5733',
      });
    });
  });

  describe('Pilot', () => {
    it('should return correct ObjRefData using first_name + second_name', () => {
      const mockSecondName: LocalizationKey = {
        Key: 'SECOND_NAME',
        TableNamespace: 'Pilot',
        en: 'Doe',
      };

      const pilot: Pilot = {
        parseObjectClass: 'Pilot',
        parseObjectUrl: 'pilots',
        id: 'PIL_123',
        first_name: mockLocalizationKey,
        second_name: mockSecondName,
        image_path: '/path/to/pilot',
        bio: mockLocalizationKey,
        pilot_type_ref: 'type_ref',
        pilot_class_ref: 'class_ref',
        personality_ref: 'personality_ref',
        faction_ref: 'faction_ref',
        sell_price: {
          currency_ref: 'currency',
          amount: 100,
        },
        levels: [],
      };

      const result = getObjRefData(pilot);

      expect(result).toEqual({
        text: [mockLocalizationKey, mockSecondName],
        iconPath: '/path/to/pilot',
      });
    });

    it('should return correct ObjRefData using only first_name when second_name is missing', () => {
      const pilot: Pilot = {
        parseObjectClass: 'Pilot',
        parseObjectUrl: 'pilots',
        id: 'PIL_456',
        first_name: mockLocalizationKey,
        image_path: '/path/to/pilot',
        bio: mockLocalizationKey,
        pilot_type_ref: 'type_ref',
        pilot_class_ref: 'class_ref',
        personality_ref: 'personality_ref',
        faction_ref: 'faction_ref',
        sell_price: {
          currency_ref: 'currency',
          amount: 100,
        },
        levels: [],
      };

      const result = getObjRefData(pilot);

      expect(result).toEqual({
        text: [mockLocalizationKey],
        iconPath: '/path/to/pilot',
      });
    });
  });

  describe('PilotTalent', () => {
    it('should return correct ObjRefData', () => {
      const pilotTalent: PilotTalent = {
        parseObjectClass: 'PilotTalent',
        id: 'PT_123',
        name: mockLocalizationKey,
        description: mockLocalizationKey,
        ui_description: mockLocalizationKey,
        short_ui_description: mockLocalizationKey,
        image_path: '/path/to/talent',
        stats: [],
        buffs: [],
      };

      const result = getObjRefData(pilotTalent);

      expect(result).toEqual({
        text: mockLocalizationKey,
        iconPath: '/path/to/talent',
        hoverText: mockLocalizationKey,
      });
    });
  });

  describe('PilotTalentType', () => {
    it('should return correct ObjRefData', () => {
      const pilotTalentType: PilotTalentType = {
        parseObjectClass: 'PilotTalentType',
        id: 'PTT_123',
        name: mockLocalizationKey,
        image_path: '/path/to/talent_type',
        description: mockLocalizationKey,
      };

      const result = getObjRefData(pilotTalentType);

      expect(result).toEqual({
        text: mockLocalizationKey,
        iconPath: '/path/to/talent_type',
        hoverText: mockLocalizationKey,
      });
    });
  });

  describe('PilotPersonality', () => {
    it('should return correct ObjRefData', () => {
      const pilotPersonality: PilotPersonality = {
        parseObjectClass: 'PilotPersonality',
        id: 'PP_123',
        icon_path: '/path/to/personality',
        name: mockLocalizationKey,
      };

      const result = getObjRefData(pilotPersonality);

      expect(result).toEqual({
        text: mockLocalizationKey,
        iconPath: '/path/to/personality',
      });
    });
  });

  describe('Error handling', () => {
    it('should throw error for unsupported parseObjectClass', () => {
      const unsupportedObject: ParseObject = {
        parseObjectClass: 'UnsupportedType',
        id: 'UNS_123',
      };

      expect(() => getObjRefData(unsupportedObject)).toThrow(
        'Unsupported parseObjectClass: UnsupportedType'
      );
    });
  });

  describe('Type overloads', () => {
    it('should accept Module type directly', () => {
      const module: Module = {
        parseObjectClass: 'Module',
        id: 'MOD_123',
        name: mockLocalizationKey,
        inventory_icon_path: '/path/to/icon',
        description: mockLocalizationKey,
        module_rarity_id: 'Common',
        character_module_mounts: [],
        module_scalars: {},
        faction_id: 'faction_123',
        module_classes_ids: [],
        module_type_id: 'type_123',
      };

      // This should compile without errors due to overloads
      const result = getObjRefData(module);
      expect(result.text).toBe(mockLocalizationKey);
    });

    it('should accept Pilot type directly', () => {
      const pilot: Pilot = {
        parseObjectClass: 'Pilot',
        parseObjectUrl: 'pilots',
        id: 'PIL_123',
        first_name: mockLocalizationKey,
        image_path: '/path/to/pilot',
        bio: mockLocalizationKey,
        pilot_type_ref: 'type_ref',
        pilot_class_ref: 'class_ref',
        personality_ref: 'personality_ref',
        faction_ref: 'faction_ref',
        sell_price: {
          currency_ref: 'currency',
          amount: 100,
        },
        levels: [],
      };

      // This should compile without errors due to overloads
      const result = getObjRefData(pilot);
      expect(result.text).toEqual([mockLocalizationKey]);
    });
  });
});
