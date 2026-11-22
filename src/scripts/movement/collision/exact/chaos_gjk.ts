/**
 * Chaos's capsule sweep (GJKRaycast2ImplSimd) in float32, operation for
 * operation, to take the impact point Chaos reports on contacts parallel to
 * the capsule's axis (findings/chaos-contact-point.md).
 *
 * On such a contact every point of the capsule's core segment is equally
 * close, so the point depends on the simplex GJK ends on: the barycentric
 * mix of the capsule's two segment ends it last kept. Only a replay of the
 * raycast in the engine's float arithmetic lands on the same simplex.
 *
 * Source: UE 5.4.4
 * - Experimental/Chaos/Public/Chaos/GJK.h: GJKRaycast2ImplSimd (:1536),
 *   GJKRaycast2Impl (:1900), FGeomGJKHelperSIMD (:42);
 * - SimplexVectorized.h: VectorSimplexFindClosestToOrigin and its line,
 *   triangle and tetrahedron cases;
 * - GeometryQueries.h SweepQuery (:156): the double-precision set-up
 *   (BToATM, LocalDir, InitialDir = ATM.Location - BTM.Location) and the
 *   way back to world space;
 * - TriangleMeshImplicitObject.cpp: ComputeScaledSweepInputs (:1546) and
 *   FTriangleMeshSweepVisitor::VisitSweep (:1272), InitialDir (1, 0, 0);
 * - the supports: TAABB::SupportCore (AABB.h:352), FConvex::GetSupportVertex
 *   (Convex.h:549, float dot, first maximum), FTriangleRegister
 *   (TriangleRegister.h:26), TSegment::SupportCore (Segment.h:53);
 * - Core/Public/Math/UnrealMathSSE.h, UnrealMathVectorCommon.h,
 *   TransformVectorized.h: the vector and transform primitives.
 *
 * Float semantics of the build: the Linux editor compiles with -msse4.2,
 * no AVX or FMA (MinCpuArchX64 defaults to None, LinuxToolChain.cs:345)
 * and -ffp-contract=off (ClangToolChain.cs:617), so VectorMultiplyAdd is a
 * rounded multiply then a rounded add. Every float operation below rounds
 * once with Math.fround; float +, -, *, / and sqrt computed in double and
 * rounded once equal the float operation exactly (53 >= 2 x 24 + 2).
 * VectorReciprocalSqrt is 1 / sqrt (VectorDivide of VectorSqrt), not the
 * hardware estimate. All geometric vectors keep W = 0, so VectorDot4
 * equals VectorDot3 here ((xx + yy) + (zz + 0) = (xx + yy) + zz).
 *
 * The double-precision steps (the relative transform, the direction, the
 * transform back) copy UE's VectorRegister4Double formulas; JavaScript
 * numbers are IEEE doubles without contraction, as is that code.
 */
import type { V3 } from './colliders';

const f = Math.fround;

/** A float32 3-vector (W = 0). */
export type F3 = [number, number, number];

const FLT_MAX = f(3.4028234663852886e38);
const FLT_MIN = f(1.1754943508222875e-38);
const EPS2 = f(1e-6);
const SMALL_LENGTH = f(1e-8);

// ---- float32 vector primitives (UnrealMathSSE.h) ----

const add = (a: F3, b: F3): F3 => [
  f(a[0] + b[0]),
  f(a[1] + b[1]),
  f(a[2] + b[2]),
];
const sub = (a: F3, b: F3): F3 => [
  f(a[0] - b[0]),
  f(a[1] - b[1]),
  f(a[2] - b[2]),
];
const neg = (a: F3): F3 => [-a[0], -a[1], -a[2]];
const scale = (a: F3, s: number): F3 => [f(a[0] * s), f(a[1] * s), f(a[2] * s)];
/** VectorMultiplyAdd(A, B, C) = A * B + C, two roundings (no FMA). */
const madd = (a: F3, s: number, c: F3): F3 => [
  f(f(a[0] * s) + c[0]),
  f(f(a[1] * s) + c[1]),
  f(f(a[2] * s) + c[2]),
];
/** InternalVectorDot3X: (x + y) + z of the rounded products. */
const dot3 = (a: F3, b: F3): number =>
  f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2]));
