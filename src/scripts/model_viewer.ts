/**
 * Live 3D construction of hitbox + untextured module models.
 *
 * Loads per-module model JSONs (current/Models/<CharacterModuleId>.json) plus
 * the mount-graph tables, resolves the module world transforms (preset socket
 * chain + adapter offsets + the runtime mount roll), and renders shoulder +
 * weapon combinations in three.js.
 *
 * Mount resolution mirrors WRFrontiersDB-Models (wrf_models/combine.py):
 *   world(module) = world(parent) x socketFrame(parent, socketName)
 *                   x T(adapterOffset) x R(mountRoll)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// Types (mirror of the parser's Models/<id>.json schema)
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];
interface Bone {
  name: string;
  parent: number;
  pos: Vec3;
  rot: [number, number, number, number];
  scale?: Vec3;
}
interface Socket {
  name: string;
  bone: number;
  loc: Vec3;
  rot: [number, number, number];
}
interface Adapter {
  mount_way: string;
  offset: Vec3 | null;
}
interface Capsule {
  bone: number;
  center: Vec3;
  rot: [number, number, number];
  radius: number;
  length: number;
}
interface Box {
  bone: number;
  center: Vec3;
  rot: [number, number, number];
  extent: Vec3;
}
interface Sphere {
  bone: number;
  center: Vec3;
  radius: number;
}
interface ModelMesh {
  asset: string;
  verts: number[];
  indices: number[];
  num_tris: number;
}
interface ModuleModel {
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

interface PresetModule {
  module_ref: string;
  socket_name: string | null;
  parent_socket_index: number;
  level?: number;
}
interface CharacterPreset {
  id: string;
  modules?: PresetModule[];
  name?: { Key?: string };
}
interface ModuleSocketDef {
  name: string;
  socket_type_ref: string;
  mount_way?: string;
}
interface ModuleMount {
  mount?: string;
  character_module_ref?: string;
}
interface Module {
  id: string;
  sockets?: ModuleSocketDef[];
  character_module_mounts?: ModuleMount[];
  module_type_ref?: string;
}
interface VirtualBot {
  id: string;
  name?: { Key?: string };
  factory_preset_refs?: string[];
}
type ObjectTable<T> = Record<string, T>;

/** Runtime mount correction applied to a mounted weapon, keyed by socket type
 * ("Weapon" / "WeaponHeavy") then mount way ("Left" / "Right" / "Standard").
 * The game applies this at runtime and does not serialize it (see the models
 * repo docs/weapon_mount_findings.md). Mirrored LIGHT weapons (Left/Right
 * adapters) sit on the hardpoint bone with a roll about the weapon long axis
 * (-90 right / +90 left mirror); single TITAN weapons (Standard adapter only)
 * mount centered and are dialled in under "Standard". */
interface MountConv {
  pitch_deg?: number;
  yaw_deg?: number;
  roll_deg?: number;
  offset?: Vec3;
}
const MOUNT_ORIENTATION: Record<string, Record<string, MountConv>> = {
  Weapon: {
    Right: { roll_deg: -90 },
    Left: { roll_deg: 90 },
    Standard: { roll_deg: 0, offset: [0, 0, 0] },
  },
  WeaponHeavy: {
    Right: { roll_deg: -90 },
    Left: { roll_deg: 90 },
    Standard: { roll_deg: 0, offset: [0, 0, 0] },
  },
};
/** Only the Standard adapter offset belongs to the weapon root (titan/centered);
 * Left/Right offsets belong to the unrendered adapter mesh. */
const APPLY_ADAPTER_OFFSET = true;

/** A few bots have a weapon whose shoulder hardpoint bone carries a rotation the
 * game corrects at runtime but the export does not -- the weapon ends up oriented
 * inconsistently with its siblings. A sagittal mirror of the other shoulder only
 * negates yaw (Z), not roll (X), so it can't express these uniformly; instead we
 * override the weapon's final world ROTATION (position kept). Values are FRotator
 * [pitch, yaw, roll] in robot space, verified in-view. Keyed by
 * `${parentShoulderModelId}|${weaponSocket}`. */
const WEAPON_ROTATION_OVERRIDE: Record<string, Vec3> = {
  'BP_Module_Garuda_ShoulderL.0|Shoulder_Weapon_1': [0, 0, 90],
  'BP_Module_Norna_ShoulderR.0|Shoulder_Weapon_0': [0, 28, 0],
  'BP_Module_Spire_ShoulderR.0|Shoulder_Weapon_0': [0, 28, 0],
};

