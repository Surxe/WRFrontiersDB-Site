/**
 * The Chaos oracle fixtures (reference/chaos_contact, reference/chaos_sweeps;
 * wrf-chaos-oracle/1 from /srv/dev/repos/wrf-movement-ref -oracle=): their
 * types, a collision world built from their shapes as Chaos holds them, and
 * the float32 port on one fixture shape as the scene query runs it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  boxSupport,
  capsuleShape,
  chaosConvexSweep,
  chaosTriangleSweep,
  convexSupport,
  meshVisitorKeeps,
  meshVisitStops,
  sphereShape,
  type CapsuleSweepInput,
  type ChaosHit,
  type F3,
} from '../../../src/scripts/movement/collision/exact/chaos_gjk';
import {
  chaosHeightfieldSweep,
  heightfieldOf,
} from '../../../src/scripts/movement/collision/exact/chaos_heightfield';
import {
  emptyColliderSet,
  type ColliderSet,
  type Quat,
  type V3,
} from '../../../src/scripts/movement/collision/exact/colliders';
import { ExactCollisionWorld } from '../../../src/scripts/movement/collision/exact/world';

export interface OracleShape {
  name: string;
  shape: 'box' | 'hull' | 'mesh' | 'sphere' | 'capsule' | 'heightfield';
  center: V3;
  halfExtent: V3;
  quat: Quat;
  radius: number;
  halfHeight: number;
  points: number[];
  faces: number[];
  vertices: number[];
  triangles: number[];
  doubleSided: boolean;
  location: V3;
  scale: V3;
  cookedVertices: number[];
  cookedTriangles: number[];
  rows: number;
  cols: number;
  heights: number[];
  holes: number[];
  t: V3;
  q: Quat;
  s: V3;
  /** Heightfields: the landscape collision component's name (the hit's). */
  comp?: string;
  /** The Chaos particle: X (double), R (float32, as stored). */
  particle?: { x: V3; r: Quat };
}

export interface OracleHit {
  time?: number;
  dist: number;
  loc?: V3;
  impactPoint: V3;
  normal: V3;
  impactNormal: V3;
  startPen: boolean;
  penDepth?: number;
  comp: string;
}

export interface OracleQuery {
  kind?: 'single';
  capsule?: { radius: number; halfHeight: number };
  start: V3;
  end: V3;
  quat?: Quat;
  rotationPYR?: V3;
  tag: string;
  hit: OracleHit | null;
}

export interface OracleSet {
  set: string;
  capsule: { radius: number; halfHeight: number };
  shapes: OracleShape[];
  queries: OracleQuery[];
}

export function loadOracle(dir: string): OracleSet[] {
  const full = path.join(__dirname, '..', dir);
  return readdirSync(full)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(full, f), 'utf8')));
}

const f = Math.fround;
const fq = (q: Quat): Quat => [f(q[0]), f(q[1]), f(q[2]), f(q[3])];
export const IDENTITY: Quat = [0, 0, 0, 1];

/** The shape's hit name (a landscape's is its collision component's). */
export const hitName = (s: OracleShape): string =>
  s.shape === 'heightfield' ? s.comp! : s.name;

/** Chaos's sweep on one fixture shape, as the scene query runs it. */
export function portSweep(
  s: OracleShape,
  input: CapsuleSweepInput
): ChaosHit | null {
  const pose = s.particle
    ? { t: s.particle.x, q: fq(s.particle.r) }
    : s.shape === 'box'
      ? { t: s.center, q: fq(s.quat) }
      : { t: [0, 0, 0] as V3, q: IDENTITY };
  switch (s.shape) {
    case 'box':
      return chaosConvexSweep(
        boxSupport(
          [-s.halfExtent[0], -s.halfExtent[1], -s.halfExtent[2]],
          s.halfExtent
        ),
        pose,
        input
      );
    case 'hull':
      return chaosConvexSweep(convexSupport(s.points, [1, 1, 1]), pose, input);
    case 'sphere':
      return chaosConvexSweep(sphereShape([0, 0, 0], s.radius), pose, input);
    case 'capsule': {
      const hl = s.halfHeight - s.radius;
      return chaosConvexSweep(
        capsuleShape([0, 0, -hl], [0, 0, hl], s.radius),
        pose,
        input
      );
    }
    case 'heightfield':
      return chaosHeightfieldSweep(
        heightfieldOf(s),
        { t: s.particle!.x, q: fq(s.particle!.r) },
        input
      );
    default: {
      // The mesh visitor over the cooked triangles, in index order.
      const cv = s.cookedVertices;
      const ct = s.cookedTriangles;
      const p = (k: number): F3 => [
        f(cv[k * 3]),
        f(cv[k * 3 + 1]),
        f(cv[k * 3 + 2]),
      ];
      const sc = s.scale ?? [1, 1, 1];
      const code = s.doubleSided ? 0 : Math.sign(sc[0] * sc[1] * sc[2]);
      let kept: ChaosHit | null = null;
      for (let k = 0; k < ct.length / 3; k++) {
        const h = chaosTriangleSweep(
          [p(ct[k * 3]), p(ct[k * 3 + 1]), p(ct[k * 3 + 2])],
          sc,
          { t: s.location ?? [0, 0, 0], q: fq(s.quat ?? IDENTITY) },
          input,
          code
        );
        if (!h || !meshVisitorKeeps(kept, h)) continue;
        kept = h;
        if (meshVisitStops(kept)) break;
      }
      return kept;
    }
  }
}

/** The collision world of a fixture set (Chaos's particle poses). */
export function worldOf(o: OracleSet): ExactCollisionWorld {
  const set: ColliderSet = emptyColliderSet();
  for (const s of o.shapes) {
    const info = { source: hitName(s), flags: 0 };
    const t = s.particle?.x;
    const r = s.particle?.r;
    if (s.shape === 'box')
      set.boxes.push({
        center: t ?? s.center,
        rotation: r ?? s.quat,
        halfExtents: s.halfExtent,
        info,
      });
    else if (s.shape === 'hull')
      set.hulls.push({
        body: { points: new Float64Array(s.points), faces: s.faces },
        t: t ?? [0, 0, 0],
        q: r ?? IDENTITY,
        s: [1, 1, 1],
        info,
      });
    else if (s.shape === 'sphere')
      set.spheres.push({ center: t!, radius: s.radius, info });
    else if (s.shape === 'capsule')
      set.capsules.push({
        center: t!,
        rotation: r!,
        radius: s.radius,
        halfLength: s.halfHeight - s.radius,
        info,
      });
    else if (s.shape === 'heightfield')
      set.heightfields.push({
        rows: s.rows,
        cols: s.cols,
        heights: Float64Array.from(s.heights),
        holes: s.holes.some((h) => h !== 0) ? Uint8Array.from(s.holes) : null,
        t: t!,
        q: r!,
        s: s.s,
        info,
      });
    else
      set.meshes.push({
        vertices: s.vertices,
        triangles: s.triangles,
        t: s.location ?? [0, 0, 0],
        q: s.quat ?? IDENTITY,
        s: s.scale ?? [1, 1, 1],
        doubleSided: s.doubleSided,
        info,
      });
  }
  return new ExactCollisionWorld(set);
}

export const same = (a: readonly number[], b: readonly number[]): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
