/**
 * Which placed modules two builds share, for drawing an A vs B comparison in
 * one scene: a module is shared when the same model sits at the same world
 * transform in both. A weapon moved by a shoulder swap is therefore changed,
 * as its hitboxes really moved.
 */
import type { ModulePlacement } from './mount';

/** Model + world transform, rounded to 0.1 cm (translation) and 1e-4
 * (rotation terms) so float noise does not split equal placements. */
function signature({ modelId, world }: ModulePlacement): string | null {
  if (!modelId) return null;
  const e = world.elements;
  // Column-major: 0-11 hold the rotation/scale columns, 12-14 the translation.
  const cells = [
    ...e.slice(0, 12).map((x) => x.toFixed(4)),
    ...e.slice(12, 15).map((x) => x.toFixed(1)),
  ];
  return `${modelId}|${cells.join(',')}`;
}

export interface PlacementDiff {
  /** Per A placement: also in B. */
  sharedA: boolean[];
  /** Per B placement: also in A (drawn once, from A). */
  sharedB: boolean[];
}

/** Match `from`'s placements against a multiset of signatures, consuming
 * each match. */
function takeMatches(
  from: readonly ModulePlacement[],
  available: Map<string, number>
): boolean[] {
  return from.map((placement) => {
    const sig = signature(placement);
    const left = sig === null ? 0 : (available.get(sig) ?? 0);
    if (sig === null || left === 0) return false;
    available.set(sig, left - 1);
    return true;
  });
}

function countSignatures(
  placements: readonly ModulePlacement[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const placement of placements) {
    const sig = signature(placement);
    if (sig !== null) counts.set(sig, (counts.get(sig) ?? 0) + 1);
  }
  return counts;
}

/** Match placements between builds as multisets of (model, transform). */
export function diffPlacements(
  a: readonly ModulePlacement[],
  b: readonly ModulePlacement[]
): PlacementDiff {
  const sharedA = takeMatches(a, countSignatures(b));
  const sharedB = takeMatches(
    b,
    countSignatures(a.filter((_, i) => sharedA[i]))
  );
  return { sharedA, sharedB };
}
