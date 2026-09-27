/**
 * UE transform helpers on three.js math types.
 *
 * Module world transforms are three.js `Matrix4`s. three's math classes are
 * plain JS (no WebGL or DOM), so this layer stays usable headlessly (tests,
 * other pages) while the renderer consumes the same matrices directly.
 *
 * UE conventions throughout: centimeters, X forward / Y right / Z up. Every
 * helper returns a new matrix and never mutates its inputs.
 */
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { Bone, Rotator, Vec3 } from '../../../types/model';

/** UE FRotator (degrees) + translation: R = Rz(yaw) · Ry(pitch) · Rx(roll). */
export function rotatorMatrix(
  [pitch, yaw, roll]: Rotator,
  location: Vec3 = [0, 0, 0]
): Matrix4 {
  const euler = new Euler(
    MathUtils.degToRad(roll),
    MathUtils.degToRad(pitch),
    MathUtils.degToRad(yaw),
    'ZYX'
  );
  return new Matrix4().makeRotationFromEuler(euler).setPosition(...location);
}

export function translationMatrix(offset: Vec3): Matrix4 {
  return new Matrix4().makeTranslation(...offset);
}

/** `a · b` as a new matrix. */
export function multiply(a: Matrix4, b: Matrix4): Matrix4 {
  return new Matrix4().multiplyMatrices(a, b);
}

/** `m`'s translation, with a fresh rotation from `rotator`. */
export function withRotation(m: Matrix4, rotator: Rotator): Matrix4 {
  return rotatorMatrix(rotator).copyPosition(m);
}

export function positionOf(m: Matrix4): Vec3 {
  const p = new Vector3().setFromMatrixPosition(m);
  return [p.x, p.y, p.z];
}

export function transformPoint(m: Matrix4, point: Vec3): Vec3 {
  const p = new Vector3(...point).applyMatrix4(m);
  return [p.x, p.y, p.z];
}

function boneLocal(bone: Bone): Matrix4 {
  return new Matrix4().compose(
    new Vector3(...bone.pos),
    new Quaternion(...bone.rot).normalize(),
    new Vector3(...(bone.scale ?? [1, 1, 1]))
  );
}

/**
 * Reference-pose world matrix of every bone.
 *
 * With `rootAtOrigin`, root bones are forced to identity, giving the mesh's
 * component space. Some skeletons (e.g. the Alpha torso) bake the module's
 * mount height into the root bone while the mesh stays root-relative, so
 * hitboxes, which ride the mesh, must use this normalized frame or they get
 * lifted twice. Mount resolution (socket frames) must NOT normalize: it uses
 * the skeleton frame the child module attaches to.
 */
export function boneWorlds(
  bones: readonly Bone[],
  rootAtOrigin = false
): Matrix4[] {
  const worlds: Matrix4[] = [];
  for (const bone of bones) {
    if (bone.parent < 0) {
      worlds.push(rootAtOrigin ? new Matrix4() : boneLocal(bone));
    } else {
      worlds.push(multiply(worlds[bone.parent], boneLocal(bone)));
    }
  }
  return worlds;
}
