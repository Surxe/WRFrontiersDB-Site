/**
 * Projected hitbox area of a build, per health pool and view direction.
 *
 * The torso and each shoulder are their own health pools, and the chassis
 * splits into three (pelvis, left leg, right leg: the armor zones its
 * components link, see the parser's model export); a weapon's hits go to the
 * pool of the part it is mounted on. For every view a grid of
 * parallel rays (one per `cell` x `cell` square) is intersected analytically
 * with the build's hitbox primitives, and each pool gets, in isolation:
 *
 *   alone        silhouette of the pool module's own hitboxes
 *   withWeapons  silhouette of the module + its mounted weapons (overlap once)
 *
 * plus the same two for the whole robot: every pool combined.
 *
 * Areas are in cm^2 (UE units). Views are UE directions: X forward, Y right,
 * Z up. Nothing here depends on three.js or the DOM.
 */
import { hitboxPrimitives, type HitboxPrimitive } from './hitbox';
import type { Mat4 } from './math';
import type { ModulePlacement } from './mount';
import { kindOfModule } from './build/classify';
import { refToId } from '../../utils/object_reference';
import type { BuildTables, ModuleKind } from './build/types';
import type { ModuleModel } from '../../types/model';
import type { CharacterPresetModule } from '../../types/character_preset';
import type { Vec3 } from '../../types/model';

export type ViewName = 'front' | 'back' | 'left' | 'right' | 'top';

export interface ViewDef {
  label: string;
  /** Ray direction (from the viewer into the robot). */
  dir: Vec3;
  /** Two unit axes spanning the view plane (the ray grid's axes). */
  u: Vec3;
  v: Vec3;
}

