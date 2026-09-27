/**
 * three.js geometry for placed modules: untextured meshes and hitbox
 * primitives, plus disposal of whatever a build added to the scene.
 */
import * as THREE from 'three';
import { isFxMesh } from '../../robot/model/mesh';
import {
  hitboxPrimitives,
  type HitboxPrimitive,
} from '../../robot/model/hitbox';
import type { ArmorZoneId, ModuleModel } from '../../../types/model';

/** The color of a module's part in an armor zone (null: none). */
export type ZoneColorFn = (zone: ArmorZoneId | null) => number;

const HITBOX_OPACITY = 0.45;

function capsuleGeometry(radius: number, length: number): THREE.BufferGeometry {
  // UE capsules run along local Z; three's CapsuleGeometry runs along Y.
  return new THREE.CapsuleGeometry(radius, length, 6, 24).rotateX(Math.PI / 2);
}

/** three.js geometry for one hitbox primitive, placed in UE world space. */
export function primitiveGeometry(p: HitboxPrimitive): THREE.BufferGeometry {
  const geometry =
    p.kind === 'capsule'
      ? capsuleGeometry(p.radius, p.length)
      : p.kind === 'box'
        ? // FKBoxElem X/Y/Z are full dimensions, as BoxGeometry expects.
          new THREE.BoxGeometry(...p.extent)
        : new THREE.SphereGeometry(p.radius, 24, 16);
  return geometry.applyMatrix4(p.m);
}

/** One material per color, shared by the meshes of a build. */
class MaterialCache<M extends THREE.Material> {
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

function addMeshes(
  group: THREE.Group,
  model: ModuleModel,
  world: THREE.Matrix4,
  colorOf: ZoneColorFn,
  opacity: number
): void {
  const materials = new MaterialCache(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0.1,
        side: THREE.DoubleSide,
        // Translucent meshes (compare mode's changed parts) let overlapping
        // A and B parts show through each other.
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1,
      })
  );
  for (const mesh of model.meshes) {
    if (isFxMesh(mesh)) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(mesh.verts, 3)
    );
    geometry.setIndex(mesh.indices);
    geometry.computeVertexNormals();
    geometry.applyMatrix4(world);
    group.add(
      new THREE.Mesh(geometry, materials.get(colorOf(mesh.armor_zone ?? null)))
    );
  }
}

function addHitboxes(
  group: THREE.Group,
  model: ModuleModel,
  world: THREE.Matrix4,
  colorOf: ZoneColorFn
): void {
  const materials = new MaterialCache(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        transparent: true,
        opacity: HITBOX_OPACITY,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
  );
  for (const prim of hitboxPrimitives(model, world)) {
    group.add(
      new THREE.Mesh(primitiveGeometry(prim), materials.get(colorOf(prim.zone)))
    );
  }
}

export interface ModelLayers {
  mesh: boolean;
  hitbox: boolean;
  /** Mesh opacity (hitboxes are always translucent). */
  meshOpacity: number;
}

/** Add a placed module's mesh and/or hitboxes to `group`. */
export function addModel(
  group: THREE.Group,
  model: ModuleModel,
  world: THREE.Matrix4,
  colorOf: ZoneColorFn,
  layers: ModelLayers
): void {
  if (layers.mesh) addMeshes(group, model, world, colorOf, layers.meshOpacity);
  if (layers.hitbox) addHitboxes(group, model, world, colorOf);
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
