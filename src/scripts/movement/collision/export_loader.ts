/**
 * The map's collision export (`Maps/<Map>.collision.bin`, read by
 * data/collision_file.ts) as the colliders of an exact collision world:
 * part `base`, the chosen mode's sublevels and one lighting variant.
 *
 * Every collider of a loaded part is kept, flags and all:
 * - hidden, boundary, ceiling: they block (the invisible walls and the
 *   ceiling slab are the point);
 * - destructible: loaded intact (the start of a match; destruction is out
 *   of scope);
 * - moving (SMovingPlatform): loaded at its exported start position, a
 *   known gap (D20);
 * - double_sided (bit 32): the triangle mesh blocks from both sides;
 *   without it a complex-as-simple mesh is one-sided.
 */
import {
  META_FLAGS,
  META_PART,
  META_SOURCE,
  META_WIDTH,
  selectParts,
  type CollisionFile,
  type PartChoice,
  type PartSelection,
  type Rows,
} from '../data/collision_file';
import {
  emptyColliderSet,
  type ColliderInfo,
  type ColliderSet,
  type HullBody,
  type Quat,
  type V3,
} from './exact/colliders';

export interface LoadedColliders {
  set: ColliderSet;
  selection: PartSelection;
  /** Colliders loaded per flag name (debug list). */
  flagged: Record<string, number>;
}

const v3 = (a: ArrayLike<number>, o: number): V3 => [a[o], a[o + 1], a[o + 2]];
const q4 = (a: ArrayLike<number>, o: number): Quat => [
  a[o],
  a[o + 1],
  a[o + 2],
  a[o + 3],
];

export function collidersFromFile(
  file: CollisionFile,
  choice: PartChoice
): LoadedColliders {
  const selection = selectParts(file, choice);
  const set = emptyColliderSet();
  const flagged: Record<string, number> = {};
  for (const name of Object.keys(file.flags)) flagged[name] = 0;
  const flagNames = Object.entries(file.flags);

  const take = (meta: Rows<Uint32Array>, i: number): ColliderInfo | null => {
    const m = meta.data;
    if (!selection.parts.has(m[i * META_WIDTH + META_PART])) return null;
    const flags = m[i * META_WIDTH + META_FLAGS];
    for (const [name, bit] of flagNames) if (flags & bit) flagged[name]++;
    const source = file.sources[m[i * META_WIDTH + META_SOURCE]];
    if (source === undefined)
      throw new Error(`collision file: source index out of range`);
    return { source, flags };
  };

  {
    const { data, meta } = file.boxes;
    for (let i = 0; i < data.count; i++) {
      const info = take(meta, i);
      if (!info) continue;
      const o = i * 10;
      set.boxes.push({
        center: v3(data.data, o),
        rotation: q4(data.data, o + 3),
        halfExtents: v3(data.data, o + 7),
        info,
      });
    }
  }
  {
    const { data, meta } = file.spheres;
    for (let i = 0; i < data.count; i++) {
      const info = take(meta, i);
      if (!info) continue;
      set.spheres.push({
        center: v3(data.data, i * 4),
        radius: data.data[i * 4 + 3],
        info,
      });
    }
  }
  {
    const { data, meta } = file.capsules;
    for (let i = 0; i < data.count; i++) {
      const info = take(meta, i);
      if (!info) continue;
      const o = i * 9;
      set.capsules.push({
        center: v3(data.data, o),
        rotation: q4(data.data, o + 3),
        radius: data.data[o + 7],
        halfLength: data.data[o + 8],
        info,
      });
    }
  }
  {
    const lib = file.hulls;
    const bodies = new Map<number, HullBody>();
    const body = (index: number): HullBody => {
      let b = bodies.get(index);
      if (!b) {
        if (index >= lib.ranges.count)
          throw new Error('collision file: hull index out of range');
        const first = lib.ranges.data[index * 4];
        const count = lib.ranges.data[index * 4 + 1];
        const firstT = lib.ranges.data[index * 4 + 2];
        const countT = lib.ranges.data[index * 4 + 3];
        b = {
          points: Float64Array.from(
            lib.vertices.data.subarray(first * 3, (first + count) * 3)
          ),
          faces: lib.triangles.data.subarray(firstT * 3, (firstT + countT) * 3),
        };
        bodies.set(index, b);
      }
      return b;
    };
    const { index, transform, meta } = file.hullInstances;
    for (let i = 0; i < index.count; i++) {
      const info = take(meta, i);
      if (!info) continue;
      const o = i * 10;
      set.hulls.push({
        body: body(index.data[i]),
        t: v3(transform.data, o),
        q: q4(transform.data, o + 3),
        s: v3(transform.data, o + 7),
        info,
      });
    }
  }
  {
    const lib = file.meshes;
    const { index, transform, meta } = file.meshInstances;
    for (let i = 0; i < index.count; i++) {
      const info = take(meta, i);
      if (!info) continue;
      const m = index.data[i];
      if (m >= lib.ranges.count)
        throw new Error('collision file: mesh index out of range');
      const [firstV, countV, firstT, countT] = lib.ranges.data.subarray(
        m * 4,
        m * 4 + 4
      );
      const o = i * 10;
      set.meshes.push({
        vertices: lib.vertices.data.subarray(firstV * 3, (firstV + countV) * 3),
        // Library triangles index the mesh's own vertices.
        triangles: lib.triangles.data.subarray(
          firstT * 3,
          (firstT + countT) * 3
        ),
        t: v3(transform.data, o),
        q: q4(transform.data, o + 3),
        s: v3(transform.data, o + 7),
        doubleSided: (info.flags & file.flags.double_sided) !== 0,
        info,
      });
    }
  }
  {
    const hf = file.heightfields;
    for (let g = 0; g < hf.grid.count; g++) {
      const info = take(hf.meta, g);
      if (!info) continue;
      const [rows, cols, first, firstHole] = hf.grid.data.subarray(
        g * 4,
        g * 4 + 4
      );
      const [minValue, perUnit] = hf.decode.data.subarray(g * 2, g * 2 + 2);
      const heights = new Float64Array(rows * cols);
      for (let i = 0; i < rows * cols; i++)
        heights[i] = minValue + hf.heights.data[first + i] * perUnit;
      const cells = (rows - 1) * (cols - 1);
      const holes =
        firstHole >= 0
          ? hf.holes.data.slice(firstHole, firstHole + cells)
          : null;
      const o = g * 10;
      set.heightfields.push({
        rows,
        cols,
        heights,
        holes,
        t: v3(hf.transform.data, o),
        q: q4(hf.transform.data, o + 3),
        s: v3(hf.transform.data, o + 7),
        info,
      });
    }
  }
  return { set, selection, flagged };
}
