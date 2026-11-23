/**
 * Chaos's capsule sweep in float32 (collision/exact/chaos_gjk.ts) and the
 * exact layer's parallel-contact point against UE 5.4.4's own answers
 * (MVP session 3.5, findings/chaos-contact-point.md).
 *
 * Fixtures (reference/chaos_contact/, imported by
 * scripts/movement/import_chaos_oracle.ts): the reference commandlet's
 * oracle mode (/srv/dev/repos/wrf-movement-ref, -oracle=oracle/cases.json)
 * sweeps a capsule component through UWorld::ComponentSweepMulti, the query
 * the CMC's moves use, and records UE's hit with the shapes as Chaos holds
 * them (cooked hull vertices, cooked mesh particles and triangles, the
 * component transforms). Sets: box walls at 14 yaws (two capsule sizes),
 * boxes rolled out of the horizontal plane swept by yawed capsules, convex
 * prisms from 36 directions, one- and two-sided meshes (one scaled and
 * yawed, one rolled), two-box corners, and replays of the logged sweeps of
 * the traces that showed the divergence (wall_45_slide, corner_60_v,
 * corner_90, hull_pillar_slide, mesh_onesided_front).
 *
 * Gated, bit for bit:
 * - the port on UE's hit shape: impact point and distance of every hit
 *   (parallel or not) on boxes, hulls and meshes;
 * - the layer on every contact parallel to the capsule axis (UE's and the
 *   layer's Normal.Z exactly 0) where it picks UE's shape: the impact point.
 *
 * Reported, not gated (each listed below with its cause): a scaled mesh's
 * two triangles one float ulp apart, and the corner-apex shape tie (D19).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  boxSupport,
  chaosConvexSweep,
  chaosTriangleSweep,
  convexSupport,
  meshVisitorKeeps,
  type CapsuleSweepInput,
  type ChaosHit,
  type F3,
} from '../../src/scripts/movement/collision/exact/chaos_gjk';
import {
  emptyColliderSet,
  type ColliderSet,
  type Quat,
  type V3,
} from '../../src/scripts/movement/collision/exact/colliders';
import { ExactCollisionWorld } from '../../src/scripts/movement/collision/exact/world';
import { vec } from '../../src/scripts/movement/math/vec';

const say = (line: string): void => {
  process.stdout.write(line + '\n');
};

interface OracleShape {
  name: string;
  shape: 'box' | 'hull' | 'mesh';
  center: V3;
  halfExtent: V3;
  quat: Quat;
  points: number[];
  faces: number[];
  vertices: number[];
  triangles: number[];
  doubleSided: boolean;
  location: V3;
  scale: V3;
  cookedVertices: number[];
  cookedTriangles: number[];
}

interface OracleQuery {
  start: V3;
  end: V3;
  quat: Quat;
  tag: string;
  hit: {
    dist: number;
    impactPoint: V3;
    normal: V3;
    impactNormal: V3;
    startPen: boolean;
    comp: string;
  };
}

interface OracleSet {
  set: string;
  capsule: { radius: number; halfHeight: number };
  shapes: OracleShape[];
  queries: OracleQuery[];
}

const DIR = path.join(__dirname, 'reference/chaos_contact');
const sets: OracleSet[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')));

/**
 * Known disagreements, by set and query tag, each with its cause.
 */
const PORT_KNOWN: Record<string, string> = {
  'meshes_r300|scaled side 1 lat 0 z 1500 ang 74 cap 0':
    "the scaled mesh's two triangles end one float ulp apart (272.6687 cm); the port's visitor rule (Time < LengthScale x " +
    "OutTime in float, faces in index order) keeps the second, UE the first: in UE the second is filtered by the trimesh BVH's " +
    'float bounds test or visited in another order (the cooked BVH is not exported), not observable from the hit',
};
const LAYER_KNOWN: Record<string, string> = {
  ...PORT_KNOWN,
};

