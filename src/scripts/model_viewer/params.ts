/**
 * Query-param contract for the `/models` page.
 *
 * Other pages deep-link into the viewer with a plain URL; the page reads its
 * initial state from the params and writes every change back with
 * `history.replaceState`, so the current view is always a copyable link.
 *
 * ## Build params (see robot/build/params.ts)
 *
 * One param per filled slot, keyed by where it mounts:
 *
 *   chassis                         root chassis Module id
 *   torso                           torso (mounts at the chassis `Root` socket)
 *   Shoulder_L, Shoulder_R          shoulders (mount on the torso)
 *   Shoulder_L.Shoulder_Weapon_0    weapon in that shoulder's slot; a shoulder
 *   Shoulder_L.Shoulder_Weapon_1    may have 0, 1 or 2 weapon slots
 *   Torso_Weapon_0                  torso-mounted weapon (when the torso has one)
 *   Ability, UltAbility             supply / cycle gear
 *
 * Keys are socket names joined by `.`, so any new socket in the data is
 * addressable without a code change. Missing required slots are filled with
 * the chassis's own parts; missing optional slots stay empty.
 *
 * ## Compare params (see robot/build/compare.ts)
 *
 *   compare    1 — compare build A (the build params) against build B
 *   b.<slot>   B's swaps from A, one per changed slot; empty = emptied in B
 *   layout     side — stand B beside A in the 3D view (default: overlapping).
 *              Only written while comparing.
 *
 * ## View params
 *
 *   mesh       0 | 1 — render the module meshes. Default 1.
 *   hitbox     0 | 1 — render collision hitboxes. Default 1.
 *
 * Unknown params (e.g. `lang`) are preserved on write.
 */
import {
  readSelection,
  selectionQuery,
  writeSelection,
  type SlotKeyMatcher,
} from '../robot/build/params';
import {
  readOverrides,
  writeOverrides,
  type BuildOverrides,
} from '../robot/build/compare';
import type { BuildSelection } from '../robot/build/types';
import type { CompareLayout } from './render/compare_layout';

export interface ModelPageState {
  selection: BuildSelection;
  /** B's overrides while comparing, else null. */
  compare: BuildOverrides | null;
  compareLayout: CompareLayout;
  mesh: boolean;
  hitbox: boolean;
}

const FLAGS = ['mesh', 'hitbox'] as const;

function readFlag(params: URLSearchParams, key: string): boolean | null {
  const value = params.get(key);
  return value === '0' || value === '1' ? value === '1' : null;
}

/** The page state a query string encodes. */
export function readModelUrl(
  search: string,
  isSlotKey: SlotKeyMatcher
): ModelPageState {
  const params = new URLSearchParams(search);
  return {
    selection: readSelection(params, isSlotKey),
    compare:
      readFlag(params, 'compare') === true
        ? readOverrides(params, isSlotKey)
        : null,
    compareLayout: params.get('layout') === 'side' ? 'side' : 'overlap',
    mesh: readFlag(params, 'mesh') ?? true,
    hitbox: readFlag(params, 'hitbox') ?? true,
  };
}

/** Merge the page state into the current URL (no reload). */
export function writeModelUrl(
  state: ModelPageState,
  isSlotKey: SlotKeyMatcher
): void {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  writeSelection(params, state.selection, isSlotKey);
  writeOverrides(params, state.compare ?? {}, isSlotKey);
  params.delete('compare');
  params.delete('layout');
  if (state.compare) {
    params.set('compare', '1');
    if (state.compareLayout === 'side') params.set('layout', 'side');
  }
  for (const flag of FLAGS) params.set(flag, state[flag] ? '1' : '0');
  history.replaceState(null, '', url);
}

/** Link to the /models page showing `selection` (for deep links from other
 * pages; usable at build time). */
export function modelsPageHref(selection: BuildSelection): string {
  const query = selectionQuery(selection);
  return query ? `/models?${query}` : '/models';
}
