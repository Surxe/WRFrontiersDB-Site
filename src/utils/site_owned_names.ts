import type { LocalizationKey } from '../types/localization';

type SiteNameKey = Required<Pick<LocalizationKey, 'Key' | 'TableNamespace'>>;

/**
 * Names the site owns, by parse object class then object id: parser-generated
 * objects the game has no string for. WRFrontiersDB-Data only references keys
 * the game's localization has, so it carries these names keyless
 * (InvariantString + en); the keys here resolve from public/locales.
 */
export const SITE_OWNED_NAME_KEYS: Readonly<
  Record<string, Readonly<Record<string, SiteNameKey>>>
> = {
  ModuleGroup: {
    'titan-shoulder': {
      Key: 'GRP_TitanShoulders_Name',
      TableNamespace: 'ModuleGroups',
    },
  },
};

/**
 * The object's name with the site's key attached, when the site owns it. A
 * name that already has a key is the game's and is returned as-is, as is any
 * name the site has no key for.
 */
export function withSiteOwnedName(
  parseObjectClass: string,
  id: string,
  name: unknown
): unknown {
  const siteKey = SITE_OWNED_NAME_KEYS[parseObjectClass]?.[id];
  if (!siteKey || !name || typeof name !== 'object') return name;

  const dataName = name as LocalizationKey;
  if (dataName.Key) return name;

  return { ...siteKey, en: dataName.en ?? dataName.InvariantString };
}
