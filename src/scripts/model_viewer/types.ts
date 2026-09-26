/**
 * Data-schema types for the model viewer.
 *
 * These mirror the parser's `Models/<CharacterModuleId>.json` schema plus the
 * subset of the object tables (Module / CharacterModule / CharacterPreset /
 * VirtualBot) the viewer reads. They are intentionally separate from the site's
 * `src/types/*` ParseObject models: those describe the fully-parsed site data,
 * while these describe the raw per-module model exports the viewer fetches at
 * runtime.
 */

export type Vec3 = [number, number, number];

export interface Bone {
  name: string;
  parent: number;
  pos: Vec3;
  rot: [number, number, number, number];
  scale?: Vec3;
}

export interface Socket {
  name: string;
  bone: number;
  loc: Vec3;
  rot: [number, number, number];
}

export interface Adapter {
  mount_way: string;
  offset: Vec3 | null;
}

export interface Capsule {
  bone: number;
  center: Vec3;
  rot: [number, number, number];
  radius: number;
  length: number;
}

export interface Box {
  bone: number;
  center: Vec3;
  rot: [number, number, number];
  extent: Vec3;
}

export interface Sphere {
  bone: number;
  center: Vec3;
  radius: number;
}

export interface ModelMesh {
  asset: string;
  verts: number[];
  indices: number[];
  num_tris: number;
}

export interface ModuleModel {
  version: number;
  id: string;
  source?: string;
  coordinate_system?: string;
  bounds?: unknown;
  bones: Bone[];
  sockets: Socket[];
  adapters: Adapter[];
  capsules: Capsule[];
  boxes: Box[];
  spheres: Sphere[];
  meshes: ModelMesh[];
}

export interface PresetModule {
  module_ref: string;
  socket_name: string | null;
  parent_socket_index: number;
  level?: number;
}

export interface CharacterPreset {
  id: string;
  modules?: PresetModule[];
  name?: { Key?: string };
}

export interface ModuleSocketDef {
  name: string;
  socket_type_ref: string;
  mount_way?: string;
}

export interface ModuleMount {
  mount?: string;
  character_module_ref?: string;
}

export interface Module {
  id: string;
  sockets?: ModuleSocketDef[];
  character_module_mounts?: ModuleMount[];
  module_type_ref?: string;
}

export interface VirtualBot {
  id: string;
  name?: { Key?: string };
  factory_preset_refs?: string[];
}

export type ObjectTable<T> = Record<string, T>;
