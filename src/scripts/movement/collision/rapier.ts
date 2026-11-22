/**
 * CollisionWorld on Rapier (WebAssembly), using only its geometric queries
 * (shape casts, ray casts, contacts), never its character controller or
 * dynamics (decision D9): the movement rules are the ported UE engine's.
 *
 * The map is added one TrianglePiece at a time; pieces over SPLIT_TRIANGLES
 * are cut into SPLIT_CELL_CM cells first, so no single collider build stalls
 * the page for long. Measured on CrashSite (20 M triangles): about 2 GB of
 * WebAssembly memory and 16 to 25 microseconds per capsule cast.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import {
  add,
  dot,
  safeNormal,
  scale,
  size,
  sub,
  vec,
  type Vec3,
} from '../math/vec';
import { splitByGrid, type TrianglePiece } from './triangles';
import type {
  Capsule,
  CollisionWorld,
  QueryHit,
  QueryStats,
  SweepOptions,
} from './world';

/** Pieces with more triangles than this are split into grid cells. */
const SPLIT_TRIANGLES = 200_000;
const SPLIT_CELL_CM = 20_000;
/** A starting contact closer than this (cm) counts as touching, not
 * penetrating (UE's sweeps report a hit at time 0 for touching shapes). */
const PENETRATION_TOLERANCE = 0.01;
/** How far off the capsule's surface a sweep's contact point may be, cm,
 * before it is recomputed with a contact query. */
const WITNESS_TOLERANCE_CM = 1;
/** How far the face probes start from a contact, cm (see opposingFaceNormal). */
const FACE_PROBE_CM = 0.05;
/** Rapier's capsules lie along local Y; this turns Y into UE's Z. */
const UPRIGHT = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };

export interface BuildStats {
  pieces: number;
  colliders: number;
  triangles: number;
  /** WebAssembly memory in use by Rapier, bytes (null if unknown). */
  wasmBytes: number | null;
}

let wasmMemory: WebAssembly.Memory | null = null;
let initialized: Promise<void> | null = null;

/** Load Rapier's WebAssembly once, keeping a handle on its memory so the
 * overlay can report it. */
function initRapier(): Promise<void> {
  initialized ??= (async () => {
    const original = WebAssembly.instantiate;
    const capture = (instance: WebAssembly.Instance): void => {
      for (const value of Object.values(instance.exports)) {
        if (value instanceof WebAssembly.Memory) wasmMemory = value;
      }
    };
    // Rapier instantiates its module internally; watch for its memory.
    WebAssembly.instantiate = (async (...args: Parameters<typeof original>) => {
      const result = (await original(...args)) as unknown as
        | WebAssembly.WebAssemblyInstantiatedSource
        | WebAssembly.Instance;
      capture(
        result instanceof WebAssembly.Instance ? result : result.instance
      );
      return result;
    }) as typeof original;
    try {
      await RAPIER.init();
    } finally {
      WebAssembly.instantiate = original;
    }
  })();
  return initialized;
}

const toR = (v: Vec3): RAPIER.Vector => ({ x: v.x, y: v.y, z: v.z });
const fromR = (v: RAPIER.Vector): Vec3 => vec(v.x, v.y, v.z);

/** The point on `capsule`'s axis (at `center`) closest to `point`. */
function closestOnAxis(center: Vec3, capsule: Capsule, point: Vec3): Vec3 {
  const half = Math.max(0, capsule.halfHeight - capsule.radius);
  const z = Math.min(center.z + half, Math.max(center.z - half, point.z));
  return vec(center.x, center.y, z);
}

export class RapierCollisionWorld implements CollisionWorld {
  private readonly world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  private readonly shapes = new Map<string, RAPIER.Capsule>();
  private stats: QueryStats = { sweeps: 0, lineTraces: 0, overlaps: 0, ms: 0 };
  private readonly build: BuildStats = {
    pieces: 0,
    colliders: 0,
    triangles: 0,
    wasmBytes: null,
  };

  private constructor() {}

  static async create(): Promise<RapierCollisionWorld> {
    await initRapier();
    return new RapierCollisionWorld();
  }

