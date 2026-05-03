import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export interface Ability extends ParseObject {
  parseObjectClass: 'Ability';
  id: string;
  name?: LocalizationKey;
  description?: LocalizationKey;
}
