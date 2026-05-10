import type { ParseObject } from './parse_object';
import type { LocalizationKey } from './localization';

export interface VirtualBot extends ParseObject {
  parseObjectClass: 'VirtualBot';
  id: string;
  name: LocalizationKey;
  character_type: string[];
  factory_preset_refs: string[];
  has_distinct_shoulders: boolean;
  icon_path?: string;
}
