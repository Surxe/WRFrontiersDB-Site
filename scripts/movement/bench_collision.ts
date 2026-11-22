/**
 * Build and query cost of the exact collision layer on a map's collision
 * export, in Node (no browser): load `Maps/<Map>.collision.bin` as drive
 * mode does, build ExactCollisionWorld, then drive the movement session
 * with bench:drive's back-to-back pattern (forward, view yaw +0.25 degrees
 * per update, 3600 updates at 1/60 s then at 1/30 s; Loki, capsule
 * 600 / 700). `--containment` instead drives straight from a spawn in 8
 * headings and checks the robot stays in the playable box.
 *
 *   npm run bench:collision -- [--map CrashSite|all] [--mode <id>] [--lighting <part>]
 *                              [--steps 3600] [--containment] [--seconds 90]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parseCollisionFile } from '../../src/scripts/movement/data/collision_file';
import { collidersFromFile } from '../../src/scripts/movement/collision/export_loader';
import { ExactCollisionWorld } from '../../src/scripts/movement/collision/exact/world';
import { MovementSession } from '../../src/scripts/movement/session';
import {
  PROTOTYPE_CHASSIS,
  optionValues,
  readDriveOptions,
} from '../../src/scripts/map_viewer/drive/options';
import { startPoint } from '../../src/scripts/movement/start_point';

const say = (line: string): void => {
  process.stdout.write(line + '\n');
};

const { values } = parseArgs({
  options: {
    data: {
      type: 'string',
      default: path.resolve(
        import.meta.dirname,
        '../../public/WRFrontiersDB-Data/current'
      ),
    },
    map: { type: 'string', default: 'CrashSite' },
    mode: { type: 'string' },
    lighting: { type: 'string' },
    steps: { type: 'string', default: '3600' },
    containment: { type: 'boolean', default: false },
    seconds: { type: 'string', default: '90' },
  },
});

const objects = (name: string) =>
  JSON.parse(
    readFileSync(path.join(values.data!, 'Objects', `${name}.json`), 'utf8')
  );
const mapTable = objects('Map') as Record<
  string,
  { files: { collision: string; pins: string } }
>;
const tables = {
  movementTypes: objects('MovementType'),
  characterModules: objects('CharacterModule'),
  modules: objects('Module'),
};

const stat = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  return `${mean.toFixed(3)} / ${s[Math.floor(s.length * 0.95)].toFixed(3)} / ${s[s.length - 1].toFixed(3)}`;
};

function benchMap(map: string): void {
  const entry = mapTable[map];
  if (!entry) throw new Error(`no map ${map} in Map.json`);
  const pins = JSON.parse(
    readFileSync(path.join(values.data!, entry.files.pins), 'utf8')
  );
  const heapBefore = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  const bytes = readFileSync(path.join(values.data!, entry.files.collision));
  const file = parseCollisionFile(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );
  const loaded = collidersFromFile(file, {
    mode: values.mode ?? Object.keys(file.modes)[0] ?? null,
    lighting: values.lighting ?? null,
  });
  const t1 = performance.now();
  const world = new ExactCollisionWorld(loaded.set);
  const t2 = performance.now();
  const b = world.buildStats();
  const heap = (process.memoryUsage().heapUsed - heapBefore) / 1e6;
  say(
    `${map}: mode ${loaded.selection.mode ?? '-'}, lighting ${loaded.selection.lighting ?? '-'}; ` +
      `read ${(t1 - t0).toFixed(0)} ms, build ${(t2 - t1).toFixed(0)} ms; ` +
      `boxes ${b.boxes}, spheres ${b.spheres}, hulls ${b.hulls} (flat ${b.flatHulls}, degenerate ${b.degenerateHulls}), ` +
      `mesh triangles ${b.meshTriangles}, heightfields ${b.heightfields} (${b.heightfieldCells} cells); ` +
      `typed arrays ${(b.bytes / 1e6).toFixed(1)} MB, JS heap +${heap.toFixed(0)} MB; flags ${JSON.stringify(loaded.flagged)}`
  );

  const modeId = loaded.selection.mode;
  const spawnPin = modeId
    ? ((
        pins.modes[modeId]?.pins as {
          type: string;
          position: [number, number, number];
        }[]
      ).find((p) => p.type === 'spawn') ?? null)
    : null;
  const options = readDriveOptions(new URLSearchParams(''));
  const start = startPoint(
    world,
    spawnPin,
    pins.playable_box,
    options.capsule.halfHeight
  );
  if (start.standIn)
    say('  no spawn pin: starting at the playable box centre (stand-in)');
  const spawn = start.location;
  const session = new MovementSession({
    collision: world,
    ...tables,
    chassisId: PROTOTYPE_CHASSIS,
    level: options.level,
    tierOverride: options.tierOverride,
    capsule: options.capsule,
    stepSeconds: null,
    spawn,
    params: options.params,
    values: optionValues(options),
  });
  const idle = { forward: 0, right: 0, viewYaw: 0, viewPitch: 0 };
  for (let i = 0; i < 180; i++) session.update(1 / 60, idle);

  if (values.containment) {
    const box = pins.playable_box as number[][];
    const steps = Math.round(Number(values.seconds) * 60);
    for (let heading = 0; heading < 360; heading += 45) {
      session.movement.teleport(spawn);
      for (let i = 0; i < 180; i++)
        session.update(1 / 60, { ...idle, viewYaw: heading });
      let max = 0;
      for (let i = 0; i < steps; i++) {
        session.update(1 / 60, {
          forward: 1,
          right: 0,
          viewYaw: heading,
          viewPitch: 0,
        });
        const l = session.movement.location;
        max = Math.max(max, Math.hypot(l.x - spawn.x, l.y - spawn.y));
      }
      const l = session.movement.location;
      const inside =
        l.x >= box[0][0] &&
        l.x <= box[1][0] &&
        l.y >= box[0][1] &&
        l.y <= box[1][1] &&
        l.z >= box[0][2];
      say(
        `  heading ${heading}: ends (${l.x.toFixed(0)}, ${l.y.toFixed(0)}, ${l.z.toFixed(0)}) ${session.movement.movementMode}, ` +
          `${(max / 100).toFixed(0)} m out at most, ${inside ? 'inside' : 'OUTSIDE'} the playable box`
      );
    }
    return;
  }
  const steps = Number(values.steps);
  for (const [name, dt] of [
    ['60 fps', 1 / 60],
    ['30 fps', 1 / 30],
  ] as const) {
    const coll: number[] = [];
    const upd: number[] = [];
    let queries = 0;
    let falling = 0;
    let yaw = 0;
    for (let i = 0; i < steps; i++) {
      yaw += 0.25;
      const r = session.update(dt, {
        forward: 1,
        right: 0,
        viewYaw: yaw,
        viewPitch: 0,
      });
      coll.push(r.queries.ms);
      upd.push(r.simMs);
      queries += r.queries.sweeps + r.queries.lineTraces + r.queries.overlaps;
      if (session.movement.isFalling()) falling++;
    }
    const l = session.movement.location;
    say(
      `  ${name}: ${steps} updates, ${falling} falling, ${(queries / steps).toFixed(1)} queries each; ` +
        `collision ms mean/p95/max ${stat(coll)}; whole update ${stat(upd)}; ` +
        `ends (${l.x.toFixed(0)}, ${l.y.toFixed(0)}, ${l.z.toFixed(0)}) ${session.movement.movementMode}`
    );
  }
}

const maps = values.map === 'all' ? Object.keys(mapTable) : [values.map!];
for (const map of maps) benchMap(map);
