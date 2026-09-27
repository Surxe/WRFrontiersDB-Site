/**
 * World-space hitbox primitives of a placed module.
 *
 * Shared by the renderer (scene.ts builds three.js geometry from these) and the
 * area raycaster (hitbox_area.ts intersects them analytically), so what is
 * measured is exactly what is drawn.
 */
import {
  IDENTITY,
  boneWorlds,
  eulerMat,
  mapply,
  mmul,
  type Mat4,
} from './math';
import type { ModuleModel, Vec3 } from '../../types/model';

/** A collision primitive in UE world space. `m` maps the primitive's local
 * frame (centered at the origin; capsules along local Z) to world. */
export type HitboxPrimitive = (
  | { kind: 'capsule'; m: Mat4; radius: number; length: number }
  | { kind: 'box'; m: Mat4; extent: Vec3 }
  | { kind: 'sphere'; m: Mat4; radius: number }
) & {
  /** Health pool (armor zone) of the primitive's component, if linked. */
  zone?: string;
};

export function hitboxPrimitives(
  model: ModuleModel,
  world: Mat4
): HitboxPrimitive[] {
  // Hitboxes share the mesh's component space (root at origin).
  const boneWorld = boneWorlds(model.bones ?? [], true);
  const out: HitboxPrimitive[] = [];
  for (const cap of model.capsules ?? []) {
    const boneMat = boneWorld[cap.bone] ?? IDENTITY;
    const m = mmul(
      world,
      mmul(boneMat, eulerMat(cap.rot[0], cap.rot[1], cap.rot[2], cap.center))
    );
    out.push({
      kind: 'capsule',
      m,
      radius: cap.radius,
      length: cap.length,
      zone: cap.armor_zone,
    });
  }
  for (const bx of model.boxes ?? []) {
    const boneMat = boneWorld[bx.bone] ?? IDENTITY;
    const m = mmul(
      world,
      mmul(boneMat, eulerMat(bx.rot[0], bx.rot[1], bx.rot[2], bx.center))
    );
    out.push({ kind: 'box', m, extent: bx.extent, zone: bx.armor_zone });
  }
  for (const sp of model.spheres ?? []) {
    const boneMat = boneWorld[sp.bone] ?? IDENTITY;
    const center = mapply(mmul(world, boneMat), sp.center);
    out.push({
      kind: 'sphere',
      m: eulerMat(0, 0, 0, center),
      radius: sp.radius,
      zone: sp.armor_zone,
    });
  }
  return out;
}
