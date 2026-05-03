import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export const CHARACTERCLASS_URL = 'character_classes';

// CharacterClass descriptions use a different format than standard LocalizationKey
export interface CharacterClassDescription {
  TableId?: string;
  Key?: string;
  SourceString?: string;
  LocalizedString?: string;
}

export interface CharacterClass extends ParseObject {
  parseObjectClass: 'CharacterClass';
  parseObjectUrl: typeof CHARACTERCLASS_URL;
  name: LocalizationKey;
  description: CharacterClassDescription;
  badge: {
    image_path: string;
    hex: string;
  };
  image_big_path: string;
  image_small_path: string;
}
