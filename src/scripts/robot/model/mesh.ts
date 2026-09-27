/**
 * Mesh classification + component-space bounds.
 *
 * Shared by mount resolution (which uses the bounds to disambiguate baked root
 * bones) and scene building (which skips FX meshes when adding geometry).
 */
import { Box3 } from 'three';
import type { ModelMesh, ModuleModel } from '../../../types/model';

/** Cosmetic FX/effect mesh components (SK_*_Effect / *_FX) are separate
 * "Effect" components in the module BP, not the visible body: in-game they
 * show only as VFX, so they are excluded from the rendered model and the
 * mount-frame bounds. */
export function isFxMesh(mesh: ModelMesh): boolean {
  const asset = mesh.asset.toLowerCase();
  return asset.includes('effect') || asset.includes('fx');
}

/** Bounds of the model's (non-FX) mesh vertices in component space, computed
 * from the vertices rather than the stored bounds (which can disagree). Empty
 * when the model has no geometry. */
export function meshBounds(model: ModuleModel): Box3 {
  const bounds = new Box3();
  for (const mesh of model.meshes) {
    if (!isFxMesh(mesh)) bounds.union(new Box3().setFromArray(mesh.verts));
  }
  return bounds;
}
