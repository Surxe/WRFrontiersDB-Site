import type { ParseObject } from './parse_object';

export const CHARACTER_MODULE_URL = 'character_modules';

export interface CharacterModule extends ParseObject {
  parseObjectClass: 'CharacterModule';
  parseObjectUrl: typeof CHARACTER_MODULE_URL;
  id: string;
  module_scalar?: {
    module_name?: string;
    default_scalars?: Record<string, unknown>;
  };
  abilities_refs?: string[];
}
