/**
 * Chaos's capsule sweep against a landscape heightfield (FHeightField::
 * SweepGeom) in float32, with its own cell visit order (MVP session 4.5,
 * D26; findings/chaos-sweeps.md).
 *
 * Source: UE 5.4.4 Experimental/Chaos/Private/Chaos/HeightField.cpp
 * - SweepGeomImp (:2163): the query's start point and inflation from the
 *   capsule's bounds rotated by the start rotation (TAABB::TransformedAABB,
 *   TransformedAABBHelper2 in AABB.cpp);
 * - GridSweep (:1412): the flat bounds clip, the rasterised line over the
 *   cell grid (Bresenham), its thickening by whole cells across the major
 *   axis, and the queue that sets the visit order;
 * - THeightfieldSweepVisitor::VisitSweep (:319): the cell's float bounds
 *   thickened and ray-tested (FAABBVectorized::RaycastFast), then its two
 *   triangles (P0, P1, P3) and (P0, P3, P2), each swept by GJK relative to
 *   its first corner (InitialDir (1, 0, 0)); a strictly earlier time
 *   replaces the hit unless the cell is a hole; an initial overlap stops
 *   the visit and takes the triangle's normal (the source's own "this is
 *   incorrect" comment) with GJK's MTD point and depth.
 * `cells`, when given, limits the triangle tests to those cells (the
 * exact layer's candidates); the visit order is unchanged.
 * - HeightField.h GetPointsAndBoundsSimd (:533): float heights, cell
 *   corners (x, y, h) times the float scale.
 */
import type { V3 } from './colliders';
import {
  gjkRaycast,
  relative,
  safeNormal,
  sweepDir,
  toF3,
  toFQ,
  triangleSupport,
  type CapsuleSweepInput,
  type ChaosHit,
  type GjkResult,
  type ShapePose,
} from './chaos_gjk';
import {
  add,
  cross,
  dinv,
  drot,
  f,
  normalize,
  qnormalizeSafe,
  sub,
  type F3,
} from './chaos_simd';

/** A heightfield as Chaos holds it: float heights per vertex (rows x
 * cols, row-major), hole cells, and the geometry scale (GeomData.Scale). */
export interface ChaosHeightfield {
  rows: number;
  cols: number;
  /** float(MinValue + Heights[i] x HeightPerUnit). */
  heights: Float64Array;
  /** One per cell, nonzero = hole (MaterialIndices == 255); or null. */
  holes: ArrayLike<number> | null;
  scale: V3;
}

/** From the oracle's or the export's heightfield fields. */
export function heightfieldOf(s: {
  rows: number;
  cols: number;
  heights: ArrayLike<number>;
  holes?: ArrayLike<number> | null;
  s: V3;
}): ChaosHeightfield {
  const heights = new Float64Array(s.heights.length);
  for (let i = 0; i < heights.length; i++) heights[i] = f(s.heights[i]);
  return {
    rows: s.rows,
    cols: s.cols,
    heights,
    holes: s.holes ?? null,
    scale: s.s,
  };
}

/** Counters for the bench (cells visited, triangles swept). */
export const heightfieldStats = { sweeps: 0, cells: 0, triangles: 0 };

/** FQuat::RotateVector (double). */
function qrotD(q: readonly number[], v: V3): [number, number, number] {
  const tx = 2 * (q[1] * v[2] - q[2] * v[1]);
  const ty = 2 * (q[2] * v[0] - q[0] * v[2]);
  const tz = 2 * (q[0] * v[1] - q[1] * v[0]);
  return [
    v[0] + q[3] * tx + (q[1] * tz - q[2] * ty),
    v[1] + q[3] * ty + (q[2] * tx - q[0] * tz),
    v[2] + q[3] * tz + (q[0] * ty - q[1] * tx),
  ];
}

const sign = (x: number): number => (x > 0 ? 1 : x < 0 ? -1 : 0);

/**
 * FBounds2D::ClipLine (HeightField.h:949) on the flat bounds; returns the
 * clipped 2D ends or null.
 */
