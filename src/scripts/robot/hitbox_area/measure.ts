/**
 * Projected hitbox area of a build, per health pool (see pools.ts) and view.
 *
 * For every view a grid of parallel rays (one per `cell` x `cell` square) is
 * intersected analytically with the build's hitbox primitives, and each pool
 * gets, in isolation:
 *
 *   alone        silhouette of the pool module's own hitboxes
 *   withWeapons  silhouette of the module + its mounted weapons (overlap once)
 *
 * plus the same two for the whole robot: every pool combined.
 *
 * Areas are in cm^2 (UE units). Nothing here depends on the DOM or WebGL, so
 * any page can measure a build (see robot/assembly.ts).
 */
import {
  intersect,
  preparePrimitive,
  projectRange,
  type PreparedPrimitive,
} from './raycast';
import { VIEWS, mapViews, type ViewName } from './views';
import type { HitboxBody, HitboxPool, HitboxSet } from './pools';
import type { Vec3 } from '../../../types/model';

/** Default ray grid spacing (cm): within ~0.3% of a 1 cm grid at a quarter
 * of the cost. */
export const AREA_CELL_CM = 2;

export interface PoolArea {
  alone: number;
  withWeapons: number;
}

/** Which of a {@link PoolArea}'s two areas. */
export type AreaMetric = keyof PoolArea;

/** One view's areas: per pool, and for the whole robot (every pool's
 * silhouettes combined, overlap counted once). */
export interface ViewAreas {
  pools: PoolArea[];
  total: PoolArea;
  /** Per pool, a UE point on its own hitboxes to point a label at: where the
   * pool is visible (nothing else in front of it) near the middle of that
   * visible part, else anywhere on its silhouette; null when the pool has no
   * area in this view. */
  anchors: (Vec3 | null)[];
}

/** A build's areas from every view. */
export interface HitboxMeasurement {
  pools: HitboxPool[];
  areas: Record<ViewName, ViewAreas>;
}

/** A view's ray grid: `nu` x `nv` cells of `cell` cm, the first centered at
 * (u0, v0) + cell/2 in the view plane; rays start `start` cm along the view
 * direction (in front of everything). Shared by builds that are compared. */
export interface ViewGrid {
  view: ViewName;
  cell: number;
  u0: number;
  v0: number;
  nu: number;
  nv: number;
  start: number;
}

/** Per-cell state of a two-build silhouette diff (whole robot, weapons
 * included). */
export const DiffState = {
  None: 0,
  Shared: 1,
  AOnly: 2,
  BOnly: 3,
} as const;

/** Where A's and B's silhouettes differ in one view: a {@link DiffState} per
 * grid cell (row-major, `j * nu + i`). */
export interface DiffRaster {
  grid: ViewGrid;
  states: Uint8Array;
}

export interface ComparisonView {
  a: ViewAreas;
  b: ViewAreas;
  /** Null when neither build has hitboxes. */
  diff: DiffRaster | null;
}

/** Builds A and B measured on shared grids, from every view. */
export interface ComparisonMeasurement {
  poolsA: HitboxPool[];
  poolsB: HitboxPool[];
  views: Record<ViewName, ComparisonView>;
}

/** Pools are tracked as bits of a 32-bit mask per cell. */
const MAX_POOLS = 32;

interface PreparedView {
  prepared: PreparedPrimitive[];
  /** Per prepared primitive: the pool its hits go to, and whether it is a
   * weapon's. */
  owners: { pool: number; weapon: boolean }[];
  rects: { u: [number, number]; v: [number, number]; d: [number, number] }[];
}

/** Pooled primitives of `bodies`, ready to intersect, with their projected
 * bounds in `view`. */
function prepareView(
  bodies: readonly HitboxBody[],
  view: ViewName
): PreparedView {
  const { dir, u, v } = VIEWS[view];
  const prepared: PreparedPrimitive[] = [];
  const owners: PreparedView['owners'] = [];
  for (const { pool, weapon, primitives } of bodies) {
    if (pool === null) continue;
    for (const primitive of primitives) {
      prepared.push(preparePrimitive(primitive));
      owners.push({ pool, weapon });
    }
  }
  const rects = prepared.map((pp) => ({
    u: projectRange(pp, u),
    v: projectRange(pp, v),
    d: projectRange(pp, dir),
  }));
  return { prepared, owners, rects };
}

