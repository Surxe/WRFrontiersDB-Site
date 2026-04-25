/**
 * Tests for slug generation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  generateSlugForObject,
  generateSlugMap,
} from '../../src/utils/slug_generator';
import type { ParseObject } from '../../src/types/parse_object';
import type { Pilot } from '../../src/types/pilot';
import type { PilotTalent } from '../../src/types/pilot';
import type { Module } from '../../src/types/module';
import type { CharacterPreset } from '../../src/types/character_preset';

describe('slug_generator', () => {
  describe('generateSlugForObject', () => {
    it('should generate pilot slugs correctly', () => {
      const pilot: Pilot = {
        parseObjectClass: 'Pilot',
        id: 'test_pilot.1',
        first_name: { en: 'John' },
        last_name: { en: 'Doe' },
      } as Pilot;

      const slug = generateSlugForObject(pilot);
      expect(slug).toBe('john-doe');
    });

    it('should generate pilot talent slugs correctly', () => {
      const talent: PilotTalent = {
        parseObjectClass: 'PilotTalent',
        id: 'test_talent.1',
        name: { en: 'Quick Reflexes' },
      } as PilotTalent;

      const slug = generateSlugForObject(talent);
      expect(slug).toBe('quick-reflexes');
    });

    it('should generate module slugs correctly', () => {
      const module: Module = {
        parseObjectClass: 'Module',
        id: 'test_module.1',
        name: { en: 'Laser Cannon' },
        module_group_ref: 'OBJID_ModuleGroup::light-weapon',
        inventory_icon_path: '',
        module_rarity_ref: '',
        character_module_mounts: [],
        faction_ref: '',
        module_type_ref: 'OBJID_ModuleType::DA_ModuleType_Weapon.0',
      } as Module;

      const slug = generateSlugForObject(module, {
        allModuleGroups: {
          'light-weapon': {
            id: 'light-weapon',
            name: { en: 'Light Weapon' },
          } as unknown,
        },
      });
      expect(slug).toBe('light-weapon-laser-cannon');
    });

    it('should generate AI bot slugs correctly', () => {
      const aiBot: CharacterPreset = {
        parseObjectClass: 'CharacterPreset',
        id: 'DA_Preset_Guardian.0',
        name: { en: 'Guardian' },
        is_factory_preset: false,
      } as CharacterPreset;

      const slug = generateSlugForObject(aiBot);
      expect(slug).toBe('guardian');
    });

    it('should generate factory bot slugs correctly', () => {
      const factoryBot: CharacterPreset = {
        parseObjectClass: 'CharacterPreset',
        id: 'test_factory_bot.1',
        name: { en: 'Assembler' },
        is_factory_preset: true,
      } as CharacterPreset;

      const slug = generateSlugForObject(factoryBot);
      expect(slug).toBe('assembler');
    });

    it('should generate default slugs for unknown object types', () => {
      const unknownObject: ParseObject = {
        parseObjectClass: 'UnknownType',
        id: 'test_unknown.1',
        name: { en: 'Test Object' },
      } as ParseObject;

      const slug = generateSlugForObject(unknownObject);
      expect(slug).toBe('test-object');
    });

    it('should handle special characters in names', () => {
      const pilot: Pilot = {
        parseObjectClass: 'Pilot',
        id: 'test_pilot.1',
        first_name: { en: 'Jean-Luc' },
        last_name: { en: "O'Reilly" },
      } as Pilot;

      const slug = generateSlugForObject(pilot);
      expect(slug).toBe('jean-luc-o-reilly');
    });

    it('should handle empty names gracefully', () => {
      const module: Module = {
        parseObjectClass: 'Module',
        id: 'test_module.1',
        module_group_ref: 'OBJID_ModuleGroup::light-weapon',
        inventory_icon_path: '',
        module_rarity_ref: '',
        character_module_mounts: [],
        faction_ref: '',
        module_type_ref: 'OBJID_ModuleType::DA_ModuleType_Weapon.0',
      } as Module;

      const slug = generateSlugForObject(module, {
        allModuleGroups: {
          'light-weapon': {
            id: 'light-weapon',
            name: { en: 'Light Weapon' },
          } as unknown,
        },
      });
      expect(slug).toBe('light-weapon');
    });
  });

  describe('generateSlugMap', () => {
    it('should generate slug map without collisions', () => {
      const objects = [
        {
          pilot1: {
            parseObjectClass: 'Pilot',
            id: 'pilot1',
            first_name: { en: 'John' },
            last_name: { en: 'Doe' },
          } as Pilot,
          pilot2: {
            parseObjectClass: 'Pilot',
            id: 'pilot2',
            first_name: { en: 'Jane' },
            last_name: { en: 'Smith' },
          } as Pilot,
        },
        {
          module1: {
            parseObjectClass: 'Module',
            id: 'module1',
            name: { en: 'Laser Cannon' },
            module_group_ref: 'OBJID_ModuleGroup::light-weapon',
            inventory_icon_path: '',
            module_rarity_ref: '',
            character_module_mounts: [],
            faction_ref: '',
            module_type_ref: 'OBJID_ModuleType::DA_ModuleType_Weapon.0',
          } as Module,
        },
        {
          'light-weapon': {
            parseObjectClass: 'ModuleGroup',
            id: 'light-weapon',
            name: { en: 'Light Weapon' },
          },
        },
      ];

      const slugMap = generateSlugMap(objects);

      expect(slugMap['pilot1']).toBe('john-doe');
      expect(slugMap['pilot2']).toBe('jane-smith');
      expect(slugMap['module1']).toBe('light-weapon-laser-cannon');
      expect(slugMap['light-weapon']).toBe('light-weapon');
      expect(Object.keys(slugMap)).toHaveLength(4);
    });

    it('should handle empty object arrays', () => {
      const objects: Record<string, ParseObject>[] = [];
      const slugMap = generateSlugMap(objects);

      expect(Object.keys(slugMap)).toHaveLength(0);
    });

    it('should handle objects with missing names', () => {
      const objects = [
        {
          pilot1: {
            parseObjectClass: 'Pilot',
            id: 'pilot1',
          } as Pilot,
        },
      ];

      const slugMap = generateSlugMap(objects);
      expect(slugMap['pilot1']).toBe('');
    });
  });
});
