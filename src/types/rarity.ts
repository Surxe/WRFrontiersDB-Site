import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export const RARITY_URL = 'rarities';

export interface Rarity extends ParseObject {
  parseObjectClass: 'Rarity';
  parseObjectUrl: typeof RARITY_URL;
  id: string;
  name: LocalizationKey;
  hex: string;
}
