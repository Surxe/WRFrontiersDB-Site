/**
 * The loaded map's triangles as collision pieces: one piece per placed
 * mesh (each instance of an instanced mesh), already in world space and
 * converted to Unreal space (cm, Z up), read from the three.js scene the
 * viewer drew, so the map isn't fetched or decoded twice.
 *
 * The viewer draws Unreal (x, y, z) at three.js (x, z, y) (see
 * viewer3d/stage.ts toUeSpace / ueDirection); swapping back mirrors, so
 * triangle winding is flipped to keep faces outward.
 */
import * as THREE from 'three';
import type { TrianglePiece } from '../../movement/collision/triangles';

export interface PieceCount {
  pieces: number;
  triangles: number;
}

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry.getAttribute('position'))
      found.push(node);
  });
  return found;
}

const instanceCount = (mesh: THREE.Mesh): number =>
  mesh instanceof THREE.InstancedMesh ? mesh.count : 1;

const triangleCount = (geometry: THREE.BufferGeometry): number =>
  (geometry.index
    ? geometry.index.count
    : geometry.getAttribute('position').count) / 3;

/** How many pieces and triangles `root` holds (for progress). */
export function countPieces(root: THREE.Object3D): PieceCount {
  let pieces = 0;
  let triangles = 0;
  for (const mesh of meshes(root)) {
    const n = instanceCount(mesh);
    pieces += n;
    triangles += triangleCount(mesh.geometry) * n;
  }
  return { pieces, triangles };
}

/** Every placed mesh under `root`, one piece at a time. */
export function* trianglePieces(
  root: THREE.Object3D
): Generator<TrianglePiece> {
  const matrix = new THREE.Matrix4();
  const instance = new THREE.Matrix4();
  for (const mesh of meshes(root)) {
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const vertexCount = position.count;
    // Local positions once per mesh (handles interleaved and quantized data).
    const local = new Float32Array(vertexCount * 3);
    for (let v = 0; v < vertexCount; v++) {
      local[v * 3] = position.getX(v);
      local[v * 3 + 1] = position.getY(v);
      local[v * 3 + 2] = position.getZ(v);
    }
    const triangles = triangleCount(geometry);
    const indices = new Uint32Array(triangles * 3);
    const index = geometry.index;
    for (let t = 0; t < triangles; t++) {
      const a = index ? index.getX(t * 3) : t * 3;
      const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      // Flipped winding (the axis swap mirrors).
      indices[t * 3] = a;
      indices[t * 3 + 1] = c;
      indices[t * 3 + 2] = b;
    }
    const count = instanceCount(mesh);
    for (let i = 0; i < count; i++) {
      matrix.copy(mesh.matrixWorld);
      if (mesh instanceof THREE.InstancedMesh) {
        mesh.getMatrixAt(i, instance);
        matrix.multiply(instance);
      }
      const e = matrix.elements;
      const positions = new Float32Array(vertexCount * 3);
      for (let v = 0; v < vertexCount; v++) {
        const x = local[v * 3];
        const y = local[v * 3 + 1];
        const z = local[v * 3 + 2];
        const sx = e[0] * x + e[4] * y + e[8] * z + e[12];
        const sy = e[1] * x + e[5] * y + e[9] * z + e[13];
        const sz = e[2] * x + e[6] * y + e[10] * z + e[14];
        // three (x, y, z) -> Unreal (x, z, y).
        positions[v * 3] = sx;
        positions[v * 3 + 1] = sz;
        positions[v * 3 + 2] = sy;
      }
      // Pieces share `indices` (read-only; Rapier copies it).
      yield { positions, indices };
    }
  }
}
