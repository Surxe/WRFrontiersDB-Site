import type { BreadcrumbTrail } from '../types/breadcrumb';
import { getDefaultString } from './localization';
import type { Module, ModuleCategory } from '../types/module';
import type {
  Pilot,
  PilotClass,
  PilotPersonality,
  PilotTalent,
  PilotTalentType,
} from '../types/pilot';
import type { CharacterPreset } from '../types/character_preset';
import { MODULE_GROUPS } from './module_group_mapping';

/**
 * Generate breadcrumb trail for home page
 */
export function getHomeBreadcrumbs(): BreadcrumbTrail {
  return [
    {
      label: 'Home',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Module Groups',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Module Groups',
      href: '/module_groups',
      isCurrent: false,
    },
    {
      label: 'Modules',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Module Groups',
      href: '/module_groups',
      isCurrent: false,
    },
    {
      label: 'Modules',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Module Groups',
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
  const group = MODULE_GROUPS[groupId as keyof typeof MODULE_GROUPS];
  const groupName = getDefaultString(group?.name) || groupId;

  return [
    {
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Module Groups',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Pilots',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Pilots',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Pilots',
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: 'Pilot Classes',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Pilots',
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: 'Pilot Classes',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Pilots',
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: 'Pilot Personalities',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Pilots',
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: 'Pilot Personalities',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Pilots',
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: 'Pilot Talent Types',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Pilots',
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: 'Pilot Talent Types',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Pilots',
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: 'Pilot Talents',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Pilots',
      href: '/pilots',
      isCurrent: false,
    },
    {
      label: 'Pilot Talents',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'AI Bots',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Factory Bots',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: preset?.is_factory_preset ? 'Factory Bots' : 'AI Bots',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'AI Bots',
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
      label: 'Home',
      href: '/',
      isCurrent: false,
    },
    {
      label: 'Factory Bots',
      href: '/factory_bots',
      isCurrent: true,
    },
  ];
}
