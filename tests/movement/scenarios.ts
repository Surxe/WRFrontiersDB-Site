/**
 * The prototype's movement done-criteria, checked against the ported stock
 * engine on the real Rapier backend: it lands, walks, climbs steps and
 * ramps, stops at walls, slides along them, and falls off ledges. Stock UE
 * defaults throughout (capsule 34 x 88, MaxStepHeight 45, walkable 44.8
 * degrees), so the expectations are UE's own behaviour.
 */
import { describe, expect, it } from 'vitest';
import { RapierCollisionWorld } from '../../src/scripts/movement/collision/rapier';
import type { TrianglePiece } from '../../src/scripts/movement/collision/triangles';
import { CharacterMovementComponent } from '../../src/scripts/movement/engine/character_movement';
import {
  size2D,
  vec,
  ZERO,
  type Vec3,
} from '../../src/scripts/movement/math/vec';

// ---- Test geometry (fixtures only: the simulator never has map geometry
// in code). Closed solids as triangle pieces, UE cm, Z up. ----
type P = [number, number, number];

/** A closed solid from 8 corners: bottom 0-3 then top 4-7, counter-clockwise. */
function solid(corners: P[]): TrianglePiece {
  const faces = [
    [0, 2, 1],
    [0, 3, 2], // bottom
    [4, 5, 6],
    [4, 6, 7], // top
    [0, 1, 5],
    [0, 5, 4],
    [1, 2, 6],
    [1, 6, 5],
    [2, 3, 7],
    [2, 7, 6],
    [3, 0, 4],
    [3, 4, 7],
  ];
  return {
    positions: new Float32Array(corners.flat()),
    indices: new Uint32Array(faces.flat()),
  };
}

/** An axis-aligned box from `min` to `max`. */
export function box(min: P, max: P): TrianglePiece {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  return solid([
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  ]);
}

/** A ramp rising along +X from `x0` (height `z0`) to `x1` (height `z1`),
 * across `y0..y1`, solid down to `base`. */
export function ramp(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  base: number
): TrianglePiece {
  return solid([
    [x0, y0, base],
    [x1, y0, base],
    [x1, y1, base],
    [x0, y1, base],
    [x0, y0, z0],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z0],
  ]);
}

/** A wall: a box rotated `yawDegrees` about Z around its center. */
export function wall(
  center: P,
  length: number,
  thickness: number,
  height: number,
  yawDegrees: number
): TrianglePiece {
  const yaw = (yawDegrees * Math.PI) / 180;
  const ax: P = [Math.cos(yaw), Math.sin(yaw), 0];
  const ay: P = [-Math.sin(yaw), Math.cos(yaw), 0];
  const corner = (sx: number, sy: number, z: number): P => [
    center[0] + (ax[0] * sx * length) / 2 + (ay[0] * sy * thickness) / 2,
    center[1] + (ax[1] * sx * length) / 2 + (ay[1] * sy * thickness) / 2,
    z,
  ];
  const z0 = center[2];
  const z1 = center[2] + height;
  return solid([
    corner(-1, -1, z0),
    corner(1, -1, z0),
    corner(1, 1, z0),
    corner(-1, 1, z0),
    corner(-1, -1, z1),
    corner(1, -1, z1),
    corner(1, 1, z1),
    corner(-1, 1, z1),
  ]);
}

// ---- Scenarios ----

const CAPSULE = { radius: 34, halfHeight: 88 };
const STEP = 1 / 60;
const FORWARD = vec(1, 0, 0);
/** Where the capsule's center rests on a floor at z: its half height plus
 * the hover band (MIN_FLOOR_DIST to MAX_FLOOR_DIST). */
const restingZ = (floorZ: number): number => floorZ + CAPSULE.halfHeight + 2.15;

const FLOOR = box([-5000, -5000, -100], [5000, 5000, 0]);

async function setup(
  pieces: TrianglePiece[],
  start: Vec3
): Promise<CharacterMovementComponent> {
  const world = await RapierCollisionWorld.create();
  for (const piece of pieces) world.addPiece(piece);
  world.finishBuild();
  const c = new CharacterMovementComponent(world, CAPSULE, start);
  c.teleport(start);
  return c;
}

function run(
  c: CharacterMovementComponent,
  seconds: number,
  input: Vec3
): void {
  for (let t = 0; t < seconds; t += STEP) c.performMovement(STEP, input);
}

