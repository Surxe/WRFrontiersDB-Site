/**
 * The engine port on the exact collision layer against UE 5.4.4 reference
 * traces (D10), under the tolerance policy (stages/mvp.md):
 *
 * | Class | What | Pass, every tick |
 * | A | free flight, falls, landing, flat floor, sub-stepping | 0.01 cm, 0.01 cm/s, same mode |
 * | B | every other contact, no internal triangle edge under the path | 1 cm, 1 cm/s, same mode |
 * | C | internal triangle edges, ties between shapes (D19), parallel-contact ties (D23) | reported, not gated |
 *
 * Since MVP session 4.5 (D26: Chaos's float32 sweep decides every hit,
 * findings/chaos-sweeps.md) no trace needs class C: the seam tie, the
 * triangle-mesh traces' internal edges, the pillar's vertical edge and the
 * landscape hole's rim are reproduced, most of them bit for bit.
 *
 * Three fixture sets (reference/traces/, imported by
 * scripts/movement/import_traces.ts from /srv/dev/repos/wrf-movement-ref):
 * - box: UBoxComponent primitives, gated by class A and B;
 * - mesh: the same scenarios on UProceduralMeshComponent triangles
 *   (double-sided: the component forces bDoubleSidedGeometry), gated by
 *   the same classes (class C before session 4.5: UE's 18 cm pop on the
 *   ground's 4 km triangles is Chaos's float error, now reproduced);
 * - shapes (session 2, -set=shapes): spheres, cooked convex hulls,
 *   one-sided meshes (a quad wall both ways, and Horizon's lake with the
 *   export's winding), a landscape heightfield with a hole, two-wall
 *   corners, perch radii, penetration recovery and frames over the 0.4 s
 *   clamp; gated by class, with class C from the first tie or edge tick.
 *
 * Every gated tick also checks the world's frame clamp and the sub-step
 * split (count and phases exact; times within 1e-6 s in class A, 1e-3 s
 * in class B). The test run never needs UE.
 */
import { describe, expect, it } from 'vitest';
import {
  describeResult,
  loadTraces,
  meshWorld,
  replay,
  SUBSTEP_TOLERANCE_S,
  traceWorld,
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
  // The crest ties the ramp and platform boxes (D19): Chaos's float
  // distances and SQVisitor's co-located face rule decide it as UE does
  // (class C before session 4.5).
  ramp_25_up: 'B',
};

const TOLERANCE = {
  A: { pos: 0.01, vel: 0.01 },
  B: { pos: 1, vel: 1 },
} as const;

/**
 * Class C ticks inside an otherwise gated scenario, reported, not gated.
 * Every other tick of the scenario is. None left: wall_45_slide tick 132
 * (a parallel contact, D23) is gated since the layer takes Chaos's impact
 * point there (session 3.5, findings/chaos-contact-point.md).
 */
