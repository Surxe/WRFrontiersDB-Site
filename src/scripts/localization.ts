/**
 * Client-side localization for bundled scripts (src/scripts).
 *
 * The site's runtime localization lives in public/js/localization.js, which is
 * served as-is (not bundled), so bundled code imports it by URL at runtime; its
 * types come from its JSDoc.
 */
import type { LocalizationData, LocalizationKey } from '../types/localization';

type LocalizationModule = typeof import('../../public/js/localization.js');

const LOCALIZATION_MODULE_URL = '/js/localization.js';

function loadLocalizationModule(): Promise<LocalizationModule> {
  return import(/* @vite-ignore */ LOCALIZATION_MODULE_URL);
}

/**
 * Localize the page's `[data-loc-key]` elements (LocalizedText, ObjRef, ...)
 * as every page does, and return the loaded strings (game + site) for the
 * reader's language, for text built at runtime. Null when they failed to load.
 */
export async function localizePage(): Promise<LocalizationData | null> {
  const localization = await loadLocalizationModule();
  await localization.initializeLocalization('current');
  return localization.loadLanguage(
    localization.getCurrentLanguage(),
    'current'
  );
}

/** A key's text in the loaded language, else its English default (as
 * LocalizedText renders it before localization runs). */
export function localizeKey(
  key: LocalizationKey,
  data: LocalizationData | null
): string {
  const fallback = key.en ?? key.InvariantString ?? '';
  if (!key.Key || !key.TableNamespace) return key.InvariantString ?? fallback;
  return data?.[key.TableNamespace]?.[key.Key] ?? fallback;
}
