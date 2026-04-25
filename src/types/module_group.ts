import type { ParseObject } from './parse_object';
import type { LocalizationKey } from './localization';

export const MODULEGROUP_URL = 'module_groups';

export interface ModuleGroup extends ParseObject {
  parseObjectClass: 'ModuleGroup';
  parseObjectUrl: typeof MODULEGROUP_URL;
  id: string; // e.g. "titan-chassis"
  name: LocalizationKey; // e.g. "Titan Chassis"
  description?: LocalizationKey;
  sort_order: number;
  titan: boolean;
}