/** The grid covering every prepared set (null when all are empty). */
function gridFor(
  sets: readonly PreparedView[],
  view: ViewName,
  cell: number
): ViewGrid | null {
  const rects = sets.flatMap((set) => set.rects);
  if (rects.length === 0) return null;
  const u0 = Math.min(...rects.map((r) => r.u[0]));
  const v0 = Math.min(...rects.map((r) => r.v[0]));
  const u1 = Math.max(...rects.map((r) => r.u[1]));
  const v1 = Math.max(...rects.map((r) => r.v[1]));
  return {
    view,
    cell,
    u0,
    v0,
    nu: Math.max(1, Math.ceil((u1 - u0) / cell)),
    nv: Math.max(1, Math.ceil((v1 - v0) / cell)),
    start: Math.min(...rects.map((r) => r.d[0])) - 1,
  };
}

/** UE point of grid cell `c`'s center on the grid's start plane. */
function cellPoint(grid: ViewGrid, c: number): Vec3 {
  const { dir, u, v } = VIEWS[grid.view];
  const su = grid.u0 + ((c % grid.nu) + 0.5) * grid.cell;
  const sv = grid.v0 + (Math.floor(c / grid.nu) + 0.5) * grid.cell;
  const at = (k: number): number => u[k] * su + v[k] * sv + dir[k] * grid.start;
  return [at(0), at(1), at(2)];
}

/** Per-cell bitmasks of the pools hit: `own` by a pool module's own
 * hitboxes, `any` by the module or its weapons. `front` is the nearest hit's
 * pool as `pool * 2 + (weapon ? 1 : 0)`, or -1 for none. */
interface PoolMasks {
  own: Uint32Array;
  any: Uint32Array;
  front: Int8Array;
}

function rasterize(set: PreparedView, grid: ViewGrid): PoolMasks {
  const { dir, u, v } = VIEWS[grid.view];
  const { cell, u0, v0, nu, nv, start } = grid;
  const own = new Uint32Array(nu * nv);
  const any = new Uint32Array(nu * nv);
  const front = new Int8Array(nu * nv).fill(-1);
  const nearest = new Float64Array(nu * nv).fill(Infinity);
  const o: Vec3 = [0, 0, 0];
  set.prepared.forEach((pp, idx) => {
    const { pool, weapon } = set.owners[idx];
    const bit = 1 << pool;
    const r = set.rects[idx];
    const i0 = Math.max(0, Math.floor((r.u[0] - u0) / cell));
    const i1 = Math.min(nu - 1, Math.floor((r.u[1] - u0) / cell));
    const j0 = Math.max(0, Math.floor((r.v[0] - v0) / cell));
    const j1 = Math.min(nv - 1, Math.floor((r.v[1] - v0) / cell));
    for (let j = j0; j <= j1; j++) {
      const sv = v0 + (j + 0.5) * cell;
      for (let i = i0; i <= i1; i++) {
        const su = u0 + (i + 0.5) * cell;
        o[0] = u[0] * su + v[0] * sv + dir[0] * start;
        o[1] = u[1] * su + v[1] * sv + dir[1] * start;
        o[2] = u[2] * su + v[2] * sv + dir[2] * start;
        const t = intersect(pp, o, dir);
        if (t === Infinity) continue;
        const c = j * nu + i;
        any[c] |= bit;
        if (!weapon) own[c] |= bit;
        if (t < nearest[c]) {
          nearest[c] = t;
          front[c] = pool * 2 + (weapon ? 1 : 0);
        }
      }
    }
  });
  return { own, any, front };
}

