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
 * Localizes a single LocalizationKey or an array of them into a single string.
 * Multiple keys are joined with a space.
 */
export function localizeText(
  text: LocalizationKey | LocalizationKey[] | undefined,
  lang: string
): string {
  if (!text) return '';
  const locData = loadLocalizationData(lang);
  const elements = Array.isArray(text) ? text : [text];

  return elements
    .map((key) => {
      if (!key) return '';
      if (key.InvariantString) return key.InvariantString;
      if (key.Key && key.TableNamespace && locData?.[key.TableNamespace]) {
        return locData[key.TableNamespace][key.Key] || key.en || '';
      }
      return key.en || '';
    })
    .join(' ');
}

/**
 * Resolves a raw localization string key to a full LocalizationKey object.
 * If namespace is provided, it directly looks up the key in that namespace.
 * If omitted, it searches all namespaces but throws an error if the key exists in multiple namespaces.
 */
export function resolveLocalizationKey(
  key: string,
  namespace?: string
): LocalizationKey {
  const dictionary = (loadLocalizationData('en') || {}) as Record<
    string,
    Record<string, string>
  >;

  if (namespace) {
    if (
      dictionary[namespace] &&
      Object.prototype.hasOwnProperty.call(dictionary[namespace], key)
    ) {
      return {
        Key: key,
        TableNamespace: namespace,
        en: dictionary[namespace][key],
      };
    }
    console.warn(
      `[Localization] Key '${key}' was not found in namespace '${namespace}' in en.json!`
    );
    return {
      Key: key,
      TableNamespace: namespace,
      en: key, // Graceful fallback
    };
  } else {
    let foundNamespace: string | undefined;

    for (const ns in dictionary) {
      if (Object.prototype.hasOwnProperty.call(dictionary[ns], key)) {
        if (foundNamespace) {
          throw new Error(
            `[Localization] Key '${key}' exists in multiple namespaces ('${foundNamespace}' and '${ns}'). Please specify the namespace explicitly.`
          );
        }
        foundNamespace = ns;
      }
    }

    if (foundNamespace) {
      return {
        Key: key,
        TableNamespace: foundNamespace,
        en: dictionary[foundNamespace][key],
      };
    }

    throw new Error(
      `[Localization] Key '${key}' was not found in any namespace! A namespace must be resolvable.`
    );
  }
}

/**
 * Resolves a template string by replacing placeholders with localized values.
 * Placeholders are in the format {placeholderName}.
 */
export function resolveLocalizedEmbeds(
  templateKey: LocalizationKey,
  embeds: Record<string, string | LocalizationKey>,
  locData: Record<string, Record<string, string>>
): string {
  let template = '';
  if (templateKey.InvariantString) {
    template = templateKey.InvariantString;
  } else if (
    templateKey.Key &&
    templateKey.TableNamespace &&
    locData[templateKey.TableNamespace]
  ) {
    template =
      locData[templateKey.TableNamespace][templateKey.Key] ||
      templateKey.en ||
      '';
  } else {
    template = templateKey.en || '';
  }

  let resolved = template;
  for (const [key, value] of Object.entries(embeds)) {
    let replacement = '';
    if (typeof value === 'string') {
      replacement = value;
    } else {
      if (value.InvariantString) {
        replacement = value.InvariantString;
      } else if (
        value.Key &&
        value.TableNamespace &&
        locData[value.TableNamespace]
      ) {
        replacement =
          locData[value.TableNamespace][value.Key] || value.en || '';
      } else {
        replacement = value.en || '';
      }
    }
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    resolved = resolved.replace(regex, replacement);
  }

  return resolved;
}