// ---------------------------------------------------------------------------
// 4x4 matrix math (UE conventions: cm, X fwd / Y right / Z up)
// ---------------------------------------------------------------------------

type Mat4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
];

const IDENTITY: Mat4 = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

function mmul(a: Mat4, b: Mat4): Mat4 {
  const out = IDENTITY.map(() => [0, 0, 0, 0]) as Mat4;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[i][k] * b[k][j];
      out[i][j] = s;
    }
  }
  return out;
}

function mapply(m: Mat4, p: Vec3): [number, number, number] {
  return [
    m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2] + m[0][3],
    m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2] + m[1][3],
    m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2] + m[2][3],
  ];
}

function quatToMat(
  q: [number, number, number, number],
  pos: Vec3,
  scale: Vec3 = [1, 1, 1],
): Mat4 {
  let [x, y, z, w] = q;
  const n = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
  x /= n; y /= n; z /= n; w /= n;
  const [sx, sy, sz] = scale;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  return [
    [(1 - 2 * (yy + zz)) * sx, (2 * (xy - wz)) * sy, (2 * (xz + wy)) * sz, pos[0]],
    [(2 * (xy + wz)) * sx, (1 - 2 * (xx + zz)) * sy, (2 * (yz - wx)) * sz, pos[1]],
    [(2 * (xz - wy)) * sx, (2 * (yz + wx)) * sy, (1 - 2 * (xx + yy)) * sz, pos[2]],
    [0, 0, 0, 1],
  ];
}

/** UE FRotator (deg) + translation -> 4x4. R = Rz(yaw) @ Ry(pitch) @ Rx(roll). */
function eulerMat(
  pitch: number,
  yaw: number,
  roll: number,
  center: Vec3 = [0, 0, 0],
): Mat4 {
  const d = Math.PI / 180;
  const p = pitch * d, y = yaw * d, r = roll * d;
  const cp = Math.cos(p), sp = Math.sin(p);
  const cy = Math.cos(y), sy = Math.sin(y);
  const cr = Math.cos(r), sr = Math.sin(r);
  const rz = [[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]];
  const ry = [[cp, 0, sp], [0, 1, 0], [-sp, 0, cp]];
  const rx = [[1, 0, 0], [0, cr, -sr], [0, sr, cr]];
  const mul3 = (a: number[][], b: number[][]) =>
    a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
  const r3 = mul3(rz, mul3(ry, rx));
  return [
    [r3[0][0], r3[0][1], r3[0][2], center[0]],
    [r3[1][0], r3[1][1], r3[1][2], center[1]],
    [r3[2][0], r3[2][1], r3[2][2], center[2]],
    [0, 0, 0, 1],
  ];
}

/** Bone reference-pose world matrices. rootIdentity=true forces root bones
 * (parent < 0) to identity, giving the mesh's component space (root at origin).
 * Some skeletons (e.g. Alpha torso) bake the module's mount height into the root
 * bone while the mesh stays root-relative; hitboxes ride the mesh, so they must
 * use this normalized frame or they get lifted twice. No-op when roots are at
 * the origin. Mount resolution (socketFrame) must NOT normalize — it uses the
 * skeleton frame the child module attaches to. */
function boneWorlds(bones: Bone[], rootIdentity = false): Mat4[] {
  const world: Mat4[] = new Array(bones.length);
  bones.forEach((bone, i) => {
    if (bone.parent < 0) {
      world[i] = rootIdentity ? IDENTITY : quatToMat(bone.rot, bone.pos, bone.scale ?? [1, 1, 1]);
    } else {
      world[i] = mmul(world[bone.parent], quatToMat(bone.rot, bone.pos, bone.scale ?? [1, 1, 1]));
    }
  });
  return world;
}

function toThree(m: Mat4): THREE.Matrix4 {
  const t = new THREE.Matrix4();
  t.set(
    m[0][0], m[0][1], m[0][2], m[0][3],
    m[1][0], m[1][1], m[1][2], m[1][3],
    m[2][0], m[2][1], m[2][2], m[2][3],
    m[3][0], m[3][1], m[3][2], m[3][3],
  );
  return t;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

const cache = new Map<string, Promise<unknown>>();

function fetchJSON<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached) return cached as Promise<T>;
  const promise = fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json() as Promise<T>;
    });
  cache.set(path, promise);
  return promise;
}

function refToId(ref: string): string {
  return ref.includes('::') ? ref.split('::')[1] : ref;
}

// ---------------------------------------------------------------------------
// Mount resolution (port of wrf_models/combine.py)
// ---------------------------------------------------------------------------

