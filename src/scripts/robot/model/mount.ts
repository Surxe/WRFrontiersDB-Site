/**
 * Mount resolution: the world transform of every module in a module list (a
 * preset's, or a flattened build's; see build/graph.ts `toPresetModules`):
 *
 *   world(module) = world(parent) · socketFrame(parent, socketName)
 *                   · T(adapterOffset) · R(mountRotation)
 *
 * plus the runtime weapon-rotation overrides the export does not serialize
 * (see docs/weapon_mount_findings.md and the model-correction skill).
 */
import { Matrix4, Vector3 } from 'three';
import {
  boneWorlds,
  multiply,
  rotatorMatrix,
  translationMatrix,
  withRotation,
} from './math';
import { meshBounds } from './mesh';
import { kindOfModule } from '../build/classify';
import { refToId } from '../../../utils/object_reference';
import {
  LEFT_SOCKET_SUFFIX,
  RIGHT_SOCKET_SUFFIX,
  TORSO_MOUNT_BONE,
  TORSO_SOCKET,
  WEAPON_MOUNT_ROTATION,
  WEAPON_ROTATION_OVERRIDES,
} from '../../../utils/constants';
import type { RobotTables } from '../data';
import type { CharacterPresetModule } from '../../../types/character_preset';
import type { AdapterMountWay, ModuleModel } from '../../../types/model';

/** The tables mount resolution reads. */
export type MountTables = Pick<
  RobotTables,
  'modules' | 'moduleTypes' | 'characterModules'
>;

/** Loaded models by CharacterModule id. */
export type ModelLookup = ReadonlyMap<string, ModuleModel>;

export type Side = 'left' | 'right';

/** Where one entry of a module list sits in the world. */
export interface ModulePlacement {
  moduleId: string;
  /** CharacterModule id of the model drawn for it (null: none exported). */
  modelId: string | null;
  socketName: string;
  /** Index of the parent entry, or -1 for the chassis. */
  parentIndex: number;
  world: Matrix4;
}

/** The side a per-side socket name (`Shoulder_L` / `Shoulder_R`) implies. */
export function socketSide(socketName: string): Side | null {
  if (socketName.endsWith(LEFT_SOCKET_SUFFIX)) return 'left';
  if (socketName.endsWith(RIGHT_SOCKET_SUFFIX)) return 'right';
  return null;
}

const SIDE_MOUNT_WAY = { left: 'Left', right: 'Right' } as const;

/**
 * The CharacterModule (model) a module renders as: the one for `side` when
 * the module has per-side models (shoulders; a few weapons), else its first
 * exported one. Null when none was exported.
 */
export function modelIdForModule(
  moduleId: string,
  tables: Pick<MountTables, 'modules' | 'characterModules'>,
  side: Side | null
): string | null {
  const mounts = tables.modules[moduleId]?.character_module_mounts ?? [];
  const exported = mounts
    .map((mount) => ({
      way: mount.mount,
      id: refToId(mount.character_module_ref),
    }))
    .filter(({ id }) => id in tables.characterModules);
  const wanted = side ? SIDE_MOUNT_WAY[side] : null;
  return (
    (exported.find(({ way }) => way === wanted) ?? exported[0])?.id ?? null
  );
}

/** Per entry: the side its own socket implies (a shoulder's), used to pick
 * the model it renders as. */
function ownSide(entry: CharacterPresetModule): Side | null {
  return socketSide(entry.socket_name);
}

/** A weapon's mount side: its parent shoulder's socket side. */
function parentSide(
  list: readonly CharacterPresetModule[],
  entry: CharacterPresetModule
): Side | null {
  const parent = list[entry.parent_socket_index];
  return parent ? socketSide(parent.socket_name) : null;
}

/** World matrix of a mount bone in the parent's MESH (component) space. Some
 * exported skeletons bake the module's mount height into the root bone while
 * the mesh stays root-relative; using the baked (full) bone world for a child
 * mount then re-adds that height at every chain level (shoulders 2x, weapons
 * 3x). Pick whichever of the full or root-at-origin bone world lands inside
 * the parent mesh -- the space the child must align with. */
function mountBoneFrame(model: ModuleModel, boneName: string): Matrix4 | null {
  const index = model.bones.findIndex((bone) => bone.name === boneName);
  if (index < 0) return null;
  const full = boneWorlds(model.bones)[index];
  const bounds = meshBounds(model);
  if (bounds.isEmpty()) return full;
  const atOrigin = boneWorlds(model.bones, true)[index];
  const distance = (m: Matrix4): number =>
    bounds.distanceToPoint(new Vector3().setFromMatrixPosition(m));
  return distance(atOrigin) < distance(full) ? atOrigin : full;
}

