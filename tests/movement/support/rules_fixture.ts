/**
 * Loki's legs (the prototype's chassis) as the rules layer runs them, from
 * the exported data (WRFrontiersDB-Data `current/`): the movement type, the
 * level's Mobility and MaxSpeed, BP_Character's movement defaults, the
 * Jump Jet's air control, and a map's physics. Geometry is test fixtures
 * only (convex hulls), never map data.
 */
import fs from 'fs';
import path from 'path';
import { ExactCollisionWorld } from '../../../src/scripts/movement/collision/exact/world';
import {
  emptyColliderSet,
  type HullCollider,
} from '../../../src/scripts/movement/collision/exact/colliders';
import { parseChassis } from '../../../src/scripts/movement/data/chassis';
import { parseChassisLevel } from '../../../src/scripts/movement/data/chassis_level';
import { parseCharacterMovement } from '../../../src/scripts/movement/data/character';
import { parseJetpackAirControl } from '../../../src/scripts/movement/data/jump_ability';
import { parseMapPhysics } from '../../../src/scripts/movement/data/map_physics';
import { parseMovementType } from '../../../src/scripts/movement/data/movement_type';
import { vec, type Vec3 } from '../../../src/scripts/movement/math/vec';
import {
  blendForMobility,
  MovementProperties,
} from '../../../src/scripts/movement/rules/movement_properties';
import {
  ROBOT_CAPSULE,
  TunedCharacterMovement,
} from '../../../src/scripts/movement/rules/tuned_movement';
import { worldSetup } from '../../../src/scripts/movement/world_setup';

const OBJECTS = path.join(
  process.cwd(),
  'WRFrontiersDB-Data',
  'current',
  'Objects'
);
const cache = new Map<string, Record<string, unknown>>();
export function readTable(name: string): Record<string, unknown> {
  let table = cache.get(name);
  if (!table) {
    table = JSON.parse(
      fs.readFileSync(path.join(OBJECTS, `${name}.json`), 'utf-8')
    ) as Record<string, unknown>;
    cache.set(name, table);
  }
  return table;
}

export const LOKI = 'BP_Module_Loki_Chassis.0';
/** Any map: every map's GravityZ and TerminalVelocity are the same. */
const MAP = 'CrashSite';

/** Loki's provider at `level` (null: the highest, 13). */
export function lokiProperties(
  level: number | null = null,
  maxSpeedOverride?: number
): MovementProperties {
  const chassis = parseChassis(readTable('CharacterModule'), LOKI);
  const type = parseMovementType(
    readTable('MovementType'),
    chassis.movementTypeId
  );
  const lvl = parseChassisLevel(readTable('Module'), LOKI, level);
  return new MovementProperties(
    type,
    blendForMobility(type, lvl.mobility),
    maxSpeedOverride ?? lvl.maxSpeed
  );
}

/** The engine parameters BP_Character and the map's physics set. */
export function lokiParams() {
  const maps = readTable('Map') as Record<string, { physics?: unknown }>;
  return worldSetup(
    parseCharacterMovement(readTable('Character')),
    parseMapPhysics(maps[MAP]?.physics, MAP),
    MAP
  ).params;
}

/** Loki on a fixture world, walking at `location` (capsule centre). */
export function lokiOn(
  hulls: HullCollider[],
  location: Vec3,
  level: number | null = null
): TunedCharacterMovement {
  const world = new ExactCollisionWorld({ ...emptyColliderSet(), hulls });
  const c = new TunedCharacterMovement(
    world,
    { ...ROBOT_CAPSULE },
    location,
    {
      properties: lokiProperties(level),
      tierSource: { name: 'Tiers', value: '', source: 'finding', note: '' },
      airControl: parseJetpackAirControl(
        readTable('Ability'),
        readTable('CharacterModule'),
        LOKI
      ),
    },
    lokiParams()
  );
  c.teleport(location);
  return c;
}

// ---- Fixture geometry (UE cm, Z up) ----
type P = [number, number, number];

/** A convex solid from 8 corners: bottom 0-3 then top 4-7, counter-clockwise. */
function solid(corners: P[]): HullCollider {
  const faces = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
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
    body: { points: new Float64Array(corners.flat()), faces: faces.flat() },
    t: [0, 0, 0],
    q: [0, 0, 0, 1],
    s: [1, 1, 1],
    info: { source: 'fixture', flags: 0 },
  };
}

/** An axis-aligned box. */
export function box(min: P, max: P): HullCollider {
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

/** A ramp rising along +X from `x0` (height `z0`) to `x1` (height `z1`). */
export function ramp(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  base: number
): HullCollider {
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

/** A wall: a box `length` (along its yaw) x `thickness` x `height`, yawed
 * `yawDegrees` about Z around `center` (the bottom face's centre). */
export function wall(
  center: P,
  length: number,
  thickness: number,
  height: number,
  yawDegrees: number
): HullCollider {
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

/** A floor 1 km square at z 0. */
export const FLOOR = box([-100000, -100000, -1000], [100000, 100000, 0]);

/** The capsule centre resting on a floor at `floorZ` (half height plus
 * the floor hover band, MIN_FLOOR_DIST to MAX_FLOOR_DIST). */
export const restingZ = (floorZ: number): number =>
  floorZ + ROBOT_CAPSULE.halfHeight + 2.15;

/** Settle onto the floor without input. */
export function settle(c: TunedCharacterMovement, seconds = 0.5): void {
  for (let t = 0; t < seconds; t += 1 / 60)
    c.performMovement(1 / 60, vec(0, 0, 0));
}
