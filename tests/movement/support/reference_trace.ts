/**
 * Replays a UE 5.4.4 reference trace (wrf-move-ref/1, recorded headless by
 * /srv/dev/repos/wrf-movement-ref, D10) through the engine port on a given
 * collision world, tick by tick with the trace's input and dt, and measures
 * the difference (stages/mvp.md, tolerance policy). Ported from the
 * mvp-prep replay (wrf-movement-ref/compare/trace_port.mts).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { CollisionWorld } from '../../../src/scripts/movement/collision/world';
import { CharacterMovementComponent } from '../../../src/scripts/movement/engine/character_movement';
import { fixupDeltaSeconds } from '../../../src/scripts/movement/engine/world_tick';
import { vec, type Vec3 } from '../../../src/scripts/movement/math/vec';

export type V3 = [number, number, number];

export interface TraceBox {
  name: string;
  shape: 'box';
  center: V3;
  halfExtent: V3;
  quat: [number, number, number, number];
}

interface Tick {
  i: number;
  /** What the commandlet passed to UWorld::Tick. */
  dt: number;
  /** What PerformMovement received (after the world's clamp). */
  moveDt: number;
  /** Each CalcVelocity (walk) or NewFallVelocity (fall) time step. */
  substeps: [string, number][];
  input: V3;
  loc: V3;
  vel: V3;
  mode: string;
}

export interface Trace {
  scenario: string;
  collision: string;
  world: { gravityZ: number; terminalVelocity: number };
  params: Record<string, number | boolean>;
  geometry: TraceBox[];
  start: { location: V3; forceFalling: boolean };
  ticks: Tick[];
}

export const TRACE_DIR = path.resolve(
  import.meta.dirname,
  '../reference/traces'
);

export function loadTraces(set: string): Trace[] {
  const dir = path.join(TRACE_DIR, set);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Trace);
}

const MODE: Record<string, string> = {
  MOVE_Walking: 'walking',
  MOVE_Falling: 'falling',
  MOVE_None: 'none',
};

export interface ReplayResult {
  scenario: string;
  /** Worst position difference, cm, and its tick. */
  maxPos: number;
  maxPosTick: number;
  /** Worst velocity difference, cm/s, and its tick. */
  maxVel: number;
  maxVelTick: number;
  modeMismatches: number;
  firstModeMismatch: number;
  ticks: number;
  /** Per tick: tick index, position and velocity difference, mode match,
   * and whether the frame clamp and the sub-step split match UE's. */
  perTick: {
    i: number;
    dp: number;
    dv: number;
    modeOk: boolean;
    moveDtOk: boolean;
    substepsOk: boolean;
    /** Both sub-step lists when they differ. */
    substeps?: { ue: [string, number][]; port: [string, number][] };
  }[];
}

/**
 * The engine port with the commandlet's observation hooks
 * (ProbeMovement.cpp): the time step of each CalcVelocity while walking
 * and of each NewFallVelocity.
 */
class ProbedMovement extends CharacterMovementComponent {
  substeps: [string, number][] = [];

  override calcVelocity(
    deltaTime: number,
    friction: number,
    fluid: boolean,
    brakingDeceleration: number
  ): void {
    if (this.movementMode === 'walking')
      this.substeps.push(['walk', deltaTime]);
    super.calcVelocity(deltaTime, friction, fluid, brakingDeceleration);
  }

  override newFallVelocity(
    initialVelocity: Vec3,
    gravity: Vec3,
    deltaTime: number
  ): Vec3 {
    this.substeps.push(['fall', deltaTime]);
    return super.newFallVelocity(initialVelocity, gravity, deltaTime);
  }
}

/**
 * Same sub-steps: the same count and phases, each time within 1e-6 s. The
 * split itself is exact in float; a sub-step that follows a hit (the time
 * left after landing) carries the hit time, which Chaos computes in float32
 * (2.6e-8 s apart from the exact layer seen on landings). 1e-6 s at top
 * speed (3222 cm/s) is 0.003 cm, inside class A's 0.01 cm.
 */
export const SUBSTEP_TOLERANCE_S = 1e-6;
const sameSubsteps = (a: [string, number][], b: [string, number][]): boolean =>
  a.length === b.length &&
  a.every(
    ([phase, dt], k) =>
      phase === b[k][0] && Math.abs(dt - b[k][1]) <= SUBSTEP_TOLERANCE_S
  );

