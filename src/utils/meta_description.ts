import type { LocalizationKey } from '../types/localization';
import type { StatValueChoices } from '../types/stat';
import { processLocalizedTextWithStats } from './stat_formatting';
import {
  resolveLocalizedEmbeds,
  resolveLocalizationKey,
  loadLocalizationData,
  localizeText,
} from './localization';
import type { Pilot, PilotTalent, PilotTalentType } from '../types/pilot';
import type { CharacterPreset } from '../types/character_preset';
import type { Currency } from '../types/currency';
import type { CharacterClass } from '../types/character_class';
import type { VirtualBot } from '../types/virtual_bot';
import { refToId } from './object_reference';
import langs from '../../public/langs.json';

/** One precomputed meta description body, for a single language. */
export interface LocalizedDescription {
  lang: string;
  description: string;
}

/** Builds an object's meta description body for one language ('' if none). */
export type MetaBodyBuilder = (lang: string) => string;

const DEFAULT_LANG = 'en';

/**
 * Precompute a meta description body for every supported language. A language
 * whose body comes out empty falls back to the English body, and English falls
 * back to `fallback`.
 */
export function precomputeMetaBodies(
  buildBody: MetaBodyBuilder,
  fallback = ''
): LocalizedDescription[] {
  const english = buildBody(DEFAULT_LANG) || fallback;
  return Object.keys(langs).map((lang) => ({
    lang,
    description: (lang === DEFAULT_LANG ? english : buildBody(lang)) || english,
  }));
}

/**
 * Body builder that fills a site localization template (Web_UI namespace)
 * with `embeds`, each localized to the requested language.
 */
export function templateMetaBody(
  templateKey: string | LocalizationKey,
  embeds: Record<string, LocalizationKey | string>
): MetaBodyBuilder {
  const resolvedKey =
    typeof templateKey === 'string'
      ? resolveLocalizationKey(templateKey, 'Web_UI')
      : templateKey;
  return (lang) => {
    const locData = loadLocalizationData(lang);
    return locData ? resolveLocalizedEmbeds(resolvedKey, embeds, locData) : '';
  };
}

/** Precompute a template-based meta description for every language. */
export function generateTemplateMetaDescriptions(
  templateKey: string | LocalizationKey,
  embeds: Record<string, LocalizationKey | string>,
  fallback: string
): LocalizedDescription[] {
  return precomputeMetaBodies(templateMetaBody(templateKey, embeds), fallback);
}

const PILOT_TALENT_TEMPLATE_LIMIT = 5;

/**
 * Generate localized pilot talent meta descriptions using the embedment system
 */
export function generatePilotTalentLocalizedMetaDescriptions(
  talent: PilotTalent,
  statValueChoices: StatValueChoices,
  allPilots: Record<string, Pilot>
): { lang: string; description: string }[] {
  const supportedLangs = Object.keys(langs);
  const results: { lang: string; description: string }[] = [];

  // Get the number of pilots with this talent
  const pilotCount = talent.pilots_with_this_talent?.length || 0;

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
      talent.description,
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
      TalentName: talent.name,
      TalentDescriptionWithStats: cleanDescription,
    };

    // Add pilot names to embeds
    const maxPilots = Math.min(pilotCount, PILOT_TALENT_TEMPLATE_LIMIT);
    if (talent.pilots_with_this_talent) {
      for (let i = 0; i < maxPilots; i++) {
        const pilotRef = talent.pilots_with_this_talent[i].pilot_ref;
        const pilot = allPilots[refToId(pilotRef)];
        if (pilot) {
          embeds[`pilot${i + 1}`] = pilot.first_name;
        }
      }
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

/** Separator between the talents on one level of a pilot's talent list. */
const PILOT_TALENT_SEPARATOR = ', ';

/**
 * Pilot body: every talent the pilot can learn, one `L#:` line per level, e.g.
 * five single-talent lines for a standard pilot, or 3 talents on levels 1-4
 * plus 1 on level 5 for a hero pilot. Levels without talents are skipped, but
 * each label keeps the pilot's real level number.
 */
export function pilotMetaBody(
  pilot: Pilot,
  pilotTalents: Record<string, PilotTalent>
): MetaBodyBuilder {
  return (lang) =>
    (pilot.levels ?? [])
      .map((level, i) => {
        const talents = (level.talents_refs ?? [])
          .map((ref) => localizeText(pilotTalents[refToId(ref)]?.name, lang))
          .filter((name) => name)
          .join(PILOT_TALENT_SEPARATOR);
        return talents ? `L${i + 1}: ${talents}` : '';
      })
      .filter((line) => line)
      .join('\n');
}

/** Pilot: precomputed {@link pilotMetaBody} for every language. */
export function generatePilotLocalizedMetaDescriptions(
  pilot: Pilot,
  pilotTalents: Record<string, PilotTalent>
): LocalizedDescription[] {
  return precomputeMetaBodies(pilotMetaBody(pilot, pilotTalents));
}

/**
 * Pilot talent type: its name plus the first few talents of that type.
 */
export function generatePilotTalentTypeLocalizedMetaDescriptions(
  talentType: PilotTalentType,
  talentsForType: [string, PilotTalent][],
  defaultName: string
): LocalizedDescription[] {
  const embeds: Record<string, LocalizationKey> = {
    TalentTypeName: talentType.name,
  };
  talentsForType.slice(0, 5).forEach(([, talent], i) => {
    embeds[`talent${i + 1}`] = talent.name;
  });

  return generateTemplateMetaDescriptions(
    talentsForType.length === 3
      ? 'PilotTalentType_Meta_Description_3'
      : 'PilotTalentType_Meta_Description_More',
    embeds,
    `${defaultName}: View detailed information.`
  );
}

/** Robot platform: name and type (Mech / Titan). */
export function generateRobotLocalizedMetaDescriptions(
  robot: VirtualBot,
  defaultName: string
): LocalizedDescription[] {
  return generateTemplateMetaDescriptions(
    'Robot_Meta_Description',
    {
      robot_name: robot.name,
      robot_type: resolveLocalizationKey(robot.character_type, 'Web_UI'),
    },
    `${defaultName}: View detailed robot information and core modules.`
  );
}

/** Currency: name and in-game description. */
export function generateCurrencyLocalizedMetaDescriptions(
  currency: Currency,
  defaultName: string
): LocalizedDescription[] {
  return generateTemplateMetaDescriptions(
    'Currency_Meta_Description_With_Description',
    { name: currency.name, description: currency.description },
    `${defaultName}: View detailed information about this currency in War Robots Frontiers.`
  );
}

/** Character preset: name and character type. */
export function generateCharacterPresetLocalizedMetaDescriptions(
  preset: CharacterPreset,
  defaultName: string
): LocalizedDescription[] {
  return generateTemplateMetaDescriptions(
    'CharacterPreset_Meta_Description',
    {
      preset_name: preset.name,
      character_type: resolveLocalizationKey(preset.character_type, 'Web_UI'),
    },
    `${defaultName}: View detailed character preset information and modules.`
  );
}

/** Character class: name and in-game description. */
export function generateCharacterClassLocalizedMetaDescriptions(
  characterClass: CharacterClass,
  defaultName: string
): LocalizedDescription[] {
  return generateTemplateMetaDescriptions(
    'CharacterClass_Meta_Description',
    { name: characterClass.name, description: characterClass.description },
    `${defaultName}: View detailed information about this character class in War Robots Frontiers.`
  );
}
