/**
 * Build graph: derive the slot tree for a selection, and convert between a
 * build and the flat `CharacterPresetModule[]` shape the mount resolver (and
 * the game's presets) use.
 *
 * Resolution walks down from the chassis. Each chosen module's `sockets[]`
 * become child slots, so a slot only exists once its parent part is placed —
 * the same cascade as the in-game hangar. Selections that no longer fit (e.g.
 * a standard torso after switching to a titan chassis) are dropped; required
 * slots fall back to the chassis's own core modules, then the first released
 * compatible module.
 */
import { refToId } from '../../../utils/object_reference';
import { isProdReady, kindOfModuleType } from './classify';
import { acceptedModuleTypes, type CompatibilityIndex } from './compatibility';
import type { CharacterPresetModule } from '../../../types/character_preset';
import type {
  BuildSelection,
  BuildSlot,
  BuildTables,
  ModuleKind,
  ResolvedBuild,
  SlotKey,
} from './types';

export const CHASSIS_KEY = 'chassis';
export const TORSO_KEY = 'torso';
/** Chassis socket the torso mounts into. */
export const TORSO_SOCKET = 'Root';
/** `socket_name` of the chassis entry in a preset's module list. */
export const CHASSIS_SOCKET = 'None';

/** Guards against a (malformed) socket cycle. Real trees are 3-4 deep. */
const MAX_DEPTH = 8;

/**
 * Slot key for a socket path from the chassis. The torso's `Root` segment is
 * implied so keys read as mount locations: `[]` -> `chassis`, `[Root]` ->
 * `torso`, `[Root, Shoulder_L, Shoulder_Weapon_0]` ->
 * `Shoulder_L.Shoulder_Weapon_0`.
 */
export function slotKeyForPath(path: readonly string[]): SlotKey {
  if (path.length === 0) return CHASSIS_KEY;
  if (path[0] === TORSO_SOCKET) {
    return path.length === 1 ? TORSO_KEY : path.slice(1).join('.');
  }
  return path.join('.');
}

/** A chassis's own core modules (from its VirtualBot), used as defaults. */
function coreModulesOf(chassisId: string, tables: BuildTables): string[] {
  for (const bot of Object.values(tables.bots ?? {})) {
    const core = (bot.core_module_refs ?? []).map(refToId);
    if (core.includes(chassisId)) return core;
  }
  return [];
}

interface PickArgs {
  candidates: string[];
  requested: string | undefined;
  required: boolean;
  preferred: string[];
  tables: BuildTables;
}

function pickModule({
  candidates,
  requested,
  required,
  preferred,
  tables,
}: PickArgs): string | null {
  if (requested && candidates.includes(requested)) return requested;
  if (!required) return null;
  const core = preferred.find((id) => candidates.includes(id));
  if (core) return core;
  return (
    candidates.find((id) => isProdReady(tables.modules[id])) ??
    candidates[0] ??
    null
  );
}

/** Released options, plus the chosen module when it is not released (so a
 * deep link to e.g. a tutorial preset still shows what it holds). */
function visibleOptions(
  candidates: string[],
  chosen: string | null,
  tables: BuildTables
): string[] {
  return candidates.filter(
    (id) => id === chosen || isProdReady(tables.modules[id])
  );
}

function slotKind(socketTypeId: string, tables: BuildTables): ModuleKind {
  const exclusive = tables.socketTypes[socketTypeId]?.exclusive_module_type_ref;
  const typeId = exclusive
    ? refToId(exclusive)
    : [...acceptedModuleTypes(socketTypeId, tables)][0];
  return typeId ? kindOfModuleType(typeId, tables) : 'other';
}

/** Resolve a selection into the full slot tree (see module docs). */
export function resolveBuild(
  selection: BuildSelection,
  tables: BuildTables,
  index: CompatibilityIndex
): ResolvedBuild {
  const slots: BuildSlot[] = [];
  const normalized: BuildSelection = {};

  const chassisId = pickModule({
    candidates: index.rootModules,
    requested: selection[CHASSIS_KEY],
    required: true,
    preferred: [],
    tables,
  });
  const core = chassisId ? coreModulesOf(chassisId, tables) : [];

  const visit = (slot: BuildSlot): void => {
    slots.push(slot);
    if (!slot.moduleId) return;
    normalized[slot.key] = slot.moduleId;
    if (slot.depth >= MAX_DEPTH) return;

    for (const sock of tables.modules[slot.moduleId]?.sockets ?? []) {
      const socketTypeId = refToId(sock.socket_type_ref);
      const socketType = tables.socketTypes[socketTypeId];
      const path = [...slot.path, sock.name];
      const key = slotKeyForPath(path);
      const required = socketType?.required === true;
      const candidates = index.compatible(socketTypeId);
      const moduleId = pickModule({
        candidates,
        requested: selection[key],
        required,
        preferred: core,
        tables,
      });
      visit({
        key,
        path,
        socketName: sock.name,
        parentKey: slot.key,
        depth: slot.depth + 1,
        socketTypeId,
        mountWay: sock.mount_way ?? null,
        kind: slotKind(socketTypeId, tables),
        required,
        fixed: socketType?.b_can_be_changed_by_user === false,
        options: visibleOptions(candidates, moduleId, tables),
        moduleId,
      });
    }
  };

  visit({
    key: CHASSIS_KEY,
    path: [],
    socketName: CHASSIS_SOCKET,
    parentKey: null,
    depth: 0,
    socketTypeId: null,
    mountWay: null,
    kind: 'chassis',
    required: true,
    fixed: false,
    options: visibleOptions(index.rootModules, chassisId, tables),
    moduleId: chassisId,
  });

  return { slots, selection: normalized };
}

/**
 * Flatten a build into the preset module-list shape: filled slots in DFS order
 * (parents before children), each pointing at its parent's index. This is the
 * seam into the mount resolver, which is unaware of builds.
 */
export function toPresetModules(
  build: ResolvedBuild,
  level = 1
): CharacterPresetModule[] {
  const indexByKey = new Map<SlotKey, number>();
  const out: CharacterPresetModule[] = [];
  for (const slot of build.slots) {
    if (!slot.moduleId) continue;
    const parent =
      slot.parentKey === null ? -1 : indexByKey.get(slot.parentKey);
    if (parent === undefined) continue; // parent empty: cannot mount
    indexByKey.set(slot.key, out.length);
    out.push({
      module_ref: `OBJID_Module::${slot.moduleId}`,
      socket_name: slot.socketName,
      parent_socket_index: parent,
      level,
    });
  }
  return out;
}

/**
 * The selection a preset's module list describes (inverse of
 * {@link toPresetModules}). Needs no tables, so build-time pages can use it to
 * emit viewer deep links. `include` filters entries (a skipped entry also skips
 * its subtree).
 */
export function selectionFromPreset(
  modules: readonly CharacterPresetModule[],
  include: (moduleId: string) => boolean = () => true
): BuildSelection {
  const paths: (string[] | null)[] = [];
  const selection: BuildSelection = {};
  modules.forEach((entry, i) => {
    const parent = entry.parent_socket_index;
    const parentPath = parent < 0 ? [] : paths[parent];
    const moduleId = refToId(entry.module_ref);
    if (parentPath === null || parentPath === undefined || !include(moduleId)) {
      paths[i] = null;
      return;
    }
    const path = parent < 0 ? [] : [...parentPath, entry.socket_name];
    paths[i] = path;
    selection[slotKeyForPath(path)] = moduleId;
  });
  return selection;
}
