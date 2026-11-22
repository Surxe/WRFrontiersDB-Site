/**
 * The map collision export (`Maps/<Map>.collision.bin`) loads and drives on
 * every map: the reader fails loudly on a bad file, parts are selected as a
 * match loads them, and a robot capsule lands on each map's collision.
 *
 * Needs the collision export in the data checkout (Parser PRs #139, #140;
 * published only after they merge). Without it these are skipped.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseCollisionFile,
  selectParts,
} from '../../src/scripts/movement/data/collision_file';
import { collidersFromFile } from '../../src/scripts/movement/collision/export_loader';
import { ExactCollisionWorld } from '../../src/scripts/movement/collision/exact/world';
import { CharacterMovementComponent } from '../../src/scripts/movement/engine/character_movement';
import { ROBOT_CAPSULE } from '../../src/scripts/movement/rules/tuned_movement';
import { ZERO } from '../../src/scripts/movement/math/vec';
import { startPoint } from '../../src/scripts/movement/start_point';

const say = (line: string): void => {
  process.stdout.write(line + '\n');
};

const ROOT = path.join(process.cwd(), 'WRFrontiersDB-Data', 'current');
const maps = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'Objects', 'Map.json'), 'utf-8')
) as Record<string, { files: { collision?: string; pins: string } }>;
const withCollision = Object.entries(maps).filter(([, m]) => m.files.collision);
const hasExport = withCollision.length > 0;
if (!hasExport)
  say('[collision_maps] skipped: this data has no Map.json files.collision');

const read = (file: string): ArrayBuffer => {
  const b = fs.readFileSync(path.join(ROOT, file));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

describe.skipIf(!hasExport)('map collision export', () => {
  it('every map in Map.json has one', () => {
    expect(withCollision.length).toBe(Object.keys(maps).length);
  });

  it('fails loudly on a bad file', () => {
    const good = read(withCollision[0][1].files.collision!);
    const bad = good.slice(0);
    new Uint8Array(bad)[0] = 0x58;
    expect(() => parseCollisionFile(bad)).toThrow(/bad magic/);
    // Rename a required field in the JSON chunk (same length).
    const bytes = new Uint8Array(good.slice(0));
    const length = new DataView(bytes.buffer).getUint32(12, true);
    const json = new TextDecoder().decode(bytes.subarray(20, 20 + length));
    const renamed = new TextEncoder().encode(
      json.replace(/"spheres":(\s*)\{/, '"sphereZ":$1{')
    );
    bytes.set(renamed, 20);
    expect(() => parseCollisionFile(bytes.buffer)).toThrow(
      /missing file\.spheres/
    );
  });

  it('selects base, the mode and the heaviest lighting variant', () => {
    const file = parseCollisionFile(read(maps.CrashSite.files.collision!));
    const sel = selectParts(file, { mode: 'Spearhead', lighting: null });
    const ids = [...sel.parts].map((i) => file.parts[i].id);
    expect(ids).toContain('base');
    for (const id of file.modes.Spearhead) expect(ids).toContain(id);
    // All CrashSite variants weigh 1: the first wins the tie.
    expect(sel.lighting).toBe(file.lighting[0]);
    expect(
      ids.filter(
        (id) => file.parts.find((p) => p.id === id)?.kind === 'lighting'
      )
    ).toEqual([file.lighting[0]]);
    expect(() =>
      selectParts(file, { mode: 'NoSuchMode', lighting: null })
    ).toThrow(/no mode/);
    expect(() =>
      selectParts(file, { mode: null, lighting: 'NoSuchLight' })
    ).toThrow(/no lighting/);
    const other = selectParts(file, { mode: null, lighting: file.lighting[2] });
    expect(other.lighting).toBe(file.lighting[2]);
  });

  it('keeps every flagged collider (boundary walls double-sided)', () => {
    const file = parseCollisionFile(read(maps.CrashSite.files.collision!));
    const loaded = collidersFromFile(file, { mode: null, lighting: null });
    expect(loaded.flagged.boundary).toBeGreaterThan(0);
    expect(loaded.flagged.destructible).toBeGreaterThan(0);
    const walls = loaded.set.meshes.filter(
      (m) => m.info.flags & file.flags.boundary
    );
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every((m) => m.doubleSided)).toBe(true);
  });

  for (const [id, map] of withCollision) {
    it(`${id}: a robot capsule lands on its collision`, () => {
      const file = parseCollisionFile(read(map.files.collision!));
      const mode = Object.keys(file.modes)[0] ?? null;
      const { set } = collidersFromFile(file, { mode, lighting: null });
      const world = new ExactCollisionWorld(set);
      const pins = JSON.parse(
        fs.readFileSync(path.join(ROOT, map.files.pins), 'utf-8')
      );
      const spawn = mode
        ? pins.modes[mode]?.pins.find(
            (p: { type: string }) => p.type === 'spawn'
          )
        : null;
      // No spawn pin (the firing range): drive mode's fallback.
      const { location: start } = startPoint(
        world,
        spawn ?? null,
        pins.playable_box,
        ROBOT_CAPSULE.halfHeight
      );
      const c = new CharacterMovementComponent(
        world,
        { ...ROBOT_CAPSULE },
        start,
        {
          gravityZ: -1680,
          maxStepHeight: 500,
        }
      );
      c.teleport(start);
      for (let i = 0; i < 240; i++) c.performMovement(1 / 60, ZERO);
      expect(c.movementMode).toBe('walking');
      expect(c.currentFloor.isWalkableFloor()).toBe(true);
    });
  }
});
