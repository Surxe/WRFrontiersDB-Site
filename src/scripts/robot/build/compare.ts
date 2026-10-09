/**
 * Build comparison: a second build B expressed as overrides on the live build
 * A, so B keeps following A everywhere the user has not swapped a part.
 *
 *   B = resolve(A.selection + overrides), then weapon fill
 *
 * Weapon fill: a B weapon slot that is new to B (A has no such slot), or
 * whose A weapon no longer fits, takes A's weapon of the same class (socket
 * type: light / heavy) when one fits, so swapping to a shoulder with
 * different slots keeps a comparable loadout. A slot A leaves empty stays
 * empty, as does one the user empties in B.
 *
 * Nothing here depends on three.js or the DOM. B lives in the URL as
 * prefixed override params (see {@link readOverrides}).
 */
import { resolveBuild } from './graph';
import type { CompatibilityIndex } from './compatibility';
import type { BuildStore } from './store';
import type { SlotKeyMatcher } from './params';
import type {
  BuildSelection,
  BuildSlot,
  BuildTables,
  ResolvedBuild,
  SlotKey,
} from './types';

/** B's differences from A: slot key -> module id, or null for "emptied". */
export type BuildOverrides = Record<SlotKey, string | null>;

export interface Comparison {
  a: ResolvedBuild;
  b: ResolvedBuild;
  /** Slot keys whose module differs between A and B (swapped, added or
   * removed). */
  changed: Set<SlotKey>;
}

/** Side prefix of a weapon slot key (`Shoulder_L` of
 * `Shoulder_L.Shoulder_Weapon_0`), or null for a torso weapon. */
function mountOf(key: SlotKey): string | null {
  const dot = key.lastIndexOf('.');
  return dot < 0 ? null : key.slice(0, dot);
}

/** A's weapon to put in B's empty weapon `slot`: same socket type (class),
 * and one the slot accepts; same slot key first, then the same mount, then
 * any, in A's order. */
function fillFor(slot: BuildSlot, a: ResolvedBuild): string | null {
  const candidates = a.slots.filter(
    (s) =>
      s.kind === 'weapon' &&
      s.moduleId !== null &&
      s.socketTypeId === slot.socketTypeId &&
      slot.options.includes(s.moduleId)
  );
  const pick =
    candidates.find((s) => s.key === slot.key) ??
    candidates.find((s) => mountOf(s.key) === mountOf(slot.key)) ??
    candidates[0];
  return pick?.moduleId ?? null;
}

const hasOverride = (overrides: BuildOverrides, key: SlotKey): boolean =>
  Object.hasOwn(overrides, key);

/** Slot keys whose module differs between two builds. */
export function changedSlots(a: ResolvedBuild, b: ResolvedBuild): Set<SlotKey> {
  const keys = new Set([
    ...Object.keys(a.selection),
    ...Object.keys(b.selection),
  ]);
  return new Set(
    [...keys].filter((key) => a.selection[key] !== b.selection[key])
  );
}

/**
 * The overrides that make B a given build: the inverse of
 * {@link resolveComparison}, for a B read as a whole (a `b=` build code).
 * Every slot of B that differs from A is overridden, and so is every empty
 * slot A doesn't have, so weapon fill can't put one of A's weapons there.
 */
export function toOverrides(
  a: ResolvedBuild,
  b: ResolvedBuild
): BuildOverrides {
  const aKeys = new Set(a.slots.map((slot) => slot.key));
  const overrides: BuildOverrides = {};
  for (const slot of b.slots) {
    const aModule = a.selection[slot.key] ?? null;
    if (
      slot.moduleId !== aModule ||
      (slot.moduleId === null && !aKeys.has(slot.key))
    ) {
      overrides[slot.key] = slot.moduleId;
    }
  }
  return overrides;
}

