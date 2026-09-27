/**
 * Data model for a free-form robot build.
 *
 * A build is a tree of slots rooted at the chassis. Every slot is a socket on
 * its parent module (the chassis itself is the one parentless slot), and the
 * modules that fit a slot come from the socket's `ModuleSocketType`. Nothing
 * here depends on three.js or the DOM, so the same model can back the 3D viewer
 * today and a stats-aware build planner later.
 */
import type { Module, ModuleType } from '../../../types/module';
import type { ModuleSocketType } from '../../../types/module_socket_type';
import type { VirtualBot } from '../../../types/virtual_bot';

/** Broad module category, resolved via ModuleType -> ModuleCategory. */
export type ModuleKind =
  | 'chassis'
  | 'torso'
  | 'shoulder'
  | 'weapon'
  | 'ability'
  | 'other';

/** The parsed tables a build is resolved against (all keyed by bare id). */
export interface BuildTables {
  modules: Record<string, Module>;
  moduleTypes: Record<string, ModuleType>;
  socketTypes: Record<string, ModuleSocketType>;
  /** Optional: used only to pick sensible defaults (a chassis's own torso). */
  bots?: Record<string, VirtualBot>;
}

/**
 * Stable identifier of a slot, derived from the socket names on the path from
 * the chassis (see {@link slotKeyForPath}). Doubles as the URL query key:
 *   `chassis`, `torso`, `Shoulder_L`, `Shoulder_L.Shoulder_Weapon_0`,
 *   `Torso_Weapon_0`, `Ability`, `UltAbility`.
 */
export type SlotKey = string;

/**
 * The user's choices: slot key -> module id. This is the whole persisted state
 * of a build (it is what the URL encodes). Keys for slots that do not exist in
 * the resolved tree are ignored.
 */
export type BuildSelection = Record<SlotKey, string>;

/** One resolved slot in the build tree. */
export interface BuildSlot {
  key: SlotKey;
  /** Socket names from the chassis down to this slot (`[]` for the chassis). */
  path: string[];
  /** Socket name on the parent module (`'None'` for the chassis). */
  socketName: string;
  /** The parent slot's key; null for the chassis. */
  parentKey: SlotKey | null;
  /** Nesting depth (chassis = 0). */
  depth: number;
  /** ModuleSocketType id this slot accepts; null for the chassis (root modules). */
  socketTypeId: string | null;
  /** Socket `mount_way` (Standard / Left / Right / Inherited), if declared. */
  mountWay: string | null;
  /** Category of module this slot takes. */
  kind: ModuleKind;
  /** The slot always holds a module (no "empty" choice). */
  required: boolean;
  /** The game does not let the user change this slot. */
  fixed: boolean;
  /** Module ids that fit this slot, in display order. */
  options: string[];
  /** The module in this slot, or null when an optional slot is empty. */
  moduleId: string | null;
}

/** A fully resolved build: the slot tree in DFS order (parents first). */
export interface ResolvedBuild {
  slots: BuildSlot[];
  /** The normalized selection (only reachable, valid, filled slots). */
  selection: BuildSelection;
}
