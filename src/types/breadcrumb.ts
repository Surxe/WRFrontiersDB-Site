export interface BreadcrumbItem {
  label: string; // Display text (localized)
  href?: string; // URL (undefined for current page)
  isCurrent: boolean; // true for current page
}

export type BreadcrumbTrail = BreadcrumbItem[];

export interface BreadcrumbConfig {
  // Module hierarchy
  moduleCategories: BreadcrumbItem[];
  modules: (_category?: unknown) => BreadcrumbTrail;
  moduleDetail: (_module: unknown, _category?: unknown) => BreadcrumbTrail;

  // Module groups (separate hierarchy)
  moduleGroups: BreadcrumbItem[];
  moduleGroupDetail: (_groupId: string) => BreadcrumbTrail;

  // Pilot hierarchy
  pilots: BreadcrumbItem[];
  pilotDetail: (_pilot: unknown) => BreadcrumbTrail;
  pilotClasses: BreadcrumbItem[];
  pilotClassDetail: (_pilotClass: unknown) => BreadcrumbTrail;
  pilotPersonalities: BreadcrumbItem[];
  pilotPersonalityDetail: (_personality: unknown) => BreadcrumbTrail;
  pilotTalentTypes: BreadcrumbItem[];
  pilotTalentTypeDetail: (_talentType: unknown) => BreadcrumbTrail;
  pilotTalents: BreadcrumbItem[];
  pilotTalentDetail: (_talent: unknown) => BreadcrumbTrail;
}
