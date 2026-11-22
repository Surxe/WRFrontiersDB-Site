/**
 * The FVector operations the movement port needs, on plain immutable
 * vectors in Unreal space: centimeters, Z up, left-handed. Names and
 * tolerances follow UE 5.4's FVector (Core/Public/Math/Vector.h) so the
 * ported code reads like the original.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** UE_SMALL_NUMBER, UE_KINDA_SMALL_NUMBER and UE_DELTA (UnrealMathUtility.h). */
export const SMALL_NUMBER = 1e-8;
export const KINDA_SMALL_NUMBER = 1e-4;
export const DELTA = 0.00001;

/**
 * Round to float32. UE 5.4 keeps positions and velocities in doubles
 * (FVector) but times, speeds, accelerations, curve values and most CMC
 * properties in `float`; the port rounds where UE's declared type is
 * float, so sub-step splits and speed limits match UE bit for bit
 * (tolerance class A, stages/mvp.md).
 */
export const f32 = Math.fround;

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const ZERO: Vec3 = vec(0, 0, 0);
export const UP: Vec3 = vec(0, 0, 1);

export const add = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 =>
  vec(a.x * s, a.y * s, a.z * s);
export const neg = (a: Vec3): Vec3 => vec(-a.x, -a.y, -a.z);
/** `a + b * s`. */
export const addScaled = (a: Vec3, b: Vec3, s: number): Vec3 =>
  vec(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
/** Component-wise product (FVector * FVector). */
export const mul = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.x * b.x, a.y * b.y, a.z * b.z);

/** `a | b`. */
export const dot = (a: Vec3, b: Vec3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;
/** `a ^ b` (FVector::CrossProduct, the same formula in UE's left-handed space). */
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export const sizeSquared = (a: Vec3): number => dot(a, a);
export const size = (a: Vec3): number => Math.sqrt(dot(a, a));
export const sizeSquared2D = (a: Vec3): number => a.x * a.x + a.y * a.y;
export const size2D = (a: Vec3): number => Math.sqrt(sizeSquared2D(a));

export const withZ = (a: Vec3, z: number): Vec3 => vec(a.x, a.y, z);

/** FVector::IsZero. */
export const isZero = (a: Vec3): boolean => a.x === 0 && a.y === 0 && a.z === 0;

/** FVector::IsNearlyZero: every component within `tolerance`. */
export const isNearlyZero = (
  a: Vec3,
  tolerance = KINDA_SMALL_NUMBER
): boolean =>
  Math.abs(a.x) <= tolerance &&
  Math.abs(a.y) <= tolerance &&
  Math.abs(a.z) <= tolerance;

/** FVector::Equals: every component within `tolerance`. */
export const equals = (
  a: Vec3,
  b: Vec3,
  tolerance = KINDA_SMALL_NUMBER
): boolean =>
  Math.abs(a.x - b.x) <= tolerance &&
  Math.abs(a.y - b.y) <= tolerance &&
  Math.abs(a.z - b.z) <= tolerance;

/** FVector::GetSafeNormal: unit length, or zero if too short. */
export function safeNormal(a: Vec3, tolerance = SMALL_NUMBER): Vec3 {
  const sq = sizeSquared(a);
  if (sq === 1) return a;
  if (sq < tolerance) return ZERO;
  return scale(a, 1 / Math.sqrt(sq));
}

/** FVector::GetSafeNormal2D: horizontal unit vector, or zero. */
export function safeNormal2D(a: Vec3, tolerance = SMALL_NUMBER): Vec3 {
  const sq = sizeSquared2D(a);
  if (sq === 1) return a.z === 0 ? a : vec(a.x, a.y, 0);
  if (sq < tolerance) return ZERO;
  const inv = 1 / Math.sqrt(sq);
  return vec(a.x * inv, a.y * inv, 0);
}

/** FVector::GetClampedToMaxSize. */
export function clampedToMaxSize(a: Vec3, maxSize: number): Vec3 {
  if (maxSize < KINDA_SMALL_NUMBER) return ZERO;
  const sq = sizeSquared(a);
  if (sq > maxSize * maxSize) return scale(a, maxSize / Math.sqrt(sq));
  return a;
}

/** FVector::VectorPlaneProject: `v` with its component along `normal`
 * removed (`normal` must be unit length). */
export const planeProject = (v: Vec3, normal: Vec3): Vec3 =>
  sub(v, scale(normal, dot(v, normal)));

/** FVector::PointPlaneProject for a plane through `origin`. */
export const pointPlaneProject = (
  point: Vec3,
  origin: Vec3,
  normal: Vec3
): Vec3 => sub(point, scale(normal, dot(sub(point, origin), normal)));

export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
  vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
