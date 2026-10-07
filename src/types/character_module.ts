import type { ParseObject } from './parse_object';

export interface CharacterModule extends ParseObject {
  parseObjectClass: 'CharacterModule';
  id: string;
  module_scalar?: {
    module_name?: string;
    default_scalars?: Record<string, unknown>;
  };
  abilities_refs?: string[];
  /** The module's meshes; `armor_zone` is the ArmorZone id the mesh's hits go to. */
  meshes?: Array<{
    component_class?: string;
    mesh_path?: string;
    armor_zone?: string;
  }>;
}