const f = Math.fround;
const fq = (q: Quat): Quat => [f(q[0]), f(q[1]), f(q[2]), f(q[3])];

/** Chaos's sweep on one fixture shape, as the scene query runs it. */
function portSweep(s: OracleShape, input: CapsuleSweepInput): ChaosHit | null {
  if (s.shape === 'box')
    return chaosConvexSweep(
      boxSupport(
        [-s.halfExtent[0], -s.halfExtent[1], -s.halfExtent[2]],
        s.halfExtent
      ),
      { t: s.center, q: fq(s.quat) },
      input
    );
  if (s.shape === 'hull')
    return chaosConvexSweep(
      convexSupport(s.points, [1, 1, 1]),
      { t: [0, 0, 0], q: [0, 0, 0, 1] },
      input
    );
  // The mesh visitor over the cooked triangles, in index order.
  const cv = s.cookedVertices;
  const ct = s.cookedTriangles;
  const p = (k: number): F3 => [
    f(cv[k * 3]),
    f(cv[k * 3 + 1]),
    f(cv[k * 3 + 2]),
  ];
  const q = s.quat;
  const inv: Quat = [-q[0], -q[1], -q[2], q[3]];
  const d = [
    input.end[0] - input.start[0],
    input.end[1] - input.start[1],
    input.end[2] - input.start[2],
  ];
  // Back faces (one-sided): TriNormal . local direction x winding > 0.
  const local = rotateD(inv, d);
  const sc = s.scale;
  const winding = Math.sign(sc[0] * sc[1] * sc[2]);
  let kept: ChaosHit | null = null;
  for (let k = 0; k < ct.length / 3; k++) {
    const a = p(ct[k * 3]);
    const b = p(ct[k * 3 + 1]);
    const c = p(ct[k * 3 + 2]);
    const h = chaosTriangleSweep(
      [a, b, c],
      sc,
      { t: s.location, q: fq(q) },
      input
    );
    if (!h) continue;
    if (!s.doubleSided) {
      const ab = [
        (b[0] - a[0]) * sc[0],
        (b[1] - a[1]) * sc[1],
        (b[2] - a[2]) * sc[2],
      ];
      const ac = [
        (c[0] - a[0]) * sc[0],
        (c[1] - a[1]) * sc[1],
        (c[2] - a[2]) * sc[2],
      ];
      const n = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ];
      const sd = [local[0] / sc[0], local[1] / sc[1], local[2] / sc[2]];
      if ((n[0] * sd[0] + n[1] * sd[1] + n[2] * sd[2]) * winding > 0) continue;
    }
    if (meshVisitorKeeps(kept, h)) kept = h;
  }
  return kept;
}

