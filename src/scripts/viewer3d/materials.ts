/**
 * Material sharing and disposal for what a viewer adds to its scene.
 */
import * as THREE from 'three';

/** One material per color, shared by the meshes drawn in it. */
export class MaterialCache<M extends THREE.Material> {
  private readonly byColor = new Map<number, M>();
  constructor(private readonly create: (color: number) => M) {}
  get(color: number): M {
    let material = this.byColor.get(color);
    if (!material) {
      material = this.create(color);
      this.byColor.set(color, material);
    }
    return material;
  }
}

/** Remove `group`'s children, freeing their GPU geometry, materials and
 * textures. */
export function clearGroup(group: THREE.Group): void {
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const materials: THREE.Material[] = [node.material].flat();
    for (const material of materials) {
      if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
      material.dispose();
    }
  });
  group.clear();
}
