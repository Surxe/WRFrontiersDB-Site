import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export const CHARACTERPRESET_URL = 'character_presets';

export interface CharacterPresetModule {
  module_ref: string;
  parent_socket_name: string | null;
  level: number;
}

export interface CharacterPreset extends ParseObject {
  parseObjectClass: 'CharacterPreset';
  parseObjectUrl: typeof CHARACTERPRESET_URL;
  name: LocalizationKey;
  modules: Record<string, CharacterPresetModule>;
  pilot_ref: string;
  is_factory_preset: boolean;
  character_type: string;
}