function rotateD(q: Quat, v: number[]): [number, number, number] {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

function worldOf(o: OracleSet): ExactCollisionWorld {
  const set: ColliderSet = emptyColliderSet();
  for (const s of o.shapes) {
    const info = { source: s.name, flags: 0 };
    if (s.shape === 'box')
      set.boxes.push({
        center: s.center,
        rotation: s.quat,
        halfExtents: s.halfExtent,
        info,
      });
    else if (s.shape === 'hull')
      set.hulls.push({
        body: { points: new Float64Array(s.points), faces: s.faces },
        t: [0, 0, 0],
        q: [0, 0, 0, 1],
        s: [1, 1, 1],
        info,
      });
    else
      set.meshes.push({
        vertices: s.vertices,
        triangles: s.triangles,
        t: s.location,
        q: s.quat,
        s: s.scale,
        doubleSided: s.doubleSided,
        info,
      });
  }
  return new ExactCollisionWorld(set);
}

const same = (a: readonly number[], b: readonly number[]) =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

describe("Chaos's capsule sweep (float32 port) against UE's oracle", () => {
  it('covers every oracle set', () => {
    expect(sets.map((s) => s.set)).toEqual([
      'box_walls_r300',
      'box_walls_r600',
      'box_walls_rolled',
      'corners_r600',
      'hulls_r300',
      'hulls_r600',
      'meshes_r300',
      'meshes_r600',
      'replay_corner_60_v',
      'replay_corner_90',
      'replay_hull_pillar_slide',
      'replay_mesh_onesided_front',
      'replay_wall_45_slide',
    ]);
  });

  for (const o of sets) {
    it(`${o.set}: impact point and distance of every hit, bit for bit`, () => {
      const shapes = new Map(o.shapes.map((s) => [s.name, s]));
      const half = o.capsule.halfHeight - o.capsule.radius;
      let hits = 0;
      let parallel = 0;
      for (const q of o.queries) {
        if (q.hit.startPen) continue;
        const s = shapes.get(q.hit.comp)!;
        const h = portSweep(s, {
          start: q.start,
          end: q.end,
          rotation: q.quat,
          radius: o.capsule.radius,
          halfLength: half,
        });
        const known = PORT_KNOWN[`${o.set}|${q.tag}`];
        if (known) {
          say(`[reported] ${o.set} ${q.tag}: ${known}`);
          continue;
        }
        hits++;
        if (q.hit.normal[2] === 0) parallel++;
        expect(h, `${q.tag}: a hit`).not.toBeNull();
        expect(
          same(h!.impactPoint, q.hit.impactPoint),
          `${q.tag}: impact point ${h!.impactPoint} vs UE ${q.hit.impactPoint}`
        ).toBe(true);
        // FHitResult::Distance is a float.
        expect(f(h!.distance), `${q.tag}: distance`).toBe(q.hit.dist);
      }
      say(`[chaos port] ${o.set}: ${hits} hits exact (${parallel} parallel)`);
      expect(hits).toBeGreaterThan(10);
    });
  }
});

describe("the exact layer's parallel-contact point against UE's oracle", () => {
  for (const o of sets) {
    it(`${o.set}: every parallel contact on UE's shape, bit for bit`, () => {
      const w = worldOf(o);
      let checked = 0;
      let otherShape = 0;
      for (const q of o.queries) {
        if (q.hit.startPen || q.hit.normal[2] !== 0) continue;
        const l = w.sweepCapsule(
          vec(q.start[0], q.start[1], q.start[2]),
          vec(q.end[0], q.end[1], q.end[2]),
          o.capsule,
          { rotation: q.quat }
        );
        expect(l, `${q.tag}: a hit`).not.toBeNull();
        if (l!.startPenetrating || l!.normal.z !== 0) continue;
        if (l!.source !== q.hit.comp) {
          // Two shapes at the same Chaos distance: UE keeps the one its
          // acceleration structure visits first (D19), not modelled.
          otherShape++;
          say(
            `[reported, D19 shape tie] ${o.set} ${q.tag}: UE ${q.hit.comp}, layer ${l!.source}`
          );
          continue;
        }
        const known = LAYER_KNOWN[`${o.set}|${q.tag}`];
        if (known) continue;
        checked++;
        expect(
          same(
            [l!.impactPoint.x, l!.impactPoint.y, l!.impactPoint.z],
            q.hit.impactPoint
          ),
          `${q.tag}: impact point`
        ).toBe(true);
      }
      say(
        `[layer] ${o.set}: ${checked} parallel contacts exact, ${otherShape} shape ties`
      );
      // The corner apex ties (D19): one sweep in the corner set, and the 12
      // replayed apex sweeps of corner_60_v, where the scene query's
      // co-located face rule (session 4.5) meets two equal face dots and
      // the layer keeps the other wall (the trace itself replays bit for
      // bit; chaos_sweeps.ts reports them).
      expect(otherShape).toBeLessThanOrEqual(
        o.set === 'replay_corner_60_v' ? 12 : 1
      );
    });
  }
});
