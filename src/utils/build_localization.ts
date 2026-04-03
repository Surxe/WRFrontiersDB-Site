import * as fs from 'fs';
import * as path from 'path';
import type { LocalizationKey } from '../types/localization';
import type { StatValueChoices } from '../types/stat';
import { processLocalizedTextWithStats } from './stat_formatting';
import langs from '../../public/langs.json';

/**
 * Load localization data from local file system
 * Uses same pattern as getParseObjects() for consistency
 */
function loadLocalizationData(lang: string) {
  try {
    const localizationPath = path.join(
      process.cwd(),
      'WRFrontiersDB-Data/current/Localization',
      `${lang}.json`
    );
    
    if (!fs.existsSync(localizationPath)) {
      return null;
    }
    
    const data = fs.readFileSync(localizationPath, 'utf8');
    return JSON.parse(data);
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
      description: metaDescription.substring(0, 160) // SEO best practice
    });
  }

  return results;
}
