/**
 * ExactCollisionWorld: the CollisionWorld the movement engine runs on, with
 * float64 queries exact enough for the engine tolerance policy
 * (stages/mvp.md). Rapier's f32 shape casts stop up to 1.7 cm short and
 * tilt Hit.Normal; this world doesn't (findings/engine-port-collision-queries.md).
 *
 * Shapes: boxes and convex hulls (closed convex solids), spheres, capsules,
 * triangle meshes and heightfield cells. Broad phase: a static BVH over
 * collider boxes; heightfields by direct cell lookup.
 *
 * Narrow phase:
 * - Time of impact: a solid's first contact is on one of its boundary
 *   triangles that faces the move, so it is the earliest triangle contact.
 *   Each triangle (and each sphere centre or capsule segment) is a closed-
 *   form ray cast of the capsule centre against the rounded prism
 *   (primitives.ts sweepPolygon).
 * - Distances (start overlap, touching, the hit fields) are exact closest
 *   points between the capsule's core segment and the shape; solids are
 *   signed (negative when the core segment is inside).
 *
 * Hit fields as Chaos and UE report them (findings item 3):
 * - Normal: from the closest point on the shape toward the capsule's core;
 * - ImpactPoint: that closest point, rounded to float32. When the contact
 *   runs parallel to the capsule axis (Normal Z exactly 0) on a box, hull
 *   or mesh triangle, the point Chaos's float32 GJK raycast reports
 *   (chaos_gjk.ts; findings/chaos-contact-point.md): every point of the
 *   core segment is equally close there, and Chaos returns the mix of the
 *   segment ends its final simplex holds. Near-tied candidates are ranked
 *   by Chaos's own float distance, as the scene query does;
 * - ImpactNormal per shape (UE FindFaceIndex then FindGeometryOpposingNormal):
 *   box: among its axes on which Normal has a component beyond 1e-4, the
 *   face most opposing the trace (TAABB::FindGeometryOpposingNormal);
 *   hull: FConvex::FindMostOpposingFaceScaled (planes within the search
 *   distance of the impact point, most opposing the trace); triangle mesh
 *   and heightfield: FindMostOpposingFace over their triangles within 1 cm
 *   of the impact point; sphere and capsule: Normal.
 * - Starting overlaps: Normal = ImpactNormal = the minimum translation
 *   direction (ConvertOverlappedShapeToImpactHit), from exact distances.
 * - One-sided triangle meshes (no flag bit 32) skip back faces unless the
 *   capsule starts touching them; heightfields and double-sided meshes
 *   block from both sides; hole cells don't collide.
 * - "Ignore blocking overlaps we are moving out of": a starting overlap
 *   whose exit normal points along the move is skipped.
 */
import { vec, type Vec3 } from '../../math/vec';
import type {
  Capsule,
  CollisionWorld,
  QueryHit,
  QueryStats,
  SweepOptions,
} from '../world';
import { Bvh } from './bvh';
import {
  normalizeQuat,
  rotate,
  type ColliderInfo,
  type ColliderSet,
  type MeshCollider,
  type Quat,
  type HullBody,
} from './colliders';
import {
  boxSupport,
  chaosConvexSweep,
  chaosTriangleSweep,
  convexSupport,
  type CapsuleSweepInput,
  type ChaosHit,
  type F3,
  type ShapePose,
  type SupportFn,
} from './chaos_gjk';
import { convexHull, hullFromFaces, type Hull } from './hull';
import {
  closest,
  pointTriangle,
  lastTrianglePoint,
  raySphere,
  rayTriangle,
  segmentSegmentVertical,
  segmentTriangle,
  sweepPolygon,
} from './primitives';

/** A starting contact closer than this (cm) counts as touching, not
 * penetrating (as the box oracle and the old Rapier world). */
const PENETRATION_TOLERANCE = 0.01;
/** UE_KINDA_SMALL_NUMBER: TAABB::FindGeometryOpposingNormal's threshold. */
const KINDA_SMALL = 1e-4;
/** Distances this close count as the same (the top-end tie rule), cm. */
const TIE_CM = 1e-9;
/** FindFaceIndex's search distance (PhysicsInterfaceUtilsCore.cpp:35), cm. */
const OPPOSING_SEARCH_CM = 1;
/** How far along the move the touching test looks (fraction of the move). */
const TOUCH_PROBE = 1e-6;
/** Normal components smaller than this are exactly 0 (see snapNormal). */
const NORMAL_ZERO = 1e-9;
/** Candidates for the parallel-contact point: shapes whose exact contact
 * is within this of the best one (cm), or 1e-6 of the coordinates'
 * magnitude, whichever is larger (Chaos's float32 distance noise). */
const CHAOS_TIE_CM = 1e-3;
const CHAOS_TIE_REL = 1e-6;
/** Golden-section iterations for the deep-penetration envelope. */
const ENVELOPE_ITERATIONS = 100;
const GOLD = (Math.sqrt(5) - 1) / 2;

/** Box corners in the order built below (x major, then y, then z: index =
 * 4 ix + 2 iy + iz) as 12 triangles; hullFromFaces orients them. */
const BOX_FACES = [
  0,
  1,
  3,
  0,
  3,
  2, // -x
  4,
  5,
  7,
  4,
  7,
  6, // +x
  0,
  1,
  5,
  0,
  5,
  4, // -y
  2,
  3,
  7,
  2,
  7,
  6, // +y
  0,
  2,
  6,
  0,
  6,
  4, // -z
  1,
  3,
  7,
  1,
  7,
  5, // +z
];

const K_SOLID = 0;
const K_SPHERE = 1;
const K_CAPSULE = 2;
const K_TRI = 3;
const K_HF = 4;

interface Solid {
  verts: Float64Array;
  tris: Uint32Array;
  /** Outward unit normal per triangle. */
  normals: Float64Array;
  /** n . v0 per triangle. */
  planes: Float64Array;
  /** False for a flat hull (no inside). */
  closed: boolean;
  /** Boxes: local axes in world (x, y, z rows); null for hulls. */
  axes: Float64Array | null;
  /** FConvex::FindMostOpposingFaceScaled's search distance (hulls). */
  searchDist: number;
  bounds: Float64Array;
  info: ColliderInfo;
  /** The shape as Chaos sweeps it (body frame, float32 rotation). */
  chaos: ChaosSolid;
}

/** A box or hull for chaos_gjk: its pose and (built on first use) its
 * float32 support function. */
interface ChaosSolid {
  pose: ShapePose;
  support: SupportFn | null;
  build: () => SupportFn;
}

/**
 * Chaos keeps a particle's rotation in float32 (FParticlePositionRotation
 * MR is an FRotation3f, ParticleDirtyFlags.h:108) and its position in
 * double; the scene query builds ActorTM from both (SQVisitor.h:204). The
 * rotation is rounded as given, not renormalised (UE doesn't either).
 */
function chaosPose(t: readonly number[], q: Quat): ShapePose {
  return {
    t: [t[0], t[1], t[2]],
    q: [
      Math.fround(q[0]),
      Math.fround(q[1]),
      Math.fround(q[2]),
      Math.fround(q[3]),
    ],
  };
}

interface Sphere {
  x: number;
  y: number;
  z: number;
  radius: number;
  info: ColliderInfo;
}

interface CapsuleShape {
  /** Core segment ends. */
  e: Float64Array;
  radius: number;
  info: ColliderInfo;
}

interface Heightfield {
  rows: number;
  cols: number;
  heights: Float64Array;
  holes: Uint8Array | null;
  t: [number, number, number];
  /** Rotation matrix, row-major (world = t + R (s * local)). */
  r: Float64Array;
  s: [number, number, number];
  info: ColliderInfo;
}

export interface ExactBuildStats {
  boxes: number;
  spheres: number;
  capsules: number;
  hulls: number;
  meshTriangles: number;
  heightfields: number;
  heightfieldCells: number;
  /** Hulls whose points were collinear or a single point (no surface). */
  degenerateHulls: number;
  /** Hulls whose points were coplanar (a flat polygon, no inside). */
  flatHulls: number;
  /** Bytes held in typed arrays (approximate JS memory). */
  bytes: number;
  buildMs: number;
}

/** What the parallel-contact path did (chaosContact). */
export interface ChaosContactStats {
  /** Best hits that were parallel contacts on a box, hull or triangle. */
  contacts: number;
  /** chaos_gjk sweeps run for them (one per near-tied candidate). */
  chaosCalls: number;
  /** Times Chaos's ranking replaced the best shape by a near-tied one. */
  switched: number;
  /** Different shapes tied at Chaos's float distance (the scene query's
   * visit order decides in UE; not modelled). */
  unresolvedTies: number;
  /** Chaos reported no positive-time hit; the exact point was kept. */
  noChaosHit: number;
}

/** The best hit so far in a sweep. */
interface Best {
  found: boolean;
  time: number;
  startPenetrating: boolean;
  depth: number;
  loc: [number, number, number];
  impactPoint: [number, number, number];
  normal: [number, number, number];
  impactNormal: [number, number, number];
  source: string;
  /** Stable collider key (see keyOf): ties go to the smaller key, so the
   * result doesn't depend on the order the broad phase visits shapes. */
  key: number;
  kind: number;
  ref: number;
}

const hullCache = new WeakMap<HullBody, Hull>();

