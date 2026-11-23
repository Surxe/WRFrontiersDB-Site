/**
 * Chaos's float32 vector arithmetic and simplex solver, operation for
 * operation (UE 5.4.4), shared by the GJK raycast (chaos_gjk.ts), EPA
 * (chaos_epa.ts) and the heightfield visitor (chaos_heightfield.ts).
 *
 * Source: Core/Public/Math/UnrealMathSSE.h, UnrealMathVectorCommon.h,
 * TransformVectorized.h (the vector and transform primitives);
 * Experimental/Chaos/Public/Chaos/SimplexVectorized.h
 * (VectorSimplexFindClosestToOrigin and its line, triangle and
 * tetrahedron cases).
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

export const f = Math.fround;

/** A float32 3-vector (W = 0). */
export type F3 = [number, number, number];

export const FLT_MAX = f(3.4028234663852886e38);
export const FLT_MIN = f(1.1754943508222875e-38);
export const EPS2 = f(1e-6);
export const SMALL_LENGTH = f(1e-8);

// ---- float32 vector primitives (UnrealMathSSE.h) ----

export const add = (a: F3, b: F3): F3 => [
  f(a[0] + b[0]),
  f(a[1] + b[1]),
  f(a[2] + b[2]),
];
export const sub = (a: F3, b: F3): F3 => [
  f(a[0] - b[0]),
  f(a[1] - b[1]),
  f(a[2] - b[2]),
];
export const neg = (a: F3): F3 => [-a[0], -a[1], -a[2]];
export const scale = (a: F3, s: number): F3 => [
  f(a[0] * s),
  f(a[1] * s),
  f(a[2] * s),
];
/** VectorMultiplyAdd(A, B, C) = A * B + C, two roundings (no FMA). */
export const madd = (a: F3, s: number, c: F3): F3 => [
  f(f(a[0] * s) + c[0]),
  f(f(a[1] * s) + c[1]),
  f(f(a[2] * s) + c[2]),
];
/** InternalVectorDot3X: (x + y) + z of the rounded products. */
export const dot3 = (a: F3, b: F3): number =>
  f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2]));
/** VectorCross: x = v1.y v2.z - v1.z v2.y, and so on. */
export const cross = (a: F3, b: F3): F3 => [
  f(f(a[1] * b[2]) - f(a[2] * b[1])),
  f(f(a[2] * b[0]) - f(a[0] * b[2])),
  f(f(a[0] * b[1]) - f(a[1] * b[0])),
];
/** VectorNormalize: V * (1 / sqrt(Dot4(V, V))). */
export const normalize = (a: F3): F3 => {
  const inv = f(1 / f(Math.sqrt(dot3(a, a))));
  return scale(a, inv);
};

/** A float32 quaternion x, y, z, w. */
export type FQ = [number, number, number, number];

/** VectorQuaternionRotateVector (float): V + w T + Q x T, T = 2 (Q x V). */
export function qrot(q: FQ, v: F3): F3 {
  const qv: F3 = [q[0], q[1], q[2]];
  let t = cross(qv, v);
  t = add(t, t);
  const v0 = madd(t, q[3], v);
  const v1 = cross(qv, t);
  return add(v0, v1);
}

/** VectorNormalizeSafe(Q, (0, 0, 0, 1)) with VectorDot4. */
export function qnormalizeSafe(q: FQ): FQ {
  const s = f(
    f(f(q[0] * q[0]) + f(q[1] * q[1])) + f(f(q[2] * q[2]) + f(q[3] * q[3]))
  );
  if (!(s >= SMALL_LENGTH)) return [0, 0, 0, 1];
  const inv = f(1 / f(Math.sqrt(s)));
  return [f(inv * q[0]), f(inv * q[1]), f(inv * q[2]), f(inv * q[3])];
}

// ---- double primitives (VectorRegister4Double) ----

export type DQ = readonly [number, number, number, number];

export function dcross(
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

export const dinv = (q: DQ): DQ => [-q[0], -q[1], -q[2], q[3]];

/** VectorQuaternionMultiply2 (double), lane order as UnrealMathSSE.h:2722. */
export function dmul(a: DQ, b: DQ): DQ {
  const [x1, y1, z1, w1] = a;
  const [x2, y2, z2, w2] = b;
  return [
    w1 * x2 + x1 * w2 + y1 * z2 + -(z1 * y2),
    w1 * y2 + -(x1 * z2) + y1 * w2 + z1 * x2,
    w1 * z2 + x1 * y2 + -(y1 * x2) + z1 * w2,
    w1 * w2 + -(x1 * x2) + -(y1 * y2) + -(z1 * z2),
  ];
}

export type Simplex = [F3, F3, F3, F3];

export const ZERO: F3 = [0, 0, 0];

export interface SimplexState {
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
export function triangleSimplex(st: SimplexState): F3 {
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

export function closestToOrigin(st: SimplexState): F3 {
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
