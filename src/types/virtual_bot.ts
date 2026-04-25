import type { ParseObject } from './parse_object';
import type { LocalizationKey } from './localization';

export const VIRTUALBOT_URL = 'robots';

export interface VirtualBot extends ParseObject {
  parseObjectClass: 'VirtualBot';
  parseObjectUrl: typeof VIRTUALBOT_URL;
  id: string; // slugified bot ID for URLs (e.g. "ares")
  name: LocalizationKey; // localized name (e.g. "Ares")
  character_type: string;
  core_module_refs: string[]; // references to Torso, Chassis, Shoulder modules
  factory_preset_refs: string[]; // references to CharacterPresets
  has_distinct_shoulders: boolean;
  icon_path?: string; // icon path from factory preset
}
