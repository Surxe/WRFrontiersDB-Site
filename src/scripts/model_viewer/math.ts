/**
 * 4x4 matrix math for module world transforms.
 *
 * UE conventions throughout: centimeters, X forward / Y right / Z up. These are
 * plain nested-array matrices (not three.js Matrix4) so the mount-resolution
 * port stays a direct mirror of wrf_models/combine.py; `toThree` converts at the
 * boundary where geometry is actually built.
 */
import * as THREE from 'three';
import type { Bone, Vec3 } from '../../types/model';

export type Mat4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
];

export const IDENTITY: Mat4 = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

export function mmul(a: Mat4, b: Mat4): Mat4 {
  const out = IDENTITY.map(() => [0, 0, 0, 0]) as Mat4;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[i][k] * b[k][j];
      out[i][j] = s;
    }
  }
  return out;
}

export function mapply(m: Mat4, p: Vec3): [number, number, number] {
  return [
    m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2] + m[0][3],
    m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2] + m[1][3],
    m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2] + m[2][3],
  ];
}

export function quatToMat(
  q: [number, number, number, number],
  pos: Vec3,
  scale: Vec3 = [1, 1, 1],
): Mat4 {
  let [x, y, z, w] = q;
  const n = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
  x /= n; y /= n; z /= n; w /= n;
  const [sx, sy, sz] = scale;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  return [
    [(1 - 2 * (yy + zz)) * sx, (2 * (xy - wz)) * sy, (2 * (xz + wy)) * sz, pos[0]],
    [(2 * (xy + wz)) * sx, (1 - 2 * (xx + zz)) * sy, (2 * (yz - wx)) * sz, pos[1]],
    [(2 * (xz - wy)) * sx, (2 * (yz + wx)) * sy, (1 - 2 * (xx + yy)) * sz, pos[2]],
    [0, 0, 0, 1],
  ];
}

/** UE FRotator (deg) + translation -> 4x4. R = Rz(yaw) @ Ry(pitch) @ Rx(roll). */
export function eulerMat(
  pitch: number,
  yaw: number,
  roll: number,
  center: Vec3 = [0, 0, 0],
): Mat4 {
  const d = Math.PI / 180;
  const p = pitch * d, y = yaw * d, r = roll * d;
  const cp = Math.cos(p), sp = Math.sin(p);
  const cy = Math.cos(y), sy = Math.sin(y);
  const cr = Math.cos(r), sr = Math.sin(r);
  const rz = [[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]];
  const ry = [[cp, 0, sp], [0, 1, 0], [-sp, 0, cp]];
  const rx = [[1, 0, 0], [0, cr, -sr], [0, sr, cr]];
  const mul3 = (a: number[][], b: number[][]) =>
    a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
  const r3 = mul3(rz, mul3(ry, rx));
  return [
    [r3[0][0], r3[0][1], r3[0][2], center[0]],
    [r3[1][0], r3[1][1], r3[1][2], center[1]],
    [r3[2][0], r3[2][1], r3[2][2], center[2]],
    [0, 0, 0, 1],
  ];
}

/** Bone reference-pose world matrices. rootIdentity=true forces root bones
 * (parent < 0) to identity, giving the mesh's component space (root at origin).
 * Some skeletons (e.g. Alpha torso) bake the module's mount height into the root
 * bone while the mesh stays root-relative; hitboxes ride the mesh, so they must
 * use this normalized frame or they get lifted twice. No-op when roots are at
 * the origin. Mount resolution (socketFrame) must NOT normalize — it uses the
 * skeleton frame the child module attaches to. */
export function boneWorlds(bones: Bone[], rootIdentity = false): Mat4[] {
  const world: Mat4[] = new Array(bones.length);
  bones.forEach((bone, i) => {
    if (bone.parent < 0) {
      world[i] = rootIdentity ? IDENTITY : quatToMat(bone.rot, bone.pos, bone.scale ?? [1, 1, 1]);
    } else {
      world[i] = mmul(world[bone.parent], quatToMat(bone.rot, bone.pos, bone.scale ?? [1, 1, 1]));
    }
  });
  return world;
}

export function toThree(m: Mat4): THREE.Matrix4 {
  const t = new THREE.Matrix4();
  t.set(
    m[0][0], m[0][1], m[0][2], m[0][3],
    m[1][0], m[1][1], m[1][2], m[1][3],
    m[2][0], m[2][1], m[2][2], m[2][3],
    m[3][0], m[3][1], m[3][2], m[3][3],
  );
  return t;
}

/** world's translation + a fresh rotation from FRotator [pitch, yaw, roll]. */
export function withWorldRotation(world: Mat4, rot: Vec3): Mat4 {
  const r = eulerMat(rot[0], rot[1], rot[2]);
  return [
    [r[0][0], r[0][1], r[0][2], world[0][3]],
    [r[1][0], r[1][1], r[1][2], world[1][3]],
    [r[2][0], r[2][1], r[2][2], world[2][3]],
    [0, 0, 0, 1],
  ];
}
