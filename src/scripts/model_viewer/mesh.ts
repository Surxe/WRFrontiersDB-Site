/**
 * Mesh classification + component-space bounds helpers.
 *
 * Shared by mount resolution (which uses the AABB to disambiguate baked root
 * bones) and scene building (which skips FX meshes when adding geometry).
 */
import type { ModelMesh, ModuleModel, Vec3 } from './types';

/** Cosmetic FX/effect mesh components (SK_*_Effect / *_FX) are separate "Effect"
 * components in the module BP, not the visible body -- in-game they show only as
 * VFX, so they are excluded from the rendered model and mount-frame bounds. */
export function isFxMesh(mesh: ModelMesh): boolean {
  const a = (mesh.asset ?? '').toLowerCase();
  return a.includes('effect') || a.includes('fx');
}

/** AABB of the model's mesh verts in component space (from verts, not the stored
 * bounds, which can disagree), or null when there is no geometry. */
export function meshAabb(model: ModuleModel): [Vec3, Vec3] | null {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  let found = false;
  for (const mesh of model.meshes ?? []) {
    if (isFxMesh(mesh)) continue;
    const v = mesh.verts ?? [];
    for (let i = 0; i + 2 < v.length; i += 3) {
      found = true;
      for (let k = 0; k < 3; k++) {
        if (v[i + k] < lo[k]) lo[k] = v[i + k];
        if (v[i + k] > hi[k]) hi[k] = v[i + k];
      }
    }
  }
  return found ? [lo, hi] : null;
}

export function dist2ToBox(p: Vec3, box: [Vec3, Vec3]): number {
  const [lo, hi] = box;
  let d = 0;
  for (let k = 0; k < 3; k++) {
    if (p[k] < lo[k]) d += (lo[k] - p[k]) ** 2;
    else if (p[k] > hi[k]) d += (p[k] - hi[k]) ** 2;
  }
  return d;
}
