import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';
import type { Color } from './color';

export interface ModuleTag extends ParseObject {
  parseObjectClass: 'ModuleTag';
  id: string;
  name: LocalizationKey;
  text_color: Color;
  background_color: Color;
}
