import type { LocalizationKey } from '../types/localization';
import { loadLocalizationData } from './build_localization';

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
 * Resolves a raw localization string key to a full LocalizationKey object.
 * If namespace is provided, it directly looks up the key in that namespace.
 * If omitted, it searches all namespaces but throws an error if the key exists in multiple namespaces.
 */
export function resolveLocalizationKey(key: string, namespace?: string): LocalizationKey {
  const dictionary = (loadLocalizationData('en') || {}) as Record<string, Record<string, string>>;

  if (namespace) {
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
  } else {
    let foundNamespace: string | undefined;

    for (const ns in dictionary) {
      if (Object.prototype.hasOwnProperty.call(dictionary[ns], key)) {
        if (foundNamespace) {
          throw new Error(`[Localization] Key '${key}' exists in multiple namespaces ('${foundNamespace}' and '${ns}'). Please specify the namespace explicitly.`);
        }
        foundNamespace = ns;
      }
    }

    if (foundNamespace) {
      return {
        Key: key,
        TableNamespace: foundNamespace,
        en: dictionary[foundNamespace][key]
      };
    }

    throw new Error(`[Localization] Key '${key}' was not found in any namespace! A namespace must be resolvable.`);
  }
}
