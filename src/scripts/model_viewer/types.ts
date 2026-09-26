/**
 * Geometry-schema types for the model viewer.
 *
 * These mirror the parser's `Models/<CharacterModuleId>.json` export (bones,
 * sockets, collision primitives and untextured meshes) — geometry the site's
 * `src/types/*` ParseObject models do not describe. The object-table shapes the
 * viewer reads (Module / CharacterPreset / VirtualBot) are imported from
 * `src/types/*` rather than redefined here.
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