/** Resolve B from A and the overrides (see module docs). */
export function resolveComparison(
  a: ResolvedBuild,
  overrides: BuildOverrides,
  tables: BuildTables,
  index: CompatibilityIndex
): Comparison {
  const selection: BuildSelection = { ...a.selection };
  for (const [key, moduleId] of Object.entries(overrides)) {
    if (moduleId === null) delete selection[key];
    else selection[key] = moduleId;
  }
  let b = resolveBuild(selection, tables, index);

  // Fill B's empty weapon slots that A could not carry over (see module
  // docs). Filling can't add slots (weapons have no sockets): one pass.
  const aSlots = new Map(a.slots.map((slot) => [slot.key, slot]));
  const filled: BuildSelection = { ...b.selection };
  let didFill = false;
  for (const slot of b.slots) {
    if (slot.kind !== 'weapon' || slot.moduleId !== null) continue;
    if (hasOverride(overrides, slot.key)) continue;
    const aSlot = aSlots.get(slot.key);
    if (aSlot && aSlot.moduleId === null) continue; // A leaves it empty too
    const moduleId = fillFor(slot, a);
    if (moduleId) {
      filled[slot.key] = moduleId;
      didFill = true;
    }
  }
  if (didFill) b = resolveBuild(filled, tables, index);

  return { a, b, changed: changedSlots(a, b) };
}

export type CompareListener = (comparison: Comparison | null) => void;

/**
 * Observable comparison over the live build store: holds whether comparing is
 * on and B's overrides, re-resolves B whenever A or the overrides change, and
 * notifies listeners with the comparison (or null when off).
 */
export class CompareStore {
  private enabled = false;
  private overrides: BuildOverrides = {};
  private comparison: Comparison | null = null;
  private listeners = new Set<CompareListener>();

  constructor(
    private readonly store: BuildStore,
    private readonly tables: BuildTables,
    private readonly index: CompatibilityIndex
  ) {
    store.subscribe(() => {
      if (this.enabled) this.update();
    });
  }

  get current(): Comparison | null {
    return this.comparison;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get currentOverrides(): Readonly<BuildOverrides> {
    return this.overrides;
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.update();
  }

  /** Put a module in one of B's slots (null empties it). Choosing A's own
   * module drops the override, so the slot follows A again. */
  select(key: SlotKey, moduleId: string | null): void {
    const next = { ...this.overrides };
    if (moduleId === (this.store.current.selection[key] ?? null)) {
      delete next[key];
    } else {
      next[key] = moduleId;
    }
    this.overrides = next;
    this.update();
  }

  /** Make one of B's slots follow A again. */
  revert(key: SlotKey): void {
    if (!hasOverride(this.overrides, key)) return;
    const next = { ...this.overrides };
    delete next[key];
    this.overrides = next;
    this.update();
  }

  /** B = A again. */
  reset(): void {
    this.overrides = {};
    this.update();
  }

  /** Drop every override without notifying, for a caller about to change A
   * (whose update then brings B along as B = A). */
  clearOverrides(): void {
    this.overrides = {};
  }

  /** Replace the overrides wholesale (e.g. from the URL). */
  replace(overrides: BuildOverrides): void {
    this.overrides = { ...overrides };
    this.update();
  }

  /** Listen for changes; returns an unsubscribe function. */
  subscribe(listener: CompareListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(): void {
    this.comparison = this.enabled
      ? resolveComparison(
          this.store.current,
          this.overrides,
          this.tables,
          this.index
        )
      : null;
    for (const listener of this.listeners) listener(this.comparison);
  }
}

// ---------------------------------------------------------------------------
// URL params: overrides as prefixed slot params, e.g.
//   b.Shoulder_L=DA_Module_ShoulderLancelot.0&b.Shoulder_L.Shoulder_Weapon_1=
// where an empty value means "emptied in B".
// ---------------------------------------------------------------------------

export const OVERRIDE_PREFIX = 'b.';

/** The overrides encoded in a query string. */
export function readOverrides(
  params: URLSearchParams,
  isSlotKey: SlotKeyMatcher,
  prefix = OVERRIDE_PREFIX
): BuildOverrides {
  const overrides: BuildOverrides = {};
  for (const [param, value] of params) {
    if (!param.startsWith(prefix)) continue;
    const key = param.slice(prefix.length);
    if (isSlotKey(key)) overrides[key] = value || null;
  }
  return overrides;
}

/** Replace every prefixed override param in `params` with `overrides`; other
 * params are left as they are. */
export function writeOverrides(
  params: URLSearchParams,
  overrides: BuildOverrides,
  isSlotKey: SlotKeyMatcher,
  prefix = OVERRIDE_PREFIX
): void {
  for (const param of [...params.keys()]) {
    if (param.startsWith(prefix) && isSlotKey(param.slice(prefix.length))) {
      params.delete(param);
    }
  }
  for (const [key, moduleId] of Object.entries(overrides)) {
    params.set(`${prefix}${key}`, moduleId ?? '');
  }
}