/** VectorCross: x = v1.y v2.z - v1.z v2.y, and so on. */
const cross = (a: F3, b: F3): F3 => [
  f(f(a[1] * b[2]) - f(a[2] * b[1])),
  f(f(a[2] * b[0]) - f(a[0] * b[2])),
  f(f(a[0] * b[1]) - f(a[1] * b[0])),
];
/** VectorNormalize: V * (1 / sqrt(Dot4(V, V))). */
const normalize = (a: F3): F3 => {
  const inv = f(1 / f(Math.sqrt(dot3(a, a))));
  return scale(a, inv);
};

/** A float32 quaternion x, y, z, w. */
type FQ = [number, number, number, number];

/** VectorQuaternionRotateVector (float): V + w T + Q x T, T = 2 (Q x V). */
function qrot(q: FQ, v: F3): F3 {
  const qv: F3 = [q[0], q[1], q[2]];
  let t = cross(qv, v);
  t = add(t, t);
  const v0 = madd(t, q[3], v);
  const v1 = cross(qv, t);
  return add(v0, v1);
}

/** VectorNormalizeSafe(Q, (0, 0, 0, 1)) with VectorDot4. */
function qnormalizeSafe(q: FQ): FQ {
  const s = f(
    f(f(q[0] * q[0]) + f(q[1] * q[1])) + f(f(q[2] * q[2]) + f(q[3] * q[3]))
  );
  if (!(s >= SMALL_LENGTH)) return [0, 0, 0, 1];
  const inv = f(1 / f(Math.sqrt(s)));
  return [f(inv * q[0]), f(inv * q[1]), f(inv * q[2]), f(inv * q[3])];
}

// ---- double primitives (VectorRegister4Double) ----

type DQ = readonly [number, number, number, number];