function modelIdForModule(
  moduleId: string,
  modules: ObjectTable<Module>,
  charModules: ObjectTable<unknown>,
  mountWay?: string | null,
): string | null {
  const module = modules[moduleId];
  if (!module) return null;
  const mounts = module.character_module_mounts ?? [];
  for (const mount of mounts) {
    if (mountWay != null && mount.mount === mountWay) {
      const id = refToId(mount.character_module_ref ?? '');
      if (id && charModules[id]) return id;
    }
  }
  for (const mount of mounts) {
    const id = refToId(mount.character_module_ref ?? '');
    if (id && charModules[id]) return id;
  }
  return null;
}

function socketTypeOf(
  moduleId: string,
  socketName: string,
  modules: ObjectTable<Module>,
): 'Weapon' | 'WeaponHeavy' | null {
  const module = modules[moduleId];
  if (!module) return null;
  for (const sock of module.sockets ?? []) {
    if (sock.name !== socketName) continue;
    const ref = refToId(sock.socket_type_ref ?? '');
    if (ref.includes('WeaponHeavy')) return 'WeaponHeavy';
    if (ref.includes('Weapon')) return 'Weapon';
  }
  return null;
}

function socketFrame(
  model: ModuleModel,
  socketName: string,
): Mat4 | null {
  // The torso mounts with preset socket_name "Root", but the actual chassis
  // attach point is the chassis "Torso" bone (see assemble_typhon.py). "Root"
  // is the chassis origin bone, which would sink the whole upper body ~750cm.
  const boneName = socketName === 'Root' ? 'Torso' : socketName;
  for (const sock of model.sockets ?? []) {
    if (sock.name === boneName) {
      return eulerMat(sock.rot[0], sock.rot[1], sock.rot[2], sock.loc);
    }
  }
  return mountBoneFrame(model, boneName);
}

/** World matrix of a mount bone in the parent's MESH (component) space. Some
 * exported skeletons bake the module's mount height into the root bone while the
 * mesh stays root-relative; using the baked (full) bone world for a child mount
 * then re-adds that height at every chain level (shoulders 2x, weapons 3x). Pick
 * whichever of the full or root-identity bone world lands inside the parent mesh
 * -- the space the child must align with. Identical when the root isn't baked. */
function mountBoneFrame(model: ModuleModel, boneName: string): Mat4 | null {
  const bones = model.bones ?? [];
  const idx = bones.findIndex((b) => b.name === boneName);
  if (idx < 0) return null;
  const full = boneWorlds(bones)[idx];
  const ident = boneWorlds(bones, true)[idx];
  if (full === ident) return full;
  const box = meshAabb(model);
  if (!box) return full;
  const pf: Vec3 = [full[0][3], full[1][3], full[2][3]];
  const pi: Vec3 = [ident[0][3], ident[1][3], ident[2][3]];
  return dist2ToBox(pi, box) < dist2ToBox(pf, box) ? ident : full;
}

/** Cosmetic FX/effect mesh components (SK_*_Effect / *_FX) are separate "Effect"
 * components in the module BP, not the visible body -- in-game they show only as
 * VFX, so they are excluded from the rendered model and mount-frame bounds. */
function isFxMesh(mesh: ModelMesh): boolean {
  const a = (mesh.asset ?? '').toLowerCase();
  return a.includes('effect') || a.includes('fx');
}

/** AABB of the model's mesh verts in component space (from verts, not the stored
 * bounds, which can disagree), or null when there is no geometry. */
function meshAabb(model: ModuleModel): [Vec3, Vec3] | null {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  let found = false;
  for (const mesh of model.meshes ?? []) {
    if (isFxMesh(mesh)) continue;
    const v = mesh.verts ?? [];
    for (let i = 0; i + 2 < v.length; i += 3) {
      found = true;
      for (let k = 0; k < 3; k++) {
        if (v[i + k] < lo[k]) lo[k] = v[i + k];
        if (v[i + k] > hi[k]) hi[k] = v[i + k];
      }
    }
  }
  return found ? [lo, hi] : null;
}

function dist2ToBox(p: Vec3, box: [Vec3, Vec3]): number {
  const [lo, hi] = box;
  let d = 0;
  for (let k = 0; k < 3; k++) {
    if (p[k] < lo[k]) d += (lo[k] - p[k]) ** 2;
    else if (p[k] > hi[k]) d += (p[k] - hi[k]) ** 2;
  }
  return d;
}

