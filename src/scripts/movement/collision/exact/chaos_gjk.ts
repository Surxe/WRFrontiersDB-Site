/**
 * Chaos's capsule sweep (GJKRaycast2ImplSimd) in float32, operation for
 * operation: since MVP session 4.5 (D26) the reported hit of every capsule
 * sweep (time, point, normal, the initial-overlap status and depth;
 * findings/chaos-sweeps.md), first ported by session 3.5 for the impact
 * point on parallel contacts (findings/chaos-contact-point.md).
 *
 * Source: UE 5.4.4
 * - Experimental/Chaos/Public/Chaos/GJK.h: GJKRaycast2ImplSimd (:1536,
 *   with its bComputeMTD exit: GJK's closest points, or VectorEPA when the
 *   cores overlap), GJKRaycast2Impl (:1900), FGeomGJKHelperSIMD (:42);
 * - GeometryQueries.h SweepQuery (:156): the double-precision set-up
 *   (BToATM, LocalDir, InitialDir = ATM.Location - BTM.Location) and the
 *   way back to world space (the normal's GetSafeNormal);
 * - TriangleMeshImplicitObject.cpp: ComputeScaledSweepInputs (:1546),
 *   FTriangleMeshSweepVisitor::VisitSweep (:1272), TransformSweepOutputsHelper
 *   (:72); ImplicitObjectScaled.h LowLevelSweepGeom (:638);
 * - the supports: TAABB::SupportCore (AABB.h:352), FConvex::GetSupportVertex
 *   (Convex.h:549, float dot, first maximum), FTriangleRegister
 *   (TriangleRegister.h:26), TSphere::SupportCoreSimd (Sphere.h:209, the
 *   centre), FCapsule::SupportCoreSimd (Capsule.h:371, TSegment::SupportCore
 *   in double), the swept capsule's TSegment::SupportCore (Segment.h:53).
 * The float primitives and the simplex solver are in chaos_simd.ts, EPA in
 * chaos_epa.ts, the heightfield visitor in chaos_heightfield.ts.
 */
import type { V3 } from './colliders';
import { vectorEpa } from './chaos_epa';
import {
  add,
  closestToOrigin,
  dinv,
  dmul,
  dot3,
  drot,
  EPS2,
  f,
  FLT_MAX,
  madd,
  neg,
  normalize,
  qnormalizeSafe,
  qrot,
  scale,
  sub,
  ZERO,
  type DQ,
  type F3,
  type FQ,
  type SimplexState,
} from './chaos_simd';

export type { F3 } from './chaos_simd';
export { drot } from './chaos_simd';

// ---- shapes (A, the static geometry, in its local frame) ----

/** A's support in float32 for a float32 direction (SupportCoreSimd: a
 * capsule sweep never adds a sweep margin to the other shape). */
export type SupportFn = (d: F3) => F3;

/** A static shape as GJK sees it: its core support and its margin (the
 * radius for spheres and capsules, 0 for boxes, hulls and triangles). */
export interface ShapeA {
  support: SupportFn;
  margin: number;
}

/** TBox / TAABB::SupportCore, margin 0: per axis the min corner when the
 * direction is negative, else the max (so -0 picks the max). */
export function boxSupport(min: V3, max: V3): SupportFn {
  const lo: F3 = [f(min[0]), f(min[1]), f(min[2])];
  const hi: F3 = [f(max[0]), f(max[1]), f(max[2])];
  return (d) => [
    d[0] < 0 ? lo[0] : hi[0],
    d[1] < 0 ? lo[1] : hi[1],
    d[2] < 0 ? lo[2] : hi[2],
  ];
}

/**
 * FConvex inside TImplicitObjectScaled / Instanced, margin 0:
 * GetSupportVertex over the cooked float vertices with a float dot
 * product of the (scaled) direction, the first maximum winning; then
 * vertex x scale. `points` are the cooked vertices in Chaos's order.
 */
