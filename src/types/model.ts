// Geometry schema for the parser's `Models/<CharacterModuleId>.json` export
// (bones, sockets, collision primitives and untextured meshes). Unlike the
// other files here these are not ParseObjects — they describe the raw per-module
// model files the 3D viewer fetches at runtime, not the parsed site data.
//
// UE conventions throughout: centimeters, X forward / Y right / Z up.

export type Vec3 = [number, number, number];

/** Quaternion `[x, y, z, w]`. */
export type Quat = [number, number, number, number];

/** UE FRotator in degrees: `[pitch, yaw, roll]`. */
export type Rotator = [number, number, number];

/** Mount way an adapter serves. Per-side (mirrored) light weapons carry Left
 * and Right adapters; centered titan weapons only Standard. */
export type AdapterMountWay = 'Standard' | 'Left' | 'Right';

export interface Bone {
  name: string;
  /** Index of the parent bone (always before this one), or -1 for a root. */
  parent: number;
  pos: Vec3;
  rot: Quat;
  scale?: Vec3;
}

export interface Socket {
  name: string;
  bone: number;
  loc: Vec3;
  rot: Rotator;
}

export interface Adapter {
  mount_way: AdapterMountWay;
  offset: Vec3 | null;
}

/** Health pool (armor zone) id of the component a primitive or mesh belongs
 * to, e.g. `DA_ArmorZone_LeftLeg.0`. Absent when the component links none
 * (weapons, which share their mount's pool). */
export type ArmorZoneId = string;

export interface Capsule {
  bone: number;
  armor_zone?: ArmorZoneId;
  center: Vec3;
  rot: Rotator;
  radius: number;
  length: number;
}

export interface Box {
  bone: number;
  armor_zone?: ArmorZoneId;
  center: Vec3;
  rot: Rotator;
  /** Full box dimensions (UE `FKBoxElem` X/Y/Z), not half extents. */
  extent: Vec3;
}

export interface Sphere {
  bone: number;
  armor_zone?: ArmorZoneId;
  center: Vec3;
  radius: number;
}

export interface ModelMesh {
  asset: string;
  /** Flat `[x, y, z, ...]` vertex positions in component space. */
  verts: number[];
  indices: number[];
  num_tris: number;
  armor_zone?: ArmorZoneId;
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
