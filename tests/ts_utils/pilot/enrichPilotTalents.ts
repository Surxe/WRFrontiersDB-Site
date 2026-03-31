import { describe, it, expect } from 'vitest';
import { enrichPilotTalents } from '../../../src/utils/pilot';
import type { PilotTalent, Pilot } from '../../../src/types/pilot';

describe('enrichPilotTalents', () => {
  // Mock localization key for testing
  const mockLocalizationKey = {
    Key: 'test_key',
    TableNamespace: 'Test',
    en: 'Test Text',
  };

  describe('success cases', () => {
    it('should enrich talents found in pilots with correct level and talent_type_id', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_1',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path/to/talent',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: ['OBJID_PilotTalent::TALENT_1'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_A',
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].talent_type_id).toBe('TYPE_A');
      expect(result['TALENT_1'].level).toBe(1);
    });

    it('should handle multiple talents in different levels', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_1',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path/1',
          stats: [],
          buffs: [],
        },
        TALENT_2: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_2',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path/2',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: ['OBJID_PilotTalent::TALENT_1'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_A',
            },
            {
              talents_refs: ['OBJID_PilotTalent::TALENT_2'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_B',
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].talent_type_id).toBe('TYPE_A');
      expect(result['TALENT_1'].level).toBe(1);
      expect(result['TALENT_2'].talent_type_id).toBe('TYPE_B');
      expect(result['TALENT_2'].level).toBe(2);
    });

    it('should handle multiple talents in same level', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_1',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path/1',
          stats: [],
          buffs: [],
        },
        TALENT_2: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_2',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path/2',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: [
                'OBJID_PilotTalent::TALENT_1',
                'OBJID_PilotTalent::TALENT_2',
              ],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_A',
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].talent_type_id).toBe('TYPE_A');
      expect(result['TALENT_1'].level).toBe(1);
      expect(result['TALENT_2'].talent_type_id).toBe('TYPE_A');
      expect(result['TALENT_2'].level).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should return level -1 and empty talent_type_id for talent not found in any pilot', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        ORPHAN_TALENT: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'ORPHAN_TALENT',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: ['OBJID_PilotTalent::OTHER_TALENT'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_A',
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['ORPHAN_TALENT'].talent_type_id).toBe('');
      expect(result['ORPHAN_TALENT'].level).toBe(-1);
    });

    it('should handle empty inputs', () => {
      const result = enrichPilotTalents({}, {});
      expect(result).toEqual({});
    });

    it('should handle empty pilots', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_1',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
      };

      const result = enrichPilotTalents(pilotTalents, {});

      expect(result['TALENT_1'].talent_type_id).toBe('');
      expect(result['TALENT_1'].level).toBe(-1);
    });

    it('should handle pilot with no levels', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_1',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].talent_type_id).toBe('');
      expect(result['TALENT_1'].level).toBe(-1);
    });

    it('should handle level with empty talents array', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_1',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: [],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_A',
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].talent_type_id).toBe('');
      expect(result['TALENT_1'].level).toBe(-1);
    });
  });

  describe('multiple pilots', () => {
    it('should find talent in first matching pilot', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        SHARED_TALENT: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'SHARED_TALENT',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: ['OBJID_PilotTalent::SHARED_TALENT'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_A',
            },
          ],
        },
        PILOT_2: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_2',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot2',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: ['OBJID_PilotTalent::SHARED_TALENT'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_B',
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      // Should use data from first pilot (implementation finds first match)
      expect(result['SHARED_TALENT'].talent_type_id).toBe('TYPE_A');
      expect(result['SHARED_TALENT'].level).toBe(1);
    });
  });

  describe('return value', () => {
    it('should return new object, not mutate input', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_1',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: ['OBJID_PilotTalent::TALENT_1'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_1',
            },
          ],
        },
      };

      const originalTalents = JSON.parse(JSON.stringify(pilotTalents));
      const result = enrichPilotTalents(pilotTalents, pilots);

      // Input should not be mutated
      expect(pilotTalents).toEqual(originalTalents);

      // Result should have enriched data
      expect(result['TALENT_1'].talent_type_id).toBe('TYPE_1');
      expect(result['TALENT_1'].level).toBe(1);
    });

    it('should return record with same keys as input', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_1',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
        TALENT_2: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_2',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {};

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(Object.keys(result)).toEqual(['TALENT_1', 'TALENT_2']);
      expect(Object.keys(result)).toHaveLength(2);
    });
  });

  describe('level determination', () => {
    it('should use 1-based level numbering', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_FIRST: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_FIRST',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: ['OBJID_PilotTalent::TALENT_FIRST'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_A',
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      // First level should be 1, not 0
      expect(result['TALENT_FIRST'].level).toBe(1);
    });

    it('should correctly identify higher levels', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_LEVEL_3: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_LEVEL_3',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: ['OBJID_PilotTalent::OTHER_TALENT'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_A',
            },
            {
              talents_refs: ['OBJID_PilotTalent::ANOTHER_TALENT'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_B',
            },
            {
              talents_refs: ['OBJID_PilotTalent::TALENT_LEVEL_3'],
              talent_type_ref: 'OBJID_PilotTalentType::TYPE_C',
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_LEVEL_3'].level).toBe(3);
      expect(result['TALENT_LEVEL_3'].talent_type_id).toBe('TYPE_C');
    });
  });

  describe('talent_type_id extraction', () => {
    it('should extract talent_type_id from the level containing the talent', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
          parseObjectUrl: 'pilot_talents',
          id: 'TALENT_1',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path',
          stats: [],
          buffs: [],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          parseObjectUrl: 'pilots',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_ref: 'type_id',
          pilot_class_ref: 'class_id',
          personality_ref: 'personality_id',
          faction_ref: 'faction_id',
          sell_price: { currency_ref: 'currency', amount: 100 },
          levels: [
            {
              talents_refs: ['OBJID_PilotTalent::OTHER_TALENT'],
              talent_type_ref: 'OBJID_PilotTalentType::OTHER_TYPE',
            },
            {
              talents_refs: ['OBJID_PilotTalent::TALENT_1'],
              talent_type_ref: 'OBJID_PilotTalentType::SPECIFIC_TYPE_ID',
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].talent_type_id).toBe('SPECIFIC_TYPE_ID');
    });
  });
});