function dcross(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

/** VectorQuaternionRotateVector (double). */
export function drot(q: DQ, v: V3): [number, number, number] {
  const t = dcross(q[0], q[1], q[2], v[0], v[1], v[2]);
  t[0] += t[0];
  t[1] += t[1];
  t[2] += t[2];
  const u = dcross(q[0], q[1], q[2], t[0], t[1], t[2]);
  return [
    q[3] * t[0] + v[0] + u[0],
    q[3] * t[1] + v[1] + u[1],
    q[3] * t[2] + v[2] + u[2],
  ];
}

const dinv = (q: DQ): DQ => [-q[0], -q[1], -q[2], q[3]];

/** VectorQuaternionMultiply2 (double), lane order as UnrealMathSSE.h:2722. */
function dmul(a: DQ, b: DQ): DQ {
  const [x1, y1, z1, w1] = a;
  const [x2, y2, z2, w2] = b;
  return [
    w1 * x2 + x1 * w2 + y1 * z2 + -(z1 * y2),
    w1 * y2 + -(x1 * z2) + y1 * w2 + z1 * x2,
    w1 * z2 + x1 * y2 + -(y1 * x2) + z1 * w2,
    w1 * w2 + -(x1 * x2) + -(y1 * y2) + -(z1 * z2),
  ];
}

// ---- shapes (A, the static geometry, in its local frame) ----

/** A's support in float32 for a float32 direction (SupportCoreSimd with
 * margin 0: a capsule sweep never adds a margin to the other shape). */
export type SupportFn = (d: F3) => F3;

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

// ---- the raycast ----

export interface GjkResult {
  hit: boolean;
  /** OutTime (float): the distance along RayDir, 0 for an initial overlap. */
  time: number;
  /** OutPosition in A's frame (float), valid when time > 0. */
  position: F3;
  normal: F3;
  numVerts: number;
  barycentric: [number, number, number, number];
  iterations: number;
}

type Simplex = [F3, F3, F3, F3];

const ZERO: F3 = [0, 0, 0];

interface SimplexState {
  s: Simplex;
  as: Simplex;
  bs: Simplex;
  n: number;
  bary: [number, number, number, number];
}

/** VectorLineSimplexFindOrigin<true>. */
function lineSimplex(st: SimplexState): F3 {
  const x0 = st.s[0];
  const x1 = st.s[1];
  const x0to1 = sub(x1, x0);
  const dot = dot3(neg(x0), x0to1);
  const isX0 = 0 >= dot;
  const sq = dot3(x0to1, x0to1);
  const isX1 = dot >= sq || FLT_MIN >= sq;
  if (isX1) {
    st.s[0] = st.s[1];
    st.as[0] = st.as[1];
    st.bs[0] = st.bs[1];
  }
  let ratio = f(dot / sq);
  // VectorMax(Ratio, 0) then VectorMin(Ratio, 1) (NaN keeps the second
  // operand in SSE maxps / minps).
  ratio = ratio > 0 ? ratio : 0;
  ratio = ratio < 1 ? ratio : 1;
  // X0 here is Simplex[0] after the select (a reference in the source).
  let closest = madd(x0to1, ratio, st.s[0]);
  const omr = f(1 - ratio);
  closest = isX0 ? st.s[0] : isX1 ? x1 : closest;
  if (isX0 || isX1) {
    st.n = 1;
    st.bary = [1, 0, 0, 0];
  } else {
    st.bary = [omr, ratio, omr, ratio]; // VectorUnpackLo
  }
  return closest;
}

/** TriangleSimplexFindOriginFast<true>. */
function triangleSimplex(st: SimplexState): F3 {
  const A = st.s[0];
  const B = st.s[1];
  const C = st.s[2];
  const AB = sub(B, A);
  const AC = sub(C, A);
  const triNormal = cross(AB, AC);
  const triNormal2 = dot3(triNormal, triNormal);
  const aMin = scale(A, FLT_MIN);
  const eps2 = dot3(aMin, aMin);
  if (eps2 >= triNormal2) {
    st.n = 2;
    return lineSimplex(st);
  }
  const AO = neg(A);
  const d1 = dot3(AB, AO);
  const d2 = dot3(AC, AO);
  if (0 >= d1 && 0 >= d2) {
    st.n = 1;
    st.bary = [1, 0, 0, 0];
    return A;
  }
  const BO = neg(B);
  const d3 = dot3(AB, BO);
  const d4 = dot3(AC, BO);
  if (d3 >= 0 && d3 >= d4) {
    st.n = 1;
    st.bary = [1, 0, 0, 0];
    st.s[0] = B;
    st.as[0] = st.as[1];
    st.bs[0] = st.bs[1];
    return B;
  }
  const vc = f(f(d1 * d4) - f(d3 * d2));
  const ndAB = f(d1 - d3);
  if (0 >= vc && d1 >= 0 && 0 >= d3 && ndAB > 0) {
    st.n = 2;
    const v = f(d1 / ndAB);
    st.bary = [f(1 - v), v, f(1 - v), v];
    return madd(AB, v, A);
  }
  const CO = neg(C);
  const d5 = dot3(AB, CO);
  const d6 = dot3(AC, CO);
  if (d6 >= 0 && d6 >= d5) {
    st.n = 1;
    st.bary = [1, 0, 0, 0];
    st.s[0] = C;
    st.as[0] = st.as[2];
    st.bs[0] = st.bs[2];
    return C;
  }
  const vb = f(f(d5 * d2) - f(d1 * d6));
  const ndAC = f(d2 - d6);
  if (0 >= vb && d2 >= 0 && 0 >= d6 && ndAC > 0) {
    const w = f(d2 / ndAC);
    st.n = 2;
    st.bary = [f(1 - w), w, f(1 - w), w];
    st.s[1] = C;
    st.as[1] = st.as[2];
    st.bs[1] = st.bs[2];
    return madd(AC, w, A);
  }
  const va = f(f(d3 * d6) - f(d5 * d4));
  const d4m3 = f(d4 - d3);
  const d5m6 = f(d5 - d6);
  const ndBC = f(d4m3 + d5m6);
  if (0 >= va && d4m3 >= 0 && d5m6 >= 0 && ndBC > 0) {
    st.n = 2;
    const w = f(d4m3 / ndBC);
    st.bary = [f(1 - w), w, f(1 - w), w];
    const result = madd(sub(C, B), w, B);
    st.s[0] = B;
    st.s[1] = C;
    st.as[0] = st.as[1];
    st.bs[0] = st.bs[1];
    st.as[1] = st.as[2];
    st.bs[1] = st.bs[2];
    return result;
  }
  const denom = f(1 / f(va + f(vb + vc)));
  const v = f(vb * denom);
  const w = f(vc * denom);
  st.n = 3;
  st.bary = [f(f(1 - v) - w), v, w, v]; // two VectorUnpackLo
  const over = [
    f(triNormal[0] / triNormal2),
    f(triNormal[1] / triNormal2),
    f(triNormal[2] / triNormal2),
  ] as F3;
  const signed = dot3(A, over);
  return scale(triNormal, signed);
}

/** VectorSignMatch: same sign bits and neither product zero. */
function signMatch(a: number, b: number): boolean {
  if (f(a * b) === 0) return false;
  const sa = a < 0 || Object.is(a, -0);
  const sb = b < 0 || Object.is(b, -0);
  return sa === sb;
}

/** VectorTetrahedronSimplexFindOrigin<true>. */
function tetraSimplex(st: SimplexState): F3 {
  const [x0, x1, x2, x3] = st.s;
  const cof = [
    -dot3(x1, cross(x2, x3)),
    dot3(x0, cross(x2, x3)),
    -dot3(x0, cross(x1, x3)),
    dot3(x0, cross(x1, x2)),
  ];
  const detM = f(f(cof[0] + cof[1]) + f(cof[2] + cof[3]));
  const subIdx = [
    [1, 2, 3],
    [0, 2, 3],
    [0, 1, 3],
    [0, 1, 2],
  ];
  let inside = true;
  let closestIdx = -1;
  let minDist2 = 0;
  const subs: SimplexState[] = [];
  const closest: F3[] = [];
  for (let i = 0; i < 4; i++) {
    if (signMatch(detM, cof[i])) continue;
    inside = false;
    const ix = subIdx[i];
    const sst: SimplexState = {
      s: [st.s[ix[0]], st.s[ix[1]], st.s[ix[2]], ZERO],
      as: [st.as[ix[0]], st.as[ix[1]], st.as[ix[2]], ZERO],
      bs: [st.bs[ix[0]], st.bs[ix[1]], st.bs[ix[2]], ZERO],
      n: 3,
      bary: [0, 0, 0, 0],
    };
    const c = triangleSimplex(sst);
    subs[i] = sst;
    closest[i] = c;
    const d2 = dot3(c, c);
    if (minDist2 > d2 || closestIdx === -1) {
      minDist2 = d2;
      closestIdx = i;
    }
  }
  if (inside) {
    const inv = f(1 / detM);
    st.bary = [
      f(cof[0] * inv),
      f(cof[1] * inv),
      f(cof[2] * inv),
      f(cof[3] * inv),
    ];
    return [0, 0, 0];
  }
  const sst = subs[closestIdx];
  st.n = sst.n;
  st.bary = sst.bary;
  for (let i = 0; i < 3; i++) {
    st.s[i] = sst.s[i];
    st.as[i] = sst.as[i];
    st.bs[i] = sst.bs[i];
  }
  return closest[closestIdx];
}

function closestToOrigin(st: SimplexState): F3 {
  switch (st.n) {
    case 1:
      st.bary = [1, 0, 0, 0];
      return st.s[0];
    case 2:
      return lineSimplex(st);
    case 3:
      return triangleSimplex(st);
    case 4:
      return tetraSimplex(st);
    default:
      return [0, 0, 0];
  }
}

/**
 * GJKRaycast2ImplSimd for a static shape A and a capsule B (core segment
 * from (0, 0, -halfLength) to (0, 0, halfLength), radius `radius`), every
 * input already in float32 and in A's frame, as GJKRaycast2Impl passes
 * them.
 */
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
  const marginB = f(radius);
  const inflation = marginB; // MarginA = 0 (no radius on A, no sweep margins)
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
      if (vDotRay >= 0) {
        return {
          hit: false,
          time: 0,
          position: [0, 0, 0],
          normal: [0, 0, 1],
          numVerts: st.n,
          barycentric: st.bary,
          iterations,
        };
      }
      const preLambda = lambda;
      lambda = f(lambda - f(f(vDotW - inflation) / vDotRay));
      if (lambda > preLambda) {
        if (lambda > rayLength) {
          return {
            hit: false,
            time: 0,
            position: [0, 0, 0],
            normal: [0, 0, 1],
            numVerts: st.n,
            barycentric: st.bary,
            iterations,
          };
        }
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
    return {
      hit: true,
      time,
      position,
      normal,
      numVerts: st.n,
      barycentric: st.bary,
      iterations,
    };
  }
  // Initial overlap: the caller keeps its own (exact) start-overlap result.
  return {
    hit: true,
    time: 0,
    position: [0, 0, 0],
    normal: [0, 0, 1],
    numVerts: st.n,
    barycentric: st.bary,
    iterations,
  };
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
  /** The distance SweepQuery returns (what the scene query compares). */
  distance: number;
  /** distance / DeltaMag (UE's FHitResult::Time before MoveComponent). */
  time: number;
  /** World impact point (SweepQuery's TransformPositionNoScale). */
  impactPoint: [number, number, number];
  /** Chaos's normal (world, before UE normalises it). */
  normal: [number, number, number];
  gjk: GjkResult;
}

