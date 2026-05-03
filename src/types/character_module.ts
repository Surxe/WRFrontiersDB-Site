import type { ParseObject } from './parse_object';

export interface CharacterModule extends ParseObject {
  parseObjectClass: 'CharacterModule';
  id: string;
  module_scalar?: {
    module_name?: string;
    default_scalars?: Record<string, unknown>;
  };
  abilities_refs?: string[];
}
