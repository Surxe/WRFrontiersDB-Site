import type { LocalizationKey } from '../types/localization';
import enData from '../../WRFrontiersDB-Data/current/Localization/en.json';

export function getDefaultString(
  localizationKey: LocalizationKey | undefined
): string | undefined {
  if (!localizationKey) {
    return undefined;
  }
  if (localizationKey.InvariantString) {
    return localizationKey.InvariantString;
  }
  if (localizationKey.en) {
    return localizationKey.en;
  }

  throw new Error('LocalizationKey has no InvariantString or en field');
}

/**
 * Resolves a raw localization string key to a full LocalizationKey object
 * by directly looking up its TableNamespace and default English text in the JSON dictionary.
 */
export function resolveLocalizationKey(namespace: string, key: string): LocalizationKey {
  const dictionary: Record<string, Record<string, string>> = enData as Record<string, Record<string, string>>;

  if (dictionary[namespace] && Object.prototype.hasOwnProperty.call(dictionary[namespace], key)) {
    return {
      Key: key,
      TableNamespace: namespace,
      en: dictionary[namespace][key]
    };
  }

  console.warn(`[Localization] Key '${key}' was not found in namespace '${namespace}' in en.json!`);
  return {
    Key: key,
    TableNamespace: namespace,
    en: key // Graceful fallback
  };
}