function clipLine(
  min: [number, number],
  max: [number, number],
  s: [number, number],
  e: [number, number]
): [[number, number], [number, number]] | null {
  const inside = (p: [number, number]) =>
    p[0] >= min[0] && p[0] <= max[0] && p[1] >= min[1] && p[1] <= max[1];
  const sIn = inside(s);
  const eIn = inside(e);
  if (sIn && eIn) return [s, e];
  const dir: [number, number] = [e[0] - s[0], e[1] - s[1]];
  if (dir[0] * dir[0] + dir[1] * dir[1] < 1e-4) return null;
  const perp = [dir[0] === 0, dir[1] === 0];
  const inv = [perp[0] ? 0 : 1 / dir[0], perp[1] ? 0 : 1 / dir[1]];
  const timeToExit = (p: [number, number], iv: number[]) => {
    const t = [Number.MAX_VALUE, Number.MAX_VALUE];
    for (let a = 0; a < 2; a++) {
      if (iv[a] > 0) t[a] = (max[a] - p[a]) * iv[a];
      else if (iv[a] < 0) t[a] = (p[a] - min[a]) * iv[a];
    }
    return Math.min(Math.abs(t[0]), Math.abs(t[1]));
  };
  if (sIn) {
    const t = timeToExit(s, inv);
    return [s, [s[0] + dir[0] * t, s[1] + dir[1] * t]];
  }
  if (eIn) {
    const t = timeToExit(e, [-inv[0], -inv[1]]);
    return [[e[0] - dir[0] * t, e[1] - dir[1] * t], e];
  }
  const enter = [Number.MAX_VALUE, Number.MAX_VALUE];
  const exit = [Number.MAX_VALUE, Number.MAX_VALUE];
  for (let a = 0; a < 2; a++) {
    if (perp[a]) {
      if (s[a] >= min[a] && s[a] <= max[a]) enter[a] = 0;
    } else if (dir[a] > 0) {
      if (s[a] <= max[a]) {
        enter[a] = Math.max(min[a] - s[a], 0) * inv[a];
        exit[a] = (max[a] - s[a]) * inv[a];
      }
    } else if (dir[a] < 0) {
      if (s[a] >= min[a]) {
        enter[a] = Math.max(s[a] - max[a], 0) * inv[a];
        exit[a] = (s[a] - min[a]) * inv[a];
      }
    }
  }
  const tIn = Math.max(Math.abs(enter[0]), Math.abs(enter[1]));
  const tOut = Math.min(Math.abs(exit[0]), Math.abs(exit[1]));
  if (tOut < tIn) return null;
  return [
    [s[0] + dir[0] * tIn, s[1] + dir[1] * tIn],
    [s[0] + dir[0] * tOut, s[1] + dir[1] * tOut],
  ];
}

/**
 * GridSweep's visit order: calls `visit(cellIndex)` until it returns
 * false. `start`, `dir`, `length` in the heightfield frame (double),
 * `half` the inflation half extents.
 */