export function convexSupport(points: ArrayLike<number>, s: V3): SupportFn {
  const n = points.length / 3;
  const v = new Float64Array(points.length);
  for (let i = 0; i < points.length; i++) v[i] = f(points[i]);
  const unit = s[0] === 1 && s[1] === 1 && s[2] === 1;
  return (d) => {
    const dx = unit ? d[0] : f(s[0] * d[0]);
    const dy = unit ? d[1] : f(s[1] * d[1]);
    const dz = unit ? d[2] : f(s[2] * d[2]);
    let best = -FLT_MAX;
    let bi = -1;
    for (let i = 0; i < n; i++) {
      const dot = f(
        f(f(v[i * 3] * dx) + f(v[i * 3 + 1] * dy)) + f(v[i * 3 + 2] * dz)
      );
      if (dot > best) {
        best = dot;
        bi = i;
      }
    }
    if (bi < 0) return [0, 0, 0];
    if (unit) return [v[bi * 3], v[bi * 3 + 1], v[bi * 3 + 2]];
    return [
      f(v[bi * 3] * s[0]),
      f(v[bi * 3 + 1] * s[1]),
      f(v[bi * 3 + 2] * s[2]),
    ];
  };
}

/** FTriangleRegister::SupportCoreSimd: A unless B or C dot higher; on
 * ties B beats A, and C wins only when neither A nor B is the maximum. */
export function triangleSupport(a: F3, b: F3, c: F3): SupportFn {
  return (d) => {
    const da = dot3(a, d);
    const db = dot3(b, d);
    const dc = dot3(c, d);
    if (db >= da && db >= dc) return b;
    if (da >= db && da >= dc) return a;
    return c;
  };
}

/** TSphere::SupportCoreSimd: the centre (the radius is the margin). */
export function sphereShape(center: V3, radius: number): ShapeA {
  const c: F3 = [f(center[0]), f(center[1]), f(center[2])];
  return { support: () => c, margin: f(radius) };
}

/**
 * FCapsule::SupportCoreSimd: TSegment::SupportCore in double (X2 when the
 * direction's dot with the axis is >= 0, else X1), rounded to float. The
 * segment is MPoint = x1, MAxis = (x2 - x1) normalised, MLength its
 * length (TSegment's constructor, SafeNormalize).
 */
export function capsuleShape(x1: V3, x2: V3, radius: number): ShapeA {
  const ax = x2[0] - x1[0];
  const ay = x2[1] - x1[1];
  const az = x2[2] - x1[2];
  const sq = ax * ax + ay * ay + az * az;
  const len = Math.sqrt(sq);
  // TVector::SafeNormalize(Epsilon 1e-8): returns the length.
  const axis: V3 = sq > 1e-8 ? [ax / len, ay / len, az / len] : [0, 0, 0];
  const length = sq > 1e-8 ? len : 0;
  const top: F3 = [
    f(x1[0] + axis[0] * length),
    f(x1[1] + axis[1] * length),
    f(x1[2] + axis[2] * length),
  ];
  const bottom: F3 = [f(x1[0]), f(x1[1]), f(x1[2])];
  return {
    support: (d) =>
      d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2] >= 0 ? top : bottom,
    margin: f(radius),
  };
}

// ---- the raycast ----

export interface GjkResult {
  hit: boolean;
  /** OutTime (float): the distance along RayDir; for an initial overlap
   * (bComputeMTD) minus the penetration depth, <= 0. */
  time: number;
  /** OutPosition in A's frame (float). */
  position: F3;
  /** OutNormal in A's frame (float). */
  normal: F3;
  numVerts: number;
  barycentric: [number, number, number, number];
  iterations: number;
  /** How the initial-overlap exit ended: 'gjk' (closest points), the EPA
   * result, 'touch' (no GJK iteration) or undefined for a positive time. */
  mtd?: string;
}

const MISS = (n: number, bary: GjkResult['barycentric'], it: number) => ({
  hit: false,
  time: 0,
  position: [0, 0, 0] as F3,
  normal: [0, 0, 1] as F3,
  numVerts: n,
  barycentric: bary,
  iterations: it,
});

/**
 * GJKRaycast2ImplSimd for a static shape A and a capsule B (core segment
 * from (0, 0, -halfLength) to (0, 0, halfLength), radius `radius`), every
 * input already in float32 and in A's frame, as GJKRaycast2Impl passes
 * them.
 */