function isWeaponModule(moduleId: string, modules: ObjectTable<Module>): boolean {
  const module = modules[moduleId];
  if (!module?.module_type_ref) return false;
  return refToId(module.module_type_ref).includes('Weapon');
}

function adapterOffsetFor(model: ModuleModel, mountWay: string): Vec3 | null {
  for (const adapter of model.adapters ?? []) {
    if (adapter.mount_way === mountWay) return adapter.offset;
  }
  return null;
}

/** world's translation + a fresh rotation from FRotator [pitch, yaw, roll]. */
function withWorldRotation(world: Mat4, rot: Vec3): Mat4 {
  const r = eulerMat(rot[0], rot[1], rot[2]);
  return [
    [r[0][0], r[0][1], r[0][2], world[0][3]],
    [r[1][0], r[1][1], r[1][2], world[1][3]],
    [r[2][0], r[2][1], r[2][2], world[2][3]],
    [0, 0, 0, 1],
  ];
}

/** Left/Right for a weapon, from its parent shoulder's socket suffix, else null. */
function weaponMountSide(presetModules: PresetModule[], i: number): string | null {
  const parent = presetModules[i].parent_socket_index;
  if (parent < 0) return null;
  const ps = presetModules[parent].socket_name ?? '';
  if (ps.endsWith('_L')) return 'Left';
  if (ps.endsWith('_R')) return 'Right';
  return null;
}

/** The adapter mount way a weapon actually exposes for the given side: mirrored
 * light weapons carry per-side adapters, single titan weapons only Standard. */
function adapterMountWay(model: ModuleModel | undefined, side: string | null): string | null {
  if (!model) return side;
  const ways = new Set((model.adapters ?? []).map((a) => a.mount_way));
  if (side && ways.has(side)) return side;
  if (ways.has('Standard')) return 'Standard';
  return side;
}

function resolveWeaponModel(
  weaponName: string,
  modules: ObjectTable<Module>,
  charModules: ObjectTable<unknown>,
): string | null {
  const wanted = `Weapon_${weaponName}`;
  for (const moduleId of Object.keys(modules).sort()) {
    if (!moduleId.includes(wanted)) continue;
    const cmId = modelIdForModule(moduleId, modules, charModules);
    if (cmId) return cmId;
  }
  return null;
}

interface ModulePlacement {
  module_id: string;
  model_id: string | null;
  socket_name: string | null;
  parent_socket_index: number;
  world: Mat4;
}

