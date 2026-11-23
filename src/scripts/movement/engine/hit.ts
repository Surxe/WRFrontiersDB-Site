/**
 * FHitResult and FFindFloorResult: the subset of fields character movement
 * reads, mutable as in UE (the engine passes them as out-parameters).
 */
import { ZERO, type Vec3 } from '../math/vec';
import type { QueryHit } from '../collision/world';

export class HitResult {
  blockingHit = false;
  startPenetrating = false;
  time = 1;
  location: Vec3 = ZERO;
  impactPoint: Vec3 = ZERO;
  normal: Vec3 = ZERO;
  impactNormal: Vec3 = ZERO;
  traceStart: Vec3 = ZERO;
  traceEnd: Vec3 = ZERO;
  penetrationDepth = 0;

  /** FHitResult(float InTime): no hit, at `time`. */
  constructor(time = 1) {
    this.time = time;
  }

  /** FHitResult::Reset. */
  reset(time = 1, preserveTraceData = true): void {
    const { traceStart, traceEnd } = this;
    Object.assign(this, new HitResult(time));
    if (preserveTraceData) {
      this.traceStart = traceStart;
      this.traceEnd = traceEnd;
    }
  }

  /** FHitResult::IsValidBlockingHit. */
  isValidBlockingHit(): boolean {
    return this.blockingHit && !this.startPenetrating;
  }

  copyFrom(other: HitResult): void {
    Object.assign(this, other);
  }

  clone(): HitResult {
    const copy = new HitResult();
    copy.copyFrom(this);
    return copy;
  }

  /** Fill from a scene query (`hit` null: the trace ran its full length). */
  static fromQuery(hit: QueryHit | null, start: Vec3, end: Vec3): HitResult {
    const result = new HitResult(1);
    result.traceStart = start;
    result.traceEnd = end;
    result.location = end;
    if (!hit) return result;
    result.blockingHit = true;
    result.time = hit.time;
    result.location = hit.location;
    result.impactPoint = hit.impactPoint;
    result.normal = hit.normal;
    result.impactNormal = hit.impactNormal;
    result.startPenetrating = hit.startPenetrating;
    result.penetrationDepth = hit.penetrationDepth;
    return result;
  }
}

export class FindFloorResult {
  blockingHit = false;
  walkableFloor = false;
  lineTrace = false;
  floorDist = 0;
  lineDist = 0;
  hitResult = new HitResult(1);

  clear(): void {
    this.blockingHit = false;
    this.walkableFloor = false;
    this.lineTrace = false;
    this.floorDist = 0;
    this.lineDist = 0;
    this.hitResult.reset(1, false);
  }

  isWalkableFloor(): boolean {
    return this.blockingHit && this.walkableFloor;
  }

  /** FFindFloorResult::GetDistanceToFloor. */
  getDistanceToFloor(): number {
    return this.lineTrace ? this.lineDist : this.floorDist;
  }

  setFromSweep(
    hit: HitResult,
    sweepFloorDist: number,
    isWalkableFloor: boolean
  ): void {
    this.blockingHit = hit.isValidBlockingHit();
    this.walkableFloor = isWalkableFloor;
    this.lineTrace = false;
    this.floorDist = Math.fround(sweepFloorDist); // float FloorDist
    this.lineDist = 0;
    this.hitResult = hit.clone();
  }

  setFromLineTrace(
    hit: HitResult,
    sweepFloorDist: number,
    lineDist: number,
    isWalkableFloor: boolean
  ): void {
    // UE requires a sweep that hit before a line result is used.
    if (!this.hitResult.blockingHit || !hit.blockingHit) return;
    const old = this.hitResult;
    const merged = hit.clone();
    merged.time = old.time;
    merged.impactPoint = old.impactPoint;
    merged.location = old.location;
    merged.traceStart = old.traceStart;
    merged.traceEnd = old.traceEnd;
    this.hitResult = merged;
    this.lineTrace = true;
    this.floorDist = Math.fround(sweepFloorDist);
    this.lineDist = Math.fround(lineDist);
    this.walkableFloor = isWalkableFloor;
  }

  copyFrom(other: FindFloorResult): void {
    this.blockingHit = other.blockingHit;
    this.walkableFloor = other.walkableFloor;
    this.lineTrace = other.lineTrace;
    this.floorDist = other.floorDist;
    this.lineDist = other.lineDist;
    this.hitResult = other.hitResult.clone();
  }

  clone(): FindFloorResult {
    const copy = new FindFloorResult();
    copy.copyFrom(this);
    return copy;
  }
}
