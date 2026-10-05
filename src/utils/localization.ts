import * as fs from 'fs';
import * as path from 'path';
import type { LocalizationKey } from '../types/localization';
import _langs from '../../public/langs.json';
import {
  stripGameMarkup,
  stripGameMarkupFromLocData,
  styleTagNames,
} from '../../public/js/game_markup.js';

const serverLocalizationCache: Record<
  string,
  Record<string, Record<string, string>>
> = {};

/** Each language's game style tag names, read before its markup is stripped. */
const serverStyleTagCache: Record<string, Set<string>> = {};

/** The game's style tag names in `lang` (see game_markup.js), for stripGameMarkup. */
export function gameStyleTagNames(lang: string): Set<string> {
  loadLocalizationData(lang);
  return serverStyleTagCache[lang] ?? new Set();
}

/**
 * Load localization data from local file system
 */
export function loadLocalizationData(lang: string) {
  if (serverLocalizationCache[lang]) {
    return serverLocalizationCache[lang];
  }

  try {
    const localizationPath = path.join(
      process.cwd(),
      'WRFrontiersDB-Data/current/Localization',
      `${lang}.json`
    );

    let gameData = {};
    if (fs.existsSync(localizationPath)) {
      const data = fs.readFileSync(localizationPath, 'utf8');
      const rawGameData = JSON.parse(data);
      serverStyleTagCache[lang] = styleTagNames(rawGameData);
      gameData = stripGameMarkupFromLocData(
        rawGameData,
        serverStyleTagCache[lang]
      );
    }

    const localPath = path.join(
      process.cwd(),
      'public/locales',
      `${lang}.json`
    );

    let localData = {};
    if (fs.existsSync(localPath)) {
      const data = fs.readFileSync(localPath, 'utf8');
      localData = JSON.parse(data);
    }

    const mergedData: Record<string, Record<string, string>> = { ...gameData };
    for (const [namespace, keys] of Object.entries(localData)) {
      if (!mergedData[namespace]) mergedData[namespace] = {};
      Object.assign(mergedData[namespace], keys as Record<string, string>);
    }

    serverLocalizationCache[lang] = mergedData;
    return mergedData;
  } catch (error) {
    console.warn(`Failed to load localization for ${lang}:`, error);
    return null;
  }
}

export function getDefaultString(
  localizationKey: LocalizationKey | undefined
): string | undefined {
  if (!localizationKey) {
    return undefined;
  }
  // Prefer the en localization if Key+TableNamespace exist (it is the proper English text).
  // Only fall back to InvariantString when there is no Key+TableNamespace present.
  const order =
    localizationKey.Key && localizationKey.TableNamespace
      ? [localizationKey.en, localizationKey.InvariantString]
      : [localizationKey.InvariantString, localizationKey.en];
  const text = order.find(Boolean);
  if (!text) {
    throw new Error('LocalizationKey has no InvariantString or en field');
  }
  // `en` is copied from the game's localization, so it carries its markup.
  return stripGameMarkup(text, gameStyleTagNames('en'));
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
      // Prefer Key+TableNamespace lookup; InvariantString is only used when no key exists.
      if (key.Key && key.TableNamespace) {
        if (locData?.[key.TableNamespace]) {
          return (
            locData[key.TableNamespace][key.Key] ||
            key.en ||
            key.InvariantString ||
            ''
          );
        }
        return key.en || key.InvariantString || '';
      }
      if (key.InvariantString) return key.InvariantString;
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
  // Prefer Key+TableNamespace lookup; InvariantString is only used when no key exists.
  if (templateKey.Key && templateKey.TableNamespace) {
    if (locData[templateKey.TableNamespace]) {
      template =
        locData[templateKey.TableNamespace][templateKey.Key] ||
        templateKey.en ||
        templateKey.InvariantString ||
        '';
    } else {
      template = templateKey.en || templateKey.InvariantString || '';
    }
  } else if (templateKey.InvariantString) {
    template = templateKey.InvariantString;
  } else {
    template = templateKey.en || '';
  }

  let resolved = template;
  for (const [key, value] of Object.entries(embeds)) {
    let replacement = '';
    if (typeof value === 'string') {
      replacement = value;
    } else {
      // Prefer Key+TableNamespace lookup; InvariantString is only used when no key exists.
      if (value.Key && value.TableNamespace) {
        if (locData[value.TableNamespace]) {
          replacement =
            locData[value.TableNamespace][value.Key] ||
            value.en ||
            value.InvariantString ||
            '';
        } else {
          replacement = value.en || value.InvariantString || '';
        }
      } else if (value.InvariantString) {
        replacement = value.InvariantString;
      } else {
        replacement = value.en || '';
      }
    }
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    resolved = resolved.replace(regex, replacement);
  }

  return resolved;
}

/**
 * Resolves a catalog of `{ Key, TableNamespace }` references into full
 * LocalizationKeys (English text included), e.g. a page's UI strings for
 * LocalizedText and for its client script.
 */
export function resolveLocalizationKeys<Id extends string>(
  refs: Readonly<Record<Id, { Key: string; TableNamespace: string }>>
): Record<Id, LocalizationKey> {
  const entries = Object.entries<{ Key: string; TableNamespace: string }>(
    refs
  ).map(([id, ref]) => [
    id,
    resolveLocalizationKey(ref.Key, ref.TableNamespace),
  ]);
  // Same keys as `refs`, each mapped to its resolved key.
  return Object.fromEntries(entries) as Record<Id, LocalizationKey>;
}
