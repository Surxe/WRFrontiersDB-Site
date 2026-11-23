/**
 * UE 5.4.4 vector rotation helpers with UE's arithmetic order, in doubles
 * (FVector, FRotator and FMatrix are double in UE 5): the pieces the dash
 * direction (`0x1452d7e30`), its start impulse (`0x1452c16d0`) and its
 * lateral force (`0x145580290`) call.
 *
 * Sin and cos are correctly rounded (sincos.ts). The game's Windows build
 * calls its CRT's vectorised sincos there, which may differ in the last
 * bit (a labelled gap, rules/abilities/known_gaps.ts).
 */
import { sinCos } from './sincos';
import { vec, type Vec3 } from './vec';

/** UE_DOUBLE_PI / 180 (FMath::DegreesToRadians for doubles). */
const DEG_TO_RAD = Math.PI / 180;
/** 180 / UE_DOUBLE_PI (FMath::RadiansToDegrees for doubles). */
const RAD_TO_DEG = 180 / Math.PI;

export interface Rotator {
  pitch: number;
  yaw: number;
  roll: number;
}

/** FVector::Rotation / ToOrientationRotator (UnrealMath.cpp:199). */
export function vectorRotation(v: Vec3): Rotator {
  return {
    pitch: Math.atan2(v.z, Math.sqrt(v.x * v.x + v.y * v.y)) * RAD_TO_DEG,
    yaw: Math.atan2(v.y, v.x) * RAD_TO_DEG,
    roll: 0,
  };
}

/** FVector::RotateAngleAxis (Vector.h:1306, RotateAngleAxisRad). */
export function rotateAngleAxis(v: Vec3, angleDeg: number, axis: Vec3): Vec3 {
  const [s, c] = sinCos(angleDeg * DEG_TO_RAD);
  const xx = axis.x * axis.x;
  const yy = axis.y * axis.y;
  const zz = axis.z * axis.z;
  const xy = axis.x * axis.y;
  const yz = axis.y * axis.z;
  const zx = axis.z * axis.x;
  const xs = axis.x * s;
  const ys = axis.y * s;
  const zs = axis.z * s;
  const omc = 1 - c;
  return vec(
    (omc * xx + c) * v.x + (omc * xy - zs) * v.y + (omc * zx + ys) * v.z,
    (omc * xy + zs) * v.x + (omc * yy + c) * v.y + (omc * yz - xs) * v.z,
    (omc * zx - ys) * v.x + (omc * yz + xs) * v.y + (omc * zz + c) * v.z
  );
}

/** FRotator::RotateVector: FRotationMatrix(R).TransformVector(V)
 * (UnrealMath.cpp:569, RotationTranslationMatrix.h:42). */
export function rotatorRotateVector(r: Rotator, v: Vec3): Vec3 {
  const [sp, cp] = sinCos(r.pitch * DEG_TO_RAD);
  const [sy, cy] = sinCos(r.yaw * DEG_TO_RAD);
  const [sr, cr] = sinCos(r.roll * DEG_TO_RAD);
  const m00 = cp * cy;
  const m01 = cp * sy;
  const m02 = sp;
  const m10 = sr * sp * cy - cr * sy;
  const m11 = sr * sp * sy + cr * cy;
  const m12 = -sr * cp;
  const m20 = -(cr * sp * cy + sr * sy);
  const m21 = cy * sr - cr * sp * sy;
  const m22 = cr * cp;
  return vec(
    v.x * m00 + v.y * m10 + v.z * m20,
    v.x * m01 + v.y * m11 + v.z * m21,
    v.x * m02 + v.y * m12 + v.z * m22
  );
}

/** A 4x4 matrix, rows first (FMatrix44d::M). */
export type Matrix4 = number[][];

const IDENTITY: Matrix4 = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

/** FMath::MatrixInverse for doubles (UnrealMath.cpp:833, the scalar path
 * VectorMatrixInverse uses on SSE): identity when singular. */
