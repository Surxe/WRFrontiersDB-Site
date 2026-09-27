/**
 * three.js geometry construction: hitbox primitives and per-module meshes.
 */
import * as THREE from 'three';
import { IDENTITY, boneWorlds, mapply, mmul, toThree, type Mat4 } from './math';
import { hitboxPrimitives, type HitboxPrimitive } from './hitbox';
import { isFxMesh } from './mesh';
import type { ModuleModel, Vec3 } from '../../types/model';

/** Tracks the disposable three.js resources a build creates so the viewer can
 * tear them down before the next build. */
export interface TrackedResources {
  geos: THREE.BufferGeometry[];
  mats: THREE.Material[];
  objs: THREE.Object3D[];
}

export function createTrack(): TrackedResources {
  return { geos: [], mats: [], objs: [] };
}

function buildCapsuleGeometry(radius: number, length: number): THREE.BufferGeometry {
  // Parametric capsule along local Z (UE convention), 24 segments x 10 rings.
  const segments = 24;
  const rings = 10;
  const positions: number[] = [];
  const indices: number[] = [];
  const half = length / 2;
  const rows: number[][] = [];
  for (let i = 0; i <= rings; i++) {
    const phi = -Math.PI / 2 + (Math.PI * i) / rings;
    const zc = Math.sin(phi) * radius;
    const rr = Math.cos(phi) * radius;
    const zoff = phi < 0 ? -half : half;
    const row: number[] = [];
    for (let j = 0; j < segments; j++) {
      const th = (2 * Math.PI * j) / segments;
      positions.push(Math.cos(th) * rr, Math.sin(th) * rr, zc + zoff);
      row.push(positions.length / 3 - 1);
    }
    rows.push(row);
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const j2 = (j + 1) % segments;
      const a = rows[i][j], b = rows[i][j2], c = rows[i + 1][j2], d = rows[i + 1][j];
      indices.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

function buildBoxGeometry(extent: Vec3): THREE.BufferGeometry {
  // UE FKBoxElem X/Y/Z are the box's FULL dimensions, which is exactly what
  // THREE.BoxGeometry expects (width/height/depth). (Capsules use radius/length.)
  return new THREE.BoxGeometry(extent[0], extent[1], extent[2]);
}

function addModuleMeshes(
  group: THREE.Group,
  model: ModuleModel,
  worldMatrix: THREE.Matrix4,
  color: number,
  track: TrackedResources,
): void {
  for (const mesh of model.meshes ?? []) {
    if (isFxMesh(mesh)) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.verts, 3));
    geo.setIndex(mesh.indices);
    geo.computeVertexNormals();
    geo.applyMatrix4(worldMatrix);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const obj = new THREE.Mesh(geo, mat);
    group.add(obj);
    track.geos.push(geo);
    track.mats.push(mat);
    track.objs.push(obj);
  }
}

/** three.js geometry for one hitbox primitive, in the primitive's local frame. */
export function primitiveGeometry(p: HitboxPrimitive): THREE.BufferGeometry {
  if (p.kind === 'capsule') return buildCapsuleGeometry(p.radius, p.length);
  if (p.kind === 'box') return buildBoxGeometry(p.extent);
  return new THREE.SphereGeometry(p.radius, 24, 16);
}

function addHitboxes(
  group: THREE.Group,
  model: ModuleModel,
  world: Mat4,
  color: number,
  track: TrackedResources,
): void {
  const hitMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  track.mats.push(hitMat);

  for (const prim of hitboxPrimitives(model, world)) {
    const geo = primitiveGeometry(prim);
    geo.applyMatrix4(toThree(prim.m));
    const obj = new THREE.Mesh(geo, hitMat);
    group.add(obj);
    track.geos.push(geo);
    track.objs.push(obj);
  }
}

function addSkeleton(
  group: THREE.Group,
  model: ModuleModel,
  world: Mat4,
  boneWorld: Mat4[],
  track: TrackedResources,
): void {
  const points: number[] = [];
  model.bones.forEach((bone) => {
    if (bone.parent < 0) return;
    const idx = model.bones.indexOf(bone);
    const p1 = mapply(mmul(world, boneWorld[bone.parent] ?? IDENTITY), [0, 0, 0]);
    const p2 = mapply(mmul(world, boneWorld[idx] ?? IDENTITY), [0, 0, 0]);
    points.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
  });
  if (points.length === 0) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x66ccff });
  const lines = new THREE.LineSegments(geo, mat);
  group.add(lines);
  track.geos.push(geo);
  track.mats.push(mat);
  track.objs.push(lines);
}

export function addModel(
  group: THREE.Group,
  model: ModuleModel,
  world: Mat4,
  color: number,
  opts: { hitbox: boolean; skeleton: boolean },
  track: TrackedResources,
): void {
  // The skeleton overlay shares the mesh's component space (root at origin).
  const boneWorld = boneWorlds(model.bones ?? [], true);
  addModuleMeshes(group, model, toThree(world), color, track);
  if (opts.hitbox) addHitboxes(group, model, world, color, track);
  if (opts.skeleton) addSkeleton(group, model, world, boneWorld, track);
}
