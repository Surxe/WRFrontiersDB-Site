import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export const ABILITY_URL = 'abilities';

export interface Ability extends ParseObject {
  parseObjectClass: 'Ability';
  parseObjectUrl: typeof ABILITY_URL;
  id: string;
  name?: LocalizationKey;
  description?: LocalizationKey;
}