describe('movement scenarios (stock UE engine on Rapier)', () => {
  it('falls onto a floor and walks', async () => {
    const c = await setup([FLOOR], vec(0, 0, 300));
    run(c, 1.5, ZERO);
    expect(c.movementMode).toBe('walking');
    expect(c.location.z).toBeGreaterThan(restingZ(0) - 0.4);
    expect(c.location.z).toBeLessThan(restingZ(0) + 0.4);
    expect(c.currentFloor.hitResult.impactNormal.z).toBeCloseTo(1, 3);
  });

  it('accelerates to MaxWalkSpeed and brakes to a stop', async () => {
    const c = await setup([FLOOR], vec(0, 0, restingZ(0)));
    run(c, 2, FORWARD);
    expect(size2D(c.velocity)).toBeCloseTo(c.params.maxWalkSpeed, 0);
    run(c, 1, ZERO);
    expect(size2D(c.velocity)).toBe(0);
  });

  it('steps up a step lower than MaxStepHeight', async () => {
    const c = await setup(
      [FLOOR, box([200, -500, 0], [2000, 500, 30])],
      vec(0, 0, restingZ(0))
    );
    run(c, 2, FORWARD);
    expect(c.location.x).toBeGreaterThan(400);
    expect(c.location.z).toBeCloseTo(restingZ(30), 0);
    expect(c.movementMode).toBe('walking');
  });

  it('is stopped by a step higher than MaxStepHeight', async () => {
    const c = await setup(
      [FLOOR, box([200, -500, 0], [2000, 500, 60])],
      vec(0, 0, restingZ(0))
    );
    run(c, 2, FORWARD);
    expect(c.location.x).toBeLessThan(200 - CAPSULE.radius + 1);
    expect(c.location.z).toBeCloseTo(restingZ(0), 0);
  });

  it('walks up a walkable ramp', async () => {
    // 25 degrees, under the 44.8 degree walkable limit.
    const rise = Math.tan((25 * Math.PI) / 180) * 1500;
    const c = await setup(
      [FLOOR, ramp(200, 1700, -500, 500, 0, rise, -100)],
      vec(0, 0, restingZ(0))
    );
    run(c, 2, FORWARD);
    expect(c.movementMode).toBe('walking');
    expect(c.location.x).toBeGreaterThan(600);
    // On the slope: as high as the ramp is under the capsule's center
    // (give or take its radius, where the lower hemisphere touches).
    const surfaceZ = ((c.location.x - 200) / 1500) * rise;
    expect(c.location.z).toBeGreaterThan(restingZ(surfaceZ) - 20);
  });

  it('cannot walk up an unwalkable ramp', async () => {
    const rise = Math.tan((60 * Math.PI) / 180) * 1000;
    const c = await setup(
      [FLOOR, ramp(200, 1200, -500, 500, 0, rise, -100)],
      vec(0, 0, restingZ(0))
    );
    run(c, 2, FORWARD);
    expect(c.location.z).toBeLessThan(restingZ(0) + 45);
    expect(c.location.x).toBeLessThan(260);
  });

  it('stops at a wall it walks straight into', async () => {
    const c = await setup(
      [FLOOR, wall([300, 0, 0], 2000, 40, 400, 90)],
      vec(0, 0, restingZ(0))
    );
    run(c, 2, FORWARD);
    expect(c.location.x).toBeLessThan(300 - 20 - CAPSULE.radius + 0.5);
    expect(c.location.x).toBeGreaterThan(300 - 20 - CAPSULE.radius - 2);
    expect(Math.abs(c.location.y)).toBeLessThan(1);
    expect(size2D(c.velocity)).toBeLessThan(1);
  });

  it('slides along a wall hit at an angle', async () => {
    // Wall along the line y = x - 300, so walking +X meets it at 45 degrees.
    const c = await setup(
      [FLOOR, wall([300, 0, 0], 3000, 40, 400, 45)],
      vec(0, 0, restingZ(0))
    );
    run(c, 2, FORWARD);
    expect(c.location.y).toBeGreaterThan(200);
    expect(c.location.x).toBeGreaterThan(300);
    // Still against the wall, moving along it.
    expect(size2D(c.velocity)).toBeGreaterThan(300);
  });

  it('falls off a ledge and lands below', async () => {
    const platform = box([-3000, -3000, 0], [200, 3000, 300]);
    const c = await setup([FLOOR, platform], vec(0, 0, restingZ(300)));
    let fell = false;
    for (let t = 0; t < 3; t += STEP) {
      c.performMovement(STEP, FORWARD);
      if (c.movementMode === 'falling') fell = true;
    }
    expect(fell).toBe(true);
    expect(c.movementMode).toBe('walking');
    expect(c.location.x).toBeGreaterThan(200 + CAPSULE.radius);
    expect(c.location.z).toBeCloseTo(restingZ(0), 0);
  });
});
