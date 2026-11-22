/**
 * The colliders an exact collision world is built from, in world space
 * (UE cm, Z up), independent of where they came from: the map's
 * collision export (collision/export_loader.ts) or test geometry.
 */

export type V3 = readonly [number, number, number];
/** x, y, z, w. */
export type Quat = readonly [number, number, number, number];

/** What a hit reports about the collider (debug and the HUD list). */
export interface ColliderInfo {
  /** Debug name, `<actor class>/<component>`. */
  source: string;
  /** FLAG bits from the collision file (0 for test geometry). */
  flags: number;
}

export interface BoxCollider {
  center: V3;
  rotation: Quat;
  halfExtents: V3;
  info: ColliderInfo;
}

export interface SphereCollider {
  center: V3;
  radius: number;
  info: ColliderInfo;
}

export interface CapsuleCollider {
  center: V3;
  rotation: Quat;
  radius: number;
  /** Half length of the cylinder along local Z. */
  halfLength: number;
  info: ColliderInfo;
}

/** A convex hull in body space, shared by every instance placing it. */
export interface HullBody {
  /** xyz per vertex. */
  points: Float64Array;
  /** The exported hull triangles (indices into `points`; winding not
   * relied on); empty: build the hull from the points. */
  faces?: ArrayLike<number>;
}

/** A placed hull: vertex world = t + rotate(q, s * v). */
export interface HullCollider {
  body: HullBody;
  t: V3;
  q: Quat;
  s: V3;
  info: ColliderInfo;
}

/** A placed triangle mesh (complex-as-simple, spline pieces, landscape
 * mesh collision); same transform rule as hulls. */
export interface MeshCollider {
  /** Body-space xyz per vertex. */
  vertices: ArrayLike<number>;
  /** UE winding: outward normal = (v2 - v0) x (v1 - v0). */
  triangles: ArrayLike<number>;
  t: V3;
  q: Quat;
  s: V3;
  /** `bDoubleSidedGeometry` (flag bit 32): both faces block sweeps. */
  doubleSided: boolean;
  info: ColliderInfo;
}

/** One landscape collision component. Vertex (x, y) is at local
 * (x, y, height[y * cols + x]), then world = t + rotate(q, s * local). */
export interface HeightfieldCollider {
  rows: number;
  cols: number;
  /** Decoded local heights (min_value + h * height_per_unit), rows x cols. */
  heights: Float64Array;
  /** One per cell ((rows - 1) x (cols - 1)), nonzero = hole; null: none. */
  holes: Uint8Array | null;
  t: V3;
  q: Quat;
  s: V3;
  info: ColliderInfo;
}

export interface ColliderSet {
  boxes: BoxCollider[];
  spheres: SphereCollider[];
  capsules: CapsuleCollider[];
  hulls: HullCollider[];
  meshes: MeshCollider[];
  heightfields: HeightfieldCollider[];
}

export const emptyColliderSet = (): ColliderSet => ({
  boxes: [],
  spheres: [],
  capsules: [],
  hulls: [],
  meshes: [],
  heightfields: [],
});

/** Rotate v by the unit quaternion q (UE / Chaos convention). */
export function rotate(
  q: Quat,
  x: number,
  y: number,
  z: number
): [number, number, number] {
  const [qx, qy, qz, qw] = q;
  // v' = v + 2w (q x v) + 2 q x (q x v)
  const cx = qy * z - qz * y;
  const cy = qz * x - qx * z;
  const cz = qx * y - qy * x;
  const ccx = qy * cz - qz * cy;
  const ccy = qz * cx - qx * cz;
  const ccz = qx * cy - qy * cx;
  return [
    x + 2 * (qw * cx + ccx),
    y + 2 * (qw * cy + ccy),
    z + 2 * (qw * cz + ccz),
  ];
}

/** q scaled to unit length (the file stores float32 quaternions). */
export function normalizeQuat(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!(l > 0)) return [0, 0, 0, 1];
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
