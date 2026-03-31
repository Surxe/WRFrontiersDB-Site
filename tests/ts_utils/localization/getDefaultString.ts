import { describe, it, expect } from 'vitest';
import { getDefaultString } from '../../../src/utils/localization';
import type { LocalizationKey } from '../../../src/types/localization';

describe('getDefaultString', () => {
  describe('success cases', () => {
    it('should return InvariantString when present', () => {
      const localizationKey: LocalizationKey = {
        InvariantString: 'Constant Text',
        en: 'English Text',
      };

      const result = getDefaultString(localizationKey);
      expect(result).toBe('Constant Text');
    });

    it('should return en field when InvariantString is absent', () => {
      const localizationKey: LocalizationKey = {
        en: 'English Text',
      };

      const result = getDefaultString(localizationKey);
      expect(result).toBe('English Text');
    });

    it('should return en field when InvariantString is empty string', () => {
      const localizationKey: LocalizationKey = {
        InvariantString: '',
        en: 'English Text',
      };

      const result = getDefaultString(localizationKey);
      expect(result).toBe('English Text');
    });

    it('should return en field when InvariantString is null', () => {
      const localizationKey: LocalizationKey = {
        InvariantString: null,
        en: 'English Text',
      };

      const result = getDefaultString(localizationKey);
      expect(result).toBe('English Text');
    });
  });

  describe('edge cases', () => {
    it('should return undefined when localizationKey is undefined', () => {
      const result = getDefaultString(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined when localizationKey is null', () => {
      const result = getDefaultString(
        null as unknown as LocalizationKey | undefined
      );
      expect(result).toBeUndefined();
    });

    it('should throw error when localizationKey is empty object', () => {
      const localizationKey: LocalizationKey = {};

      expect(() => {
        getDefaultString(localizationKey);
      }).toThrow('LocalizationKey has no InvariantString or en field');
    });

    it('should throw error when localizationKey has only optional fields', () => {
      const localizationKey: LocalizationKey = {
        Key: 'test_key',
        TableNamespace: 'test_namespace',
      };

      expect(() => {
        getDefaultString(localizationKey);
      }).toThrow('LocalizationKey has no InvariantString or en field');
    });

    it('should throw error when only InvariantString is empty string and no en field', () => {
      const localizationKey: LocalizationKey = {
        InvariantString: '',
      };

      expect(() => {
        getDefaultString(localizationKey);
      }).toThrow('LocalizationKey has no InvariantString or en field');
    });
  });

  describe('error handling', () => {
    it('should throw error when neither InvariantString nor en field exist', () => {
      const localizationKey: LocalizationKey = {};

      expect(() => {
        getDefaultString(localizationKey);
      }).toThrow('LocalizationKey has no InvariantString or en field');
    });

    it('should throw error when both fields are undefined', () => {
      const localizationKey: LocalizationKey = {
        InvariantString: undefined,
        en: undefined,
      };

      expect(() => {
        getDefaultString(localizationKey);
      }).toThrow('LocalizationKey has no InvariantString or en field');
    });

    it('should throw error when both fields are null', () => {
      const localizationKey: LocalizationKey = {
        InvariantString: undefined as unknown as string,
        en: undefined as unknown as string,
      };

      expect(() => {
        getDefaultString(localizationKey);
      }).toThrow('LocalizationKey has no InvariantString or en field');
    });
  });

  describe('type safety', () => {
    it('should handle LocalizationKey with all fields', () => {
      const localizationKey: LocalizationKey = {
        Key: 'test_key',
        TableNamespace: 'test_namespace',
        InvariantString: 'Constant Text',
        en: 'English Text',
      };

      const result = getDefaultString(localizationKey);
      expect(result).toBe('Constant Text');
    });

    it('should handle LocalizationKey with only en field', () => {
      const localizationKey: LocalizationKey = {
        Key: 'test_key',
        TableNamespace: 'test_namespace',
        en: 'English Text',
      };

      const result = getDefaultString(localizationKey);
      expect(result).toBe('English Text');
    });
  });
});
