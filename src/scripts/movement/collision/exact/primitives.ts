/**
 * Float64 geometric primitives for the exact collision layer: closest
 * points, and the time of impact of an upright capsule sweeping against a
 * point, a segment or a triangle.
 *
 * The capsule is a vertical core segment, centre p and half length a
 * (halfHeight - radius), plus a radius r. Sweeping it along d against a
 * convex feature F is a ray cast of its centre against the rounded prism
 * R = F + S + B(r): F extruded by +-a along Z (S, the core segment), then
 * grown by r. R is covered exactly by
 *  - the capsules (radius r) around the prism's edges: F's edges at +-a and
 *    a vertical edge at each vertex (their end spheres are the corners);
 *  - the prism's faces pushed out by r: the two caps (F at +-a) and the
 *    side faces (each edge of F extruded along Z).
 * Each piece is a subset of R and their union is R, so the first entry
 * into R is the earliest entry into any piece. Every piece is a sphere, a
 * cylinder or a flat convex polygon, each with a closed-form ray test.
 *
 * Hot path: scalar arguments and module-level result slots, no allocation.
 */

/** Closest-point results (written by the functions below). */
export const closest = {
  /** Squared distance. */
  d2: 0,
  /** Point on the first shape (the capsule's core segment). */
  sx: 0,
  sy: 0,
  sz: 0,
  /** Point on the second shape. */
  qx: 0,
  qy: 0,
  qz: 0,
};

let qx = 0;
let qy = 0;
let qz = 0;

/** Closest point on triangle (a, b, c) to p, into (qx, qy, qz); returns the
 * squared distance (Ericson, Real-Time Collision Detection 5.1.5). */
export function pointTriangle(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) {
    qx = ax;
    qy = ay;
    qz = az;
  } else {
    const bpx = px - bx;
    const bpy = py - by;
    const bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    const vc = d1 * d4 - d3 * d2;
    if (d3 >= 0 && d4 <= d3) {
      qx = bx;
      qy = by;
      qz = bz;
    } else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      qx = ax + v * abx;
      qy = ay + v * aby;
      qz = az + v * abz;
    } else {
      const cpx = px - cx;
      const cpy = py - cy;
      const cpz = pz - cz;
      const d5 = abx * cpx + aby * cpy + abz * cpz;
      const d6 = acx * cpx + acy * cpy + acz * cpz;
      const vb = d5 * d2 - d1 * d6;
      const va = d3 * d6 - d5 * d4;
      if (d6 >= 0 && d5 <= d6) {
        qx = cx;
        qy = cy;
        qz = cz;
      } else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const w = d2 / (d2 - d6);
        qx = ax + w * acx;
        qy = ay + w * acy;
        qz = az + w * acz;
      } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
        qx = bx + w * (cx - bx);
        qy = by + w * (cy - by);
        qz = bz + w * (cz - bz);
      } else {
        const denom = 1 / (va + vb + vc);
        const v = vb * denom;
        const w = vc * denom;
        qx = ax + abx * v + acx * w;
        qy = ay + aby * v + acy * w;
        qz = az + abz * v + acz * w;
      }
    }
  }
  const dx = px - qx;
  const dy = py - qy;
  const dz = pz - qz;
  return dx * dx + dy * dy + dz * dz;
}

/** The last pointTriangle's closest point. */
export const lastTrianglePoint = (): [number, number, number] => [qx, qy, qz];

let ssS = 0;
let ssT = 0;

/** Closest points between segments p1-q1 and p2-q2: parameters into
 * (ssS, ssT), returns the squared distance (Ericson 5.1.9). */