export function gjkRaycast(
  a: ShapeA,
  radius: number,
  halfLength: number,
  bToARotation: FQ,
  startPoint: F3,
  rayDir: F3,
  rayLength: number,
  computeMTD: boolean,
  initialDir: F3
): GjkResult {
  const supportA = a.support;
  const marginA = f(a.margin);
  const marginB = f(radius);
  const inflation = f(marginA + marginB);
  const inflation2 = f(f(inflation * inflation) + EPS2);
  const aToB: FQ = [
    -bToARotation[0],
    -bToARotation[1],
    -bToARotation[2],
    bToARotation[3],
  ];
  const top: F3 = [0, 0, f(halfLength)];
  const bottom: F3 = [0, 0, f(-halfLength)];
  // FGeomGJKHelperSIMD::SupportFunction(AToB, BToA, V) on the capsule:
  // TSegment::SupportCore picks X2 when Direction . Axis >= 0.
  const supportB = (v: F3): F3 => {
    const vInB = qrot(aToB, v);
    return qrot(bToARotation, vInB[2] >= 0 ? top : bottom);
  };

  const st: SimplexState = {
    s: [ZERO, ZERO, ZERO, ZERO],
    as: [ZERO, ZERO, ZERO, ZERO],
    bs: [ZERO, ZERO, ZERO, ZERO],
    n: 0,
    bary: [0, 0, 0, 0],
  };
  let supA = supportA(initialDir);
  st.as[0] = supA;
  let supB = supportB(neg(initialDir));
  st.bs[0] = supB;

  let lambda = 0;
  let x = startPoint;
  let v = sub(x, sub(supA, supB));
  let normal: F3 = [0, 0, 1];
  const initialPreDist2 = dot3(v, v);
  let closeEnough =
    initialPreDist2 < inflation2 && (!computeMTD || initialPreDist2 < EPS2);
  let degenerate = false;
  let terminate = closeEnough;
  let inflatedCloseEnough = closeEnough;
  let iterations = 0;
  let gjkPreDist2 = FLT_MAX;

  while (!terminate) {
    if (!(iterations++ < 32)) break;
    v = normalize(v);
    supA = supportA(v);
    supB = supportB(neg(v));
    const p = sub(supA, supB);
    const w = sub(x, p);
    const nv = st.n;
    st.as[nv] = supA;
    st.bs[nv] = supB;
    const vDotW = dot3(v, w);
    if (vDotW > inflation) {
      const vDotRay = dot3(v, rayDir);
      if (vDotRay >= 0) return MISS(st.n, st.bary, iterations);
      const preLambda = lambda;
      lambda = f(lambda - f(f(vDotW - inflation) / vDotRay));
      if (lambda > preLambda) {
        if (lambda > rayLength) return MISS(st.n, st.bary, iterations);
        const oldX = x;
        x = madd(rayDir, lambda, startPoint);
        normal = v;
        const dx = sub(x, oldX);
        st.s[0] = add(st.s[0], dx);
        st.s[1] = add(st.s[1], dx);
        st.s[2] = add(st.s[2], dx);
        st.s[nv] = sub(x, p);
        st.n = nv + 1;
        gjkPreDist2 = FLT_MAX;
        inflatedCloseEnough = false;
      }
    } else {
      st.s[nv] = w;
      st.n = nv + 1;
    }

    if (inflatedCloseEnough && vDotW >= 0) {
      closeEnough = f(EPS2 + vDotW) >= gjkPreDist2;
    }

    if (!closeEnough) {
      v = closestToOrigin(st);
      const newDist2 = dot3(v, v);
      closeEnough = inflation2 > newDist2;
      degenerate = newDist2 >= gjkPreDist2;
      gjkPreDist2 = newDist2;
      if (computeMTD && closeEnough) {
        inflatedCloseEnough =
          lambda === 0 && gjkPreDist2 > EPS2 && inflation2 > EPS2 && 4 > st.n;
        closeEnough = !inflatedCloseEnough;
      }
    } else {
      v = closestToOrigin(st);
    }
    terminate = closeEnough || degenerate;
  }

  const time = lambda;
  const base = {
    hit: true,
    numVerts: st.n,
    barycentric: st.bary,
    iterations,
  };
  if (time > 0) {
    const b = st.bary;
    const c1 = madd(st.bs[0], b[0], ZERO);
    const c2 = madd(st.bs[1], b[1], c1);
    const c3 = madd(st.bs[2], b[2], c2);
    const c4 = madd(st.bs[3], b[3], c3);
    const closestB =
      st.n === 0
        ? ZERO
        : st.n === 1
          ? c1
          : st.n === 2
            ? c2
            : st.n === 3
              ? c3
              : c4;
    // ClosestLocal = ClosestB - Normal * MarginB; Position = RayDir * Lambda
    // + StartPoint + ClosestLocal.
    const closestLocal = sub(closestB, scale(normal, marginB));
    const position = add(madd(rayDir, lambda, startPoint), closestLocal);
    return { ...base, time, position, normal };
  }
  if (!computeMTD) {
    return { ...base, time, position: [0, 0, 0], normal: [0, 0, 1] };
  }
  // The initial-overlap exit (bComputeMTD).
  const isDone = inflation > 0 && gjkPreDist2 > EPS2 && FLT_MAX > gjkPreDist2;
  let closestA: F3 = [0, 0, 0];
  let closestB: F3 = [0, 0, 0];
  if (iterations) {
    for (let i = 0; i < st.n; i++) {
      closestA = madd(st.as[i], st.bary[i], closestA);
      closestB = madd(st.bs[i], st.bary[i], closestB);
    }
  } else {
    closestA = st.as[0];
    closestB = st.bs[0];
  }
  if (isDone) {
    const outNormal = normalize(v);
    const dist = f(Math.sqrt(gjkPreDist2));
    let pen = f(f(marginA + marginB) - dist);
    pen = pen < FLT_MAX ? pen : FLT_MAX;
    pen = pen > 0 ? pen : 0;
    // VectorNegateMultiplyAdd(N, MarginB, ClosestB) = ClosestB - N * MarginB.
    const closestLocal = sub(closestB, scale(outNormal, marginB));
    const position = add(madd(outNormal, pen, startPoint), closestLocal);
    return { ...base, time: -pen, position, normal: outNormal, mtd: 'gjk' };
  }
  if (iterations) {
    const va: F3[] = [];
    const vb: F3[] = [];
    for (let i = 0; i < st.n; i++) {
      va.push(st.as[i]);
      vb.push(add(st.bs[i], x));
    }
    const epa = vectorEpa(va, vb, supportA, (d) =>
      add(supportB(d), startPoint)
    );
    const margins = f(marginA + marginB);
    if (epa.result === 'Ok' || epa.result === 'MaxIterations') {
      return {
        ...base,
        time: f(f(-epa.penetration) - margins),
        position: epa.witnessA,
        normal: epa.dir,
        mtd: epa.result,
      };
    }
    if (epa.result === 'BadInitialSimplex') {
      return {
        ...base,
        time: f(f(-epa.penetration) - margins),
        position: madd(epa.dir, marginA, closestA),
        normal: epa.dir,
        mtd: epa.result,
      };
    }
    if (epa.result === 'Degenerate') {
      return {
        ...base,
        time: -margins,
        position: madd(normal, marginA, closestA),
        normal,
        mtd: epa.result,
      };
    }
    return { ...MISS(st.n, st.bary, iterations), mtd: epa.result };
  }
  // No GJK iteration: a touching hit.
  const n0: F3 = [0, 0, 1];
  return {
    ...base,
    time: -f(marginA + marginB),
    position: madd(n0, marginA, st.as[0]),
    normal: n0,
    mtd: 'touch',
  };
}