const TIE_TICKS: Record<string, { ticks: number[]; why: string }> = {};

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
        const r = replay(trace, traceWorld(trace));
        say(`[class C] ${describeResult(r)}`);
        expect(r.ticks).toBe(trace.ticks.filter((k) => k.i >= 0).length);
      });
      continue;
    }
    it(`${trace.scenario} (class ${cls})`, () => {
      const r = replay(trace, traceWorld(trace), SUBSTEP_TOLERANCE_S[cls]);
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

describe('UE triangle-mesh traces on the exact collision layer', () => {
  for (const trace of loadTraces('mesh')) {
    const cls = CLASS[trace.scenario];
    if (cls === 'C') continue;
    it(`${trace.scenario} (mesh, class ${cls})`, () => {
      const r = replay(trace, meshWorld(trace), SUBSTEP_TOLERANCE_S[cls]);
      const tol = TOLERANCE[cls];
      for (const k of r.perTick) {
        expect(k.modeOk, `tick ${k.i}: movement mode`).toBe(true);
        expect(k.moveDtOk, `tick ${k.i}: frame clamp (moveDt)`).toBe(true);
        expect(k.substepsOk, `tick ${k.i}: sub-step split`).toBe(true);
        expect(k.dp, `tick ${k.i}: position (cm)`).toBeLessThanOrEqual(tol.pos);
        expect(k.dv, `tick ${k.i}: velocity (cm/s)`).toBeLessThanOrEqual(
          tol.vel
        );
      }
      say(`[mesh, class ${cls}] ${describeResult(r)}`);
    });
  }
});

/**
 * Session 2's UE traces (-set=shapes): spheres, cooked convex hulls,
 * one-sided triangle meshes (a quad wall and a game mesh with its exported
 * winding), a landscape heightfield with a hole, two-wall corners, perch
 * radii, penetration recovery and frames over the 0.4 s clamp.
 */
const SHAPE_CLASS: Record<string, 'A' | 'B'> = {
  hitch_fall_long_frames: 'A',
  sphere_walk_around: 'B',
  sphere_land_walk_off: 'B',
  hull_ramp_crest_drop: 'B',
  hull_step_up_yawed: 'B',
  hull_pillar_slide: 'B',
  mesh_onesided_front: 'B',
  mesh_onesided_behind: 'B',
  game_mesh_lake_land_walk_off: 'B',
  landscape_slope_hole: 'B',
  corner_90: 'B',
  corner_60_v: 'B',
  ledge_walk_off_perch_0: 'B',
  ledge_walk_off_perch_200: 'B',
  ledge_walk_off_perch_550: 'B',
  ledge_walk_off_perch_400_add_40: 'B',
  penetration_wall_50: 'B',
  penetration_wall_700: 'B',
  penetration_wall_900: 'B',
  penetration_floor_falling: 'B',
  // Session 4.5 (D27): the capsule turning to face its movement (stock
  // PhysicsRotation) against rolled and pitched walls; the replay feeds
  // each tick the component quaternion UE logged after the previous one.
  orient_wall_rolled: 'B',
  orient_wall_pitched: 'B',
};

/**
 * Class C from a tick on: the scenario is gated (its class) before it and
 * reported after it, since every later tick inherits the difference.
 * Parallel contacts on faces (hull_pillar_slide from 131, mesh_onesided_front
 * from 142, corner_90 from 159, corner_60_v from 146) are gated since the
 * layer takes Chaos's impact point (findings/chaos-contact-point.md).
 */
const C_FROM: Record<string, { tick: number; why: string }> = {
  // None since session 4.5: hull_pillar_slide from tick 181 (the vertical
  // edge) and landscape_slope_hole from tick 138 (the hole's rim) are
  // reproduced bit for bit with every sweep through Chaos float (D26) and
  // the engine's float locals (findings/chaos-sweeps.md).
};

describe('UE shape traces on the exact collision layer (spheres, hulls, meshes, landscape, corners, perch, penetration, long frames)', () => {
  const traces = loadTraces('shapes');

  it('covers every shape scenario with a class', () => {
    expect(traces.map((t) => t.scenario).sort()).toEqual(
      Object.keys(SHAPE_CLASS).sort()
    );
  });

  for (const trace of traces) {
    const cls = SHAPE_CLASS[trace.scenario];
    const from = C_FROM[trace.scenario];
    it(`${trace.scenario} (class ${cls}${from ? `, class C from tick ${from.tick}` : ''})`, () => {
      const r = replay(trace, traceWorld(trace), SUBSTEP_TOLERANCE_S[cls]);
      const tol = TOLERANCE[cls];
      for (const k of r.perTick) {
        if (from && k.i >= from.tick) continue;
        expect(k.modeOk, `tick ${k.i}: movement mode`).toBe(true);
        expect(k.moveDtOk, `tick ${k.i}: frame clamp (moveDt)`).toBe(true);
        expect(k.substepsOk, `tick ${k.i}: sub-step split`).toBe(true);
        expect(k.dp, `tick ${k.i}: position (cm)`).toBeLessThanOrEqual(tol.pos);
        expect(k.dv, `tick ${k.i}: velocity (cm/s)`).toBeLessThanOrEqual(
          tol.vel
        );
      }
      if (from) {
        const after = r.perTick.filter((k) => k.i >= from.tick);
        const dp = Math.max(...after.map((k) => k.dp));
        const dv = Math.max(...after.map((k) => k.dv));
        const modes = after.filter((k) => !k.modeOk).length;
        say(
          `[class C from tick ${from.tick}] ${trace.scenario}: max dpos ${dp.toFixed(4)} cm, max dvel ${dv.toFixed(4)} cm/s, ` +
            `mode mismatches ${modes}; ${from.why}`
        );
      }
    });
  }
});
