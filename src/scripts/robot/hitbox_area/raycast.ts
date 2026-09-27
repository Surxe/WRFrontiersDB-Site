/**
 * Analytic ray / hitbox-primitive intersection, the inner loop of the area
 * raster (measure.ts): millions of rays per build, so the math works on plain
 * numbers rather than allocating vectors.
 */
import type { HitboxPrimitive } from '../model/hitbox';
import type { Vec3 } from '../../../types/model';

/** A primitive ready to intersect: its world -> local transform (three.js
 * column-major `Matrix4.elements`) and local half-size. */
export interface PreparedPrimitive {
  primitive: HitboxPrimitive;
  inverse: readonly number[];
  /** Local-frame half-size bounding the primitive (for grid culling). */
  half: Vec3;
}

function localHalfSize(p: HitboxPrimitive): Vec3 {
  switch (p.kind) {
    case 'box':
      return [p.extent[0] / 2, p.extent[1] / 2, p.extent[2] / 2];
    case 'capsule':
      return [p.radius, p.radius, p.length / 2 + p.radius];
    case 'sphere':
      return [p.radius, p.radius, p.radius];
  }
}

export function preparePrimitive(
  primitive: HitboxPrimitive
): PreparedPrimitive {
  return {
    primitive,
    inverse: primitive.m.clone().invert().elements,
    half: localHalfSize(primitive),
  };
}

/** Range of the primitive's world-space bounding box projected onto `axis`. */
export function projectRange(
  { primitive, half }: PreparedPrimitive,
  axis: Vec3
): [number, number] {
  const e = primitive.m.elements;
  const center = e[12] * axis[0] + e[13] * axis[1] + e[14] * axis[2];
  let extent = 0;
  for (let k = 0; k < 3; k++) {
    const column =
      e[4 * k] * axis[0] + e[4 * k + 1] * axis[1] + e[4 * k + 2] * axis[2];
    extent += Math.abs(column) * half[k];
  }
  return [center - extent, center + extent];
}

/** Nearest t >= 0 where o + t*d enters a sphere of radius r at the origin,
 * else Infinity. */
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

/** Axis-aligned box of half-size (hx, hy, hz) centered at the origin (slab
 * test). */
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
  if (!slab(ox, dx, hx) || !slab(oy, dy, hy) || !slab(oz, dz, hz)) {
    return Infinity;
  }
  return tmin;
}

/** Distance along the ray `o + t*d` (world space) to where it enters the
 * primitive, or Infinity when it misses. */
export function intersect(pp: PreparedPrimitive, o: Vec3, d: Vec3): number {
  const m = pp.inverse;
  const ox = m[0] * o[0] + m[4] * o[1] + m[8] * o[2] + m[12];
  const oy = m[1] * o[0] + m[5] * o[1] + m[9] * o[2] + m[13];
  const oz = m[2] * o[0] + m[6] * o[1] + m[10] * o[2] + m[14];
  const dx = m[0] * d[0] + m[4] * d[1] + m[8] * d[2];
  const dy = m[1] * d[0] + m[5] * d[1] + m[9] * d[2];
  const dz = m[2] * d[0] + m[6] * d[1] + m[10] * d[2];
  const p = pp.primitive;
  switch (p.kind) {
    case 'sphere':
      return hitSphere(ox, oy, oz, dx, dy, dz, p.radius);
    case 'capsule':
      return hitCapsule(ox, oy, oz, dx, dy, dz, p.radius, p.length);
    case 'box':
      return hitBox(ox, oy, oz, dx, dy, dz, ...pp.half);
  }
}
