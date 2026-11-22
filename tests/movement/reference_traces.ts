/**
 * The engine port on the exact collision layer against UE 5.4.4 reference
 * traces (D10), under the tolerance policy (stages/mvp.md):
 *
 * | Class | What | Pass, every tick |
 * | A | free flight, falls, landing, flat floor, sub-stepping | 0.01 cm, 0.01 cm/s, same mode |
 * | B | every other contact, no internal triangle edge under the path | 1 cm, 1 cm/s, same mode |
 * | C | internal triangle edges, ties between shapes (D19), parallel-contact ties (D23) | reported, not gated |
 *
 * Box traces: UBoxComponent primitives (fixtures in reference/traces/box,
 * imported by scripts/movement/import_traces.ts). Mesh traces: the same
 * scenarios on UProceduralMeshComponent triangles (one-sided, UE-facing
 * winding); every box face is two triangles, so their paths cross internal
 * edges: class C, reported only. Session 2 builds the full suite.
 */
import { describe, expect, it } from 'vitest';
import { ExactCollisionWorld } from '../../src/scripts/movement/collision/exact/world';
import {
  emptyColliderSet,
  rotate,
} from '../../src/scripts/movement/collision/exact/colliders';
import {
  describeResult,
  loadTraces,
  replay,
  type Trace,
} from './support/reference_trace';

const say = (line: string): void => {
  process.stdout.write(line + '\n');
};

const CLASS: Record<string, 'A' | 'B' | 'C'> = {
  drop_10000_g10: 'A',
  drop_10000_g12: 'A',
  drop_10000_stockworld_g12: 'A',
  drop_400_start_falling: 'A',
  drop_600_start_falling: 'A',
  flat_accel_brake: 'A',
  hitch_substeps_fall: 'A',
  hitch_substeps_walk: 'A',
  ledge_400_step_down: 'B',
  ledge_walk_off: 'B',
  ramp_50_blocked: 'B',
  step_400_up: 'B',
  step_600_blocked: 'B',
  wall_45_slide: 'B',
  ramp_25_up_top_raised: 'B',
  ramp_25_up_top_lowered: 'B',
  // The crest is a tie between the ramp and platform boxes, 0.0075 cm
  // apart; UE's own result flips with a 0.01 cm change (D19).
  ramp_25_up: 'C',
};

const TOLERANCE = {
  A: { pos: 0.01, vel: 0.01 },
  B: { pos: 1, vel: 1 },
} as const;

/**
 * Class C ticks inside an otherwise gated scenario: parallel-contact ties
 * (decision D23), reported, not gated. Every other tick of the scenario is.
 */
const TIE_TICKS: Record<string, { ticks: number[]; why: string }> = {
  wall_45_slide: {
    ticks: [132],
    why:
      'parallel-contact tie: on a vertical wall every point of the capsule core is equally close; ' +
      "Chaos's float32 GJK returns an interior point (ImpactPoint.Z 752.0) where the layer reports the top end (802.15), " +
      'so UE passes StepUp one tick earlier; position 0.000 cm, velocity 1.04 cm/s on this tick',
  },
};

const boxWorld = (t: Trace) =>
  new ExactCollisionWorld({
    ...emptyColliderSet(),
    boxes: t.geometry.map((b) => ({
      center: b.center,
      rotation: b.quat,
      halfExtents: b.halfExtent,
      info: { source: b.name, flags: 0 },
    })),
  });

// The commandlet's procedural mesh (WrfMoveRefCommandlet.cpp AddMeshBox):
// 8 corners, 12 triangles, reversed for -geom=meshflip (UE-facing winding).
const CORNERS = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];
const FACES = [
  0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3,
  7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
];
const meshWorld = (t: Trace) =>
  new ExactCollisionWorld({
    ...emptyColliderSet(),
    meshes: t.geometry.map((b) => {
      const vertices: number[] = [];
      for (const [x, y, z] of CORNERS) {
        const r = rotate(
          b.quat,
          x * b.halfExtent[0],
          y * b.halfExtent[1],
          z * b.halfExtent[2]
        );
        vertices.push(
          b.center[0] + r[0],
          b.center[1] + r[1],
          b.center[2] + r[2]
        );
      }
      const triangles = FACES.slice();
      for (let i = 0; i < triangles.length; i += 3)
        [triangles[i + 1], triangles[i + 2]] = [
          triangles[i + 2],
          triangles[i + 1],
        ];
      return {
        vertices,
        triangles,
        t: [0, 0, 0],
        q: [0, 0, 0, 1],
        s: [1, 1, 1],
        doubleSided: false,
        info: { source: b.name, flags: 0 },
      };
    }),
  });

describe('UE box traces on the exact collision layer', () => {
  const traces = loadTraces('box');

  it('covers every box scenario with a class', () => {
    expect(traces.map((t) => t.scenario).sort()).toEqual(
      Object.keys(CLASS).sort()
    );
  });

  for (const trace of traces) {
    const cls = CLASS[trace.scenario];
    if (cls === 'C') {
      it(`${trace.scenario} (class C, reported)`, () => {
        const r = replay(trace, boxWorld(trace));
        say(`[class C] ${describeResult(r)}`);
        expect(r.ticks).toBe(trace.ticks.filter((k) => k.i >= 0).length);
      });
      continue;
    }
    it(`${trace.scenario} (class ${cls})`, () => {
      const r = replay(trace, boxWorld(trace));
      const tol = TOLERANCE[cls];
      const tie = TIE_TICKS[trace.scenario];
      for (const k of r.perTick) {
        expect(k.modeOk, `tick ${k.i}: movement mode`).toBe(true);
        expect(k.moveDtOk, `tick ${k.i}: frame clamp (moveDt)`).toBe(true);
        expect(k.substepsOk, `tick ${k.i}: sub-step split`).toBe(true);
        expect(k.dp, `tick ${k.i}: position (cm)`).toBeLessThanOrEqual(tol.pos);
        if (tie?.ticks.includes(k.i)) {
          if (k.dv > tol.vel)
            say(
              `[class C tie] ${trace.scenario} tick ${k.i}: velocity ${k.dv.toFixed(4)} cm/s; ${tie.why}`
            );
          continue;
        }
        expect(k.dv, `tick ${k.i}: velocity (cm/s)`).toBeLessThanOrEqual(
          tol.vel
        );
      }
    });
  }
});

describe('UE triangle-mesh traces on the exact collision layer (class C, reported)', () => {
  for (const trace of loadTraces('mesh')) {
    it(trace.scenario, () => {
      const r = replay(trace, meshWorld(trace));
      say(`[class C, mesh] ${describeResult(r)}`);
      expect(Number.isFinite(r.maxPos)).toBe(true);
    });
  }
});