function segmentSegment(
  p1x: number,
  p1y: number,
  p1z: number,
  q1x: number,
  q1y: number,
  q1z: number,
  p2x: number,
  p2y: number,
  p2z: number,
  q2x: number,
  q2y: number,
  q2z: number
): number {
  const d1x = q1x - p1x;
  const d1y = q1y - p1y;
  const d1z = q1z - p1z;
  const d2x = q2x - p2x;
  const d2y = q2y - p2y;
  const d2z = q2z - p2z;
  const rx = p1x - p2x;
  const ry = p1y - p2y;
  const rz = p1z - p2z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s: number;
  let t: number;
  if (a <= 1e-30 && e <= 1e-30) {
    s = 0;
    t = 0;
  } else if (a <= 1e-30) {
    s = 0;
    t = Math.min(1, Math.max(0, f / e));
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-30) {
      t = 0;
      s = Math.min(1, Math.max(0, -c / a));
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      s = denom > 0 ? Math.min(1, Math.max(0, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.min(1, Math.max(0, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.min(1, Math.max(0, (b - c) / a));
      }
    }
  }
  ssS = s;
  ssT = t;
  const dx = p1x + d1x * s - (p2x + d2x * t);
  const dy = p1y + d1y * s - (p2y + d2y * t);
  const dz = p1z + d1z * s - (p2z + d2z * t);
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Closest points between the vertical segment (x, y, z0..z1) and triangle
 * (a, b, c), into `closest`. A segment piercing the triangle gives
 * distance 0 at the piercing point.
 */
export function segmentTriangle(
  x: number,
  y: number,
  z0: number,
  z1: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
): number {
  // Piercing: the segment crosses the triangle's plane inside it.
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  const e0 = nx * (x - ax) + ny * (y - ay) + nz * (z0 - az);
  const e1 = nx * (x - ax) + ny * (y - ay) + nz * (z1 - az);
  if ((e0 <= 0 && e1 >= 0) || (e0 >= 0 && e1 <= 0)) {
    if (e0 !== e1) {
      const z = z0 + ((z1 - z0) * e0) / (e0 - e1);
      // Inside test by barycentric signs against the normal.
      const ux = x - ax;
      const uy = y - ay;
      const uz = z - az;
      const s1 =
        nx * (aby * uz - abz * uy) +
        ny * (abz * ux - abx * uz) +
        nz * (abx * uy - aby * ux);
      const vx = x - bx;
      const vy = y - by;
      const vz = z - bz;
      const bcx = cx - bx;
      const bcy = cy - by;
      const bcz = cz - bz;
      const s2 =
        nx * (bcy * vz - bcz * vy) +
        ny * (bcz * vx - bcx * vz) +
        nz * (bcx * vy - bcy * vx);
      const wx = x - cx;
      const wy = y - cy;
      const wz = z - cz;
      const cax = ax - cx;
      const cay = ay - cy;
      const caz = az - cz;
      const s3 =
        nx * (cay * wz - caz * wy) +
        ny * (caz * wx - cax * wz) +
        nz * (cax * wy - cay * wx);
      if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) {
        closest.d2 = 0;
        closest.sx = closest.qx = x;
        closest.sy = closest.qy = y;
        closest.sz = closest.qz = z;
        return 0;
      }
    }
  }
  // Otherwise an endpoint against the triangle, or the segment against an edge.
  let best = pointTriangle(x, y, z0, ax, ay, az, bx, by, bz, cx, cy, cz);
  closest.sx = x;
  closest.sy = y;
  closest.sz = z0;
  closest.qx = qx;
  closest.qy = qy;
  closest.qz = qz;
  let d = pointTriangle(x, y, z1, ax, ay, az, bx, by, bz, cx, cy, cz);
  if (d < best) {
    best = d;
    closest.sz = z1;
    closest.qx = qx;
    closest.qy = qy;
    closest.qz = qz;
  }
  for (let edge = 0; edge < 3; edge++) {
    const px = edge === 0 ? ax : edge === 1 ? bx : cx;
    const py = edge === 0 ? ay : edge === 1 ? by : cy;
    const pz = edge === 0 ? az : edge === 1 ? bz : cz;
    const ex = edge === 0 ? bx : edge === 1 ? cx : ax;
    const ey = edge === 0 ? by : edge === 1 ? cy : ay;
    const ez = edge === 0 ? bz : edge === 1 ? cz : az;
    d = segmentSegment(x, y, z0, x, y, z1, px, py, pz, ex, ey, ez);
    if (d < best) {
      best = d;
      closest.sz = z0 + (z1 - z0) * ssS;
      closest.qx = px + (ex - px) * ssT;
      closest.qy = py + (ey - py) * ssT;
      closest.qz = pz + (ez - pz) * ssT;
    }
  }
  closest.d2 = best;
  return best;
}

/** Closest points between the vertical segment (x, y, z0..z1) and segment
 * e0-e1, into `closest`. */
export function segmentSegmentVertical(
  x: number,
  y: number,
  z0: number,
  z1: number,
  e0x: number,
  e0y: number,
  e0z: number,
  e1x: number,
  e1y: number,
  e1z: number
): number {
  const d = segmentSegment(x, y, z0, x, y, z1, e0x, e0y, e0z, e1x, e1y, e1z);
  closest.d2 = d;
  closest.sx = x;
  closest.sy = y;
  closest.sz = z0 + (z1 - z0) * ssS;
  closest.qx = e0x + (e1x - e0x) * ssT;
  closest.qy = e0y + (e1y - e0y) * ssT;
  closest.qz = e0z + (e1z - e0z) * ssT;
  return d;
}

// ---- Ray tests (centre o, direction d over t in [0, 1]) ----

/** Entry time of the ray into the sphere (c, radius), or Infinity. The ray
 * is assumed to start outside. */
export function raySphere(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number
): number {
  const mx = ox - cx;
  const my = oy - cy;
  const mz = oz - cz;
  const b = mx * dx + my * dy + mz * dz;
  if (b >= 0) return Infinity; // moving away (or tangent)
  const a = dx * dx + dy * dy + dz * dz;
  const c = mx * mx + my * my + mz * mz - radius * radius;
  if (c <= 0) return 0;
  const disc = b * b - a * c;
  if (disc < 0) return Infinity;
  // Smaller root without cancellation: c / (-b + sqrt(disc)).
  return c / (-b + Math.sqrt(disc));
}

/** Entry time of the ray into the lateral surface of the cylinder around
 * e0-e1 (no caps; the end spheres cover them), or Infinity. */
export function rayCylinder(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  e0x: number,
  e0y: number,
  e0z: number,
  e1x: number,
  e1y: number,
  e1z: number,
  radius: number
): number {
  const ax = e1x - e0x;
  const ay = e1y - e0y;
  const az = e1z - e0z;
  const mx = ox - e0x;
  const my = oy - e0y;
  const mz = oz - e0z;
  const ll = ax * ax + ay * ay + az * az;
  if (ll <= 1e-30) return Infinity;
  const md = mx * ax + my * ay + mz * az;
  const nd = dx * ax + dy * ay + dz * az;
  const dd = dx * dx + dy * dy + dz * dz;
  const mn = mx * dx + my * dy + mz * dz;
  const mm = mx * mx + my * my + mz * mz;
  // |(m + t d) x axis|^2 = r^2 |axis|^2, scaled by ll.
  const A = dd * ll - nd * nd;
  if (A <= 1e-12 * dd * ll) return Infinity; // parallel to the axis
  const B = mn * ll - md * nd;
  if (B >= 0) return Infinity; // moving away from the axis
  const C = mm * ll - md * md - radius * radius * ll;
  // Already within the infinite cylinder: entry is not through its side.
  if (C <= 0) return Infinity;
  const disc = B * B - A * C;
  if (disc < 0) return Infinity;
  const t = C / (-B + Math.sqrt(disc));
  const u = (md + t * nd) / ll;
  return u < 0 || u > 1 ? Infinity : t;
}

/**
 * Time of impact of the capsule (core half length `a`, radius `r`)
 * sweeping from o along d against the convex polygon `n` vertices long
 * (1: a point, 2: a segment, 3: a triangle) in `v` (xyz each), within
 * [0, tMax). Infinity when it doesn't hit. The capsule must start clear
 * of the polygon (distance > r).
 */
export function sweepPolygon(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  a: number,
  r: number,
  v: Float64Array,
  n: number,
  tMax: number
): number {
  let best = tMax;
  // Corner spheres: each vertex at +-a.
  for (let i = 0; i < n; i++) {
    const vx = v[i * 3];
    const vy = v[i * 3 + 1];
    const vz = v[i * 3 + 2];
    let t = raySphere(ox, oy, oz, dx, dy, dz, vx, vy, vz + a, r);
    if (t < best) best = t;
    if (a > 0) {
      t = raySphere(ox, oy, oz, dx, dy, dz, vx, vy, vz - a, r);
      if (t < best) best = t;
      // Vertical edge at the vertex.
      t = rayCylinder(
        ox,
        oy,
        oz,
        dx,
        dy,
        dz,
        vx,
        vy,
        vz - a,
        vx,
        vy,
        vz + a,
        r
      );
      if (t < best) best = t;
    }
  }
  // The polygon's edges at +-a, and their side faces (edge extruded along Z).
  const edges = n === 1 ? 0 : n === 2 ? 1 : n;
  for (let i = 0; i < edges; i++) {
    const j = (i + 1) % n;
    const x0 = v[i * 3];
    const y0 = v[i * 3 + 1];
    const z0 = v[i * 3 + 2];
    const x1 = v[j * 3];
    const y1 = v[j * 3 + 1];
    const z1 = v[j * 3 + 2];
    let t = rayCylinder(
      ox,
      oy,
      oz,
      dx,
      dy,
      dz,
      x0,
      y0,
      z0 + a,
      x1,
      y1,
      z1 + a,
      r
    );
    if (t < best) best = t;
    if (a > 0) {
      t = rayCylinder(
        ox,
        oy,
        oz,
        dx,
        dy,
        dz,
        x0,
        y0,
        z0 - a,
        x1,
        y1,
        z1 - a,
        r
      );
      if (t < best) best = t;
    }
    // Side face: the parallelogram v_i +- a, v_j +- a; normal (e x Z) is
    // horizontal. Push it out by r on the side the ray comes from.
    const ex = x1 - x0;
    const ey = y1 - y0;
    const hl = Math.sqrt(ex * ex + ey * ey);
    if (hl <= 1e-12) continue; // vertical edge: covered by the cylinders
    let mx = ey / hl;
    let my = -ex / hl;
    let dn = mx * dx + my * dy;
    if (dn === 0) continue;
    if (dn > 0) {
      mx = -mx;
      my = -my;
      dn = -dn;
    }
    // Plane: m . X = m . v_i + r.
    const t0 = (mx * x0 + my * y0 + r - (mx * ox + my * oy)) / dn;
    if (t0 < 0 || t0 >= best) continue;
    const hx = ox + t0 * dx - r * mx - x0;
    const hy = oy + t0 * dy - r * my - y0;
    const hz = oz + t0 * dz - z0;
    const u = (hx * ex + hy * ey) / (hl * hl);
    if (u < 0 || u > 1) continue;
    const w = hz - u * (z1 - z0);
    if (w < -a || w > a) continue;
    best = t0;
  }
  // Caps: the triangle at +-a, pushed out by r along its normal.
  if (n === 3) {
    const abx = v[3] - v[0];
    const aby = v[4] - v[1];
    const abz = v[5] - v[2];
    const acx = v[6] - v[0];
    const acy = v[7] - v[1];
    const acz = v[8] - v[2];
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nl > 1e-12) {
      nx /= nl;
      ny /= nl;
      nz /= nl;
      let dn = nx * dx + ny * dy + nz * dz;
      if (dn !== 0) {
        if (dn > 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
          dn = -dn;
        }
        for (const sz of a > 0 ? [a, -a] : [0]) {
          const plane = nx * v[0] + ny * v[1] + nz * (v[2] + sz) + r;
          const t0 = (plane - (nx * ox + ny * oy + nz * oz)) / dn;
          if (t0 < 0 || t0 >= best) continue;
          const hx = ox + t0 * dx - r * nx;
          const hy = oy + t0 * dy - r * ny;
          const hz = oz + t0 * dz - r * nz - sz;
          if (insideTriangle(hx, hy, hz, v, nx, ny, nz)) best = t0;
        }
      }
    }
  }
  return best < tMax ? best : Infinity;
}

/** Whether p (on the triangle's plane) lies inside triangle v, normal n
 * (either orientation: inside means all three edge tests agree). */
function insideTriangle(
  px: number,
  py: number,
  pz: number,
  v: Float64Array,
  nx: number,
  ny: number,
  nz: number
): boolean {
  let positive = 0;
  let negative = 0;
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const ex = v[j * 3] - v[i * 3];
    const ey = v[j * 3 + 1] - v[i * 3 + 1];
    const ez = v[j * 3 + 2] - v[i * 3 + 2];
    const wx = px - v[i * 3];
    const wy = py - v[i * 3 + 1];
    const wz = pz - v[i * 3 + 2];
    const s =
      nx * (ey * wz - ez * wy) +
      ny * (ez * wx - ex * wz) +
      nz * (ex * wy - ey * wx);
    if (s > 0) positive++;
    else if (s < 0) negative++;
  }
  return positive === 0 || negative === 0;
}

/** Ray against triangle (Moller-Trumbore, both faces): the hit time in
 * [0, tMax), or Infinity. */
export function rayTriangle(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  v: Float64Array,
  tMax: number
): number {
  const e1x = v[3] - v[0];
  const e1y = v[4] - v[1];
  const e1z = v[5] - v[2];
  const e2x = v[6] - v[0];
  const e2y = v[7] - v[1];
  const e2z = v[8] - v[2];
  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (det === 0) return Infinity;
  const inv = 1 / det;
  const tx = ox - v[0];
  const ty = oy - v[1];
  const tz = oz - v[2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return Infinity;
  const qx2 = ty * e1z - tz * e1y;
  const qy2 = tz * e1x - tx * e1z;
  const qz2 = tx * e1y - ty * e1x;
  const w = (dx * qx2 + dy * qy2 + dz * qz2) * inv;
  if (w < 0 || u + w > 1) return Infinity;
  const t = (e2x * qx2 + e2y * qy2 + e2z * qz2) * inv;
  return t >= 0 && t < tMax ? t : Infinity;
}