/**
 * A hit normal with UE's exact zeros. Chaos computes a face contact's
 * normal from the face plane in the shape's frame, so a component that is
 * zero for the face is exactly 0 in the FHitResult (every ground hit in
 * the UE traces is (0, 0, 1), every vertical wall's Z is 0), while its
 * other components carry float32 noise (about 1e-7). The layer derives the
 * normal from closest points in float64, which leaves about 1e-14 where UE
 * has 0, and the engine branches on the sign of such components
 * (TwoWallAdjust's `Delta.Z > 0` slide-up branch rescales by 1 - Hit.Time
 * a second time; UE trace sphere_walk_around, tick 114). Components below
 * NORMAL_ZERO, far under Chaos's own noise, are set to 0.
 */
function snapNormal(x: number, y: number, z: number): [number, number, number] {
  const sx = Math.abs(x) < NORMAL_ZERO ? 0 : x;
  const sy = Math.abs(y) < NORMAL_ZERO ? 0 : y;
  const sz = Math.abs(z) < NORMAL_ZERO ? 0 : z;
  if (sx === x && sy === y && sz === z) return [x, y, z];
  const l = Math.sqrt(sx * sx + sy * sy + sz * sz);
  return l > 0 ? [sx / l, sy / l, sz / l] : [x, y, z];
}

function hullOf(body: HullBody): Hull {
  let hull = hullCache.get(body);
  if (!hull) {
    hull =
      body.faces && body.faces.length > 0
        ? hullFromFaces(body.points, body.faces)
        : convexHull(body.points);
    hullCache.set(body, hull);
  }
  return hull;
}

function quatMatrix(
  q: readonly [number, number, number, number]
): Float64Array {
  const u = normalizeQuat(q);
  const m = new Float64Array(9);
  const cols = [rotate(u, 1, 0, 0), rotate(u, 0, 1, 0), rotate(u, 0, 0, 1)];
  for (let c = 0; c < 3; c++)
    for (let r = 0; r < 3; r++) m[r * 3 + c] = cols[c][r];
  return m;
}

export class ExactCollisionWorld implements CollisionWorld {
  private readonly solids: Solid[] = [];
  private readonly spheres: Sphere[] = [];
  private readonly capsules: CapsuleShape[] = [];
  private readonly heightfields: Heightfield[] = [];
  // Mesh triangles, flattened.
  private readonly triV: Float64Array;
  private readonly triN: Float64Array;
  private readonly triMesh: Int32Array;
  /** Index of each triangle within its mesh (degenerate ones are skipped). */
  private readonly triLocal: Int32Array;
  private readonly meshes: MeshCollider[];
  private readonly meshPose: ShapePose[] = [];
  private readonly triDouble: Uint8Array;
  private readonly meshInfo: ColliderInfo[] = [];
  // Broad phase items.
  private readonly itemKind: Uint8Array;
  private readonly itemRef: Int32Array;
  private readonly bvh: Bvh;
  private readonly build: ExactBuildStats;
  private stats: QueryStats = { sweeps: 0, lineTraces: 0, overlaps: 0, ms: 0 };

  // ---- Query state (one query at a time) ----
  private px = 0;
  private py = 0;
  private pz = 0;
  private dx = 0;
  private dy = 0;
  private dz = 0;
  private dLen = 0;
  private a = 0;
  private r = 0;
  private ignoreMovingOut = false;
  /** Swept box of the current query. */
  private readonly qb = new Float64Array(6);
  private readonly best: Best = {
    found: false,
    time: 1,
    startPenetrating: false,
    depth: 0,
    loc: [0, 0, 0],
    impactPoint: [0, 0, 0],
    normal: [0, 0, 0],
    impactNormal: [0, 0, 0],
    source: '',
    key: 0,
    kind: 0,
    ref: 0,
  };
  /** Capsule rotation of the current sweep (SweepOptions.rotation). */
  private rot: Quat = [0, 0, 0, 1];
  /** Contacts within the Chaos tie window of the best (boxes, hulls and
   * mesh triangles), for the parallel-contact point. */
  private candN = 0;
  private readonly candKind: number[] = [];
  private readonly candRef: number[] = [];
  private readonly candTime: number[] = [];
  /** The tie window of the current sweep, as a fraction of the move. */
  private tieWin = 0;
  private chaos: ChaosContactStats = {
    contacts: 0,
    chaosCalls: 0,
    switched: 0,
    unresolvedTies: 0,
    noChaosHit: 0,
  };
  /** The current triangle (mesh or heightfield cell): xyz x 3. */
  private readonly tv = new Float64Array(9);
  private tnx = 0;
  private tny = 0;
  private tnz = 0;
  private tDouble = true;
  /** Mesh index (K_TRI) or heightfield index (K_HF) of the current triangle. */
  private tOwner = 0;
  // Pair from the last dist(..., wantPair): core point, shape point.
  private readonly pair = new Float64Array(6);
  /** Deep solid penetration: the face of the envelope maximum, or -1. */
  private deepFace = -1;
  private readonly scratch = new Float64Array(9);

