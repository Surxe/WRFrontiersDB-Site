/**
 * Mount resolution: port of wrf_models/combine.py.
 *
 * Resolves the module world transforms for a preset:
 *   world(module) = world(parent) x socketFrame(parent, socketName)
 *                   x T(adapterOffset) x R(mountRoll)
 * plus the runtime weapon-rotation overrides the export does not serialize.
 */
import { IDENTITY, boneWorlds, eulerMat, mmul, withWorldRotation, type Mat4 } from './math';
import { dist2ToBox, meshAabb } from './mesh';
import {
  APPLY_ADAPTER_OFFSET,
  MOUNT_ORIENTATION,
  WEAPON_ROTATION_OVERRIDE,
} from './constants';
import { refToId } from '../../utils/object_reference';
import type { CharacterPresetModule } from '../../types/character_preset';
import type { Module } from '../../types/module';
import type { ModuleModel, Vec3 } from '../../types/model';

export interface ModulePlacement {
  module_id: string;
  model_id: string | null;
  socket_name: string | null;
  parent_socket_index: number;
  world: Mat4;
}

export function modelIdForModule(
  moduleId: string,
  modules: Record<string, Module>,
  charModules: Record<string, unknown>,
  mountWay?: string | null,
): string | null {
  const module = modules[moduleId];
  if (!module) return null;
  const mounts = module.character_module_mounts ?? [];
  for (const mount of mounts) {
    if (mountWay != null && mount.mount === mountWay) {
      const id = refToId(mount.character_module_ref);
      if (id && charModules[id]) return id;
    }
  }
  for (const mount of mounts) {
    const id = refToId(mount.character_module_ref);
    if (id && charModules[id]) return id;
  }
  return null;
}

export function socketTypeOf(
  moduleId: string,
  socketName: string,
  modules: Record<string, Module>,
): 'Weapon' | 'WeaponHeavy' | null {
  const module = modules[moduleId];
  if (!module) return null;
  for (const sock of module.sockets ?? []) {
    if (sock.name !== socketName) continue;
    const ref = refToId(sock.socket_type_ref);
    if (ref.includes('WeaponHeavy')) return 'WeaponHeavy';
    if (ref.includes('Weapon')) return 'Weapon';
  }
  return null;
}

function socketFrame(model: ModuleModel, socketName: string): Mat4 | null {
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

function isWeaponModule(moduleId: string, modules: Record<string, Module>): boolean {
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

/** Left/Right for a weapon, from its parent shoulder's socket suffix, else null. */
function weaponMountSide(presetModules: CharacterPresetModule[], i: number): string | null {
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

export function resolveWeaponModel(
  weaponName: string,
  modules: Record<string, Module>,
  charModules: Record<string, unknown>,
): string | null {
  const wanted = `Weapon_${weaponName}`;
  for (const moduleId of Object.keys(modules).sort()) {
    if (!moduleId.includes(wanted)) continue;
    const cmId = modelIdForModule(moduleId, modules, charModules);
    if (cmId) return cmId;
  }
  return null;
}

/** Side ("Left"/"Right") a preset socket suffix implies, else null. */
export function sideForSocket(socketName: string): 'Left' | 'Right' | null {
  if (socketName.endsWith('_L')) return 'Left';
  if (socketName.endsWith('_R')) return 'Right';
  return null;
}

export function computeModuleWorlds(
  presetModules: CharacterPresetModule[],
  modules: Record<string, Module>,
  charModules: Record<string, unknown>,
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
    const parentWay = sideForSocket(parentEntry.socket_name ?? '');
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
    const parentWay = sideForSocket(parentEntry.socket_name ?? '');
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
    const side = sideForSocket(entry.socket_name ?? '');
    return {
      module_id: refToId(entry.module_ref),
      model_id: modelIdForModule(refToId(entry.module_ref), modules, charModules, side),
      socket_name: entry.socket_name,
      parent_socket_index: entry.parent_socket_index,
      world: worlds[i],
    };
  });
}
