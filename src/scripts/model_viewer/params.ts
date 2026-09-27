/**
 * Query-param contract for the `/models` page.
 *
 * The viewer is the single place three.js runs. Other pages deep-link into it
 * with a plain URL; the viewer reads its initial state from the params and
 * writes every change back with `history.replaceState`, so the current build
 * is always a copyable link.
 *
 * ## Build params (see build/params.ts)
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
 * ## View params
 *
 *   hitbox     0 | 1 — render collision hitboxes. Default 1.
 *
 * Unknown params are preserved on write.
 */
import { writeSelection, type SlotKeyMatcher } from './build/params';
import type { BuildSelection } from './build/types';

export interface ModelViewParams {
  hitbox?: boolean;
}

function readFlag(sp: URLSearchParams, key: string): boolean | undefined {
  const value = sp.get(key);
  return value === '0' || value === '1' ? value === '1' : undefined;
}

/** Parse the view params from a query string. */
export function parseViewParams(search: string): ModelViewParams {
  const sp = new URLSearchParams(search);
  const params: ModelViewParams = {};
  const hitbox = readFlag(sp, 'hitbox');
  if (hitbox !== undefined) params.hitbox = hitbox;
  return params;
}

/** Merge the build + view state into the current URL (no reload). */
export function writeModelUrl(
  selection: BuildSelection,
  view: ModelViewParams,
  isSlotKey: SlotKeyMatcher
): void {
  const url = new URL(window.location.href);
  const sp = url.searchParams;
  writeSelection(sp, selection, isSlotKey);
  sp.delete('hitbox');
  if (view.hitbox !== undefined) sp.set('hitbox', view.hitbox ? '1' : '0');
  history.replaceState(null, '', url);
}