  constructor(set: ColliderSet) {
    const began = performance.now();
    let degenerateHulls = 0;
    let flatHulls = 0;
    let bytes = 0;
    // Solids: boxes, then hulls.
    for (const box of set.boxes) {
      const m = quatMatrix(box.rotation);
      const pts = new Float64Array(24);
      let k = 0;
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1]) {
            const lx = sx * box.halfExtents[0];
            const ly = sy * box.halfExtents[1];
            const lz = sz * box.halfExtents[2];
            for (let row = 0; row < 3; row++)
              pts[k++] =
                box.center[row] +
                m[row * 3] * lx +
                m[row * 3 + 1] * ly +
                m[row * 3 + 2] * lz;
          }
      const hull = hullFromFaces(pts, BOX_FACES);
      if (hull.kind === 'degenerate') {
        degenerateHulls++;
        continue;
      }
      // Axes as rows: column c of the rotation matrix.
      const axes = new Float64Array(9);
      for (let c = 0; c < 3; c++)
        for (let row = 0; row < 3; row++) axes[c * 3 + row] = m[row * 3 + c];
      const he = box.halfExtents;
      this.solids.push(
        this.makeSolid(pts, hull, axes, 0, box.info, {
          pose: chaosPose(box.center, box.rotation),
          support: null,
          build: () => boxSupport([-he[0], -he[1], -he[2]], he),
        })
      );
    }
    const boxCount = this.solids.length;
    for (const placed of set.hulls) {
      const hull = hullOf(placed.body);
      if (hull.kind === 'degenerate') {
        degenerateHulls++;
        continue;
      }
      if (hull.kind === 'flat') flatHulls++;
      const m = quatMatrix(placed.q);
      const body = placed.body.points;
      const n = body.length / 3;
      const pts = new Float64Array(body.length);
      const minB = [Infinity, Infinity, Infinity];
      const maxB = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < n; i++) {
        const lx = placed.s[0] * body[i * 3];
        const ly = placed.s[1] * body[i * 3 + 1];
        const lz = placed.s[2] * body[i * 3 + 2];
        for (let row = 0; row < 3; row++)
          pts[i * 3 + row] =
            placed.t[row] +
            m[row * 3] * lx +
            m[row * 3 + 1] * ly +
            m[row * 3 + 2] * lz;
        for (let k = 0; k < 3; k++) {
          minB[k] = Math.min(minB[k], body[i * 3 + k]);
          maxB[k] = Math.max(maxB[k], body[i * 3 + k]);
        }
      }
      // A mirroring scale flips the winding.
      let tris = hull.triangles;
      if (placed.s[0] * placed.s[1] * placed.s[2] < 0) {
        tris = tris.slice();
        for (let i = 0; i < tris.length; i += 3) {
          const t = tris[i + 1];
          tris[i + 1] = tris[i + 2];
          tris[i + 2] = t;
        }
      }
      // FConvex::FindMostOpposingFaceScaled: max(Scale.Max() x SearchDist,
      // |unscaled bounds extent|.GetAbsMax() x 1e-4).
      const extent = Math.max(
        maxB[0] - minB[0],
        maxB[1] - minB[1],
        maxB[2] - minB[2]
      );
      const searchDist = Math.max(
        Math.max(placed.s[0], placed.s[1], placed.s[2]) * OPPOSING_SEARCH_CM,
        Math.abs(extent) * 1e-4
      );
      this.solids.push(
        this.makeSolid(
          pts,
          { kind: hull.kind, triangles: tris },
          null,
          searchDist,
          placed.info,
          {
            pose: chaosPose(placed.t, placed.q),
            support: null,
            build: () => convexSupport(placed.body.points, placed.s),
          }
        )
      );
    }
    for (const s of this.solids)
      bytes +=
        s.verts.byteLength +
        s.tris.byteLength +
        s.normals.byteLength +
        s.planes.byteLength;

    for (const sphere of set.spheres)
      this.spheres.push({
        x: sphere.center[0],
        y: sphere.center[1],
        z: sphere.center[2],
        radius: sphere.radius,
        info: sphere.info,
      });
    for (const capsule of set.capsules) {
      const [ax, ay, az] = rotate(
        normalizeQuat(capsule.rotation),
        0,
        0,
        capsule.halfLength
      );
      const [cx, cy, cz] = capsule.center;
      this.capsules.push({
        e: new Float64Array([
          cx - ax,
          cy - ay,
          cz - az,
          cx + ax,
          cy + ay,
          cz + az,
        ]),
        radius: capsule.radius,
        info: capsule.info,
      });
    }

    // Mesh triangles in world space.
    let triCount = 0;
    for (const mesh of set.meshes) triCount += mesh.triangles.length / 3;
    this.triV = new Float64Array(triCount * 9);
    this.triN = new Float64Array(triCount * 3);
    this.triMesh = new Int32Array(triCount);
    this.triLocal = new Int32Array(triCount);
    this.meshes = set.meshes;
    this.triDouble = new Uint8Array(triCount);
    let tri = 0;
    set.meshes.forEach((mesh, meshIndex) => {
      this.meshInfo.push(mesh.info);
      this.meshPose.push(chaosPose(mesh.t, mesh.q));
      const m = quatMatrix(mesh.q);
      const mirrored = mesh.s[0] * mesh.s[1] * mesh.s[2] < 0;
      const w = (i: number, row: number) => {
        const lx = mesh.s[0] * mesh.vertices[i * 3];
        const ly = mesh.s[1] * mesh.vertices[i * 3 + 1];
        const lz = mesh.s[2] * mesh.vertices[i * 3 + 2];
        return (
          mesh.t[row] +
          m[row * 3] * lx +
          m[row * 3 + 1] * ly +
          m[row * 3 + 2] * lz
        );
      };
      for (let k = 0; k < mesh.triangles.length; k += 3) {
        const o = tri * 9;
        for (let c = 0; c < 3; c++)
          for (let row = 0; row < 3; row++)
            this.triV[o + c * 3 + row] = w(mesh.triangles[k + c], row);
        // UE outward = (v2 - v0) x (v1 - v0); a mirroring scale flips it.
        const e1x = this.triV[o + 3] - this.triV[o];
        const e1y = this.triV[o + 4] - this.triV[o + 1];
        const e1z = this.triV[o + 5] - this.triV[o + 2];
        const e2x = this.triV[o + 6] - this.triV[o];
        const e2y = this.triV[o + 7] - this.triV[o + 1];
        const e2z = this.triV[o + 8] - this.triV[o + 2];
        let nx = e2y * e1z - e2z * e1y;
        let ny = e2z * e1x - e2x * e1z;
        let nz = e2x * e1y - e2y * e1x;
        const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (!(l > 1e-12)) continue; // degenerate: Chaos skips it too
        const f = mirrored ? -1 / l : 1 / l;
        nx *= f;
        ny *= f;
        nz *= f;
        this.triN[tri * 3] = nx;
        this.triN[tri * 3 + 1] = ny;
        this.triN[tri * 3 + 2] = nz;
        this.triMesh[tri] = meshIndex;
        this.triLocal[tri] = k / 3;
        this.triDouble[tri] = mesh.doubleSided ? 1 : 0;
        tri++;
      }
    });
    const meshTriangles = tri;
    bytes +=
      this.triV.byteLength +
      this.triN.byteLength +
      this.triMesh.byteLength +
      this.triLocal.byteLength +
      this.triDouble.byteLength;

    let cells = 0;
    for (const hf of set.heightfields) {
      this.heightfields.push({
        rows: hf.rows,
        cols: hf.cols,
        heights: hf.heights,
        holes: hf.holes,
        t: [hf.t[0], hf.t[1], hf.t[2]],
        r: quatMatrix(hf.q),
        s: [hf.s[0], hf.s[1], hf.s[2]],
        info: hf.info,
      });
      cells += (hf.rows - 1) * (hf.cols - 1);
      bytes += hf.heights.byteLength + (hf.holes?.byteLength ?? 0);
    }

    // Broad phase over every collider (mesh triangles one by one).
    const items =
      this.solids.length +
      this.spheres.length +
      this.capsules.length +
      meshTriangles +
      this.heightfields.length;
    this.itemKind = new Uint8Array(items);
    this.itemRef = new Int32Array(items);
    const bounds = new Float64Array(items * 6);
    let item = 0;
    const put = (kind: number, ref: number, b: ArrayLike<number>) => {
      this.itemKind[item] = kind;
      this.itemRef[item] = ref;
      for (let k = 0; k < 6; k++) bounds[item * 6 + k] = b[k];
      item++;
    };
    this.solids.forEach((s, i) => put(K_SOLID, i, s.bounds));
    this.spheres.forEach((s, i) =>
      put(K_SPHERE, i, [
        s.x - s.radius,
        s.y - s.radius,
        s.z - s.radius,
        s.x + s.radius,
        s.y + s.radius,
        s.z + s.radius,
      ])
    );
    this.capsules.forEach((c, i) => {
      const e = c.e;
      put(K_CAPSULE, i, [
        Math.min(e[0], e[3]) - c.radius,
        Math.min(e[1], e[4]) - c.radius,
        Math.min(e[2], e[5]) - c.radius,
        Math.max(e[0], e[3]) + c.radius,
        Math.max(e[1], e[4]) + c.radius,
        Math.max(e[2], e[5]) + c.radius,
      ]);
    });
    const b6 = new Float64Array(6);
    for (let t = 0; t < meshTriangles; t++) {
      b6[0] = b6[1] = b6[2] = Infinity;
      b6[3] = b6[4] = b6[5] = -Infinity;
      for (let c = 0; c < 3; c++)
        for (let k = 0; k < 3; k++) {
          const v = this.triV[t * 9 + c * 3 + k];
          b6[k] = Math.min(b6[k], v);
          b6[3 + k] = Math.max(b6[3 + k], v);
        }
      put(K_TRI, t, b6);
    }
    this.heightfields.forEach((hf, i) =>
      put(K_HF, i, this.heightfieldBounds(hf))
    );
    this.bvh = new Bvh(bounds, items);
    bytes +=
      bounds.byteLength +
      this.itemKind.byteLength +
      this.itemRef.byteLength +
      items * 3 * 4 * 2;

    this.build = {
      boxes: boxCount,
      spheres: this.spheres.length,
      capsules: this.capsules.length,
      hulls: this.solids.length - boxCount,
      meshTriangles,
      heightfields: this.heightfields.length,
      heightfieldCells: cells,
      degenerateHulls,
      flatHulls,
      bytes,
      buildMs: performance.now() - began,
    };
  }

  buildStats(): ExactBuildStats {
    return { ...this.build };
  }

  takeStats(): QueryStats {
    const stats = this.stats;
    this.stats = { sweeps: 0, lineTraces: 0, overlaps: 0, ms: 0 };
    return stats;
  }

  private makeSolid(
    pts: Float64Array,
    hull: Exclude<Hull, { kind: 'degenerate' }>,
    axes: Float64Array | null,
    searchDist: number,
    info: ColliderInfo,
    chaos: ChaosSolid
  ): Solid {
    const tris = hull.triangles;
    const nt = tris.length / 3;
    const normals = new Float64Array(nt * 3);
    const planes = new Float64Array(nt);
    for (let t = 0; t < nt; t++) {
      const a = tris[t * 3] * 3;
      const b = tris[t * 3 + 1] * 3;
      const c = tris[t * 3 + 2] * 3;
      const ux = pts[b] - pts[a];
      const uy = pts[b + 1] - pts[a + 1];
      const uz = pts[b + 2] - pts[a + 2];
      const vx = pts[c] - pts[a];
      const vy = pts[c + 1] - pts[a + 1];
      const vz = pts[c + 2] - pts[a + 2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      normals[t * 3] = nx;
      normals[t * 3 + 1] = ny;
      normals[t * 3 + 2] = nz;
      planes[t] = nx * pts[a] + ny * pts[a + 1] + nz * pts[a + 2];
    }
    const bounds = new Float64Array([
      Infinity,
      Infinity,
      Infinity,
      -Infinity,
      -Infinity,
      -Infinity,
    ]);
    for (let i = 0; i < pts.length; i += 3)
      for (let k = 0; k < 3; k++) {
        bounds[k] = Math.min(bounds[k], pts[i + k]);
        bounds[3 + k] = Math.max(bounds[3 + k], pts[i + k]);
      }
    return {
      verts: pts,
      tris,
      normals,
      planes,
      closed: hull.kind === 'solid',
      axes,
      searchDist,
      bounds,
      info,
      chaos,
    };
  }

  private heightfieldBounds(hf: Heightfield): number[] {
    let minH = Infinity;
    let maxH = -Infinity;
    for (let i = 0; i < hf.heights.length; i++) {
      minH = Math.min(minH, hf.heights[i]);
      maxH = Math.max(maxH, hf.heights[i]);
    }
    const out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const x of [0, hf.cols - 1])
      for (const y of [0, hf.rows - 1])
        for (const z of [minH, maxH]) {
          const w = this.hfWorld(hf, x, y, z);
          for (let k = 0; k < 3; k++) {
            out[k] = Math.min(out[k], w[k]);
            out[3 + k] = Math.max(out[3 + k], w[k]);
          }
        }
    return out;
  }

  private hfWorld(
    hf: Heightfield,
    x: number,
    y: number,
    z: number
  ): [number, number, number] {
    const lx = hf.s[0] * x;
    const ly = hf.s[1] * y;
    const lz = hf.s[2] * z;
    const m = hf.r;
    return [
      hf.t[0] + m[0] * lx + m[1] * ly + m[2] * lz,
      hf.t[1] + m[3] * lx + m[4] * ly + m[5] * lz,
      hf.t[2] + m[6] * lx + m[7] * ly + m[8] * lz,
    ];
  }

  /** Load heightfield cell (x, y) triangle `second` (Chaos face order:
   * (P0, P1, P3) then (P0, P3, P2)) into the current triangle. */
  private loadCell(
    hf: Heightfield,
    x: number,
    y: number,
    second: boolean
  ): void {
    const h = hf.heights;
    const c = hf.cols;
    const v = this.tv;
    const m = hf.r;
    const [sx, sy, sz] = hf.s;
    const [tx, ty, tz] = hf.t;
    // Corners: P0 (x, y), then P1 (x+1, y) and P3 (x+1, y+1), or P3 and P2 (x, y+1).
    const x1 = x + 1;
    const y1 = second ? y + 1 : y;
    const x2 = second ? x : x + 1;
    const y2 = y + 1;
    const gx = [x, x1, x2];
    const gy = [y, y1, y2];
    for (let k = 0; k < 3; k++) {
      const lx = sx * gx[k];
      const ly = sy * gy[k];
      const lz = sz * h[gy[k] * c + gx[k]];
      v[k * 3] = tx + m[0] * lx + m[1] * ly + m[2] * lz;
      v[k * 3 + 1] = ty + m[3] * lx + m[4] * ly + m[5] * lz;
      v[k * 3 + 2] = tz + m[6] * lx + m[7] * ly + m[8] * lz;
    }
    // Chaos: cross(B - A, C - A).
    const ux = v[3] - v[0];
    const uy = v[4] - v[1];
    const uz = v[5] - v[2];
    const wx = v[6] - v[0];
    const wy = v[7] - v[1];
    const wz = v[8] - v[2];
    const nx = uy * wz - uz * wy;
    const ny = uz * wx - ux * wz;
    const nz = ux * wy - uy * wx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    this.tnx = nx / l;
    this.tny = ny / l;
    this.tnz = nz / l;
    this.tDouble = true;
  }

  /** Heightfield cells (x, y) whose local footprint overlaps world box b. */
  private forCells(
    hf: Heightfield,
    b: ArrayLike<number>,
    visit: (x: number, y: number) => void
  ): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const m = hf.r;
    for (const wx of [b[0], b[3]])
      for (const wy of [b[1], b[4]])
        for (const wz of [b[2], b[5]]) {
          const rx = wx - hf.t[0];
          const ry = wy - hf.t[1];
          const rz = wz - hf.t[2];
          // local = R^T (w - t) / s
          const lx = (m[0] * rx + m[3] * ry + m[6] * rz) / hf.s[0];
          const ly = (m[1] * rx + m[4] * ry + m[7] * rz) / hf.s[1];
          minX = Math.min(minX, lx);
          maxX = Math.max(maxX, lx);
          minY = Math.min(minY, ly);
          maxY = Math.max(maxY, ly);
        }
    const x0 = Math.max(0, Math.floor(minX));
    const x1 = Math.min(hf.cols - 2, Math.floor(maxX));
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(hf.rows - 2, Math.floor(maxY));
    if (x0 > x1 || y0 > y1) return;
    // The cell under the box's centre first: in a sweep it usually holds the
    // first hit, which then prunes the rest (lowerBound).
    const cx = Math.min(x1, Math.max(x0, Math.floor((minX + maxX) / 2)));
    const cy = Math.min(y1, Math.max(y0, Math.floor((minY + maxY) / 2)));
    visit(cx, cy);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) if (x !== cx || y !== cy) visit(x, y);
  }

  private loadMeshTriangle(t: number): void {
    const o = t * 9;
    for (let k = 0; k < 9; k++) this.tv[k] = this.triV[o + k];
    this.tnx = this.triN[t * 3];
    this.tny = this.triN[t * 3 + 1];
    this.tnz = this.triN[t * 3 + 2];
    this.tDouble = this.triDouble[t] === 1;
    this.tOwner = this.triMesh[t];
  }

  // ---- Distance (core segment of the query capsule at p) ----

  /**
   * Distance from the core segment (half length this.a) centred at p to
   * the shape: signed for closed solids. Exact when it is at most `limit`;
   * otherwise some value above `limit`. With `wantPair`, the closest points
   * go to this.pair (core point, shape point), with the top-end tie rule.
   */
  private dist(
    kind: number,
    ref: number,
    px: number,
    py: number,
    pz: number,
    limit: number,
    wantPair: boolean
  ): number {
    const a = this.a;
    const z0 = pz - a;
    const z1 = pz + a;
    if (kind === K_TRI || kind === K_HF) {
      const v = this.tv;
      const d2 = segmentTriangle(
        px,
        py,
        z0,
        z1,
        v[0],
        v[1],
        v[2],
        v[3],
        v[4],
        v[5],
        v[6],
        v[7],
        v[8]
      );
      const u = Math.sqrt(d2);
      if (wantPair) {
        this.savePair();
        this.topTie(px, py, z1, u, v);
      }
      return u;
    }
    if (kind === K_SPHERE) {
      const s = this.spheres[ref];
      const sz = Math.min(z1, Math.max(z0, s.z));
      const ex = px - s.x;
      const ey = py - s.y;
      const ez = sz - s.z;
      const l = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (wantPair) {
        const f = l > 0 ? s.radius / l : 0;
        this.pair[0] = px;
        this.pair[1] = py;
        this.pair[2] = sz;
        this.pair[3] = s.x + ex * f;
        this.pair[4] = s.y + ey * f;
        this.pair[5] = s.z + (l > 0 ? ez * f : s.radius);
      }
      return l - s.radius;
    }
    if (kind === K_CAPSULE) {
      const c = this.capsules[ref];
      const e = c.e;
      const l = Math.sqrt(
        segmentSegmentVertical(
          px,
          py,
          z0,
          z1,
          e[0],
          e[1],
          e[2],
          e[3],
          e[4],
          e[5]
        )
      );
      if (wantPair) {
        const f = l > 0 ? c.radius / l : 0;
        this.pair[0] = closest.sx;
        this.pair[1] = closest.sy;
        this.pair[2] = closest.sz;
        this.pair[3] = closest.qx + (closest.sx - closest.qx) * f;
        this.pair[4] = closest.qy + (closest.sy - closest.qy) * f;
        this.pair[5] =
          closest.qz + (l > 0 ? (closest.sz - closest.qz) * f : c.radius);
      }
      return l - c.radius;
    }
    return this.solidDist(this.solids[ref], px, py, pz, limit, wantPair);
  }

  private savePair(): void {
    this.pair[0] = closest.sx;
    this.pair[1] = closest.sy;
    this.pair[2] = closest.sz;
    this.pair[3] = closest.qx;
    this.pair[4] = closest.qy;
    this.pair[5] = closest.qz;
  }

  /** Top-end tie rule for one triangle: if the core's top end is as close
   * as the closest pair, report the pair at the top end. */
  private topTie(
    px: number,
    py: number,
    z1: number,
    u: number,
    v: Float64Array
  ): void {
    if (this.pair[2] === z1) return;
    const d2 = pointTriangle(
      px,
      py,
      z1,
      v[0],
      v[1],
      v[2],
      v[3],
      v[4],
      v[5],
      v[6],
      v[7],
      v[8]
    );
    if (Math.sqrt(d2) <= u + TIE_CM) {
      const [qx, qy, qz] = lastTrianglePoint();
      this.pair[0] = px;
      this.pair[1] = py;
      this.pair[2] = z1;
      this.pair[3] = qx;
      this.pair[4] = qy;
      this.pair[5] = qz;
    }
  }

  private solidDist(
    s: Solid,
    px: number,
    py: number,
    pz: number,
    limit: number,
    wantPair: boolean
  ): number {
    const a = this.a;
    const z0 = pz - a;
    const z1 = pz + a;
    this.deepFace = -1;
    const verts = s.verts;
    const tris = s.tris;
    const v = this.scratch;
    let best2 = Infinity;
    let top2 = Infinity;
    let tqx = 0;
    let tqy = 0;
    let tqz = 0;
    const bx0 = px - limit;
    const bx1 = px + limit;
    const by0 = py - limit;
    const by1 = py + limit;
    const bz0 = z0 - limit;
    const bz1 = z1 + limit;
    for (let t = 0; t < tris.length; t += 3) {
      if (
        !this.loadSolidTriangle(verts, tris, t, v, bx0, by0, bz0, bx1, by1, bz1)
      )
        continue;
      const d2 = segmentTriangle(
        px,
        py,
        z0,
        z1,
        v[0],
        v[1],
        v[2],
        v[3],
        v[4],
        v[5],
        v[6],
        v[7],
        v[8]
      );
      if (d2 < best2) {
        best2 = d2;
        if (wantPair) this.savePair();
      }
      if (wantPair) {
        const dt = pointTriangle(
          px,
          py,
          z1,
          v[0],
          v[1],
          v[2],
          v[3],
          v[4],
          v[5],
          v[6],
          v[7],
          v[8]
        );
        if (dt < top2) {
          top2 = dt;
          [tqx, tqy, tqz] = lastTrianglePoint();
        }
      }
    }
    const u = Math.sqrt(best2);
    if (s.closed && (u === 0 || this.inside(s, px, py, z0)))
      return this.envelope(s, px, py, pz);
    if (!isFinite(u)) return limit + 1;
    if (wantPair && this.pair[2] !== z1 && Math.sqrt(top2) <= u + TIE_CM) {
      this.pair[0] = px;
      this.pair[1] = py;
      this.pair[2] = z1;
      this.pair[3] = tqx;
      this.pair[4] = tqy;
      this.pair[5] = tqz;
    }
    return u;
  }

  /** Copy solid triangle t into v if its box overlaps [b0, b1]. */
  private loadSolidTriangle(
    verts: Float64Array,
    tris: Uint32Array,
    t: number,
    v: Float64Array,
    bx0: number,
    by0: number,
    bz0: number,
    bx1: number,
    by1: number,
    bz1: number
  ): boolean {
    const i0 = tris[t] * 3;
    const i1 = tris[t + 1] * 3;
    const i2 = tris[t + 2] * 3;
    const ax = verts[i0];
    const bx = verts[i1];
    const cx = verts[i2];
    if (Math.min(ax, bx, cx) > bx1 || Math.max(ax, bx, cx) < bx0) return false;
    const ay = verts[i0 + 1];
    const by = verts[i1 + 1];
    const cy = verts[i2 + 1];
    if (Math.min(ay, by, cy) > by1 || Math.max(ay, by, cy) < by0) return false;
    const az = verts[i0 + 2];
    const bz = verts[i1 + 2];
    const cz = verts[i2 + 2];
    if (Math.min(az, bz, cz) > bz1 || Math.max(az, bz, cz) < bz0) return false;
    v[0] = ax;
    v[1] = ay;
    v[2] = az;
    v[3] = bx;
    v[4] = by;
    v[5] = bz;
    v[6] = cx;
    v[7] = cy;
    v[8] = cz;
    return true;
  }

  private inside(s: Solid, x: number, y: number, z: number): boolean {
    const b = s.bounds;
    if (x < b[0] || x > b[3] || y < b[1] || y > b[4] || z < b[2] || z > b[5])
      return false;
    const n = s.normals;
    for (let t = 0; t < s.planes.length; t++)
      if (n[t * 3] * x + n[t * 3 + 1] * y + n[t * 3 + 2] * z - s.planes[t] > 0)
        return false;
    return true;
  }

  /** The core segment meets the solid: min over the segment of the signed
   * distance max_i (n_i . x - c_i), a convex piecewise-linear function. */
  private envelope(s: Solid, px: number, py: number, pz: number): number {
    const n = s.normals;
    const planes = s.planes;
    let face = 0;
    const f = (sz: number): number => {
      let m = -Infinity;
      for (let t = 0; t < planes.length; t++) {
        const d =
          n[t * 3] * px +
          n[t * 3 + 1] * py +
          n[t * 3 + 2] * (pz + sz) -
          planes[t];
        if (d > m) {
          m = d;
          face = t;
        }
      }
      return m;
    };
    let lo = -this.a;
    let hi = this.a;
    let sz = 0;
    if (hi > lo) {
      let c = hi - GOLD * (hi - lo);
      let d = lo + GOLD * (hi - lo);
      let fc = f(c);
      let fd = f(d);
      for (let i = 0; i < ENVELOPE_ITERATIONS && hi - lo > 1e-12; i++) {
        if (fc <= fd) {
          hi = d;
          d = c;
          fd = fc;
          c = hi - GOLD * (hi - lo);
          fc = f(c);
        } else {
          lo = c;
          c = d;
          fc = fd;
          d = lo + GOLD * (hi - lo);
          fd = f(d);
        }
      }
      sz = (lo + hi) / 2;
      // Ties along the core (a face parallel to it): the top end, as for
      // contacts (TSegment::SupportCore).
      if (f(this.a) <= f(sz) + TIE_CM) sz = this.a;
    }
    const g = f(sz);
    this.deepFace = face;
    // Pair: the core point, and its projection onto that face.
    this.pair[0] = px;
    this.pair[1] = py;
    this.pair[2] = pz + sz;
    this.pair[3] = px - n[face * 3] * g;
    this.pair[4] = py - n[face * 3 + 1] * g;
    this.pair[5] = pz + sz - n[face * 3 + 2] * g;
    return g;
  }

  // ---- Time of impact ----

  /** First contact time of the current sweep with the shape in [0, tMax),
   * or Infinity. The capsule starts clear of it. */
  private toi(kind: number, ref: number, tMax: number): number {
    const { px, py, pz, dx, dy, dz, a, r } = this;
    if (kind === K_TRI || kind === K_HF) {
      if (!this.triangleInBox(this.tv)) return Infinity;
      // One-sided: a back face only counts when touched at the start.
      if (!this.tDouble && this.tnx * dx + this.tny * dy + this.tnz * dz > 0)
        return Infinity;
      return sweepPolygon(px, py, pz, dx, dy, dz, a, r, this.tv, 3, tMax);
    }
    if (kind === K_SPHERE) {
      const s = this.spheres[ref];
      const v = this.scratch;
      v[0] = s.x;
      v[1] = s.y;
      v[2] = s.z;
      return sweepPolygon(px, py, pz, dx, dy, dz, a, r + s.radius, v, 1, tMax);
    }
    if (kind === K_CAPSULE) {
      const c = this.capsules[ref];
      this.scratch.set(c.e);
      return sweepPolygon(
        px,
        py,
        pz,
        dx,
        dy,
        dz,
        a,
        r + c.radius,
        this.scratch,
        2,
        tMax
      );
    }
    const s = this.solids[ref];
    const qb = this.qb;
    const v = this.scratch;
    let best = tMax;
    for (let t = 0; t < s.tris.length; t += 3) {
      // A closed convex solid's first contact is on a face that faces the move.
      const f = t / 3;
      if (
        s.closed &&
        s.normals[f * 3] * dx +
          s.normals[f * 3 + 1] * dy +
          s.normals[f * 3 + 2] * dz >
          0
      )
        continue;
      if (
        !this.loadSolidTriangle(
          s.verts,
          s.tris,
          t,
          v,
          qb[0],
          qb[1],
          qb[2],
          qb[3],
          qb[4],
          qb[5]
        )
      )
        continue;
      const hit = sweepPolygon(px, py, pz, dx, dy, dz, a, r, v, 3, best);
      if (hit < best) best = hit;
    }
    return best < tMax ? best : Infinity;
  }

  private triangleInBox(v: Float64Array): boolean {
    const qb = this.qb;
    for (let k = 0; k < 3; k++) {
      const lo = Math.min(v[k], v[3 + k], v[6 + k]);
      const hi = Math.max(v[k], v[3 + k], v[6 + k]);
      if (lo > qb[3 + k] || hi < qb[k]) return false;
    }
    return true;
  }

  // ---- The sweep ----

  sweepCapsule(
    start: Vec3,
    end: Vec3,
    capsule: Capsule,
    options: SweepOptions = {}
  ): QueryHit | null {
    const began = performance.now();
    this.stats.sweeps++;
    try {
      this.rot = options.rotation ?? [0, 0, 0, 1];
      return this.sweep(
        start,
        end,
        capsule,
        options.ignoreOverlapsMovingOut ?? false
      );
    } finally {
      this.stats.ms += performance.now() - began;
    }
  }

  private setQuery(start: Vec3, end: Vec3, capsule: Capsule): void {
    this.px = start.x;
    this.py = start.y;
    this.pz = start.z;
    this.dx = end.x - start.x;
    this.dy = end.y - start.y;
    this.dz = end.z - start.z;
    this.dLen = Math.sqrt(
      this.dx * this.dx + this.dy * this.dy + this.dz * this.dz
    );
    this.r = capsule.radius;
    this.a = Math.max(0, capsule.halfHeight - capsule.radius);
    const m = this.r + PENETRATION_TOLERANCE + 1e-6;
    const qb = this.qb;
    qb[0] = Math.min(start.x, end.x) - m;
    qb[1] = Math.min(start.y, end.y) - m;
    qb[2] = Math.min(start.z, end.z) - this.a - m;
    qb[3] = Math.max(start.x, end.x) + m;
    qb[4] = Math.max(start.y, end.y) + m;
    qb[5] = Math.max(start.z, end.z) + this.a + m;
  }

  private sweep(
    start: Vec3,
    end: Vec3,
    capsule: Capsule,
    ignoreMovingOut: boolean
  ): QueryHit | null {
    this.setQuery(start, end, capsule);
    this.ignoreMovingOut = ignoreMovingOut;
    const best = this.best;
    best.found = false;
    best.time = 1;
    best.startPenetrating = false;
    this.candN = 0;
    const mag = Math.max(
      Math.abs(start.x),
      Math.abs(start.y),
      Math.abs(start.z),
      Math.abs(end.x),
      Math.abs(end.y),
      Math.abs(end.z)
    );
    this.tieWin =
      this.dLen > 0
        ? Math.max(CHAOS_TIE_CM, mag * CHAOS_TIE_REL) / this.dLen
        : 0;
    const qb = this.qb;
    this.bvh.query(qb[0], qb[1], qb[2], qb[3], qb[4], qb[5], (item) => {
      const kind = this.itemKind[item];
      const ref = this.itemRef[item];
      if (kind === K_TRI) {
        this.loadMeshTriangle(ref);
        this.consider(K_TRI, ref);
      } else if (kind === K_HF) {
        const hf = this.heightfields[ref];
        this.forCells(hf, qb, (x, y) => {
          const cell = y * (hf.cols - 1) + x;
          if (hf.holes && hf.holes[cell]) return;
          this.tOwner = ref;
          this.loadCell(hf, x, y, false);
          this.consider(K_HF, cell * 2);
          this.loadCell(hf, x, y, true);
          this.consider(K_HF, cell * 2 + 1);
        });
      } else {
        this.consider(kind, ref);
      }
    });
    if (!best.found) return null;
    if (
      !best.startPenetrating &&
      best.normal[2] === 0 &&
      (best.kind === K_SOLID || best.kind === K_TRI)
    )
      this.chaosContact();
    return {
      time: best.time,
      location: vec(best.loc[0], best.loc[1], best.loc[2]),
      impactPoint: vec(
        best.impactPoint[0],
        best.impactPoint[1],
        best.impactPoint[2]
      ),
      normal: vec(best.normal[0], best.normal[1], best.normal[2]),
      impactNormal: vec(
        best.impactNormal[0],
        best.impactNormal[1],
        best.impactNormal[2]
      ),
      startPenetrating: best.startPenetrating,
      penetrationDepth: best.startPenetrating ? best.depth : 0,
      source: best.source,
    };
  }

  /**
   * Whether the plane (n, c) separates the shape from everything the core
   * segment sweeps through, by more than r plus the touching tolerance:
   * the swept core is the parallelogram of its four corners, so it is
   * enough that all four lie beyond that distance on the outer side. Then
   * the shape can neither overlap, touch nor be hit by this sweep.
   */
  private separatedBy(nx: number, ny: number, nz: number, c: number): boolean {
    const m = this.r + PENETRATION_TOLERANCE + 1e-6;
    const base = nx * this.px + ny * this.py - c;
    const za = nz * (this.pz - this.a);
    const zb = nz * (this.pz + this.a);
    const move = nx * this.dx + ny * this.dy + nz * this.dz;
    return (
      base + za > m &&
      base + zb > m &&
      base + za + move > m &&
      base + zb + move > m
    );
  }

  /** A cheap exact reject before any closest-point work. */
  private rejects(kind: number, ref: number): boolean {
    if (kind === K_TRI || kind === K_HF) {
      const v = this.tv;
      const c = this.tnx * v[0] + this.tny * v[1] + this.tnz * v[2];
      return (
        this.separatedBy(this.tnx, this.tny, this.tnz, c) ||
        this.separatedBy(-this.tnx, -this.tny, -this.tnz, -c)
      );
    }
    if (kind !== K_SOLID) return false;
    const s = this.solids[ref];
    const n = s.normals;
    for (let f = 0; f < s.planes.length; f++)
      if (this.separatedBy(n[f * 3], n[f * 3 + 1], n[f * 3 + 2], s.planes[f]))
        return true;
    if (!s.closed)
      for (let f = 0; f < s.planes.length; f++)
        if (
          this.separatedBy(
            -n[f * 3],
            -n[f * 3 + 1],
            -n[f * 3 + 2],
            -s.planes[f]
          )
        )
          return true;
    return false;
  }

  /**
   * A lower bound on the time the sweep can first touch the shape: for a
   * plane with the start's core segment beyond r + tolerance on its outer
   * side, the shape (behind the plane) can't be touched before the core
   * closes that gap. 0 when no plane gives a bound.
   */
  private lowerBound(kind: number, ref: number): number {
    const m = this.r + PENETRATION_TOLERANCE + 1e-6;
    const bound = (nx: number, ny: number, nz: number, c: number): number => {
      const base = nx * this.px + ny * this.py + nz * this.pz - c;
      const gap = base - Math.abs(nz) * this.a - m;
      const closing = -(nx * this.dx + ny * this.dy + nz * this.dz);
      return gap > 0 && closing > 0 ? gap / closing : 0;
    };
    if (kind === K_TRI || kind === K_HF) {
      const v = this.tv;
      const c = this.tnx * v[0] + this.tny * v[1] + this.tnz * v[2];
      return Math.max(
        bound(this.tnx, this.tny, this.tnz, c),
        bound(-this.tnx, -this.tny, -this.tnz, -c)
      );
    }
    if (kind !== K_SOLID) return 0;
    const s = this.solids[ref];
    if (!s.closed) return 0;
    const n = s.normals;
    let lb = 0;
    for (let f = 0; f < s.planes.length; f++)
      lb = Math.max(
        lb,
        bound(n[f * 3], n[f * 3 + 1], n[f * 3 + 2], s.planes[f])
      );
    return lb;
  }

  /** The combination rule of the box oracle (exact_obb_world), per shape. */
  private consider(kind: number, ref: number): void {
    if (this.rejects(kind, ref)) return;
    const best = this.best;
    // Can't beat (or tie, see chaosContact) the best hit so far (a starting
    // overlap always counts).
    if (best.found && this.lowerBound(kind, ref) > best.time + this.tieWin)
      return;
    const key = this.keyOf(kind, ref);
    const { px, py, pz, r } = this;
    const limit = r + PENETRATION_TOLERANCE + 1e-6;
    const g0 = this.dist(kind, ref, px, py, pz, limit, false);
    const h0 = g0 - r;
    if (h0 < -PENETRATION_TOLERANCE) {
      this.dist(kind, ref, px, py, pz, limit, true);
      const normal = snapNormal(...this.penetrationNormal(kind, ref));
      if (
        this.ignoreMovingOut &&
        this.dx * normal[0] + this.dy * normal[1] + this.dz * normal[2] > 0
      )
        return;
      const depth = r - g0;
      if (
        !best.found ||
        !best.startPenetrating ||
        depth > best.depth ||
        (depth === best.depth && key < best.key)
      ) {
        best.found = true;
        best.time = 0;
        best.startPenetrating = true;
        best.depth = depth;
        best.loc[0] = px;
        best.loc[1] = py;
        best.loc[2] = pz;
        best.impactPoint[0] = this.pair[3];
        best.impactPoint[1] = this.pair[4];
        best.impactPoint[2] = this.pair[5];
        best.normal[0] = best.impactNormal[0] = normal[0];
        best.normal[1] = best.impactNormal[1] = normal[1];
        best.normal[2] = best.impactNormal[2] = normal[2];
        best.source = this.sourceOf(kind, ref);
        best.key = key;
        best.kind = kind;
        best.ref = ref;
      }
      return;
    }
    if (best.found && best.startPenetrating) return;
    if (this.dLen === 0) return;
    let t: number;
    if (h0 <= PENETRATION_TOLERANCE) {
      // Touching: a hit at time 0 only if the move goes into it.
      const f = Math.min(1, TOUCH_PROBE);
      const g1 = this.dist(
        kind,
        ref,
        px + this.dx * f,
        py + this.dy * f,
        pz + this.dz * f,
        r + 1,
        false
      );
      if (g1 - r >= h0) return;
      t = 0;
    } else {
      t = this.toi(
        kind,
        ref,
        best.found ? Math.min(1, best.time + this.tieWin) : 1
      );
      if (!isFinite(t)) return;
    }
    if (kind === K_SOLID || kind === K_TRI) this.noteCandidate(kind, ref, t);
    if (best.found && (best.time < t || (best.time === t && best.key < key)))
      return;
    this.setBestHit(kind, ref, t, key);
  }

  /** Fill the best hit from a contact of (kind, ref) at time t (the
   * current triangle loaded for K_TRI). */
  private setBestHit(kind: number, ref: number, t: number, key: number): void {
    const best = this.best;
    const { px, py, pz, r } = this;
    const lx = px + this.dx * t;
    const ly = py + this.dy * t;
    const lz = pz + this.dz * t;
    this.dist(kind, ref, lx, ly, lz, r + 1, true);
    const pair = this.pair;
    let nx = pair[0] - pair[3];
    let ny = pair[1] - pair[4];
    let nz = pair[2] - pair[5];
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nl > 1e-12) {
      nx /= nl;
      ny /= nl;
      nz /= nl;
    } else {
      [nx, ny, nz] = this.penetrationNormal(kind, ref);
    }
    [nx, ny, nz] = snapNormal(nx, ny, nz);
    best.found = true;
    best.time = t;
    best.startPenetrating = false;
    best.depth = 0;
    best.loc[0] = lx;
    best.loc[1] = ly;
    best.loc[2] = lz;
    // Chaos returns the impact point through float32.
    best.impactPoint[0] = Math.fround(pair[3]);
    best.impactPoint[1] = Math.fround(pair[4]);
    best.impactPoint[2] = Math.fround(pair[5]);
    best.normal[0] = nx;
    best.normal[1] = ny;
    best.normal[2] = nz;
    this.impactNormal(
      kind,
      ref,
      nx,
      ny,
      nz,
      best.impactPoint,
      best.impactNormal
    );
    best.source = this.sourceOf(kind, ref);
    best.key = key;
    best.kind = kind;
    best.ref = ref;
  }

  /** A contact within the Chaos tie window of the best so far. */
  private noteCandidate(kind: number, ref: number, t: number): void {
    const best = this.best;
    if (best.found && t > best.time + this.tieWin) return;
    const n = this.candN++;
    this.candKind[n] = kind;
    this.candRef[n] = ref;
    this.candTime[n] = t;
  }

  /**
   * The best hit is a contact parallel to the capsule's axis on a box,
   * hull or mesh triangle: take the impact point Chaos reports
   * (findings/chaos-contact-point.md). Every candidate within the tie
   * window is swept through chaos_gjk; the scene query keeps the smallest
   * float distance (SQVisitor), a mesh the first triangle with the
   * smallest (FTriangleMeshSweepVisitor, strict <, faces in index order
   * within a BVH leaf). The time stays the layer's exact one; ImpactNormal
   * is recomputed from the new point. A different shape replaces the best
   * only if its own contact is parallel too.
   */
  private chaosContact(): void {
    if (process.env.NO_CHAOS) return;
    const best = this.best;
    this.chaos.contacts++;
    const input: CapsuleSweepInput = {
      start: [this.px, this.py, this.pz],
      end: [this.px + this.dx, this.py + this.dy, this.pz + this.dz],
      rotation: this.rot,
      radius: this.r,
      halfLength: this.a,
    };
    const limit = best.time + this.tieWin;
    const hits: { h: ChaosHit; kind: number; ref: number; t: number }[] = [];
    for (let i = 0; i < this.candN; i++) {
      const t = this.candTime[i];
      if (t > limit) continue;
      const kind = this.candKind[i];
      const ref = this.candRef[i];
      // A shape can be noted more than once (heightfield cells aside, each
      // consider() call notes it at most once; keep the first).
      if (hits.some((x) => x.kind === kind && x.ref === ref)) continue;
      this.chaos.chaosCalls++;
      const h = this.chaosSweep(kind, ref, input);
      if (h) hits.push({ h, kind, ref, t });
    }
    const sameMesh = (a: { kind: number; ref: number }, b: typeof a) =>
      a.kind === K_TRI &&
      b.kind === K_TRI &&
      this.triMesh[a.ref] === this.triMesh[b.ref];
    const isBest = (x: { kind: number; ref: number }) =>
      x.kind === best.kind && x.ref === best.ref;
    // Smallest float distance; within a mesh the lower triangle index
    // (visited first); between shapes the layer's own choice, then its key.
    hits.sort((x, y) => {
      if (x.h.distance !== y.h.distance) return x.h.distance - y.h.distance;
      if (sameMesh(x, y)) return this.triLocal[x.ref] - this.triLocal[y.ref];
      if (isBest(x) !== isBest(y)) return isBest(x) ? -1 : 1;
      return this.keyOf(x.kind, x.ref) - this.keyOf(y.kind, y.ref);
    });
    const first = hits[0];
    const tiedShapes =
      !!first &&
      hits.some(
        (x) =>
          x !== first &&
          x.h.distance === first.h.distance &&
          !sameMesh(x, first) &&
          !(x.kind === first.kind && x.ref === first.ref)
      );
    const win = first ? first.h : null;
    const winKind = first ? first.kind : -1;
    const winRef = first ? first.ref : -1;
    const winTime = first ? first.t : 0;
    if (tiedShapes) this.chaos.unresolvedTies++;
    if (!win) {
      // Chaos reports no positive-time hit (a touching start inside the
      // layer's tolerance): the exact point stays.
      this.chaos.noChaosHit++;
      return;
    }
    if (winKind !== best.kind || winRef !== best.ref) {
      const saved = this.saveBest();
      if (winKind === K_TRI) this.loadMeshTriangle(winRef);
      this.setBestHit(winKind, winRef, winTime, this.keyOf(winKind, winRef));
      if (best.normal[2] !== 0) {
        this.restoreBest(saved);
      } else {
        this.chaos.switched++;
      }
    }
    if (winKind !== best.kind || winRef !== best.ref) return;
    best.impactPoint[0] = win.impactPoint[0];
    best.impactPoint[1] = win.impactPoint[1];
    best.impactPoint[2] = win.impactPoint[2];
    if (best.kind === K_TRI) this.loadMeshTriangle(best.ref);
    this.impactNormal(
      best.kind,
      best.ref,
      best.normal[0],
      best.normal[1],
      best.normal[2],
      best.impactPoint,
      best.impactNormal
    );
  }

  /** Chaos's sweep of the current query against one box, hull or mesh
   * triangle. */
  private chaosSweep(
    kind: number,
    ref: number,
    input: CapsuleSweepInput
  ): ChaosHit | null {
    if (kind === K_SOLID) {
      const c = this.solids[ref].chaos;
      if (!c.support) c.support = c.build();
      return chaosConvexSweep(c.support, c.pose, input);
    }
    const mi = this.triMesh[ref];
    const mesh = this.meshes[mi];
    const k = this.triLocal[ref] * 3;
    const v = mesh.vertices;
    const tri = mesh.triangles;
    const p = (i: number): F3 => [
      Math.fround(v[i * 3]),
      Math.fround(v[i * 3 + 1]),
      Math.fround(v[i * 3 + 2]),
    ];
    // Cooked order: render v0 and v1 swapped (ChaosCooking.cpp:41).
    return chaosTriangleSweep(
      [p(tri[k + 1]), p(tri[k]), p(tri[k + 2])],
      mesh.s,
      this.meshPose[mi],
      input
    );
  }

  private saveBest(): Best {
    const b = this.best;
    return {
      ...b,
      loc: [...b.loc],
      impactPoint: [...b.impactPoint],
      normal: [...b.normal],
      impactNormal: [...b.impactNormal],
    };
  }

  private restoreBest(saved: Best): void {
    Object.assign(this.best, saved);
  }

  /** Parallel-contact counters since the last call (and reset them). */
  takeChaosStats(): ChaosContactStats {
    const out = this.chaos;
    this.chaos = {
      contacts: 0,
      chaosCalls: 0,
      switched: 0,
      unresolvedTies: 0,
      noChaosHit: 0,
    };
    return out;
  }

  /** A collider's stable key: kind, then owner, then the triangle or cell. */
  private keyOf(kind: number, ref: number): number {
    if (kind === K_HF) return K_HF * 2 ** 48 + this.tOwner * 2 ** 26 + ref;
    return kind * 2 ** 48 + ref;
  }

  /** Exit direction of a starting overlap (after dist(..., wantPair)). */
  private penetrationNormal(
    kind: number,
    ref: number
  ): [number, number, number] {
    const pair = this.pair;
    if (kind === K_SOLID && this.deepFace >= 0) {
      const n = this.solids[ref].normals;
      const f = this.deepFace;
      return [n[f * 3], n[f * 3 + 1], n[f * 3 + 2]];
    }
    if (kind === K_HF) return [this.tnx, this.tny, this.tnz];
    const ex = pair[0] - pair[3];
    const ey = pair[1] - pair[4];
    const ez = pair[2] - pair[5];
    const l = Math.sqrt(ex * ex + ey * ey + ez * ez);
    if (l > 1e-9) return [ex / l, ey / l, ez / l];
    if (kind === K_TRI) {
      // Pierced: the face normal on the capsule centre's side.
      const v = this.tv;
      const side =
        this.tnx * (this.px - v[0]) +
        this.tny * (this.py - v[1]) +
        this.tnz * (this.pz - v[2]);
      return side >= 0
        ? [this.tnx, this.tny, this.tnz]
        : [-this.tnx, -this.tny, -this.tnz];
    }
    return [0, 0, 1];
  }

  private impactNormal(
    kind: number,
    ref: number,
    nx: number,
    ny: number,
    nz: number,
    point: readonly number[],
    out: [number, number, number]
  ): void {
    const { dx, dy, dz, dLen } = this;
    out[0] = nx;
    out[1] = ny;
    out[2] = nz;
    if (kind === K_SPHERE || kind === K_CAPSULE) return;
    if (kind === K_SOLID) {
      const s = this.solids[ref];
      if (s.axes) {
        // TAABB::FindGeometryOpposingNormal, in the box's frame.
        const ax = s.axes;
        let bestDot = Infinity;
        for (let i = 0; i < 3; i++) {
          const ln = nx * ax[i * 3] + ny * ax[i * 3 + 1] + nz * ax[i * 3 + 2];
          const ld = dx * ax[i * 3] + dy * ax[i * 3 + 1] + dz * ax[i * 3 + 2];
          if (ln > KINDA_SMALL) {
            if (ld < bestDot) {
              bestDot = ld;
              out[0] = ax[i * 3];
              out[1] = ax[i * 3 + 1];
              out[2] = ax[i * 3 + 2];
            }
          } else if (ln < -KINDA_SMALL) {
            if (-ld < bestDot) {
              bestDot = -ld;
              out[0] = -ax[i * 3];
              out[1] = -ax[i * 3 + 1];
              out[2] = -ax[i * 3 + 2];
            }
          }
        }
        return;
      }
      // FConvex::FindMostOpposingFaceScaled: planes within searchDist of
      // the impact point, the one most opposing the trace.
      let bestDot = Infinity;
      const n = s.normals;
      for (let t = 0; t < s.planes.length; t++) {
        const dist =
          n[t * 3] * point[0] +
          n[t * 3 + 1] * point[1] +
          n[t * 3 + 2] * point[2] -
          s.planes[t];
        for (const sign of s.closed ? [1] : [1, -1]) {
          if (Math.abs(dist) >= s.searchDist) continue;
          const dot =
            (sign * (n[t * 3] * dx + n[t * 3 + 1] * dy + n[t * 3 + 2] * dz)) /
            dLen;
          if (dot < bestDot) {
            bestDot = dot;
            out[0] = sign * n[t * 3];
            out[1] = sign * n[t * 3 + 1];
            out[2] = sign * n[t * 3 + 2];
          }
        }
      }
      if (bestDot === Infinity) {
        // CHAOS_ENSURE path: FindGeometryOpposingNormal without a face.
        out[0] = 0;
        out[1] = 0;
        out[2] = 1;
      }
      return;
    }
    // Triangle mesh or heightfield: FindMostOpposingFace over the shape's
    // triangles within 1 cm of the impact point; the hit triangle if none.
    out[0] = this.tnx;
    out[1] = this.tny;
    out[2] = this.tnz;
    let bestDot = Infinity;
    const consider = (
      v: Float64Array,
      tnx: number,
      tny: number,
      tnz: number
    ) => {
      const d2 = pointTriangle(
        point[0],
        point[1],
        point[2],
        v[0],
        v[1],
        v[2],
        v[3],
        v[4],
        v[5],
        v[6],
        v[7],
        v[8]
      );
      if (d2 >= OPPOSING_SEARCH_CM * OPPOSING_SEARCH_CM) return;
      const dot = (tnx * dx + tny * dy + tnz * dz) / dLen;
      if (dot < bestDot) {
        bestDot = dot;
        out[0] = tnx;
        out[1] = tny;
        out[2] = tnz;
      }
    };
    const search = new Float64Array([
      point[0] - OPPOSING_SEARCH_CM,
      point[1] - OPPOSING_SEARCH_CM,
      point[2] - OPPOSING_SEARCH_CM,
      point[0] + OPPOSING_SEARCH_CM,
      point[1] + OPPOSING_SEARCH_CM,
      point[2] + OPPOSING_SEARCH_CM,
    ]);
    // Keep the current triangle: the search reuses tv.
    const saved = this.tv.slice();
    const savedN = [this.tnx, this.tny, this.tnz];
    const savedDouble = this.tDouble;
    const owner = this.tOwner;
    if (kind === K_TRI) {
      this.bvh.query(
        search[0],
        search[1],
        search[2],
        search[3],
        search[4],
        search[5],
        (item) => {
          if (this.itemKind[item] !== K_TRI) return;
          const t = this.itemRef[item];
          if (this.triMesh[t] !== owner) return;
          const n = this.triN;
          consider(
            this.triV.subarray(t * 9, t * 9 + 9),
            n[t * 3],
            n[t * 3 + 1],
            n[t * 3 + 2]
          );
        }
      );
    } else {
      const hf = this.heightfields[owner];
      this.forCells(hf, search, (x, y) => {
        // Chaos checks hole cells here too (HeightField.cpp:2349).
        this.loadCell(hf, x, y, false);
        consider(this.tv, this.tnx, this.tny, this.tnz);
        this.loadCell(hf, x, y, true);
        consider(this.tv, this.tnx, this.tny, this.tnz);
      });
    }
    this.tv.set(saved);
    [this.tnx, this.tny, this.tnz] = savedN;
    this.tDouble = savedDouble;
    this.tOwner = owner;
  }

  private sourceOf(kind: number, ref: number): string {
    switch (kind) {
      case K_SOLID:
        return this.solids[ref].info.source;
      case K_SPHERE:
        return this.spheres[ref].info.source;
      case K_CAPSULE:
        return this.capsules[ref].info.source;
      case K_TRI:
        return this.meshInfo[this.triMesh[ref]].source;
      default:
        return this.heightfields[this.tOwner].info.source;
    }
  }

  // ---- Line trace ----

  lineTrace(start: Vec3, end: Vec3): QueryHit | null {
    const began = performance.now();
    this.stats.lineTraces++;
    try {
      return this.trace(start, end);
    } finally {
      this.stats.ms += performance.now() - began;
    }
  }

  private trace(start: Vec3, end: Vec3): QueryHit | null {
    const ox = start.x;
    const oy = start.y;
    const oz = start.z;
    const dx = end.x - ox;
    const dy = end.y - oy;
    const dz = end.z - oz;
    let bestT = Infinity;
    let inside = false;
    const n = [0, 0, 0];
    let source = '';
    const qb = new Float64Array([
      Math.min(ox, end.x),
      Math.min(oy, end.y),
      Math.min(oz, end.z),
      Math.max(ox, end.x),
      Math.max(oy, end.y),
      Math.max(oz, end.z),
    ]);
    const triangle = (
      v: Float64Array,
      nx: number,
      ny: number,
      nz: number,
      double: boolean,
      src: () => string
    ) => {
      if (!double && nx * dx + ny * dy + nz * dz > 0) return; // back face culled
      const t = rayTriangle(
        ox,
        oy,
        oz,
        dx,
        dy,
        dz,
        v,
        Math.min(bestT, 1 + 1e-12)
      );
      if (t < bestT && t <= 1) {
        bestT = t;
        inside = false;
        n[0] = nx;
        n[1] = ny;
        n[2] = nz;
        source = src();
      }
    };
    this.bvh.query(qb[0], qb[1], qb[2], qb[3], qb[4], qb[5], (item) => {
      const kind = this.itemKind[item];
      const ref = this.itemRef[item];
      if (kind === K_TRI) {
        const tn = this.triN;
        triangle(
          this.triV.subarray(ref * 9, ref * 9 + 9),
          tn[ref * 3],
          tn[ref * 3 + 1],
          tn[ref * 3 + 2],
          this.triDouble[ref] === 1,
          () => this.meshInfo[this.triMesh[ref]].source
        );
      } else if (kind === K_HF) {
        const hf = this.heightfields[ref];
        this.forCells(hf, qb, (x, y) => {
          if (hf.holes && hf.holes[y * (hf.cols - 1) + x]) return;
          for (const second of [false, true]) {
            this.loadCell(hf, x, y, second);
            triangle(
              this.tv,
              this.tnx,
              this.tny,
              this.tnz,
              true,
              () => hf.info.source
            );
          }
        });
      } else if (kind === K_SPHERE) {
        const s = this.spheres[ref];
        const mx = ox - s.x;
        const my = oy - s.y;
        const mz = oz - s.z;
        if (mx * mx + my * my + mz * mz <= s.radius * s.radius) {
          if (0 < bestT) {
            bestT = 0;
            inside = true;
            source = s.info.source;
          }
          return;
        }
        const t = raySphere(ox, oy, oz, dx, dy, dz, s.x, s.y, s.z, s.radius);
        if (t < bestT && t <= 1) {
          bestT = t;
          inside = false;
          const hx = ox + dx * t - s.x;
          const hy = oy + dy * t - s.y;
          const hz = oz + dz * t - s.z;
          const l = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
          n[0] = hx / l;
          n[1] = hy / l;
          n[2] = hz / l;
          source = s.info.source;
        }
      } else if (kind === K_CAPSULE) {
        const c = this.capsules[ref];
        this.scratch.set(c.e);
        const t = sweepPolygon(
          ox,
          oy,
          oz,
          dx,
          dy,
          dz,
          0,
          c.radius,
          this.scratch,
          2,
          Math.min(bestT, 1 + 1e-12)
        );
        if (t < bestT && t <= 1) {
          bestT = t;
          inside = false;
          const hx = ox + dx * t;
          const hy = oy + dy * t;
          const hz = oz + dz * t;
          segmentSegmentVertical(
            hx,
            hy,
            hz,
            hz,
            c.e[0],
            c.e[1],
            c.e[2],
            c.e[3],
            c.e[4],
            c.e[5]
          );
          const ex = hx - closest.qx;
          const ey = hy - closest.qy;
          const ez = hz - closest.qz;
          const l = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
          n[0] = ex / l;
          n[1] = ey / l;
          n[2] = ez / l;
          source = c.info.source;
        }
      } else {
        const s = this.solids[ref];
        if (!s.closed) {
          const v = this.scratch;
          for (let t = 0; t < s.tris.length; t += 3) {
            if (
              !this.loadSolidTriangle(
                s.verts,
                s.tris,
                t,
                v,
                qb[0],
                qb[1],
                qb[2],
                qb[3],
                qb[4],
                qb[5]
              )
            )
              continue;
            const f = t / 3;
            triangle(
              v,
              s.normals[f * 3],
              s.normals[f * 3 + 1],
              s.normals[f * 3 + 2],
              true,
              () => s.info.source
            );
          }
          return;
        }
        // FConvex::Raycast: entry and exit over the face planes.
        let entry = 0;
        let exit = 1;
        let plane = -1;
        const sn = s.normals;
        for (let f = 0; f < s.planes.length; f++) {
          const dist =
            sn[f * 3] * ox +
            sn[f * 3 + 1] * oy +
            sn[f * 3 + 2] * oz -
            s.planes[f];
          const nd = sn[f * 3] * dx + sn[f * 3 + 1] * dy + sn[f * 3 + 2] * dz;
          if (nd === 0) {
            if (dist > 0) return;
            continue;
          }
          const t = -dist / nd;
          if (nd < 0) {
            if (t > entry) {
              entry = t;
              plane = f;
            }
          } else exit = Math.min(exit, t);
          if (entry > exit) return;
        }
        if (entry < bestT) {
          bestT = entry;
          inside = plane < 0;
          if (plane >= 0) {
            n[0] = sn[plane * 3];
            n[1] = sn[plane * 3 + 1];
            n[2] = sn[plane * 3 + 2];
          } else {
            const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            n[0] = -dx / l;
            n[1] = -dy / l;
            n[2] = -dz / l;
          }
          source = s.info.source;
        }
      }
    });
    if (!isFinite(bestT)) return null;
    const point = vec(ox + dx * bestT, oy + dy * bestT, oz + dz * bestT);
    const normal = vec(n[0], n[1], n[2]);
    return {
      time: bestT,
      location: point,
      impactPoint: point,
      normal,
      impactNormal: normal,
      startPenetrating: inside,
      penetrationDepth: 0,
      source,
    };
  }

  // ---- Overlap ----

  overlapCapsule(position: Vec3, capsule: Capsule): boolean {
    const began = performance.now();
    this.stats.overlaps++;
    try {
      this.setQuery(position, position, capsule);
      const { px, py, pz, r } = this;
      let found = false;
      const qb = this.qb;
      this.bvh.query(qb[0], qb[1], qb[2], qb[3], qb[4], qb[5], (item) => {
        if (found) return;
        const kind = this.itemKind[item];
        const ref = this.itemRef[item];
        if (kind === K_TRI) {
          this.loadMeshTriangle(ref);
          if (this.dist(K_TRI, ref, px, py, pz, r, false) < r) found = true;
        } else if (kind === K_HF) {
          const hf = this.heightfields[ref];
          this.forCells(hf, qb, (x, y) => {
            if (found || (hf.holes && hf.holes[y * (hf.cols - 1) + x])) return;
            for (const second of [false, true]) {
              this.loadCell(hf, x, y, second);
              if (this.dist(K_HF, 0, px, py, pz, r, false) < r) found = true;
            }
          });
        } else if (this.dist(kind, ref, px, py, pz, r, false) < r) found = true;
      });
      return found;
    } finally {
      this.stats.ms += performance.now() - began;
    }
  }
}