/** TSceneCastCommonImp: Delta = End - Start, DeltaMag = float(|Delta|),
 * Dir = Delta x (1 / DeltaMag) (TVector::operator/). */
function sweepDir(input: CapsuleSweepInput): {
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
function relative(
  a: ShapePose,
  bT: V3,
  bQ: DQ
): { t: [number, number, number]; q: DQ } {
  const ia = dinv(a.q);
  const d: V3 = [bT[0] - a.t[0], bT[1] - a.t[1], bT[2] - a.t[2]];
  return { t: drot(ia, d), q: dmul(ia, bQ) };
}

const toF3 = (v: V3): F3 => [f(v[0]), f(v[1]), f(v[2])];
const toFQ = (q: DQ): FQ => [f(q[0]), f(q[1]), f(q[2]), f(q[3])];

function finish(
  pose: ShapePose,
  gjk: GjkResult,
  mag: number,
  localPosition: V3,
  localNormal: V3
): ChaosHit {
  const p = drot(pose.q, localPosition);
  const n = drot(pose.q, localNormal);
  return {
    distance: gjk.time,
    time: gjk.time / mag,
    impactPoint: [p[0] + pose.t[0], p[1] + pose.t[1], p[2] + pose.t[2]],
    normal: n,
    gjk,
  };
}

/**
 * SweepQuery for a convex A (box or hull): GJKRaycast2 with
 * InitialDir = ATM.Location - BTM.Location (world), then the position back
 * through ATM. Returns null when Chaos reports no hit.
 */
export function chaosConvexSweep(
  supportA: SupportFn,
  pose: ShapePose,
  input: CapsuleSweepInput,
  computeMTD = true
): ChaosHit | null {
  const { dir, mag } = sweepDir(input);
  const rel = relative(pose, input.start, input.rotation);
  const localDir = drot(dinv(pose.q), dir);
  const offset: V3 = [
    pose.t[0] - input.start[0],
    pose.t[1] - input.start[1],
    pose.t[2] - input.start[2],
  ];
  const gjk = gjkRaycastCapsule(
    supportA,
    input.radius,
    input.halfLength,
    qnormalizeSafe(toFQ(rel.q)),
    toF3(rel.t),
    toF3(localDir),
    mag,
    computeMTD,
    toF3(offset)
  );
  if (!gjk.hit || !(gjk.time > 0)) return null;
  return finish(pose, gjk, mag, gjk.position, gjk.normal);
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
 * (render v0 and v1 swapped, ChaosCooking.cpp:41).
 */
export function chaosTriangleSweep(
  cooked: [F3, F3, F3],
  scale3: V3,
  pose: ShapePose,
  input: CapsuleSweepInput,
  computeMTD = true
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
  const lengthScaleF = f(lengthScale);
  const gjk = gjkRaycastCapsule(
    triangleSupport(tri[0], tri[1], tri[2]),
    input.radius,
    input.halfLength,
    qnormalizeSafe(toFQ(rel.q)),
    toF3(scaledStart),
    toF3(scaledDir),
    f(lengthScaleF * f(lengthIn)),
    computeMTD,
    [1, 0, 0]
  );
  if (!gjk.hit || !(gjk.time > 0)) return null;
  // TransformSweepOutputsHelper: time / LengthScale in float, position
  // times 1 / scale; then the wrapper's LengthScaleInv and scale.
  let time = f(gjk.time / lengthScaleF);
  let pos: V3 = [
    (1 / scale3[0]) * gjk.position[0],
    (1 / scale3[1]) * gjk.position[1],
    (1 / scale3[2]) * gjk.position[2],
  ];
  if (!unit) {
    time = outerInv * time;
    pos = [scale3[0] * pos[0], scale3[1] * pos[1], scale3[2] * pos[2]];
  }
  const hit = finish(pose, gjk, mag, pos, gjk.normal);
  hit.distance = time;
  hit.time = time / mag;
  return hit;
}
