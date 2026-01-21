import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export interface Rarity extends ParseObject {
  parseObjectClass: 'Rarity';
  id: string;
  name: LocalizationKey;
  hex: string;
}