export function gridSweepCells(
  hf: ChaosHeightfield,
  start: V3,
  dir: V3,
  length: number,
  half: V3,
  visit: (cell: number) => boolean
): void {
  const cellsX = hf.cols - 1;
  const cellsY = hf.rows - 1;
  // CachedBounds = FromPoints(LocalBounds.Min * Scale, LocalBounds.Max * Scale).
  const bx = [0, cellsX * hf.scale[0]];
  const by = [0, cellsY * hf.scale[1]];
  const min: [number, number] = [
    Math.min(bx[0], bx[1]) - half[0],
    Math.min(by[0], by[1]) - half[1],
  ];
  const max: [number, number] = [
    Math.max(bx[0], bx[1]) + half[0],
    Math.max(by[0], by[1]) + half[1],
  ];
  const sd = [sign(dir[0]), sign(dir[1])];
  const is: [number, number] = [
    start[0] - sd[0] * half[0],
    start[1] - sd[1] * half[1],
  ];
  const ie: [number, number] = [
    start[0] + dir[0] * length + sd[0] * half[0],
    start[1] + dir[1] * length + sd[1] * half[1],
  ];
  const clipped = clipLine(min, max, is, ie);
  if (!clipped) return;
  // TUniformGrid::Cell: (X - 0) / 1 truncated to int, clamped to the cells.
  const cell = (x: number, y: number): [number, number] => {
    const cx = Math.trunc(x);
    const cy = Math.trunc(y);
    return [
      cx >= cellsX ? cellsX - 1 : cx < 0 ? 0 : cx,
      cy >= cellsY ? cellsY - 1 : cy < 0 ? 0 : cy,
    ];
  };
  const startCell = cell(
    clipped[0][0] / hf.scale[0],
    clipped[0][1] / hf.scale[1]
  );
  const endCell = cell(
    clipped[1][0] / hf.scale[0],
    clipped[1][1] / hf.scale[1]
  );
  const deltaX = Math.abs(endCell[0] - startCell[0]);
  const deltaY = -Math.abs(endCell[1] - startCell[1]);
  if (deltaX === 0 && deltaY === 0) {
    const lo = cell(
      (start[0] - half[0]) / hf.scale[0],
      (start[1] - half[1]) / hf.scale[1]
    );
    const hi = cell(
      (start[0] + half[0]) / hf.scale[0],
      (start[1] + half[1]) / hf.scale[1]
    );
    for (let y = lo[1]; y <= hi[1]; y++)
      for (let x = lo[0]; x <= hi[0]; x++) if (!visit(y * cellsX + x)) return;
    return;
  }
  const dirX = startCell[0] < endCell[0] ? 1 : -1;
  const dirY = startCell[1] < endCell[1] ? 1 : -1;
  let error = deltaX + deltaY;
  const thicken: [number, number] =
    Math.abs(deltaX) > Math.abs(deltaY) ? [0, 1] : [1, 0];
  const seen = new Set<number>();
  const key = (c: readonly number[]) => c[1] * cellsX + c[0];
  const queue: { c: [number, number]; toi: number }[] = [
    { c: [startCell[0], startCell[1]], toi: -1 },
  ];
  seen.add(key(startCell));
  const walk: [number, number] = [startCell[0], startCell[1]];
  const expandAxis = thicken[0] === 0 ? 1 : 0;
  const steps = Math.trunc(
    Math.ceil(half[expandAxis] / Math.abs(hf.scale[expandAxis]))
  );
  const expand = (b: [number, number], d: number[]) => {
    const cur: [number, number] = [b[0], b[1]];
    for (let s = 0; s < steps; s++) {
      cur[0] += d[0];
      cur[1] += d[1];
      if (
        cur[0] < 0 ||
        cur[1] < 0 ||
        cur[0] > cellsX - 1 ||
        cur[1] > cellsY - 1
      )
        break;
      const k = key(cur);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ c: [cur[0], cur[1]], toi: 0 });
      }
    }
  };
  let qi = 0;
  while (qi < queue.length) {
    const entry = queue[qi++];
    const c = entry.c;
    if (c[0] >= 0 && c[0] < cellsX && c[1] >= 0 && c[1] < cellsY) {
      if (!visit(c[1] * cellsX + c[0])) return;
    }
    if (entry.toi < 0) {
      expand(c, thicken);
      expand(c, [-thicken[0], -thicken[1]]);
      if (walk[0] !== endCell[0] || walk[1] !== endCell[1]) {
        const e2 = error * 2;
        if (e2 >= deltaY) {
          error += deltaY;
          walk[0] += dirX;
        }
        if (e2 <= deltaX) {
          error += deltaX;
          walk[1] += dirY;
        }
        const k = key(walk);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push({ c: [walk[0], walk[1]], toi: -1 });
        }
      }
    }
  }
}

/** FAABBVectorized::RaycastFast (float, per lane). */
function raycastFast(
  min: F3,
  max: F3,
  start: F3,
  invDir: F3,
  parallel: boolean[],
  length: number
): boolean {
  for (let k = 0; k < 3; k++)
    if (parallel[k] && (min[k] > start[k] || start[k] > max[k])) return false;
  const t1: number[] = [];
  const t2: number[] = [];
  for (let k = 0; k < 3; k++) {
    const a = parallel[k] ? 0 : f(f(min[k] - start[k]) * invDir[k]);
    const b = parallel[k] ? length : f(f(max[k] - start[k]) * invDir[k]);
    t1.push(a < b ? a : b);
    t2.push(a > b ? a : b);
  }
  let late = t1[0] > t1[1] ? t1[0] : t1[1];
  late = late > t1[2] ? late : t1[2];
  late = late > 0 ? late : 0;
  let early = t2[0] < t2[1] ? t2[0] : t2[1];
  early = early < t2[2] ? early : t2[2];
  early = early < length ? early : length;
  return !(late > early);
}

/**
 * SweepQuery against a heightfield placed at `pose` (the landscape
 * collision component's particle; the geometry's own scale is in `hf`).
 */
