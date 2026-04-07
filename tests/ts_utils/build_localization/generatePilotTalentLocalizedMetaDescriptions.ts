import { describe, it, expect } from 'vitest';
import { generatePilotTalentLocalizedMetaDescriptions } from '../../../src/utils/build_localization';
import type { PilotTalent, Pilot } from '../../../src/types/pilot';

describe('generatePilotTalentLocalizedMetaDescriptions', () => {
  // Mock localization key for testing
  const mockLocalizationKey = {
    Key: 'test_key',
    TableNamespace: 'Test',
    en: 'Test Text',
  };

  // Mock stat choices
  const mockStatChoices = {};

  describe('template selection', () => {
    it('should use PilotTalent_Meta_Description_1 for talent with 1 pilot', () => {
      const enrichedTalent = {
        id: 'TALENT_1',
        name: mockLocalizationKey,
        description: mockLocalizationKey,
        pilots_with_this_talent: [
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 0 }
        ],
      };

      const result = generatePilotTalentLocalizedMetaDescriptions(
        enrichedTalent,
        mockStatChoices,
        'Test Talent'
      );

      expect(result).toHaveLength(2); // en and es
      expect(result[0].description).toContain('Test Text. Learned by Test Text');
    });

    it('should use PilotTalent_Meta_Description_2 for talent with 2 pilots', () => {
      const enrichedTalent = {
        id: 'TALENT_1',
        name: mockLocalizationKey,
        description: mockLocalizationKey,
        pilots_with_this_talent: [
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 0 },
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 1 }
        ],
      };

      const result = generatePilotTalentLocalizedMetaDescriptions(
        enrichedTalent,
        mockStatChoices,
        'Test Talent'
      );

      expect(result[0].description).toContain('Test Text. Learned by Test Text and Test Text');
    });

    it('should use PilotTalent_Meta_Description_More for talent with 5 pilots', () => {
      const enrichedTalent = {
        id: 'TALENT_1',
        name: mockLocalizationKey,
        description: mockLocalizationKey,
        pilots_with_this_talent: [
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 0 },
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 1 },
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 2 },
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 3 },
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 4 }
        ],
      };

      const result = generatePilotTalentLocalizedMetaDescriptions(
        enrichedTalent,
        mockStatChoices,
        'Test Talent'
      );

      expect(result[0].description).toContain('Test Text. Learned by Test Text, Test Text, Test Text, Test Text, and more');
    });

    it('should use PilotTalent_Meta_Description_1 for talent with no pilots', () => {
      const enrichedTalent = {
        id: 'TALENT_1',
        name: mockLocalizationKey,
        description: mockLocalizationKey,
        pilots_with_this_talent: [],
      };

      const result = generatePilotTalentLocalizedMetaDescriptions(
        enrichedTalent,
        mockStatChoices,
        'Test Talent'
      );

      expect(result[0].description).toContain('Test Text. Learned by');
    });
  });

  describe('formatting', () => {
    it('should include talent name in description', () => {
      const enrichedTalent = {
        id: 'TALENT_1',
        name: { ...mockLocalizationKey, en: 'Fearless' },
        description: mockLocalizationKey,
        pilots_with_this_talent: [
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 0 }
        ],
      };

      const result = generatePilotTalentLocalizedMetaDescriptions(
        enrichedTalent,
        mockStatChoices,
        'Fearless'
      );

      expect(result[0].description).toContain('Fearless: Test Text');
    });

    it('should limit description to 160 characters', () => {
      const enrichedTalent = {
        id: 'TALENT_1',
        name: mockLocalizationKey,
        description: mockLocalizationKey,
        pilots_with_this_talent: [
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 0 }
        ],
      };

      const result = generatePilotTalentLocalizedMetaDescriptions(
        enrichedTalent,
        mockStatChoices,
        'Test Talent'
      );

      result.forEach(desc => {
        expect(desc.description.length).toBeLessThanOrEqual(160);
      });
    });

    it('should return descriptions for all supported languages', () => {
      const enrichedTalent = {
        id: 'TALENT_1',
        name: mockLocalizationKey,
        description: mockLocalizationKey,
        pilots_with_this_talent: [
          { pilot: { first_name: mockLocalizationKey }, level: 1, talentIndex: 0 }
        ],
      };

      const result = generatePilotTalentLocalizedMetaDescriptions(
        enrichedTalent,
        mockStatChoices,
        'Test Talent'
      );

      expect(result).toHaveLength(2); // en and es
      expect(result[0].lang).toBe('en');
      expect(result[1].lang).toBe('es');
    });
  });
});