  /** Add a piece of the map as fixed colliders. */
  addPiece(piece: TrianglePiece): void {
    const parts =
      piece.indices.length / 3 > SPLIT_TRIANGLES
        ? splitByGrid(piece, SPLIT_CELL_CM)
        : [piece];
    for (const part of parts) {
      if (part.indices.length === 0) continue;
      const desc = RAPIER.ColliderDesc.trimesh(part.positions, part.indices);
      if (!desc) throw new Error('Rapier rejected a triangle mesh');
      this.world.createCollider(desc);
      this.build.colliders++;
      this.build.triangles += part.indices.length / 3;
    }
    this.build.pieces++;
  }

  /** Make the added colliders queryable (updates the broad phase). */
  finishBuild(): void {
    this.world.step();
  }

  buildStats(): BuildStats {
    return { ...this.build, wasmBytes: wasmMemory?.buffer.byteLength ?? null };
  }

  /** Free the WebAssembly side. The world can't be used afterwards. */
  free(): void {
    this.world.free();
  }

  takeStats(): QueryStats {
    const stats = this.stats;
    this.stats = { sweeps: 0, lineTraces: 0, overlaps: 0, ms: 0 };
    return stats;
  }

  sweepCapsule(
    start: Vec3,
    end: Vec3,
    capsule: Capsule,
    options: SweepOptions = {}
  ): QueryHit | null {
    const began = performance.now();
    this.stats.sweeps++;
    try {
      return this.sweep(
        start,
        end,
        capsule,
        options.ignoreOverlapsMovingOut ?? false
      );
    } finally {
      this.stats.ms += performance.now() - began;
    }
  }

  lineTrace(start: Vec3, end: Vec3): QueryHit | null {
    const began = performance.now();
    this.stats.lineTraces++;
    try {
      const delta = sub(end, start);
      const ray = new RAPIER.Ray(toR(start), toR(delta));
      const hit = this.world.castRayAndGetNormal(ray, 1, true);
      if (!hit) return null;
      let normal = fromR(hit.normal);
      if (dot(normal, delta) > 0) normal = scale(normal, -1);
      const point = add(start, scale(delta, hit.timeOfImpact));
      return {
        time: hit.timeOfImpact,
        location: point,
        impactPoint: point,
        normal,
        impactNormal: normal,
        startPenetrating: hit.timeOfImpact === 0,
        penetrationDepth: 0,
      };
    } finally {
      this.stats.ms += performance.now() - began;
    }
  }

  overlapCapsule(position: Vec3, capsule: Capsule): boolean {
    const began = performance.now();
    this.stats.overlaps++;
    try {
      return (
        this.world.intersectionWithShape(
          toR(position),
          UPRIGHT,
          this.shape(capsule)
        ) !== null
      );
    } finally {
      this.stats.ms += performance.now() - began;
    }
  }

  private shape(capsule: Capsule): RAPIER.Capsule {
    const key = `${capsule.radius}:${capsule.halfHeight}`;
    let shape = this.shapes.get(key);
    if (!shape) {
      shape = new RAPIER.Capsule(
        Math.max(0, capsule.halfHeight - capsule.radius),
        capsule.radius
      );
      this.shapes.set(key, shape);
    }
    return shape;
  }