/** The session 3.5 entry point: a margin-0 shape. */
export function gjkRaycastCapsule(
  supportA: SupportFn,
  radius: number,
  halfLength: number,
  bToARotation: FQ,
  startPoint: F3,
  rayDir: F3,
  rayLength: number,
  computeMTD: boolean,
  initialDir: F3
): GjkResult {
  return gjkRaycast(
    { support: supportA, margin: 0 },
    radius,
    halfLength,
    bToARotation,
    startPoint,
    rayDir,
    rayLength,
    computeMTD,
    initialDir
  );
}

// ---- the double-precision set-up around it ----

/** A placed shape: world = t + rotate(q, local) (scale lives in the
 * support for hulls and in the vertices for triangles). */
export interface ShapePose {
  t: V3;
  q: DQ;
}

export interface CapsuleSweepInput {
  /** Capsule start (BTM location), world. */
  start: V3;
  /** Requested end = start + delta, world (TSceneCastCommon takes End). */
  end: V3;
  /** Capsule rotation (the component quaternion). */
  rotation: DQ;
  radius: number;
  /** Core half length (half height - radius). */
  halfLength: number;
}

export interface ChaosHit {
  /** The distance SweepQuery returns (what the scene query compares);
   * minus the penetration depth for an initial overlap. */
  distance: number;
  /** An initial overlap (distance <= 0, FHitResult::bStartPenetrating). */
  overlap: boolean;
  /** Triangles only: the visitor's own time (GJK lambda in the scaled
   * mesh frame, float) and LengthScale (float), for meshVisitorKeeps. */
  meshTime?: number;
  lengthScale?: number;
  /** Heightfields: the hit triangle (cell x 2 + 0 or 1). */
  face?: number;
  /** Triangles only: the visitor's back-face test (one-sided meshes). */
  backFace?: boolean;
  /** distance / DeltaMag (UE's FHitResult::Time before MoveComponent);
   * 0 for an overlap. */
  time: number;
  /** World impact point (SweepQuery's TransformPositionNoScale). */
  impactPoint: [number, number, number];
  /** SweepQuery's world normal: ATM.TransformVectorNoScale(LocalNormal)
   * .GetSafeNormal(UE_KINDA_SMALL_NUMBER, (0, 0, 0)). */
  normal: [number, number, number];
  gjk: GjkResult;
}

