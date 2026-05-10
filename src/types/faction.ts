import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';
import type { Color } from './color';

export interface Faction extends ParseObject {
  parseObjectClass: 'Faction';
  image_path: string;
  color: Color;
  badge: {
    image_path: string;
    color: Color;
  };
  name: LocalizationKey;
}
