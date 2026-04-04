import * as fs from 'fs';
import * as path from 'path';
import type { LocalizationKey } from '../types/localization';
import type { StatValueChoices } from '../types/stat';
import { processLocalizedTextWithStats } from './stat_formatting';
import langs from '../../public/langs.json';

const serverLocalizationCache: Record<string, any> = {};

/**
 * Load localization data from local file system
 * Uses same pattern as getParseObjects() for consistency
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
      gameData = JSON.parse(data);
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
      Object.assign(mergedData[namespace], (keys as Record<string, string>));
    }

    serverLocalizationCache[lang] = mergedData;
    return mergedData;
  } catch (error) {
    console.warn(`Failed to load localization for ${lang}:`, error);
    return null;
  }
}

/**
 * Generate localized description for all supported languages
 * Uses extracted stat formatting logic for consistency
 */
export function generateLocalizedMetaDescriptions(
  localizationKey: LocalizationKey | undefined,
  statValueChoices: StatValueChoices,
  fallbackName: string
): { lang: string; description: string }[] {
  const supportedLangs = Object.keys(langs);
  const results: { lang: string; description: string }[] = [];

  for (const lang of supportedLangs) {
    const locData = loadLocalizationData(lang);

    // Use shared logic for consistent formatting
    const localizedText = processLocalizedTextWithStats(
      localizationKey,
      statValueChoices,
      0, // Use choice 0 for meta descriptions (default stat values)
      locData || {},
      false // Don't wrap in HTML tags for meta descriptions
    );

    // Clean up any remaining HTML tags and normalize whitespace
    const cleanText = localizedText
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Build meta description with name prefix and length limit
    const metaDescription = `${fallbackName} - ${cleanText}`;
    results.push({
      lang,
      description: metaDescription.substring(0, 160), // SEO best practice
    });
  }

  return results;
}
