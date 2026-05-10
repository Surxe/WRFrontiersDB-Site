import type { ParseObject } from './parse_object';
import type { LocalizationKey } from './localization';


export interface ModuleGroup extends ParseObject {
  parseObjectClass: 'ModuleGroup';
  id: string; // e.g. "titan-chassis"
  name: LocalizationKey; // e.g. "Titan Chassis"
  description?: LocalizationKey;
  sort_order: number;
  titan: boolean;
}
