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
import { vec } from '../../../src/scripts/movement/math/vec';

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
  moveDt: number;
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
  /** Per tick: tick index, position and velocity difference, mode match. */
  perTick: { i: number; dp: number; dv: number; modeOk: boolean }[];
}

/** Replay `trace` on `world` (which must hold the trace's geometry). */
export function replay(trace: Trace, world: CollisionWorld): ReplayResult {
  const p = trace.params;
  const num = (k: string) => p[k] as number;
  const start = vec(...trace.start.location);
  const c = new CharacterMovementComponent(
    world,
    { radius: num('capsuleRadius'), halfHeight: num('capsuleHalfHeight') },
    start,
    {
      gravityZ: trace.world.gravityZ * num('gravityScale'),
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
    c.performMovement(k.moveDt, vec(...k.input));
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