function computeModuleWorlds(
  presetModules: PresetModule[],
  modules: ObjectTable<Module>,
  charModules: ObjectTable<unknown>,
  models: Map<string, ModuleModel>,
): ModulePlacement[] {
  const worlds: Mat4[] = new Array(presetModules.length);
  presetModules.forEach((entry, i) => {
    const parent = entry.parent_socket_index;
    const socketName = entry.socket_name;
    const moduleId = refToId(entry.module_ref);
    if (parent < 0 || !socketName) {
      worlds[i] = IDENTITY;
      return;
    }
    const parentEntry = presetModules[parent];
    const parentModuleId = refToId(parentEntry.module_ref);
    const parentSocket = parentEntry.socket_name ?? '';
    const parentWay = parentSocket.endsWith('_L')
      ? 'Left'
      : parentSocket.endsWith('_R')
        ? 'Right'
        : null;
    const parentModelId = modelIdForModule(parentModuleId, modules, charModules, parentWay);
    const parentModel = parentModelId ? models.get(parentModelId) : undefined;
    let local: Mat4 = parentModel && socketName
      ? socketFrame(parentModel, socketName) ?? IDENTITY
      : IDENTITY;

    let stype = socketTypeOf(parentModuleId, socketName, modules);
    const isWeapon = isWeaponModule(moduleId, modules);
    if (!stype && isWeapon) stype = 'Weapon'; // weapon on an untyped socket (Torso_Weapon_*)
    if (stype && MOUNT_ORIENTATION[stype] && isWeapon) {
      // Mirrored light weapons carry Left/Right adapters (use the parent shoulder
      // side); single titan weapons carry only Standard.
      const side = weaponMountSide(presetModules, i);
      const weaponModelId = modelIdForModule(moduleId, modules, charModules, side);
      const model = weaponModelId ? models.get(weaponModelId) : undefined;
      const mountWay = adapterMountWay(model, side);
      if (APPLY_ADAPTER_OFFSET && mountWay === 'Standard' && model) {
        const offset = adapterOffsetFor(model, 'Standard');
        if (offset) local = mmul(local, eulerMat(0, 0, 0, offset));
      }
      const conv =
        (mountWay ? MOUNT_ORIENTATION[stype][mountWay] : undefined) ??
        MOUNT_ORIENTATION[stype].Standard ??
        {};
      local = mmul(
        local,
        eulerMat(conv.pitch_deg ?? 0, conv.yaw_deg ?? 0, conv.roll_deg ?? 0, conv.offset ?? [0, 0, 0]),
      );
    }
    worlds[i] = mmul(worlds[parent], local);
  });

  // Post-pass: a few weapons have a hardpoint-bone rotation the game corrects at
  // runtime but the export does not (WEAPON_ROTATION_OVERRIDE). Set those weapons'
  // final world rotation directly, keeping their (correct) position.
  presetModules.forEach((entry, i) => {
    const parent = entry.parent_socket_index;
    const socketName = entry.socket_name;
    if (parent < 0 || !socketName || !worlds[i]) return;
    const parentEntry = presetModules[parent];
    const parentSocket = parentEntry.socket_name ?? '';
    const parentWay = parentSocket.endsWith('_L')
      ? 'Left'
      : parentSocket.endsWith('_R')
        ? 'Right'
        : null;
    const parentModelId = modelIdForModule(
      refToId(parentEntry.module_ref),
      modules,
      charModules,
      parentWay,
    );
    const rot = parentModelId ? WEAPON_ROTATION_OVERRIDE[`${parentModelId}|${socketName}`] : undefined;
    if (rot) {
      worlds[i] = withWorldRotation(worlds[i], rot);
    }
  });

  return presetModules.map((entry, i) => {
    // Per-side modules (e.g. shoulders) have separate Left/Right BPs under one
    // module id; resolve the render model for the module's own mount side so the
    // left shoulder does not render the right BP (its own socket suffix, matching
    // the Python pipeline's _mount_way_for). Weapons mount at "Shoulder_Weapon_*"
    // (no suffix) -> null, which keeps their existing default resolution.
    const socket = entry.socket_name ?? '';
    const side = socket.endsWith('_L') ? 'Left' : socket.endsWith('_R') ? 'Right' : null;
    return {
      module_id: refToId(entry.module_ref),
      model_id: modelIdForModule(refToId(entry.module_ref), modules, charModules, side),
      socket_name: entry.socket_name,
      parent_socket_index: entry.parent_socket_index,
      world: worlds[i],
    };
  });
}

// ---------------------------------------------------------------------------
// three.js scene building
// ---------------------------------------------------------------------------

const MODEL_COLORS = [
  0x9aa0a6, 0x4c8fd6, 0xd68a3c, 0x8a6bd6, 0x4cb08a, 0xd64c6b,
];

