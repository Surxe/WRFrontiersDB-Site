import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export interface ModuleTag extends ParseObject {
  parseObjectClass: 'ModuleTag';
  id: string;
  name: LocalizationKey;
  text_hex: string;
  background_hex: string;
}
