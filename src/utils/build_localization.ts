import * as fs from 'fs';
import * as path from 'path';
import type { LocalizationKey } from '../types/localization';
import type { StatValueChoices } from '../types/stat';
import { processLocalizedTextWithStats } from './stat_formatting';
import { resolveLocalizedEmbeds, resolveLocalizationKey } from './localization';
import type { Pilot, PilotTalent, PilotTalentType } from '../types/pilot';
import type { EnrichedPilotTalent } from './pilot';
import { refToId } from './object_reference';
import { PILOT_TYPE_LEGENDARY_REF } from './constants';
import langs from '../../public/langs.json';

const serverLocalizationCache: Record<
  string,
  Record<string, Record<string, string>>
> = {};

// Constants for pilot talent meta description templates
const PILOT_TALENT_TEMPLATE_LIMIT = 5;

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
      Object.assign(mergedData[namespace], keys as Record<string, string>);
    }

    serverLocalizationCache[lang] = mergedData;
    return mergedData;
  } catch (error) {
    console.warn(`Failed to load localization for ${lang}:`, error);
    return null;
  }
}

/**
 * Generate localized pilot talent meta descriptions using the embedment system
 */
export function generatePilotTalentLocalizedMetaDescriptions(
  enrichedTalent: EnrichedPilotTalent,
  statValueChoices: StatValueChoices
): { lang: string; description: string }[] {
  const supportedLangs = Object.keys(langs);
  const results: { lang: string; description: string }[] = [];

  // Get the number of pilots with this talent
  const pilotCount = enrichedTalent.pilots_with_this_talent?.length || 0;

  // Determine which template to use
  let templateKey: string;
  if (pilotCount === 0) {
    // Fallback to basic description if no pilots
    templateKey = 'PilotTalent_Meta_Description_1';
  } else if (pilotCount === 1) {
    templateKey = 'PilotTalent_Meta_Description_1';
  } else if (pilotCount === 2) {
    templateKey = 'PilotTalent_Meta_Description_2';
  } else if (pilotCount === 3) {
    templateKey = 'PilotTalent_Meta_Description_3';
  } else if (pilotCount === 4) {
    templateKey = 'PilotTalent_Meta_Description_4';
  } else if (pilotCount === PILOT_TALENT_TEMPLATE_LIMIT) {
    templateKey = 'PilotTalent_Meta_Description_5';
  } else {
    templateKey = 'PilotTalent_Meta_Description_More';
  }

  // Resolve template key using the same pattern as pilot function
  const resolvedTemplateKey = resolveLocalizationKey(templateKey, 'Web_UI');

  for (const lang of supportedLangs) {
    const locData = loadLocalizationData(lang);
    if (!locData) continue;

    // Get talent description with embedded stats
    const talentDescriptionWithStats = processLocalizedTextWithStats(
      enrichedTalent.description,
      statValueChoices,
      0, // Use choice 0 for meta descriptions (default stat values)
      locData,
      false // Don't wrap in HTML tags for meta descriptions
    );

    // Clean up any remaining HTML tags and normalize whitespace
    const cleanDescription = talentDescriptionWithStats
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Build embeds object
    const embeds: Record<string, LocalizationKey | string> = {
      TalentName: enrichedTalent.name,
      TalentDescriptionWithStats: cleanDescription,
    };

    // Add pilot names to embeds
    const maxPilots = Math.min(pilotCount, PILOT_TALENT_TEMPLATE_LIMIT);
    for (let i = 0; i < maxPilots; i++) {
      const pilot = enrichedTalent.pilots_with_this_talent[i].pilot;
      embeds[`pilot${i + 1}`] = pilot.first_name;
    }

    // Resolve the final template with all embeds
    const description = resolveLocalizedEmbeds(
      resolvedTemplateKey,
      embeds,
      locData
    );

    // Apply length limit for SEO
    results.push({
      lang,
      description: description.substring(0, 160),
    });
  }

  return results;
}

/**
 * Generate localized pilot descriptions using the embedment system
 */