/** The cell of those `has` accepts nearest their centroid, or -1. */
function centralCell(
  cellCount: number,
  nu: number,
  has: (c: number) => boolean
): number {
  let n = 0;
  let si = 0;
  let sj = 0;
  for (let c = 0; c < cellCount; c++) {
    if (!has(c)) continue;
    n += 1;
    si += c % nu;
    sj += Math.floor(c / nu);
  }
  if (n === 0) return -1;
  const ci = si / n;
  const cj = sj / n;
  let best = -1;
  let bestD = Infinity;
  for (let c = 0; c < cellCount; c++) {
    if (!has(c)) continue;
    const d = ((c % nu) - ci) ** 2 + (Math.floor(c / nu) - cj) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Each pool's label anchor (see ViewAreas.anchors): the central cell where
 * the pool's own hitboxes are frontmost, or failing that where they cover. */
function poolAnchors(
  masks: PoolMasks,
  grid: ViewGrid,
  poolCount: number
): (Vec3 | null)[] {
  const { own, front } = masks;
  return Array.from({ length: poolCount }, (_, p) => {
    let c = centralCell(own.length, grid.nu, (cell) => front[cell] === p * 2);
    if (c < 0) {
      c = centralCell(
        own.length,
        grid.nu,
        (cell) => (own[cell] & (1 << p)) !== 0
      );
    }
    return c < 0 ? null : cellPoint(grid, c);
  });
}

function sumAreas(
  masks: PoolMasks | null,
  grid: ViewGrid | null,
  poolCount: number
): ViewAreas {
  const pools = Array.from({ length: poolCount }, () => ({
    alone: 0,
    withWeapons: 0,
  }));
  const total = { alone: 0, withWeapons: 0 };
  if (!masks || !grid) {
    return { pools, total, anchors: pools.map(() => null) };
  }
  const area = grid.cell * grid.cell;
  const { own, any } = masks;
  for (let c = 0; c < any.length; c++) {
    const a = any[c];
    if (a === 0) continue;
    const s = own[c];
    total.withWeapons += area;
    if (s !== 0) total.alone += area;
    for (let p = 0; p < poolCount; p++) {
      const bit = 1 << p;
      if (a & bit) pools[p].withWeapons += area;
      if (s & bit) pools[p].alone += area;
    }
  }
  return { pools, total, anchors: poolAnchors(masks, grid, poolCount) };
}

function checkPoolCount(poolCount: number): void {
  if (poolCount > MAX_POOLS) {
    throw new Error(`too many hitbox pools (${poolCount})`);
  }
}

/** Per-pool and whole-robot areas (cm^2) of a build's hitboxes in one view.
 * `cell` is the ray grid spacing in cm; each hit cell contributes cell^2. */
export function measureView(
  bodies: readonly HitboxBody[],
  poolCount: number,
  view: ViewName,
  cell = AREA_CELL_CM
): ViewAreas {
  checkPoolCount(poolCount);
  const set = prepareView(bodies, view);
  const grid = gridFor([set], view, cell);
  return sumAreas(grid && rasterize(set, grid), grid, poolCount);
}

/** A build's per-pool and whole-robot areas from every view. */
export function measureHitboxes(
  { pools, bodies }: HitboxSet,
  cell = AREA_CELL_CM
): HitboxMeasurement {
  return {
    pools,
    areas: mapViews((view) => measureView(bodies, pools.length, view, cell)),
  };
}

function diffStates(grid: ViewGrid, a: PoolMasks, b: PoolMasks): Uint8Array {
  const states = new Uint8Array(grid.nu * grid.nv);
  for (let c = 0; c < states.length; c++) {
    const inA = a.any[c] !== 0;
    const inB = b.any[c] !== 0;
    if (inA) states[c] = inB ? DiffState.Shared : DiffState.AOnly;
    else states[c] = inB ? DiffState.BOnly : DiffState.None;
  }
  return states;
}

/** Areas of builds A and B from every view, rasterized on one shared grid per
 * view so their silhouettes can be diffed cell for cell. */
export function compareHitboxes(
  a: HitboxSet,
  b: HitboxSet,
  cell = AREA_CELL_CM
): ComparisonMeasurement {
  checkPoolCount(a.pools.length);
  checkPoolCount(b.pools.length);
  const views = mapViews((view): ComparisonView => {
    const setA = prepareView(a.bodies, view);
    const setB = prepareView(b.bodies, view);
    const grid = gridFor([setA, setB], view, cell);
    const masksA = grid && rasterize(setA, grid);
    const masksB = grid && rasterize(setB, grid);
    return {
      a: sumAreas(masksA, grid, a.pools.length),
      b: sumAreas(masksB, grid, b.pools.length),
      diff:
        grid && masksA && masksB
          ? { grid, states: diffStates(grid, masksA, masksB) }
          : null,
    };
  });
  return { poolsA: a.pools, poolsB: b.pools, views };
}
