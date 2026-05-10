import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';


export interface CharacterPresetModule {
  module_ref: string;
  socket_name: string;
  parent_socket_index: number;
  level: number;
}

export interface CharacterPreset extends ParseObject {
  parseObjectClass: 'CharacterPreset';
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