/** FVector::GetSafeNormal (double): SquareSum == 1 returns the vector;
 * below Tolerance the zero vector; else times 1 / sqrt (InvSqrt). */
export function safeNormal(
  v: readonly number[],
  tolerance: number
): [number, number, number] {
  const sq = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  if (sq === 1) return [v[0], v[1], v[2]];
  if (sq < tolerance) return [0, 0, 0];
  const s = 1 / Math.sqrt(sq);
  return [v[0] * s, v[1] * s, v[2] * s];
}

const KINDA_SMALL = 1e-4;

/** TSceneCastCommonImp: Delta = End - Start, DeltaMag = float(|Delta|),
 * Dir = Delta x (1 / DeltaMag) (TVector::operator/). */
export function sweepDir(input: CapsuleSweepInput): {
  dir: [number, number, number];
  mag: number;
} {
  const dx = input.end[0] - input.start[0];
  const dy = input.end[1] - input.start[1];
  const dz = input.end[2] - input.start[2];
  const mag = f(Math.sqrt(dx * dx + dy * dy + dz * dz));
  const r = 1 / mag;
  return { dir: [dx * r, dy * r, dz * r], mag };
}

/** FTransform::GetRelativeTransform (scale 1), B relative to A. */
export function relative(
  a: ShapePose,
  bT: V3,
  bQ: DQ
): { t: [number, number, number]; q: DQ } {
  const ia = dinv(a.q);
  const d: V3 = [bT[0] - a.t[0], bT[1] - a.t[1], bT[2] - a.t[2]];
  return { t: drot(ia, d), q: dmul(ia, bQ) };
}

export const toF3 = (v: V3): F3 => [f(v[0]), f(v[1]), f(v[2])];
export const toFQ = (q: DQ): FQ => [f(q[0]), f(q[1]), f(q[2]), f(q[3])];

/** SweepQuery's way back to world space, for a hit or an overlap. */
function finish(
  pose: ShapePose,
  gjk: GjkResult,
  mag: number,
  distance: number,
  localPosition: V3,
  localNormal: V3
): ChaosHit {
  const p = drot(pose.q, localPosition);
  const n = drot(pose.q, localNormal);
  const overlap = !(distance > 0);
  return {
    distance,
    overlap,
    time: overlap ? 0 : distance / mag,
    impactPoint: [p[0] + pose.t[0], p[1] + pose.t[1], p[2] + pose.t[2]],
    normal: safeNormal(n, KINDA_SMALL),
    gjk,
  };
}