/** Frame of the socket a child mounts into, in the parent model's space. */
function socketFrame(model: ModuleModel, socketName: string): Matrix4 | null {
  // The torso mounts at the chassis's `Root` socket, but attaches to its
  // `Torso` bone (see TORSO_MOUNT_BONE).
  const boneName = socketName === TORSO_SOCKET ? TORSO_MOUNT_BONE : socketName;
  const socket = model.sockets.find((s) => s.name === boneName);
  if (socket) return rotatorMatrix(socket.rot, socket.loc);
  return mountBoneFrame(model, boneName);
}

/** The adapter a weapon mounts with on `side`: mirrored light weapons carry
 * per-side adapters, centered titan weapons only a Standard one. */
function adapterMountWay(
  model: ModuleModel | undefined,
  side: Side | null
): AdapterMountWay | null {
  const wanted = side ? SIDE_MOUNT_WAY[side] : null;
  if (!model) return wanted;
  const ways = new Set(model.adapters.map((adapter) => adapter.mount_way));
  if (wanted && ways.has(wanted)) return wanted;
  if (ways.has('Standard')) return 'Standard';
  return wanted;
}

/** The weapon-specific part of a weapon's mount: the Standard adapter's
 * offset (Left/Right offsets position the unrendered adapter mesh, not the
 * weapon), then the runtime mount rotation. */
function weaponMount(
  list: readonly CharacterPresetModule[],
  entry: CharacterPresetModule,
  tables: MountTables,
  models: ModelLookup
): Matrix4 {
  const moduleId = refToId(entry.module_ref);
  const modelId = modelIdForModule(moduleId, tables, parentSide(list, entry));
  const model = modelId ? models.get(modelId) : undefined;
  const way = adapterMountWay(model, parentSide(list, entry)) ?? 'Standard';
  const offset =
    way === 'Standard'
      ? model?.adapters.find((adapter) => adapter.mount_way === 'Standard')
          ?.offset
      : null;
  const rotation = rotatorMatrix(WEAPON_MOUNT_ROTATION[way]);
  return offset ? multiply(translationMatrix(offset), rotation) : rotation;
}

/**
 * Every model id placing `list` needs: each entry's own render model, plus a
 * weapon's parent-side model, whose adapters decide its mount. Load these
 * before {@link placeModules}.
 */
export function requiredModelIds(
  list: readonly CharacterPresetModule[],
  tables: MountTables
): Set<string> {
  const ids = new Set<string>();
  for (const entry of list) {
    const moduleId = refToId(entry.module_ref);
    const sides = [ownSide(entry)];
    if (kindOfModule(moduleId, tables) === 'weapon') {
      sides.push(parentSide(list, entry));
    }
    for (const side of sides) {
      const id = modelIdForModule(moduleId, tables, side);
      if (id) ids.add(id);
    }
  }
  return ids;
}

/**
 * Place every entry of a module list (parents before children). Socket frames
 * come from the parent's model, so load {@link requiredModelIds} first; an
 * entry whose parent model is missing sits at its parent's origin.
 */
export function placeModules(
  list: readonly CharacterPresetModule[],
  tables: MountTables,
  models: ModelLookup
): ModulePlacement[] {
  const renderModel = list.map((entry) =>
    modelIdForModule(refToId(entry.module_ref), tables, ownSide(entry))
  );
  const worlds: Matrix4[] = [];
  for (const entry of list) {
    const parent = entry.parent_socket_index;
    if (parent < 0) {
      worlds.push(new Matrix4());
      continue;
    }
    const parentModelId = renderModel[parent];
    const parentModel = parentModelId ? models.get(parentModelId) : undefined;
    let local =
      (parentModel && socketFrame(parentModel, entry.socket_name)) ??
      new Matrix4();
    if (kindOfModule(refToId(entry.module_ref), tables) === 'weapon') {
      local = multiply(local, weaponMount(list, entry, tables, models));
    }
    let world = multiply(worlds[parent], local);
    // A few hardpoints need their mounted module's final rotation overridden
    // (WEAPON_ROTATION_OVERRIDES), keeping its position.
    const override =
      WEAPON_ROTATION_OVERRIDES[`${parentModelId}|${entry.socket_name}`];
    if (override) world = withRotation(world, override);
    worlds.push(world);
  }

  return list.map((entry, i) => ({
    moduleId: refToId(entry.module_ref),
    modelId: renderModel[i],
    socketName: entry.socket_name,
    parentIndex: entry.parent_socket_index,
    world: worlds[i],
  }));
}
