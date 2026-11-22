/**
 * Convex hull faces for the exact layer. Chaos sweeps a convex collider as
 * the hull of its vertices (GJK only uses their support points).
 *
 * - `hullFromFaces`: the exported hull triangles (Chaos's own cooked faces),
 *   each turned to face away from the centroid.
 * - `convexHull`: builds the hull from points, for hulls exported without
 *   triangles (in the 2026-11-05 data all of them are flat polygons). It is
 *   incremental with a relative epsilon, which is fine for small or flat
 *   point sets; its result is checked to be a closed manifold, and a
 *   failure is reported as degenerate rather than used.
 */

export type Hull =
  /** A solid: triangles with outward winding (right-handed cross product
   * (b - a) x (c - a) points out). */
  | { kind: 'solid'; triangles: Uint32Array }
  /** All points (nearly) coplanar: a flat convex polygon as a fan of
   * triangles; it has no inside. */
  | { kind: 'flat'; triangles: Uint32Array }
  /** Collinear or a single point: no collision surface. */
  | { kind: 'degenerate' };

const RELATIVE_EPS = 1e-7;

/** Triangles `faces` (indices into `points`) turned to face outward: away
 * from the points' centroid, which is inside a convex hull. */
export function hullFromFaces(
  points: ArrayLike<number>,
  faces: ArrayLike<number>
): Hull {
  const n = points.length / 3;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    cx += points[i * 3];
    cy += points[i * 3 + 1];
    cz += points[i * 3 + 2];
  }
  cx /= n;
  cy /= n;
  cz /= n;
  const out: number[] = [];
  let volume = 0;
  for (let t = 0; t < faces.length; t += 3) {
    const a = faces[t];
    const b = faces[t + 1];
    const c = faces[t + 2];
    if (a >= n || b >= n || c >= n)
      throw new Error('hull triangle index out of range');
    const ux = points[b * 3] - points[a * 3];
    const uy = points[b * 3 + 1] - points[a * 3 + 1];
    const uz = points[b * 3 + 2] - points[a * 3 + 2];
    const vx = points[c * 3] - points[a * 3];
    const vy = points[c * 3 + 1] - points[a * 3 + 1];
    const vz = points[c * 3 + 2] - points[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx === 0 && ny === 0 && nz === 0) continue;
    const side =
      nx * (points[a * 3] - cx) +
      ny * (points[a * 3 + 1] - cy) +
      nz * (points[a * 3 + 2] - cz);
    volume += Math.abs(side);
    if (side >= 0) out.push(a, b, c);
    else out.push(a, c, b);
  }
  if (out.length === 0) return { kind: 'degenerate' };
  // No volume: every face passes through the centroid (a flat hull).
  if (!(volume > 0)) return { kind: 'flat', triangles: new Uint32Array(out) };
  return { kind: 'solid', triangles: new Uint32Array(out) };
}

/** Whether triangles form a closed manifold: every directed edge once, and
 * its reverse present. */
function isClosedManifold(triangles: Uint32Array, n: number): boolean {
  const edges = new Set<number>();
  for (let t = 0; t < triangles.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const key = triangles[t + k] * n + triangles[t + ((k + 1) % 3)];
      if (edges.has(key)) return false;
      edges.add(key);
    }
  for (const key of edges) {
    const u = Math.floor(key / n);
    const v = key % n;
    if (!edges.has(v * n + u)) return false;
  }
  return true;
}

interface Face {
  a: number;
  b: number;
  c: number;
  nx: number;
  ny: number;
  nz: number;
  d: number;
  alive: boolean;
}

