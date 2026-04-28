import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export const CHARACTERPRESET_URL = 'character_presets'; // Keep for backwards compatibility, actual URLs are factory_bots and ai_bots

export interface CharacterPresetModule {
  module_ref: string;
  socket_name: string;
  parent_socket_index: number;
  level: number;
}

export interface CharacterPreset extends ParseObject {
  parseObjectClass: 'CharacterPreset';
  parseObjectUrl: typeof CHARACTERPRESET_URL;
  icon?: string;
  name: LocalizationKey;
  modules: CharacterPresetModule[];
  pilot: {
    pilot_ref: string;
    level?: number;
  };
  is_factory_preset: boolean;
  character_type: string;
  weapon_module_ref?: string;
}
