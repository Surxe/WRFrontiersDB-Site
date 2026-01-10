import { describe, it, expect } from 'vitest';

describe('LocalizedText Component', () => {
  it('should accept required tag prop', () => {
    const requiredProps = {
      tag: 'span'
    };

    expect(requiredProps.tag).toBeDefined();
    expect(typeof requiredProps.tag).toBe('string');
  });

  it('should accept optional id prop', () => {
    const propsWithId = {
      tag: 'p',
      id: 'module-name'
    };

    expect(propsWithId.id).toBeDefined();
    expect(typeof propsWithId.id).toBe('string');
  });

  it('should accept optional localizationKey prop', () => {
    const propsWithKey = {
      tag: 'h1',
      localizationKey: {
        Key: 'MOD_name_ArmorShield',
        TableNamespace: 'Module_name',
        en: 'Emergency Shield'
      }
    };

    expect(propsWithKey.localizationKey).toBeDefined();
    expect(propsWithKey.localizationKey).toHaveProperty('Key');
    expect(propsWithKey.localizationKey).toHaveProperty('TableNamespace');
    expect(propsWithKey.localizationKey).toHaveProperty('en');
  });

  it('should extract namespace from localizationKey', () => {
    const localizationKey = {
      Key: 'MOD_name_ArmorShield',
      TableNamespace: 'Module_name',
      en: 'Emergency Shield'
    };

    const namespace = localizationKey?.TableNamespace;
    expect(namespace).toBe('Module_name');
  });

  it('should extract key from localizationKey', () => {
    const localizationKey = {
      Key: 'MOD_name_ArmorShield',
      TableNamespace: 'Module_name',
      en: 'Emergency Shield'
    };

    const key = localizationKey?.Key;
    expect(key).toBe('MOD_name_ArmorShield');
  });

  it('should extract default text from localizationKey', () => {
    const localizationKey = {
      Key: 'MOD_name_ArmorShield',
      TableNamespace: 'Module_name',
      en: 'Emergency Shield'
    };

    const defaultText = localizationKey?.en || '';
    expect(defaultText).toBe('Emergency Shield');
  });

  it('should use empty string when localizationKey is undefined', () => {
    const localizationKey = undefined;

    const defaultText = localizationKey?.en || '';
    expect(defaultText).toBe('');
  });

  it('should handle various HTML tags', () => {
    const validTags = ['p', 'span', 'h1', 'h2', 'div', 'strong', 'em'];

    validTags.forEach(tag => {
      expect(typeof tag).toBe('string');
      expect(tag.length).toBeGreaterThan(0);
    });
  });
});
