import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';
import type { Color } from './color';

export interface Rarity extends ParseObject {
  parseObjectClass: 'Rarity';
  id: string;
  name: LocalizationKey;
  color: Color;
}
