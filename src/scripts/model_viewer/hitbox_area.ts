/**
 * Projected hitbox area of a build, per health pool and view direction.
 *
 * Each torso and shoulder is its own health pool; a weapon's hits go to the
 * pool of the torso/shoulder it is mounted on. For every view a grid of
 * parallel rays (one per `cell` x `cell` square) is intersected analytically
 * with the build's hitbox primitives, and each pool gets, in isolation:
 *
 *   alone        silhouette of the pool module's own hitboxes
 *   withWeapons  silhouette of the module + its mounted weapons (overlap once)
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

export const VIEW_ORDER: readonly ViewName[] = ['front', 'back', 'left', 'right', 'top'];

/** One health pool: a torso or a shoulder (with its mounted weapons). */
export interface HitboxPool {
  label: string;
  kind: 'torso' | 'shoulder';
  /** Which side a shoulder sits on; its inner-side view is not measured. */
  side: 'left' | 'right' | null;
  /** Index (in the module list) of the pool's own module. */
  moduleIndex: number;
  moduleId: string;
  /** Module ids of the weapons mounted on it (their hits go to this pool). */
  weaponIds: string[];
  /** Module-list indices of those weapons, parallel to `weaponIds`. */
  weaponIndices: number[];
}

/** A placed module's hitboxes and the pool its hits go to. */
export interface HitboxBody {
  primitives: HitboxPrimitive[];
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

/** A pool's outer side is measured; the side facing the torso is not. */
export function viewApplies(pool: HitboxPool, view: ViewName): boolean {
  if (pool.side === 'left') return view !== 'right';
  if (pool.side === 'right') return view !== 'left';
  return true;
}

function sideOfSocket(socketName: string | null | undefined): 'left' | 'right' | null {
  if (!socketName) return null;
  if (socketName.endsWith('_L')) return 'left';
  if (socketName.endsWith('_R')) return 'right';
  return null;
}

/**
 * Health pools of a module list (preset shape, parents first), and which pool
 * each entry's hits go to: torsos and shoulders are pools; a weapon joins the
 * nearest torso/shoulder above it; everything else is in no pool.
 */
export function assignPools(
  presetModules: readonly CharacterPresetModule[],
  kindOf: (index: number) => ModuleKind,
): { pools: HitboxPool[]; poolOf: (number | null)[]; weapon: boolean[] } {
  const pools: HitboxPool[] = [];
  const poolOf: (number | null)[] = new Array(presetModules.length).fill(null);
  const weapon: boolean[] = new Array(presetModules.length).fill(false);
  presetModules.forEach((entry, i) => {
    const kind = kindOf(i);
    if (kind === 'torso' || kind === 'shoulder') {
      const side = kind === 'shoulder' ? sideOfSocket(entry.socket_name) : null;
      const label =
        kind === 'torso'
          ? 'Torso'
          : side === 'left'
            ? 'Left Shoulder'
            : side === 'right'
              ? 'Right Shoulder'
              : 'Shoulder';
      poolOf[i] = pools.length;
      pools.push({ label, kind, side, moduleIndex: i, moduleId: refToId(entry.module_ref), weaponIds: [], weaponIndices: [] });
      return;
    }
    if (kind !== 'weapon') return;
    weapon[i] = true;
    for (let p = entry.parent_socket_index; p >= 0; p = presetModules[p].parent_socket_index) {
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

/** Pools + hitbox bodies of a placed build (see mount.ts computeModuleWorlds);
 * modules whose model is not loaded contribute no hitboxes. */
export function collectBodies(
  presetModules: readonly CharacterPresetModule[],
  placements: readonly ModulePlacement[],
  models: ReadonlyMap<string, ModuleModel>,
  tables: Pick<BuildTables, 'modules' | 'moduleTypes'>,
): { pools: HitboxPool[]; bodies: HitboxBody[] } {
  const { pools, poolOf, weapon } = assignPools(presetModules, (i) =>
    kindOfModule(placements[i].module_id, tables),
  );
  const bodies = placements.map((placement, i) => {
    const model = placement.model_id ? models.get(placement.model_id) : undefined;
    return {
      primitives: model ? hitboxPrimitives(model, placement.world) : [],
      pool: poolOf[i],
      weapon: weapon[i],
    };
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
    A, c * h - b * k, b * f - c * e,
    B, a * k - c * g, c * d - a * f,
    C, b * g - a * h, a * e - b * d,
  ].map((x) => x / det);
  const t = [m[0][3], m[1][3], m[2][3]];
  const out = new Float64Array(12);
  for (let r = 0; r < 3; r++) {
    out[r * 4] = inv[r * 3];
    out[r * 4 + 1] = inv[r * 3 + 1];
    out[r * 4 + 2] = inv[r * 3 + 2];
    out[r * 4 + 3] = -(inv[r * 3] * t[0] + inv[r * 3 + 1] * t[1] + inv[r * 3 + 2] * t[2]);
  }
  return out;
}

/** Nearest t >= 0 where ro + t*rd enters a sphere (center c, radius r), else Infinity. */
function hitSphere(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  r: number,
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
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  r: number, length: number,
): number {
  const half = length / 2;
  let best = Math.min(
    hitSphere(ox, oy, oz - half, dx, dy, dz, r),
    hitSphere(ox, oy, oz + half, dx, dy, dz, r),
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
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  hx: number, hy: number, hz: number,
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
  if (!slab(ox, dx, hx) || !slab(oy, dy, hy) || !slab(oz, dz, hz)) return Infinity;
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
  if (p.kind === 'box') return [p.extent[0] / 2, p.extent[1] / 2, p.extent[2] / 2];
  if (p.kind === 'capsule') return [p.radius, p.radius, p.length / 2 + p.radius];
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
  if (p.kind === 'capsule') return hitCapsule(ox, oy, oz, dx, dy, dz, p.radius, p.length);
  return hitBox(ox, oy, oz, dx, dy, dz, pp.half[0], pp.half[1], pp.half[2]);
}

/** Range of the primitive's world-space bounding box projected onto `axis`. */
function projectRange(p: HitboxPrimitive, half: Vec3, axis: Vec3): [number, number] {
  const m = p.m;
  const center = m[0][3] * axis[0] + m[1][3] * axis[1] + m[2][3] * axis[2];
  let extent = 0;
  for (let k = 0; k < 3; k++) {
    extent += Math.abs(m[0][k] * axis[0] + m[1][k] * axis[1] + m[2][k] * axis[2]) * half[k];
  }
  return [center - extent, center + extent];
}

/**
 * Per-pool areas (cm^2) for one view. `cell` is the ray grid spacing in cm;
 * each hit cell contributes cell^2.
 */
export function measureView(
  bodies: readonly HitboxBody[],
  poolCount: number,
  view: ViewName,
  cell = 1,
): PoolArea[] {
  if (poolCount > 32) throw new Error(`too many hitbox pools (${poolCount})`);
  const { dir, u, v } = VIEWS[view];
  const prepared: PreparedPrim[] = [];
  bodies.forEach((body, b) => {
    if (body.pool === null) return;
    for (const prim of body.primitives) {
      prepared.push({ inv: affineInverse(prim.m), prim, body: b, half: localHalfSize(prim) });
    }
  });
  const result = Array.from({ length: poolCount }, () => ({ alone: 0, withWeapons: 0 }));
  if (prepared.length === 0) return result;

  const rects = prepared.map((pp) => ({
    u: projectRange(pp.prim, pp.half, u),
    v: projectRange(pp.prim, pp.half, v),
    d: projectRange(pp.prim, pp.half, dir),
  }));
  const u0 = Math.min(...rects.map((r) => r.u[0]));
  const v0 = Math.min(...rects.map((r) => r.v[0]));
  const u1 = Math.max(...rects.map((r) => r.u[1]));
  const v1 = Math.max(...rects.map((r) => r.v[1]));
  const start = Math.min(...rects.map((r) => r.d[0])) - 1;
  const nu = Math.max(1, Math.ceil((u1 - u0) / cell));
  const nv = Math.max(1, Math.ceil((v1 - v0) / cell));

  const own = new Uint32Array(nu * nv); // pools whose own module is hit
  const any = new Uint32Array(nu * nv); // pools hit by module or weapons

  const o: Vec3 = [0, 0, 0];
  prepared.forEach((pp, idx) => {
    const body = bodies[pp.body];
    const bit = 1 << body.pool!;
    const r = rects[idx];
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
      }
    }
  });

  const area = cell * cell;
  for (let c = 0; c < nu * nv; c++) {
    const a = any[c];
    if (a === 0) continue;
    const s = own[c];
    for (let p = 0; p < poolCount; p++) {
      const bit = 1 << p;
      if (a & bit) result[p].withWeapons += area;
      if (s & bit) result[p].alone += area;
    }
  }
  return result;
}

/** Every view's per-pool areas. */
export function measureBuild(
  bodies: readonly HitboxBody[],
  poolCount: number,
  cell = 1,
): Record<ViewName, PoolArea[]> {
  const out = {} as Record<ViewName, PoolArea[]>;
  for (const view of VIEW_ORDER) out[view] = measureView(bodies, poolCount, view, cell);
  return out;
}
