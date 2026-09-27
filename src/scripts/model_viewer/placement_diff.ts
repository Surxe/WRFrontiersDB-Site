/**
 * Which placed modules two builds share, for drawing an A vs B comparison in
 * one 3D scene: a module is shared when the same model sits at the same world
 * transform in both. A weapon moved by a shoulder swap is therefore changed,
 * as its hitboxes really moved.
 */
import type { ModulePlacement } from './mount';

/** Transform tolerance: world matrices are compared rounded to 0.1 cm (and
 * 1e-4 for rotation terms). */
function signature(placement: ModulePlacement): string | null {
  if (!placement.model_id) return null;
  const m = placement.world;
  const cells = [0, 1, 2].flatMap((r) =>
    [0, 1, 2, 3].map((c) => (c === 3 ? m[r][c].toFixed(1) : m[r][c].toFixed(4)))
  );
  return `${placement.model_id}|${cells.join(',')}`;
}

export interface PlacementDiff {
  /** Per A placement: also in B. */
  sharedA: boolean[];
  /** Per B placement: also in A (drawn once, from A). */
  sharedB: boolean[];
}

/** Match placements between builds as multisets of (model, transform). */
export function diffPlacements(
  a: readonly ModulePlacement[],
  b: readonly ModulePlacement[]
): PlacementDiff {
  const pool = new Map<string, number>();
  for (const placement of b) {
    const sig = signature(placement);
    if (sig) pool.set(sig, (pool.get(sig) ?? 0) + 1);
  }
  const sharedA = a.map((placement) => {
    const sig = signature(placement);
    const left = sig ? (pool.get(sig) ?? 0) : 0;
    if (left === 0) return false;
    pool.set(sig!, left - 1);
    return true;
  });
  const matched = new Map<string, number>();
  a.forEach((placement, i) => {
    const sig = signature(placement);
    if (sig && sharedA[i]) matched.set(sig, (matched.get(sig) ?? 0) + 1);
  });
  const sharedB = b.map((placement) => {
    const sig = signature(placement);
    const left = sig ? (matched.get(sig) ?? 0) : 0;
    if (left === 0) return false;
    matched.set(sig!, left - 1);
    return true;
  });
  return { sharedA, sharedB };
}