export function chaosHeightfieldSweep(
  hf: ChaosHeightfield,
  pose: ShapePose,
  input: CapsuleSweepInput,
  cells?: ReadonlySet<number>
): ChaosHit | null {
  heightfieldStats.sweeps++;
  const { dir, mag } = sweepDir(input);
  const rel = relative(pose, input.start, input.rotation);
  const localDir = drot(dinv(pose.q), dir);
  // The capsule's bounds (centre 0) rotated by the start rotation
  // (TransformedAABBHelper2): half extents.
  const r = input.radius;
  const ext: V3 = [r, r, input.halfLength + r];
  const verts: V3[] = [
    [ext[0], ext[1], ext[2]],
    [ext[0], ext[1], -ext[2]],
    [ext[0], -ext[1], ext[2]],
    [ext[0], -ext[1], -ext[2]],
  ];
  const half: [number, number, number] = [0, 0, 0];
  for (const v of verts) {
    const rv = qrotD(rel.q, v);
    for (let k = 0; k < 3; k++) half[k] = Math.max(half[k], Math.abs(rv[k]));
  }
  const startD = rel.t;
  const startF = toF3(startD);
  const dirF = toF3(localDir);
  const parallel = [0, 1, 2].map((k) => Math.abs(dirF[k]) < f(1e-8));
  const invDir = [0, 1, 2].map((k) => (parallel[k] ? 0 : f(1 / dirF[k]))) as F3;
  const inflF = toF3(half).map(Math.abs) as F3;
  const rot = qnormalizeSafe(toFQ(rel.q));
  const sc = toF3(hf.scale);
  const cols = hf.cols;
  let outTime = Number.MAX_VALUE;
  let outPos: F3 = [0, 0, 0];
  let outNormal: F3 = [0, 0, 1];
  let outGjk: GjkResult | null = null;
  let current = mag;
  const h = hf.heights;
  let outFace = -1;
  const visit = (cellIndex: number): boolean => {
    // Cells the exact layer ruled out (no contact within the tie window)
    // can't take the hit: a later cell replaces it only when strictly
    // earlier, and they are not that early.
    if (cells && !cells.has(cellIndex)) return outTime > 0;
    heightfieldStats.cells++;
    const subY = Math.floor(cellIndex / (cols - 1));
    const subX = cellIndex % (cols - 1);
    const vi = cellIndex + subY;
    const h0 = h[vi];
    const h1 = h[vi + 1];
    const h2 = h[vi + cols];
    const h3 = h[vi + cols + 1];
    const p = (x: number, y: number, z: number): F3 => [
      f(f(x) * sc[0]),
      f(f(y) * sc[1]),
      f(z * sc[2]),
    ];
    const pts: F3[] = [
      p(subX, subY, h0),
      p(subX + 1, subY, h1),
      p(subX, subY + 1, h2),
      p(subX + 1, subY + 1, h3),
    ];
    const minZ = Math.min(h0, h1, h2, h3);
    const maxZ = Math.max(h0, h1, h2, h3);
    const q0 = p(subX, subY, minZ);
    const q1 = p(subX + 1, subY + 1, maxZ);
    const bmin: F3 = [0, 1, 2].map((k) =>
      f((q0[k] < q1[k] ? q0[k] : q1[k]) - inflF[k])
    ) as F3;
    const bmax: F3 = [0, 1, 2].map((k) =>
      f((q0[k] > q1[k] ? q0[k] : q1[k]) + inflF[k])
    ) as F3;
    if (raycastFast(bmin, bmax, startF, invDir, parallel, f(current))) {
      const test = (face: number, a: F3, b: F3, c: F3): boolean => {
        if (outTime === 0) return false;
        heightfieldStats.triangles++;
        const ab = sub(b, a);
        const ac = sub(c, a);
        const g = gjkRaycast(
          { support: triangleSupport([0, 0, 0], ab, ac), margin: 0 },
          input.radius,
          input.halfLength,
          rot,
          sub(startF, a),
          dirF,
          f(current),
          true,
          [1, 0, 0]
        );
        if (g.hit && g.time < outTime) {
          const cell = face >> 1;
          if (!(hf.holes && hf.holes[cell])) {
            outNormal = g.normal;
            outPos = add(g.position, a);
            outTime = g.time;
            outGjk = g;
            outFace = face;
            if (g.time <= 0) {
              outNormal = normalize(cross(ab, ac));
              current = 0;
              return false;
            }
            current = g.time;
          }
        }
        return true;
      };
      if (test(cellIndex * 2, pts[0], pts[1], pts[3]))
        test(cellIndex * 2 + 1, pts[0], pts[3], pts[2]);
    }
    return outTime > 0;
  };
  gridSweepCells(hf, startD, localDir, mag, half, visit);
  if (!(outTime <= mag) || outGjk === null) return null;
  const pw = drot(pose.q, outPos);
  const nw = drot(pose.q, outNormal);
  const overlap = !(outTime > 0);
  return {
    distance: outTime,
    overlap,
    time: overlap ? 0 : outTime / mag,
    impactPoint: [pw[0] + pose.t[0], pw[1] + pose.t[1], pw[2] + pose.t[2]],
    normal: safeNormal(nw, 1e-4),
    gjk: outGjk,
    face: outFace,
  };
}