function buildCapsuleGeometry(radius: number, length: number): THREE.BufferGeometry {
  // Parametric capsule along local Z (UE convention), 24 segments x 10 rings.
  const segments = 24;
  const rings = 10;
  const positions: number[] = [];
  const indices: number[] = [];
  const half = length / 2;
  const rows: number[][] = [];
  for (let i = 0; i <= rings; i++) {
    const phi = -Math.PI / 2 + (Math.PI * i) / rings;
    const zc = Math.sin(phi) * radius;
    const rr = Math.cos(phi) * radius;
    const zoff = phi < 0 ? -half : half;
    const row: number[] = [];
    for (let j = 0; j < segments; j++) {
      const th = (2 * Math.PI * j) / segments;
      positions.push(Math.cos(th) * rr, Math.sin(th) * rr, zc + zoff);
      row.push(positions.length / 3 - 1);
    }
    rows.push(row);
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const j2 = (j + 1) % segments;
      const a = rows[i][j], b = rows[i][j2], c = rows[i + 1][j2], d = rows[i + 1][j];
      indices.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

function buildBoxGeometry(extent: Vec3): THREE.BufferGeometry {
  // UE FKBoxElem X/Y/Z are the box's FULL dimensions, which is exactly what
  // THREE.BoxGeometry expects (width/height/depth). (Capsules use radius/length.)
  return new THREE.BoxGeometry(extent[0], extent[1], extent[2]);
}

function addModel(
  group: THREE.Group,
  model: ModuleModel,
  world: Mat4,
  color: number,
  opts: { hitbox: boolean; skeleton: boolean },
  track: { geos: THREE.BufferGeometry[]; mats: THREE.Material[]; objs: THREE.Object3D[] },
): void {
  const worldMatrix = toThree(world);
  // Hitboxes + skeleton overlay share the mesh's component space (root at origin).
  const boneWorld = boneWorlds(model.bones ?? [], true);

  for (const mesh of model.meshes ?? []) {
    if (isFxMesh(mesh)) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.verts, 3));
    geo.setIndex(mesh.indices);
    geo.computeVertexNormals();
    geo.applyMatrix4(worldMatrix);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const obj = new THREE.Mesh(geo, mat);
    group.add(obj);
    track.geos.push(geo);
    track.mats.push(mat);
    track.objs.push(obj);
  }

  if (opts.hitbox) {
    const hitMat = new THREE.MeshStandardMaterial({
      color: 0xf08a2a,
      roughness: 0.6,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    track.mats.push(hitMat);
    for (const cap of model.capsules ?? []) {
      const boneMat = boneWorld[cap.bone] ?? IDENTITY;
      const local = mmul(world, mmul(boneMat, eulerMat(cap.rot[0], cap.rot[1], cap.rot[2], cap.center)));
      const geo = buildCapsuleGeometry(cap.radius, cap.length);
      geo.applyMatrix4(toThree(local));
      const obj = new THREE.Mesh(geo, hitMat);
      group.add(obj);
      track.geos.push(geo);
      track.objs.push(obj);
    }
    for (const bx of model.boxes ?? []) {
      const boneMat = boneWorld[bx.bone] ?? IDENTITY;
      const local = mmul(world, mmul(boneMat, eulerMat(bx.rot[0], bx.rot[1], bx.rot[2], bx.center)));
      const geo = buildBoxGeometry(bx.extent);
      geo.applyMatrix4(toThree(local));
      const obj = new THREE.Mesh(geo, hitMat);
      group.add(obj);
      track.geos.push(geo);
      track.objs.push(obj);
    }
    for (const sp of model.spheres ?? []) {
      const boneMat = boneWorld[sp.bone] ?? IDENTITY;
      const center = mapply(mmul(world, boneMat), sp.center);
      const geo = new THREE.SphereGeometry(sp.radius, 24, 16);
      geo.applyMatrix4(toThree(eulerMat(0, 0, 0, center)));
      const obj = new THREE.Mesh(geo, hitMat);
      group.add(obj);
      track.geos.push(geo);
      track.objs.push(obj);
    }
  }

  if (opts.skeleton) {
    const points: number[] = [];
    model.bones.forEach((bone) => {
      if (bone.parent < 0) return;
      const idx = model.bones.indexOf(bone);
      const p1 = mapply(mmul(world, boneWorld[bone.parent] ?? IDENTITY), [0, 0, 0]);
      const p2 = mapply(mmul(world, boneWorld[idx] ?? IDENTITY), [0, 0, 0]);
      points.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    });
    if (points.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const mat = new THREE.LineBasicMaterial({ color: 0x66ccff });
      const lines = new THREE.LineSegments(geo, mat);
      group.add(lines);
      track.geos.push(geo);
      track.mats.push(mat);
      track.objs.push(lines);
    }
  }
}

// ---------------------------------------------------------------------------
// Viewer class + UI wiring
// ---------------------------------------------------------------------------

class ModelViewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private track = { geos: [] as THREE.BufferGeometry[], mats: [] as THREE.Material[], objs: [] as THREE.Object3D[] };
  private models = new Map<string, ModuleModel>();
  private status: HTMLElement;
  private container: HTMLElement;

  constructor(container: HTMLElement, status: HTMLElement) {
    this.container = container;
    this.status = status;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14161a);
    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / Math.max(1, container.clientHeight),
      1,
      100000,
    );
    this.camera.position.set(900, 700, 1400);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.GridHelper(6000, 120, 0x3a3f47, 0x23272e));
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x22242a, 1.6));
    const dir = new THREE.DirectionalLight(0xffffff, 2.2);
    dir.position.set(1200, 1600, 900);
    this.scene.add(dir);
    this.scene.add(this.root);

    // Data is Z-up (UE); three.js is Y-up. Rotate the model group once.
    this.root.rotation.x = -Math.PI / 2;

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  private onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setStatus(line: string): void {
    this.status.textContent = line;
  }

  private disposeTracked(): void {
    for (const obj of this.track.objs) obj.removeFromParent();
    for (const geo of this.track.geos) geo.dispose();
    for (const mat of this.track.mats) mat.dispose();
    this.track = { geos: [], mats: [], objs: [] };
    while (this.root.children.length > 0) this.root.remove(this.root.children[0]);
  }

  async loadModel(cmId: string): Promise<ModuleModel | null> {
    const existing = this.models.get(cmId);
    if (existing) return existing;
    try {
      const model = await fetchJSON<ModuleModel>(`/data/Models/${cmId}.json`);
      this.models.set(cmId, model);
      return model;
    } catch (err) {
      console.warn(`model ${cmId}:`, err);
      return null;
    }
  }

  async build(opts: {
    preset: CharacterPreset;
    side: 'L' | 'R' | 'Both';
    weaponMode: 'auto' | 'punisher' | 'hefty';
    hitbox: boolean;
    skeleton: boolean;
  }): Promise<void> {
    this.setStatus('Loading data...');
    const modules = await fetchJSON<ObjectTable<Module>>('/data/Objects/Module.json');
    const charModules = await fetchJSON<ObjectTable<unknown>>(
      '/data/Objects/CharacterModule.json',
    );

    const presetModules = opts.preset.modules ?? [];

    // 1) Resolve every model file this build needs, then load them BEFORE
    //    computing world transforms (socket frames come from the parent
    //    module's skeleton).
    const needed = new Set<string>();
    presetModules.forEach((entry) => {
      const moduleId = refToId(entry.module_ref);
      const socketName = entry.socket_name ?? '';
      const way = socketName.endsWith('_L')
        ? 'Left'
        : socketName.endsWith('_R')
          ? 'Right'
          : null;
      const cmId = modelIdForModule(moduleId, modules, charModules, way);
      if (cmId) needed.add(cmId);
    });
    for (let i = 0; i < presetModules.length; i++) {
      const entry = presetModules[i];
      if (entry.socket_name !== 'Shoulder_L' && entry.socket_name !== 'Shoulder_R') continue;
      const shoulderModuleId = refToId(entry.module_ref);
      for (let j = 0; j < presetModules.length; j++) {
        const w = presetModules[j];
        if (w.parent_socket_index !== i) continue;
        const wSocket = w.socket_name ?? '';
        if (!wSocket.startsWith('Shoulder_Weapon')) continue;
        const stype = socketTypeOf(shoulderModuleId, wSocket, modules);
        const weaponName =
          opts.weaponMode === 'auto'
            ? stype === 'WeaponHeavy'
              ? 'Hefty'
              : 'Punisher'
            : opts.weaponMode === 'hefty'
              ? 'Hefty'
              : 'Punisher';
        const wm = resolveWeaponModel(weaponName, modules, charModules);
        if (wm) needed.add(wm);
      }
    }

    let missing = 0;
    await Promise.all(
      [...needed].map(async (id) => {
        const model = await this.loadModel(id);
        if (!model) missing += 1;
      }),
    );

    // 2) Now that the models are cached, resolve the module world transforms.
    const placements = computeModuleWorlds(presetModules, modules, charModules, this.models);

    this.disposeTracked();
    let loaded = 0;

    for (let i = 0; i < placements.length; i++) {
      const placement = placements[i];
      const socketName = placement.socket_name ?? '';
      const isShoulder = socketName === 'Shoulder_L' || socketName === 'Shoulder_R';
      if (isShoulder && opts.side !== 'Both') {
        const side = socketName.endsWith('_L') ? 'L' : 'R';
        if (side !== opts.side) continue;
      }
      if (!placement.model_id) continue;

      const model = this.models.get(placement.model_id) ?? null;
      if (!model) {
        missing += 1;
        continue;
      }

      const color = MODEL_COLORS[loaded % MODEL_COLORS.length];
      addModel(
        this.root,
        model,
        placement.world,
        color,
        { hitbox: opts.hitbox, skeleton: opts.skeleton },
        this.track,
      );
      loaded += 1;

      if (isShoulder) {
        // weapons mounted on this shoulder's Shoulder_Weapon_* sockets
        for (let j = 0; j < placements.length; j++) {
          const w = placements[j];
          if (w.parent_socket_index !== i) continue;
          const wSocket = w.socket_name ?? '';
          if (!wSocket.startsWith('Shoulder_Weapon')) continue;
          const stype = socketTypeOf(placement.module_id, wSocket, modules);
          const weaponName =
            opts.weaponMode === 'auto'
              ? stype === 'WeaponHeavy'
                ? 'Hefty'
                : 'Punisher'
              : opts.weaponMode === 'hefty'
                ? 'Hefty'
                : 'Punisher';
          const weaponModelId = resolveWeaponModel(weaponName, modules, charModules);
          if (!weaponModelId) {
            missing += 1;
            this.setStatus(`No model data for ${weaponName} — run the parser with weapon exports.`);
            continue;
          }
          const weaponModel = this.models.get(weaponModelId) ?? null;
          if (!weaponModel) {
            missing += 1;
            continue;
          }
          addModel(
            this.root,
            weaponModel,
            w.world,
            MODEL_COLORS[(MODEL_COLORS.length + loaded) % MODEL_COLORS.length],
            { hitbox: opts.hitbox, skeleton: opts.skeleton },
            this.track,
          );
          loaded += 1;
        }
      }
    }

    const verts = this.track.geos.reduce(
      (sum, g) => sum + (g.getAttribute('position')?.count ?? 0),
      0,
    );
    this.setStatus(
      `Preset ${opts.preset.id}: ${loaded} models loaded (${verts.toLocaleString()} verts)` +
        (missing > 0 ? `, ${missing} missing` : ''),
    );
  }
}