export const VIEWS: Record<ViewName, ViewDef> = {
  front: { label: 'Front', dir: [-1, 0, 0], u: [0, -1, 0], v: [0, 0, 1] },
  back: { label: 'Back', dir: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  left: { label: 'Left', dir: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  right: { label: 'Right', dir: [0, -1, 0], u: [-1, 0, 0], v: [0, 0, 1] },
  top: { label: 'Top', dir: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
};

export const VIEW_ORDER: readonly ViewName[] = [
  'front',
  'back',
  'left',
  'right',
  'top',
];

/** One health pool: a chassis zone (pelvis / leg), the torso or a shoulder
 * (with its mounted weapons). */
export interface HitboxPool {
  /** Stable identity across builds (`torso`, `shoulder:left`,
   * `chassis:<zone>`, ...), for matching pools between two builds. */
  key: string;
  label: string;
  kind: 'chassis' | 'torso' | 'shoulder';
  /** Which side a shoulder or leg sits on; its inner-side view is not
   * measured. */
  side: 'left' | 'right' | null;
  /** Armor zone id of a chassis pool split by zone, else null. */
  zone: string | null;
  /** Index (in the module list) of the pool's own module. */
  moduleIndex: number;
  moduleId: string;
  /** Module ids of the weapons mounted on it (their hits go to this pool). */
  weaponIds: string[];
  /** Module-list indices of those weapons, parallel to `weaponIds`. */
  weaponIndices: number[];
}

/** A placed module's hitboxes (or one armor zone's share of them) and the
 * pool its hits go to. */
export interface HitboxBody {
  primitives: HitboxPrimitive[];
  /** Index (in the module list) of the module these hitboxes belong to. */
  moduleIndex: number;
  /** Armor zone of these hitboxes, when the module splits by zone. */
  zone: string | null;
  /** Pool index, or null for modules outside any pool (chassis, gear), which
   * are not measured. */
  pool: number | null;
  /** True for a weapon counted toward its parent's pool. */
  weapon: boolean;
}

export interface PoolArea {
  alone: number;
  withWeapons: number;
}

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

/** A pool's outer side is measured; the side facing the torso is not. */
export function viewApplies(pool: HitboxPool, view: ViewName): boolean {
  if (pool.side === 'left') return view !== 'right';
  if (pool.side === 'right') return view !== 'left';
  return true;
}

function sideOfSocket(
  socketName: string | null | undefined
): 'left' | 'right' | null {
  if (!socketName) return null;
  if (socketName.endsWith('_L')) return 'left';
  if (socketName.endsWith('_R')) return 'right';
  return null;
}

/**
 * Health pools of a module list (preset shape, parents first), and which pool
 * each entry's hits go to: the chassis, torso and shoulders are pools; a
 * weapon joins the nearest pool part above it (its mount); everything else
 * (gear) is in no pool.
 */
export function assignPools(
  presetModules: readonly CharacterPresetModule[],
  kindOf: (index: number) => ModuleKind
): { pools: HitboxPool[]; poolOf: (number | null)[]; weapon: boolean[] } {
  const pools: HitboxPool[] = [];
  const poolOf: (number | null)[] = new Array(presetModules.length).fill(null);
  const weapon: boolean[] = new Array(presetModules.length).fill(false);
  presetModules.forEach((entry, i) => {
    const kind = kindOf(i);
    if (kind === 'chassis' || kind === 'torso' || kind === 'shoulder') {
      const side = kind === 'shoulder' ? sideOfSocket(entry.socket_name) : null;
      const label =
        kind === 'chassis'
          ? 'Chassis'
          : kind === 'torso'
            ? 'Torso'
            : side === 'left'
              ? 'Left Shoulder'
              : side === 'right'
                ? 'Right Shoulder'
                : 'Shoulder';
      poolOf[i] = pools.length;
      const key = kind === 'shoulder' ? `shoulder:${side ?? i}` : kind;
      pools.push({
        key,
        label,
        kind,
        side,
        zone: null,
        moduleIndex: i,
        moduleId: refToId(entry.module_ref),
        weaponIds: [],
        weaponIndices: [],
      });
      return;
    }
    if (kind !== 'weapon') return;
    weapon[i] = true;
    for (
      let p = entry.parent_socket_index;
      p >= 0;
      p = presetModules[p].parent_socket_index
    ) {
      const pool = poolOf[p];
      if (pool !== null) {
        poolOf[i] = pool;
        pools[pool].weaponIds.push(refToId(entry.module_ref));
        pools[pool].weaponIndices.push(i);
        break;
      }
    }
  });
  return { pools, poolOf, weapon };
}

/** The chassis's armor zones, in display order. */
const CHASSIS_ZONES: Record<
  string,
  { label: string; side: 'left' | 'right' | null }
> = {
  'DA_ArmorZone_Pelvis.0': { label: 'Pelvis', side: null },
  'DA_ArmorZone_LeftLeg.0': { label: 'Left Leg', side: 'left' },
  'DA_ArmorZone_RightLeg.0': { label: 'Right Leg', side: 'right' },
};

const zoneRank = (zone: string | null): number => {
  const i = Object.keys(CHASSIS_ZONES).indexOf(zone ?? '');
  return i < 0 ? Infinity : i;
};

/** A pool per armor zone of a chassis whose hitboxes span several zones
 * (pelvis first; the first pool also takes any weapon mounted on the
 * chassis). Hitboxes with no zone get a plain "Chassis" pool. */
function splitChassis(
  pool: HitboxPool,
  zones: (string | null)[]
): HitboxPool[] {
  return [...zones]
    .sort((a, b) => zoneRank(a) - zoneRank(b))
    .map((zone, n) => ({
      ...pool,
      key: `chassis:${zone ?? 'other'}`,
      label: (zone ? CHASSIS_ZONES[zone]?.label : undefined) ?? 'Chassis',
      side: (zone ? CHASSIS_ZONES[zone]?.side : undefined) ?? null,
      zone,
      weaponIds: n === 0 ? pool.weaponIds : [],
      weaponIndices: n === 0 ? pool.weaponIndices : [],
    }));
}

/** Pools + hitbox bodies of a placed build (see mount.ts computeModuleWorlds);
 * modules whose model is not loaded contribute no hitboxes. */
export function collectBodies(
  presetModules: readonly CharacterPresetModule[],
  placements: readonly ModulePlacement[],
  models: ReadonlyMap<string, ModuleModel>,
  tables: Pick<BuildTables, 'modules' | 'moduleTypes'>
): { pools: HitboxPool[]; bodies: HitboxBody[] } {
  const {
    pools: modulePools,
    poolOf,
    weapon,
  } = assignPools(presetModules, (i) =>
    kindOfModule(placements[i].module_id, tables)
  );
  const primitives = placements.map((placement) => {
    const model = placement.model_id
      ? models.get(placement.model_id)
      : undefined;
    return model ? hitboxPrimitives(model, placement.world) : [];
  });

  // Module pools -> final pools, splitting each chassis by armor zone.
  const pools: HitboxPool[] = [];
  const firstPool: number[] = []; // module pool -> its (first) final pool
  const zonePool = new Map<number, Map<string | null, number>>(); // chassis module pool -> zone -> final pool
  modulePools.forEach((pool, p) => {
    firstPool[p] = pools.length;
    const zones = new Set(
      primitives[pool.moduleIndex].map((prim) => prim.zone ?? null)
    );
    if (pool.kind !== 'chassis' || zones.size < 2) {
      pools.push(pool);
      return;
    }
    const byZone = new Map<string | null, number>();
    for (const split of splitChassis(pool, [...zones])) {
      byZone.set(split.zone, pools.length);
      pools.push(split);
    }
    zonePool.set(p, byZone);
  });

  const bodies: HitboxBody[] = [];
  placements.forEach((_, i) => {
    const p = poolOf[i];
    const byZone = p === null ? undefined : zonePool.get(p);
    if (p === null || !byZone || weapon[i]) {
      bodies.push({
        primitives: primitives[i],
        moduleIndex: i,
        zone: null,
        pool: p === null ? null : firstPool[p],
        weapon: weapon[i],
      });
      return;
    }
    for (const [zone, pool] of byZone) {
      bodies.push({
        primitives: primitives[i].filter(
          (prim) => (prim.zone ?? null) === zone
        ),
        moduleIndex: i,
        zone,
        pool,
        weapon: false,
      });
    }
  });
  return { pools, bodies };
}

// ---------------------------------------------------------------------------
// Ray / primitive intersection (in the primitive's local frame)
// ---------------------------------------------------------------------------

/** Row-major 3x4 inverse of an affine Mat4 (rotation/scale + translation). */
function affineInverse(m: Mat4): Float64Array {
  const [a, b, c] = [m[0][0], m[0][1], m[0][2]];
  const [d, e, f] = [m[1][0], m[1][1], m[1][2]];
  const [g, h, k] = [m[2][0], m[2][1], m[2][2]];
  const A = e * k - f * h;
  const B = f * g - d * k;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const inv = [
    A,
    c * h - b * k,
    b * f - c * e,
    B,
    a * k - c * g,
    c * d - a * f,
    C,
    b * g - a * h,
    a * e - b * d,
  ].map((x) => x / det);
  const t = [m[0][3], m[1][3], m[2][3]];
  const out = new Float64Array(12);
  for (let r = 0; r < 3; r++) {
    out[r * 4] = inv[r * 3];
    out[r * 4 + 1] = inv[r * 3 + 1];
    out[r * 4 + 2] = inv[r * 3 + 2];
    out[r * 4 + 3] = -(
      inv[r * 3] * t[0] +
      inv[r * 3 + 1] * t[1] +
      inv[r * 3 + 2] * t[2]
    );
  }
  return out;
}

/** Nearest t >= 0 where ro + t*rd enters a sphere (center c, radius r), else Infinity. */
function hitSphere(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  r: number
): number {
  const a = dx * dx + dy * dy + dz * dz;
  const b = ox * dx + oy * dy + oz * dz;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / a;
  return t >= 0 ? t : Infinity;
}

/** Capsule along local Z: a cylinder of `length` capped by two spheres. */
function hitCapsule(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  r: number,
  length: number
): number {
  const half = length / 2;
  let best = Math.min(
    hitSphere(ox, oy, oz - half, dx, dy, dz, r),
    hitSphere(ox, oy, oz + half, dx, dy, dz, r)
  );
  // Infinite cylinder x^2 + y^2 = r^2, clipped to |z| <= half.
  const a = dx * dx + dy * dy;
  if (a > 1e-12) {
    const b = ox * dx + oy * dy;
    const c = ox * ox + oy * oy - r * r;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a;
      const z = oz + t * dz;
      if (t >= 0 && z >= -half && z <= half && t < best) best = t;
    }
  }
  return best;
}

/** Axis-aligned box of half-size (hx, hy, hz) centered at the origin. */
function hitBox(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  hx: number,
  hy: number,
  hz: number
): number {
  let tmin = 0;
  let tmax = Infinity;
  const slab = (o: number, d: number, h: number): boolean => {
    if (Math.abs(d) < 1e-12) return o >= -h && o <= h;
    let t1 = (-h - o) / d;
    let t2 = (h - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    return tmin <= tmax;
  };
  if (!slab(ox, dx, hx) || !slab(oy, dy, hy) || !slab(oz, dz, hz))
    return Infinity;
  return tmin;
}

interface PreparedPrim {
  inv: Float64Array;
  prim: HitboxPrimitive;
  body: number;
  /** Local-frame half-size bounding the primitive (for grid culling). */
  half: Vec3;
}

function localHalfSize(p: HitboxPrimitive): Vec3 {
  if (p.kind === 'box')
    return [p.extent[0] / 2, p.extent[1] / 2, p.extent[2] / 2];
  if (p.kind === 'capsule')
    return [p.radius, p.radius, p.length / 2 + p.radius];
  return [p.radius, p.radius, p.radius];
}

function hitPrim(pp: PreparedPrim, o: Vec3, d: Vec3): number {
  const m = pp.inv;
  const ox = m[0] * o[0] + m[1] * o[1] + m[2] * o[2] + m[3];
  const oy = m[4] * o[0] + m[5] * o[1] + m[6] * o[2] + m[7];
  const oz = m[8] * o[0] + m[9] * o[1] + m[10] * o[2] + m[11];
  const dx = m[0] * d[0] + m[1] * d[1] + m[2] * d[2];
  const dy = m[4] * d[0] + m[5] * d[1] + m[6] * d[2];
  const dz = m[8] * d[0] + m[9] * d[1] + m[10] * d[2];
  const p = pp.prim;
  if (p.kind === 'sphere') return hitSphere(ox, oy, oz, dx, dy, dz, p.radius);
  if (p.kind === 'capsule')
    return hitCapsule(ox, oy, oz, dx, dy, dz, p.radius, p.length);
  return hitBox(ox, oy, oz, dx, dy, dz, pp.half[0], pp.half[1], pp.half[2]);
}

/** Range of the primitive's world-space bounding box projected onto `axis`. */
function projectRange(
  p: HitboxPrimitive,
  half: Vec3,
  axis: Vec3
): [number, number] {
  const m = p.m;
  const center = m[0][3] * axis[0] + m[1][3] * axis[1] + m[2][3] * axis[2];
  let extent = 0;
  for (let k = 0; k < 3; k++) {
    extent +=
      Math.abs(m[0][k] * axis[0] + m[1][k] * axis[1] + m[2][k] * axis[2]) *
      half[k];
  }
  return [center - extent, center + extent];
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

interface PreparedView {
  prepared: PreparedPrim[];
  rects: { u: [number, number]; v: [number, number]; d: [number, number] }[];
}

/** Pooled primitives of `bodies`, ready to intersect, with their projected
 * bounds in `view`. */
function prepareView(
  bodies: readonly HitboxBody[],
  view: ViewName
): PreparedView {
  const { dir, u, v } = VIEWS[view];
  const prepared: PreparedPrim[] = [];
  bodies.forEach((body, b) => {
    if (body.pool === null) return;
    for (const prim of body.primitives) {
      prepared.push({
        inv: affineInverse(prim.m),
        prim,
        body: b,
        half: localHalfSize(prim),
      });
    }
  });
  const rects = prepared.map((pp) => ({
    u: projectRange(pp.prim, pp.half, u),
    v: projectRange(pp.prim, pp.half, v),
    d: projectRange(pp.prim, pp.half, dir),
  }));
  return { prepared, rects };
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

/** Per-cell bitmasks of the pools hit: `own` by a pool module's own
 * hitboxes, `any` by the module or its weapons. `front` is the nearest hit's
 * pool as `pool * 2 + (weapon ? 1 : 0)`, or -1 for none. */
interface PoolMasks {
  own: Uint32Array;
  any: Uint32Array;
  front: Int8Array;
}

function rasterize(
  bodies: readonly HitboxBody[],
  set: PreparedView,
  grid: ViewGrid
): PoolMasks {
  const { dir, u, v } = VIEWS[grid.view];
  const { cell, u0, v0, nu, nv, start } = grid;
  const own = new Uint32Array(nu * nv);
  const any = new Uint32Array(nu * nv);
  const front = new Int8Array(nu * nv).fill(-1);
  const nearest = new Float64Array(nu * nv).fill(Infinity);
  const o: Vec3 = [0, 0, 0];
  set.prepared.forEach((pp, idx) => {
    const body = bodies[pp.body];
    const bit = 1 << body.pool!;
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
        const t = hitPrim(pp, o, dir);
        if (t === Infinity) continue;
        const c = j * nu + i;
        any[c] |= bit;
        if (!body.weapon) own[c] |= bit;
        if (t < nearest[c]) {
          nearest[c] = t;
          front[c] = body.pool! * 2 + (body.weapon ? 1 : 0);
        }
      }
    }
  });
  return { own, any, front };
}

/** Each pool's label anchor (see ViewAreas.anchors): the candidate cell
 * nearest the candidates' centroid, candidates being the cells where the
 * pool's own hitboxes are frontmost, or failing that every cell they cover. */
function poolAnchors(
  masks: PoolMasks,
  grid: ViewGrid,
  poolCount: number
): (Vec3 | null)[] {
  const { own, front } = masks;
  const { nu } = grid;
  const visible = (p: number, c: number): boolean => front[c] === p * 2;
  const covered = (p: number, c: number): boolean => (own[c] & (1 << p)) !== 0;
  const pick = (p: number, has: (p: number, c: number) => boolean): number => {
    let n = 0;
    let si = 0;
    let sj = 0;
    for (let c = 0; c < own.length; c++) {
      if (!has(p, c)) continue;
      n += 1;
      si += c % nu;
      sj += Math.floor(c / nu);
    }
    if (n === 0) return -1;
    const ci = si / n;
    const cj = sj / n;
    let best = -1;
    let bestD = Infinity;
    for (let c = 0; c < own.length; c++) {
      if (!has(p, c)) continue;
      const d = ((c % nu) - ci) ** 2 + (Math.floor(c / nu) - cj) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  };
  const { dir, u, v } = VIEWS[grid.view];
  return Array.from({ length: poolCount }, (_, p) => {
    let c = pick(p, visible);
    if (c < 0) c = pick(p, covered);
    if (c < 0) return null;
    const su = grid.u0 + ((c % nu) + 0.5) * grid.cell;
    const sv = grid.v0 + (Math.floor(c / nu) + 0.5) * grid.cell;
    return [0, 1, 2].map(
      (k) => u[k] * su + v[k] * sv + dir[k] * grid.start
    ) as Vec3;
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
  const anchors: (Vec3 | null)[] = new Array(poolCount).fill(null);
  if (!masks || !grid) return { pools, total, anchors };
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
  if (poolCount > 32) throw new Error(`too many hitbox pools (${poolCount})`);
}

/**
 * Per-pool and whole-robot areas (cm^2) for one view. `cell` is the ray grid
 * spacing in cm; each hit cell contributes cell^2.
 */
export function measureView(
  bodies: readonly HitboxBody[],
  poolCount: number,
  view: ViewName,
  cell = 1
): ViewAreas {
  checkPoolCount(poolCount);
  const set = prepareView(bodies, view);
  const grid = gridFor([set], view, cell);
  return sumAreas(grid && rasterize(bodies, set, grid), grid, poolCount);
}

/** Per-cell state of a two-build diff (whole robot, weapons included). */
export const DIFF_NONE = 0;
export const DIFF_SHARED = 1;
export const DIFF_A_ONLY = 2;
export const DIFF_B_ONLY = 3;

/** Where A's and B's silhouettes differ in one view: a DIFF_* per grid cell
 * (row-major, `j * nu + i`). */
export interface DiffRaster {
  grid: ViewGrid;
  states: Uint8Array;
}

/** A build's hitboxes, as `collectBodies` returns them. */
export interface MeasuredBuild {
  pools: readonly HitboxPool[];
  bodies: readonly HitboxBody[];
}

export interface ComparisonView {
  a: ViewAreas;
  b: ViewAreas;
  /** Null when neither build has hitboxes. */
  diff: DiffRaster | null;
}

/** Areas of builds A and B from every view, rasterized on one shared grid per
 * view so their silhouettes can be diffed cell for cell. */
export function measureComparison(
  a: MeasuredBuild,
  b: MeasuredBuild,
  cell = 1
): Record<ViewName, ComparisonView> {
  checkPoolCount(a.pools.length);
  checkPoolCount(b.pools.length);
  const out = {} as Record<ViewName, ComparisonView>;
  for (const view of VIEW_ORDER) {
    const setA = prepareView(a.bodies, view);
    const setB = prepareView(b.bodies, view);
    const grid = gridFor([setA, setB], view, cell);
    const masksA = grid && rasterize(a.bodies, setA, grid);
    const masksB = grid && rasterize(b.bodies, setB, grid);
    let diff: DiffRaster | null = null;
    if (grid && masksA && masksB) {
      const states = new Uint8Array(grid.nu * grid.nv);
      for (let c = 0; c < states.length; c++) {
        const inA = masksA.any[c] !== 0;
        const inB = masksB.any[c] !== 0;
        states[c] = inA
          ? inB
            ? DIFF_SHARED
            : DIFF_A_ONLY
          : inB
            ? DIFF_B_ONLY
            : DIFF_NONE;
      }
      diff = { grid, states };
    }
    out[view] = {
      a: sumAreas(masksA, grid, a.pools.length),
      b: sumAreas(masksB, grid, b.pools.length),
      diff,
    };
  }
  return out;
}

/** Every view's per-pool and whole-robot areas. */
export function measureBuild(
  bodies: readonly HitboxBody[],
  poolCount: number,
  cell = 1
): Record<ViewName, ViewAreas> {
  const out = {} as Record<ViewName, ViewAreas>;
  for (const view of VIEW_ORDER)
    out[view] = measureView(bodies, poolCount, view, cell);
  return out;
}