/**
 * SweepQuery for a convex A (box, hull, sphere or capsule): GJKRaycast2
 * with InitialDir = ATM.Location - BTM.Location (world), then the result
 * back through ATM. Returns null when Chaos reports no hit.
 */
export function chaosConvexSweep(
  shape: ShapeA | SupportFn,
  pose: ShapePose,
  input: CapsuleSweepInput
): ChaosHit | null {
  const a: ShapeA =
    typeof shape === 'function' ? { support: shape, margin: 0 } : shape;
  const { dir, mag } = sweepDir(input);
  const rel = relative(pose, input.start, input.rotation);
  const localDir = drot(dinv(pose.q), dir);
  const offset: V3 = [
    pose.t[0] - input.start[0],
    pose.t[1] - input.start[1],
    pose.t[2] - input.start[2],
  ];
  const gjk = gjkRaycast(
    a,
    input.radius,
    input.halfLength,
    qnormalizeSafe(toFQ(rel.q)),
    toF3(rel.t),
    toF3(localDir),
    mag,
    true,
    toF3(offset)
  );
  if (!gjk.hit) return null;
  return finish(pose, gjk, mag, gjk.time, gjk.position, gjk.normal);
}

/**
 * The triangle-mesh path on one triangle: SweepQuery hands the mesh's
 * wrapper the local direction; TImplicitObjectInstanced (scale exactly 1,
 * BodyInstance.cpp:2239) goes straight to FTriangleMeshImplicitObject::
 * SweepGeom, TImplicitObjectScaled (ImplicitObjectScaled.h:638) first
 * unscales the direction and start (MInvScale) and renormalises. SweepGeom
 * then runs ComputeScaledSweepInputs (TriangleMeshImplicitObject.cpp:1546:
 * the direction times the mesh scale, renormalised again; the start times
 * the scale), and the visitor (VisitSweep, :1272) casts against the cooked
 * triangle times the scale in float, with InitialDir (1, 0, 0).
 * `cooked` are the float32 mesh-local vertices in Chaos's cooked order
 * (render v0 and v1 swapped, ChaosCooking.cpp:41). `windingCode` is
 * GetWindingOrder(scale) for one-sided meshes (back faces culled), 0 for
 * double-sided ones. A back face's positive-time hit is dropped (the
 * visitor's rule); its initial overlap is kept.
 */
