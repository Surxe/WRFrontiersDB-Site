import { describe, it, expect } from 'vitest';
import { enrichPilotTalents } from '../../../src/utils/pilot';
import type { PilotTalent, Pilot } from '../../../src/types/pilot';
import type { LocalizationKey } from '../../../src/types/localization';

describe('enrichPilotTalents', () => {
  const mockLocalizationKey: LocalizationKey = {
    Key: 'test_key',
    TableNamespace: 'test_namespace',
    en: 'Test Value',
  };

  describe('basic enrichment', () => {
    it('should enrich talent with talent_type_id and level', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
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
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'TYPE_OFFENSIVE',
              talents: ['TALENT_1'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].talent_type_id).toBe('TYPE_OFFENSIVE');
      expect(result['TALENT_1'].level).toBe(1);
    });

    it('should preserve original talent properties', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
          id: 'TALENT_1',
          name: mockLocalizationKey,
          description: mockLocalizationKey,
          ui_description: mockLocalizationKey,
          short_ui_description: mockLocalizationKey,
          image_path: '/path/to/talent',
          stats: [{ stat_id: 'stat1', value: 10 }],
          buffs: [{ Modifier: 5 }],
        },
      };

      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'TYPE_DEFENSIVE',
              talents: ['TALENT_1'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].name).toBe(mockLocalizationKey);
      expect(result['TALENT_1'].description).toBe(mockLocalizationKey);
      expect(result['TALENT_1'].image_path).toBe('/path/to/talent');
      expect(result['TALENT_1'].stats).toEqual([
        { stat_id: 'stat1', value: 10 },
      ]);
      expect(result['TALENT_1'].buffs).toEqual([{ Modifier: 5 }]);
    });

    it('should handle multiple talents', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
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
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'TYPE_A',
              talents: ['TALENT_1'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
            {
              talent_type_id: 'TYPE_B',
              talents: ['TALENT_2'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
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
  });

  describe('level determination', () => {
    it('should use 1-based level numbering', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_FIRST: {
          parseObjectClass: 'PilotTalent',
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
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'TYPE_1',
              talents: ['TALENT_FIRST'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
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
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'TYPE_1',
              talents: ['OTHER_TALENT'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
            {
              talent_type_id: 'TYPE_2',
              talents: ['ANOTHER_TALENT'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
            {
              talent_type_id: 'TYPE_3',
              talents: ['TALENT_LEVEL_3'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_LEVEL_3'].level).toBe(3);
    });
  });

  describe('talent_type_id extraction', () => {
    it('should extract talent_type_id from the level containing the talent', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
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
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'SPECIFIC_TYPE_ID',
              talents: ['TALENT_1'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].talent_type_id).toBe('SPECIFIC_TYPE_ID');
    });
  });

  describe('multiple pilots', () => {
    it('should find talent in first matching pilot', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        SHARED_TALENT: {
          parseObjectClass: 'PilotTalent',
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
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot1',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'TYPE_FROM_PILOT_1',
              talents: ['SHARED_TALENT'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
          ],
        },
        PILOT_2: {
          parseObjectClass: 'Pilot',
          id: 'PILOT_2',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot2',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'TYPE_FROM_PILOT_2',
              talents: ['SHARED_TALENT'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      // Should use data from one of the pilots (implementation finds first match)
      expect(result['SHARED_TALENT'].talent_type_id).toBeDefined();
      expect(result['SHARED_TALENT'].level).toBeGreaterThan(0);
    });
  });

  describe('talents not found', () => {
    it('should set level to -1 and empty talent_type_id for talent not in any pilot', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        ORPHAN_TALENT: {
          parseObjectClass: 'PilotTalent',
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
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'TYPE_1',
              talents: ['DIFFERENT_TALENT'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['ORPHAN_TALENT'].level).toBe(-1);
      expect(result['ORPHAN_TALENT'].talent_type_id).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle empty pilot talents', () => {
      const pilotTalents: Record<string, PilotTalent> = {};
      const pilots: Record<string, Pilot> = {
        PILOT_1: {
          parseObjectClass: 'Pilot',
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result).toEqual({});
    });

    it('should handle empty pilots', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
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
      const pilots: Record<string, Pilot> = {};

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].level).toBe(-1);
      expect(result['TALENT_1'].talent_type_id).toBe('');
    });

    it('should handle pilot with no levels', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
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
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].level).toBe(-1);
      expect(result['TALENT_1'].talent_type_id).toBe('');
    });

    it('should handle level with empty talents array', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
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
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'TYPE_1',
              talents: [],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      expect(result['TALENT_1'].level).toBe(-1);
      expect(result['TALENT_1'].talent_type_id).toBe('');
    });
  });

  describe('return value', () => {
    it('should return new object, not mutate input', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
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
          id: 'PILOT_1',
          first_name: mockLocalizationKey,
          image_path: '/path/to/pilot',
          bio: mockLocalizationKey,
          pilot_type_id: 'type_id',
          pilot_class_id: 'class_id',
          personality_id: 'personality_id',
          faction_id: 'faction_id',
          sell_price: { currency_id: 'currency', amount: 100 },
          levels: [
            {
              talent_type_id: 'TYPE_1',
              talents: ['TALENT_1'],
              upgrade_cost: { currency_id: 'currency', amount: 0 },
            },
          ],
        },
      };

      const result = enrichPilotTalents(pilotTalents, pilots);

      // Original should not have been mutated
      expect(pilotTalents['TALENT_1'].talent_type_id).toBeUndefined();
      expect(pilotTalents['TALENT_1'].level).toBeUndefined();

      // Result should have enriched data
      expect(result['TALENT_1'].talent_type_id).toBe('TYPE_1');
      expect(result['TALENT_1'].level).toBe(1);
    });

    it('should return record with same keys as input', () => {
      const pilotTalents: Record<string, PilotTalent> = {
        TALENT_1: {
          parseObjectClass: 'PilotTalent',
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

      expect(Object.keys(result)).toEqual(Object.keys(pilotTalents));
    });
  });
});
