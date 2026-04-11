import type { LocalizationKey } from './localization';

export interface BreadcrumbItem {
  label: string;           // Display text (localized)
  href?: string;          // URL (undefined for current page)
  isCurrent: boolean;    // true for current page
}

export type BreadcrumbTrail = BreadcrumbItem[];

export interface BreadcrumbConfig {
  // Module hierarchy
  moduleCategories: BreadcrumbItem[];
  modules: (category?: any) => BreadcrumbTrail;
  moduleDetail: (module: any, category?: any) => BreadcrumbTrail;
  
  // Module groups (separate hierarchy)
  moduleGroups: BreadcrumbItem[];
  moduleGroupDetail: (groupId: string) => BreadcrumbTrail;
  
  // Pilot hierarchy
  pilots: BreadcrumbItem[];
  pilotDetail: (pilot: any) => BreadcrumbTrail;
  pilotClasses: BreadcrumbItem[];
  pilotClassDetail: (pilotClass: any) => BreadcrumbTrail;
  pilotPersonalities: BreadcrumbItem[];
  pilotPersonalityDetail: (personality: any) => BreadcrumbTrail;
  pilotTalentTypes: BreadcrumbItem[];
  pilotTalentTypeDetail: (talentType: any) => BreadcrumbTrail;
  pilotTalents: BreadcrumbItem[];
  pilotTalentDetail: (talent: any) => BreadcrumbTrail;
}