/** Replay `trace` on `world` (which must hold the trace's geometry). */
export function replay(trace: Trace, world: CollisionWorld): ReplayResult {
  const p = trace.params;
  const num = (k: string) => p[k] as number;
  const start = vec(...trace.start.location);
  const c = new ProbedMovement(
    world,
    { radius: num('capsuleRadius'), halfHeight: num('capsuleHalfHeight') },
    start,
    {
      gravityZ: trace.world.gravityZ,
      gravityScale: num('gravityScale'),
      terminalVelocity: trace.world.terminalVelocity,
      maxWalkSpeed: num('maxWalkSpeed'),
      maxAcceleration: num('maxAcceleration'),
      groundFriction: num('groundFriction'),
      brakingFrictionFactor: num('brakingFrictionFactor'),
      brakingDecelerationWalking: num('brakingDecelerationWalking'),
      brakingDecelerationFalling: num('brakingDecelerationFalling'),
      airControl: num('airControl'),
      airControlBoostMultiplier: num('airControlBoostMultiplier'),
      airControlBoostVelocityThreshold: num('airControlBoostVelocityThreshold'),
      fallingLateralFriction: num('fallingLateralFriction'),
      maxStepHeight: num('maxStepHeight'),
      walkableFloorZ: num('walkableFloorZ'),
      perchRadiusThreshold: num('perchRadiusThreshold'),
      perchAdditionalHeight: num('perchAdditionalHeight'),
      maxSimulationTimeStep: num('maxSimulationTimeStep'),
      maxSimulationIterations: num('maxSimulationIterations'),
      maintainHorizontalGroundVelocity:
        p.maintainHorizontalGroundVelocity as boolean,
    }
  );
  // UE: spawn, then SetDefaultMovementMode (walking if a floor is in reach)
  // unless the scenario forces falling.
  c.teleport(start);
  if (!trace.start.forceFalling && trace.ticks[0].mode === 'MOVE_Walking')
    c.setMovementMode('walking');

  const result: ReplayResult = {
    scenario: trace.scenario,
    maxPos: 0,
    maxPosTick: -1,
    maxVel: 0,
    maxVelTick: -1,
    modeMismatches: 0,
    firstModeMismatch: -1,
    ticks: 0,
    perTick: [],
  };
  for (const k of trace.ticks) {
    if (k.i < 0) continue;
    // The world's frame clamp, then the movement update.
    const moveDt = fixupDeltaSeconds(k.dt);
    c.substeps = [];
    c.performMovement(moveDt, vec(...k.input));
    const dp = Math.hypot(
      c.location.x - k.loc[0],
      c.location.y - k.loc[1],
      c.location.z - k.loc[2]
    );
    const dv = Math.hypot(
      c.velocity.x - k.vel[0],
      c.velocity.y - k.vel[1],
      c.velocity.z - k.vel[2]
    );
    if (dp > result.maxPos) {
      result.maxPos = dp;
      result.maxPosTick = k.i;
    }
    if (dv > result.maxVel) {
      result.maxVel = dv;
      result.maxVelTick = k.i;
    }
    result.perTick.push({
      i: k.i,
      dp,
      dv,
      modeOk: MODE[k.mode] === c.movementMode,
      moveDtOk: moveDt === k.moveDt,
      substepsOk: sameSubsteps(c.substeps, k.substeps),
      ...(sameSubsteps(c.substeps, k.substeps)
        ? {}
        : { substeps: { ue: k.substeps, port: c.substeps } }),
    });
    if (MODE[k.mode] !== c.movementMode) {
      result.modeMismatches++;
      if (result.firstModeMismatch < 0) result.firstModeMismatch = k.i;
    }
    result.ticks++;
  }
  return result;
}

export const describeResult = (r: ReplayResult): string =>
  `${r.scenario}: max dpos ${r.maxPos.toFixed(4)} cm (tick ${r.maxPosTick}), ` +
  `max dvel ${r.maxVel.toFixed(4)} cm/s (tick ${r.maxVelTick}), ` +
  `mode mismatches ${r.modeMismatches} (first ${r.firstModeMismatch})`;