export function matrixInverse(m: Matrix4): Matrix4 {
  const t00 = m[2][2] * m[3][3] - m[2][3] * m[3][2];
  const t01 = m[1][2] * m[3][3] - m[1][3] * m[3][2];
  const t02 = m[1][2] * m[2][3] - m[1][3] * m[2][2];
  const t10 = m[2][2] * m[3][3] - m[2][3] * m[3][2];
  const t11 = m[0][2] * m[3][3] - m[0][3] * m[3][2];
  const t12 = m[0][2] * m[2][3] - m[0][3] * m[2][2];
  const t20 = m[1][2] * m[3][3] - m[1][3] * m[3][2];
  const t21 = m[0][2] * m[3][3] - m[0][3] * m[3][2];
  const t22 = m[0][2] * m[1][3] - m[0][3] * m[1][2];
  const t30 = m[1][2] * m[2][3] - m[1][3] * m[2][2];
  const t31 = m[0][2] * m[2][3] - m[0][3] * m[2][2];
  const t32 = m[0][2] * m[1][3] - m[0][3] * m[1][2];
  const det0 = m[1][1] * t00 - m[2][1] * t01 + m[3][1] * t02;
  const det1 = m[0][1] * t10 - m[2][1] * t11 + m[3][1] * t12;
  const det2 = m[0][1] * t20 - m[1][1] * t21 + m[3][1] * t22;
  const det3 = m[0][1] * t30 - m[1][1] * t31 + m[2][1] * t32;
  const determinant =
    m[0][0] * det0 - m[1][0] * det1 + m[2][0] * det2 - m[3][0] * det3;
  if (determinant === 0 || !Number.isFinite(determinant))
    return IDENTITY.map((row) => [...row]);
  const r = 1 / determinant;
  return [
    [r * det0, -r * det1, r * det2, -r * det3],
    [
      -r * (m[1][0] * t00 - m[2][0] * t01 + m[3][0] * t02),
      r * (m[0][0] * t10 - m[2][0] * t11 + m[3][0] * t12),
      -r * (m[0][0] * t20 - m[1][0] * t21 + m[3][0] * t22),
      r * (m[0][0] * t30 - m[1][0] * t31 + m[2][0] * t32),
    ],
    [
      r *
        (m[1][0] * (m[2][1] * m[3][3] - m[2][3] * m[3][1]) -
          m[2][0] * (m[1][1] * m[3][3] - m[1][3] * m[3][1]) +
          m[3][0] * (m[1][1] * m[2][3] - m[1][3] * m[2][1])),
      -r *
        (m[0][0] * (m[2][1] * m[3][3] - m[2][3] * m[3][1]) -
          m[2][0] * (m[0][1] * m[3][3] - m[0][3] * m[3][1]) +
          m[3][0] * (m[0][1] * m[2][3] - m[0][3] * m[2][1])),
      r *
        (m[0][0] * (m[1][1] * m[3][3] - m[1][3] * m[3][1]) -
          m[1][0] * (m[0][1] * m[3][3] - m[0][3] * m[3][1]) +
          m[3][0] * (m[0][1] * m[1][3] - m[0][3] * m[1][1])),
      -r *
        (m[0][0] * (m[1][1] * m[2][3] - m[1][3] * m[2][1]) -
          m[1][0] * (m[0][1] * m[2][3] - m[0][3] * m[2][1]) +
          m[2][0] * (m[0][1] * m[1][3] - m[0][3] * m[1][1])),
    ],
    [
      -r *
        (m[1][0] * (m[2][1] * m[3][2] - m[2][2] * m[3][1]) -
          m[2][0] * (m[1][1] * m[3][2] - m[1][2] * m[3][1]) +
          m[3][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])),
      r *
        (m[0][0] * (m[2][1] * m[3][2] - m[2][2] * m[3][1]) -
          m[2][0] * (m[0][1] * m[3][2] - m[0][2] * m[3][1]) +
          m[3][0] * (m[0][1] * m[2][2] - m[0][2] * m[2][1])),
      -r *
        (m[0][0] * (m[1][1] * m[3][2] - m[1][2] * m[3][1]) -
          m[1][0] * (m[0][1] * m[3][2] - m[0][2] * m[3][1]) +
          m[3][0] * (m[0][1] * m[1][2] - m[0][2] * m[1][1])),
      r *
        (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
          m[1][0] * (m[0][1] * m[2][2] - m[0][2] * m[2][1]) +
          m[2][0] * (m[0][1] * m[1][2] - m[0][2] * m[1][1])),
    ],
  ];
}

/** FMatrix::TransformVector (w = 0): row vector times the matrix. */
export function transformVector(m: Matrix4, v: Vec3): Vec3 {
  return vec(
    v.x * m[0][0] + v.y * m[1][0] + v.z * m[2][0],
    v.x * m[0][1] + v.y * m[1][1] + v.z * m[2][1],
    v.x * m[0][2] + v.y * m[1][2] + v.z * m[2][2]
  );
}
