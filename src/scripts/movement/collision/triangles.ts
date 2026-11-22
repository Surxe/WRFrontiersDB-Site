/**
 * Collision geometry as plain arrays: the map handed over one piece at a
 * time (one placed mesh, already in world space), so no caller has to hold
 * the whole map's triangles at once.
 */

/** Triangles in Unreal space (cm, Z up), indexed. */
export interface TrianglePiece {
  /** xyz per vertex. */
  positions: Float32Array;
  /** Three vertex indices per triangle. */
  indices: Uint32Array;
}

/** Split `piece` into cells of `cellSize` cm (X/Y grid, by triangle
 * centroid), each re-indexed to its own vertices. Pieces smaller than one
 * cell come back as they are. Used to keep any one collider (and so any one
 * build step) small: the landscape alone is millions of triangles. */
export function splitByGrid(
  piece: TrianglePiece,
  cellSize: number
): TrianglePiece[] {
  const { positions: p, indices: idx } = piece;
  const triangles = idx.length / 3;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let v = 0; v < p.length; v += 3) {
    minX = Math.min(minX, p[v]);
    maxX = Math.max(maxX, p[v]);
    minY = Math.min(minY, p[v + 1]);
    maxY = Math.max(maxY, p[v + 1]);
  }
  const columns = Math.max(1, Math.ceil((maxX - minX) / cellSize));
  const rows = Math.max(1, Math.ceil((maxY - minY) / cellSize));
  if (columns * rows === 1) return [piece];

  // Bucket triangles by cell (counting sort: count, offsets, fill).
  const cellOf = new Uint32Array(triangles);
  const counts = new Uint32Array(columns * rows);
  for (let t = 0; t < triangles; t++) {
    const a = idx[t * 3] * 3;
    const b = idx[t * 3 + 1] * 3;
    const c = idx[t * 3 + 2] * 3;
    const cx = (p[a] + p[b] + p[c]) / 3;
    const cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3;
    const column = Math.min(columns - 1, Math.floor((cx - minX) / cellSize));
    const row = Math.min(rows - 1, Math.floor((cy - minY) / cellSize));
    const cell = row * columns + column;
    cellOf[t] = cell;
    counts[cell]++;
  }
  const offsets = new Uint32Array(counts.length + 1);
  for (let cell = 0; cell < counts.length; cell++) {
    offsets[cell + 1] = offsets[cell] + counts[cell];
  }
  const order = new Uint32Array(triangles);
  const fill = offsets.slice(0, counts.length);
  for (let t = 0; t < triangles; t++) order[fill[cellOf[t]]++] = t;

  // Re-index each cell. `stamp` marks which cell a remap entry belongs to,
  // so one remap array serves every cell.
  const remap = new Int32Array(p.length / 3);
  const stamp = new Int32Array(p.length / 3).fill(-1);
  const out: TrianglePiece[] = [];
  for (let cell = 0; cell < counts.length; cell++) {
    const start = offsets[cell];
    const end = offsets[cell + 1];
    if (start === end) continue;
    const indices = new Uint32Array((end - start) * 3);
    const verts: number[] = [];
    for (let i = start; i < end; i++) {
      const t = order[i];
      for (let k = 0; k < 3; k++) {
        const v = idx[t * 3 + k];
        if (stamp[v] !== cell) {
          stamp[v] = cell;
          remap[v] = verts.length / 3;
          verts.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
        }
        indices[(i - start) * 3 + k] = remap[v];
      }
    }
    out.push({ positions: new Float32Array(verts), indices });
  }
  return out;
}