// ---------------------------------------------------------------------------
// Bootstrap: wire the /models page controls
// ---------------------------------------------------------------------------

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
}

function populateSelect(
  select: HTMLSelectElement,
  options: { value: string; label: string }[],
): void {
  select.innerHTML = '';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    select.appendChild(o);
  }
}

async function init(): Promise<void> {
  const loading = document.getElementById('model-loading');
  const hideLoading = (): void => {
    if (loading) loading.remove();
  };

  const status = el<HTMLElement>('model-status');
  try {
    const container = el<HTMLElement>('model-canvas');
    const viewer = new ModelViewer(container, status);

    const botSelect = el<HTMLSelectElement>('model-bot');
    const presetSelect = el<HTMLSelectElement>('model-preset');
    const sideSelect = el<HTMLSelectElement>('model-side');
    const weaponSelect = el<HTMLSelectElement>('model-weapon');
    const hitboxBox = el<HTMLInputElement>('model-hitbox');
    const skeletonBox = el<HTMLInputElement>('model-skeleton');

    status.textContent = 'Loading tables...';
    const bots = await fetchJSON<ObjectTable<VirtualBot>>('/data/Objects/VirtualBot.json');
    const presets = await fetchJSON<ObjectTable<CharacterPreset>>(
      '/data/Objects/CharacterPreset.json',
    );
    const charModules = await fetchJSON<ObjectTable<unknown>>(
      '/data/Objects/CharacterModule.json',
    );

    if (Object.keys(bots).length === 0 && Object.keys(presets).length === 0) {
      status.textContent =
        'No model data found. Run `npm run sync:models` (or the parser) to populate public/data/.';
      hideLoading();
      return;
    }

    const botOptions = Object.entries(bots).map(([id, bot]) => ({
      value: id,
      label: bot.name?.Key ?? id,
    }));
    populateSelect(botSelect, botOptions);

    function presetsFor(botId: string): { value: string; label: string }[] {
      const bot = bots[botId];
      const refs = (bot?.factory_preset_refs ?? []).map(refToId).filter((id) => presets[id]);
      if (refs.length > 0) {
        return refs.map((id) => ({ value: id, label: id }));
      }
      return Object.keys(presets).map((id) => ({ value: id, label: id }));
    }

    function rebuildPresetList(): void {
      populateSelect(presetSelect, presetsFor(botSelect.value));
    }
    botSelect.addEventListener('change', rebuildPresetList);
    rebuildPresetList();

    const rebuild = async (): Promise<void> => {
      const preset = presets[presetSelect.value];
      if (!preset) {
        status.textContent = 'No preset selected.';
        return;
      }
      const side = sideSelect.value as 'L' | 'R' | 'Both';
      const weaponMode = weaponSelect.value as 'auto' | 'punisher' | 'hefty';
      // Touch the tables once so the viewer caches them before first build.
      void charModules;
      try {
        await viewer.build({
          preset,
          side,
          weaponMode,
          hitbox: hitboxBox.checked,
          skeleton: skeletonBox.checked,
        });
      } catch (err) {
        console.error('model build failed:', err);
        status.textContent = `Failed to build model: ${err instanceof Error ? err.message : String(err)}`;
      }
    };

    presetSelect.addEventListener('change', () => void rebuild());
    sideSelect.addEventListener('change', () => void rebuild());
    weaponSelect.addEventListener('change', () => void rebuild());
    hitboxBox.addEventListener('change', () => void rebuild());
    skeletonBox.addEventListener('change', () => void rebuild());

    await rebuild();
  } catch (err) {
    console.error('model viewer init failed:', err);
    status.textContent =
      'Could not start the viewer. Check the browser console; ' +
      `(${err instanceof Error ? err.message : String(err)})`;
  } finally {
    hideLoading();
  }
}

void init();