  private sweep(
    start: Vec3,
    end: Vec3,
    capsule: Capsule,
    ignoreMovingOut: boolean
  ): QueryHit | null {
    const shape = this.shape(capsule);
    const delta = sub(end, start);
    const hit = this.world.castShape(
      toR(start),
      UPRIGHT,
      toR(delta),
      shape,
      0,
      1,
      !ignoreMovingOut
    );
    if (!hit) return null;
    const time = hit.time_of_impact;
    const location = add(start, scale(delta, time));
    if (time <= 0) {
      const mtd = this.penetration(start, capsule);
      if (mtd && mtd.depth > PENETRATION_TOLERANCE) {
        return {
          time: 0,
          location: start,
          impactPoint: mtd.point,
          normal: mtd.normal,
          impactNormal: mtd.normal,
          startPenetrating: true,
          penetrationDepth: mtd.depth,
        };
      }
    }
    let impactPoint = fromR(hit.witness1);
    let contactNormal = fromR(hit.normal1);
    // When the shapes start within touching distance, Rapier's witness
    // points can be meaningless (Parry flags them, rapier.js doesn't say):
    // a real contact lies on the capsule's surface. Otherwise ask the hit
    // collider for the closest points at the hit location.
    const offSurface = Math.abs(
      size(sub(closestOnAxis(location, capsule, impactPoint), impactPoint)) -
        capsule.radius
    );
    if (offSurface > WITNESS_TOLERANCE_CM) {
      const contact = hit.collider.contactShape(
        shape,
        toR(location),
        UPRIGHT,
        WITNESS_TOLERANCE_CM
      );
      if (contact) {
        impactPoint = fromR(contact.point1);
        contactNormal = fromR(contact.normal1);
      }
    }
    // Rapier's normals may face either way; UE's face the shape.
    if (dot(contactNormal, sub(location, impactPoint)) < 0)
      contactNormal = scale(contactNormal, -1);
    const impactNormal = this.opposingFaceNormal(
      impactPoint,
      contactNormal,
      safeNormal(delta)
    );
    // FHitResult::Normal for a capsule sweep: from the contact toward the
    // capsule's axis (the capsule's own surface normal there).
    let normal = safeNormal(
      sub(closestOnAxis(location, capsule, impactPoint), impactPoint)
    );
    if (dot(normal, normal) === 0) normal = impactNormal;
    return {
      time,
      location,
      impactPoint,
      normal,
      impactNormal,
      startPenetrating: false,
      penetrationDepth: 0,
    };
  }

  /**
   * FHitResult::ImpactNormal for a sweep that touched the map at
   * `impactPoint`. Rapier gives the contact direction (`contactNormal`),
   * which on an edge or a corner is a blend of the faces meeting there; UE
   * (Chaos's FindMostOpposingFace) reports the face near the contact whose
   * normal most opposes the sweep direction `dir`. Two short rays find the
   * candidate faces: one along the sweep, just inside the contact (it meets
   * the face the sweep runs into), one straight down the contact normal (the
   * face under the contact). A flat-face hit gives the same answer either way.
   */
  private opposingFaceNormal(
    impactPoint: Vec3,
    contactNormal: Vec3,
    dir: Vec3
  ): Vec3 {
    const candidates: Vec3[] = [];
    const probe = (origin: Vec3, direction: Vec3, length: number): void => {
      const ray = new RAPIER.Ray(toR(origin), toR(direction));
      const hit = this.world.castRayAndGetNormal(ray, length, true);
      if (!hit) return;
      const normal = fromR(hit.normal);
      candidates.push(dot(normal, direction) > 0 ? scale(normal, -1) : normal);
    };
    if (dot(dir, dir) > 0) {
      const back = sub(
        sub(impactPoint, scale(contactNormal, FACE_PROBE_CM)),
        scale(dir, 2 * FACE_PROBE_CM)
      );
      probe(back, dir, 4 * FACE_PROBE_CM);
    }
    probe(
      add(impactPoint, scale(contactNormal, FACE_PROBE_CM)),
      scale(contactNormal, -1),
      3 * FACE_PROBE_CM
    );
    if (candidates.length === 0) return contactNormal;
    if (dot(dir, dir) === 0) return candidates[0];
    return candidates.reduce((best, n) =>
      dot(n, dir) < dot(best, dir) ? n : best
    );
  }

  /** The deepest overlap of `capsule` at `position`: the direction and
   * distance that move it out (the minimum translation distance), or null
   * if it overlaps nothing. */
  private penetration(
    position: Vec3,
    capsule: Capsule
  ): { normal: Vec3; depth: number; point: Vec3 } | null {
    const shape = this.shape(capsule);
    const at = toR(position);
    let best: { normal: Vec3; depth: number; point: Vec3 } | null = null;
    this.world.intersectionsWithShape(at, UPRIGHT, shape, (collider) => {
      const contact = collider.contactShape(shape, at, UPRIGHT, 0);
      if (contact && (!best || -contact.distance > best.depth)) {
        const point = fromR(contact.point1);
        // normal1 points out of the collider: the way to push the capsule.
        // A lone triangle has no inside, so face it toward the capsule.
        let normal = fromR(contact.normal1);
        const toCenter = sub(closestOnAxis(position, capsule, point), point);
        if (dot(normal, toCenter) < 0) normal = scale(normal, -1);
        best = { normal, depth: -contact.distance, point };
      }
      return true;
    });
    return best;
  }
}