export function chaosTriangleSweep(
  cooked: [F3, F3, F3],
  scale3: V3,
  pose: ShapePose,
  input: CapsuleSweepInput,
  windingCode = 0
): ChaosHit | null {
  const { dir, mag } = sweepDir(input);
  const rel = relative(pose, input.start, input.rotation);
  const localDir = drot(dinv(pose.q), dir);
  const unit = scale3[0] === 1 && scale3[1] === 1 && scale3[2] === 1;
  // Outer (TImplicitObjectScaled) step.
  let dirIn: V3 = localDir;
  let lengthIn: number = mag;
  let startIn: V3 = rel.t;
  let outerInv = 1;
  if (!unit) {
    const inv: V3 = [1 / scale3[0], 1 / scale3[1], 1 / scale3[2]];
    const ux = inv[0] * localDir[0];
    const uy = inv[1] * localDir[1];
    const uz = inv[2] * localDir[2];
    const ls = Math.sqrt(ux * ux + uy * uy + uz * uz);
    outerInv = 1 / ls;
    lengthIn = mag * ls;
    dirIn = [ux * outerInv, uy * outerInv, uz * outerInv];
    startIn = [rel.t[0] * inv[0], rel.t[1] * inv[1], rel.t[2] * inv[2]];
  }
  // ComputeScaledSweepInputs with TriMeshScale = the wrapper's scale.
  const sx = scale3[0] * dirIn[0];
  const sy = scale3[1] * dirIn[1];
  const sz = scale3[2] * dirIn[2];
  const lengthScale = Math.sqrt(sx * sx + sy * sy + sz * sz);
  const lsInv = 1 / lengthScale;
  const scaledDir: V3 = [sx * lsInv, sy * lsInv, sz * lsInv];
  const scaledStart: V3 = [
    startIn[0] * scale3[0],
    startIn[1] * scale3[1],
    startIn[2] * scale3[2],
  ];
  const sf: F3 = toF3(scale3);
  const tri: [F3, F3, F3] = unit
    ? cooked
    : [
        [
          f(cooked[0][0] * sf[0]),
          f(cooked[0][1] * sf[1]),
          f(cooked[0][2] * sf[2]),
        ],
        [
          f(cooked[1][0] * sf[0]),
          f(cooked[1][1] * sf[1]),
          f(cooked[1][2] * sf[2]),
        ],
        [
          f(cooked[2][0] * sf[0]),
          f(cooked[2][1] * sf[1]),
          f(cooked[2][2] * sf[2]),
        ],
      ];
  // The visitor's back-face test: Dot3(TriNormal, ScaledDir) x code > 0.
  let backFace = false;
  if (windingCode !== 0) {
    const tn = crossF(sub(tri[1], tri[0]), sub(tri[2], tri[0]));
    backFace = f(dot3(tn, toF3(scaledDir)) * windingCode) > 0;
  }
  const lengthScaleF = f(lengthScale);
  const gjk = gjkRaycast(
    { support: triangleSupport(tri[0], tri[1], tri[2]), margin: 0 },
    input.radius,
    input.halfLength,
    qnormalizeSafe(toFQ(rel.q)),
    toF3(scaledStart),
    toF3(scaledDir),
    f(lengthScaleF * f(lengthIn)),
    true,
    [1, 0, 0]
  );
  if (!gjk.hit) return null;
  if (gjk.time > 0 && backFace) return null;
  // TransformSweepOutputsHelper: time / LengthScale in float, normal
  // (scale x normal).GetSafeNormal(), position times 1 / scale; then the
  // wrapper's LengthScaleInv, scale and (1 / scale x normal).GetSafeNormal().
  let time = f(gjk.time / lengthScaleF);
  let normal = safeNormal(
    [
      scale3[0] * gjk.normal[0],
      scale3[1] * gjk.normal[1],
      scale3[2] * gjk.normal[2],
    ],
    1e-8
  );
  let pos: V3 = [
    (1 / scale3[0]) * gjk.position[0],
    (1 / scale3[1]) * gjk.position[1],
    (1 / scale3[2]) * gjk.position[2],
  ];
  if (!unit) {
    time = outerInv * time;
    pos = [scale3[0] * pos[0], scale3[1] * pos[1], scale3[2] * pos[2]];
    normal = safeNormal(
      [
        (1 / scale3[0]) * normal[0],
        (1 / scale3[1]) * normal[1],
        (1 / scale3[2]) * normal[2],
      ],
      1e-8
    );
  }
  const hit = finish(pose, gjk, mag, time, pos, normal);
  hit.meshTime = gjk.time;
  hit.lengthScale = lengthScaleF;
  hit.backFace = backFace;
  return hit;
}

/** VectorCross (float), local to keep chaos_simd's exports small. */
function crossF(a: F3, b: F3): F3 {
  return [
    f(f(a[1] * b[2]) - f(a[2] * b[1])),
    f(f(a[2] * b[0]) - f(a[0] * b[2])),
    f(f(a[0] * b[1]) - f(a[1] * b[0])),
  ];
}

/**
 * FTriangleMeshSweepVisitor::VisitSweep's test for a triangle visited
 * after `kept` (the mesh's hit so far, or null): `Time < LengthScale x
 * OutTime` in float, where OutTime = kept Time / LengthScale (float). With
 * a LengthScale other than 1 the round trip can swallow an ulp, so this is
 * not the same as comparing distances. An initial overlap stops the visit
 * (`meshVisitStops`).
 */
export function meshVisitorKeeps(
  kept: ChaosHit | null,
  next: ChaosHit
): boolean {
  if (!kept) return true;
  const ls = next.lengthScale!;
  const outTime = f(kept.meshTime! / ls);
  return next.meshTime! < f(ls * outTime);
}

/** The visitor stops at its first kept initial overlap (Time <= 0). */
export const meshVisitStops = (kept: ChaosHit): boolean =>
  !(kept.meshTime! > 0);
