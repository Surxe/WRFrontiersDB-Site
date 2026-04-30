import type { BreadcrumbTrail } from '../types/breadcrumb';
import type { LocalizationKey } from '../types/localization';
import { getDefaultString, resolveLocalizationKey } from './localization';
import type { Module, ModuleCategory } from '../types/module';
import type {
  Pilot,
  PilotClass,
  PilotPersonality,
  PilotTalent,
  PilotTalentType,
} from '../types/pilot';
import type { CharacterPreset } from '../types/character_preset';
import { getParseObject } from './parse_object';

/**
 * Generate breadcrumb trail for home page
 */
export function getHomeBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for module groups page
 */
export function getModuleGroupsBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Module_Groups', 'Web_UI'),
      href: '/module_groups',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for modules page
 */
export function getModulesBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Module_Groups', 'Web_UI'),
      href: '/module_groups',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Modules', 'Web_UI'),
      href: '/modules',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for module detail page
 */
export function getModuleDetailBreadcrumbs(module: Module): BreadcrumbTrail {
  const moduleName = getDefaultString(module.name) || module.id;

  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Module_Groups', 'Web_UI'),
      href: '/module_groups',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Modules', 'Web_UI'),
      href: '/modules',
      isCurrent: false,
    },
    {
      label: moduleName,
      href: undefined,
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for module category detail page
 */
export function getModuleCategoryDetailBreadcrumbs(
  category: ModuleCategory
): BreadcrumbTrail {
  const categoryName = getDefaultString(category.name) || category.id;

  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Module_Groups', 'Web_UI'),
      href: '/module_groups',
      isCurrent: false,
    },
    {
      label: categoryName,
      href: undefined,
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for module group detail page
 */
export function getModuleGroupDetailBreadcrumbs(
  groupId: string
): BreadcrumbTrail {
  let groupName = groupId;
  try {
    const group = getParseObject(groupId, 'Objects/ModuleGroup.json');
    groupName =
      getDefaultString(group?.name as LocalizationKey | undefined) || groupId;
  } catch {
    // Group not found, use default groupId
  }

  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Module_Groups', 'Web_UI'),
      href: '/module_groups',
      isCurrent: false,
    },
    {
      label: groupName,
      href: undefined,
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for pilots page
 */
export function getPilotsBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilots', 'Web_UI'),
      href: '/pilots',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for pilot detail page
 */
export function getPilotDetailBreadcrumbs(pilot: Pilot): BreadcrumbTrail {
  const pilotName = getDefaultString(pilot.first_name) || pilot.id;

  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilots', 'Web_UI'),
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: pilotName,
      href: undefined,
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for pilot classes page
 */
export function getPilotClassesBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilots', 'Web_UI'),
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilot_Classes', 'Web_UI'),
      href: '/pilot_classes',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for pilot class detail page
 */
export function getPilotClassDetailBreadcrumbs(
  pilotClass: PilotClass
): BreadcrumbTrail {
  const className = getDefaultString(pilotClass.name) || pilotClass.id;

  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilots', 'Web_UI'),
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilot_Classes', 'Web_UI'),
      href: '/pilot_classes',
      isCurrent: false,
    },
    {
      label: className,
      href: undefined,
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for pilot personalities page
 */
export function getPilotPersonalitiesBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilots', 'Web_UI'),
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilot_Personalities', 'Web_UI'),
      href: '/pilot_personalities',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for pilot personality detail page
 */
export function getPilotPersonalityDetailBreadcrumbs(
  personality: PilotPersonality
): BreadcrumbTrail {
  const personalityName = getDefaultString(personality.name) || personality.id;

  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilots', 'Web_UI'),
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilot_Personalities', 'Web_UI'),
      href: '/pilot_personalities',
      isCurrent: false,
    },
    {
      label: personalityName,
      href: undefined,
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for pilot talent types page
 */
export function getPilotTalentTypesBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilots', 'Web_UI'),
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilot_Talent_Types', 'Web_UI'),
      href: '/pilot_talent_types',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for pilot talent type detail page
 */
export function getPilotTalentTypeDetailBreadcrumbs(
  talentType: PilotTalentType
): BreadcrumbTrail {
  const talentTypeName = getDefaultString(talentType.name) || talentType.id;

  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilots', 'Web_UI'),
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilot_Talent_Types', 'Web_UI'),
      href: '/pilot_talent_types',
      isCurrent: false,
    },
    {
      label: talentTypeName,
      href: undefined,
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for pilot talents page
 */
export function getPilotTalentsBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilots', 'Web_UI'),
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilot_Talents', 'Web_UI'),
      href: '/pilot_talents',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for pilot talent detail page
 */
export function getPilotTalentDetailBreadcrumbs(
  talent: PilotTalent
): BreadcrumbTrail {
  const talentName = getDefaultString(talent.name) || talent.id;

  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilots', 'Web_UI'),
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Pilot_Talents', 'Web_UI'),
      href: '/pilot_talents',
      isCurrent: false,
    },
    {
      label: talentName,
      href: undefined,
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for bot presets list page
 */
export function getBotPresetsBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_AI_Bots', 'Web_UI'),
      href: '/ai_bots',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for factory presets list page
 */
export function getFactoryPresetsBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Factory_Bots', 'Web_UI'),
      href: '/factory_bots',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for character preset detail page
 */
export function getCharacterPresetDetailBreadcrumbs(
  preset: CharacterPreset | undefined
): BreadcrumbTrail {
  const presetName = preset
    ? getDefaultString(preset.name) || preset.id
    : 'Unknown Preset';

  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Bots',
      href: '/bots',
      isCurrent: false,
    },
    {
      label: preset?.is_factory_preset
        ? resolveLocalizationKey('Breadcrumb_Factory_Bots', 'Web_UI')
        : resolveLocalizationKey('Breadcrumb_AI_Bots', 'Web_UI'),
      href: preset?.is_factory_preset ? '/factory_bots' : '/ai_bots',
      isCurrent: false,
    },
    {
      label: presetName,
      href: undefined,
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for AI bots page
 */
export function getAiBotsBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Bots',
      href: '/bots',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_AI_Bots', 'Web_UI'),
      href: '/ai_bots',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for factory bots page
 */
export function getFactoryBotsBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Bots',
      href: '/bots',
      isCurrent: false,
    },
    {
      label: resolveLocalizationKey('Breadcrumb_Factory_Bots', 'Web_UI'),
      href: '/factory_bots',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for bots page
 */
export function getBotsBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Bots',
      href: '/bots',
      isCurrent: true,
    },
  ];
}

/**
 * Generate breadcrumb trail for robots page
 */
export function getRobotsBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: resolveLocalizationKey('Breadcrumb_Home', 'Web_UI'),
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Bots',
      href: '/bots',
      isCurrent: false,
    },
    {
      label: 'Robots',
      href: '/robots',
      isCurrent: true,
    },
  ];
}
