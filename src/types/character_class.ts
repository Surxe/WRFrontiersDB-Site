import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';
import type { Color } from './color';

export const CHARACTERCLASS_URL = 'character_classes';

export interface CharacterClass extends ParseObject {
  parseObjectClass: 'CharacterClass';
  parseObjectUrl: typeof CHARACTERCLASS_URL;
  name: LocalizationKey;
  description: LocalizationKey;
  badge: {
    image_path: string;
    color: Color;
  };
  image_big_path: string;
  image_small_path: string;
}