export function generatePilotLocalizedMetaDescriptions(
  pilot: Pilot,
  pilotTalents: Record<string, PilotTalent>,
  pilotTalentTypes: Record<string, PilotTalentType>,
  _defaultName: string
): { lang: string; description: string }[] {
  const supportedLangs = Object.keys(langs);
  const results: { lang: string; description: string }[] = [];

  const isHero = pilot.pilot_type_ref === PILOT_TYPE_LEGENDARY_REF;
  const templateKey = resolveLocalizationKey(
    isHero ? 'Pilot_Meta_Description_Hero' : 'Pilot_Meta_Description_Standard',
    'Web_UI'
  );

  const embeds: Record<string, LocalizationKey> = {
    pilot_name: pilot.first_name,
  };

  // Extract talents for levels 1-5
  for (let i = 0; i < 5; i++) {
    const level = pilot.levels[i];
    if (level && level.talents_refs && level.talents_refs.length > 0) {
      const talentId = refToId(level.talents_refs[0]);
      const talent = pilotTalents[talentId];
      if (talent) {
        embeds[`talent${i + 1}`] = talent.name;
      }
    }
  }

  // Add talent5_type for hero pilots
  if (isHero) {
    const level5 = pilot.levels[4];
    if (level5) {
      const typeId = refToId(level5.talent_type_ref);
      const type = pilotTalentTypes[typeId];
      if (type) {
        embeds['talent5_type'] = type.name;
      }
    }
  }

  for (const lang of supportedLangs) {
    const locData = loadLocalizationData(lang);
    if (!locData) continue;

    let description = resolveLocalizedEmbeds(templateKey, embeds, locData);

    // Fallback to English template if localized template is empty or not found
    if (!description && lang !== 'en') {
      const enLocData = loadLocalizationData('en');
      if (enLocData) {
        description = resolveLocalizedEmbeds(templateKey, embeds, enLocData);
      }
    }

    results.push({ lang, description });
  }

  return results;
}

/**
 * Generate localized meta descriptions for simple templates with basic embeds
 */
export function generateSimpleLocalizedMetaDescriptions(
  templateKey: LocalizationKey,
  embeds: Record<string, LocalizationKey>,
  fallbackName: string
): { lang: string; description: string }[] {
  const supportedLangs = Object.keys(langs);
  const results: { lang: string; description: string }[] = [];

  for (const lang of supportedLangs) {
    const locData = loadLocalizationData(lang);
    if (!locData) continue;

    let description = resolveLocalizedEmbeds(templateKey, embeds, locData);

    // Fallback to English template if localized template is empty or not found
    if (!description && lang !== 'en') {
      const enLocData = loadLocalizationData('en');
      if (enLocData) {
        description = resolveLocalizedEmbeds(templateKey, embeds, enLocData);
      }
    }

    // Final fallback to a simple description if still empty
    if (!description) {
      description = `${fallbackName}: View detailed information.`;
    }

    results.push({ lang, description });
  }

  return results;
}

/**
 * Generate localized pilot talent type meta descriptions using the embedment system
 */
export function generatePilotTalentTypeLocalizedMetaDescriptions(
  talentType: PilotTalentType,
  talentsForType: [string, PilotTalent][],
  _defaultName: string
): { lang: string; description: string }[] {
  const supportedLangs = Object.keys(langs);
  const results: { lang: string; description: string }[] = [];

  const talentCount = talentsForType.length;

  // Determine which template to use
  let templateKey: string;
  if (talentCount === 3) {
    templateKey = 'PilotTalentType_Meta_Description_3';
  } else {
    templateKey = 'PilotTalentType_Meta_Description_More';
  }

  // Resolve template key using the same pattern as other functions
  const resolvedTemplateKey = resolveLocalizationKey(templateKey, 'Web_UI');

  for (const lang of supportedLangs) {
    const locData = loadLocalizationData(lang);
    if (!locData) continue;

    // Build embeds object
    const embeds: Record<string, LocalizationKey | string> = {
      TalentTypeName: talentType.name,
    };

    // Add talent names to embeds
    for (let i = 0; i < Math.min(talentsForType.length, 5); i++) {
      const talent = talentsForType[i][1];
      embeds[`talent${i + 1}`] = talent.name;
    }

    // Add talent5_type for hero pilots
    if (talentCount > 5) {
      const level5 = talentsForType[4][1];
      embeds['talent5_type'] = level5.name;
    }

    // Resolve the final template with all embeds
    let description = resolveLocalizedEmbeds(
      resolvedTemplateKey,
      embeds,
      locData
    );

    // Fallback to English template if localized template is empty or not found
    if (!description && lang !== 'en') {
      const enLocData = loadLocalizationData('en');
      if (enLocData) {
        description = resolveLocalizedEmbeds(
          resolvedTemplateKey,
          embeds,
          enLocData
        );
      }
    }

    // Final fallback to a simple description if still empty
    if (!description) {
      description = `${_defaultName}: View detailed information.`;
    }

    // Apply length limit for SEO
    results.push({
      lang,
      description: description.substring(0, 160),
    });
  }

  return results;
}
