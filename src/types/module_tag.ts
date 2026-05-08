import type { LocalizationKey } from './localization';
import type { ParseObject } from './parse_object';

export interface ModuleTag extends ParseObject {
  parseObjectClass: 'ModuleTag';
  id: string;
  name: LocalizationKey;
  text_color: {
    RGBA: {
      R: number;
      G: number;
      B: number;
      A: number;
    };
    Hex: string;
  };
  background_color: {
    RGBA: {
      R: number;
      G: number;
      B: number;
      A: number;
    };
    Hex: string;
  };
}