export function convexHull(points: ArrayLike<number>): Hull {
  const n = points.length / 3;
  const px = (i: number) => points[i * 3];
  const py = (i: number) => points[i * 3 + 1];
  const pz = (i: number) => points[i * 3 + 2];
  if (n < 3) return { kind: 'degenerate' };
  let minX = Infinity;
  let maxX = -Infinity;
  let extent = 0;
  let i0 = 0;
  for (let i = 0; i < n; i++) {
    if (px(i) < minX) {
      minX = px(i);
      i0 = i;
    }
    maxX = Math.max(maxX, px(i));
  }
  {
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      minY = Math.min(minY, py(i));
      maxY = Math.max(maxY, py(i));
      minZ = Math.min(minZ, pz(i));
      maxZ = Math.max(maxZ, pz(i));
    }
    extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  }
  if (!(extent > 0)) return { kind: 'degenerate' };
  const eps = RELATIVE_EPS * extent;

  const dist2 = (i: number, j: number) =>
    (px(i) - px(j)) ** 2 + (py(i) - py(j)) ** 2 + (pz(i) - pz(j)) ** 2;
  // Initial simplex: farthest from i0, farthest from that line, farthest
  // from that plane.
  let i1 = i0;
  for (let i = 0; i < n; i++) if (dist2(i, i0) > dist2(i1, i0)) i1 = i;
  if (Math.sqrt(dist2(i1, i0)) <= eps) return { kind: 'degenerate' };
  const lineDist = (i: number): number => {
    const ux = px(i1) - px(i0);
    const uy = py(i1) - py(i0);
    const uz = pz(i1) - pz(i0);
    const wx = px(i) - px(i0);
    const wy = py(i) - py(i0);
    const wz = pz(i) - pz(i0);
    const cx = uy * wz - uz * wy;
    const cy = uz * wx - ux * wz;
    const cz = ux * wy - uy * wx;
    return Math.sqrt(cx * cx + cy * cy + cz * cz) / Math.sqrt(dist2(i1, i0));
  };
  let i2 = i0;
  for (let i = 0; i < n; i++) if (lineDist(i) > lineDist(i2)) i2 = i;
  if (lineDist(i2) <= eps) return { kind: 'degenerate' };

  const faces: Face[] = [];
  const makeFace = (a: number, b: number, c: number): Face => {
    const ux = px(b) - px(a);
    const uy = py(b) - py(a);
    const uz = pz(b) - pz(a);
    const vx = px(c) - px(a);
    const vy = py(c) - py(a);
    const vz = pz(c) - pz(a);
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    return {
      a,
      b,
      c,
      nx,
      ny,
      nz,
      d: nx * px(a) + ny * py(a) + nz * pz(a),
      alive: true,
    };
  };
  const above = (f: Face, i: number) =>
    f.nx * px(i) + f.ny * py(i) + f.nz * pz(i) - f.d;

  const base = makeFace(i0, i1, i2);
  let i3 = i0;
  for (let i = 0; i < n; i++)
    if (Math.abs(above(base, i)) > Math.abs(above(base, i3))) i3 = i;
  if (Math.abs(above(base, i3)) <= eps) return flatHull(points, base);

  // Tetrahedron, faces wound outward (away from the fourth point).
  const tetra: [number, number, number, number][] = [
    [i0, i1, i2, i3],
    [i0, i1, i3, i2],
    [i0, i2, i3, i1],
    [i1, i2, i3, i0],
  ];
  for (const [a, b, c, other] of tetra) {
    let f = makeFace(a, b, c);
    if (above(f, other) > 0) f = makeFace(a, c, b);
    faces.push(f);
  }
  // Directed edge -> face, for horizon finding.
  const edgeFace = new Map<number, number>();
  const key = (u: number, v: number) => u * n + v;
  const link = (index: number) => {
    const f = faces[index];
    edgeFace.set(key(f.a, f.b), index);
    edgeFace.set(key(f.b, f.c), index);
    edgeFace.set(key(f.c, f.a), index);
  };
  for (let f = 0; f < faces.length; f++) link(f);

  const used = new Set([i0, i1, i2, i3]);
  for (let p = 0; p < n; p++) {
    if (used.has(p)) continue;
    const visible: number[] = [];
    for (let f = 0; f < faces.length; f++)
      if (faces[f].alive && above(faces[f], p) > eps) visible.push(f);
    if (visible.length === 0) continue;
    const isVisible = new Set(visible);
    const horizon: [number, number][] = [];
    for (const f of visible) {
      const face = faces[f];
      for (const [u, v] of [
        [face.a, face.b],
        [face.b, face.c],
        [face.c, face.a],
      ]) {
        const across = edgeFace.get(key(v, u));
        if (across === undefined || !isVisible.has(across))
          horizon.push([u, v]);
      }
    }
    for (const f of visible) {
      const face = faces[f];
      face.alive = false;
      for (const [u, v] of [
        [face.a, face.b],
        [face.b, face.c],
        [face.c, face.a],
      ]) {
        if (edgeFace.get(key(u, v)) === f) edgeFace.delete(key(u, v));
      }
    }
    for (const [u, v] of horizon) {
      faces.push(makeFace(u, v, p));
      link(faces.length - 1);
    }
    used.add(p);
  }
  const alive = faces.filter((f) => f.alive);
  const triangles = new Uint32Array(alive.length * 3);
  alive.forEach((f, i) => {
    triangles[i * 3] = f.a;
    triangles[i * 3 + 1] = f.b;
    triangles[i * 3 + 2] = f.c;
  });
  if (!isClosedManifold(triangles, n)) return { kind: 'degenerate' };
  return { kind: 'solid', triangles };
}

/** Coplanar points: their 2D hull in the plane, as a triangle fan. */
function flatHull(points: ArrayLike<number>, plane: Face): Hull {
  const n = points.length / 3;
  // A basis in the plane.
  const { nx, ny, nz } = plane;
  let ux = Math.abs(nx) < 0.9 ? 1 : 0;
  let uy = Math.abs(nx) < 0.9 ? 0 : 1;
  let uz = 0;
  const k = ux * nx + uy * ny + uz * nz;
  ux -= k * nx;
  uy -= k * ny;
  uz -= k * nz;
  const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const vx = ny * uz - nz * uy;
  const vy = nz * ux - nx * uz;
  const vz = nx * uy - ny * ux;
  const pts = Array.from({ length: n }, (_, i) => ({
    i,
    u: points[i * 3] * ux + points[i * 3 + 1] * uy + points[i * 3 + 2] * uz,
    v: points[i * 3] * vx + points[i * 3 + 1] * vy + points[i * 3 + 2] * vz,
  })).sort((p, q) => p.u - q.u || p.v - q.v);
  // Andrew's monotone chain.
  const cross = (o: (typeof pts)[0], a: (typeof pts)[0], b: (typeof pts)[0]) =>
    (a.u - o.u) * (b.v - o.v) - (a.v - o.v) * (b.u - o.u);
  const lower: typeof pts = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    )
      lower.pop();
    lower.push(p);
  }
  const upper: typeof pts = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    )
      upper.pop();
    upper.push(p);
  }
  const ring = lower.slice(0, -1).concat(upper.slice(0, -1));
  if (ring.length < 3) return { kind: 'degenerate' };
  const triangles = new Uint32Array((ring.length - 2) * 3);
  for (let i = 1; i < ring.length - 1; i++) {
    triangles[(i - 1) * 3] = ring[0].i;
    triangles[(i - 1) * 3 + 1] = ring[i].i;
    triangles[(i - 1) * 3 + 2] = ring[i + 1].i;
  }
  return { kind: 'flat', triangles };
}
