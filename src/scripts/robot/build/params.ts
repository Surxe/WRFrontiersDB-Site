/**
 * BuildSelection <-> URL query params.
 *
 * Each filled slot is one param, keyed by its slot key (the socket-name path
 * from the chassis, see `slotKeyForPath`), valued with a Module id:
 *
 *   chassis=DA_Module_ChassisTyphon.2
 *   &torso=DA_Module_TorsoTyphon.1
 *   &Shoulder_L=...&Shoulder_L.Shoulder_Weapon_0=DA_Module_Weapon_...
 *   &Torso_Weapon_0=...&Ability=...&UltAbility=...
 *
 * An empty optional slot is simply absent. Only slot keys are read or written;
 * any other param survives a round-trip untouched.
 */
import { CHASSIS_KEY, TORSO_KEY } from './graph';
import type { BuildSelection } from './types';

export type SlotKeyMatcher = (key: string) => boolean;

/** A matcher for slot keys: `chassis`, `torso`, or a dot-path made only of
 * known socket names. */
export function slotKeyMatcher(
  socketNames: ReadonlySet<string>
): SlotKeyMatcher {
  return (key) =>
    key === CHASSIS_KEY ||
    key === TORSO_KEY ||
    (key.length > 0 && key.split('.').every((seg) => socketNames.has(seg)));
}

/** The selection encoded in a query string. */
export function readSelection(
  params: URLSearchParams,
  isSlotKey: SlotKeyMatcher
): BuildSelection {
  const selection: BuildSelection = {};
  for (const [key, value] of params) {
    if (value && isSlotKey(key)) selection[key] = value;
  }
  return selection;
}

/** Replace every slot param in `params` with `selection` (in its key order);
 * non-slot params are left as they are. */
export function writeSelection(
  params: URLSearchParams,
  selection: BuildSelection,
  isSlotKey: SlotKeyMatcher
): void {
  for (const key of [...params.keys()]) {
    if (isSlotKey(key)) params.delete(key);
  }
  for (const [key, value] of Object.entries(selection)) {
    params.set(key, value);
  }
}

/** Query string (no leading `?`) for a selection — for deep links. */
export function selectionQuery(selection: BuildSelection): string {
  return new URLSearchParams(selection).toString();
}
