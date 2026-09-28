/**
 * World-space hitbox primitives of a placed module.
 *
 * Shared by the renderer (which builds three.js geometry from these) and the
 * area raycaster (robot/hitbox_area, which intersects them analytically), so
 * what is measured is exactly what is drawn.
 */
import { Matrix4 } from 'three';
import {
  boneWorlds,
  multiply,
  rotatorMatrix,
  transformPoint,
  translationMatrix,
} from './math';
import type { ArmorZoneId, ModuleModel, Vec3 } from '../../../types/model';

interface PrimitiveBase {
  /** Maps the primitive's local frame (centered at the origin; capsules
   * along local Z) to UE world space. */
  m: Matrix4;
  /** Health pool (armor zone) of the primitive's component, if it links one. */
  zone: ArmorZoneId | null;
}

export type HitboxPrimitive = PrimitiveBase &
  (
    | { kind: 'capsule'; radius: number; length: number }
    | { kind: 'box'; /** Full dimensions. */ extent: Vec3 }
    | { kind: 'sphere'; radius: number }
  );

export function hitboxPrimitives(
  model: ModuleModel,
  world: Matrix4
): HitboxPrimitive[] {
  // Hitboxes share the mesh's component space (root at origin).
  const bones = boneWorlds(model.bones, true);
  const boneWorld = (bone: number): Matrix4 =>
    multiply(world, bones[bone] ?? new Matrix4());
  return [
    ...model.capsules.map(
      (cap): HitboxPrimitive => ({
        kind: 'capsule',
        m: multiply(boneWorld(cap.bone), rotatorMatrix(cap.rot, cap.center)),
        radius: cap.radius,
        length: cap.length,
        zone: cap.armor_zone ?? null,
      })
    ),
    ...model.boxes.map(
      (box): HitboxPrimitive => ({
        kind: 'box',
        m: multiply(boneWorld(box.bone), rotatorMatrix(box.rot, box.center)),
        extent: box.extent,
        zone: box.armor_zone ?? null,
      })
    ),
    // A sphere only needs its center.
    ...model.spheres.map(
      (sphere): HitboxPrimitive => ({
        kind: 'sphere',
        m: translationMatrix(
          transformPoint(boneWorld(sphere.bone), sphere.center)
        ),
        radius: sphere.radius,
        zone: sphere.armor_zone ?? null,
      })
    ),
  ];
}
